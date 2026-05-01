import type { StudentProfile } from "../types.js";
import { acceptsGender, extractSignals, matchModeThreshold, overlap, type GoalSignal, type MatchSignals } from "./signals.js";

export interface HardConstraintResult {
  ok: boolean;
  reasons: string[];
}

export interface MatchScoreBreakdown {
  total: number;
  threshold: number;
  passedThreshold: boolean;
  intent: number;
  targetPreference: number;
  lifestyle: number;
  interests: number;
  language: number;
  logistics: number;
  academic: number;
  attraction: number;
  campus: number;
  media: number;
  feedbackLearning: number;
  overlaps: {
    interests: string[];
    vibes: string[];
    languages: string[];
    availability: string[];
    locations: string[];
    mbti: string[];
  };
  notes: string[];
}

const HARD_GOAL_CONFLICTS: Array<[GoalSignal, GoalSignal]> = [
  ["life_partner", "casual"],
];

function hasGoal(goals: GoalSignal[], goal: GoalSignal): boolean {
  return goals.includes(goal);
}

function goalConflict(a: GoalSignal[], b: GoalSignal[]): boolean {
  if (a.includes("unsure") || b.includes("unsure")) return false;
  return HARD_GOAL_CONFLICTS.some(([x, y]) => (hasGoal(a, x) && hasGoal(b, y)) || (hasGoal(a, y) && hasGoal(b, x)));
}

function ageInRange(age: number | undefined, range: { min: number; max: number } | undefined): boolean {
  if (!age || !range) return true;
  return age >= range.min && age <= range.max;
}

export function hardConstraints(a: StudentProfile, b: StudentProfile): HardConstraintResult {
  const sa = extractSignals(a);
  const sb = extractSignals(b);
  const reasons: string[] = [];

  if (!acceptsGender(sa.targetGenders, sb.gender)) reasons.push("a target gender excludes b");
  if (!acceptsGender(sb.targetGenders, sa.gender)) reasons.push("b target gender excludes a");
  if (!ageInRange(sb.age, sa.ageRange)) reasons.push("b outside a age range");
  if (!ageInRange(sa.age, sb.ageRange)) reasons.push("a outside b age range");
  if (goalConflict(sa.goals, sb.goals)) reasons.push("dating goal conflict");
  if (a.universityId !== b.universityId && (!a.crossUniOk || !b.crossUniOk)) reasons.push("cross-campus not accepted by both users");
  const mediaRequiredByNewFlow = Boolean(a.datingPreferences?.photoUrls || b.datingPreferences?.photoUrls);
  if (mediaRequiredByNewFlow && (!sa.hasPhoto || !sb.hasPhoto)) reasons.push("missing required media profile");

  return { ok: reasons.length === 0, reasons };
}

function scoreGoal(a: GoalSignal[], b: GoalSignal[]): number {
  if (overlap(a, b).length) return 18;
  if (a.includes("unsure") || b.includes("unsure")) return 12;
  if ((a.includes("life_partner") && b.includes("long_term")) || (b.includes("life_partner") && a.includes("long_term"))) return 16;
  if ((a.includes("casual") && b.includes("friends")) || (b.includes("casual") && a.includes("friends"))) return 12;
  return 6;
}

function scoreEthnicity(sa: MatchSignals, sb: MatchSignals): number {
  const aNoPref = !sa.ethnicityPreferences.length || sa.ethnicityPreferences.includes("no_pref");
  const bNoPref = !sb.ethnicityPreferences.length || sb.ethnicityPreferences.includes("no_pref");
  let score = 3;
  if (!aNoPref && sb.ethnicity && sa.ethnicityPreferences.includes(sb.ethnicity)) score += 2;
  if (!bNoPref && sa.ethnicity && sb.ethnicityPreferences.includes(sa.ethnicity)) score += 2;
  if (!aNoPref && sb.ethnicity && !sa.ethnicityPreferences.includes(sb.ethnicity)) score -= 1;
  if (!bNoPref && sa.ethnicity && !sb.ethnicityPreferences.includes(sa.ethnicity)) score -= 1;
  return Math.max(0, Math.min(6, score));
}

