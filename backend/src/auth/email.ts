import { env } from "../core/env.js";

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
   * Extra headers (e.g. List-Unsubscribe). Forwarded to Resend verbatim.
   */
  headers?: Record<string, string>;
  /**
   * Resend tag for deliverability tracking ("auth-code", "match-drop", ...).
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

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; provider: string; error?: string }> {
  if (env.email.provider === "resend") {
    const r = await sendViaResend(msg);
    return { ...r, provider: "resend" };
  }
  console.log("\n[email:console] ----------------------------");
  console.log(`To:      ${msg.to}`);
  console.log(`Subject: ${msg.subject}`);
  console.log(msg.text);
  console.log("[email:console] ----------------------------\n");
  return { ok: true, provider: "console" };
}
