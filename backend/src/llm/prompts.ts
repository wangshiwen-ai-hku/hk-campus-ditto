import type { StudentProfile, MatchRecord } from "../types.js";

export function personaSummaryPrompt(p: StudentProfile): { system: string; prompt: string } {
  const system =
    "You write concise, warm, second-person persona summaries for a campus matchmaking app. Be specific, avoid generic adjectives, and never invent facts.";
  const prompt = `Build a 60-90 word persona summary for this student. Output as plain text addressed to them ("you ...").

Profile:
- Name: ${p.fullName}
- Major: ${p.major}, ${p.yearOfStudy}
- Bio: ${p.bio}
- Interests: ${p.interests.join(", ")}
- Vibe tags: ${p.vibeTags.join(", ")}
- Languages: ${p.languages.join(", ")}
- Seeking: ${p.seeking}
- Life signals: ${JSON.stringify(p.lifeSignals ?? {})}
- Mind signals: ${JSON.stringify(p.mindSignals ?? {})}
- Social: ${JSON.stringify(p.socialSignals ?? {})}

Constraints:
- 60-90 words, single paragraph, no bullet points
- Reference 2-3 concrete signals (interest, vibe, signal value), not generic adjectives
- End with one short clause about what kind of date they would enjoy.`;
  return { system, prompt };
}

export function matchJudgePrompt(a: StudentProfile, b: StudentProfile): { system: string; prompt: string } {
  const system =
    "You are a sober matchmaking judge for a Hong Kong university campus app. You score compatibility between two students on a 0-100 scale, then return strict JSON. You never invent shared interests.";
  const personA = compactProfile(a);
  const personB = compactProfile(b);
  const prompt = `Evaluate compatibility for a casual first campus date.

Person A:
${personA}

Person B:
${personB}

Return strict JSON with this shape:
{
  "compatibility": <integer 0-100>,
  "sparks": [<2-4 short concrete reasons referencing real signals>],
  "risks": [<0-2 honest risks or mismatches>],
  "openerTopic": "<one sentence opener topic for their first chat>"
}

Rules:
- Only cite signals visible in the profiles above. No invention.
- "compatibility" reflects real-life chemistry potential, not just interest overlap.
- Penalize hard mismatches (e.g., dealbreakers, opposite energy).`;
  return { system, prompt };
}

function compactProfile(p: StudentProfile): string {
  return [
    `Major/Year: ${p.major} / ${p.yearOfStudy}`,
    `Bio: ${p.bio}`,
    `Interests: ${p.interests.join(", ")}`,
    `Vibe: ${p.vibeTags.join(", ")}`,
    `Languages: ${p.languages.join(", ")}`,
    `Seeking: ${p.seeking}`,
    `Dealbreakers: ${(p.dealBreakers ?? []).join(", ")}`,
    `Life: ${JSON.stringify(p.lifeSignals ?? {})}`,
    `Mind: ${JSON.stringify(p.mindSignals ?? {})}`,
  ].join("\n");
}

export function placePickerPrompt(
  a: StudentProfile,
  b: StudentProfile,
  candidates: string[]
): { system: string; prompt: string } {
  const system =
    "You pick a single first-date spot from a candidate list for two campus students. Return strict JSON.";
  const prompt = `Two students need a first-date spot. Pick ONE from the list.

Person A interests/vibe: ${a.interests.join(", ")} | ${a.vibeTags.join(", ")}
Person B interests/vibe: ${b.interests.join(", ")} | ${b.vibeTags.join(", ")}

Candidates:
${candidates.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Return strict JSON:
{ "name": "<one of the candidates verbatim>", "reason": "<<=140 chars why this fits both>>" }`;
  return { system, prompt };
}

export function feedbackSignalPrompt(
  notes: string,
  match: Pick<MatchRecord, "score">
): { system: string; prompt: string } {
  const system =
    "You extract structured signals from short post-date feedback. Be conservative; only output signals clearly implied by the text.";
  const prompt = `Post-date feedback notes (match score was ${match.score}):
"""
${notes}
"""

Return strict JSON:
{
  "wantSeeAgain": <true|false|null>,
  "positiveTags": [<short tags they liked, e.g., "thoughtful", "shared humour">],
  "negativeTags": [<short tags that did not work, e.g., "low energy", "different politics">],
  "vibeAdjustments": { "<tag>": <number between -1 and 1, weight delta to apply> }
}`;
  return { system, prompt };
}
