import type { StudentProfile, MatchRecord, Survey } from "../types.js";

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

export function profileAnalysisPrompt(
  p: StudentProfile,
  surveys: Survey[],
  language = "en"
): { system: string; prompt: string } {
  const langInstruction = language.startsWith("zh") ? "You MUST write ALL content in Chinese (简体中文)." : "Write all content in English.";
  const system =
    `You build structured user profile analysis for a Hong Kong campus matchmaking app. Be warm but concrete, do not over-flatter, and never invent facts beyond the supplied profile and survey answers. ${langInstruction} Return strict JSON only.`;
  const surveyPayload = surveys.map((s) => ({
    template: s.template,
    answers: s.answers,
    at: s.at,
  }));
  const prompt = `Create a complete matchmaking profile analysis in ${language}.

Student profile:
${compactProfile(p)}

Stored onboarding answer snapshot:
${JSON.stringify(p.onboardingAnswers ?? {}, null, 2)}

Survey history:
${JSON.stringify(surveyPayload, null, 2)}

Return strict JSON with this shape:
{
  "summary": "<80-120 words, second person, specific to their answers>",
  "romanticStyle": "<one clear phrase/sentence>",
  "emotionalTone": "<how they tend to connect emotionally>",
  "datingIntent": "<what they appear to want, with uncertainty if unclear>",
  "strengths": ["<2-4 concrete strengths>"],
  "growthEdges": ["<1-3 gentle blind spots or risks>"],
  "idealMatch": "<what kind of person may fit them>",
  "matchSignals": ["<4-8 short tags useful for matching/ranking>"],
  "conversationHooks": ["<3-5 first-chat topics based only on real answers>"],
  "firstDateSuggestions": ["<2-4 specific HK/campus-friendly date styles>"],
  "profileCompletenessNotes": ["<0-3 missing or weak areas to ask later>"]
}

Rules:
- Use only supplied answers and profile fields.
- Prefer concrete answer references over generic personality labels.
- Keep emotional support tasteful: validating, not therapeutic.
- If evidence is thin, say so in profileCompletenessNotes instead of guessing.`;
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
    `Dating preferences: ${JSON.stringify(p.datingPreferences ?? {})}`,
    `Academic: ${p.major} / ${p.yearOfStudy}`,
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

export function icebreakerPrompt(
  a: StudentProfile,
  b: StudentProfile,
  match: MatchRecord,
  language = "en"
): { system: string; prompt: string } {
  const langInstruction = language.startsWith("zh")
    ? "You MUST write ALL content in Chinese (简体中文). Use a warm, slightly playful tone."
    : "Write all content in English. Use a warm, slightly playful tone.";
  const system = `You are an AI matchmaker for a Hong Kong campus dating app. Your job is to introduce two matched students to each other, highlight their strengths, and help them break the ice before their first meeting. ${langInstruction}`;
  const prompt = `Create an icebreaker introduction for these two matched students who are about to meet.

Person A (${a.fullName}):
${compactProfile(a)}

Person B (${b.fullName}):
${compactProfile(b)}

Match details:
- Compatibility score: ${match.score}%
- Date time: ${match.confirmedSlot ?? "TBD"}
- Date spot: ${match.curatedDateSpot ?? match.proposedPlace?.name ?? "TBD"}
- Reasons matched: ${[...match.reasonsForA, ...match.reasonsForB].join("; ")}

Return strict JSON:
{
  "introForA": "<60-80 words introducing B to A — highlight B's charm points, shared interests, what A might enjoy about B>",
  "introForB": "<60-80 words introducing A to B — highlight A's charm points, shared interests, what B might enjoy about A>",
  "conversationStarters": ["<3-4 specific, fun conversation topics based on their real shared interests or complementary traits>"],
  "dateVibe": "<one sentence describing the expected vibe of this date>"
}

Rules:
- Only reference real profile data, never invent interests or traits.
- Be encouraging but honest. Don't over-promise chemistry.
- Conversation starters should be specific (not generic like "talk about hobbies").`;
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
