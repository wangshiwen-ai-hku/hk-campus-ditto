import { Router } from "express";
import { z } from "zod";
import { ensureDb, saveDb } from "../db.js";
import { requireAdmin, requireAuth } from "../core/auth-middleware.js";
import { transition, logEvent, isBothAccepted, eitherDeclined } from "./state-machine.js";
import { confirmSlot, recomputeSlotState } from "./slot.js";
import { pickPlace } from "./place.js";
import { notify } from "../notify/index.js";
import { llmCall } from "../llm/client.js";
import { icebreakerPrompt } from "../llm/prompts.js";

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
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  for (const match of db.matches) {
    if (match.status !== "pending") continue;
    const a = db.students.find((s) => s.id === match.userAId);
    const b = db.students.find((s) => s.id === match.userBId);
    if (!a || !b) continue;
    await notify(a, "match_drop", { match, partner: b });
    await sleep(600);
    await notify(b, "match_drop", { match, partner: a });
    await sleep(600);
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

// 4. Confirm a slot (per-user dual confirmation)
workflowRouter.post("/:matchId/confirm-slot", requireAuth, async (req, res) => {
  const schema = z.object({ slot: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });

  const db = await ensureDb();
  const match = loadMatch(db, String(req.params.matchId));
  if (!match) return res.status(404).json({ error: "Match not found." });
  if (!userInMatch(match, req.auth!.sub)) return res.status(403).json({ error: "Not your match." });

  // Validate slot is in proposals
  const proposals = match.proposedSlots ?? match.overlapSlots ?? [];
  if (!proposals.includes(parsed.data.slot)) {
    return res.status(400).json({ error: "Slot not in proposals." });
  }

  // Record per-user confirmation
  match.dateConfirmations = (match.dateConfirmations ?? []).filter((x) => x.userId !== req.auth!.sub);
  match.dateConfirmations.push({
    userId: req.auth!.sub,
    slot: parsed.data.slot,
    at: new Date().toISOString(),
  });
  logEvent(match, "slot-confirmed-by-user", { slot: parsed.data.slot, by: req.auth!.sub });

  // Also set global confirmedSlot (use the first confirmer's choice or the latest)
  match.confirmedSlot = parsed.data.slot;
  if (match.status === "slot-proposing" || match.status === "mutual-accepted") {
    match.status = "slot-confirmed" as any;
  }

  // Check if partner already confirmed — if not, notify them
  const partnerId = match.userAId === req.auth!.sub ? match.userBId : match.userAId;
  const partnerConfirmed = match.dateConfirmations.some((x) => x.userId === partnerId);

  if (!partnerConfirmed) {
    const partner = db.students.find((s) => s.id === partnerId);
    const self = db.students.find((s) => s.id === req.auth!.sub);
    if (partner && self) {
      const emailResult = await notify(partner, "partner_confirmed", { match, partner: self });
      logEvent(match, "partner-notified", { partnerId, email: partner.email, emailOk: emailResult.ok });
    }
  }

  await saveDb(db);
  res.json({ ok: true, match });
});

// 5. Pick the place (LLM + rule) — also records per-user place confirmation
workflowRouter.post("/:matchId/pick-place", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const match = loadMatch(db, String(req.params.matchId));
  if (!match) return res.status(404).json({ error: "Match not found." });
  if (!userInMatch(match, req.auth!.sub)) return res.status(403).json({ error: "Not your match." });

  // Pick place if not already set
  if (!match.proposedPlace) {
    const place = await pickPlace(db, match);
    if (!place) return res.status(400).json({ error: "Could not pick a place." });
    match.proposedPlace = place;
    match.curatedDateSpot = place.name;
  }

  // Record per-user place confirmation
  const existing = (match.dateConfirmations ?? []).find((x) => x.userId === req.auth!.sub);
  if (existing) {
    existing.place = match.proposedPlace.name;
  } else {
    match.dateConfirmations = match.dateConfirmations ?? [];
    match.dateConfirmations.push({
      userId: req.auth!.sub,
      slot: match.confirmedSlot ?? "",
      place: match.proposedPlace.name,
      at: new Date().toISOString(),
    });
  }
  logEvent(match, "place-confirmed-by-user", { place: match.proposedPlace.name, by: req.auth!.sub });

  // Check dual confirmation: both users must have confirmed slot+place
  const confirmations = match.dateConfirmations ?? [];
  const aConfirm = confirmations.find((x) => x.userId === match.userAId && x.place);
  const bConfirm = confirmations.find((x) => x.userId === match.userBId && x.place);
  const bothConfirmed = !!(aConfirm && bConfirm);

  if (bothConfirmed && match.status !== "scheduled") {
    // Both users confirmed — transition to scheduled
    if (match.status === "slot-confirmed") transition(match, "place-confirmed");
    if (match.status === "place-confirmed") transition(match, "scheduled");

    const a = db.students.find((s) => s.id === match.userAId);
    const b = db.students.find((s) => s.id === match.userBId);
    if (a && b) {
      await notify(a, "date_scheduled", { match, partner: b });
      await notify(b, "date_scheduled", { match, partner: a });
    }
  } else if (!bothConfirmed) {
    // Only one side confirmed place — notify the other
    const partnerId = match.userAId === req.auth!.sub ? match.userBId : match.userAId;
    const partnerHasPlace = confirmations.some((x) => x.userId === partnerId && x.place);
    if (!partnerHasPlace) {
      const partner = db.students.find((s) => s.id === partnerId);
      const self = db.students.find((s) => s.id === req.auth!.sub);
      if (partner && self) {
        const emailResult = await notify(partner, "partner_confirmed", { match, partner: self });
        logEvent(match, "partner-notified", { partnerId, email: partner.email, emailOk: emailResult.ok });
      }
    }
  }

  await saveDb(db);
  res.json({ ok: true, match });
});

