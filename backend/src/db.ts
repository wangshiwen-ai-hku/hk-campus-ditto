import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { Database, InviteCode, MatchRecord, StudentProfile, Survey, University, VerificationCode } from "./types.js";
import { makeSeedDatabase } from "./seed.js";
import { env } from "./core/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "..", "data", "db.json");
const STATE_ID = "main";
const { Pool } = pg;
let pool: pg.Pool | undefined;
let schemaReady: Promise<void> | undefined;

type EntityTable = {
  key: keyof Database;
  table: string;
  idField: string;
};

const ENTITY_TABLES: EntityTable[] = [
  { key: "universities", table: "campus_ditto_universities", idField: "id" },
  { key: "students", table: "campus_ditto_students", idField: "id" },
  { key: "matches", table: "campus_ditto_matches", idField: "id" },
  { key: "verificationCodes", table: "campus_ditto_verification_codes", idField: "email" },
  { key: "inviteCodes", table: "campus_ditto_invite_codes", idField: "code" },
  { key: "surveys", table: "campus_ditto_surveys", idField: "id" },
];

function migrate(db: Partial<Database>): Database {
  const full: Database = {
    universities: db.universities ?? [],
    students: (db.students ?? []).map((s) => ({
      crossUniOk: false,
      blockedUserIds: [],
      onboardingStage: "complete",
      ...s,
    })),
    matches: db.matches ?? [],
    verificationCodes: db.verificationCodes ?? [],
    inviteCodes: db.inviteCodes ?? [],
    surveys: db.surveys ?? [],
  };
  return full;
}

function postgresPool(): pg.Pool {
  if (!env.db.databaseUrl) {
    throw new Error("DATABASE_URL is required when DB_PROVIDER=postgres.");
  }
  pool ??= new Pool({
    connectionString: env.db.databaseUrl,
    ssl: {
      ca: readFileSync(path.join(__dirname, "..", "prod-ca-2021.crt")).toString(),
    },
  });
  return pool;
}

