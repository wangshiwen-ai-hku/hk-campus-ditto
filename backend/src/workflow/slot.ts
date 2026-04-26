import type { MatchRecord, StudentProfile } from "../types.js";

export function intersectAvailability(a: string[], b: string[]): string[] {
  const set = new Set(a);
  return b.filter((slot) => set.has(slot));
}

export function proposeSlots(a: StudentProfile, b: StudentProfile): string[] {
  const overlap = intersectAvailability(a.availability, b.availability);
  return overlap.slice(0, 3);
}

export function recomputeSlotState(
  match: MatchRecord,
  a: StudentProfile,
  b: StudentProfile
): void {
  const proposals = proposeSlots(a, b);
  match.proposedSlots = proposals;
  match.overlapSlots = proposals;
  if (proposals.length === 0) {
    match.status = "awaiting-availability";
    match.confirmedSlot = undefined;
  } else if (!match.confirmedSlot) {
    match.status = "slot-proposing";
  }
}

export function confirmSlot(match: MatchRecord, slot: string): { ok: boolean; reason?: string } {
  const proposals = match.proposedSlots ?? match.overlapSlots ?? [];
  if (!proposals.includes(slot)) {
    return { ok: false, reason: "slot not in proposals" };
  }
  match.confirmedSlot = slot;
  match.status = "slot-confirmed";
  return { ok: true };
}
