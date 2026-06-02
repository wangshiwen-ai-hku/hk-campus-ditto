import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { getStudentById, getSurveysForUser, saveStudent, saveSurvey } from "../db.js";
import { requireAuth } from "../core/auth-middleware.js";
import { onboardingGroups, findGroup } from "./questions.js";
import { applyOnboardingAnswers, buildPersonaSummary, buildProfileAnalysis, recomputeProfileComplete } from "./persona.js";
import { chatRouter } from "./chat.js";
import type { StudentProfile, Survey } from "../types.js";

export const onboardingRouter = Router();

function regenerateProfileInBackground(userId: string, language: string) {
  void (async () => {
    try {
      const user = await getStudentById(userId);
      if (!user) return;
      const surveys = await getSurveysForUser(userId);
      const personaSummary = await buildPersonaSummary(user);
      const profileAnalysis = await buildProfileAnalysis(user, surveys, language);
      const latestUser = await getStudentById(userId);
      if (!latestUser) return;
      latestUser.personaSummary = personaSummary;
      latestUser.profileAnalysis = profileAnalysis;
      await saveStudent(latestUser);
    } catch (error) {
      console.error("Background profile generation failed", error);
    }
  })();
}

onboardingRouter.use("/chat", chatRouter);

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
    preferredLocale: z.enum(["en", "zh-HK", "zh-CN"]).optional(),
    interests: z.array(z.string()),
    vibeTags: z.array(z.string()),
    dealBreakers: z.array(z.string()).default([]),
    crossUniOk: z.boolean().default(true),
    optedIn: z.boolean().default(true),
    availability: z.array(z.string()).default([]),
    datingPreferences: z.object({
      birthday: z.string().optional(),
      heightCm: z.number().optional(),
      hkMtrLocations: z.array(z.string()).optional(),
      datingGoal: z.enum(["life_partner", "long_term", "casual", "friends", "unsure"]).optional(),
      dateGenders: z.array(z.string()).optional(),
      ageRange: z.object({ min: z.number(), max: z.number() }).optional(),
      mbti: z.object({
        energy: z.string().optional(),
        information: z.string().optional(),
        decision: z.string().optional(),
        lifestyle: z.string().optional(),
      }).optional(),
      attractionSignals: z.object({
        heightAndBuild: z.string().optional(),
        facialFeatures: z.string().optional(),
        energyAndVibe: z.string().optional(),
        flexible: z.array(z.string()).optional(),
      }).optional(),
      matchMode: z.enum(["fast", "balanced", "intentional", "wait_for_the_one"]).optional(),
      phoneNumber: z.string().optional(),
      photoUrls: z.array(z.string()).optional(),
      mediaCards: z.array(z.object({
        photoUrl: z.string().optional(),
        caption: z.string().optional(),
      })).optional(),
    }).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload.", details: parsed.error.flatten() });

  const user = await getStudentById(req.auth!.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  const { datingPreferences, ...rest } = parsed.data;
  Object.assign(user, rest);
  
  if (datingPreferences) {
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      ...datingPreferences,
      attractionSignals: {
        ...(user.datingPreferences?.attractionSignals ?? {}),
        ...(datingPreferences.attractionSignals ?? {}),
      },
      mbti: {
        ...(user.datingPreferences?.mbti ?? {}),
        ...(datingPreferences.mbti ?? {}),
      }
    };
  }

  // advance stage to 'life' if it's currently 'auth' or 'basic'
  const order: Array<StudentProfile["onboardingStage"]> = ["auth", "basic", "life", "mind", "social", "complete"];
  const curIdx = order.indexOf(user.onboardingStage ?? "basic");
  const targetIdx = order.indexOf("life");
  if (targetIdx > curIdx) {
    user.onboardingStage = "life";
  }

  user.profileComplete = recomputeProfileComplete(user);
  await saveStudent(user);
  res.json({ ok: true, user });
});

onboardingRouter.post("/preferred-locale", requireAuth, async (req, res) => {
  const schema = z.object({
    preferredLocale: z.enum(["en", "zh-HK", "zh-CN"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload.", details: parsed.error.flatten() });

  const user = await getStudentById(req.auth!.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  user.preferredLocale = parsed.data.preferredLocale;
  await saveStudent(user);
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
      "onboarding_ldfr",
      "onboarding_media",
    ]),
    answers: z.record(z.string(), z.unknown()),
    language: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload.", details: parsed.error.flatten() });

  const group = findGroup(parsed.data.template);
  if (!group) return res.status(400).json({ error: "Unknown survey template." });

  const user = await getStudentById(req.auth!.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  user.onboardingAnswers = {
    ...(user.onboardingAnswers ?? {}),
    [parsed.data.template]: parsed.data.answers,
  };
  applyOnboardingAnswers(user, parsed.data.template, parsed.data.answers);

  const survey: Survey = {
    id: uuid(),
    userId: user.id,
    template: parsed.data.template,
    answers: parsed.data.answers,
    derivedSignals: [],
    at: new Date().toISOString(),
  };

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
    onboarding_ldfr: "social",
    onboarding_media: "complete",
  };
  const next = nextMap[parsed.data.template];
  if (next && order.indexOf(next) > cur) user.onboardingStage = next;

  user.profileComplete = recomputeProfileComplete(user);
  if (next === "complete") {
    delete user.profileAnalysis;
  }
  await Promise.all([
    saveStudent(user),
    saveSurvey(survey),
  ]);
  res.json({ ok: true, user, profileAnalysisPending: next === "complete" });
  if (next === "complete") {
    regenerateProfileInBackground(user.id, parsed.data.language ?? user.preferredLocale ?? "en");
  }
});

// Generate persona summary on demand (cheap LLM call, cached on user)
onboardingRouter.post("/persona/regenerate", requireAuth, async (req, res) => {
  const user = await getStudentById(req.auth!.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  const surveys = await getSurveysForUser(user.id);
  const lang = req.body?.language ?? user.preferredLocale ?? "en";
  user.personaSummary = await buildPersonaSummary(user);
  user.profileAnalysis = await buildProfileAnalysis(user, surveys, lang);
  await saveStudent(user);
  res.json({ ok: true, personaSummary: user.personaSummary, profileAnalysis: user.profileAnalysis });
});
