import type { Database, MatchRecord, ProposedPlace, StudentProfile, University } from "../types.js";
import { llmCall } from "../llm/client.js";
import { placePickerPrompt } from "../llm/prompts.js";

export function buildPlaceCandidates(
  db: Database,
  a: StudentProfile,
  b: StudentProfile
): { candidates: string[]; university?: University } {
  // same university: that university's safeSpots
  if (a.universityId === b.universityId) {
    const uni = db.universities.find((u) => u.id === a.universityId);
    return { candidates: uni?.safeSpots.slice() ?? [], university: uni };
  }
  // cross-uni: pool both, plus a few neutral options
  const aUni = db.universities.find((u) => u.id === a.universityId);
  const bUni = db.universities.find((u) => u.id === b.universityId);
  const set = new Set<string>([
    ...(aUni?.safeSpots ?? []),
    ...(bUni?.safeSpots ?? []),
    "Tsim Sha Tsui Promenade",
    "Central – % Arabica",
    "Tai Kwun courtyard",
  ]);
  return { candidates: [...set] };
}

export async function pickPlace(
  db: Database,
  match: MatchRecord
): Promise<ProposedPlace | undefined> {
  const a = db.students.find((s) => s.id === match.userAId);
  const b = db.students.find((s) => s.id === match.userBId);
  if (!a || !b) return undefined;

  const { candidates } = buildPlaceCandidates(db, a, b);
  if (!candidates.length) return undefined;

  const { system, prompt } = placePickerPrompt(a, b, candidates);
  const out = await llmCall<{ name: string; reason: string }>({
    system,
    prompt,
    responseJson: true,
    tag: "place-pick",
    maxOutputTokens: 200,
    temperature: 0.5,
  });

  if (!out.usedFallback && out.json && candidates.includes(out.json.name)) {
    return { name: out.json.name, reason: out.json.reason ?? "", source: "llm" };
  }

  // Rule-based fallback: prefer a place name that contains a shared interest keyword.
  const sharedTokens = new Set(
    [...a.interests, ...b.interests].map((t) => t.toLowerCase())
  );
  const ruled =
    candidates.find((c) => [...sharedTokens].some((tok) => c.toLowerCase().includes(tok))) ??
    candidates[0];

  return {
    name: ruled,
    reason: "Picked from your campus safe-spot list as a sensible neutral choice.",
    source: "rule",
  };
}
