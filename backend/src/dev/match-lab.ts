import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { ensureDb, saveDb } from "../db.js";
import { requireAdmin } from "../core/auth-middleware.js";
import type { Database, MatchRecord, StudentProfile } from "../types.js";
import { buildContext, isEligibleForRound, isEligiblePair, poolFor } from "../matching/filter.js";
import { rankCandidatesFor, type RankerCandidate } from "../matching/ranker.js";
import { structuredScore, hardConstraints } from "../matching/scorer.js";

export const matchLabRouter = Router();

const universities = ["hku", "cuhk", "hkust", "polyu", "cityu", "hkbu", "lingnan", "eduhk"];
const majors = ["Computer Science", "Law", "Medicine", "Psychology", "Architecture", "Business", "Design", "Education", "Engineering", "Data Science", "Journalism", "Finance"];
const years = ["Year 1", "Year 2", "Year 3", "Year 4", "Master", "PhD"];
const genders = ["onboarding.opt.male", "onboarding.opt.female", "onboarding.opt.non_binary"];
const targetSets = [
  ["onboarding.opt.female"],
  ["onboarding.opt.male"],
  ["onboarding.opt.non_binary", "onboarding.opt.female"],
  ["onboarding.opt.everyone"],
];
const goalSets = [
  ["onboarding.opt.life_partner", "onboarding.opt.long_term"],
  ["onboarding.opt.long_term"],
  ["onboarding.opt.casual"],
  ["onboarding.opt.friends", "onboarding.opt.unsure"],
  ["onboarding.opt.unsure"],
];
const modes = ["onboarding.opt.mode_fast", "onboarding.opt.mode_balanced", "onboarding.opt.mode_intentional", "onboarding.opt.mode_wait"];
const languages = [["onboarding.opt.lang_eng"], ["onboarding.opt.lang_canto"], ["onboarding.opt.lang_mando"], ["onboarding.opt.lang_eng", "onboarding.opt.lang_canto"], ["onboarding.opt.lang_mixed"]];
const locations = [["onboarding.opt.mtr_island"], ["onboarding.opt.mtr_east"], ["onboarding.opt.mtr_tsuen_wan_kwun_tong"], ["onboarding.opt.mtr_tuen_ma"], ["onboarding.opt.mtr_other"]];
const interests = ["coffee", "hiking", "citywalk", "film", "art", "tech", "thrifting", "cantopop", "supper", "night", "psychology", "startups", "basketball", "books"];
const vibes = ["chill", "curious", "empathetic", "playful", "grounded", "creative", "ambitious", "warm"];
const availability = ["wed_eve", "thu_eve", "fri_aft", "fri_eve", "sat_aft", "sun_aft"];

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

function pickMany<T>(arr: T[], index: number, count: number): T[] {
  return Array.from({ length: count }, (_, i) => pick(arr, index + i * 3));
}

