import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { ensureDb, saveDb } from "../db.js";
import { requireAuth } from "../core/auth-middleware.js";
import { onboardingGroups, findGroup } from "./questions.js";
import { applyOnboardingAnswers, buildPersonaSummary, recomputeProfileComplete } from "./persona.js";

export const onboardingRouter = Router();

// Public: question bank for client to render forms
onboardingRouter.get("/questions", (_req, res) => {
  res.json({ groups: onboardingGroups });
});

// Profile basics (name/bio/interests/etc) — stage "basic"
onboardingRouter.post("/profile", requireAuth, async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2),
    yearOfStudy: z.string(),
    major: z.string(),
    gender: z.string(),
    seeking: z.string(),
    bio: z.string(),
    languages: z.array(z.string()),
    interests: z.array(z.string()),
    vibeTags: z.array(z.string()),
    dealBreakers: z.array(z.string()).default([]),
    crossUniOk: z.boolean().default(false),
    optedIn: z.boolean().default(true),
    availability: z.array(z.string()).default([]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload.", details: parsed.error.flatten() });

  const db = await ensureDb();
  const user = db.students.find((s) => s.id === req.auth!.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  Object.assign(user, parsed.data);
  user.onboardingStage = "life";
  user.profileComplete = recomputeProfileComplete(user);
  await saveDb(db);
  res.json({ ok: true, user });
});

// Submit one onboarding survey group (life / mind / social)
onboardingRouter.post("/survey", requireAuth, async (req, res) => {
  const schema = z.object({
    template: z.enum(["onboarding_life", "onboarding_mind", "onboarding_social"]),
    answers: z.record(z.string(), z.unknown()),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });

  const group = findGroup(parsed.data.template);
  if (!group) return res.status(400).json({ error: "Unknown survey template." });

  const db = await ensureDb();
  const user = db.students.find((s) => s.id === req.auth!.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  applyOnboardingAnswers(user, parsed.data.template, parsed.data.answers);

  db.surveys.push({
    id: uuid(),
    userId: user.id,
    template: parsed.data.template,
    answers: parsed.data.answers,
    derivedSignals: [],
    at: new Date().toISOString(),
  });

  // advance stage
  const order: Array<typeof user.onboardingStage> = ["auth", "basic", "life", "mind", "social", "complete"];
  const cur = order.indexOf(user.onboardingStage ?? "basic");
  const nextMap: Record<string, typeof user.onboardingStage> = {
    onboarding_life: "mind",
    onboarding_mind: "social",
    onboarding_social: "complete",
  };
  const next = nextMap[parsed.data.template];
  if (next && order.indexOf(next) > cur) user.onboardingStage = next;

  user.profileComplete = recomputeProfileComplete(user);
  await saveDb(db);
  res.json({ ok: true, user });
});

// Generate persona summary on demand (cheap LLM call, cached on user)
onboardingRouter.post("/persona/regenerate", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const user = db.students.find((s) => s.id === req.auth!.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  user.personaSummary = await buildPersonaSummary(user);
  await saveDb(db);
  res.json({ ok: true, personaSummary: user.personaSummary });
});
