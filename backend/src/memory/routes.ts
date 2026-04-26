import { Router } from "express";
import { z } from "zod";
import { ensureDb, saveDb } from "../db.js";
import { requireAuth } from "../core/auth-middleware.js";
import { buildUserMemory, listUserSurveys } from "./store.js";
import { buildHistory } from "./history.js";

export const memoryRouter = Router();

// Full personal memory snapshot (preferences + signals + persona)
memoryRouter.get("/me", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const view = buildUserMemory(db, req.auth!.sub);
  if (!view) return res.status(404).json({ error: "User not found." });
  res.json({ memory: view });
});

// Personal date history (derived view of MatchRecord + own feedback)
memoryRouter.get("/history", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const items = buildHistory(db, req.auth!.sub);
  res.json({ items });
});

// Raw surveys for the user (onboarding + post-date)
memoryRouter.get("/surveys", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const items = listUserSurveys(db, req.auth!.sub);
  res.json({ items });
});

// User-level preference editing (vibe weights, dealbreakers, crossUniOk)
memoryRouter.post("/preferences", requireAuth, async (req, res) => {
  const schema = z.object({
    crossUniOk: z.boolean().optional(),
    dealBreakers: z.array(z.string()).optional(),
    vibeWeights: z.record(z.string(), z.number()).optional(),
    optedIn: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });

  const db = await ensureDb();
  const user = db.students.find((s) => s.id === req.auth!.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  if (parsed.data.crossUniOk !== undefined) user.crossUniOk = parsed.data.crossUniOk;
  if (parsed.data.dealBreakers) user.dealBreakers = parsed.data.dealBreakers;
  if (parsed.data.vibeWeights) user.vibeWeights = { ...(user.vibeWeights ?? {}), ...parsed.data.vibeWeights };
  if (parsed.data.optedIn !== undefined) user.optedIn = parsed.data.optedIn;

  await saveDb(db);
  res.json({ ok: true, memory: buildUserMemory(db, user.id) });
});

// Block / unblock a partner manually
memoryRouter.post("/block", requireAuth, async (req, res) => {
  const schema = z.object({ partnerId: z.string(), action: z.enum(["block", "unblock"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });
  const db = await ensureDb();
  const user = db.students.find((s) => s.id === req.auth!.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  user.blockedUserIds = user.blockedUserIds ?? [];
  if (parsed.data.action === "block" && !user.blockedUserIds.includes(parsed.data.partnerId)) {
    user.blockedUserIds.push(parsed.data.partnerId);
  } else if (parsed.data.action === "unblock") {
    user.blockedUserIds = user.blockedUserIds.filter((id) => id !== parsed.data.partnerId);
  }
  await saveDb(db);
  res.json({ ok: true, blockedUserIds: user.blockedUserIds });
});