function birthYearFor(index: number): string {
  const year = 1998 + (index % 9);
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 26) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function seedStudent(index: number, scenario: string): StudentProfile {
  const universityId = pick(universities, index);
  const major = pick(majors, index);
  const gender = pick(genders, index);
  const matchMode = scenario === "strict" ? pick(modes.slice(2), index) : scenario === "sparse" ? pick(["onboarding.opt.mode_wait", "onboarding.opt.mode_intentional"], index) : pick(modes, index);
  const hasPhoto = scenario === "extreme" ? index % 7 !== 0 : true;
  const targetGenders = scenario === "extreme" && index % 10 === 0 ? [gender] : pick(targetSets, index);
  return {
    id: `lab-${String(index + 1).padStart(3, "0")}`,
    fullName: `Lab User ${String(index + 1).padStart(2, "0")}`,
    email: `lab-${String(index + 1).padStart(3, "0")}@connect.${universityId === "hkust" ? "ust" : universityId}.hk`,
    universityId,
    yearOfStudy: pick(years, index),
    major,
    gender,
    seeking: "Meaningful connection",
    bio: `Interested in ${pickMany(interests, index, 3).join(", ")} and academic exchange around ${major}.`,
    languages: pick(languages, index),
    interests: pickMany(interests, index, 4),
    vibeTags: pickMany(vibes, index, 3),
    dealBreakers: index % 13 === 0 ? ["ghosting"] : [],
    photoUrl: hasPhoto ? `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='400'%3E%3Crect width='100%25' height='100%25' fill='%23${pick(["ef2f6d", "278cff", "31b87c", "8b5cf6"], index).replace("#", "")}'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='42' fill='white'%3EL${index + 1}%3C/text%3E%3C/svg%3E` : undefined,
    verificationStatus: "verified",
    joinedAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
    optedIn: index % 17 !== 0,
    availability: pickMany(availability, index, scenario === "sparse" ? 1 : 3),
    profileComplete: true,
    crossUniOk: scenario === "sparse" ? index % 3 === 0 : index % 4 !== 0,
    blockedUserIds: [],
    onboardingStage: "complete",
    lifeSignals: {
      weekendVibe: pick(interests, index),
      weekendVibes: pickMany(["onboarding.opt.vibe_cafe", "onboarding.opt.vibe_nature", "onboarding.opt.vibe_city", "onboarding.opt.vibe_dorm", "onboarding.opt.vibe_food"], index, 2),
    },
    datingPreferences: {
      birthday: birthYearFor(index),
      ethnicity: pick(["onboarding.opt.eth_east_asian", "onboarding.opt.eth_south_asian", "onboarding.opt.eth_white", "onboarding.opt.prefer_not_say"], index),
      heightCm: 155 + (index % 45),
      dateGenders: targetGenders,
      datingGoal: pick(goalSets, index)[0] as any,
      datingGoals: pick(goalSets, index),
      ageRange: scenario === "strict" ? { min: 20 + (index % 4), max: 23 + (index % 5) } : { min: 18, max: 32 },
      ethnicityPreferences: index % 5 === 0 ? ["onboarding.opt.no_pref"] : [pick(["onboarding.opt.eth_east_asian", "onboarding.opt.eth_south_asian", "onboarding.opt.eth_white"], index)],
      hkMtrLocations: pick(locations, index),
      languagePreferences: pick(languages, index),
      matchMode: matchMode as any,
      photoUrls: hasPhoto ? ["lab-photo"] : [],
      mbti: {
        energy: pick(["onboarding.opt.mbti_e", "onboarding.opt.mbti_i", "onboarding.opt.mbti_none"], index),
        information: pick(["onboarding.opt.mbti_s", "onboarding.opt.mbti_n", "onboarding.opt.mbti_none"], index),
        decision: pick(["onboarding.opt.mbti_t", "onboarding.opt.mbti_f", "onboarding.opt.mbti_none"], index),
        lifestyle: pick(["onboarding.opt.mbti_j", "onboarding.opt.mbti_p", "onboarding.opt.mbti_none"], index),
      },
      attractionSignals: {
        heightAndBuild: index % 2 ? "warm smile, active lifestyle" : "calm style, expressive eyes",
        facialFeatures: index % 3 ? "friendly face, bright eyes" : "clean look, gentle expression",
        energyAndVibe: pickMany(vibes, index, 2).join(", "),
      },
    },
  };
}

function labUsers(db: Database): StudentProfile[] {
  return db.students.filter((user) => user.id.startsWith("lab-"));
}

function stripStudent(user: StudentProfile) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    universityId: user.universityId,
    major: user.major,
    yearOfStudy: user.yearOfStudy,
    gender: user.gender,
    languages: user.languages,
    interests: user.interests,
    vibeTags: user.vibeTags,
    availability: user.availability,
    optedIn: user.optedIn,
    profileComplete: user.profileComplete,
    crossUniOk: user.crossUniOk,
    photoUrl: user.photoUrl,
    datingPreferences: user.datingPreferences,
  };
}

function candidateView(candidate: StudentProfile, ranked?: RankerCandidate, rejectReasons: string[] = []) {
  return {
    candidate: stripStudent(candidate),
    hardPassed: rejectReasons.length === 0,
    rejectReasons,
    finalScore: ranked?.finalScore,
    structuredScore: ranked?.structured.total,
    threshold: ranked?.structured.threshold,
    breakdown: ranked?.structured,
    llm: ranked?.llm,
  };
}

async function previewFor(db: Database, user: StudentProfile, useLlmJudge: boolean) {
  const pool = poolFor(user, labUsers(db)).filter((candidate) => candidate.id !== user.id);
  const ranked = await rankCandidatesFor(user, pool, db, { useLlmJudge, topK: 100 });
  const rankedById = new Map(ranked.map((item) => [item.candidate.id, item]));
  return pool.map((candidate) => {
    const basePair = isEligiblePair(user, candidate, buildContext(db));
    const constraints = hardConstraints(user, candidate);
    const rankedItem = rankedById.get(candidate.id);
    const rejectReasons = rankedItem ? [] : [
      ...(basePair.ok ? [] : [basePair.reason ?? "pair filtered"]),
      ...constraints.reasons,
      ...(basePair.ok && constraints.ok ? ["below matchMode threshold"] : []),
    ].filter(Boolean);
    return candidateView(candidate, rankedItem, Array.from(new Set(rejectReasons)));
  }).sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));
}

