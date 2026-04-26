import "dotenv/config";

function str(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}
function num(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? Number(v) : fallback;
}
function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

function list(name: string, fallback: string[]): string[] {
  const v = process.env[name];
  if (!v) return fallback;
  return v.split(",").map((x) => x.trim()).filter(Boolean);
}

const jwtSecret = str("JWT_SECRET", "dev-secret-change-me");

export const env = {
  nodeEnv: str("NODE_ENV", "development"),
  port: num("PORT", 8787),
  db: {
    provider: str("DB_PROVIDER", "file") as "file" | "postgres",
    databaseUrl: str("DATABASE_URL", ""),
  },
  jwt: {
    secret: jwtSecret,
    ttlDays: num("JWT_TTL_DAYS", 14),
  },
  admin: {
    secret: str("ADMIN_SECRET", jwtSecret),
  },
  cors: {
    origins: list("CORS_ORIGINS", ["http://localhost:5173", "http://127.0.0.1:5173"]),
  },
  llm: {
    provider: str("LLM_PROVIDER", "gemini") as "gemini" | "mock",
    model: str("LLM_MODEL", "gemini-3-flash"),
    apiKey: str("LLM_API_KEY", ""),
    baseUrl: str("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"),
    budgetPerRun: num("LLM_BUDGET_MAX_CALLS_PER_RUN", 200),
  },
  email: {
    provider: str("EMAIL_PROVIDER", "console") as "console" | "resend",
    resendApiKey: str("RESEND_API_KEY", ""),
    from: str("EMAIL_FROM", "Campus Ditto <noreply@campusditto.hk>"),
  },
  auth: {
    codeTtlMin: num("AUTH_CODE_TTL_MIN", 10),
    codeRateLimitPerHour: num("AUTH_CODE_RATE_LIMIT_PER_HOUR", 5),
    inviteRequired: bool("INVITE_REQUIRED", true),
  },
};
