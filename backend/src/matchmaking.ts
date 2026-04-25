import type { Database, MatchRecord, StudentProfile, University } from "./types.js";
import { v4 as uuid } from "uuid";

function intersectionScore(a: string[], b: string[]) {
  const set = new Set(a.map((item) => item.toLowerCase()));
  return b.reduce((acc, item) => acc + (set.has(item.toLowerCase()) ? 1 : 0), 0);
}

function overlapAvailability(a: string[], b: string[]) {
  const set = new Set(a);
  return b.filter((slot) => set.has(slot));
}

function computeScore(a: StudentProfile, b: StudentProfile) {
  let score = 45;
  score += intersectionScore(a.interests, b.interests) * 7;
  score += intersectionScore(a.languages, b.languages) * 5;
  score += intersectionScore(a.vibeTags, b.vibeTags) * 6;
  if (a.seeking && b.seeking && a.seeking === b.seeking) score += 8;
  if (a.major && b.major && a.major !== b.major) score += 4;
  score += Math.min(overlapAvailability(a.availability, b.availability).length * 4, 12);
  return Math.min(score, 98);
}

function reasonsFor(source: StudentProfile, target: StudentProfile, overlap: string[]) {
  const interestOverlap = source.interests.filter((item) => target.interests.includes(item)).slice(0, 2);
  const vibeOverlap = source.vibeTags.filter((item) => target.vibeTags.includes(item)).slice(0, 2);
  const reasons: string[] = [];
  if (interestOverlap.length) reasons.push(`Shared interests: ${interestOverlap.join(" + ")}`);
  if (vibeOverlap.length) reasons.push(`Matched energy: ${vibeOverlap.join(" + ")}`);
  if (overlap.length) reasons.push(`You already have ${overlap.length} overlapping time slot(s) this week`);
  reasons.push(`Both of you are verified students in the same campus community`);
  return reasons.slice(0, 3);
}

function nextWednesdayDrop(): string {
  const date = new Date();
  const day = date.getDay();
  const diff = (3 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  date.setHours(19, 0, 0, 0);
  return date.toISOString();
}

function activeMatchForUser(matches: MatchRecord[], userId: string) {
  return matches.find((match) =>
    (match.userAId === userId || match.userBId === userId) &&
    ["pending", "awaiting-availability", "scheduled"].includes(match.status)
  );
}

export function runWeeklyMatchmaking(db: Database): MatchRecord[] {
  const created: MatchRecord[] = [];
  const grouped = new Map<string, StudentProfile[]>();

  for (const student of db.students) {
    if (student.verificationStatus !== "verified" || !student.optedIn || !student.profileComplete) continue;
    if (activeMatchForUser(db.matches, student.id)) continue;
    const list = grouped.get(student.universityId) ?? [];
    list.push(student);
    grouped.set(student.universityId, list);
  }

  for (const [universityId, students] of grouped.entries()) {
    const uni = db.universities.find((item) => item.id === universityId);
    if (!uni) continue;
    const used = new Set<string>();

    for (const a of students) {
      if (used.has(a.id)) continue;
      let best: { candidate: StudentProfile; score: number } | null = null;

      for (const b of students) {
        if (a.id === b.id || used.has(b.id)) continue;
        const score = computeScore(a, b);
        if (!best || score > best.score) best = { candidate: b, score };
      }

      if (!best) continue;
      used.add(a.id);
      used.add(best.candidate.id);

      const overlap = overlapAvailability(a.availability, best.candidate.availability);
      const spot = uni.safeSpots[Math.floor(Math.random() * uni.safeSpots.length)];

      const match: MatchRecord = {
        id: uuid(),
        createdAt: new Date().toISOString(),
        dropDate: nextWednesdayDrop(),
        userAId: a.id,
        userBId: best.candidate.id,
        score: best.score,
        status: overlap.length ? "awaiting-availability" : "pending",
        reasonsForA: reasonsFor(a, best.candidate, overlap),
        reasonsForB: reasonsFor(best.candidate, a, overlap),
        posterHeadline: `One intentional campus date for ${uni.shortName}`,
        curatedDateTitle: overlap.length ? "Coffee + short campus loop" : "Coffee first, timing next",
        curatedDateSpot: spot,
        curatedDateTips: [
          "Aim for a low-pressure first meet",
          "Keep the first date under an hour",
          "Use the poster talking points to break the ice"
        ],
        overlapSlots: overlap,
        feedback: []
      };

      db.matches.unshift(match);
      created.push(match);
    }
  }

  return created;
}

export function buildMatchView(db: Database, userId: string) {
  const match = db.matches.find((item) =>
    (item.userAId === userId || item.userBId === userId) &&
    ["pending", "awaiting-availability", "scheduled"].includes(item.status)
  );
  if (!match) return null;
  const partnerId = match.userAId === userId ? match.userBId : match.userAId;
  const partner = db.students.find((student) => student.id === partnerId);
  if (!partner) return null;
  return { match, partner };
}

export function findUniversity(db: Database, id: string): University | undefined {
  return db.universities.find((item) => item.id === id);
}

export function recomputeSchedule(match: MatchRecord, a: StudentProfile, b: StudentProfile) {
  const overlap = overlapAvailability(a.availability, b.availability);
  match.overlapSlots = overlap;
  if (overlap.length) {
    match.status = "scheduled";
    match.confirmedSlot = overlap[0];
  } else {
    match.status = "awaiting-availability";
    match.confirmedSlot = undefined;
  }
}
