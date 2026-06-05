import type { Locale, MatchRecord, StudentProfile } from "../types.js";
import { env } from "../core/env.js";
import { llmCall } from "../llm/client.js";
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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function partnerPhoto(partner: StudentProfile): string | undefined {
  const cards = partner.datingPreferences?.mediaCards
    ?.map((card) => card.photoUrl)
    .filter((url): url is string => Boolean(url && url.length > 10)) ?? [];
  const urls = partner.datingPreferences?.photoUrls
    ?.filter((url) => url && url.length > 10) ?? [];
  return [...cards, ...urls, partner.photoUrl].find((url): url is string => Boolean(url));
}

function studentMatchPageUrl(): string {
  return `${env.email.frontendUrl}/student?tab=matches`;
}

function ageFromBirthday(birthday: string | undefined): number | undefined {
  if (!birthday) return undefined;
  const match = birthday.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return undefined;
  const birth = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(birth.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasNotHadBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (hasNotHadBirthday) age -= 1;
  return age > 0 && age < 100 ? age : undefined;
}

function contactLines(partner: StudentProfile, locale: Locale): string[] {
  const labels = locale === "zh-HK"
    ? { whatsapp: "WhatsApp", email: "Email" }
    : locale === "zh-CN"
    ? { whatsapp: "WhatsApp", email: "邮箱" }
    : { whatsapp: "WhatsApp", email: "Email" };
  const lines: string[] = [];
  if (partner.datingPreferences?.phoneNumber) lines.push(`${labels.whatsapp}: ${partner.datingPreferences.phoneNumber}`);
  lines.push(`${labels.email}: ${partner.email}`);
  return lines;
}

function partnerProfileFacts(partner: StudentProfile, locale: Locale): string[] {
  const age = ageFromBirthday(partner.datingPreferences?.birthday);
  const height = partner.datingPreferences?.heightCm;
  const labels = locale === "zh-HK"
    ? { age: "年齡", height: "身高", persona: "戀愛人格" }
    : locale === "zh-CN"
    ? { age: "年龄", height: "身高", persona: "恋爱人格" }
    : { age: "Age", height: "Height", persona: "Love persona" };
  const facts: string[] = [];
  if (age) facts.push(`${labels.age}: ${age}`);
  if (height) facts.push(`${labels.height}: ${height} cm`);
  if (partner.ldfrResult?.code) {
    facts.push(`${labels.persona}: ${partner.ldfrResult.code}${partner.ldfrResult.title ? ` · ${partner.ldfrResult.title}` : ""}`);
  }
  return facts;
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

function renderTagsHtml(tags: string[], colorType: "vibe" | "interest" | "language"): string {
  if (!tags || tags.length === 0) return "";
  const styles = {
    vibe: "background-color:#efe2ff;border:2px solid #9d5cf8;color:#4c1d95;",
    interest: "background-color:#ffe1ec;border:2px solid #f05293;color:#9f1239;",
    language: "background-color:#dff3ff;border:2px solid #38bdf8;color:#075985;"
  };
  const style = styles[colorType];
  return tags.map(tag => `<span style="display:inline-block;border-radius:999px;padding:7px 13px;margin:4px 5px 4px 0;font-size:14px;line-height:1.1;font-weight:900;${style}">${escapeHtml(tag)}</span>`).join("");
}

interface TranslationPayload {
  major: string;
  vibeTags: string[];
  interests: string[];
  languages: string[];
  reasons: string[];
}

async function translateContent(
  payload: TranslationPayload,
  locale: Locale
): Promise<TranslationPayload> {
  if (locale === "en" || env.llm.provider === "mock") {
    return payload;
  }

  const targetLang = locale === "zh-HK" ? "Hong Kong Traditional Chinese (Cantonese)" : "Simplified Chinese";
  
  const system = `You are a translation assistant for a campus dating app in Hong Kong. 
Your task is to translate JSON content to ${targetLang}. 
For major, vibeTags, and interests: translate into natural local terms used by college students (e.g. for zh-HK, "菲林攝影" for "film photography", "海濱散步" for "harbour walks").
For reasons: translate them into natural, warm, and friendly local phrasing. For zh-HK, write in Traditional Chinese but with local Hong Kong vocabulary and expressions.
Return ONLY a valid JSON object matching the input structure, with no markdown formatting.`;

  const prompt = `Translate the following JSON object to ${targetLang}:
${JSON.stringify(payload, null, 2)}`;

  try {
    const result = await llmCall<TranslationPayload>({
      system,
      prompt,
      responseJson: true,
      tag: "email-translation",
      temperature: 0.2,
      maxOutputTokens: 800
    });
    
    if (result.json && !result.usedFallback) {
      return result.json;
    }
  } catch (e) {
    console.warn("[email-translation] Failed to translate content, using original English.", e);
  }
  
  return payload;
}

export async function renderMatchDrop(to: StudentProfile, partner: StudentProfile, match: MatchRecord): Promise<NotifyTemplate> {
  const locale = localeFor(to);
  const firstName = firstNameOf(to.fullName);
  const partnerFirst = firstNameOf(partner.fullName);
  const originalReasons = (match.userAId === to.id ? match.reasonsForA : match.reasonsForB) ?? match.reasonsForA ?? [];
  const appLink = studentMatchPageUrl();
  const confirmLink = matchEmailActionUrl(match, to.id, "yes");
  const cancelLink = matchEmailActionUrl(match, to.id, "no");
  const photo = partnerPhoto(partner);
  const age = ageFromBirthday(partner.datingPreferences?.birthday);
  const height = partner.datingPreferences?.heightCm;

  const originalPayload: TranslationPayload = {
    major: partner.major || "",
    vibeTags: partner.vibeTags || [],
    interests: partner.interests || [],
    languages: partner.languages || [],
    reasons: originalReasons
  };

  const translated = await translateContent(originalPayload, locale);
  const profileFacts = partnerProfileFacts(partner, locale);

  const getHtml = (opts: {
    pretitle: string;
    greeting: string;
    kicker: string;
    title: string;
    subtitle: string;
    description: string;
    privacyNote: string;
    aboutLabel: string;
    yearFallback: string;
    majorFallback: string;
    ldfrLabel: string;
    ageLabel: string;
    heightLabel: string;
    vibeLabel: string;
    interestsLabel: string;
    languagesLabel: string;
    reasonsTitle: string;
    confirmText: string;
    cancelText: string;
    footer: string;
  }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f6eed8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#171717;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.pretitle)}</div>
  <div style="max-width:640px;margin:0 auto;padding:30px 18px 42px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin:0 0 18px;">
      <div style="font-size:17px;font-weight:900;letter-spacing:0.08em;color:#1f2933;">DOPAMINE · MATCH DROP</div>
      <div style="font-size:16px;color:#81796a;">${escapeHtml(opts.greeting)}</div>
    </div>

    <div style="background:#fffdf7;border-radius:28px;padding:34px 30px 30px;box-shadow:0 20px 40px rgba(39,32,16,0.18);border:1px solid rgba(31,41,51,0.08);">
      <div style="color:#9b9487;font-size:20px;margin-bottom:10px;">${escapeHtml(opts.kicker)}</div>
      <div style="font-size:52px;line-height:0.95;font-weight:950;letter-spacing:-0.06em;color:#171717;margin:0 0 10px;">${escapeHtml(partnerFirst)}</div>
      <div style="font-size:26px;line-height:1.2;font-weight:900;color:#111827;margin-bottom:8px;">${escapeHtml(opts.title)}</div>
      <div style="font-size:18px;line-height:1.45;color:#7a7368;margin-bottom:26px;">${escapeHtml(opts.subtitle)}</div>

      ${photo ? `
      <div style="border-radius:24px;overflow:hidden;background:#e5e7eb;margin-bottom:24px;border:1px solid rgba(17,24,39,0.08);">
        <img src="${escapeHtml(photo)}" alt="${escapeHtml(partnerFirst)}" style="display:block;width:100%;max-height:360px;object-fit:cover;">
      </div>` : ""}

      <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 22px;">
        ${escapeHtml(opts.description)}
      </p>

      <div style="background:#fff7fb;border:1px solid #f7c2d9;border-radius:20px;padding:18px 20px;margin-bottom:22px;">
        <div style="font-size:12px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#db2777;margin-bottom:10px;">${escapeHtml(opts.aboutLabel)} ${escapeHtml(partnerFirst)}</div>
        <div style="color:#111827;font-size:17px;font-weight:900;margin-bottom:8px;">
          ${escapeHtml(partner.fullName)}
        </div>
        <div style="color:#6b7280;font-size:14px;line-height:1.55;margin-bottom:14px;">
          ${escapeHtml(partner.yearOfStudy || opts.yearFallback)}${translated.major ? ` · ${escapeHtml(translated.major)}` : ` · ${escapeHtml(opts.majorFallback)}`}
        </div>

        ${(age || height) ? `
        <div style="margin:0 0 12px;">
          ${age ? `<span style="display:inline-block;border-radius:999px;background:#ffffff;border:1px solid #f0c4d7;color:#111827;padding:7px 12px;font-size:13px;font-weight:850;margin:0 6px 8px 0;">${escapeHtml(opts.ageLabel)} ${age}</span>` : ""}
          ${height ? `<span style="display:inline-block;border-radius:999px;background:#ffffff;border:1px solid #f0c4d7;color:#111827;padding:7px 12px;font-size:13px;font-weight:850;margin:0 6px 8px 0;">${escapeHtml(opts.heightLabel)} ${height} cm</span>` : ""}
        </div>` : ""}

        ${partner.ldfrResult?.code ? `
        <div style="display:inline-block;border-radius:18px;background:#2b1230;color:#ff4f8b;border:1px solid #9d174d;padding:9px 14px;font-size:14px;font-weight:900;margin:0 6px 10px 0;">
          ${escapeHtml(opts.ldfrLabel)} · ${escapeHtml(partner.ldfrResult.code)}${partner.ldfrResult.title ? ` · ${escapeHtml(partner.ldfrResult.title)}` : ""}
        </div>` : ""}

        ${translated.vibeTags?.length ? `
        <div style="margin-top:8px;line-height:1.7;">
          <span style="font-size:13px;color:#6b7280;margin-right:8px;">${escapeHtml(opts.vibeLabel)}:</span>
          ${renderTagsHtml(translated.vibeTags.slice(0, 3), "vibe")}
        </div>` : ""}

        ${translated.interests?.length ? `
        <div style="margin-top:8px;line-height:1.7;">
          <span style="font-size:13px;color:#6b7280;margin-right:8px;">${escapeHtml(opts.interestsLabel)}:</span>
          ${renderTagsHtml(translated.interests.slice(0, 4), "interest")}
        </div>` : ""}

        ${translated.languages?.length ? `
        <div style="margin-top:8px;line-height:1.7;">
          <span style="font-size:13px;color:#6b7280;margin-right:8px;">${escapeHtml(opts.languagesLabel)}:</span>
          ${renderTagsHtml(translated.languages.slice(0, 3), "language")}
        </div>` : ""}
      </div>

      ${translated.reasons.length ? `
      <div style="border-top:1px dashed #d8ceb7;border-bottom:1px dashed #d8ceb7;padding:18px 0;margin-bottom:22px;">
        <div style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.16em;color:#9b9487;margin-bottom:10px;">${escapeHtml(opts.reasonsTitle)}</div>
        ${translated.reasons.map((r) => `<div style="color:#374151;font-size:15px;padding:5px 0;line-height:1.55;">- ${escapeHtml(r)}</div>`).join("\n        ")}
      </div>` : ""}

      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:18px;padding:16px 18px;margin-bottom:22px;color:#4b5563;font-size:14px;line-height:1.6;">
        ${escapeHtml(opts.privacyNote)}
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 4px;">
        <tr>
          <td style="padding:0 0 12px 0;width:100%;">
            <a href="${escapeHtml(confirmLink)}" style="display:block;background-color:#ff2f75;border:2px solid #111827;color:#111827;font-size:18px;line-height:1.2;font-weight:950;text-align:center;padding:16px 18px;border-radius:999px;text-decoration:none;box-shadow:0 10px 22px rgba(236,51,112,0.24);white-space:nowrap;word-break:keep-all;">
              ${escapeHtml(opts.confirmText)}
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:0;width:100%;">
            <a href="${escapeHtml(cancelLink)}" style="display:block;background-color:#ffffff;border:2px solid #d1d5db;color:#374151;font-size:17px;line-height:1.2;font-weight:950;text-align:center;padding:15px 18px;border-radius:999px;text-decoration:none;white-space:nowrap;word-break:keep-all;">
              ${escapeHtml(opts.cancelText)}
            </a>
          </td>
        </tr>
      </table>
      <div style="margin-top:16px;font-size:13px;color:#8a8171;line-height:1.55;">${escapeHtml(opts.footer)} <a href="${escapeHtml(appLink)}" style="color:#7c3aed;text-decoration:none;font-weight:800;">DopaMine</a></div>
    </div>

    <div style="text-align:center;padding:22px 0 0;font-size:12px;color:#8a8171;">
      DopaMine · One intentional match at a time
    </div>
  </div>
</body>
</html>
  `.trim();

  if (locale === "zh-HK") {
    const subject = "DopaMine 為您準備咗今週配對";
    const body = [
      `Hi ${firstName},`,
      ``,
      `今週 DopaMine 為您準備咗一位配對對象：${partner.fullName}。`,
      ...profileFacts.map((fact) => `• ${fact}`),
      `為保護雙方私隱，呢封信唔會透露對方 email 或 WhatsApp。請先選擇您是否願意在雙方都同意後分享聯絡方式。`,
      ``,
      `點解配您哋：`,
      ...translated.reasons.map((r) => `• ${r}`),
      ``,
      `Confirm: ${confirmLink}`,
      `Cancel: ${cancelLink}`,
    ].join("\n");
    const html = getHtml({
      pretitle: `${partnerFirst} 想認識您。雙方都確認後，DopaMine 先會分享聯絡方式。`,
      greeting: `Hi ${firstName}`,
      kicker: "Your date with",
      title: "一位值得認真認識嘅人",
      subtitle: "唔急住交換聯絡方式，先由您決定是否願意。",
      description: `DopaMine 根據您嘅回答，覺得 ${partnerFirst} 同您有幾個自然嘅交集。以下係可以公開分享嘅資料；email 同 WhatsApp 會等雙方都 Confirm 之後先分享。`,
      privacyNote: "為保護雙方私隱，Confirm 只代表您願意在雙方都同意後分享聯絡方式；如果任何一方 Cancel，聯絡方式都唔會被分享。",
      aboutLabel: "關於",
      yearFallback: "香港大學生",
      majorFallback: "未提供學科",
      ldfrLabel: "戀愛人格",
      ageLabel: "年齡",
      heightLabel: "身高",
      vibeLabel: "氛圍",
      interestsLabel: "興趣",
      languagesLabel: "語言",
      reasonsTitle: "點解配您哋",
      confirmText: "CONFIRM",
      cancelText: "Cancel",
      footer: "您亦可以登入"
    });
    return { subject, body, html };
  }

  if (locale === "zh-CN") {
    const subject = "DopaMine 为您准备了本周匹配";
    const body = [
      `Hi ${firstName},`,
      ``,
      `本周 DopaMine 为您准备了一位匹配对象：${partner.fullName}。`,
      ...profileFacts.map((fact) => `• ${fact}`),
      `为保护双方隐私，这封信不会透露对方邮箱或 WhatsApp。请先选择您是否愿意在双方都同意后分享联系方式。`,
      ``,
      `为什么匹配您们：`,
      ...translated.reasons.map((r) => `• ${r}`),
      ``,
      `Confirm: ${confirmLink}`,
      `Cancel: ${cancelLink}`,
    ].join("\n");
    const html = getHtml({
      pretitle: `${partnerFirst} 想认识您。双方都确认后，DopaMine 才会分享联系方式。`,
      greeting: `Hi ${firstName}`,
      kicker: "Your date with",
      title: "一位值得认真认识的人",
      subtitle: "不急着交换联系方式，先由您决定是否愿意。",
      description: `DopaMine 根据您的回答，觉得 ${partnerFirst} 和您有几个自然的交集。以下是可以公开分享的资料；邮箱和 WhatsApp 会等双方都 Confirm 之后才分享。`,
      privacyNote: "为保护双方隐私，Confirm 只代表您愿意在双方都同意后分享联系方式；如果任何一方 Cancel，联系方式都不会被分享。",
      aboutLabel: "关于",
      yearFallback: "香港大学生",
      majorFallback: "未提供专业",
      ldfrLabel: "恋爱人格",
      ageLabel: "年龄",
      heightLabel: "身高",
      vibeLabel: "氛围",
      interestsLabel: "兴趣",
      languagesLabel: "语言",
      reasonsTitle: "为什么匹配您们",
      confirmText: "CONFIRM",
      cancelText: "Cancel",
      footer: "您也可以登录"
    });
    return { subject, body, html };
  }

  // Default English
  const subject = "DopaMine has prepared your match this week";
  const body = [
    `Hi ${firstName},`,
    ``,
    `DopaMine prepared one match for you this week: ${partner.fullName}.`,
    ...profileFacts.map((fact) => `• ${fact}`),
    `To protect both sides, this email does not reveal their email or WhatsApp. Please choose whether you are willing to share contact details if both of you confirm.`,
    ``,
    `Why we paired you:`,
    ...translated.reasons.map((r) => `• ${r}`),
    ``,
    `Confirm: ${confirmLink}`,
    `Cancel: ${cancelLink}`,
  ].join("\n");
  const html = getHtml({
    pretitle: `${partnerFirst} would like to meet you. Contact details are only shared after both sides confirm.`,
    greeting: `Hi ${firstName}`,
    kicker: "Your date with",
    title: "A person worth meeting properly",
    subtitle: "No contact details yet. You decide first.",
    description: `Based on your answers, DopaMine thinks you and ${partnerFirst} have a few natural points of connection. These are the details we can share now; email and WhatsApp stay private until both sides confirm.`,
    privacyNote: "To protect both people, Confirm only means you are willing to share contact details if both sides agree. If either person clicks Cancel, contact details are not shared.",
    aboutLabel: "About",
    yearFallback: "Hong Kong student",
    majorFallback: "Field not provided",
    ldfrLabel: "Love persona",
    ageLabel: "Age",
    heightLabel: "Height",
    vibeLabel: "Vibe",
    interestsLabel: "Interests",
    languagesLabel: "Speaks",
    reasonsTitle: "Why You're Matched",
    confirmText: "CONFIRM",
    cancelText: "Cancel",
    footer: "You can also open"
  });

  return { subject, body, html };
}

export function renderContactShared(
  to: StudentProfile,
  partner: StudentProfile,
  match: MatchRecord
): NotifyTemplate {
  const locale = localeFor(to);
  const firstName = firstNameOf(to.fullName);
  const partnerFirst = firstNameOf(partner.fullName);
  const time = match.confirmedSlot ? slotLabel(match.confirmedSlot, locale) : "";
  const spot = match.proposedPlace?.name ?? match.curatedDateSpot;
  const reason = match.proposedPlace?.reason;
  const contacts = contactLines(partner, locale);
  const appLink = studentMatchPageUrl();

  const copy = locale === "zh-HK"
    ? {
        subject: "DopaMine 今週配對確認成功",
        intro: `您同 ${partnerFirst} 都確認咗今週配對。以下係下一步資訊同見面建議。`,
        contactTitle: `${partnerFirst} 嘅聯絡方式`,
        placeTitle: "建議見面安排",
        timeLabel: "時間",
        spotLabel: "地點",
        reasonLabel: "點解推薦",
        giftsTitle: "小禮物靈感",
        gifts: ["一張手寫小卡", "一杯對方可能鍾意嘅飲品", "一首歌或一個 playlist QR code"],
        tipsTitle: "第一次見面 tips",
        tips: ["第一句可以由共同興趣開始，唔需要太用力。", "第一次見面建議 45-60 分鐘，留一點餘地反而更自然。", "如果臨時要改時間，提前講清楚會好加分。"],
        cta: "打開 DopaMine",
      }
    : locale === "zh-CN"
    ? {
        subject: "DopaMine 本周匹配确认成功",
        intro: `您和 ${partnerFirst} 都确认了本周匹配。以下是下一步信息和见面建议。`,
        contactTitle: `${partnerFirst} 的联系方式`,
        placeTitle: "建议见面安排",
        timeLabel: "时间",
        spotLabel: "地点",
        reasonLabel: "为什么推荐",
        giftsTitle: "小礼物灵感",
        gifts: ["一张手写小卡片", "一杯对方可能喜欢的饮品", "一首歌或一个 playlist QR code"],
        tipsTitle: "第一次见面 tips",
        tips: ["第一句可以从共同兴趣开始，不需要太用力。", "第一次见面建议 45-60 分钟，留一点余地反而更自然。", "如果临时需要改时间，提前说清楚会很加分。"],
        cta: "打开 DopaMine",
      }
    : {
        subject: "DopaMine match confirmed",
        intro: `You and ${partnerFirst} both confirmed this week's match. Here are the next-step details and meeting ideas.`,
        contactTitle: `${partnerFirst}'s contact details`,
        placeTitle: "Suggested first meet",
        timeLabel: "Time",
        spotLabel: "Spot",
        reasonLabel: "Why this works",
        giftsTitle: "Small gift ideas",
        gifts: ["A handwritten note or card", "Their favorite drink", "A song or playlist QR code"],
        tipsTitle: "First-date tips",
        tips: ["Start from one shared interest. It does not need to be a perfect opening line.", "Keep the first meet around 45-60 minutes so it stays easy.", "If plans change, a clear early message is always appreciated."],
        cta: "Open DopaMine",
      };

  const body = [
    `Hi ${firstName},`,
    ``,
    copy.intro,
    ``,
    `-- ${copy.contactTitle} --`,
    ...contacts.map((line) => `• ${line}`),
    ``,
    `-- ${copy.placeTitle} --`,
    time ? `${copy.timeLabel}: ${time}` : "",
    spot ? `${copy.spotLabel}: ${spot}` : "",
    reason ? `${copy.reasonLabel}: ${reason}` : "",
    ``,
    `-- ${copy.giftsTitle} --`,
    ...copy.gifts.map((item) => `• ${item}`),
    ``,
    `-- ${copy.tipsTitle} --`,
    ...copy.tips.map((item) => `• ${item}`),
  ].filter(Boolean).join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#e5e7eb;">
  <div style="max-width:620px;margin:0 auto;padding:34px 20px 46px;">
    <div style="text-align:center;font-size:30px;font-weight:950;letter-spacing:-0.04em;color:#ffffff;margin-bottom:22px;">DopaMine</div>
    <div style="background:#141b2b;border:1px solid rgba(255,255,255,0.1);border-radius:26px;padding:30px 28px;box-shadow:0 18px 44px rgba(0,0,0,0.45);">
      <p style="font-size:17px;color:#f8fafc;margin:0 0 18px;">Hi ${escapeHtml(firstName)},</p>
      <p style="font-size:16px;line-height:1.7;color:#cbd5e1;margin:0 0 24px;">${escapeHtml(copy.intro)}</p>

      <div style="background:linear-gradient(135deg,rgba(236,51,112,0.14),rgba(124,58,237,0.12));border:1px solid rgba(236,51,112,0.26);border-radius:20px;padding:22px;margin-bottom:18px;">
        <div style="font-size:12px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#ff4f8b;margin-bottom:14px;">${escapeHtml(copy.contactTitle)}</div>
        ${contacts.map((line) => `<div style="font-size:20px;line-height:1.55;color:#ffffff;font-weight:850;margin:6px 0;">${escapeHtml(line)}</div>`).join("\n        ")}
      </div>

      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:22px;margin-bottom:18px;">
        <div style="font-size:12px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;">${escapeHtml(copy.placeTitle)}</div>
        ${time ? `<div style="font-size:16px;color:#f8fafc;margin:7px 0;"><strong>${escapeHtml(copy.timeLabel)}:</strong> ${escapeHtml(time)}</div>` : ""}
        ${spot ? `<div style="font-size:16px;color:#f8fafc;margin:7px 0;"><strong>${escapeHtml(copy.spotLabel)}:</strong> ${escapeHtml(spot)}</div>` : ""}
        ${reason ? `<div style="font-size:14px;color:#a5b4fc;line-height:1.6;margin-top:10px;">${escapeHtml(reason)}</div>` : ""}
      </div>

      <div style="display:grid;gap:14px;">
        <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.18);border-radius:18px;padding:20px;">
          <div style="font-size:12px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#86efac;margin-bottom:10px;">${escapeHtml(copy.giftsTitle)}</div>
          ${copy.gifts.map((item) => `<div style="color:#d1d5db;font-size:14px;line-height:1.6;">- ${escapeHtml(item)}</div>`).join("\n          ")}
        </div>
        <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.18);border-radius:18px;padding:20px;">
          <div style="font-size:12px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#93c5fd;margin-bottom:10px;">${escapeHtml(copy.tipsTitle)}</div>
          ${copy.tips.map((item) => `<div style="color:#d1d5db;font-size:14px;line-height:1.6;">- ${escapeHtml(item)}</div>`).join("\n          ")}
        </div>
      </div>

      <div style="text-align:center;margin-top:28px;">
        <a href="${escapeHtml(appLink)}" style="display:inline-block;background:linear-gradient(135deg,#ec3370,#7c3aed);color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 30px;font-size:16px;font-weight:900;">${escapeHtml(copy.cta)}</a>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  return { subject: copy.subject, body, html };
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
