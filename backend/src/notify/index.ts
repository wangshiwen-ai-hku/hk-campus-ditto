import type { MatchRecord, StudentProfile } from "../types.js";
import { sendEmail } from "../auth/email.js";
import { renderDateScheduled, renderFeedbackRequest, renderMatchDrop } from "./templates.js";

export type NotifyTemplate = "match_drop" | "date_scheduled" | "feedback_request";

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
  } else {
    return { ok: false };
  }

  const result = await sendEmail({
    to: to.email,
    subject: rendered.subject,
    text: rendered.body,
  });
  return { ok: result.ok };
}
