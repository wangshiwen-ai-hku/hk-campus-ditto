import express from "express";
import cors from "cors";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { ensureDb, resetDb, saveDb } from "./db.js";
import type { StudentProfile } from "./types.js";
import { buildMatchView, findUniversity, recomputeSchedule, runWeeklyMatchmaking } from "./matchmaking.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json());

function nextWednesdayAt7pm() {
  const date = new Date();
  const day = date.getDay();
  const diff = (3 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  date.setHours(19, 0, 0, 0);
  return date.toISOString();
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/meta", async (_req, res) => {
  const db = await ensureDb();
  res.json({
    universities: db.universities,
    nextDrop: nextWednesdayAt7pm(),
    stats: {
      students: db.students.length,
      activeMatches: db.matches.filter((m) => ["pending", "awaiting-availability", "scheduled"].includes(m.status)).length,
      scheduledDates: db.matches.filter((m) => m.status === "scheduled").length
    },
    demoAccounts: db.students.slice(0, 6).map((student) => ({
      id: student.id,
      fullName: student.fullName,
      email: student.email,
      universityId: student.universityId
    }))
  });
});

app.post("/api/dev/reset", async (_req, res) => {
  const db = await resetDb();
  res.json({ ok: true, students: db.students.length });
});

app.post("/api/auth/request-code", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email." });

  const db = await ensureDb();
  const email = parsed.data.email.toLowerCase();
  const domain = email.split("@")[1];
  const university = db.universities.find((uni) => uni.domains.includes(domain));
  if (!university) return res.status(400).json({ error: "Email domain is not from a supported Hong Kong university." });

  const code = "246810";
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.verificationCodes = db.verificationCodes.filter((item) => item.email !== email);
  db.verificationCodes.push({ email, code, expiresAt });
  await saveDb(db);

  res.json({ ok: true, university, devCode: code });
});

app.post("/api/auth/verify-code", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    code: z.string().min(4),
    fullName: z.string().min(2)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid verification payload." });

  const db = await ensureDb();
  const email = parsed.data.email.toLowerCase();
  const record = db.verificationCodes.find((item) => item.email === email && item.code === parsed.data.code);
  if (!record) return res.status(400).json({ error: "Code is invalid for demo verification." });

  const domain = email.split("@")[1];
  const university = db.universities.find((uni) => uni.domains.includes(domain));
  if (!university) return res.status(400).json({ error: "University not supported." });

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
      profileComplete: false
    } satisfies StudentProfile;
    db.students.unshift(user);
  } else {
    user.fullName = parsed.data.fullName || user.fullName;
    user.verificationStatus = "verified";
  }

  await saveDb(db);
  res.json({ ok: true, user });
});

app.get("/api/profile/:userId", async (req, res) => {
  const db = await ensureDb();
  const user = db.students.find((student) => student.id === req.params.userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json(user);
});

app.post("/api/profile", async (req, res) => {
  const schema = z.object({
    id: z.string(),
    fullName: z.string().min(2),
    universityId: z.string(),
    yearOfStudy: z.string(),
    major: z.string(),
    gender: z.string(),
    seeking: z.string(),
    bio: z.string(),
    languages: z.array(z.string()),
    interests: z.array(z.string()),
    vibeTags: z.array(z.string()),
    dealBreakers: z.array(z.string()).default([]),
    optedIn: z.boolean().default(true),
    availability: z.array(z.string()).default([])
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Profile payload invalid.", details: parsed.error.flatten() });

  const db = await ensureDb();
  const user = db.students.find((student) => student.id === parsed.data.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  Object.assign(user, parsed.data);
  user.profileComplete = Boolean(user.fullName && user.major && user.yearOfStudy && user.bio && user.languages.length && user.interests.length && user.vibeTags.length);

  await saveDb(db);
  res.json({ ok: true, user });
});

app.post("/api/availability", async (req, res) => {
  const schema = z.object({ userId: z.string(), availability: z.array(z.string()) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid availability payload." });

  const db = await ensureDb();
  const user = db.students.find((student) => student.id === parsed.data.userId);
  if (!user) return res.status(404).json({ error: "User not found." });

  user.availability = parsed.data.availability;
  const view = buildMatchView(db, user.id);
  if (view) {
    const partner = db.students.find((student) => student.id === view.partner.id);
    if (partner) recomputeSchedule(view.match, user, partner);
  }

  await saveDb(db);
  res.json({ ok: true, user, matchView: buildMatchView(db, user.id) });
});

app.get("/api/matches/user/:userId/current", async (req, res) => {
  const db = await ensureDb();
  const view = buildMatchView(db, req.params.userId);
  if (!view) return res.json({ matchView: null });
  const currentUser = db.students.find((student) => student.id === req.params.userId);
  const university = currentUser ? findUniversity(db, currentUser.universityId) : undefined;
  res.json({ matchView: { ...view, university } });
});

app.post("/api/matches/run", async (_req, res) => {
  const db = await ensureDb();
  const created = runWeeklyMatchmaking(db);
  await saveDb(db);
  res.json({ ok: true, created });
});

app.post("/api/matches/:matchId/feedback", async (req, res) => {
  const schema = z.object({
    userId: z.string(),
    sentiment: z.enum(["love", "pass", "rematch"]),
    notes: z.string().default("")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid feedback payload." });

  const db = await ensureDb();
  const match = db.matches.find((item) => item.id === req.params.matchId);
  if (!match) return res.status(404).json({ error: "Match not found." });

  match.feedback.push({
    userId: parsed.data.userId,
    sentiment: parsed.data.sentiment,
    notes: parsed.data.notes,
    at: new Date().toISOString()
  });
  
  if (parsed.data.sentiment === "pass" || parsed.data.sentiment === "rematch") {
    match.status = "rematch-requested";
    // Attempt instant rematch for demo purposes
    runWeeklyMatchmaking(db); 
  }

  await saveDb(db);
  res.json({ ok: true, match, matchView: buildMatchView(db, parsed.data.userId) });
});

app.get("/api/admin/overview", async (_req, res) => {
  const db = await ensureDb();
  const universityMap = Object.fromEntries(db.universities.map((uni) => [uni.id, uni.shortName]));
  res.json({
    stats: {
      students: db.students.length,
      completedProfiles: db.students.filter((item) => item.profileComplete).length,
      scheduledDates: db.matches.filter((item) => item.status === "scheduled").length,
      rematchFlags: db.matches.filter((item) => item.status === "rematch-requested").length
    },
    students: db.students.map((student) => ({ ...student, universityLabel: universityMap[student.universityId] ?? student.universityId })),
    matches: db.matches.map((match) => ({
      ...match,
      userALabel: db.students.find((student) => student.id === match.userAId)?.fullName ?? match.userAId,
      userBLabel: db.students.find((student) => student.id === match.userBId)?.fullName ?? match.userBId
    }))
  });
});

app.listen(port, () => {
  console.log(`Campus Ditto HK API listening on http://localhost:${port}`);
});
