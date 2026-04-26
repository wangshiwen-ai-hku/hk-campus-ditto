import type { MatchRecord, StudentProfile } from "../types.js";

export interface NotifyTemplate {
  subject: string;
  body: string;
}

export function renderMatchDrop(_to: StudentProfile, partner: StudentProfile, match: MatchRecord): NotifyTemplate {
  return {
    subject: "It's a match — meet your Wednesday date",
    body: [
      `We picked one person for you this week: ${partner.fullName}.`,
      ``,
      `Why we paired you:`,
      ...match.reasonsForA.map((r) => `• ${r}`),
      ``,
      `Reply yes or no in the app within 24h.`,
    ].join("\n"),
  };
}

export function renderDateScheduled(
  to: StudentProfile,
  partner: StudentProfile,
  match: MatchRecord
): NotifyTemplate {
  return {
    subject: `You're on for ${match.confirmedSlot ?? "soon"}`,
    body: [
      `Hi ${to.fullName.split(" ")[0]},`,
      ``,
      `You and ${partner.fullName} are scheduled for ${match.confirmedSlot ?? "TBD"} at ${match.curatedDateSpot}.`,
      match.proposedPlace?.reason ? `Why this spot: ${match.proposedPlace.reason}` : "",
      ``,
      `Talking points:`,
      ...match.curatedDateTips.map((t) => `• ${t}`),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function renderFeedbackRequest(to: StudentProfile, _match: MatchRecord): NotifyTemplate {
  return {
    subject: "How was the date?",
    body: [
      `Hi ${to.fullName.split(" ")[0]},`,
      ``,
      `Quick 3-question check-in. It directly improves what we send you next.`,
      ``,
      `Open the app to give us 60 seconds.`,
    ].join("\n"),
  };
}
