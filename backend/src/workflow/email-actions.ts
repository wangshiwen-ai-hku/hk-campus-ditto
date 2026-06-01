import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../core/env.js";

export type MatchEmailChoice = "yes" | "no";

function signPayload(matchId: string, userId: string, choice: MatchEmailChoice): string {
  return createHmac("sha256", env.jwt.secret)
    .update(`${matchId}:${userId}:${choice}`)
    .digest("hex");
}

export function matchEmailActionUrl(matchId: string, userId: string, choice: MatchEmailChoice): string {
  const baseUrl = env.email.apiPublicUrl.replace(/\/+$/, "");
  const url = new URL(`/api/workflow/${encodeURIComponent(matchId)}/email-response`, baseUrl);
  url.searchParams.set("userId", userId);
  url.searchParams.set("choice", choice);
  url.searchParams.set("sig", signPayload(matchId, userId, choice));
  return url.toString();
}

export function verifyMatchEmailAction(
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
