import type { Database, LlmRationale, MatchRecord, StudentProfile } from "../types.js";
import { v4 as uuid } from "uuid";
import { llmCall } from "../llm/client.js";
import { matchJudgePrompt } from "../llm/prompts.js";
import { buildContext, isEligibleForRound, isEligiblePair, poolFor } from "./filter.js";

// ---------- Stage 1+2: structured prior score ----------
function intersection(a: string[], b: string[]): string[] {
  const set = new Set(a.map((s) => s.toLowerCase()));
  return b.filter((s) => set.has(s.toLowerCase()));
}

function overlapAvailability(a: string[], b: string[]): string[] {
  const set = new Set(a);
  return b.filter((slot) => set.has(slot));
}

export interface StructuredScoreBreakdown {
  base: number;
  interestPts: number;
  vibePts: number;
  langPts: number;
  seekingBonus: number;
  majorBonus: number;
  availabilityPts: number;
  weightedVibeBonus: number;
  total: number;
  overlap: string[];
  matchedTags: string[];
}

export function structuredScore(a: StudentProfile, b: StudentProfile): StructuredScoreBreakdown {
  const interestOverlap = intersection(a.interests, b.interests);
  const vibeOverlap = intersection(a.vibeTags, b.vibeTags);
  const langOverlap = intersection(a.languages, b.languages);
  const overlap = overlapAvailability(a.availability, b.availability);

  // soft: apply learned weights from feedback
  const aWeights = a.vibeWeights ?? {};
  const bWeights = b.vibeWeights ?? {};
  const weightedVibeBonus = vibeOverlap.reduce(
    (acc, tag) => acc + (aWeights[tag] ?? 0) * 3 + (bWeights[tag] ?? 0) * 3,
    0
  );

  const interestPts = interestOverlap.length * 7;
  const vibePts = vibeOverlap.length * 6;
  const langPts = langOverlap.length * 5;
  const seekingBonus = a.seeking && b.seeking && a.seeking === b.seeking ? 8 : 0;
  const majorBonus = a.major && b.major && a.major !== b.major ? 4 : 0;
  const availabilityPts = Math.min(overlap.length * 4, 12);

  const base = 45;
  const total = Math.min(
    base + interestPts + vibePts + langPts + seekingBonus + majorBonus + availabilityPts + weightedVibeBonus,
    98
  );

  return {
    base,
    interestPts,
    vibePts,
    langPts,
    seekingBonus,
    majorBonus,
    availabilityPts,
    weightedVibeBonus,
    total,
    overlap,
    matchedTags: [...interestOverlap, ...vibeOverlap],
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
  // sanity clamp
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

// ---------- Pairing ----------
export interface RankerOptions {
  minStructuredScore?: number;
  topK?: number;
  useLlmJudge?: boolean;
  llmWeight?: number; // 0..1
}

export interface RankerCandidate {
  candidate: StudentProfile;
  structured: StructuredScoreBreakdown;
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
  const minStructuredScore = opts.minStructuredScore ?? 55;
  const topK = opts.topK ?? 5;
  const useLlmJudge = opts.useLlmJudge ?? true;
  const llmWeight = opts.llmWeight ?? 0.6;

  // Stage 1: hard filter; Stage 2: structured score
  const stage12: RankerCandidate[] = [];
  for (const candidate of pool) {
    const eligible = isEligiblePair(user, candidate, ctx);
    if (!eligible.ok) continue;
    const structured = structuredScore(user, candidate);
    if (structured.total < minStructuredScore) continue;
    stage12.push({ candidate, structured, finalScore: structured.total });
  }
  stage12.sort((x, y) => y.structured.total - x.structured.total);
  const shortlist = stage12.slice(0, topK);

  // Stage 3: LLM soft judge on top-K
  if (useLlmJudge) {
    for (const item of shortlist) {
      item.llm = await llmJudge(user, item.candidate);
      if (item.llm) {
        item.finalScore = Math.round(
          (1 - llmWeight) * item.structured.total + llmWeight * item.llm.compatibility
        );
      }
    }
    shortlist.sort((x, y) => y.finalScore - x.finalScore);
  }

  return shortlist;
}

// ---------- Weekly run: greedy global pairing ----------
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

function reasonsFor(
  source: StudentProfile,
  target: StudentProfile,
  cand: RankerCandidate
): string[] {
  const reasons: string[] = [];
  if (cand.llm?.sparks?.length) {
    reasons.push(...cand.llm.sparks.slice(0, 3));
  } else {
    if (cand.structured.matchedTags.length) {
      reasons.push(`Shared signal: ${cand.structured.matchedTags.slice(0, 3).join(", ")}`);
    }
    if (cand.structured.overlap.length) {
      reasons.push(`${cand.structured.overlap.length} overlapping time slot(s)`);
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
  const used = new Set<string>();
  const created: MatchRecord[] = [];
  const skipped: string[] = [];

  // sort by joinedAt (older first) for fairness
  eligible.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

  for (const a of eligible) {
    if (used.has(a.id)) continue;
    const pool = poolFor(a, eligible).filter((s) => !used.has(s.id));
    const ranked = await rankCandidatesFor(a, pool, db, opts);
    const pick = ranked[0];
    if (!pick) {
      skipped.push(a.id);
      continue;
    }
    used.add(a.id);
    used.add(pick.candidate.id);

    const overlap = pick.structured.overlap;
    const uni = db.universities.find((u) => u.id === a.universityId);
    const spot = uni?.safeSpots[0] ?? "Campus café";

    const match: MatchRecord = {
      id: uuid(),
      createdAt: new Date().toISOString(),
      dropDate: nextWednesdayDrop(),
      userAId: a.id,
      userBId: pick.candidate.id,
      score: pick.finalScore,
      status: "pending",
      reasonsForA: reasonsFor(a, pick.candidate, pick),
      reasonsForB: reasonsFor(pick.candidate, a, pick),
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
      events: [{ at: new Date().toISOString(), kind: "created", payload: { score: pick.finalScore } }],
      acceptances: [],
      llmRationale: pick.llm,
      universityId: a.universityId,
    };

    db.matches.unshift(match);
    created.push(match);
  }

  return { created, skippedNoCandidate: skipped };
}