async function ensurePostgresSchema(): Promise<void> {
  schemaReady ??= ensurePostgresSchemaOnce().catch((error) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}

async function ensurePostgresSchemaOnce(): Promise<void> {
  const client = await postgresPool().connect();
  try {
    await client.query("begin");
    await client.query(`
      create table if not exists campus_ditto_state (
        id text primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      )
    `);
    for (const { table } of ENTITY_TABLES) {
      await client.query(`
        create table if not exists ${table} (
          id text primary key,
          data jsonb not null,
          updated_at timestamptz not null default now()
        )
      `);
    }
    await client.query("create unique index if not exists campus_ditto_students_email_idx on campus_ditto_students ((lower(data->>'email')))");
    await client.query("create index if not exists campus_ditto_students_university_idx on campus_ditto_students ((data->>'universityId'))");
    await client.query("create index if not exists campus_ditto_students_profile_complete_idx on campus_ditto_students ((data->>'profileComplete'))");
    await client.query("create index if not exists campus_ditto_matches_user_a_idx on campus_ditto_matches ((data->>'userAId'))");
    await client.query("create index if not exists campus_ditto_matches_user_b_idx on campus_ditto_matches ((data->>'userBId'))");
    await client.query("create index if not exists campus_ditto_matches_status_idx on campus_ditto_matches ((data->>'status'))");
    await client.query("create index if not exists campus_ditto_surveys_user_idx on campus_ditto_surveys ((data->>'userId'))");
    await client.query("create index if not exists campus_ditto_surveys_match_idx on campus_ditto_surveys ((data->>'matchId'))");
    await client.query("create index if not exists campus_ditto_surveys_template_idx on campus_ditto_surveys ((data->>'template'))");
    await client.query("create index if not exists campus_ditto_invites_batch_idx on campus_ditto_invite_codes ((data->>'batch'))");
    await client.query("create index if not exists campus_ditto_invites_university_idx on campus_ditto_invite_codes ((data->>'universityId'))");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function readPostgresEntity<T>(table: string, id: string): Promise<T | undefined> {
  await ensurePostgresSchema();
  const result = await postgresPool().query("select data from " + table + " where id = $1", [id]);
  return result.rows[0]?.data as T | undefined;
}

async function readPostgresEntities<T>(table: string): Promise<T[]> {
  await ensurePostgresSchema();
  const result = await postgresPool().query("select data from " + table + " order by updated_at asc");
  return result.rows.map((row) => row.data as T);
}

async function readPostgresEntitiesByJsonField<T>(table: string, field: string, value: string): Promise<T[]> {
  await ensurePostgresSchema();
  const result = await postgresPool().query(
    "select data from " + table + " where jsonb_extract_path_text(data, $1) = $2 order by updated_at asc",
    [field, value]
  );
  return result.rows.map((row) => row.data as T);
}

async function upsertPostgresEntity(table: string, id: string, data: unknown): Promise<void> {
  await ensurePostgresSchema();
  await postgresPool().query(
    `
      insert into ${table} (id, data, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (id)
      do update set data = excluded.data, updated_at = now()
    `,
    [id, JSON.stringify(data)]
  );
}

async function ensureFileDb(): Promise<Database> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return migrate(JSON.parse(raw));
  } catch {
    const db = makeSeedDatabase();
    await saveDb(db);
    return db;
  }
}

async function ensurePostgresDb(): Promise<Database> {
  await ensurePostgresSchema();
  const existingRows = await countPostgresEntityRows();
  if (existingRows === 0) {
    const legacy = await postgresPool().query("select data from campus_ditto_state where id = $1", [STATE_ID]);
    if (legacy.rows[0]?.data) {
      const db = migrate(legacy.rows[0].data);
      await replacePostgresDb(db);
      return db;
    }

    const db = makeSeedDatabase();
    await replacePostgresDb(db);
    return db;
  }

  return readPostgresDb();
}

async function countPostgresEntityRows(): Promise<number> {
  const result = await postgresPool().query(
    ENTITY_TABLES.map(({ table }, index) => `(select count(*)::int as count from ${table})`).join(" union all ")
  );
  return result.rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
}

async function readPostgresDb(): Promise<Database> {
  const pool = postgresPool();
  const entries = await Promise.all(
    ENTITY_TABLES.map(async ({ key, table }) => {
      const result = await pool.query("select data from " + table + " order by updated_at asc");
      return [key, result.rows.map((row) => row.data)] as const;
    })
  );
  return migrate(Object.fromEntries(entries) as Partial<Database>);
}

function entityId(row: unknown, idField: string): string {
  if (typeof row !== "object" || row === null) {
    throw new Error(`Invalid database row for ${idField}.`);
  }
  const value = (row as Record<string, unknown>)[idField];
  if (typeof value !== "string" || !value) {
    throw new Error(`Invalid or missing database row id field: ${idField}.`);
  }
  return value;
}

async function upsertEntityRows(client: pg.PoolClient, db: Database): Promise<void> {
  for (const { key, table, idField } of ENTITY_TABLES) {
    for (const item of db[key] as unknown[]) {
      await client.query(
        `
          insert into ${table} (id, data, updated_at)
          values ($1, $2::jsonb, now())
          on conflict (id)
          do update set data = excluded.data, updated_at = now()
        `,
        [entityId(item, idField), JSON.stringify(item)]
      );
    }
  }
}

async function savePostgresDb(db: Database): Promise<void> {
  await ensurePostgresSchema();
  const client = await postgresPool().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('campus_ditto_db_save'))");
    await upsertEntityRows(client, db);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function replacePostgresDb(db: Database): Promise<void> {
  await ensurePostgresSchema();
  const client = await postgresPool().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('campus_ditto_db_save'))");
    for (const { table } of ENTITY_TABLES) {
      await client.query(`truncate table ${table}`);
    }
    await upsertEntityRows(client, db);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureDb(): Promise<Database> {
  if (env.db.provider === "postgres") return ensurePostgresDb();
  return ensureFileDb();
}

export async function getStudentById(userId: string): Promise<StudentProfile | undefined> {
  if (env.db.provider === "postgres") {
    const student = await readPostgresEntity<StudentProfile>("campus_ditto_students", userId);
    return student ? migrate({ students: [student] }).students[0] : undefined;
  }
  const db = await ensureFileDb();
  return db.students.find((s) => s.id === userId);
}

export async function getStudentByEmail(email: string): Promise<StudentProfile | undefined> {
  const normalized = email.toLowerCase();
  if (env.db.provider === "postgres") {
    await ensurePostgresSchema();
    const result = await postgresPool().query(
      "select data from campus_ditto_students where lower(data->>'email') = $1 limit 1",
      [normalized]
    );
    const student = result.rows[0]?.data as StudentProfile | undefined;
    return student ? migrate({ students: [student] }).students[0] : undefined;
  }
  const db = await ensureFileDb();
  return db.students.find((s) => s.email.toLowerCase() === normalized);
}

export async function getUniversityById(id: string): Promise<University | undefined> {
  if (env.db.provider === "postgres") {
    return readPostgresEntity<University>("campus_ditto_universities", id);
  }
  const db = await ensureFileDb();
  return db.universities.find((uni) => uni.id === id);
}

export async function saveStudent(user: StudentProfile): Promise<void> {
  if (env.db.provider === "postgres") {
    await upsertPostgresEntity("campus_ditto_students", user.id, user);
    return;
  }
  const db = await ensureFileDb();
  const index = db.students.findIndex((s) => s.id === user.id);
  if (index >= 0) db.students[index] = user;
  else db.students.unshift(user);
  await saveFileDb(db);
}

export async function getSurveysForUser(userId: string): Promise<Survey[]> {
  if (env.db.provider === "postgres") {
    return readPostgresEntitiesByJsonField<Survey>("campus_ditto_surveys", "userId", userId);
  }
  const db = await ensureFileDb();
  return db.surveys.filter((survey) => survey.userId === userId);
}

export async function getMatchesForUser(userId: string): Promise<MatchRecord[]> {
  if (env.db.provider === "postgres") {
    await ensurePostgresSchema();
    const result = await postgresPool().query(
      `
        select data from campus_ditto_matches
        where data->>'userAId' = $1 or data->>'userBId' = $1
        order by data->>'createdAt' desc
      `,
      [userId]
    );
    return result.rows.map((row) => row.data as MatchRecord);
  }
  const db = await ensureFileDb();
  return db.matches
    .filter((match) => match.userAId === userId || match.userBId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getUniversityByEmailDomain(domain: string): Promise<University | undefined> {
  if (env.db.provider === "postgres") {
    const universities = await readPostgresEntities<University>("campus_ditto_universities");
    return universities.find((uni) => uni.domains.includes(domain));
  }
  const db = await ensureFileDb();
  return db.universities.find((uni) => uni.domains.includes(domain));
}

export async function getVerificationCode(email: string): Promise<VerificationCode | undefined> {
  if (env.db.provider === "postgres") {
    return readPostgresEntity<VerificationCode>("campus_ditto_verification_codes", email.toLowerCase());
  }
  const db = await ensureFileDb();
  return db.verificationCodes.find((code) => code.email === email.toLowerCase());
}

export async function saveVerificationCode(code: VerificationCode): Promise<void> {
  const normalized = { ...code, email: code.email.toLowerCase() };
  if (env.db.provider === "postgres") {
    await upsertPostgresEntity("campus_ditto_verification_codes", normalized.email, normalized);
    return;
  }
  const db = await ensureFileDb();
  db.verificationCodes = db.verificationCodes.filter((item) => item.email !== normalized.email);
  db.verificationCodes.push(normalized);
  await saveFileDb(db);
}

export async function getInviteByCode(code: string): Promise<InviteCode | undefined> {
  const normalized = code.trim();
  if (env.db.provider === "postgres") {
    return readPostgresEntity<InviteCode>("campus_ditto_invite_codes", normalized);
  }
  const db = await ensureFileDb();
  return db.inviteCodes.find((invite) => invite.code === normalized);
}

export async function saveInvite(invite: InviteCode): Promise<void> {
  if (env.db.provider === "postgres") {
    await upsertPostgresEntity("campus_ditto_invite_codes", invite.code, invite);
    return;
  }
  const db = await ensureFileDb();
  const index = db.inviteCodes.findIndex((item) => item.code === invite.code);
  if (index >= 0) db.inviteCodes[index] = invite;
  else db.inviteCodes.push(invite);
  await saveFileDb(db);
}

export async function saveSurvey(survey: Survey): Promise<void> {
  if (env.db.provider === "postgres") {
    await upsertPostgresEntity("campus_ditto_surveys", survey.id, survey);
    return;
  }
  const db = await ensureFileDb();
  const index = db.surveys.findIndex((item) => item.id === survey.id);
  if (index >= 0) db.surveys[index] = survey;
  else db.surveys.push(survey);
  await saveFileDb(db);
}

async function saveFileDb(db: Database): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export async function saveDb(db: Database): Promise<void> {
  if (env.db.provider === "postgres") return savePostgresDb(db);
  return saveFileDb(db);
}

export async function resetDb(): Promise<Database> {
  const db = makeSeedDatabase();
  if (env.db.provider === "postgres") {
    await replacePostgresDb(db);
  } else {
    await saveFileDb(db);
  }
  return db;
}
