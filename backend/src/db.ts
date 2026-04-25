import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "./types.js";
import { makeSeedDatabase } from "./seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "..", "data", "db.json");

export async function ensureDb(): Promise<Database> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw) as Database;
  } catch {
    const db = makeSeedDatabase();
    await saveDb(db);
    return db;
  }
}

export async function saveDb(db: Database): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export async function resetDb(): Promise<Database> {
  const db = makeSeedDatabase();
  await saveDb(db);
  return db;
}
