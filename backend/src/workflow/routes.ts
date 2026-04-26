import { Router } from "express";
import { z } from "zod";
import { ensureDb, saveDb } from "../db.js";
import { requireAdmin, requireAuth } from "../core/auth-middleware.js";
import { transition, logEvent, isBothAccepted, eitherDeclined } from "./state-machine.js";
import { confirmSlot, recomputeSlotState } from "./slot.js";
import { pickPlace } from "./place.js";
import { notify } from "../notify/index.js";

export const workflowRouter = Router();

function loadMatch(db: Awaited<ReturnType<typeof ensureDb>>, matchId: string) {
  const match = db.matches.find((m) => m.id === matchId);
  return match;
}

function userInMatch(match: { userAId: string; userBId: string }, userId: string) {
  return match.userAId === userId || match.userBId === userId;
}

// 1. Send "drop" notifications for new pending matches (admin-triggered)
workflowRouter.post("/drop", requireAdmin, async (_req, res) => {
  const db = await ensureDb();
  const dropped: string[] = [];
  for (const match of db.matches) {
    if (match.status !== "pending") continue;
    const a = db.students.find((s) => s.id === match.userAId);
    const b = db.students.find((s) => s.id === match.userBId);
    if (!a || !b) continue;
    await notify(a, "match_drop", { match, partner: b });
    await notify(b, "match_drop", { match, partner: a });
    transition(match, "notified", { dropAt: new Date().toISOString() });
    transition(match, "awaiting-acceptance");
    dropped.push(match.id);
  }
  await saveDb(db);
  res.json({ ok: true, dropped });
});

// 2. Accept / decline a match (per user)
workflowRouter.post("/:matchId/respond", requireAuth, async (req, res) => {
  const schema = z.object({ choice: z.enum(["yes", "no"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid choice." });

  const db = await ensureDb();
  const match = loadMatch(db, String(req.params.matchId));
  if (!match) return res.status(404).json({ error: "Match not found." });
  if (!userInMatch(match, req.auth!.sub)) return res.status(403).json({ error: "Not your match." });

  match.acceptances = (match.acceptances ?? []).filter((x) => x.userId !== req.auth!.sub);
  match.acceptances.push({ userId: req.auth!.sub, choice: parsed.data.choice, at: new Date().toISOString() });
  logEvent(match, "respond", { userId: req.auth!.sub, choice: parsed.data.choice });

  if (eitherDeclined(match) && match.status !== "declined") {
    transition(match, "declined", { by: req.auth!.sub });
  } else if (isBothAccepted(match) && match.status === "awaiting-acceptance") {
    transition(match, "mutual-accepted");
    const a = db.students.find((s) => s.id === match.userAId);
    const b = db.students.find((s) => s.id === match.userBId);
    if (a && b) {
      recomputeSlotState(match, a, b);
      // attempt to also propose a place once we have a slot
      const post = match.status as string;
      if (post === "slot-proposing" || post === "slot-confirmed") {
        match.proposedPlace = (await pickPlace(db, match)) ?? match.proposedPlace;
      }
    }
  }

  await saveDb(db);
  res.json({ ok: true, match });
});

// 3. Update availability (recomputes slot proposals on active match)
workflowRouter.post("/availability", requireAuth, async (req, res) => {
  const schema = z.object({ availability: z.array(z.string()) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });

  const db = await ensureDb();
  const user = db.students.find((s) => s.id === req.auth!.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  user.availability = parsed.data.availability;

  const match = db.matches.find(
    (m) =>
      userInMatch(m, user.id) &&
      ["mutual-accepted", "slot-proposing", "awaiting-availability"].includes(m.status)
  );
  if (match) {
    const partnerId = match.userAId === user.id ? match.userBId : match.userAId;
    const partner = db.students.find((s) => s.id === partnerId);
    if (partner) recomputeSlotState(match, user, partner);
  }
  await saveDb(db);
  res.json({ ok: true, user, match });
});

// 4. Confirm a slot (from the proposed list)
workflowRouter.post("/:matchId/confirm-slot", requireAuth, async (req, res) => {
  const schema = z.object({ slot: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });

  const db = await ensureDb();
  const match = loadMatch(db, String(req.params.matchId));
  if (!match) return res.status(404).json({ error: "Match not found." });
  if (!userInMatch(match, req.auth!.sub)) return res.status(403).json({ error: "Not your match." });

  const result = confirmSlot(match, parsed.data.slot);
  if (!result.ok) return res.status(400).json({ error: result.reason });
  logEvent(match, "slot-confirmed", { slot: parsed.data.slot, by: req.auth!.sub });
  await saveDb(db);
  res.json({ ok: true, match });
});

// 5. Pick the place (LLM + rule)
workflowRouter.post("/:matchId/pick-place", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const match = loadMatch(db, String(req.params.matchId));
  if (!match) return res.status(404).json({ error: "Match not found." });
  if (!userInMatch(match, req.auth!.sub)) return res.status(403).json({ error: "Not your match." });

  const place = await pickPlace(db, match);
  if (!place) return res.status(400).json({ error: "Could not pick a place." });
  match.proposedPlace = place;
  match.curatedDateSpot = place.name;
  if (match.status === "slot-confirmed") {
    transition(match, "place-confirmed");
    transition(match, "scheduled");
    const a = db.students.find((s) => s.id === match.userAId);
    const b = db.students.find((s) => s.id === match.userBId);
    if (a && b) {
      await notify(a, "date_scheduled", { match, partner: b });
      await notify(b, "date_scheduled", { match, partner: a });
    }
  }
  await saveDb(db);
  res.json({ ok: true, match });
});

// 6. Mark a match as happened (after the date)
workflowRouter.post("/:matchId/mark-happened", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const match = loadMatch(db, String(req.params.matchId));
  if (!match) return res.status(404).json({ error: "Match not found." });
  if (!userInMatch(match, req.auth!.sub)) return res.status(403).json({ error: "Not your match." });
  if (match.status !== "scheduled") {
    return res.status(400).json({ error: `Cannot mark happened from ${match.status}.` });
  }
  transition(match, "happened", { by: req.auth!.sub });
  await saveDb(db);
  res.json({ ok: true, match });
});
