import type { Locale, MatchRecord, StudentProfile } from "../types.js";
import { matchEmailActionUrl } from "../workflow/email-actions.js";

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

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstName(user: StudentProfile): string {
  return user.fullName.split(/\s+/)[0] || user.fullName;
}

function ageFromBirthday(birthday?: string): number | undefined {
  if (!birthday) return undefined;
  const date = new Date(birthday);
  if (Number.isNaN(date.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age -= 1;
  return age > 0 && age < 100 ? age : undefined;
}

function partnerImage(user: StudentProfile): string | undefined {
  const mediaPhoto = user.datingPreferences?.mediaCards?.find((card) => card.photoUrl)?.photoUrl;
  return user.photoUrl || mediaPhoto || user.datingPreferences?.photoUrls?.[0];
}

function mbtiCode(user: StudentProfile): string | undefined {
  const mbti = user.datingPreferences?.mbti;
  if (!mbti) return undefined;
  const code = [mbti.energy, mbti.information, mbti.decision, mbti.lifestyle].filter(Boolean).join("");
  return code.length ? code.toUpperCase() : undefined;
}

function labelSet(locale: Locale) {
  if (locale === "zh-HK") {
    return {
      subject: "DopaMine 為您準備咗今週配對",
      pretitle: "您今週嘅配對",
      intro:
        "Dopa 為您挑選了一位值得認識的人。為保護雙方私隱，聯絡方式只會喺雙方都 Confirm 後分享。",
      about: "關於",
      age: "年齡",
      height: "身高",
      persona: "戀愛人格",
      vibe: "氛圍",
      interests: "興趣",
      languages: "語言",
      why: "點解配您哋",
      privacy:
        "為保護雙方私隱，Confirm 只代表您願意喺雙方都同意後分享聯絡方式；如果任何一方 Cancel，聯絡方式都唔會被分享。",
      confirm: "Confirm",
      cancel: "Cancel",
      footer: "DopaMine · 每次只認真安排一個配對",
      sharedSubject: "DopaMine 今週配對確認成功",
      contactIntro: "您同對方都確認咗今週配對。以下係下一步資訊同見面建議。",
      dateIdeas: "約會地點建議",
      gifts: "小禮物靈感",
      tips: "第一次見面 Tips",
      whatsapp: "WhatsApp",
      email: "Email",
    };
  }
  if (locale === "zh-CN") {
    return {
      subject: "DopaMine 为您准备了本周匹配",
      pretitle: "您本周的匹配",
      intro:
        "Dopa 为您挑选了一位值得认识的人。为保护双方隐私，联系方式只会在双方都 Confirm 后分享。",
      about: "关于",
      age: "年龄",
      height: "身高",
      persona: "恋爱人格",
      vibe: "氛围",
      interests: "兴趣",
      languages: "语言",
      why: "为什么匹配您们",
      privacy:
        "为保护双方隐私，Confirm 只代表您愿意在双方都同意后分享联系方式；如果任何一方 Cancel，联系方式都不会被分享。",
      confirm: "Confirm",
      cancel: "Cancel",
      footer: "DopaMine · 每次只认真安排一个匹配",
      sharedSubject: "DopaMine 本周匹配确认成功",
      contactIntro: "您和对方都确认了本周匹配。以下是下一步信息和见面建议。",
      dateIdeas: "约会地点建议",
      gifts: "小礼物灵感",
      tips: "第一次见面 Tips",
      whatsapp: "WhatsApp",
      email: "Email",
    };
  }
  return {
    subject: "DopaMine has prepared your match this week",
    pretitle: "Your match this week",
    intro:
      "Dopa picked one person worth meeting. To protect both sides, contact details are shared only after you both confirm.",
    about: "About",
    age: "Age",
    height: "Height",
    persona: "Love Persona",
    vibe: "Vibe",
    interests: "Interests",
    languages: "Languages",
    why: "Why we matched you",
    privacy:
      "Confirm only means you are willing to share contact details after both sides agree. If either side cancels, no contact details are shared.",
    confirm: "Confirm",
    cancel: "Cancel",
    footer: "DopaMine · One intentional match at a time",
    sharedSubject: "DopaMine match confirmed",
    contactIntro:
      "You both confirmed this week's match. Here are the next-step details and meeting ideas.",
    dateIdeas: "Date Spot Ideas",
    gifts: "Small Gift Ideas",
    tips: "First-Date Tips",
    whatsapp: "WhatsApp",
    email: "Email",
  };
}

function partnerFacts(user: StudentProfile, locale: Locale): string[] {
  const labels = labelSet(locale);
  const facts: string[] = [];
  const age = ageFromBirthday(user.datingPreferences?.birthday);
  if (age) facts.push(`${labels.age} ${age}`);
  if (user.datingPreferences?.heightCm) facts.push(`${labels.height} ${user.datingPreferences.heightCm} cm`);
  return facts;
}

function profileLine(user: StudentProfile): string {
  return [user.yearOfStudy, user.major].filter(Boolean).join(" · ");
}

function tagChips(items: string[] | undefined, tone: "pink" | "blue" | "green" = "pink") {
  if (!items?.length) return "";
  const colors = {
    pink: { bg: "#fff0f6", border: "#f4a3c4", text: "#9f1239" },
    blue: { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" },
    green: { bg: "#ecfdf5", border: "#86efac", text: "#166534" },
  }[tone];
  return items
    .slice(0, 5)
    .map(
      (item) =>
        `<span style="display:inline-block;margin:4px 6px 4px 0;padding:8px 12px;border-radius:999px;background:${colors.bg};border:1px solid ${colors.border};color:${colors.text};font-size:14px;font-weight:800;line-height:1.2;">${esc(item)}</span>`
    )
    .join("");
}

function reasonList(match: MatchRecord, userId: string): string[] {
  return userId === match.userAId ? match.reasonsForA : match.reasonsForB;
}

function bulletRows(items: string[]) {
  return items
    .filter(Boolean)
    .map((item) => `<div style="font-size:16px;line-height:1.65;color:#4b5563;margin:0 0 8px;">- ${esc(item)}</div>`)
    .join("");
}

function ctaButton(label: string, href: string, primary = true) {
  const styles = primary
    ? "background:#ec2f75;color:#ffffff;border:1px solid #be185d;box-shadow:0 14px 34px rgba(236,47,117,.32);"
    : "background:#ffffff;color:#1f2937;border:1px solid #d1d5db;";
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 0;">
      <tr>
        <td align="center">
          <a href="${esc(href)}" style="display:block;width:100%;box-sizing:border-box;border-radius:999px;padding:18px 22px;text-align:center;text-decoration:none;font-size:20px;font-weight:900;line-height:1.1;white-space:nowrap;${styles}">${esc(label)}</a>
        </td>
      </tr>
    </table>`;
}

function emailShell(content: string, footer: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5efd9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
  <div style="max-width:660px;margin:0 auto;padding:28px 18px 36px;">
    <div style="padding:8px 4px 22px;font-size:15px;font-weight:900;letter-spacing:.08em;color:#1f2937;">DOPAMINE</div>
    <div style="background:#fffdf8;border-radius:28px;padding:28px 24px;border:1px solid #efe1bd;box-shadow:0 18px 50px rgba(84,64,28,.16);">
      ${content}
    </div>
    <p style="text-align:center;color:#8a8170;font-size:14px;margin:28px 0 0;">${esc(footer)}</p>
  </div>
</body>
</html>`;
}

export function renderMatchDrop(to: StudentProfile, partner: StudentProfile, match: MatchRecord): NotifyTemplate {
  const locale = localeFor(to);
  const labels = labelSet(locale);
  const partnerFirst = firstName(partner);
  const reasons = reasonList(match, to.id);
  const facts = partnerFacts(partner, locale);
  const image = partnerImage(partner);
  const persona = partner.ldfrResult;
  const confirmUrl = matchEmailActionUrl(match, to.id, "yes");
  const cancelUrl = matchEmailActionUrl(match, to.id, "no");

  const body = [
    `Hi ${firstName(to)},`,
    labels.intro,
    "",
    `${labels.about} ${partner.fullName}`,
    profileLine(partner),
    facts.join(" · "),
    persona ? `${labels.persona}: ${persona.code} · ${persona.title}` : "",
    partner.vibeTags?.length ? `${labels.vibe}: ${partner.vibeTags.join(", ")}` : "",
    partner.interests?.length ? `${labels.interests}: ${partner.interests.join(", ")}` : "",
    partner.languages?.length ? `${labels.languages}: ${partner.languages.join(", ")}` : "",
    "",
    labels.why,
    ...reasons.map((reason) => `- ${reason}`),
    "",
    labels.privacy,
    `Confirm: ${confirmUrl}`,
    `Cancel: ${cancelUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const personaHtml = persona
    ? `<div style="margin:18px 0 0;padding:16px 18px;border-radius:18px;background:#3a0a2f;color:#ff4f93;font-size:17px;font-weight:900;line-height:1.45;">${esc(labels.persona)} · ${esc(persona.code)} · ${esc(persona.title)}</div>`
    : "";
  const photoHtml = image
    ? `<img src="${esc(image)}" alt="${esc(partner.fullName)}" style="width:100%;max-height:280px;object-fit:cover;border-radius:22px;margin:0 0 22px;display:block;">`
    : "";
  const content = `
    <div style="font-size:14px;font-weight:900;color:#ec2f75;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px;">${esc(labels.pretitle)}</div>
    <h1 style="font-size:40px;line-height:1.05;margin:0 0 12px;color:#111827;">${esc(partner.fullName)}</h1>
    <p style="font-size:18px;line-height:1.7;color:#5b6472;margin:0 0 22px;">${esc(labels.intro)}</p>
    ${photoHtml}
    <div style="border:1px solid #f0cddd;background:#fff7fb;border-radius:24px;padding:22px;margin:0 0 24px;">
      <div style="font-size:14px;font-weight:900;color:#db2777;letter-spacing:.16em;text-transform:uppercase;margin-bottom:12px;">${esc(labels.about)} ${esc(partnerFirst)}</div>
      <h2 style="font-size:26px;line-height:1.2;margin:0 0 8px;color:#111827;">${esc(partnerFirst)}</h2>
      <p style="font-size:18px;line-height:1.55;color:#5b6472;margin:0 0 12px;">${esc(profileLine(partner))}</p>
      <div style="margin:10px 0 4px;">${facts
        .map(
          (fact) =>
            `<span style="display:inline-block;margin:4px 8px 4px 0;padding:10px 16px;border-radius:999px;border:1px solid #e7c7d6;background:#ffffff;color:#111827;font-size:16px;font-weight:900;">${esc(fact)}</span>`
        )
        .join("")}</div>
      ${personaHtml}
      <div style="margin-top:22px;">
        <div style="font-size:17px;color:#374151;margin:12px 0 6px;">${esc(labels.vibe)}:</div>
        ${tagChips(partner.vibeTags, "green")}
        <div style="font-size:17px;color:#374151;margin:18px 0 6px;">${esc(labels.interests)}:</div>
        ${tagChips(partner.interests, "pink")}
        <div style="font-size:17px;color:#374151;margin:18px 0 6px;">${esc(labels.languages)}:</div>
        ${tagChips(partner.languages, "blue")}
      </div>
    </div>
    ${
      reasons.length
        ? `<div style="border-top:1px dashed #d7cdb1;border-bottom:1px dashed #d7cdb1;padding:22px 0;margin:0 0 24px;">
            <h2 style="font-size:22px;margin:0 0 12px;color:#7c7463;">${esc(labels.why)}</h2>
            ${bulletRows(reasons)}
          </div>`
        : ""
    }
    <div style="border:1px solid #e5e7eb;border-radius:20px;background:#f9fafb;padding:18px 20px;margin:0 0 22px;">
      <p style="font-size:17px;line-height:1.65;color:#4b5563;margin:0;">${esc(labels.privacy)}</p>
    </div>
    ${ctaButton(labels.confirm, confirmUrl, true)}
    ${ctaButton(labels.cancel, cancelUrl, false)}
  `;

  return {
    subject: labels.subject,
    body,
    html: emailShell(content, labels.footer),
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
        `Hi ${firstName(to)},`,
        ``,
        `您同 ${partner.fullName} 已安排喺 ${time}，地點係 ${match.curatedDateSpot}。`,
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
        `Hi ${firstName(to)},`,
        ``,
        `您和 ${partner.fullName} 已安排在 ${time}，地点是 ${match.curatedDateSpot}。`,
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
      `Hi ${firstName(to)},`,
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
      body: [`Hi ${firstName(to)},`, ``, `用 60 秒完成 3 條回饋，會直接幫我哋改善您下一次配對。`, ``, `打開 App 填寫就可以。`].join("\n"),
    };
  }
  if (locale === "zh-CN") {
    return {
      subject: "这次见面感觉怎么样？",
      body: [`Hi ${firstName(to)},`, ``, `用 60 秒完成 3 个反馈问题，会直接帮助我们改善您的下一次匹配。`, ``, `打开 App 填写即可。`].join("\n"),
    };
  }
  return {
    subject: "How was the date?",
    body: [
      `Hi ${firstName(to)},`,
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
  const locale = localeFor(to);
  const labels = labelSet(locale);
  const time = slotLabel(match.confirmedSlot ?? "", locale);
  const spot = match.proposedPlace?.name ?? match.curatedDateSpot ?? "";
  const reasons = reasonList(match, to.id);
  return {
    subject:
      locale === "zh-HK"
        ? `${firstName(partner)} 已確認，輪到您啦`
        : locale === "zh-CN"
          ? `${firstName(partner)} 已确认，轮到您了`
          : `${firstName(partner)} has confirmed — your turn`,
    body: [
      `Hi ${firstName(to)},`,
      "",
      locale === "zh-HK"
        ? `${partner.fullName} 已經確認約會，TA 期待同您見面。`
        : locale === "zh-CN"
          ? `${partner.fullName} 已经确认约会，TA 期待和您见面。`
          : `${partner.fullName} has confirmed the date and is looking forward to meeting you.`,
      time ? `${locale === "en" ? "Time" : locale === "zh-HK" ? "時間" : "时间"}: ${time}` : "",
      spot ? `${locale === "en" ? "Spot" : locale === "zh-HK" ? "地點" : "地点"}: ${spot}` : "",
      "",
      labels.why,
      ...reasons.map((reason) => `- ${reason}`),
      "",
      labels.footer,
    ].filter(Boolean).join("\n"),
  };
}

function contactRows(partner: StudentProfile, locale: Locale) {
  const labels = labelSet(locale);
  const rows = [
    partner.datingPreferences?.phoneNumber ? [labels.whatsapp, partner.datingPreferences.phoneNumber] : undefined,
    [labels.email, partner.email],
  ].filter(Boolean) as string[][];
  return rows
    .map(
      ([label, value]) =>
        `<div style="margin:10px 0;padding:14px 16px;border:1px solid #f2bed3;border-radius:16px;background:#fff7fb;"><div style="font-size:12px;font-weight:900;letter-spacing:.18em;color:#db2777;text-transform:uppercase;margin-bottom:4px;">${esc(label)}</div><div style="font-size:18px;font-weight:900;color:#111827;word-break:break-word;">${esc(value)}</div></div>`
    )
    .join("");
}

export function renderContactShared(
  to: StudentProfile,
  partner: StudentProfile,
  match: MatchRecord
): NotifyTemplate {
  const locale = localeFor(to);
  const labels = labelSet(locale);
  const time = match.confirmedSlot ? slotLabel(match.confirmedSlot, locale) : "";
  const spot = match.proposedPlace?.name ?? match.curatedDateSpot;
  const dateIdeas =
    locale === "zh-HK"
      ? ["校園附近咖啡店，先輕鬆聊 45 分鐘", "安靜書店或唱片店，適合慢慢打開話題", "傍晚散步路線，留一點自然空間"]
      : locale === "zh-CN"
        ? ["校园附近咖啡店，先轻松聊 45 分钟", "安静书店或唱片店，适合慢慢打开话题", "傍晚散步路线，留一点自然空间"]
        : ["A campus-adjacent cafe for an easy 45-minute first chat", "A quiet bookshop or record store to let the conversation unfold", "An evening walk with space to breathe"];
  const gifts =
    locale === "zh-HK"
      ? ["一張手寫小卡", "對方可能會鍾意嘅飲品", "一首歌或 playlist QR code"]
      : locale === "zh-CN"
        ? ["一张手写小卡", "对方可能会喜欢的饮品", "一首歌或 playlist QR code"]
        : ["A short handwritten note", "Their favorite style of drink", "A song or playlist QR code"];
  const tips =
    locale === "zh-HK"
      ? ["第一次見面可以輕鬆一點，唔需要把氣氛推得太滿。", "準備一兩個同興趣有關嘅問題，會自然好多。", "如果感覺不錯，結尾可以大方提出下次再見。"]
      : locale === "zh-CN"
        ? ["第一次见面可以轻松一点，不需要把气氛推得太满。", "准备一两个和兴趣有关的问题，会自然很多。", "如果感觉不错，结尾可以大方提出下次再见。"]
        : ["Keep the first meeting light; it does not need to be perfect.", "Bring one or two questions tied to shared interests.", "If it feels good, it is completely fine to suggest meeting again."];

  const body = [
    `Hi ${firstName(to)},`,
    labels.contactIntro,
    "",
    `${partner.fullName}`,
    partner.datingPreferences?.phoneNumber ? `${labels.whatsapp}: ${partner.datingPreferences.phoneNumber}` : "",
    `${labels.email}: ${partner.email}`,
    "",
    time || spot ? `${labels.dateIdeas}: ${[time, spot].filter(Boolean).join(" · ")}` : labels.dateIdeas,
    ...dateIdeas.map((idea) => `- ${idea}`),
    "",
    labels.gifts,
    ...gifts.map((gift) => `- ${gift}`),
    "",
    labels.tips,
    ...tips.map((tip) => `- ${tip}`),
  ].filter(Boolean).join("\n");

  const content = `
    <div style="font-size:14px;font-weight:900;color:#ec2f75;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px;">${esc(labels.sharedSubject)}</div>
    <h1 style="font-size:34px;line-height:1.18;margin:0 0 14px;color:#111827;">${esc(labels.contactIntro)}</h1>
    <div style="border:1px solid #f0cddd;background:#fff7fb;border-radius:24px;padding:20px;margin:22px 0;">
      <h2 style="font-size:24px;margin:0 0 12px;color:#111827;">${esc(partner.fullName)}</h2>
      ${contactRows(partner, locale)}
    </div>
    <div style="border-top:1px dashed #d7cdb1;padding-top:22px;margin-top:22px;">
      <h2 style="font-size:22px;margin:0 0 10px;color:#7c7463;">${esc(labels.dateIdeas)}</h2>
      ${time || spot ? `<p style="font-size:17px;color:#111827;font-weight:800;margin:0 0 12px;">${esc([time, spot].filter(Boolean).join(" · "))}</p>` : ""}
      ${bulletRows(dateIdeas)}
      <h2 style="font-size:22px;margin:22px 0 10px;color:#7c7463;">${esc(labels.gifts)}</h2>
      ${bulletRows(gifts)}
      <h2 style="font-size:22px;margin:22px 0 10px;color:#7c7463;">${esc(labels.tips)}</h2>
      ${bulletRows(tips)}
    </div>
  `;

  return {
    subject: labels.sharedSubject,
    body,
    html: emailShell(content, labels.footer),
  };
}
