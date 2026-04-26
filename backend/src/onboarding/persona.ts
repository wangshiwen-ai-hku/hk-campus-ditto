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
  template: "onboarding_life" | "onboarding_mind" | "onboarding_social",
  answers: Record<string, unknown>
): void {
  if (template === "onboarding_life") {
    user.lifeSignals = {
      ...(user.lifeSignals ?? {}),
      coffeeOrTea: arrOrUndef(answers.coffeeOrTea),
      weekendVibe: strOrUndef(answers.weekendVibe),
      spendingTier: strOrUndef(answers.spendingTier) as any,
      petAffinity: strOrUndef(answers.petAffinity) as any,
      energyMode: strOrUndef(answers.energyMode) as any,
      firstDateLength: strOrUndef(answers.firstDateLength) as any,
    };
  } else if (template === "onboarding_mind") {
    user.mindSignals = {
      ...(user.mindSignals ?? {}),
      devTools: arrOrUndef(answers.devTools),
      consumptionStyle: strOrUndef(answers.consumptionStyle),
      recentMindChange: strOrUndef(answers.recentMindChange),
      mediaTaste: arrOrUndef(answers.mediaTaste),
    };
  } else if (template === "onboarding_social") {
    user.socialSignals = {
      ...(user.socialSignals ?? {}),
      githubUrl: strOrUndef(answers.githubUrl),
      socialNotes: strOrUndef(answers.socialNotes),
      socialAffinity: strOrUndef(answers.socialAffinity),
    };
  }
}

function strOrUndef(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function arrOrUndef(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : undefined;
}

export function recomputeProfileComplete(user: StudentProfile): boolean {
  const hasBasic = Boolean(
    user.fullName && user.major && user.yearOfStudy && user.bio &&
    user.languages.length && user.interests.length && user.vibeTags.length
  );
  const hasLife = Boolean(user.lifeSignals?.weekendVibe && user.lifeSignals.energyMode);
  return hasBasic && hasLife;
}
