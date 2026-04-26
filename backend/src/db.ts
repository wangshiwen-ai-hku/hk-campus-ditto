import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { Database } from "./types.js";
import { makeSeedDatabase } from "./seed.js";
import { env } from "./core/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "..", "data", "db.json");
const STATE_ID = "main";
const { Pool } = pg;
let pool: pg.Pool | undefined;

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
  await postgresPool().query(`
    create table if not exists campus_ditto_state (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
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
  const result = await postgresPool().query("select data from campus_ditto_state where id = $1", [STATE_ID]);
  if (result.rows[0]?.data) return migrate(result.rows[0].data);
  const db = makeSeedDatabase();
  await savePostgresDb(db);
  return db;
}

export async function ensureDb(): Promise<Database> {
  if (env.db.provider === "postgres") return ensurePostgresDb();
  return ensureFileDb();
}

async function saveFileDb(db: Database): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

async function savePostgresDb(db: Database): Promise<void> {
  await ensurePostgresSchema();
  await postgresPool().query(
    `
      insert into campus_ditto_state (id, data, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (id)
      do update set data = excluded.data, updated_at = now()
    `,
    [STATE_ID, JSON.stringify(db)]
  );
}

export async function saveDb(db: Database): Promise<void> {
  if (env.db.provider === "postgres") return savePostgresDb(db);
  return saveFileDb(db);
}

export async function resetDb(): Promise<Database> {
  const db = makeSeedDatabase();
  await saveDb(db);
  return db;
}
