import type { StudentProfile } from "../types.js";
import { llmCall } from "../llm/client.js";
import { personaSummaryPrompt } from "../llm/prompts.js";

export async function buildPersonaSummary(p: StudentProfile): Promise<string> {
  const { system, prompt } = personaSummaryPrompt(p);
  const out = await llmCall<string>({ system, prompt, tag: "persona", maxOutputTokens: 220, temperature: 0.6 });
  if (out.text && !out.usedFallback) return out.text.trim();

  // Deterministic fallback: stitch a short summary from concrete signals so MVP keeps working without LLM.
  const parts: string[] = [];
  parts.push(`You're a ${p.yearOfStudy || "campus"} ${p.major || "student"} at ${p.universityId.toUpperCase()}.`);
  if (p.interests.length) parts.push(`You light up around ${p.interests.slice(0, 3).join(", ")}.`);
  if (p.vibeTags.length) parts.push(`Friends would call you ${p.vibeTags.slice(0, 3).join(", ")}.`);
  if (p.lifeSignals?.weekendVibe) parts.push(`Saturday at 11am you'd probably be ${p.lifeSignals.weekendVibe}.`);
  parts.push(`A great first date for you: a low-pressure coffee and a real conversation.`);
  return parts.join(" ");
}

export function applyOnboardingAnswers(
  user: StudentProfile,
  template: "onboarding_life" | "onboarding_mind" | "onboarding_social" | "onboarding_basics" | "onboarding_preferences" | "onboarding_attraction" | "onboarding_media",
  answers: Record<string, unknown>
): void {
  if (template === "onboarding_basics") {
    user.gender = strOrUndef(answers.gender) ?? user.gender;
    user.yearOfStudy = strOrUndef(answers.grade) ?? user.yearOfStudy;
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      birthday: strOrUndef(answers.birthday),
      ethnicity: strOrUndef(answers.ethnicity),
      heightCm: numOrUndef(answers.height),
    };
  } else if (template === "onboarding_preferences") {
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      dateGenders: arrOrUndef(answers.targetGender),
      datingGoal: strOrUndef(answers.datingGoal) as any,
      ageRange: ageRangeOrUndef(answers.ageRange),
      ethnicityPreferences: arrOrUndef(answers.targetEthnicity),
      matchMode: strOrUndef(answers.matchMode) as any,
    };
    const languagePref = arrOrUndef(answers.languagePref);
    if (languagePref?.length) user.languages = languagePref;
  } else if (template === "onboarding_attraction") {
    const hobbies = strOrUndef(answers.hobbies);
    if (hobbies) {
      user.interests = Array.from(new Set([
        ...user.interests,
        ...hobbies.split(/[,，、\n]/).map((x) => x.trim()).filter(Boolean),
      ])).slice(0, 12);
    }
    user.lifeSignals = {
      ...(user.lifeSignals ?? {}),
      weekendVibe: strOrUndef(answers.hkWeekendVibe),
    };
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      attractionSignals: {
        ...(user.datingPreferences?.attractionSignals ?? {}),
        heightAndBuild: strOrUndef(answers.attractionHeightAndBuild),
        facialFeatures: strOrUndef(answers.attractionFacialFeatures),
        energyAndVibe: strOrUndef(answers.attractionEnergyAndVibe),
      },
    };
  } else if (template === "onboarding_media") {
    const photoUrls = arrOrUndef(answers.photoUrls);
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      photoUrls,
    };
    user.photoUrl = photoUrls?.[0] ?? user.photoUrl;
    const mediaNotes = strOrUndef(answers.mediaNotes);
    if (mediaNotes) {
      user.socialSignals = {
        ...(user.socialSignals ?? {}),
        socialNotes: [user.socialSignals?.socialNotes, mediaNotes].filter(Boolean).join("\n"),
      };
    }
  } else if (template === "onboarding_life") {
    user.lifeSignals = {
      ...(user.lifeSignals ?? {}),
      coffeeOrTea: arrOrUndef(answers.coffeeOrTea),
      weekendVibe: strOrUndef(answers.weekendVibe),
      spendingTier: strOrUndef(answers.spendingTier) as any,
      petAffinity: strOrUndef(answers.petAffinity) as any,
      energyMode: strOrUndef(answers.energyMode) as any,
      firstDateLength: strOrUndef(answers.firstDateLength) as any,
    };
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      datingGoal: strOrUndef(answers.datingGoal) as any,
      matchMode: strOrUndef(answers.matchMode) as any,
    };
  } else if (template === "onboarding_mind") {
    user.mindSignals = {
      ...(user.mindSignals ?? {}),
      devTools: arrOrUndef(answers.devTools),
      consumptionStyle: strOrUndef(answers.consumptionStyle),
      recentMindChange: strOrUndef(answers.recentMindChange),
      mediaTaste: arrOrUndef(answers.mediaTaste),
    };
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      attractionSignals: {
        ...(user.datingPreferences?.attractionSignals ?? {}),
        heightAndBuild: strOrUndef(answers.attractionHeightAndBuild),
        facialFeatures: strOrUndef(answers.attractionFacialFeatures),
        energyAndVibe: strOrUndef(answers.attractionEnergyAndVibe),
      },
    };
  } else if (template === "onboarding_social") {
    user.socialSignals = {
      ...(user.socialSignals ?? {}),
      githubUrl: strOrUndef(answers.githubUrl),
      socialNotes: strOrUndef(answers.socialNotes),
      socialAffinity: strOrUndef(answers.socialAffinity),
    };
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      dateGenders: arrOrUndef(answers.dateGenders),
      ageRange: ageRangeOrUndef(answers.ageRange),
      ethnicityPreferences: arrOrUndef(answers.ethnicityPreferences),
    };
  }
}

function strOrUndef(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function arrOrUndef(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : undefined;
}

function numOrUndef(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function ageRangeOrUndef(v: unknown): { min: number; max: number } | undefined {
  if (typeof v === "object" && v !== null && "min" in v && "max" in v) {
    const min = Number((v as { min: unknown }).min);
    const max = Number((v as { max: unknown }).max);
    if (Number.isFinite(min) && Number.isFinite(max)) return { min, max };
  }
  if (typeof v !== "string") return undefined;
  const match = v.match(/(\d{2})\D+(\d{2})/);
  if (!match) return undefined;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  return { min, max };
}

export function recomputeProfileComplete(user: StudentProfile): boolean {
  const hasBasic = Boolean(
    user.fullName && user.major && user.yearOfStudy && user.bio &&
    user.languages.length && user.interests.length && user.vibeTags.length
  );
  const hasOnboardingSignal = Boolean(
    (user.lifeSignals?.weekendVibe && (user.lifeSignals.energyMode || user.datingPreferences?.datingGoal)) ||
    (user.datingPreferences?.datingGoal && user.datingPreferences.matchMode)
  );
  return hasBasic && hasOnboardingSignal;
}
