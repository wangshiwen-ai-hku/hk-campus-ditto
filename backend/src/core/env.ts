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
const adminSecret = str("ADMIN_SECRET", jwtSecret);
const nodeEnv = str("NODE_ENV", "development");
const emailProvider = str("EMAIL_PROVIDER", "console") as "console" | "resend";

if (nodeEnv === "production") {
  if (emailProvider === "console") {
    throw new Error("EMAIL_PROVIDER=console is not allowed in production. Use EMAIL_PROVIDER=resend.");
  }
  if (!str("RESEND_API_KEY", "")) {
    throw new Error("RESEND_API_KEY is required in production.");
  }
  if (jwtSecret === "dev-secret-change-me") {
    throw new Error("JWT_SECRET must be set to a non-default value in production.");
  }
  if (adminSecret === "dev-secret-change-me") {
    throw new Error("ADMIN_SECRET must be set to a non-default value in production.");
  }
}

export const env = {
  nodeEnv,
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
    secret: adminSecret,
  },
  cors: {
    origins: list("CORS_ORIGINS", ["http://localhost:5173", "http://127.0.0.1:5173"]),
  },
  llm: {
    provider: str("LLM_PROVIDER", "gemini") as "gemini" | "mock",
    model: str("LLM_MODEL", "gemini-2.5-flash"),
    apiKey: str("LLM_API_KEY", ""),
    baseUrl: str("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"),
    budgetPerRun: num("LLM_BUDGET_MAX_CALLS_PER_RUN", 200),
  },
  email: {
    provider: emailProvider,
    resendApiKey: str("RESEND_API_KEY", ""),
    from: str("EMAIL_FROM", "DopaMine <support@aurahk.me>"),
    frontendUrl: str("FRONTEND_URL", "http://localhost:5173"),
    apiPublicUrl: str("API_PUBLIC_URL", `http://localhost:${num("PORT", 8787)}`),
  },
  auth: {
    codeTtlMin: num("AUTH_CODE_TTL_MIN", 10),
    codeRateLimitPerHour: num("AUTH_CODE_RATE_LIMIT_PER_HOUR", 5),
    inviteRequired: bool("INVITE_REQUIRED", false),
  },
  scheduler: {
    enabled: bool("SCHEDULER_ENABLED", false),
    trigger: str("SCHEDULER_TRIGGER", "Wednesday 19:00"),
  },
};
