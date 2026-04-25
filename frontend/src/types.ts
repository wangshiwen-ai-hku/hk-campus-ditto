export type Locale = "en" | "zh-HK" | "zh-CN";

export interface University {
  id: string;
  name: string;
  shortName: string;
  domains: string[];
  campuses: string[];
  safeSpots: string[];
}

export interface StudentProfile {
  id: string;
  fullName: string;
  email: string;
  universityId: string;
  yearOfStudy: string;
  major: string;
  gender: string;
  seeking: string;
  bio: string;
  languages: string[];
  interests: string[];
  vibeTags: string[];
  dealBreakers: string[];
  photoUrl?: string;
  verificationStatus: "pending" | "verified";
  joinedAt: string;
  optedIn: boolean;
  availability: string[];
  profileComplete: boolean;
}

export interface MatchRecord {
  id: string;
  createdAt: string;
  dropDate: string;
  userAId: string;
  userBId: string;
  score: number;
  status: "pending" | "awaiting-availability" | "scheduled" | "rematch-requested";
  reasonsForA: string[];
  reasonsForB: string[];
  posterHeadline: string;
  curatedDateTitle: string;
  curatedDateSpot: string;
  curatedDateTips: string[];
  overlapSlots: string[];
  confirmedSlot?: string;
  feedback: Array<{
    userId: string;
    sentiment: "love" | "pass" | "rematch";
    notes: string;
    at: string;
  }>;
}

export interface MetaResponse {
  universities: University[];
  nextDrop: string;
  stats: { students: number; activeMatches: number; scheduledDates: number; };
  demoAccounts: Array<{ id: string; fullName: string; email: string; universityId: string; }>;
}
