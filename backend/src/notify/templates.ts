import type { MatchRecord, StudentProfile } from "../types.js";

export interface NotifyTemplate {
  subject: string;
  body: string;
  html?: string;
}

const SLOT_LABELS: Record<string, string> = {
  wed_eve: "Wednesday Evening",
  thu_eve: "Thursday Evening",
  fri_aft: "Friday Afternoon",
  fri_eve: "Friday Evening",
  sat_aft: "Saturday Afternoon",
  sun_aft: "Sunday Afternoon",
};

function slotLabel(slot: string): string {
  return SLOT_LABELS[slot] ?? slot;
}

function partnerHighlights(p: StudentProfile): string[] {
  const highlights: string[] = [];
  if (p.interests?.length) highlights.push(`Interests: ${p.interests.slice(0, 4).join(", ")}`);
  if (p.vibeTags?.length) highlights.push(`Vibe: ${p.vibeTags.slice(0, 3).join(", ")}`);
  if (p.major) highlights.push(`Studies: ${p.major}`);
  if (p.languages?.length) highlights.push(`Speaks: ${p.languages.slice(0, 3).join(", ")}`);
  return highlights;
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
  const time = slotLabel(match.confirmedSlot ?? "TBD");
  return {
    subject: `You're on for ${time}`,
    body: [
      `Hi ${to.fullName.split(" ")[0]},`,
      ``,
      `You and ${partner.fullName} are scheduled for ${time} at ${match.curatedDateSpot}.`,
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

export function renderPartnerConfirmed(
  to: StudentProfile,
  partner: StudentProfile,
  match: MatchRecord
): NotifyTemplate {
  const firstName = to.fullName.split(" ")[0];
  const partnerFirst = partner.fullName.split(" ")[0];
  const time = slotLabel(match.confirmedSlot ?? "");
  const spot = match.proposedPlace?.name ?? match.curatedDateSpot ?? "";
  const highlights = partnerHighlights(partner);
  const reasons = match.userAId === to.id ? match.reasonsForA : match.reasonsForB;

  const subject = `${partnerFirst} has confirmed — your turn!`;

  // Plain text version
  const body = [
    `Hi ${firstName},`,
    ``,
    `Great news! ${partner.fullName} has already confirmed the date — they're genuinely looking forward to meeting you.`,
    ``,
    `── About ${partnerFirst} ──`,
    ...highlights.map((h) => `  • ${h}`),
    ``,
    `── Date Details ──`,
    time ? `  📅 Time: ${time}` : "",
    spot ? `  📍 Spot: ${spot}` : "",
    match.proposedPlace?.reason ? `  💡 Why here: ${match.proposedPlace.reason}` : "",
    ``,
    reasons?.length ? `── Why You're Matched ──` : "",
    ...(reasons ?? []).map((r) => `  • ${r}`),
    reasons?.length ? `` : "",
    `── Gift Ideas for Your First Meeting ──`,
    `  🎁 A handwritten note or card`,
    `  ☕ Their favorite drink`,
    `  🎵 A playlist QR code of songs that remind you of them`,
    ``,
    `Open the app to confirm your side — once you do, you'll both get each other's contact info!`,
    ``,
    `— Aura HK 💜`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  // HTML version
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">

    <!-- Header -->
    <div style="text-align:center;padding:24px 0 16px;">
      <div style="font-size:28px;font-weight:900;color:#a855f7;letter-spacing:-0.5px;">Aura HK</div>
    </div>

    <!-- Main Card -->
    <div style="background:#1e293b;border-radius:20px;padding:32px 28px;border:1px solid rgba(255,255,255,0.08);">

      <!-- Greeting -->
      <p style="color:#e2e8f0;font-size:16px;margin:0 0 20px;">Hi ${firstName},</p>
      <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Great news! <strong style="color:#e2e8f0;">${partner.fullName}</strong> has already confirmed the date details — they're genuinely looking forward to meeting you! ✨
      </p>

      <!-- Partner Highlights -->
      <div style="background:linear-gradient(135deg,rgba(168,85,247,0.08),rgba(59,130,246,0.08));border:1px solid rgba(168,85,247,0.15);border-radius:16px;padding:20px 24px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:rgba(168,85,247,0.6);margin-bottom:12px;">About ${partnerFirst}</div>
        ${highlights.map((h) => `<div style="color:#cbd5e1;font-size:14px;padding:4px 0;">• ${h}</div>`).join("\n        ")}
      </div>

      <!-- Date Details -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px 24px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.25);margin-bottom:12px;">Date Details</div>
        ${time ? `<div style="color:#e2e8f0;font-size:15px;padding:4px 0;">📅 <strong>${time}</strong></div>` : ""}
        ${spot ? `<div style="color:#e2e8f0;font-size:15px;padding:4px 0;">📍 <strong>${spot}</strong></div>` : ""}
        ${match.proposedPlace?.reason ? `<div style="color:#94a3b8;font-size:13px;padding:4px 0;font-style:italic;">💡 ${match.proposedPlace.reason}</div>` : ""}
      </div>

      ${reasons?.length ? `
      <!-- Why Matched -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px 24px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.25);margin-bottom:12px;">Why You're Matched</div>
        ${reasons.map((r) => `<div style="color:#cbd5e1;font-size:14px;padding:4px 0;">• ${r}</div>`).join("\n        ")}
      </div>` : ""}

      <!-- Gift Ideas -->
      <div style="background:rgba(236,72,153,0.05);border:1px solid rgba(236,72,153,0.1);border-radius:16px;padding:20px 24px;margin-bottom:24px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:rgba(236,72,153,0.5);margin-bottom:12px;">🎁 Gift Ideas</div>
        <div style="color:#cbd5e1;font-size:14px;padding:4px 0;">• A handwritten note or card</div>
        <div style="color:#cbd5e1;font-size:14px;padding:4px 0;">• Their favorite drink</div>
        <div style="color:#cbd5e1;font-size:14px;padding:4px 0;">• A playlist QR code of songs that remind you of them</div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;padding:8px 0;">
        <div style="display:inline-block;background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff;font-size:16px;font-weight:800;padding:14px 36px;border-radius:14px;text-decoration:none;">
          Open the App to Confirm ✨
        </div>
        <p style="color:#64748b;font-size:13px;margin:12px 0 0;">Once you confirm, you'll both get each other's contact info!</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0 8px;">
      <p style="color:#475569;font-size:12px;margin:0;">Aura HK · One intentional date at a time 💜</p>
    </div>
  </div>
</body>
</html>`.trim();

  return { subject, body, html };
}
