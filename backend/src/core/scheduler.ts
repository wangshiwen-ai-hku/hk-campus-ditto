import { ensureDb, saveDb, runInLock } from "../db.js";
import { runWeeklyMatchmaking } from "../matching/ranker.js";
import { notify } from "../notify/index.js";
import { transition } from "../workflow/state-machine.js";
import { env } from "./env.js";

let lastRunKey = "";

export function startScheduler() {
  const enabled = env.scheduler.enabled;
  if (!enabled) {
    console.log("[Scheduler] Disabled by configuration.");
    return;
  }

  const triggerConfig = env.scheduler.trigger;
  console.log(`[Scheduler] Started. Configured trigger: "${triggerConfig}"`);

  // Check every 10 seconds
  setInterval(async () => {
    try {
      const now = new Date();
      
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Hong_Kong",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      });
      const timeParts = formatter.formatToParts(now);
      const partMap = Object.fromEntries(timeParts.map(p => [p.type, p.value]));

      const currentDay = partMap.weekday ?? ""; // e.g. "Sunday"
      const currentHour = partMap.hour ?? ""; // e.g. "12"
      const currentMinute = partMap.minute ?? ""; // e.g. "46"
      const currentTimeStr = `${currentHour}:${currentMinute}`;



      // Parse triggerConfig
      // format can be: "Wednesday 19:00" or just "19:00"
      const parts = triggerConfig.trim().split(/\s+/);
      let targetDay: string | null = null;
      let targetTime = "";
      if (parts.length === 2) {
        targetDay = parts[0];
        targetTime = parts[1];
      } else {
        targetTime = parts[0];
      }

      // Check if match
      const dayMatches = !targetDay || targetDay.toLowerCase() === currentDay.toLowerCase();
      const timeMatches = targetTime === currentTimeStr;

      if (now.getSeconds() < 10) {
        console.log(`[Scheduler] Checking current time: "${currentDay} ${currentTimeStr}" (Target: "${triggerConfig}")`);
      }

      if (dayMatches && timeMatches) {
        const runKey = `${currentDay}-${currentTimeStr}`;
        if (lastRunKey !== runKey) {
          lastRunKey = runKey;
          console.log(`[Scheduler] Trigger condition met (${runKey}). Running weekly match and drop...`);
          await executeMatchAndDrop();
        }
      }
    } catch (err) {
      console.error("[Scheduler] Error in scheduler loop:", err);
    }
  }, 10000);
}

async function executeMatchAndDrop() {
  await runInLock("matchmaking_run", async () => {
    console.log("[Scheduler] Starting automatic matchmaking...");
    try {
      const db = await ensureDb();

      // Prevent duplicate runs in multi-node clusters (Fly.io)
      const now = new Date();
      const twoMinutesAgo = now.getTime() - 2 * 60 * 1000;
      const hasRecentMatch = db.matches.some(
        (m) => new Date(m.createdAt).getTime() > twoMinutesAgo
      );

      if (hasRecentMatch) {
        console.log("[Scheduler] Matchmaking was already executed recently by another cluster node. Skipping duplicate run.");
        return;
      }

      // 1. Run matchmaking
      const matchResult = await runWeeklyMatchmaking(db, {
        useLlmJudge: env.llm.provider !== "mock",
      });
      console.log(`[Scheduler] Matchmaking complete. Created ${matchResult.created.length} matches, skipped ${matchResult.skippedNoCandidate.length} users.`);

      // 2. Run drop workflow (send emails)
      const dropped: string[] = [];
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      for (const match of db.matches) {
        if (match.status !== "pending") continue;
        const a = db.students.find((s) => s.id === match.userAId);
        const b = db.students.find((s) => s.id === match.userBId);
        if (!a || !b) continue;

        console.log(`[Scheduler] Sending drop emails for match ${match.id} (between ${a.email} and ${b.email})`);
        try {
          await notify(a, "match_drop", { match, partner: b });
          await sleep(600); // stay under Resend's 2 req/sec limit
          await notify(b, "match_drop", { match, partner: a });
          await sleep(600);
          transition(match, "notified", { dropAt: new Date().toISOString() });
          transition(match, "awaiting-acceptance");
          dropped.push(match.id);
        } catch (emailErr) {
          console.error(`[Scheduler] Failed to send email for match ${match.id}:`, emailErr);
        }
      }

      await saveDb(db);
      console.log(`[Scheduler] Drop notifications sent for ${dropped.length} matches.`);
    } catch (err) {
      console.error("[Scheduler] Failed during matchmaking/drop execution:", err);
    }
  });
}
