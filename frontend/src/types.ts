export type Locale = "en" | "zh-HK" | "zh-CN";

export interface University {
  id: string;
  name: string;
  shortName: string;
  domains: string[];
  campuses: string[];
  safeSpots: string[];
}

export interface LifeSignals {
  coffeeOrTea?: string[];
  weekendVibe?: string;
  weekendVibes?: string[];
  spendingTier?: "budget" | "moderate" | "splurge";
  petAffinity?: "dog" | "cat" | "both" | "none";
  energyMode?: "introvert" | "extrovert" | "ambivert";
  firstDateLength?: "short" | "medium" | "long";
}

export interface DatingPreferences {
  birthday?: string;
  ethnicity?: string;
  heightCm?: number;
  datingGoal?: "life_partner" | "long_term" | "casual" | "friends" | "unsure";
  datingGoals?: string[];
  dateGenders?: string[];
  ageRange?: {
    min: number;
    max: number;
  };
  ethnicityPreferences?: string[];
  hkMtrLocations?: string[];
  languagePreferences?: string[];
  mbti?: {
    energy?: string;
    information?: string;
    decision?: string;
    lifestyle?: string;
  };
  attractionSignals?: {
    heightAndBuild?: string;
    facialFeatures?: string;
    energyAndVibe?: string;
    flexible?: string[];
  };
  matchMode?: "fast" | "balanced" | "intentional" | "wait_for_the_one";
  photoUrls?: string[];
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
  personaSummary?: string;
  proposedSlots?: string[];
  blockedUserIds?: string[];
  crossUniOk?: boolean;
  lifeSignals?: LifeSignals;
  datingPreferences?: DatingPreferences;
}

export type MatchStatus =
  | "pending"
  | "notified"
  | "awaiting-acceptance"
  | "mutual-accepted"
  | "declined"
  | "slot-proposing"
  | "slot-confirmed"
  | "place-confirmed"
  | "scheduled"
  | "happened"
  | "feedback-collected"
  | "closed"
  | "rematch-requested"
  | "awaiting-availability";

export interface MatchRecord {
  id: string;
  createdAt: string;
  dropDate: string;
  userAId: string;
  userBId: string;
  score: number;
  status: MatchStatus;
  reasonsForA: string[];
  reasonsForB: string[];
  posterHeadline: string;
  curatedDateTitle: string;
  curatedDateSpot: string;
  curatedDateTips: string[];
  overlapSlots: string[];
  confirmedSlot?: string;
  proposedSlots?: string[];
  proposedPlace?: {
    name: string;
    address?: string;
    reason: string;
    source: "rule" | "llm";
  };
  acceptances?: Array<{
    userId: string;
    choice: "yes" | "no" | "skip";
    at: string;
  }>;
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
  stats: { students: number; activeMatches: number; scheduledDates: number; availableInvites?: number; };
  demoAccounts: Array<{ id: string; fullName: string; email: string; universityId: string; }>;
}

export type QuestionKind = "single" | "multi" | "text" | "scale" | "range" | "date" | "number" | "photos";

export interface Question {
  id: string;
  prompt?: string;
  promptKey?: string;
  whyItMatters?: string;
  whyItMattersKey?: string;
  kind: QuestionKind;
  options?: string[];
  optionsKeys?: string[];
  placeholderKey?: string;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  required?: boolean;
}

export interface QuestionGroup {
  template: string;
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  questions: Question[];
}