function scoreAcademic(sa: MatchSignals, sb: MatchSignals): number {
  let score = 0;
  if (sa.major && sb.major && sa.major === sb.major) score += 8;
  else if (sa.major && sb.major) score += 4;
  if (sa.year && sb.year && sa.year === sb.year) score += 6;
  else if (sa.year && sb.year) score += 3;
  return Math.min(score, 10);
}

function scoreAttractionText(a: string, b: string): number {
  if (!a && !b) return 3;
  const tokensA = new Set(a.split(/\W+/).filter((x) => x.length > 2));
  const tokensB = b.split(/\W+/).filter((x) => x.length > 2);
  const shared = tokensB.filter((x) => tokensA.has(x)).length;
  return Math.min(3 + shared * 1.5, 6);
}

export function structuredScore(a: StudentProfile, b: StudentProfile): MatchScoreBreakdown {
  const sa = extractSignals(a);
  const sb = extractSignals(b);
  const interestOverlap = overlap(sa.interests, sb.interests);
  const vibeOverlap = overlap(sa.vibeTags, sb.vibeTags);
  const languageOverlap = overlap(sa.languages, sb.languages);
  const availabilityOverlap = overlap(sa.availability, sb.availability);
  const locationOverlap = overlap(sa.locations, sb.locations);
  const mbtiOverlap = overlap(sa.mbti, sb.mbti);

  const intent = scoreGoal(sa.goals, sb.goals);
  const targetPreference = 10 + scoreEthnicity(sa, sb);
  const lifestyle = Math.min(vibeOverlap.length * 4 + overlap(sa.weekendVibes, sb.weekendVibes).length * 4 + mbtiOverlap.length * 1.5, 12);
  const interests = Math.min(interestOverlap.length * 4, 12);
  const language = sa.languages.includes("no_pref") || sb.languages.includes("no_pref") || languageOverlap.includes("mixed")
    ? 8
    : Math.min(languageOverlap.length * 5, 10);
  const logistics = Math.min(availabilityOverlap.length * 3 + locationOverlap.length * 4, 10);
  const academic = scoreAcademic(sa, sb);
  const attraction = scoreAttractionText(sa.attractionText, sb.attractionText);
  const campus = sa.universityId === sb.universityId ? 3 : 1;
  const media = sa.hasPhoto && sb.hasPhoto ? 3 : 0;

  const aWeights = a.vibeWeights ?? {};
  const bWeights = b.vibeWeights ?? {};
  const feedbackLearning = Math.max(-4, Math.min(4, vibeOverlap.reduce(
    (acc, tag) => acc + (aWeights[tag] ?? 0) * 2 + (bWeights[tag] ?? 0) * 2,
    0
  )));

  const rawTotal = intent + targetPreference + lifestyle + interests + language + logistics + academic + attraction + campus + media + feedbackLearning;
  const total = Math.max(0, Math.min(100, Math.round(rawTotal)));
  const threshold = Math.max(matchModeThreshold(sa.matchMode), matchModeThreshold(sb.matchMode));
  const notes: string[] = [];
  if (academic >= 10) notes.push("Strong academic context fit");
  if (language >= 8) notes.push("Comfortable language overlap");
  if (logistics >= 7) notes.push("Easy timing/location logistics");
  if (intent >= 16) notes.push("Dating intent is aligned");

  return {
    total,
    threshold,
    passedThreshold: total >= threshold,
    intent,
    targetPreference,
    lifestyle,
    interests,
    language,
    logistics,
    academic,
    attraction,
    campus,
    media,
    feedbackLearning,
    overlaps: {
      interests: interestOverlap,
      vibes: vibeOverlap,
      languages: languageOverlap,
      availability: availabilityOverlap,
      locations: locationOverlap,
      mbti: mbtiOverlap,
    },
    notes,
  };
}
