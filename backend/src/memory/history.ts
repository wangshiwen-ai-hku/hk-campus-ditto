import type { Database, MatchRecord } from "../types.js";

export interface HistoryItem {
  matchId: string;
  partnerId: string;
  partnerName: string;
  partnerUniversityId: string;
  createdAt: string;
  status: MatchRecord["status"];
  score: number;
  outcome: "pending" | "happened" | "declined" | "ghosted" | "scheduled" | "closed";
  reasons: string[];
  ownSentiments: string[];
  ownNotes: string[];
  derivedSignals: string[];
}

function deriveOutcome(match: MatchRecord): HistoryItem["outcome"] {
  switch (match.status) {
    case "happened":
    case "feedback-collected":
    case "closed":
      return match.feedback.length ? "happened" : "closed";
    case "declined":
      return "declined";
    case "scheduled":
    case "place-confirmed":
    case "slot-confirmed":
      return "scheduled";
    default:
      return "pending";
  }
}

export function buildHistory(db: Database, userId: string): HistoryItem[] {
  return db.matches
    .filter((m) => m.userAId === userId || m.userBId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((m) => {
      const partnerId = m.userAId === userId ? m.userBId : m.userAId;
      const partner = db.students.find((s) => s.id === partnerId);
      const ownFeedback = m.feedback.filter((f) => f.userId === userId);
      const ownSurveys = db.surveys.filter((s) => s.matchId === m.id && s.userId === userId);
      return {
        matchId: m.id,
        partnerId,
        partnerName: partner?.fullName ?? partnerId,
        partnerUniversityId: partner?.universityId ?? "",
        createdAt: m.createdAt,
        status: m.status,
        score: m.score,
        outcome: deriveOutcome(m),
        reasons: m.userAId === userId ? m.reasonsForA : m.reasonsForB,
        ownSentiments: ownFeedback.map((f) => f.sentiment),
        ownNotes: ownFeedback.map((f) => f.notes).filter(Boolean),
        derivedSignals: ownSurveys.flatMap((s) => s.derivedSignals),
      } satisfies HistoryItem;
    });
}
