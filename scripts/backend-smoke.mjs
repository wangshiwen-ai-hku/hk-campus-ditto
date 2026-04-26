const API_BASE = process.env.API_BASE ?? "http://localhost:8787/api";
const localBackendEnv = await readEnvFile(new URL("../backend/.env", import.meta.url));
const ADMIN_SECRET =
  process.env.ADMIN_SECRET ??
  localBackendEnv.ADMIN_SECRET ??
  "dev-secret-change-me";

async function readEnvFile(url) {
  try {
    const raw = await import("node:fs/promises").then((fs) => fs.readFile(url, "utf-8"));
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

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.admin ? { "x-admin-secret": ADMIN_SECRET } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${data.error ?? text}`);
  }
  return data;
}

async function login(email, fullName) {
  const codeResult = await request("/auth/request-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!codeResult.devCode) {
    throw new Error("Smoke test needs EMAIL_PROVIDER=console so /auth/request-code returns devCode.");
  }
  return request("/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({ email, fullName, code: codeResult.devCode }),
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log(`Smoke test API: ${API_BASE}`);

await request("/health");
await request("/dev/reset", { method: "POST", admin: true });

const zoe = await login("zoe@link.cuhk.edu.hk", "Zoe Lau");
const ethan = await login("ethan@link.cuhk.edu.hk", "Ethan Ho");

const run = await request("/matches/run", {
  method: "POST",
  admin: true,
  body: JSON.stringify({ useLlmJudge: false, minStructuredScore: 55 }),
});
assert(run.created >= 1, `Expected at least one match, got ${run.created}`);

await request("/workflow/drop", { method: "POST", admin: true });

const current = await request("/matches/current", { token: zoe.token });
const match = current.matchView?.match;
assert(match, "Zoe should have a current match after drop.");
assert(
  [match.userAId, match.userBId].includes(ethan.user.id),
  "Expected seeded CUHK users Zoe and Ethan to match."
);

await request(`/workflow/${match.id}/respond`, {
  method: "POST",
  token: zoe.token,
  body: JSON.stringify({ choice: "yes" }),
});
let accepted = await request(`/workflow/${match.id}/respond`, {
  method: "POST",
  token: ethan.token,
  body: JSON.stringify({ choice: "yes" }),
});
assert(
  ["slot-proposing", "slot-confirmed"].includes(accepted.match.status),
  `Expected slot proposal after mutual accept, got ${accepted.match.status}`
);

const slot = accepted.match.proposedSlots?.[0] ?? accepted.match.overlapSlots?.[0];
assert(slot, "Expected at least one overlapping slot.");

let scheduled = await request(`/workflow/${match.id}/confirm-slot`, {
  method: "POST",
  token: zoe.token,
  body: JSON.stringify({ slot }),
});
assert(scheduled.match.status === "slot-confirmed", `Expected slot-confirmed, got ${scheduled.match.status}`);

scheduled = await request(`/workflow/${match.id}/pick-place`, {
  method: "POST",
  token: zoe.token,
});
assert(scheduled.match.status === "scheduled", `Expected scheduled, got ${scheduled.match.status}`);
assert(scheduled.match.proposedPlace?.name, "Expected a proposed place.");

const happened = await request(`/workflow/${match.id}/mark-happened`, {
  method: "POST",
  token: ethan.token,
});
assert(happened.match.status === "happened", `Expected happened, got ${happened.match.status}`);

await request(`/feedback/${match.id}/submit`, {
  method: "POST",
  token: zoe.token,
  body: JSON.stringify({
    template: "post_date_2h",
    answers: { oneLine: "Warm conversation and good campus coffee.", vibeScore: 8 },
    sentiment: "love",
  }),
});
const feedback = await request(`/feedback/${match.id}/submit`, {
  method: "POST",
  token: ethan.token,
  body: JSON.stringify({
    template: "post_date_2h",
    answers: { oneLine: "Easy timing and thoughtful match.", vibeScore: 8 },
    sentiment: "love",
  }),
});
assert(feedback.match.status === "closed", `Expected closed after both feedback forms, got ${feedback.match.status}`);

const memory = await request("/memory/me", { token: zoe.token });
assert(memory.memory?.userId === zoe.user.id, "Expected Zoe memory snapshot.");

console.log("Backend smoke test passed:");
console.log(`- match=${match.id}`);
console.log(`- slot=${slot}`);
console.log(`- place=${scheduled.match.proposedPlace.name}`);
console.log(`- finalStatus=${feedback.match.status}`);
