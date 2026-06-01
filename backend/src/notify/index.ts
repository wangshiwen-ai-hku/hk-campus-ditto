import type { MatchRecord, StudentProfile } from "../types.js";
import { sendEmail } from "../auth/email.js";
import {
  renderContactShared,
  renderDateScheduled,
  renderFeedbackRequest,
  renderMatchDrop,
  renderPartnerConfirmed,
} from "./templates.js";

export type NotifyTemplate = "match_drop" | "date_scheduled" | "feedback_request" | "partner_confirmed" | "contact_shared";

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
    rendered = renderMatchDrop(to, ctx.partner, ctx.match);
  } else if (template === "date_scheduled" && ctx.partner && ctx.match) {
    rendered = renderDateScheduled(to, ctx.partner, ctx.match);
  } else if (template === "feedback_request" && ctx.match) {
    rendered = renderFeedbackRequest(to, ctx.match);
  } else if (template === "partner_confirmed" && ctx.partner && ctx.match) {
    rendered = renderPartnerConfirmed(to, ctx.partner, ctx.match);
  } else if (template === "contact_shared" && ctx.partner && ctx.match) {
    rendered = renderContactShared(to, ctx.partner, ctx.match);
  } else {
    return { ok: false };
  }

  const result = await sendEmail({
    to: to.email,
    subject: rendered.subject,
    text: rendered.body,
    html: rendered.html,
  });
  return { ok: result.ok };
}
