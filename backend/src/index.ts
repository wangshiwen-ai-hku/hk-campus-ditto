import express from "express";
import cors from "cors";
import { ensureDb, resetDb } from "./db.js";
import { env } from "./core/env.js";
import { requireAdmin } from "./core/auth-middleware.js";
import { authRouter } from "./auth/routes.js";
import { onboardingRouter } from "./onboarding/routes.js";
import { matchingRouter } from "./matching/routes.js";
import { workflowRouter } from "./workflow/routes.js";
import { feedbackRouter } from "./feedback/routes.js";
import { memoryRouter } from "./memory/routes.js";
import { devRouter } from "./dev/routes.js";
import { inviteStats } from "./auth/invite.js";

const app = express();
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (env.cors.origins.includes("*") || env.cors.origins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS."));
  },
}));
app.use(express.json({ limit: "10mb" }));

function nextWednesdayAt7pm() {
  const date = new Date();
  const day = date.getDay();
  const diff = (3 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  date.setHours(19, 0, 0, 0);
  return date.toISOString();
}

// Health & meta
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/meta", async (_req, res) => {
  const db = await ensureDb();
  res.json({
    universities: db.universities,
    nextDrop: nextWednesdayAt7pm(),
    stats: {
      students: db.students.length,
      activeMatches: db.matches.filter((m) =>
        ["pending", "notified", "awaiting-acceptance", "mutual-accepted",
         "slot-proposing", "slot-confirmed", "place-confirmed", "scheduled",
         "awaiting-availability"].includes(m.status)
      ).length,
      scheduledDates: db.matches.filter((m) => m.status === "scheduled").length,
      availableInvites: db.inviteCodes.filter((i) => !i.usedBy).length,
    },
    demoAccounts: db.students.slice(0, 6).map((s) => ({
      id: s.id, fullName: s.fullName, email: s.email, universityId: s.universityId,
    })),
    config: {
      llmProvider: env.llm.provider,
      llmModel: env.llm.model,
      emailProvider: env.email.provider,
      inviteRequired: env.auth.inviteRequired,
    },
  });
});

// Profile read (public-ish; use auth in production)
app.get("/api/profile/:userId", async (req, res) => {
  const db = await ensureDb();
  const user = db.students.find((s) => s.id === req.params.userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json(user);
});

// Modular service routers
app.use("/api/auth", authRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/matches", matchingRouter);
app.use("/api/workflow", workflowRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/memory", memoryRouter);
app.use("/api/dev", devRouter);

// Admin overview (kept for the existing demo dashboard)
app.get("/api/admin/overview", requireAdmin, async (_req, res) => {
  const db = await ensureDb();
  const universityMap = Object.fromEntries(db.universities.map((u) => [u.id, u.shortName]));
  const invites = inviteStats(db);
  res.json({
    stats: {
      students: db.students.length,
      completedProfiles: db.students.filter((s) => s.profileComplete).length,
      scheduledDates: db.matches.filter((m) => m.status === "scheduled").length,
      closedDates: db.matches.filter((m) => m.status === "closed").length,
      surveys: db.surveys.length,
      invitesAvailable: invites.available,
      invitesUsed: invites.used,
    },
    students: db.students.map((s) => ({
      ...s,
      universityLabel: universityMap[s.universityId] ?? s.universityId,
    })),
    matches: db.matches.map((m) => ({
      ...m,
      userALabel: db.students.find((s) => s.id === m.userAId)?.fullName ?? m.userAId,
      userBLabel: db.students.find((s) => s.id === m.userBId)?.fullName ?? m.userBId,
    })),
    invites: db.inviteCodes,
    inviteStats: invites,
  });
});

app.post("/api/dev/reset", requireAdmin, async (_req, res) => {
  const db = await resetDb();
  res.json({ ok: true, students: db.students.length });
});

app.listen(env.port, () => {
  console.log(`Aura HK API listening on http://localhost:${env.port}`);
  console.log(`LLM provider=${env.llm.provider} model=${env.llm.model} | email provider=${env.email.provider}`);
});