matchLabRouter.post("/seed", requireAdmin, async (req, res) => {
  const schema = z.object({
    count: z.number().int().min(2).max(200).default(50),
    scenario: z.enum(["balanced", "strict", "sparse", "extreme"]).default("balanced"),
    resetMatches: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload.", details: parsed.error.flatten() });
  const db = await ensureDb();
  db.students = db.students.filter((user) => !user.id.startsWith("lab-"));
  if (parsed.data.resetMatches) db.matches = db.matches.filter((match) => !match.userAId.startsWith("lab-") && !match.userBId.startsWith("lab-"));
  db.students.unshift(...Array.from({ length: parsed.data.count }, (_, index) => seedStudent(index, parsed.data.scenario)));
  await saveDb(db);
  res.json({ ok: true, count: parsed.data.count, scenario: parsed.data.scenario, users: labUsers(db).map(stripStudent) });
});

matchLabRouter.get("/users", requireAdmin, async (_req, res) => {
  const db = await ensureDb();
  res.json({ users: labUsers(db).map(stripStudent) });
});

matchLabRouter.patch("/users/:id", requireAdmin, async (req, res) => {
  const schema = z.object({
    universityId: z.string().optional(),
    major: z.string().optional(),
    yearOfStudy: z.string().optional(),
    gender: z.string().optional(),
    languages: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    vibeTags: z.array(z.string()).optional(),
    availability: z.array(z.string()).optional(),
    optedIn: z.boolean().optional(),
    profileComplete: z.boolean().optional(),
    crossUniOk: z.boolean().optional(),
    hasPhoto: z.boolean().optional(),
    datingPreferences: z.record(z.string(), z.unknown()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload.", details: parsed.error.flatten() });
  const db = await ensureDb();
  const user = db.students.find((student) => student.id === req.params.id && student.id.startsWith("lab-"));
  if (!user) return res.status(404).json({ error: "Lab user not found." });
  Object.assign(user, parsed.data);
  if (parsed.data.datingPreferences) user.datingPreferences = { ...(user.datingPreferences ?? {}), ...parsed.data.datingPreferences } as any;
  if (parsed.data.hasPhoto !== undefined) {
    user.photoUrl = parsed.data.hasPhoto ? user.photoUrl ?? "lab-photo" : undefined;
    user.datingPreferences = { ...(user.datingPreferences ?? {}), photoUrls: parsed.data.hasPhoto ? ["lab-photo"] : [] };
  }
  await saveDb(db);
  res.json({ ok: true, user: stripStudent(user) });
});

matchLabRouter.post("/preview", requireAdmin, async (req, res) => {
  const schema = z.object({ userId: z.string(), useLlmJudge: z.boolean().default(false) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload.", details: parsed.error.flatten() });
  const db = await ensureDb();
  const user = db.students.find((student) => student.id === parsed.data.userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: stripStudent(user), candidates: await previewFor(db, user, parsed.data.useLlmJudge) });
});

matchLabRouter.post("/simulate", requireAdmin, async (req, res) => {
  const schema = z.object({ useLlmJudge: z.boolean().default(false) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload.", details: parsed.error.flatten() });
  const db = await ensureDb();
  const users = labUsers(db);
  const allPreviews = await Promise.all(users.map(async (user) => [user.id, await previewFor(db, user, parsed.data.useLlmJudge)] as const));
  const rejectStats: Record<string, number> = {};
  const edges: Array<{ a: StudentProfile; b: StudentProfile; score: number; preview: ReturnType<typeof candidateView> }> = [];
  const seen = new Set<string>();
  for (const [userId, previews] of allPreviews) {
    for (const preview of previews) {
      const key = [userId, preview.candidate.id].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      if (preview.hardPassed && preview.finalScore !== undefined) {
        const a = users.find((user) => user.id === userId);
        const b = users.find((user) => user.id === preview.candidate.id);
        if (a && b) edges.push({ a, b, score: preview.finalScore, preview });
      } else {
        for (const reason of preview.rejectReasons) rejectStats[reason] = (rejectStats[reason] ?? 0) + 1;
      }
    }
  }
  edges.sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  const pairs = [];
  for (const edge of edges) {
    if (used.has(edge.a.id) || used.has(edge.b.id)) continue;
    used.add(edge.a.id);
    used.add(edge.b.id);
    pairs.push({ a: stripStudent(edge.a), b: stripStudent(edge.b), finalScore: edge.score, breakdown: edge.preview.breakdown });
  }
  res.json({
    users: users.length,
    pairs,
    skipped: users.filter((user) => !used.has(user.id)).map(stripStudent),
    rejectStats,
    scoreStats: {
      max: edges[0]?.score ?? 0,
      min: edges[edges.length - 1]?.score ?? 0,
      avg: edges.length ? Math.round(edges.reduce((sum, edge) => sum + edge.score, 0) / edges.length) : 0,
      candidateEdges: edges.length,
    },
  });
});
