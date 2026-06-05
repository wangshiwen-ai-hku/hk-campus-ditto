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
import { env } from "../core/env.js";
import type { Locale } from "../types.js";
import {
  verifySignedMatchEmailAction,
  verifyStoredMatchEmailAction,
  type MatchEmailChoice,
} from "./email-actions.js";

export const workflowRouter = Router();

function loadMatch(db: Awaited<ReturnType<typeof ensureDb>>, matchId: string) {
  const match = db.matches.find((m) => m.id === matchId);
  return match;
}

function userInMatch(match: { userAId: string; userBId: string }, userId: string) {
  return match.userAId === userId || match.userBId === userId;
}

async function applyMatchResponse(
  db: Awaited<ReturnType<typeof ensureDb>>,
  match: NonNullable<ReturnType<typeof loadMatch>>,
  userId: string,
  choice: MatchEmailChoice
) {
  match.acceptances = (match.acceptances ?? []).filter((x) => x.userId !== userId);
  match.acceptances.push({ userId, choice, at: new Date().toISOString() });
  logEvent(match, "respond", { userId, choice });

  if (eitherDeclined(match) && match.status !== "declined") {
    transition(match, "declined", { by: userId });
    return { contactShared: false };
  }

  if (!isBothAccepted(match)) return { contactShared: false };

  if (match.status === "pending") {
    transition(match, "notified", { by: userId, source: "email-response" });
  }
  if (match.status === "notified") {
    transition(match, "awaiting-acceptance", { by: userId, source: "email-response" });
  }
  if (match.status === "awaiting-acceptance") {
    transition(match, "mutual-accepted");
  }

  const a = db.students.find((s) => s.id === match.userAId);
  const b = db.students.find((s) => s.id === match.userBId);
  if (a && b) {
    recomputeSlotState(match, a, b);
    const post = match.status as string;
    if (post === "slot-proposing" || post === "slot-confirmed") {
      match.proposedPlace = (await pickPlace(db, match)) ?? match.proposedPlace;
      match.curatedDateSpot = match.proposedPlace?.name ?? match.curatedDateSpot;
    }

    const alreadySent = (match.events ?? []).some((event) => event.kind === "contacts-shared");
    if (!alreadySent) {
      await notify(a, "contact_shared", { match, partner: b });
      await notify(b, "contact_shared", { match, partner: a });
      logEvent(match, "contacts-shared");
      return { contactShared: true };
    }
  }

  return { contactShared: false };
}

const SUPPORTED_LOCALES = new Set(["en", "zh-HK", "zh-CN"]);

function normalizeLocale(value: unknown, fallback: Locale): Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.has(value) ? value as Locale : fallback;
}

function readIcebreakerByLocale(raw: string | undefined, locale: Locale) {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.[locale]?.introForA) return parsed[locale];
    if (parsed?.introForA && locale === "en") return parsed;
  } catch {
    return undefined;
  }
  return undefined;
}

