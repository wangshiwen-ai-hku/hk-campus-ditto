import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { env } from "../core/env.js";
import type { MatchRecord } from "../types.js";

export type MatchEmailChoice = "yes" | "no";

function actionPayload(matchId: string, userId: string, choice: MatchEmailChoice) {
  return `${matchId}:${userId}:${choice}`;
}

export function signMatchEmailAction(matchId: string, userId: string, choice: MatchEmailChoice): string {
  return createHmac("sha256", env.jwt.secret)
    .update(actionPayload(matchId, userId, choice))
    .digest("hex");
}

export function verifySignedMatchEmailAction(
  matchId: string,
  userId: string,
  choice: MatchEmailChoice,
  sig: string
): boolean {
  const expected = signMatchEmailAction(matchId, userId, choice);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(sig, "hex");
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function ensureMatchEmailAction(match: MatchRecord, userId: string, choice: MatchEmailChoice): string {
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

export function verifyStoredMatchEmailAction(
  match: MatchRecord,
  userId: string,
  choice: MatchEmailChoice,
  token: string
): boolean {
  const action = (match.emailActions ?? []).find((item) => item.userId === userId && item.choice === choice);
  if (!action) return false;

  const expected = Buffer.from(action.token);
  const actual = Buffer.from(token);
  if (actual.length !== expected.length) return false;
  const ok = timingSafeEqual(actual, expected);
  if (ok && !action.usedAt) action.usedAt = new Date().toISOString();
  return ok;
}

export function matchEmailActionUrl(match: MatchRecord, userId: string, choice: MatchEmailChoice): string {
  const params = new URLSearchParams({
    userId,
    choice,
    token: ensureMatchEmailAction(match, userId, choice),
  });
  return `${env.email.apiPublicUrl}/api/workflow/${encodeURIComponent(match.id)}/email-response?${params.toString()}`;
}
