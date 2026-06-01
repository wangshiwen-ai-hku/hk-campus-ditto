import type { StudentProfile, Survey, ProfileAnalysis } from "../types.js";
import { llmCall } from "../llm/client.js";
import { personaSummaryPrompt, profileAnalysisPrompt } from "../llm/prompts.js";

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

export async function buildProfileAnalysis(
  p: StudentProfile,
  surveys: Survey[],
  language = "en"
): Promise<ProfileAnalysis> {
  const relevantSurveys = surveys
    .filter((s) => s.userId === p.id && s.template.startsWith("onboarding_"))
    .slice(-12);
  const { system, prompt } = profileAnalysisPrompt(p, relevantSurveys, language);
  const out = await llmCall<Omit<ProfileAnalysis, "generatedAt" | "sourceTemplates">>({
    system,
    prompt,
    responseJson: true,
    tag: "profile-analysis",
    maxOutputTokens: 1300,
    temperature: 0.45,
  });

  const sourceTemplates = Array.from(new Set(relevantSurveys.map((s) => s.template)));
  if (out.json && !out.usedFallback) {
    return normalizeProfileAnalysis(out.json, sourceTemplates);
  }

  return fallbackProfileAnalysis(p, sourceTemplates, language);
}
export function applyOnboardingAnswers(
  user: StudentProfile,
  template: "onboarding_life" | "onboarding_mind" | "onboarding_social" | "onboarding_basics" | "onboarding_preferences" | "onboarding_attraction" | "onboarding_ldfr" | "onboarding_media",
  answers: Record<string, unknown>
): void {
  if (template === "onboarding_ldfr") {
    // LDFR results are currently stored in survey history; can be extracted to specific persona signals here if needed.
    return;
  }
  if (template === "onboarding_basics") {
    const mbti = mbtiOrUndef(answers.mbti);
    user.gender = strOrUndef(answers.gender) ?? user.gender;
    user.yearOfStudy = strOrUndef(answers.grade) ?? user.yearOfStudy;
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      birthday: strOrUndef(answers.birthday),
      heightCm: numOrUndef(answers.height),
      hkMtrLocations: arrOrUndef(answers.hkMtrLocation),
      mbti: {
        ...(user.datingPreferences?.mbti ?? {}),
        ...(mbti ?? {
          energy: strOrUndef(answers.mbtiE),
          information: strOrUndef(answers.mbtiS),
          decision: strOrUndef(answers.mbtiT),
          lifestyle: strOrUndef(answers.mbtiJ),
        }),
      },
    };
  } else if (template === "onboarding_preferences") {
    const datingGoals = arrOrUndef(answers.datingGoal);
    const languagePref = arrOrUndef(answers.languagePref);
    const hobbies = strOrUndef(answers.hobbies);
    if (hobbies) {
      user.interests = Array.from(new Set([
        ...user.interests,
        ...hobbies.split(/[,，、\n]/).map((x) => x.trim()).filter(Boolean),
      ])).slice(0, 12);
    }
    const weekendVibes = arrOrUndef(answers.hkWeekendVibe);
    if (weekendVibes?.length || strOrUndef(answers.hkWeekendVibe)) {
      user.lifeSignals = {
        ...(user.lifeSignals ?? {}),
        weekendVibe: weekendVibes?.[0] ?? strOrUndef(answers.hkWeekendVibe),
        weekendVibes,
      };
    }
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      dateGenders: arrOrUndef(answers.targetGender),
      datingGoal: datingGoals?.[0] as any,
      datingGoals,
      ageRange: ageRangeOrUndef(answers.ageRange),
      languagePreferences: languagePref,
      matchMode: strOrUndef(answers.matchMode) as any,
      attractionSignals: {
        ...(user.datingPreferences?.attractionSignals ?? {}),
        heightAndBuild: strOrUndef(answers.attractionHeightAndBuild),
        energyAndVibe: strOrUndef(answers.attractionEnergyAndVibe),
      },
    };
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
      weekendVibe: arrOrUndef(answers.hkWeekendVibe)?.[0] ?? strOrUndef(answers.hkWeekendVibe),
      weekendVibes: arrOrUndef(answers.hkWeekendVibe),
    };
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      attractionSignals: {
        ...(user.datingPreferences?.attractionSignals ?? {}),
        heightAndBuild: strOrUndef(answers.attractionHeightAndBuild),
        energyAndVibe: strOrUndef(answers.attractionEnergyAndVibe),
      },
    };
  } else if (template === "onboarding_media") {
    const mediaCards = mediaCardsOrUndef(answers.mediaCards);
    const photoUrls = mediaCards?.map((card) => card.photoUrl).filter((x): x is string => Boolean(x)) ?? arrOrUndef(answers.photoUrls);
    user.datingPreferences = {
      ...(user.datingPreferences ?? {}),
      photoUrls,
      mediaCards,
    };
    user.photoUrl = photoUrls?.[0] ?? user.photoUrl;
    const mediaNotes = mediaCards?.map((card) => card.caption).filter(Boolean).join("\n") || strOrUndef(answers.mediaNotes);
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
    };
  }
}

