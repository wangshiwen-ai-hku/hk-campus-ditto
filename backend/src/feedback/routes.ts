import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { ensureDb, saveDb } from "../db.js";
import { requireAuth } from "../core/auth-middleware.js";
import { postDateGroups } from "./templates.js";
import { applyVibeWeightDelta, extractFeedbackSignals } from "./signals.js";
import { transition, logEvent } from "../workflow/state-machine.js";

export const feedbackRouter = Router();

feedbackRouter.get("/templates", (_req, res) => {
  res.json({ groups: postDateGroups });
});

// Submit a post-date survey (either 2h or 24h template). Also accepts the legacy quick sentiment.
feedbackRouter.post("/:matchId/submit", requireAuth, async (req, res) => {
  const schema = z.object({
    template: z.enum(["post_date_2h", "post_date_24h"]),
    answers: z.record(z.string(), z.unknown()),
    sentiment: z.enum(["love", "pass", "rematch"]).optional(),
    notes: z.string().default(""),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });

  const db = await ensureDb();
  const match = db.matches.find((m) => m.id === req.params.matchId);
  if (!match) return res.status(404).json({ error: "Match not found." });
  if (![match.userAId, match.userBId].includes(req.auth!.sub)) {
    return res.status(403).json({ error: "Not your match." });
  }
  const user = db.students.find((s) => s.id === req.auth!.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  // Persist raw survey
  const notesText =
    parsed.data.notes ||
    [parsed.data.answers.oneLine, parsed.data.answers.matchedExpectations, parsed.data.answers.adjustVibe]
      .filter((x) => typeof x === "string")
      .join("\n");

  const signals = await extractFeedbackSignals(notesText as string, match);

  db.surveys.push({
    id: uuid(),
    userId: user.id,
    matchId: match.id,
    template: parsed.data.template,
    answers: parsed.data.answers,
    derivedSignals: [
      ...signals.positiveTags.map((t) => `+${t}`),
      ...signals.negativeTags.map((t) => `-${t}`),
    ],
    at: new Date().toISOString(),
  });

  // Update user weights from extracted signals
  if (Object.keys(signals.vibeAdjustments).length) {
    applyVibeWeightDelta(user, signals.vibeAdjustments);
  }
  if (signals.wantSeeAgain === false) {
    user.blockedUserIds = user.blockedUserIds ?? [];
    const partnerId = match.userAId === user.id ? match.userBId : match.userAId;
    if (!user.blockedUserIds.includes(partnerId)) user.blockedUserIds.push(partnerId);
  }

  // Append to match.feedback for legacy compatibility
  if (parsed.data.sentiment) {
    match.feedback.push({
      userId: user.id,
      sentiment: parsed.data.sentiment,
      notes: notesText as string,
      at: new Date().toISOString(),
    });
  }

  // Advance state if appropriate
  if (match.status === "happened") {
    transition(match, "feedback-collected", { by: user.id });
  } else {
    logEvent(match, "feedback", { template: parsed.data.template, by: user.id });
  }
  // close once both submitted any feedback
  const userIdsSubmitted = new Set(
    db.surveys
      .filter((s) => s.matchId === match.id)
      .map((s) => s.userId)
  );
  if (
    userIdsSubmitted.has(match.userAId) &&
    userIdsSubmitted.has(match.userBId) &&
    match.status === "feedback-collected"
  ) {
    transition(match, "closed");
  }

  await saveDb(db);
  res.json({ ok: true, match, signals });
});
