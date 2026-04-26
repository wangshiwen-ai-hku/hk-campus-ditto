import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../auth/jwt.js";
import { env } from "./env.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing bearer token." });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token." });
  req.auth = payload;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.auth = payload;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.header("x-admin-secret") ?? "";
  if (!env.admin.secret || secret !== env.admin.secret) {
    return res.status(403).json({ error: "Admin secret is missing or invalid." });
  }
  next();
}