function writeIcebreakerByLocale(raw: string | undefined, locale: Locale, value: unknown): string {
  let parsed: Record<string, unknown> = {};
  try {
    const existing = raw ? JSON.parse(raw) : {};
    parsed = existing?.introForA ? { en: existing } : existing;
  } catch {
    parsed = {};
  }
  parsed[locale] = value;
  return JSON.stringify(parsed);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function emailResponseCopy(locale: Locale, choice: MatchEmailChoice, mode: "landing" | "done") {
  if (mode === "landing") {
    if (choice === "yes") {
      return locale === "zh-HK"
        ? { title: "確認今次配對？", body: "為咗保護雙方私隱，請再撳一次 Confirm。Dopa 只會喺雙方都確認後分享聯絡方式。", button: "Confirm" }
        : locale === "zh-CN"
        ? { title: "确认本次匹配？", body: "为了保护双方隐私，请再点击一次 Confirm。Dopa 只会在双方都确认后分享联系方式。", button: "Confirm" }
        : { title: "Confirm this match?", body: "To protect both sides, please tap Confirm once more. Dopa only shares contact details after both people confirm.", button: "Confirm" };
    }
    return locale === "zh-HK"
      ? { title: "取消今次配對？", body: "如果您覺得今次唔太適合，可以放心取消。Dopa 會溫柔記錄，之後再幫您配對。", button: "Cancel" }
      : locale === "zh-CN"
      ? { title: "取消本次匹配？", body: "如果您觉得这次不太适合，可以放心取消。Dopa 会温柔记录，之后再帮您匹配。", button: "Cancel" }
      : { title: "Cancel this match?", body: "If this does not feel right, you can cancel with no pressure. Dopa will record it gently and keep looking.", button: "Cancel" };
  }

  if (choice === "yes") {
    return locale === "zh-HK"
      ? { title: "已收到您嘅確認", body: "已記錄，謝謝！" }
      : locale === "zh-CN"
      ? { title: "已收到您的确认", body: "已记录，谢谢！" }
      : { title: "Your confirmation is in", body: "Recorded. Thank you!" };
  }
  return locale === "zh-HK"
    ? { title: "已為您取消今次配對", body: "多謝回饋，Dopa 會幫您再次配對。" }
    : locale === "zh-CN"
    ? { title: "已为您取消本次匹配", body: "谢谢反馈，Dopa 会帮您再次匹配。" }
    : { title: "This match has been cancelled", body: "Thank you for the feedback. Dopa will match you again." };
}

function renderEmailResponsePage(options: {
  title: string;
  body: string;
  button?: string;
  method?: "post";
  fields?: Record<string, string>;
  action?: string;
}) {
  const hiddenFields = Object.entries(options.fields ?? {})
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`)
    .join("");
  const form = options.button && options.action
    ? `<form method="${options.method ?? "post"}" action="${escapeHtml(options.action)}" style="margin-top:24px;">
        ${hiddenFields}
        <button type="submit" style="width:100%;border:0;border-radius:18px;background:linear-gradient(90deg,#ec2f72,#8b5cf6);color:white;font-size:18px;font-weight:900;padding:16px 22px;white-space:nowrap;box-shadow:0 16px 34px rgba(236,47,114,0.28);">${escapeHtml(options.button)}</button>
      </form>`
    : "";
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DopaMine</title></head>
<body style="margin:0;background:#090d16;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <main style="min-height:100vh;display:grid;place-items:center;padding:24px;">
    <section style="max-width:520px;border:1px solid rgba(255,255,255,0.12);background:#141b2b;border-radius:28px;padding:34px;box-shadow:0 24px 60px rgba(0,0,0,0.42);">
      <div style="font-size:28px;font-weight:950;margin-bottom:18px;color:#ff4f8b;">DopaMine</div>
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;">${escapeHtml(options.title)}</h1>
      <p style="margin:0;color:#cbd5e1;font-size:16px;line-height:1.7;">${escapeHtml(options.body)}</p>
      ${form}
    </section>
  </main>
</body></html>`;
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

// Public signed email action. GET only renders a confirmation page so email
// security scanners cannot accidentally confirm/cancel by prefetching links.
workflowRouter.get("/:matchId/email-response", async (req, res) => {
  const choice = req.query.choice === "yes" || req.query.choice === "no" ? req.query.choice : undefined;
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  const sig = typeof req.query.sig === "string" ? req.query.sig : "";
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const matchId = String(req.params.matchId);

  const db = await ensureDb();
  const match = loadMatch(db, matchId);
  if (!match) return res.status(404).send("Match not found.");
  if (!userInMatch(match, userId)) return res.status(403).send("This response link does not belong to this match.");

  const verified = !!choice && (
    (token && verifyStoredMatchEmailAction(match, userId, choice, token, { markUsed: false })) ||
    (sig && verifySignedMatchEmailAction(matchId, userId, choice, sig))
  );
  if (!verified || !choice) {
    return res.status(400).send("Invalid or expired match response link.");
  }

  const user = db.students.find((s) => s.id === userId);
  const locale = normalizeLocale(user?.preferredLocale, "en");
  const copy = emailResponseCopy(locale, choice, "landing");
  res.send(renderEmailResponsePage({
    ...copy,
    action: `/api/workflow/${encodeURIComponent(matchId)}/email-response`,
    fields: { userId, choice, token, sig },
  }));
});

workflowRouter.post("/:matchId/email-response", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const choice = body.choice === "yes" || body.choice === "no" ? body.choice : undefined;
  const userId = typeof body.userId === "string" ? body.userId : "";
  const sig = typeof body.sig === "string" ? body.sig : "";
  const token = typeof body.token === "string" ? body.token : "";
  const matchId = String(req.params.matchId);

  const db = await ensureDb();
  const match = loadMatch(db, matchId);
  if (!match) return res.status(404).send("Match not found.");
  if (!userInMatch(match, userId)) return res.status(403).send("This response link does not belong to this match.");

  const verified = !!choice && (
    (token && verifyStoredMatchEmailAction(match, userId, choice, token)) ||
    (sig && verifySignedMatchEmailAction(matchId, userId, choice, sig))
  );
  if (!verified || !choice) {
    return res.status(400).send("Invalid or expired match response link.");
  }

  await applyMatchResponse(db, match, userId, choice);
  await saveDb(db);

  res.redirect(303, `${env.email.frontendUrl}/student?tab=matches`);
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

  await applyMatchResponse(db, match, req.auth!.sub, parsed.data.choice);

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
  const viewer = db.students.find((s) => s.id === req.auth!.sub);
  if (!viewer) return res.status(404).json({ error: "User not found." });
  const language = normalizeLocale(req.body?.language, viewer.preferredLocale ?? "en");

  // Cache per viewer language. A zh-HK generated intro must never be reused
  // for a zh-CN viewer, and vice versa.
  const cached = readIcebreakerByLocale(match.icebreaker, language);
  if (cached) return res.json({ ok: true, icebreaker: cached });

  const a = db.students.find((s) => s.id === match.userAId);
  const b = db.students.find((s) => s.id === match.userBId);
  if (!a || !b) return res.status(404).json({ error: "Users not found." });

  const { system, prompt } = icebreakerPrompt(a, b, match, language);

  try {
    const result = await llmCall<{
      introForA: string;
      introForB: string;
      conversationStarters: string[];
      dateVibe: string;
    }>({ system, prompt, responseJson: true, tag: "icebreaker", maxOutputTokens: 600, temperature: 0.7 });

    if (result.json && !result.usedFallback) {
      match.icebreaker = writeIcebreakerByLocale(match.icebreaker, language, result.json);
      await saveDb(db);
      return res.json({ ok: true, icebreaker: result.json });
    }
  } catch {}

  // Fallback
  const isZh = language.startsWith("zh");
  const isHk = language === "zh-HK";
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
  match.icebreaker = writeIcebreakerByLocale(match.icebreaker, language, fallback);
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
