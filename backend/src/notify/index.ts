import type { MatchRecord, StudentProfile } from "../types.js";
import { sendEmail } from "../auth/email.js";
import { env } from "../core/env.js";
import { renderContactShared, renderDateScheduled, renderFeedbackRequest, renderMatchDrop, renderPartnerConfirmed } from "./templates.js";

export type NotifyTemplate = "match_drop" | "contact_shared" | "date_scheduled" | "feedback_request" | "partner_confirmed";

export interface NotifyContext {
  match?: MatchRecord;
  partner?: StudentProfile;
}

export async function notify(
  to: StudentProfile,
  template: NotifyTemplate,
  ctx: NotifyContext
): Promise<{ ok: boolean }> {
  let rendered;
  if (template === "match_drop" && ctx.partner && ctx.match) {
    rendered = await renderMatchDrop(to, ctx.partner, ctx.match);
  } else if (template === "contact_shared" && ctx.partner && ctx.match) {
    rendered = renderContactShared(to, ctx.partner, ctx.match);
  } else if (template === "date_scheduled" && ctx.partner && ctx.match) {
    rendered = renderDateScheduled(to, ctx.partner, ctx.match);
  } else if (template === "feedback_request" && ctx.match) {
    rendered = renderFeedbackRequest(to, ctx.match);
  } else if (template === "partner_confirmed" && ctx.partner && ctx.match) {
    rendered = renderPartnerConfirmed(to, ctx.partner, ctx.match);
  } else {
    return { ok: false };
  }

  // Gmail (and many filters) require List-Unsubscribe on bulk/notification mail.
  // We don't have a real one-click unsubscribe endpoint yet, so we point at the
  // settings page (where users can opt out) and a mailto fallback.
  const unsubscribeUrl = `${env.email.frontendUrl}/settings`;
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<mailto:${env.email.replyTo}?subject=unsubscribe>, <${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "X-Entity-Ref-ID": `${template}-${to.id}-${Date.now()}`,
  };

  const result = await sendEmail({
    to: to.email,
    subject: rendered.subject,
    text: rendered.body,
    html: rendered.html,
    tag: template,
    headers,
  });
  return { ok: result.ok };
}
