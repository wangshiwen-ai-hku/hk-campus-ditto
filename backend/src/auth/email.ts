import { env } from "../core/env.js";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

async function sendViaResend(msg: EmailMessage): Promise<{ ok: boolean; error?: string }> {
  if (!env.email.resendApiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.email.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.email.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${t.slice(0, 200)}` };
  }
  return { ok: true };
}

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; provider: string; error?: string }> {
  if (env.email.provider === "resend") {
    const r = await sendViaResend(msg);
    return { ...r, provider: "resend" };
  }
  // console fallback (dev / MVP default)
  console.log("\n[email:console] ----------------------------");
  console.log(`To:      ${msg.to}`);
  console.log(`Subject: ${msg.subject}`);
  console.log(msg.text);
  console.log("[email:console] ----------------------------\n");
  return { ok: true, provider: "console" };
}
