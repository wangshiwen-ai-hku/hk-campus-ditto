import type { MatchRecord, MatchStatus } from "../types.js";

const TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  pending: ["notified", "declined"],
  notified: ["awaiting-acceptance", "declined"],
  "awaiting-acceptance": ["mutual-accepted", "declined"],
  "mutual-accepted": ["slot-proposing", "declined"],
  "slot-proposing": ["slot-confirmed", "awaiting-availability", "declined"],
  "awaiting-availability": ["slot-proposing", "slot-confirmed", "declined"],
  "slot-confirmed": ["place-confirmed"],
  "place-confirmed": ["scheduled"],
  scheduled: ["happened", "declined"],
  happened: ["feedback-collected"],
  "feedback-collected": ["closed"],
  closed: [],
  declined: ["closed"],
  "rematch-requested": ["closed"],
};

export function canTransition(from: MatchStatus, to: MatchStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(
  match: MatchRecord,
  to: MatchStatus,
  payload?: Record<string, unknown>
): { ok: boolean; reason?: string } {
  if (!canTransition(match.status, to)) {
    return { ok: false, reason: `cannot move ${match.status} → ${to}` };
  }
  match.status = to;
  match.events = match.events ?? [];
  match.events.push({ at: new Date().toISOString(), kind: `status:${to}`, payload });
  return { ok: true };
}

export function logEvent(match: MatchRecord, kind: string, payload?: Record<string, unknown>) {
  match.events = match.events ?? [];
  match.events.push({ at: new Date().toISOString(), kind, payload });
}

export function isBothAccepted(match: MatchRecord): boolean {
  const acc = match.acceptances ?? [];
  const a = acc.find((x) => x.userId === match.userAId);
  const b = acc.find((x) => x.userId === match.userBId);
  return a?.choice === "yes" && b?.choice === "yes";
}

export function eitherDeclined(match: MatchRecord): boolean {
  return (match.acceptances ?? []).some((x) => x.choice === "no");
}
