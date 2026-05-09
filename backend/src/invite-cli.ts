import { ensureDb, saveDb } from "./db.js";
import { findInvite, generateInvites, inviteStats } from "./auth/invite.js";

interface CliArgs {
  _: string[];
  [key: string]: string | string[];
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] ?? "list";

if (command === "list") {
  const db = await ensureDb();
  const universityId = arg(args, "universityId");
  const batch = arg(args, "batch");
  const invites = db.inviteCodes.filter((invite) => {
    if (universityId && invite.universityId !== universityId) return false;
    if (batch && invite.batch !== batch) return false;
    return true;
  });
  console.log(JSON.stringify({
    stats: inviteStats(db),
    invites: invites.map((invite) => ({
      code: invite.code,
      universityId: invite.universityId ?? null,
      batch: invite.batch ?? null,
      note: invite.note ?? null,
      createdAt: invite.createdAt,
      usedBy: invite.usedBy ?? null,
      usedAt: invite.usedAt ?? null,
    })),
  }, null, 2));
} else if (command === "generate") {
  const planArg = arg(args, "plan");
  const countArg = arg(args, "count");
  if (planArg && countArg) {
    throw new Error("Use either --plan for university-specific invites or --count for general invites, not both.");
  }
  if (!planArg && !countArg) {
    throw new Error("Missing invite quantity. Use --plan=hku=10,cuhk=10 or --count=20.");
  }
  const batch = arg(args, "batch") ?? `manual-${new Date().toISOString().slice(0, 10)}`;
  const note = arg(args, "note") ?? "manual beta invite";
  const db = await ensureDb();
  const created = [];
  if (countArg) {
    const count = parseCount(countArg);
    created.push(...generateInvites(db, {
      count,
      batch,
      note,
    }));
  } else {
    const plan = parsePlan(planArg);
    for (const [universityId, count] of Object.entries(plan)) {
      if (!db.universities.some((u) => u.id === universityId)) {
        throw new Error(`Unknown universityId: ${universityId}`);
      }
      created.push(...generateInvites(db, {
        universityId,
        count,
        batch,
        note: `${note} / ${universityId}`,
      }));
    }
  }
  await saveDb(db);
  console.log(JSON.stringify({
    created,
    stats: inviteStats(db),
  }, null, 2));
} else if (command === "mark-used") {
  const code = required(arg(args, "code"), "Missing --code");
  const userId = arg(args, "userId") ?? "manual-used";
  const db = await ensureDb();
  const invite = findInvite(db, code);
  if (!invite) throw new Error(`Invite not found: ${code}`);
  invite.usedBy = userId;
  invite.usedAt = arg(args, "usedAt") ?? new Date().toISOString();
  await saveDb(db);
  console.log(JSON.stringify({ ok: true, invite }, null, 2));
} else if (command === "mark-unused") {
  const code = required(arg(args, "code"), "Missing --code");
  const db = await ensureDb();
  const invite = findInvite(db, code);
  if (!invite) throw new Error(`Invite not found: ${code}`);
  delete invite.usedBy;
  delete invite.usedAt;
  await saveDb(db);
  console.log(JSON.stringify({ ok: true, invite }, null, 2));
} else {
  throw new Error(`Unknown command: ${command}

Usage:
  npm --prefix backend run invites -- list [--universityId=hku] [--batch=beta-001]
  npm --prefix backend run invites -- generate --plan=hku=10,cuhk=10 --batch=beta-001 --note="first beta batch"
  npm --prefix backend run invites -- generate --count=20 --batch=general-001 --note="general beta invites"
  npm --prefix backend run invites -- mark-used --code=DITTO-HKU-ABCD-2345 --userId=user-id
  npm --prefix backend run invites -- mark-unused --code=DITTO-HKU-ABCD-2345`);
}

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = { _: [] };
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }
    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.join("=") || "true";
  }
  return parsed;
}

function arg(args: CliArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

function parsePlan(value: string | undefined): Record<string, number> {
  if (!value) throw new Error("Missing --plan. Example: --plan=hku=10,cuhk=10");
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

function parseCount(value: string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`Invalid --count: ${value}`);
  }
  return count;
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}
