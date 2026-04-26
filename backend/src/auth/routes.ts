import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { createHash, randomInt } from "node:crypto";
import { ensureDb, saveDb } from "../db.js";
import type { StudentProfile } from "../types.js";
import { env } from "../core/env.js";
import { requireAdmin } from "../core/auth-middleware.js";
import { sendEmail } from "./email.js";
import { findInvite, isInviteUsable, consumeInvite, generateInvites, inviteStats } from "./invite.js";
import { issueToken } from "./jwt.js";

export const authRouter = Router();

function hashCode(code: string): string {
  return createHash("sha256").update(`${env.jwt.secret}:${code}`).digest("hex");
}

function generateCode(): string {
  return String(randomInt(100000, 1000000)); // 6 digits
}

authRouter.post("/request-code", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email." });

  const db = await ensureDb();
  const email = parsed.data.email.toLowerCase();
  const domain = email.split("@")[1];
  const university = db.universities.find((uni) => uni.domains.includes(domain));
  if (!university) {
    return res.status(400).json({ error: "Email domain is not from a supported Hong Kong university." });
  }

  // rate limit: count fresh codes for this email in the last hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recent = db.verificationCodes.filter(
    (c) => c.email === email && new Date(c.createdAt).getTime() > oneHourAgo
  );
  if (recent.length >= env.auth.codeRateLimitPerHour) {
    return res.status(429).json({ error: "Too many code requests. Try again later." });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + env.auth.codeTtlMin * 60 * 1000).toISOString();
  db.verificationCodes = db.verificationCodes.filter((c) => c.email !== email);
  db.verificationCodes.push({
    email,
    codeHash: hashCode(code),
    expiresAt,
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
  await saveDb(db);

  const emailResult = await sendEmail({
    to: email,
    subject: "Your Campus Ditto verification code",
    text: `Your verification code is: ${code}\n\nIt expires in ${env.auth.codeTtlMin} minutes.\n\nIf you didn't request this, ignore the email.`,
  });

  // expose devCode only when running with console email provider (local/dev)
  const devCode = env.email.provider === "console" ? code : undefined;
  res.json({ ok: true, university, emailDelivered: emailResult.ok, devCode });
});

authRouter.post("/verify-code", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    code: z.string().min(4),
    fullName: z.string().min(2),
    inviteCode: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid verification payload." });

  const db = await ensureDb();
  const email = parsed.data.email.toLowerCase();
  const record = db.verificationCodes.find((c) => c.email === email);
  if (!record) return res.status(400).json({ error: "Code not found. Request a new one." });

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: "Code expired. Request a new one." });
  }
  if (record.attempts >= 5) {
    return res.status(429).json({ error: "Too many attempts. Request a new code." });
  }
  record.attempts += 1;

  if (record.codeHash !== hashCode(parsed.data.code)) {
    await saveDb(db);
    return res.status(400).json({ error: "Wrong code." });
  }

  const domain = email.split("@")[1];
  const university = db.universities.find((uni) => uni.domains.includes(domain));
  if (!university) return res.status(400).json({ error: "University not supported." });

  let user = db.students.find((s) => s.email === email);
  const isNew = !user;

  if (isNew) {
    if (env.auth.inviteRequired) {
      if (!parsed.data.inviteCode) {
        return res.status(400).json({ error: "Invite code is required during the beta." });
      }
      const invite = findInvite(db, parsed.data.inviteCode);
      if (!isInviteUsable(invite)) {
        return res.status(400).json({ error: "Invite code is invalid or already used." });
      }
    }

    user = {
      id: uuid(),
      fullName: parsed.data.fullName,
      email,
      universityId: university.id,
      yearOfStudy: "",
      major: "",
      gender: "",
      seeking: "Meaningful connection",
      bio: "",
      languages: ["English"],
      interests: [],
      vibeTags: [],
      dealBreakers: [],
      verificationStatus: "verified",
      joinedAt: new Date().toISOString(),
      optedIn: true,
      availability: [],
      profileComplete: false,
      crossUniOk: false,
      blockedUserIds: [],
      onboardingStage: "basic",
    } satisfies StudentProfile;
    db.students.unshift(user);

    if (env.auth.inviteRequired && parsed.data.inviteCode) {
      consumeInvite(db, parsed.data.inviteCode, user.id);
    }
  } else if (user) {
    user.fullName = parsed.data.fullName || user.fullName;
    user.verificationStatus = "verified";
  }

  // consume the verification code
  db.verificationCodes = db.verificationCodes.filter((c) => c.email !== email);
  await saveDb(db);

  if (!user) return res.status(500).json({ error: "User initialization failed." });
  const token = issueToken({ sub: user.id, email: user.email, uni: user.universityId });
  res.json({ ok: true, user, token, isNew });
});

authRouter.post("/invites/generate", requireAdmin, async (req, res) => {
  const schema = z.object({
    count: z.number().int().min(1).max(2000).default(10),
    note: z.string().optional(),
    batch: z.string().min(1).optional(),
    universityId: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });
  const db = await ensureDb();
  if (parsed.data.universityId && !db.universities.some((u) => u.id === parsed.data.universityId)) {
    return res.status(400).json({ error: "Unknown universityId." });
  }
  const created = generateInvites(db, parsed.data);
  await saveDb(db);
  res.json({ ok: true, count: created.length, invites: created, stats: inviteStats(db) });
});

authRouter.get("/invites/stats", requireAdmin, async (_req, res) => {
  const db = await ensureDb();
  res.json({ stats: inviteStats(db) });
});

authRouter.get("/invites/export.csv", requireAdmin, async (req, res) => {
  const db = await ensureDb();
  const universityId = typeof req.query.universityId === "string" ? req.query.universityId : undefined;
  const batch = typeof req.query.batch === "string" ? req.query.batch : undefined;
  const rows = db.inviteCodes.filter((invite) => {
    if (universityId && invite.universityId !== universityId) return false;
    if (batch && invite.batch !== batch) return false;
    return true;
  });
  const header = ["code", "universityId", "batch", "note", "createdAt", "usedBy", "usedAt"];
  const csv = [
    header.join(","),
    ...rows.map((invite) =>
      header.map((key) => csvCell(String(invite[key as keyof typeof invite] ?? ""))).join(",")
    ),
  ].join("\n");
  res.header("Content-Type", "text/csv; charset=utf-8");
  res.header("Content-Disposition", "attachment; filename=campus-ditto-invites.csv");
  res.send(csv);
});

function csvCell(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
