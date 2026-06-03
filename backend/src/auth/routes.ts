import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { createHash, randomInt } from "node:crypto";
import {
  ensureDb,
  getInviteByCode,
  getStudentByEmail,
  getUniversityByEmailDomain,
  getVerificationCode,
  saveDb,
  saveInvite,
  saveStudent,
  saveVerificationCode,
} from "../db.js";
import type { StudentProfile } from "../types.js";
import { env } from "../core/env.js";
import { requireAdmin } from "../core/auth-middleware.js";
import { sendEmail } from "./email.js";
import { isInviteUsable, isInviteValidForUniversity, generateInvites, inviteStats } from "./invite.js";
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

  const email = parsed.data.email.toLowerCase();
  const domain = email.split("@")[1];
  const university = await getUniversityByEmailDomain(domain);
  if (!university) {
    return res.status(400).json({ error: "Email domain is not from a supported Hong Kong university." });
  }

  // rate limit: count fresh codes for this email in the last hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recent = await getVerificationCode(email);
  if (recent && new Date(recent.createdAt).getTime() > oneHourAgo && env.auth.codeRateLimitPerHour <= 1) {
    return res.status(429).json({ error: "Too many code requests. Try again later." });
  }

  const code = generateCode();
  const emailResult = await sendEmail({
    to: email,
    subject: "Your DopaMine sign-in code",
    text: `Your DopaMine verification code is:

${code}

This code expires in ${env.auth.codeTtlMin} minutes.

You received this email because someone requested to sign in to DopaMine using this email address.

If this was not you, you can safely ignore this email.

DopaMine
aurahk.me
support@aurahk.me`,
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;max-width:480px;margin:0 auto;padding:24px;">
  <p style="font-size:15px;margin:0 0 16px;">Your DopaMine verification code is:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#111827;margin:0 0 16px;font-family:'SF Mono',Menlo,monospace;">${code}</p>
  <p style="font-size:14px;color:#6b7280;margin:0 0 8px;">This code expires in ${env.auth.codeTtlMin} minutes.</p>
  <p style="font-size:14px;color:#6b7280;margin:0 0 16px;">You received this email because someone requested to sign in to DopaMine using this email address.</p>
  <p style="font-size:14px;color:#6b7280;margin:0 0 16px;">If this was not you, you can safely ignore this email.</p>
  <p style="font-size:13px;color:#9ca3af;margin:0;line-height:1.6;">DopaMine<br>aurahk.me<br>support@aurahk.me</p>
</body></html>`,
    tag: "auth-code",
    headers: {
      "X-Entity-Ref-ID": `auth-${email}-${Date.now()}`,
    },
  });
  if (!emailResult.ok) {
    console.error(`Verification email failed for ${email}: ${emailResult.error ?? "unknown error"}`);
    return res.status(502).json({ error: "Verification email could not be sent. Try again later." });
  }

  const expiresAt = new Date(Date.now() + env.auth.codeTtlMin * 60 * 1000).toISOString();
  await saveVerificationCode({
    email,
    codeHash: hashCode(code),
    expiresAt,
    attempts: 0,
    createdAt: new Date().toISOString(),
  });

  res.json({ ok: true, university, emailDelivered: true });
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

  const email = parsed.data.email.toLowerCase();
  const record = await getVerificationCode(email);
  if (!record) return res.status(400).json({ error: "Code not found. Request a new one." });

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: "Code expired. Request a new one." });
  }
  if (record.attempts >= 5) {
    return res.status(429).json({ error: "Too many attempts. Request a new code." });
  }
  record.attempts += 1;

  if (record.codeHash !== hashCode(parsed.data.code)) {
    await saveVerificationCode(record);
    return res.status(400).json({ error: "Wrong code." });
  }

  const domain = email.split("@")[1];
  const university = await getUniversityByEmailDomain(domain);
  if (!university) return res.status(400).json({ error: "University not supported." });

  let user = await getStudentByEmail(email);
  const isNew = !user;

  if (isNew) {
    if (env.auth.inviteRequired && parsed.data.inviteCode) {
      const invite = await getInviteByCode(parsed.data.inviteCode);
      if (!isInviteUsable(invite)) {
        return res.status(400).json({ error: "Invite code is invalid or already used." });
      }
      if (!isInviteValidForUniversity(invite, university.id)) {
        return res.status(400).json({ error: "Invite code is not valid for your university email." });
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
      crossUniOk: true,
      blockedUserIds: [],
      onboardingStage: "basic",
    } satisfies StudentProfile;

    if (env.auth.inviteRequired && parsed.data.inviteCode) {
      const invite = await getInviteByCode(parsed.data.inviteCode);
      if (invite) {
        invite.usedBy = user.id;
        invite.usedAt = new Date().toISOString();
        await saveInvite(invite);
      }
    }
  } else if (user) {
    user.fullName = parsed.data.fullName || user.fullName;
    user.verificationStatus = "verified";
  }

  // Consume the verification code without relying on physical row deletion.
  record.codeHash = "consumed";
  record.expiresAt = new Date(0).toISOString();
  record.attempts = 999;
  await Promise.all([
    saveVerificationCode(record),
    user ? saveStudent(user) : Promise.resolve(),
  ]);

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
  res.header("Content-Disposition", "attachment; filename=dopamine-invites.csv");
  res.send(csv);
});

function csvCell(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