// 6. Generate AI icebreaker for a match
workflowRouter.post("/:matchId/icebreaker", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const match = loadMatch(db, String(req.params.matchId));
  if (!match) return res.status(404).json({ error: "Match not found." });
  if (!userInMatch(match, req.auth!.sub)) return res.status(403).json({ error: "Not your match." });

  // Return cached icebreaker if already generated
  if (match.icebreaker) {
    try {
      return res.json({ ok: true, icebreaker: JSON.parse(match.icebreaker) });
    } catch {
      // If cached value is not valid JSON, regenerate
    }
  }

  const a = db.students.find((s) => s.id === match.userAId);
  const b = db.students.find((s) => s.id === match.userBId);
  if (!a || !b) return res.status(404).json({ error: "Users not found." });

  const language = (req.body?.language ?? "en") as string;
  const { system, prompt } = icebreakerPrompt(a, b, match, language);

  try {
    const result = await llmCall<{
      introForA: string;
      introForB: string;
      conversationStarters: string[];
      dateVibe: string;
    }>({ system, prompt, tag: "icebreaker", maxOutputTokens: 600, temperature: 0.7 });

    if (result) {
      match.icebreaker = JSON.stringify(result);
      await saveDb(db);
      return res.json({ ok: true, icebreaker: result });
    }
  } catch {}

  // Fallback
  const isZh = language.startsWith("zh");
  const isHk = language === "zh-HK" || language === "yue";
  const fallback = {
    introForA: isHk
      ? `${b.fullName}同你有好多共同之處！佢對${b.interests.slice(0, 2).join("同埋")}好感興趣，${b.vibeTags[0] ? `係一個${b.vibeTags[0]}嘅人` : "期待同你見面"}。`
      : isZh
      ? `${b.fullName}和你有很多共同点！TA对${b.interests.slice(0, 2).join("和")}很感兴趣，${b.vibeTags[0] ? `是一个${b.vibeTags[0]}的人` : "期待和你见面"}。`
      : `${b.fullName} shares your interest in ${b.interests.slice(0, 2).join(" and ")}${b.vibeTags[0] ? ` and gives off ${b.vibeTags[0]} vibes` : ""}. Looking forward to meeting you!`,
    introForB: isHk
      ? `${a.fullName}同你有好多共同之處！佢對${a.interests.slice(0, 2).join("同埋")}好感興趣，${a.vibeTags[0] ? `係一個${a.vibeTags[0]}嘅人` : "期待同你見面"}。`
      : isZh
      ? `${a.fullName}和你有很多共同点！TA对${a.interests.slice(0, 2).join("和")}很感兴趣，${a.vibeTags[0] ? `是一个${a.vibeTags[0]}的人` : "期待和你见面"}。`
      : `${a.fullName} shares your interest in ${a.interests.slice(0, 2).join(" and ")}${a.vibeTags[0] ? ` and gives off ${a.vibeTags[0]} vibes` : ""}. Looking forward to meeting you!`,
    conversationStarters: isHk
      ? [`聊聊你哋都鍾意嘅${a.interests[0] ?? "嘢"}`, `問下對方喺大學嘅有趣經歷`]
      : isZh
      ? [`聊聊你们都喜欢的${a.interests[0] ?? "事情"}`, `问问对方在${a.major ?? "学校"}的有趣经历`]
      : [`Chat about ${a.interests[0] ?? "shared interests"}`, `Ask about life studying ${a.major ?? "at uni"}`],
    dateVibe: isHk ? "輕鬆有趣嘅初次見面" : isZh ? "轻松有趣的初次见面" : "A relaxed, fun first meeting",
  };
  match.icebreaker = JSON.stringify(fallback);
  await saveDb(db);
  res.json({ ok: true, icebreaker: fallback });
});

// 7. Mark a match as happened (after the date)
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
