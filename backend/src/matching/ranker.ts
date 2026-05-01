import type { Database, LlmRationale, MatchRecord, StudentProfile } from "../types.js";
import { v4 as uuid } from "uuid";
import { llmCall } from "../llm/client.js";
import { matchJudgePrompt } from "../llm/prompts.js";
import { buildContext, isEligibleForRound, isEligiblePair, poolFor } from "./filter.js";
import { structuredScore as computeStructuredScore, type MatchScoreBreakdown } from "./scorer.js";

export function structuredScore(a: StudentProfile, b: StudentProfile): MatchScoreBreakdown & { overlap: string[]; matchedTags: string[] } {
  const score = computeStructuredScore(a, b);
  return {
    ...score,
    overlap: score.overlaps.availability,
    matchedTags: [...score.overlaps.interests, ...score.overlaps.vibes],
  };
}

// ---------- Stage 3: LLM soft judge ----------
export async function llmJudge(a: StudentProfile, b: StudentProfile): Promise<LlmRationale | undefined> {
  const { system, prompt } = matchJudgePrompt(a, b);
  const out = await llmCall<LlmRationale>({
    system,
    prompt,
    responseJson: true,
    tag: "match-judge",
    maxOutputTokens: 400,
    temperature: 0.4,
  });
  if (out.usedFallback || !out.json) return undefined;
  const json = out.json;
  return {
    compatibility: clamp(Number(json.compatibility) || 0, 0, 100),
    sparks: Array.isArray(json.sparks) ? json.sparks.slice(0, 4).map(String) : [],
    risks: Array.isArray(json.risks) ? json.risks.slice(0, 2).map(String) : [],
    openerTopic: typeof json.openerTopic === "string" ? json.openerTopic.slice(0, 240) : "",
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export interface RankerOptions {
  minStructuredScore?: number;
  topK?: number;
  useLlmJudge?: boolean;
  llmWeight?: number;
}

export interface RankerCandidate {
  candidate: StudentProfile;
  structured: MatchScoreBreakdown;
  llm?: LlmRationale;
  finalScore: number;
}

export async function rankCandidatesFor(
  user: StudentProfile,
  pool: StudentProfile[],
  db: Database,
  opts: RankerOptions = {}
): Promise<RankerCandidate[]> {
  const ctx = buildContext(db);
  const topK = opts.topK ?? 5;
  const useLlmJudge = opts.useLlmJudge ?? true;
  const llmWeight = opts.llmWeight ?? 0.2;

  const ranked: RankerCandidate[] = [];
  for (const candidate of pool) {
    const eligible = isEligiblePair(user, candidate, ctx);
    if (!eligible.ok) continue;
    const structured = computeStructuredScore(user, candidate);
    const threshold = opts.minStructuredScore ?? structured.threshold;
    if (structured.total < threshold) continue;
    ranked.push({ candidate, structured, finalScore: structured.total });
  }

  ranked.sort((x, y) => y.structured.total - x.structured.total);
  const shortlist = ranked.slice(0, topK);

  if (useLlmJudge) {
    for (const item of shortlist) {
      item.llm = await llmJudge(user, item.candidate);
      if (item.llm) {
        item.finalScore = Math.round((1 - llmWeight) * item.structured.total + llmWeight * item.llm.compatibility);
      }
    }
    shortlist.sort((x, y) => y.finalScore - x.finalScore);
  }

  return shortlist;
}

export interface WeeklyRunResult {
  created: MatchRecord[];
  skippedNoCandidate: string[];
}

function nextWednesdayDrop(): string {
  const date = new Date();
  const day = date.getDay();
  const diff = (3 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  date.setHours(19, 0, 0, 0);
  return date.toISOString();
}

function reasonsFor(source: StudentProfile, target: StudentProfile, cand: RankerCandidate): string[] {
  const reasons: string[] = [];
  if (cand.llm?.sparks?.length) {
    reasons.push(...cand.llm.sparks.slice(0, 3));
  } else {
    if (cand.structured.overlaps.interests.length) {
      reasons.push(`Shared interests: ${cand.structured.overlaps.interests.slice(0, 3).join(", ")}`);
    }
    if (cand.structured.overlaps.availability.length) {
      reasons.push(`${cand.structured.overlaps.availability.length} overlapping time slot(s)`);
    }
    if (cand.structured.notes.length) {
      reasons.push(cand.structured.notes[0]);
    }
    reasons.push(`Both verified at ${source.universityId === target.universityId ? "the same campus" : "Hong Kong campuses"}`);
  }
  return reasons.slice(0, 3);
}

export async function runWeeklyMatchmaking(
  db: Database,
  opts: RankerOptions = {}
): Promise<WeeklyRunResult> {
  const ctx = buildContext(db);
  const eligible = db.students.filter((s) => isEligibleForRound(s, ctx));
  const edges: Array<{ a: StudentProfile; b: StudentProfile; pick: RankerCandidate }> = [];

  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      const a = eligible[i];
      const b = eligible[j];
      if (!poolFor(a, eligible).some((s) => s.id === b.id)) continue;
      const ranked = await rankCandidatesFor(a, [b], db, { ...opts, topK: 1 });
      const pick = ranked[0];
      if (pick) edges.push({ a, b, pick });
    }
  }

  edges.sort((x, y) => y.pick.finalScore - x.pick.finalScore);

  const used = new Set<string>();
  const created: MatchRecord[] = [];
  for (const edge of edges) {
    const { a, b, pick } = edge;
    if (used.has(a.id) || used.has(b.id)) continue;
    used.add(a.id);
    used.add(b.id);

    const overlap = pick.structured.overlaps.availability;
    const uni = db.universities.find((u) => u.id === a.universityId);
    const spot = uni?.safeSpots[0] ?? "Campus café";

    const match: MatchRecord = {
      id: uuid(),
      createdAt: new Date().toISOString(),
      dropDate: nextWednesdayDrop(),
      userAId: a.id,
      userBId: b.id,
      score: pick.finalScore,
      status: "pending",
      reasonsForA: reasonsFor(a, b, pick),
      reasonsForB: reasonsFor(b, a, pick),
      posterHeadline: `One intentional date for ${uni?.shortName ?? "campus"}`,
      curatedDateTitle: pick.llm?.openerTopic
        ? "Coffee + a real conversation"
        : overlap.length
        ? "Coffee + short campus loop"
        : "Coffee first, timing next",
      curatedDateSpot: spot,
      curatedDateTips: pick.llm?.openerTopic
        ? [pick.llm.openerTopic, "Keep the first meet to 45-60 minutes", "Be specific, not polished"]
        : [
            "Aim for a low-pressure first meet",
            "Keep the first date under an hour",
            "Use the talking points to break the ice",
          ],
      overlapSlots: overlap,
      feedback: [],
      events: [{ at: new Date().toISOString(), kind: "created", payload: { score: pick.finalScore, breakdown: pick.structured } }],
      acceptances: [],
      llmRationale: pick.llm,
      universityId: a.universityId,
    };

    db.matches.unshift(match);
    created.push(match);
  }

  const skippedNoCandidate = eligible.filter((student) => !used.has(student.id)).map((student) => student.id);
  return { created, skippedNoCandidate };
}
