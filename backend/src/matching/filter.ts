import type { Database, MatchRecord, StudentProfile } from "../types.js";
import { hardConstraints } from "./scorer.js";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export interface FilterContext {
  matches: MatchRecord[];
}

function pairWasRecentlyMatched(matches: MatchRecord[], a: string, b: string): boolean {
  const cutoff = Date.now() - NINETY_DAYS_MS;
  return matches.some(
    (m) =>
      ((m.userAId === a && m.userBId === b) || (m.userAId === b && m.userBId === a)) &&
      new Date(m.createdAt).getTime() > cutoff
  );
}

function pairHasPassFeedback(matches: MatchRecord[], a: string, b: string): boolean {
  return matches.some(
    (m) =>
      ((m.userAId === a && m.userBId === b) || (m.userAId === b && m.userBId === a)) &&
      m.feedback.some((f) => f.sentiment === "pass")
  );
}

function dealbreakerHit(a: StudentProfile, b: StudentProfile): boolean {
  const lowerB = new Set([...(b.vibeTags ?? []), ...(b.interests ?? [])].map((t) => t.toLowerCase()));
  return (a.dealBreakers ?? []).some((db) => lowerB.has(db.toLowerCase()));
}

export function isEligibleForRound(s: StudentProfile, _ctx: FilterContext): boolean {
  if (s.verificationStatus !== "verified") return false;
  if (!s.optedIn) return false;
  return true;
}

export function isEligiblePair(
  a: StudentProfile,
  b: StudentProfile,
  ctx: FilterContext
): { ok: boolean; reason?: string } {
  if (a.id === b.id) return { ok: false, reason: "same user" };
  if ((a.blockedUserIds ?? []).includes(b.id) || (b.blockedUserIds ?? []).includes(a.id)) {
    return { ok: false, reason: "blocked" };
  }
  if (dealbreakerHit(a, b) || dealbreakerHit(b, a)) return { ok: false, reason: "dealbreaker" };
  if (pairWasRecentlyMatched(ctx.matches, a.id, b.id)) return { ok: false, reason: "recent match" };
  if (pairHasPassFeedback(ctx.matches, a.id, b.id)) return { ok: false, reason: "passed before" };
  const constraints = hardConstraints(a, b);
  if (!constraints.ok) return { ok: false, reason: constraints.reasons.join("; ") };
  return { ok: true };
}


export function poolFor(student: StudentProfile, all: StudentProfile[]): StudentProfile[] {
  if (student.crossUniOk) return all;
  return all.filter((s) => s.universityId === student.universityId);
}

export function buildContext(db: Database): FilterContext {
  return { matches: db.matches };
}
