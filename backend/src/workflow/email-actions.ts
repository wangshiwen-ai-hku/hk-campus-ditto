import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { env } from "../core/env.js";
import type { MatchRecord } from "../types.js";

export type MatchEmailChoice = "yes" | "no";

function signPayload(matchId: string, userId: string, choice: MatchEmailChoice): string {
  return createHmac("sha256", env.jwt.secret)
    .update(`${matchId}:${userId}:${choice}`)
    .digest("hex");
}

function baseActionUrl(matchId: string): URL {
  const baseUrl = env.email.apiPublicUrl.replace(/\/+$/, "");
  return new URL(`/api/workflow/${encodeURIComponent(matchId)}/email-response`, baseUrl);
}

export function ensureMatchEmailAction(
  match: MatchRecord,
  userId: string,
  choice: MatchEmailChoice
): string {
  match.emailActions = match.emailActions ?? [];
  const existing = match.emailActions.find((action) => action.userId === userId && action.choice === choice);
  if (existing) return existing.token;

  const token = randomBytes(24).toString("base64url");
  match.emailActions.push({
    userId,
    choice,
    token,
    createdAt: new Date().toISOString(),
  });
  return token;
}

export function matchEmailActionUrl(match: MatchRecord, userId: string, choice: MatchEmailChoice): string {
  const url = baseActionUrl(match.id);
  url.searchParams.set("userId", userId);
  url.searchParams.set("choice", choice);
  url.searchParams.set("token", ensureMatchEmailAction(match, userId, choice));
  return url.toString();
}

export function verifyStoredMatchEmailAction(
  match: MatchRecord,
  userId: string,
  choice: string | undefined,
  token: string | undefined
): choice is MatchEmailChoice {
  if (choice !== "yes" && choice !== "no") return false;
  if (!token) return false;
  const action = (match.emailActions ?? []).find((item) => item.userId === userId && item.choice === choice);
  if (!action) return false;

  const expected = Buffer.from(action.token);
  const actual = Buffer.from(token);
  if (actual.length !== expected.length) return false;
  const ok = timingSafeEqual(actual, expected);
  if (ok && !action.usedAt) action.usedAt = new Date().toISOString();
  return ok;
}

export function verifySignedMatchEmailAction(
  matchId: string,
  userId: string,
  choice: string | undefined,
  signature: string | undefined
): choice is MatchEmailChoice {
  if (choice !== "yes" && choice !== "no") return false;
  if (!signature) return false;

  const expected = Buffer.from(signPayload(matchId, userId, choice), "hex");
  const actual = Buffer.from(signature, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
