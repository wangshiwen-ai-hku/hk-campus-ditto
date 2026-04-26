import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../core/env.js";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: object): string {
  const header = { alg: "HS256", typ: "JWT" };
  const headerEncoded = b64url(JSON.stringify(header));
  const payloadEncoded = b64url(JSON.stringify(payload));
  const data = `${headerEncoded}.${payloadEncoded}`;
  const sig = createHmac("sha256", env.jwt.secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  uni: string; // university id
  iat: number;
  exp: number;
}

export function issueToken(input: { sub: string; email: string; uni: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: input.sub,
    email: input.email,
    uni: input.uni,
    iat: now,
    exp: now + env.jwt.ttlDays * 24 * 60 * 60,
  };
  return sign(payload);
}

export function verifyToken(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerEncoded, payloadEncoded, sig] = parts;
  const data = `${headerEncoded}.${payloadEncoded}`;
  const expected = createHmac("sha256", env.jwt.secret).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadEncoded, "base64url").toString()) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
