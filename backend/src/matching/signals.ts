import type { StudentProfile } from "../types.js";

export type GenderSignal = "male" | "female" | "non_binary" | "everyone" | "unknown";
export type GoalSignal = "life_partner" | "long_term" | "casual" | "friends" | "unsure";
export type MatchMode = "fast" | "balanced" | "intentional" | "wait_for_the_one";

const GENDER_MAP: Record<string, GenderSignal> = {
  male: "male",
  female: "female",
  non_binary: "non_binary",
  everyone: "everyone",
  "onboarding.opt.male": "male",
  "onboarding.opt.female": "female",
  "onboarding.opt.non_binary": "non_binary",
  "onboarding.opt.everyone": "everyone",
};

const GOAL_MAP: Record<string, GoalSignal> = {
  life_partner: "life_partner",
  long_term: "long_term",
  casual: "casual",
  friends: "friends",
  unsure: "unsure",
  "onboarding.opt.life_partner": "life_partner",
  "onboarding.opt.long_term": "long_term",
  "onboarding.opt.casual": "casual",
  "onboarding.opt.friends": "friends",
  "onboarding.opt.unsure": "unsure",
};

const MODE_MAP: Record<string, MatchMode> = {
  fast: "fast",
  balanced: "balanced",
  intentional: "intentional",
  wait_for_the_one: "wait_for_the_one",
  "onboarding.opt.mode_fast": "fast",
  "onboarding.opt.mode_balanced": "balanced",
  "onboarding.opt.mode_intentional": "intentional",
  "onboarding.opt.mode_wait": "wait_for_the_one",
};

const LANGUAGE_MAP: Record<string, string> = {
  english: "english",
  cantonese: "cantonese",
  mandarin: "mandarin",
  japanese: "japanese",
  korean: "korean",
  "onboarding.opt.lang_eng": "english",
  "onboarding.opt.lang_canto": "cantonese",
  "onboarding.opt.lang_mando": "mandarin",
  "onboarding.opt.lang_mixed": "mixed",
  "onboarding.opt.no_pref": "no_pref",
};

const MTR_MAP: Record<string, string> = {
  "onboarding.opt.mtr_island": "island",
  "onboarding.opt.mtr_east": "east_rail",
  "onboarding.opt.mtr_tsuen_wan_kwun_tong": "tw_kt",
  "onboarding.opt.mtr_tuen_ma": "tuen_ma",
  "onboarding.opt.mtr_other": "other",
};

export interface MatchSignals {
  id: string;
  gender: GenderSignal;
  targetGenders: GenderSignal[];
  age?: number;
  ageRange?: { min: number; max: number };
  goals: GoalSignal[];
  matchMode: MatchMode;
  languages: string[];
  locations: string[];
  ethnicity?: string;
  ethnicityPreferences: string[];
  mbti: string[];
  weekendVibes: string[];
  interests: string[];
  vibeTags: string[];
  availability: string[];
  major: string;
  year: string;
  universityId: string;
  hasPhoto: boolean;
  attractionText: string;
  academicText: string;
}

export function canonicalKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parts = value.split(".");
  return parts[parts.length - 1]?.toLowerCase();
}

export function normalizeGender(value: string | undefined): GenderSignal {
  if (!value) return "unknown";
  return GENDER_MAP[value] ?? GENDER_MAP[canonicalKey(value) ?? ""] ?? "unknown";
}

export function normalizeGoals(values: unknown): GoalSignal[] {
  const raw = Array.isArray(values) ? values : typeof values === "string" ? [values] : [];
  const goals = raw.map((value) => GOAL_MAP[String(value)]).filter(Boolean);
  return goals.length ? Array.from(new Set(goals)) : ["unsure"];
}

export function normalizeMode(value: string | undefined): MatchMode {
  if (!value) return "balanced";
  return MODE_MAP[value] ?? "balanced";
}

function normalizeList(values: string[] | undefined, map?: Record<string, string>): string[] {
  return Array.from(new Set((values ?? [])
    .map((value) => map?.[value] ?? canonicalKey(value) ?? value.toLowerCase())
    .filter(Boolean)));
}

function ageFromBirthday(birthday?: string): number | undefined {
  if (!birthday) return undefined;
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 16 && age <= 80 ? age : undefined;
}

export function extractSignals(student: StudentProfile): MatchSignals {
  const prefs = student.datingPreferences ?? {};
  const mbti = prefs.mbti ? [prefs.mbti.energy, prefs.mbti.information, prefs.mbti.decision, prefs.mbti.lifestyle].filter(Boolean) as string[] : [];
  return {
    id: student.id,
    gender: normalizeGender(student.gender),
    targetGenders: normalizeList(prefs.dateGenders, GENDER_MAP).map((g) => g as GenderSignal),
    age: ageFromBirthday(prefs.birthday),
    ageRange: prefs.ageRange,
    goals: normalizeGoals(prefs.datingGoals ?? prefs.datingGoal),
    matchMode: normalizeMode(prefs.matchMode),
    languages: normalizeList(prefs.languagePreferences?.length ? prefs.languagePreferences : student.languages, LANGUAGE_MAP),
    locations: normalizeList(prefs.hkMtrLocations, MTR_MAP),
    ethnicity: canonicalKey(prefs.ethnicity),
    ethnicityPreferences: normalizeList(prefs.ethnicityPreferences),
    mbti,
    weekendVibes: normalizeList(student.lifeSignals?.weekendVibes ?? (student.lifeSignals?.weekendVibe ? [student.lifeSignals.weekendVibe] : [])),
    interests: normalizeList(student.interests),
    vibeTags: normalizeList(student.vibeTags),
    availability: student.availability ?? [],
    major: student.major.trim().toLowerCase(),
    year: student.yearOfStudy.trim().toLowerCase(),
    universityId: student.universityId,
    hasPhoto: Boolean(student.photoUrl || prefs.photoUrls?.length),
    attractionText: [
      prefs.attractionSignals?.heightAndBuild,
      prefs.attractionSignals?.facialFeatures,
      prefs.attractionSignals?.energyAndVibe,
      student.socialSignals?.socialNotes,
    ].filter(Boolean).join("\n").toLowerCase(),
    academicText: `${student.major} ${student.yearOfStudy}`.trim().toLowerCase(),
  };
}

export function overlap(a: string[], b: string[]): string[] {
  const set = new Set(a.map((x) => x.toLowerCase()));
  return b.filter((x) => set.has(x.toLowerCase()));
}

export function acceptsGender(targets: GenderSignal[], gender: GenderSignal): boolean {
  if (!targets.length || targets.includes("everyone")) return true;
  if (gender === "unknown") return true;
  return targets.includes(gender);
}

export function matchModeThreshold(mode: MatchMode): number {
  if (mode === "fast") return 50;
  if (mode === "intentional") return 70;
  if (mode === "wait_for_the_one") return 80;
  return 60;
}
