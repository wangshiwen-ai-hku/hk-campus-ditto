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
    datingPreferences: z.object({
      birthday: z.string().optional(),
      ethnicity: z.string().optional(),
      heightCm: z.number().optional(),
      datingGoal: z.enum(["life_partner", "long_term", "casual", "friends", "unsure"]).optional(),
      dateGenders: z.array(z.string()).optional(),
      ageRange: z.object({ min: z.number(), max: z.number() }).optional(),
      ethnicityPreferences: z.array(z.string()).optional(),
      attractionSignals: z.object({
        heightAndBuild: z.string().optional(),
        facialFeatures: z.string().optional(),
        energyAndVibe: z.string().optional(),
        flexible: z.array(z.string()).optional(),
      }).optional(),
      matchMode: z.enum(["fast", "balanced", "intentional", "wait_for_the_one"]).optional(),
      phoneNumber: z.string().optional(),
      photoUrls: z.array(z.string()).optional(),
    }).optional(),
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
    template: z.enum([
      "onboarding_life",
      "onboarding_mind",
      "onboarding_social",
      "onboarding_basics",
      "onboarding_preferences",
      "onboarding_attraction",
      "onboarding_media",
    ]),
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
    onboarding_basics: "mind",
    onboarding_preferences: "social",
    onboarding_attraction: "social",
    onboarding_media: "complete",
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
