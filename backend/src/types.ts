export type Locale = "en" | "zh-HK" | "zh-CN";
export type VerificationStatus = "pending" | "verified";

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

export interface MindSignals {
  devTools?: string[];
  consumptionStyle?: string;
  recentMindChange?: string;
  mediaTaste?: string[];
}

export interface SocialSignals {
  githubUrl?: string;
  socialNotes?: string;
  socialAffinity?: string;
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
  phoneNumber?: string;
  photoUrls?: string[];
  mediaCards?: Array<{
    photoUrl?: string;
    caption?: string;
  }>;
}

export interface ProfileAnalysis {
  generatedAt: string;
  summary: string;
  romanticStyle: string;
  emotionalTone: string;
  datingIntent: string;
  strengths: string[];
  growthEdges: string[];
  idealMatch: string;
  matchSignals: string[];
  conversationHooks: string[];
  firstDateSuggestions: string[];
  profileCompletenessNotes: string[];
  sourceTemplates: string[];
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
  preferredLocale?: Locale;
  interests: string[];
  vibeTags: string[];
  dealBreakers: string[];
  photoUrl?: string;
  verificationStatus: VerificationStatus;
  joinedAt: string;
  optedIn: boolean;
  availability: string[];
  profileComplete: boolean;
  // upgrade fields (all optional for backward compat)
  crossUniOk?: boolean;
  blockedUserIds?: string[];
  lifeSignals?: LifeSignals;
  mindSignals?: MindSignals;
  socialSignals?: SocialSignals;
  datingPreferences?: DatingPreferences;
  personaSummary?: string;
  profileAnalysis?: ProfileAnalysis;
  onboardingAnswers?: Record<string, Record<string, unknown>>;
  vibeWeights?: Record<string, number>;
  onboardingStage?: "auth" | "basic" | "life" | "mind" | "social" | "complete";
  ldfrResult?: {
    code: string;
    title: string;
    vibe: string;
    analysis: string;
    strengths: string[];
    traps: string[];
    idealDate: string;
  };
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

export interface MatchEvent {
  at: string;
  kind: string;
  payload?: Record<string, unknown>;
}

export interface MatchAcceptance {
  userId: string;
  choice: "yes" | "no" | "skip";
  at: string;
}

export interface DateConfirmation {
  userId: string;
  slot: string;
  place?: string;
  at: string;
}

export interface MatchEmailAction {
  userId: string;
  choice: "yes" | "no";
  token: string;
  createdAt: string;
  usedAt?: string;
}

export interface ProposedPlace {
  name: string;
  address?: string;
  reason: string;
  source: "rule" | "llm";
}

export interface LlmRationale {
  compatibility: number;
  sparks: string[];
  risks: string[];
  openerTopic: string;
}

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
  feedback: Array<{
    userId: string;
    sentiment: "love" | "pass" | "rematch";
    notes: string;
    at: string;
  }>;
  // upgrade fields
  events?: MatchEvent[];
  acceptances?: MatchAcceptance[];
  emailActions?: MatchEmailAction[];
  proposedSlots?: string[];
  proposedPlace?: ProposedPlace;
  llmRationale?: LlmRationale;
  universityId?: string;
  dateConfirmations?: DateConfirmation[];
  icebreaker?: string;
}

export interface VerificationCode {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  createdAt: string;
}

export interface InviteCode {
  code: string;
  createdAt: string;
  note?: string;
  batch?: string;
  universityId?: string;
  usedBy?: string;
  usedAt?: string;
}

export type SurveyTemplate =
  | "onboarding_life"
  | "onboarding_mind"
  | "onboarding_social"
  | "onboarding_basics"
  | "onboarding_preferences"
  | "onboarding_attraction"
  | "onboarding_ldfr"
  | "onboarding_media"
  | "post_date_2h"
  | "post_date_24h";

export interface Survey {
  id: string;
  userId: string;
  matchId?: string;
  template: SurveyTemplate;
  answers: Record<string, unknown>;
  derivedSignals: string[];
  at: string;
}

export interface Database {
  universities: University[];
  students: StudentProfile[];
  matches: MatchRecord[];
  verificationCodes: VerificationCode[];
  inviteCodes: InviteCode[];
  surveys: Survey[];
}
