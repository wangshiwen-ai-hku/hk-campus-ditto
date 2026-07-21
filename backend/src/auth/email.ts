import { env } from "../core/env.js";
import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /**
   * Reply-To header. Defaults to env.email.replyTo. Set explicitly to override.
   */
  replyTo?: string;
  /**
   * Extra headers (e.g. List-Unsubscribe). Forwarded by the selected provider.
   */
  headers?: Record<string, string>;
  /**
   * Category used for provider tracking and application logs.
   */
  tag?: string;
}

async function sendViaResend(msg: EmailMessage): Promise<{ ok: boolean; error?: string }> {
  if (!env.email.resendApiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const payload: Record<string, unknown> = {
    from: env.email.from,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    reply_to: msg.replyTo ?? env.email.replyTo,
  };
  if (msg.headers && Object.keys(msg.headers).length > 0) {
    payload.headers = msg.headers;
  }
  if (msg.tag) {
    payload.tags = [{ name: "category", value: msg.tag }];
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.email.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.text().catch(() => "");
  console.log(`[email:resend] to=${msg.to} subject="${msg.subject}" tag=${msg.tag ?? "-"} status=${res.status} body=${body.slice(0, 300)}`);
  if (!res.ok) {
    return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true };
}

let smtpTransport: ReturnType<typeof nodemailer.createTransport> | undefined;

async function sendViaSmtp(msg: EmailMessage): Promise<{ ok: boolean; error?: string }> {
  const { host, port, secure, user, password } = env.email.smtp;
  if (!host || !user || !password) {
    return { ok: false, error: "SMTP_HOST, SMTP_USER or SMTP_PASSWORD not set" };
  }

  smtpTransport ??= nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    const info = await smtpTransport.sendMail({
      from: env.email.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      replyTo: msg.replyTo ?? env.email.replyTo,
      headers: msg.headers,
    });
    console.log(`[email:smtp] to=${msg.to} subject="${msg.subject}" tag=${msg.tag ?? "-"} messageId=${info.messageId}`);
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[email:smtp] to=${msg.to} subject="${msg.subject}" tag=${msg.tag ?? "-"} error=${detail}`);
    return { ok: false, error: `SMTP: ${detail}` };
  }
}

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; provider: string; error?: string }> {
  if (env.email.provider === "resend") {
    const r = await sendViaResend(msg);
    return { ...r, provider: "resend" };
  }
  if (env.email.provider === "smtp") {
    const r = await sendViaSmtp(msg);
    return { ...r, provider: "smtp" };
  }
  console.log("\n[email:console] ----------------------------");
  console.log(`To:      ${msg.to}`);
  console.log(`Subject: ${msg.subject}`);
  console.log(msg.text);
  console.log("[email:console] ----------------------------\n");
  return { ok: true, provider: "console" };
}
