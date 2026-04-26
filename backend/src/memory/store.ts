import type { Database, MatchRecord, StudentProfile, Survey } from "../types.js";

export interface UserMemoryView {
  userId: string;
  fullName: string;
  personaSummary?: string;
  hardPreferences: {
    universityId: string;
    crossUniOk: boolean;
    seeking: string;
    dealBreakers: string[];
  };
  softPreferences: {
    vibeWeights: Record<string, number>;
    interests: string[];
    vibeTags: string[];
  };
  lifeSignals: NonNullable<StudentProfile["lifeSignals"]>;
  mindSignals: NonNullable<StudentProfile["mindSignals"]>;
  socialSignals: NonNullable<StudentProfile["socialSignals"]>;
  blockedUserIds: string[];
}

export function buildUserMemory(db: Database, userId: string): UserMemoryView | undefined {
  const u = db.students.find((s) => s.id === userId);
  if (!u) return undefined;
  return {
    userId: u.id,
    fullName: u.fullName,
    personaSummary: u.personaSummary,
    hardPreferences: {
      universityId: u.universityId,
      crossUniOk: !!u.crossUniOk,
      seeking: u.seeking,
      dealBreakers: u.dealBreakers ?? [],
    },
    softPreferences: {
      vibeWeights: u.vibeWeights ?? {},
      interests: u.interests,
      vibeTags: u.vibeTags,
    },
    lifeSignals: u.lifeSignals ?? {},
    mindSignals: u.mindSignals ?? {},
    socialSignals: u.socialSignals ?? {},
    blockedUserIds: u.blockedUserIds ?? [],
  };
}

export function listUserSurveys(db: Database, userId: string): Survey[] {
  return db.surveys.filter((s) => s.userId === userId).sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function listUserMatches(db: Database, userId: string): MatchRecord[] {
  return db.matches
    .filter((m) => m.userAId === userId || m.userBId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
