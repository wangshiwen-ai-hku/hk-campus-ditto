import type { Database, InviteCode } from "../types.js";

export function findInvite(db: Database, code: string): InviteCode | undefined {
  return db.inviteCodes.find((i) => i.code === code.trim());
}

export function isInviteUsable(invite: InviteCode | undefined): boolean {
  return Boolean(invite && !invite.usedBy);
}

export function consumeInvite(db: Database, code: string, userId: string): boolean {
  const invite = findInvite(db, code);
  if (!invite || invite.usedBy) return false;
  invite.usedBy = userId;
  invite.usedAt = new Date().toISOString();
  return true;
}

export interface GenerateInviteOptions {
  count: number;
  note?: string;
  batch?: string;
  universityId?: string;
}

export function generateInvites(db: Database, options: GenerateInviteOptions): InviteCode[] {
  const created: InviteCode[] = [];
  const existing = new Set(db.inviteCodes.map((invite) => invite.code));
  for (let i = 0; i < options.count; i++) {
    let code = "";
    do {
      code = `DITTO-${options.universityId?.toUpperCase() ?? "HK"}-${randSegment()}-${randSegment()}`;
    } while (existing.has(code));
    existing.add(code);
    const invite: InviteCode = {
      code,
      createdAt: new Date().toISOString(),
      note: options.note,
      batch: options.batch,
      universityId: options.universityId,
    };
    db.inviteCodes.push(invite);
    created.push(invite);
  }
  return created;
}

export function inviteStats(db: Database) {
  const byUniversity: Record<string, { total: number; used: number; available: number }> = {};
  const byBatch: Record<string, { total: number; used: number; available: number }> = {};
  for (const invite of db.inviteCodes) {
    const university = invite.universityId ?? "unassigned";
    const batch = invite.batch ?? "unassigned";
    byUniversity[university] ??= { total: 0, used: 0, available: 0 };
    byBatch[batch] ??= { total: 0, used: 0, available: 0 };
    byUniversity[university].total += 1;
    byBatch[batch].total += 1;
    if (invite.usedBy) {
      byUniversity[university].used += 1;
      byBatch[batch].used += 1;
    } else {
      byUniversity[university].available += 1;
      byBatch[batch].available += 1;
    }
  }
  return {
    total: db.inviteCodes.length,
    used: db.inviteCodes.filter((invite) => invite.usedBy).length,
    available: db.inviteCodes.filter((invite) => !invite.usedBy).length,
    byUniversity,
    byBatch,
  };
}

function randSegment(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}
