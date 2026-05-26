import type { Locale, MatchRecord, StudentProfile } from "../types.js";

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

const SLOT_LABELS_ZH_HK: Record<string, string> = {
  wed_eve: "星期三晚上",
  thu_eve: "星期四晚上",
  fri_aft: "星期五下午",
  fri_eve: "星期五晚上",
  sat_aft: "星期六下午",
  sun_aft: "星期日下午",
};

const SLOT_LABELS_ZH_CN: Record<string, string> = {
  wed_eve: "周三晚上",
  thu_eve: "周四晚上",
  fri_aft: "周五下午",
  fri_eve: "周五晚上",
  sat_aft: "周六下午",
  sun_aft: "周日下午",
};

function localeFor(user: StudentProfile): Locale {
  return user.preferredLocale ?? "en";
}

function slotLabel(slot: string, locale: Locale): string {
  if (locale === "zh-HK") return SLOT_LABELS_ZH_HK[slot] ?? slot;
  if (locale === "zh-CN") return SLOT_LABELS_ZH_CN[slot] ?? slot;
  return SLOT_LABELS[slot] ?? slot;
}

function partnerHighlights(p: StudentProfile, locale: Locale): string[] {
  const highlights: string[] = [];
  const labels = locale === "zh-HK"
    ? { interests: "興趣", vibe: "氛圍", studies: "背景", speaks: "語言" }
    : locale === "zh-CN"
    ? { interests: "兴趣", vibe: "氛围", studies: "背景", speaks: "语言" }
    : { interests: "Interests", vibe: "Vibe", studies: "Studies", speaks: "Speaks" };
  if (p.interests?.length) highlights.push(`${labels.interests}: ${p.interests.slice(0, 4).join(", ")}`);
  if (p.vibeTags?.length) highlights.push(`${labels.vibe}: ${p.vibeTags.slice(0, 3).join(", ")}`);
  if (p.major) highlights.push(`${labels.studies}: ${p.major}`);
  if (p.languages?.length) highlights.push(`${labels.speaks}: ${p.languages.slice(0, 3).join(", ")}`);
  return highlights;
}

export function renderMatchDrop(to: StudentProfile, partner: StudentProfile, match: MatchRecord): NotifyTemplate {
  const locale = localeFor(to);
  if (locale === "zh-HK") {
    return {
      subject: "你今週嘅配對到了",
      body: [
        `今週我哋為你揀咗一位：${partner.fullName}。`,
        ``,
        `點解配你哋：`,
        ...match.reasonsForA.map((r) => `• ${r}`),
        ``,
        `請喺 24 小時內入 App 回覆 yes 或 no。`,
      ].join("\n"),
    };
  }
  if (locale === "zh-CN") {
    return {
      subject: "你本周的匹配到了",
      body: [
        `本周我们为你选择了一位：${partner.fullName}。`,
        ``,
        `为什么匹配你们：`,
        ...match.reasonsForA.map((r) => `• ${r}`),
        ``,
        `请在 24 小时内进入 App 回复 yes 或 no。`,
      ].join("\n"),
    };
  }
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
  const locale = localeFor(to);
  const time = slotLabel(match.confirmedSlot ?? "TBD", locale);
  if (locale === "zh-HK") {
    return {
      subject: `約會時間已定：${time}`,
      body: [
        `Hi ${to.fullName.split(" ")[0]},`,
        ``,
        `你同 ${partner.fullName} 已安排喺 ${time}，地點係 ${match.curatedDateSpot}。`,
        match.proposedPlace?.reason ? `揀呢度嘅原因：${match.proposedPlace.reason}` : "",
        ``,
        `可以傾嘅話題：`,
        ...match.curatedDateTips.map((t) => `• ${t}`),
      ].filter(Boolean).join("\n"),
    };
  }
  if (locale === "zh-CN") {
    return {
      subject: `约会时间已定：${time}`,
      body: [
        `Hi ${to.fullName.split(" ")[0]},`,
        ``,
        `你和 ${partner.fullName} 已安排在 ${time}，地点是 ${match.curatedDateSpot}。`,
        match.proposedPlace?.reason ? `选择这里的原因：${match.proposedPlace.reason}` : "",
        ``,
        `可以聊的话题：`,
        ...match.curatedDateTips.map((t) => `• ${t}`),
      ].filter(Boolean).join("\n"),
    };
  }
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
  const locale = localeFor(to);
  if (locale === "zh-HK") {
    return {
      subject: "今次見面感覺點？",
      body: [`Hi ${to.fullName.split(" ")[0]},`, ``, `用 60 秒完成 3 條回饋，會直接幫我哋改善你下一次配對。`, ``, `打開 App 填寫就可以。`].join("\n"),
    };
  }
  if (locale === "zh-CN") {
    return {
      subject: "这次见面感觉怎么样？",
      body: [`Hi ${to.fullName.split(" ")[0]},`, ``, `用 60 秒完成 3 个反馈问题，会直接帮助我们改善你的下一次匹配。`, ``, `打开 App 填写即可。`].join("\n"),
    };
  }
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
  const locale = localeFor(to);
  const time = slotLabel(match.confirmedSlot ?? "", locale);
  const spot = match.proposedPlace?.name ?? match.curatedDateSpot ?? "";
  const highlights = partnerHighlights(partner, locale);
  const reasons = match.userAId === to.id ? match.reasonsForA : match.reasonsForB;

  if (locale === "zh-HK" || locale === "zh-CN") {
    const isHk = locale === "zh-HK";
    return {
      subject: isHk ? `${partnerFirst} 已確認，輪到你啦` : `${partnerFirst} 已确认，轮到你了`,
      body: [
        `Hi ${firstName},`,
        ``,
        isHk ? `好消息！${partner.fullName} 已經確認約會，佢期待同你見面。` : `好消息！${partner.fullName} 已经确认约会，TA 很期待和你见面。`,
        ``,
        isHk ? `── 關於 ${partnerFirst} ──` : `── 关于 ${partnerFirst} ──`,
        ...highlights.map((h) => `  • ${h}`),
        ``,
        isHk ? `── 約會詳情 ──` : `── 约会详情 ──`,
        time ? `  ${isHk ? "時間" : "时间"}: ${time}` : "",
        spot ? `  ${isHk ? "地點" : "地点"}: ${spot}` : "",
        match.proposedPlace?.reason ? `  ${isHk ? "點解揀呢度" : "为什么选这里"}: ${match.proposedPlace.reason}` : "",
        ``,
        reasons?.length ? (isHk ? `── 點解配你哋 ──` : `── 为什么匹配你们 ──`) : "",
        ...(reasons ?? []).map((r) => `  • ${r}`),
        reasons?.length ? `` : "",
        isHk ? `打開 App 確認你呢邊，確認後你哋會收到對方聯絡方式。` : `打开 App 确认你的选择，确认后你们会收到对方联系方式。`,
        ``,
        `— DopaMine`,
      ].filter((line) => line !== "").join("\n"),
    };
  }

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
    `— DopaMine 💜`,
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
      <div style="font-size:28px;font-weight:900;color:#a855f7;letter-spacing:-0.5px;">DopaMine</div>
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
      <p style="color:#475569;font-size:12px;margin:0;">DopaMine · One intentional date at a time 💜</p>
    </div>
  </div>
</body>
</html>`.trim();

  return { subject, body, html };
}
