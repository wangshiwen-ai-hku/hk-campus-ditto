import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  })
);

const localBackendEnv = await readEnvFile(new URL("../backend/.env", import.meta.url));
const apiBase = args.api ?? process.env.API_BASE ?? "http://localhost:8787/api";
const adminSecret =
  args.adminSecret ??
  process.env.ADMIN_SECRET ??
  localBackendEnv.ADMIN_SECRET ??
  "dev-secret-change-me";
const batch = args.batch ?? `manual-${new Date().toISOString().slice(0, 10)}`;
const note = args.note ?? "manual beta invite";
const out = args.out ?? `tmp/invites-${batch}.csv`;
const plan = parsePlan(String(args.plan ?? ""));

if (!adminSecret) {
  throw new Error("Missing ADMIN_SECRET. Pass --adminSecret=... or set it in backend/.env.");
}
if (!Object.keys(plan).length) {
  throw new Error("Missing --plan. Example: --plan=hku=100,cuhk=80,hkust=80");
}

const created = [];
for (const [universityId, count] of Object.entries(plan)) {
  const result = await request("/auth/invites/generate", {
    method: "POST",
    body: JSON.stringify({
      universityId,
      count,
      batch,
      note: `${note} / ${universityId}`,
    }),
  });
  created.push(...result.invites);
  console.log(`Generated ${result.count} invite(s) for ${universityId}`);
}

const csv = toCsv(created);
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, csv, "utf-8");
console.log(`Wrote ${created.length} invite(s) to ${out}`);

async function request(endpoint, options) {
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": adminSecret,
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${endpoint} failed: ${response.status} ${data.error ?? "Request failed"}`);
  }
  return data;
}

function parsePlan(value) {
  return Object.fromEntries(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [universityId, countRaw] = part.split("=");
        const count = Number(countRaw);
        if (!universityId || !Number.isInteger(count) || count <= 0) {
          throw new Error(`Invalid plan item: ${part}`);
        }
        return [universityId, count];
      })
  );
}

function toCsv(invites) {
  const header = ["code", "universityId", "batch", "note", "createdAt"];
  return [
    header.join(","),
    ...invites.map((invite) => header.map((key) => csvCell(String(invite[key] ?? ""))).join(",")),
  ].join("\n");
}

function csvCell(value) {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

async function readEnvFile(url) {
  try {
    const raw = await readFile(url, "utf-8");
    return Object.fromEntries(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          const key = line.slice(0, index).trim();
          const value = line.slice(index + 1).trim().replace(/^"|"$/g, "");
          return [key, value];
        })
    );
  } catch {
    return {};
  }
}
