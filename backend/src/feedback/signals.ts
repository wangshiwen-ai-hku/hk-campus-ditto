import type { MatchRecord, StudentProfile } from "../types.js";
import { llmCall } from "../llm/client.js";
import { feedbackSignalPrompt } from "../llm/prompts.js";

export interface ExtractedSignals {
  wantSeeAgain: boolean | null;
  positiveTags: string[];
  negativeTags: string[];
  vibeAdjustments: Record<string, number>;
}

export async function extractFeedbackSignals(
  notes: string,
  match: MatchRecord
): Promise<ExtractedSignals> {
  if (!notes.trim()) {
    return { wantSeeAgain: null, positiveTags: [], negativeTags: [], vibeAdjustments: {} };
  }
  const { system, prompt } = feedbackSignalPrompt(notes, match);
  const out = await llmCall<ExtractedSignals>({
    system,
    prompt,
    responseJson: true,
    tag: "feedback-signals",
    maxOutputTokens: 300,
    temperature: 0.2,
  });
  if (out.usedFallback || !out.json) {
    return { wantSeeAgain: null, positiveTags: [], negativeTags: [], vibeAdjustments: {} };
  }
  const j = out.json;
  return {
    wantSeeAgain: typeof j.wantSeeAgain === "boolean" ? j.wantSeeAgain : null,
    positiveTags: Array.isArray(j.positiveTags) ? j.positiveTags.slice(0, 6).map(String) : [],
    negativeTags: Array.isArray(j.negativeTags) ? j.negativeTags.slice(0, 6).map(String) : [],
    vibeAdjustments:
      j.vibeAdjustments && typeof j.vibeAdjustments === "object"
        ? Object.fromEntries(
            Object.entries(j.vibeAdjustments)
              .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
              .map(([k, v]) => [k, clamp(Number(v), -1, 1)])
          )
        : {},
  };
}

export function applyVibeWeightDelta(user: StudentProfile, delta: Record<string, number>): void {
  user.vibeWeights = user.vibeWeights ?? {};
  for (const [tag, d] of Object.entries(delta)) {
    const current = user.vibeWeights[tag] ?? 0;
    user.vibeWeights[tag] = clamp(current + d * 0.5, -2, 2); // dampen by 0.5
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