function normalizeProfileAnalysis(
  input: Partial<ProfileAnalysis>,
  sourceTemplates: string[]
): ProfileAnalysis {
  return {
    generatedAt: new Date().toISOString(),
    summary: str(input.summary, "A concise profile summary will become more specific as more answers are collected."),
    romanticStyle: str(input.romanticStyle, "Still emerging"),
    emotionalTone: str(input.emotionalTone, "Still emerging"),
    datingIntent: str(input.datingIntent, "Still emerging"),
    strengths: strArray(input.strengths).slice(0, 4),
    growthEdges: strArray(input.growthEdges).slice(0, 3),
    idealMatch: str(input.idealMatch, "Someone whose pace and expectations fit their stated preferences."),
    matchSignals: strArray(input.matchSignals).slice(0, 8),
    conversationHooks: strArray(input.conversationHooks).slice(0, 5),
    firstDateSuggestions: strArray(input.firstDateSuggestions).slice(0, 4),
    profileCompletenessNotes: strArray(input.profileCompletenessNotes).slice(0, 3),
    sourceTemplates,
  };
}

/** Strip i18n key prefixes so raw keys don't leak into UI text */
function stripKey(val?: string): string | undefined {
  if (!val) return undefined;
  if (val.includes(".")) {
    const last = val.split(".").pop() ?? val;
    return last.replace(/_/g, " ");
  }
  return val;
}

function fallbackProfileAnalysis(p: StudentProfile, sourceTemplates: string[], language = "en"): ProfileAnalysis {
  const matchSignals = Array.from(new Set([
    ...p.vibeTags.map((v) => stripKey(v) ?? v),
    ...p.interests.slice(0, 4),
    stripKey(p.lifeSignals?.energyMode),
    stripKey(p.datingPreferences?.datingGoal),
    stripKey(p.datingPreferences?.matchMode),
  ].filter((x): x is string => typeof x === "string" && x.length > 0))).slice(0, 8);

  const isZh = language.startsWith("zh");
  const isHk = language === "zh-HK" || language === "yue";
  const interests = p.interests.slice(0, 3).join(", ");

  return {
    generatedAt: new Date().toISOString(),
    summary: isHk
      ? [
          `${p.fullName || "呢位同學"}正在就讀${p.major || ""}主修，興趣包括${interests || "日常生活嘅共同愛好"}。`,
          p.bio ? `自我介紹：${p.bio}` : "",
        ].filter(Boolean).join(" ")
      : isZh
      ? [
          `${p.fullName || "这位同学"}正在就读${p.major || ""}专业，兴趣包括${interests || "日常生活中的共同爱好"}。`,
          p.bio ? `个人简介：${p.bio}` : "",
        ].filter(Boolean).join(" ")
      : [
          `${p.fullName || "This student"} is studying ${p.major || "their field"} and seems to connect through ${interests || "shared everyday interests"}.`,
          p.bio ? `Their bio says: ${p.bio}` : "",
        ].filter(Boolean).join(" "),
    romanticStyle: stripKey(p.datingPreferences?.matchMode) ?? stripKey(p.lifeSignals?.energyMode) ?? (isZh ? "尚待探索" : "Still emerging"),
    emotionalTone: p.vibeTags.slice(0, 3).map((v) => stripKey(v) ?? v).join(", ") || (isZh ? "尚待探索" : "Still emerging"),
    datingIntent: stripKey(p.datingPreferences?.datingGoal) ?? stripKey(p.seeking) ?? (isZh ? "尚待探索" : "Still emerging"),
    strengths: p.vibeTags.length ? p.vibeTags.slice(0, 3).map((v) => stripKey(v) ?? v) : [isHk ? "填寫更多問卷後將更清晰" : isZh ? "填写更多问卷后将更清晰" : "Clearer once more form answers are available"],
    growthEdges: [isHk ? "填寫更多具體回答後配對將更加精準" : isZh ? "填写更多具体回答后匹配将更加精准" : "May need a few more specific answers before matching can be highly personalized"],
    idealMatch: stripKey(p.seeking) || (isHk ? "與佢嘅偏好同節奏一致嘅人" : isZh ? "与TA的偏好和节奏一致的人" : "Someone aligned with their stated preferences and pace"),
    matchSignals,
    conversationHooks: p.interests.slice(0, 5),
    firstDateSuggestions: isHk ? ["校園附近輕鬆飲杯咖啡", "一齊散步傾偈"] : isZh ? ["校园附近轻松咖啡", "一起散步聊天"] : ["Low-pressure coffee near campus", "A short walk with enough time for real conversation"],
    profileCompletenessNotes: sourceTemplates.length ? [] : [isHk ? "暫無問卷答案" : isZh ? "暂无问卷答案" : "No onboarding survey answers have been saved yet"],
    sourceTemplates,
  };
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
}
function strOrUndef(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function mbtiOrUndef(v: unknown): { energy: string; information: string; decision: string; lifestyle: string } | undefined {
  if (typeof v !== "string") return undefined;
  const value = v.trim().toUpperCase();
  if (!/^[EI][SN][TF][JP]$/.test(value)) return undefined;
  return {
    energy: value[0],
    information: value[1],
    decision: value[2],
    lifestyle: value[3],
  };
}
function arrOrUndef(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : undefined;
}

function mediaCardsOrUndef(v: unknown): Array<{ photoUrl?: string; caption?: string }> | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      photoUrl: strOrUndef(x.photoUrl),
      caption: strOrUndef(x.caption),
    }))
    .filter((x) => x.photoUrl || x.caption)
    .slice(0, 5);
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
    user.fullName && user.major && user.yearOfStudy &&
    user.languages.length && user.interests.length && user.vibeTags.length
  );
  const hasOnboardingSignal = Boolean(
    (user.lifeSignals?.weekendVibe && (user.lifeSignals.energyMode || user.datingPreferences?.datingGoal)) ||
    ((user.datingPreferences?.datingGoal || user.datingPreferences?.datingGoals?.length) && user.datingPreferences.matchMode)
  );
  return hasBasic && hasOnboardingSignal;
}
