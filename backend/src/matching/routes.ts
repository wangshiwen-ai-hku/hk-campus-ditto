import { Router } from "express";
import { z } from "zod";
import { ensureDb, saveDb } from "../db.js";
import { requireAdmin, requireAuth } from "../core/auth-middleware.js";
import { rankCandidatesFor, runWeeklyMatchmaking } from "./ranker.js";
import { poolFor } from "./filter.js";
import { callBudget } from "../llm/client.js";

export const matchingRouter = Router();

// Get current active match for the authenticated user
matchingRouter.get("/current", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const userId = req.auth!.sub;
  const match = db.matches.find(
    (m) =>
      (m.userAId === userId || m.userBId === userId) &&
      [
        "pending",
        "notified",
        "awaiting-acceptance",
        "mutual-accepted",
        "slot-proposing",
        "slot-confirmed",
        "place-confirmed",
        "scheduled",
        "awaiting-availability",
      ].includes(m.status)
  );
  if (!match) return res.json({ matchView: null });
  const partnerId = match.userAId === userId ? match.userBId : match.userAId;
  const partner = db.students.find((s) => s.id === partnerId);
  const university = partner ? db.universities.find((u) => u.id === partner.universityId) : undefined;
  res.json({ matchView: { match, partner, university } });
});

// Preview top candidates for the authenticated user (for tuning, no DB writes)
matchingRouter.get("/preview", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const me = db.students.find((s) => s.id === req.auth!.sub);
  if (!me) return res.status(404).json({ error: "User not found." });
  const pool = poolFor(me, db.students);
  const useLlm = req.query.llm === "1";
  const ranked = await rankCandidatesFor(me, pool, db, { useLlmJudge: useLlm, topK: 5 });
  res.json({
    user: { id: me.id, name: me.fullName },
    candidates: ranked.map((r) => ({
      candidate: { id: r.candidate.id, name: r.candidate.fullName, university: r.candidate.universityId },
      structuredScore: r.structured.total,
      finalScore: r.finalScore,
      llm: r.llm,
    })),
  });
});

// Admin/cron-triggered: run a matchmaking round.
matchingRouter.post("/run", requireAdmin, async (req, res) => {
  const schema = z.object({
    adminSecret: z.string().optional(),
    useLlmJudge: z.boolean().default(true),
    minStructuredScore: z.number().default(55),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });
  // require admin secret in non-dev
  // (In MVP we still allow no-secret to keep demo simple; protect properly later.)
  callBudget.reset();
  const db = await ensureDb();
  const result = await runWeeklyMatchmaking(db, {
    useLlmJudge: parsed.data.useLlmJudge,
    minStructuredScore: parsed.data.minStructuredScore,
  });
  await saveDb(db);
  res.json({
    ok: true,
    created: result.created.length,
    skipped: result.skippedNoCandidate.length,
    matches: result.created.map((m) => ({ id: m.id, a: m.userAId, b: m.userBId, score: m.score })),
    llmCalls: callBudget.count(),
  });
});
