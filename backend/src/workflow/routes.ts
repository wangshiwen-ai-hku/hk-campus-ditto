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
import { verifyMatchEmailAction, type MatchEmailChoice } from "./email-actions.js";
import type { Database, Locale, MatchRecord } from "../types.js";

export const workflowRouter = Router();

function loadMatch(db: Awaited<ReturnType<typeof ensureDb>>, matchId: string) {
  const match = db.matches.find((m) => m.id === matchId);
  return match;
}

function userInMatch(match: { userAId: string; userBId: string }, userId: string) {
  return match.userAId === userId || match.userBId === userId;
}

async function applyMatchResponse(
  db: Database,
  match: MatchRecord,
  userId: string,
  choice: MatchEmailChoice,
  source: "app" | "email"
) {
  const wasBothAccepted = isBothAccepted(match);
  match.acceptances = (match.acceptances ?? []).filter((x) => x.userId !== userId);
  match.acceptances.push({ userId, choice, at: new Date().toISOString() });
  logEvent(match, "respond", { userId, choice, source });

  if (eitherDeclined(match) && match.status !== "declined") {
    if (["pending", "notified", "awaiting-acceptance"].includes(match.status)) {
      transition(match, "declined", { by: userId, source });
    } else {
      logEvent(match, "declined-after-progress", { by: userId, source });
    }
  } else if (!wasBothAccepted && isBothAccepted(match)) {
    if (match.status === "pending") transition(match, "notified", { source });
    if (match.status === "notified") transition(match, "awaiting-acceptance", { source });
    if (match.status === "awaiting-acceptance") transition(match, "mutual-accepted", { source });

    const a = db.students.find((s) => s.id === match.userAId);
    const b = db.students.find((s) => s.id === match.userBId);
    if (a && b) {
      recomputeSlotState(match, a, b);
      const post = match.status as string;
      if (post === "slot-proposing" || post === "slot-confirmed") {
        match.proposedPlace = (await pickPlace(db, match)) ?? match.proposedPlace;
      }
      await notify(a, "contact_shared", { match, partner: b });
      await notify(b, "contact_shared", { match, partner: a });
      logEvent(match, "contact-shared-email-sent", { source });
    }
  }
}

function responseCopy(locale: Locale | undefined, choice: MatchEmailChoice) {
  if (locale === "zh-HK") {
    return choice === "yes"
      ? { title: "已記錄，謝謝！", body: "您可以關閉此頁面。" }
      : { title: "多謝回饋，Dopa 會幫您再次配對。", body: "您可以關閉此頁面。" };
  }
  if (locale === "zh-CN") {
    return choice === "yes"
      ? { title: "已记录，谢谢！", body: "您可以关闭此页面。" }
      : { title: "谢谢反馈，Dopa 会帮您再次匹配。", body: "您可以关闭此页面。" };
  }
  return choice === "yes"
    ? { title: "Recorded. Thank you!", body: "You can close this page." }
    : { title: "Thank you for the feedback. Dopa will match you again.", body: "You can close this page." };
}

function renderEmailResponsePage(locale: Locale | undefined, choice: MatchEmailChoice) {
  const copy = responseCopy(locale, choice);
  return `<!doctype html>
<html lang="${locale ?? "en"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${copy.title}</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080b18;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(520px,calc(100vw - 40px));padding:36px 28px;border:1px solid rgba(255,47,120,.32);border-radius:28px;background:linear-gradient(135deg,rgba(255,47,120,.16),rgba(47,132,255,.12));box-shadow:0 24px 80px rgba(0,0,0,.32)}
    .brand{font-size:13px;font-weight:900;letter-spacing:.32em;color:#ff2f78;text-transform:uppercase;margin-bottom:22px}
    h1{font-size:30px;line-height:1.25;margin:0 0 14px}
    p{font-size:17px;line-height:1.7;color:#c9cedb;margin:0}
  </style>
</head>
<body>
  <main>
    <div class="brand">DopaMine</div>
    <h1>${copy.title}</h1>
    <p>${copy.body}</p>
  </main>
</body>
</html>`;
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

workflowRouter.get("/:matchId/email-response", async (req, res) => {
  const matchId = String(req.params.matchId);
  const userId = String(req.query.userId ?? "");
  const choice = String(req.query.choice ?? "");
  const sig = String(req.query.sig ?? "");

  if (!verifyMatchEmailAction(matchId, userId, choice, sig)) {
    return res.status(400).send("Invalid or expired match response link.");
  }

  const db = await ensureDb();
  const match = loadMatch(db, matchId);
  if (!match) return res.status(404).send("Match not found.");
  if (!userInMatch(match, userId)) return res.status(403).send("Not your match.");

  const user = db.students.find((s) => s.id === userId);
  await applyMatchResponse(db, match, userId, choice, "email");
  await saveDb(db);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(renderEmailResponsePage(user?.preferredLocale, choice));
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

  await applyMatchResponse(db, match, req.auth!.sub, parsed.data.choice, "app");

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
  const fallback = {
    introForA: language.startsWith("zh")
      ? `${b.fullName}和你有很多共同点！TA对${b.interests.slice(0, 2).join("和")}很感兴趣，${b.vibeTags[0] ? `是一个${b.vibeTags[0]}的人` : "期待和你见面"}。`
      : `${b.fullName} shares your interest in ${b.interests.slice(0, 2).join(" and ")}${b.vibeTags[0] ? ` and gives off ${b.vibeTags[0]} vibes` : ""}. Looking forward to meeting you!`,
    introForB: language.startsWith("zh")
      ? `${a.fullName}和你有很多共同点！TA对${a.interests.slice(0, 2).join("和")}很感兴趣，${a.vibeTags[0] ? `是一个${a.vibeTags[0]}的人` : "期待和你见面"}。`
      : `${a.fullName} shares your interest in ${a.interests.slice(0, 2).join(" and ")}${a.vibeTags[0] ? ` and gives off ${a.vibeTags[0]} vibes` : ""}. Looking forward to meeting you!`,
    conversationStarters: language.startsWith("zh")
      ? [`聊聊你们都喜欢的${a.interests[0] ?? "事情"}`, `问问对方在${a.major ?? "学校"}的有趣经历`]
      : [`Chat about ${a.interests[0] ?? "shared interests"}`, `Ask about life studying ${a.major ?? "at uni"}`],
    dateVibe: language.startsWith("zh") ? "轻松有趣的初次见面" : "A relaxed, fun first meeting",
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
