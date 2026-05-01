import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { ensureDb, saveDb } from "../db.js";
import { requireAdmin } from "../core/auth-middleware.js";
import { issueToken } from "../auth/jwt.js";
import type { StudentProfile } from "../types.js";
import { matchLabRouter } from "./match-lab.js";

export const devRouter = Router();
devRouter.use("/match-lab", matchLabRouter);

function tokenFor(user: StudentProfile): string {
  return issueToken({ sub: user.id, email: user.email, uni: user.universityId });
}

function publicUser(user: StudentProfile) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    universityId: user.universityId,
    onboardingStage: user.onboardingStage,
    profileComplete: user.profileComplete,
  };
}

devRouter.get("/sessions", requireAdmin, async (_req, res) => {
  const db = await ensureDb();
  res.json({
    ok: true,
    users: db.students.map((user) => {
      const token = tokenFor(user);
      return {
        ...publicUser(user),
        token,
        authorization: `Bearer ${token}`,
      };
    }),
  });
});

devRouter.post("/login-as", requireAdmin, async (req, res) => {
  const schema = z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
  }).refine((body) => body.userId || body.email, "userId or email is required");
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload.", details: parsed.error.flatten() });

  const db = await ensureDb();
  const email = parsed.data.email?.toLowerCase();
  const user = db.students.find((student) => {
    if (parsed.data.userId && student.id === parsed.data.userId) return true;
    if (email && student.email === email) return true;
    return false;
  });
  if (!user) return res.status(404).json({ error: "User not found." });

  const token = tokenFor(user);
  res.json({ ok: true, user, token, authorization: `Bearer ${token}` });
});

devRouter.post("/users", requireAdmin, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    fullName: z.string().min(2),
    universityId: z.string().min(1).default("hku"),
    stage: z.enum(["basic", "life", "mind", "social", "complete"]).default("basic"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload.", details: parsed.error.flatten() });

  const db = await ensureDb();
  const university = db.universities.find((uni) => uni.id === parsed.data.universityId);
  if (!university) return res.status(400).json({ error: "Unknown universityId." });

  const email = parsed.data.email.toLowerCase();
  let user = db.students.find((student) => student.email === email);
  if (!user) {
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
      onboardingStage: parsed.data.stage,
    };
    db.students.unshift(user);
  } else {
    user.fullName = parsed.data.fullName;
    user.universityId = university.id;
    user.onboardingStage = parsed.data.stage;
  }

  await saveDb(db);
  const token = tokenFor(user);
  res.json({ ok: true, user, token, authorization: `Bearer ${token}` });
});
