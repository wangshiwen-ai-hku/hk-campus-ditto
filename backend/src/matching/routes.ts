import { Router } from "express";
import { z } from "zod";
import { ensureDb, getMatchesForUser, getStudentById, getUniversityById, saveDb } from "../db.js";
import { requireAdmin, requireAuth } from "../core/auth-middleware.js";
import { rankCandidatesFor, runWeeklyMatchmaking } from "./ranker.js";
import { poolFor } from "./filter.js";
import { callBudget } from "../llm/client.js";
import type { Locale, MatchRecord, StudentProfile, University } from "../types.js";

export const matchingRouter = Router();

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function canRevealContact(match: MatchRecord): boolean {
  if (["happened", "feedback-collected", "closed"].includes(match.status)) return true;
  const acceptances = match.acceptances ?? [];
  if (
    acceptances.find((x) => x.userId === match.userAId)?.choice === "yes" &&
    acceptances.find((x) => x.userId === match.userBId)?.choice === "yes"
  ) {
    return true;
  }
  const confirmations = match.dateConfirmations ?? [];
  return Boolean(
    confirmations.find((x) => x.userId === match.userAId && x.place) &&
    confirmations.find((x) => x.userId === match.userBId && x.place)
  );
}

function publicPhotos(partner: StudentProfile): string[] {
  const fromCards = partner.datingPreferences?.mediaCards
    ?.map((card) => card.photoUrl)
    .filter((url): url is string => Boolean(url && url.length > 10)) ?? [];
  const fromUrls = partner.datingPreferences?.photoUrls
    ?.filter((url) => url && url.length > 10) ?? [];
  return Array.from(new Set([...fromUrls, ...fromCards, partner.photoUrl].filter((url): url is string => Boolean(url)))).slice(0, 3);
}

const LOCAL_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    coffee: "Coffee",
    cantopop: "Cantopop and indie music",
    art: "Art exhibitions",
    film: "Film photography",
    night: "Night walks",
    hiking: "Hiking",
    citywalk: "City walks",
    supper: "Late-night food",
    tech: "Tech and startups",
    thrifting: "Thrifting",
    chill: "Chill",
    curious: "Curious",
    empathetic: "Empathetic",
    playful: "Playful",
    grounded: "Grounded",
    creative: "Creative",
    ambitious: "Ambitious",
    warm: "Warm",
    english: "English",
    cantonese: "Cantonese",
    mandarin: "Mandarin",
    japanese: "Japanese",
    korean: "Korean",
    English: "English",
    Cantonese: "Cantonese",
    Mandarin: "Mandarin",
    "英文": "English",
    "廣東話": "Cantonese",
    "广东话": "Cantonese",
    "普通話": "Mandarin",
    "普通话": "Mandarin",
    "科技與創業": "Tech and startups",
    "睇藝術展覽": "Art exhibitions",
    "城市漫步": "City walks",
    "喜歡摺貓": "Cat lover",
    "喜歡貓貓": "Cat lover",
    "隨性": "Chill",
    "幽默有趣": "Playful",
    "數學": "Mathematics",
  },
  "zh-HK": {
    coffee: "咖啡",
    cantopop: "廣東歌與獨立音樂",
    art: "睇藝術展覽",
    film: "菲林攝影",
    night: "夜遊與夜景",
    hiking: "行山與自然",
    citywalk: "城市漫步",
    supper: "宵夜糖水",
    tech: "科技與創業",
    thrifting: "古着與二手市場",
    chill: "Chill / 隨性",
    curious: "幽默有趣",
    empathetic: "共情力強",
    playful: "幽默有趣",
    grounded: "踏實可靠",
    creative: "有創意",
    ambitious: "有上進心",
    warm: "溫暖",
    english: "英文",
    cantonese: "廣東話",
    mandarin: "普通話",
    japanese: "日文",
    korean: "韓文",
    English: "英文",
    Cantonese: "廣東話",
    Mandarin: "普通話",
    "英文": "英文",
    "廣東話": "廣東話",
    "广东话": "廣東話",
    "普通話": "普通話",
    "普通话": "普通話",
    "科技与创业": "科技與創業",
    "看艺术展览": "睇藝術展覽",
    "喜欢猫猫": "鍾意貓貓",
    "随性": "Chill / 隨性",
    "数学": "數學",
  },
  "zh-CN": {
    coffee: "咖啡",
    cantopop: "粤语歌与独立音乐",
    art: "看艺术展览",
    film: "胶片摄影",
    night: "夜游与夜景",
    hiking: "徒步与自然",
    citywalk: "城市漫步",
    supper: "宵夜糖水",
    tech: "科技与创业",
    thrifting: "古着与二手市场",
    chill: "随性",
    curious: "充满好奇",
    empathetic: "共情力强",
    playful: "幽默有趣",
    grounded: "踏实靠谱",
    creative: "天马行空",
    ambitious: "有上进心",
    warm: "像小太阳",
    english: "英文",
    cantonese: "广东话",
    mandarin: "普通话",
    japanese: "日语",
    korean: "韩语",
    English: "英文",
    Cantonese: "广东话",
    Mandarin: "普通话",
    "英文": "英文",
    "廣東話": "广东话",
    "广东话": "广东话",
    "普通話": "普通话",
    "普通话": "普通话",
    "科技與創業": "科技与创业",
    "睇藝術展覽": "看艺术展览",
    "藝術展覽": "艺术展览",
    "喜歡摺貓": "喜欢猫猫",
    "喜歡貓貓": "喜欢猫猫",
    "隨性": "随性",
    "幽默有趣": "幽默有趣",
    "數學": "数学",
  },
};

function localizeValue(value: string, locale: Locale): string {
  const raw = value.trim();
  const key = raw.includes(".") ? raw.split(".").pop()?.trim() ?? raw : raw;
  return LOCAL_LABELS[locale][key] ?? LOCAL_LABELS[locale][raw] ?? LOCAL_LABELS[locale][key.toLowerCase()] ?? LOCAL_LABELS[locale][raw.toLowerCase()] ?? value;
}

function localizeList(values: string[] | undefined, locale: Locale, max: number): string[] {
  return (values ?? []).slice(0, max).map((value) => localizeValue(value, locale));
}

function localizeReasons(reasons: string[] | undefined, locale: Locale): string[] {
  return (reasons ?? []).slice(0, 3).map((reason) => {
    const shared = reason.match(/^Shared interests:\s*(.+)$/i);
    if (shared) {
      const items = shared[1].split(",").map((x) => localizeValue(x.trim(), locale)).join(locale === "en" ? ", " : "、");
      if (locale === "zh-HK") return `共同興趣：${items}`;
      if (locale === "zh-CN") return `共同兴趣：${items}`;
      return `Shared interests: ${items}`;
    }

    const overlap = reason.match(/^(\d+)\s+overlapping time slot/i);
    if (overlap) {
      if (locale === "zh-HK") return `你哋有 ${overlap[1]} 個時間可以夾到`;
      if (locale === "zh-CN") return `你们有 ${overlap[1]} 个可重合时间`;
      return reason;
    }

    if (/Comfortable language overlap/i.test(reason)) {
      if (locale === "zh-HK") return "你哋有舒服嘅共同語言";
      if (locale === "zh-CN") return "你们有舒服的共同语言";
      return reason;
    }

    if (/Both verified/i.test(reason)) {
      if (locale === "zh-HK") return "你哋都已完成大學身份認證";
      if (locale === "zh-CN") return "你们都已完成大学身份认证";
      return reason;
    }

    if (/Keep the first meet|Keep the first date/i.test(reason)) {
      if (locale === "zh-HK") return "第一次見面建議控制喺 45 至 60 分鐘";
      if (locale === "zh-CN") return "第一次见面建议控制在 45 至 60 分钟";
      return reason;
    }

    if (/low-pressure first meet/i.test(reason)) {
      if (locale === "zh-HK") return "先由輕鬆、低壓嘅見面開始";
      if (locale === "zh-CN") return "先从轻松、低压力的见面开始";
      return reason;
    }

    if (/talking points/i.test(reason)) {
      if (locale === "zh-HK") return "用共同話題自然破冰";
      if (locale === "zh-CN") return "用共同话题自然破冰";
      return reason;
    }

    if (/Be specific/i.test(reason)) {
      if (locale === "zh-HK") return "聊具體一點，比完美人設更自然";
      if (locale === "zh-CN") return "聊具体一点，比完美人设更自然";
      return reason;
    }

    return reason;
  });
}

function localizeMatchTitle(text: string | undefined, locale: Locale): string {
  if (!text) return "";
  const titles: Record<string, Record<Locale, string>> = {
    "Coffee + a real conversation": {
      en: "Coffee + a real conversation",
      "zh-HK": "咖啡 + 一次真誠聊天",
      "zh-CN": "咖啡 + 一次真诚聊天",
    },
    "Coffee + short campus loop": {
      en: "Coffee + short campus loop",
      "zh-HK": "咖啡 + 校園輕鬆散步",
      "zh-CN": "咖啡 + 校园轻松散步",
    },
    "Coffee first, timing next": {
      en: "Coffee first, timing next",
      "zh-HK": "先咖啡，時間慢慢夾",
      "zh-CN": "先咖啡，时间慢慢约",
    },
  };
  return titles[text]?.[locale] ?? text;
}

function publicPartner(
  partner: StudentProfile,
  university: University | undefined,
  match: MatchRecord,
  locale: Locale
) {
  const revealContact = canRevealContact(match);
  return {
    id: partner.id,
    fullName: revealContact ? partner.fullName : firstName(partner.fullName),
    email: revealContact ? partner.email : undefined,
    phoneNumber: revealContact ? partner.datingPreferences?.phoneNumber : undefined,
    universityId: partner.universityId,
    universityShortName: university?.shortName ?? partner.universityId,
    yearOfStudy: partner.yearOfStudy,
    major: localizeValue(partner.major, locale),
    interests: localizeList(partner.interests, locale, 5),
    vibeTags: localizeList(partner.vibeTags, locale, 4),
    languages: localizeList(partner.languages, locale, 3),
    datingPreferences: {
      photoUrls: publicPhotos(partner),
    },
    ldfrResult: partner.ldfrResult ? { code: partner.ldfrResult.code } : undefined,
  };
}

function publicMatch(match: MatchRecord, userId: string, locale: Locale): MatchRecord {
  const isA = match.userAId === userId;
  return {
    id: match.id,
    createdAt: match.createdAt,
    dropDate: match.dropDate,
    userAId: match.userAId,
    userBId: match.userBId,
    score: match.score,
    status: match.status,
    reasonsForA: isA ? localizeReasons(match.reasonsForA, locale) : [],
    reasonsForB: isA ? [] : localizeReasons(match.reasonsForB, locale),
    posterHeadline: match.posterHeadline,
    curatedDateTitle: localizeMatchTitle(match.curatedDateTitle, locale),
    curatedDateSpot: match.curatedDateSpot,
    curatedDateTips: localizeReasons(match.curatedDateTips, locale),
    overlapSlots: match.overlapSlots,
    confirmedSlot: match.confirmedSlot,
    proposedSlots: match.proposedSlots,
    proposedPlace: match.proposedPlace,
    acceptances: match.acceptances,
    dateConfirmations: match.dateConfirmations,
    feedback: [],
  };
}

async function publicMatchView(match: MatchRecord, user: StudentProfile) {
  const partnerId = match.userAId === user.id ? match.userBId : match.userAId;
  const partner = await getStudentById(partnerId);
  const university = partner ? await getUniversityById(partner.universityId) : undefined;
  const locale = user.preferredLocale ?? "en";
  return {
    match: publicMatch(match, user.id, locale),
    partner: partner ? publicPartner(partner, university, match, locale) : null,
    university: university ?? null,
  };
}

// Get current active match for the authenticated user
matchingRouter.get("/current", requireAuth, async (req, res) => {
  const userId = req.auth!.sub;
  const user = await getStudentById(userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  const matches = await getMatchesForUser(userId);
  const match = matches.find(
    (m) =>
      (m.userAId === userId || m.userBId === userId) &&
      [
        "pending",
        "notified",
        "awaiting-acceptance",
        "mutual-accepted",
        "slot-proposing",
        "slot-confirmed",
        "place-confirmed",
        "scheduled",
        "awaiting-availability",
      ].includes(m.status)
  );
  if (!match) return res.json({ matchView: null });
  res.json({ matchView: await publicMatchView(match, user) });
});

// All matches for the authenticated user (active + history), with partner profiles
matchingRouter.get("/all", requireAuth, async (req, res) => {
  const userId = req.auth!.sub;
  const user = await getStudentById(userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  const matches = await getMatchesForUser(userId);
  const items = await Promise.all(matches.map((match) => publicMatchView(match, user)));
  res.json({ matches: items });
});

// Preview top candidates for the authenticated user (for tuning, no DB writes)
matchingRouter.get("/preview", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const me = db.students.find((s) => s.id === req.auth!.sub);
  if (!me) return res.status(404).json({ error: "User not found." });
  const pool = poolFor(me, db.students);
  const useLlm = req.query.llm === "1";
  const ranked = await rankCandidatesFor(me, pool, db, { useLlmJudge: useLlm, topK: 5 });
  res.json({
    user: { id: me.id, name: me.fullName },
    candidates: ranked.map((r) => ({
      candidate: { id: r.candidate.id, name: r.candidate.fullName, university: r.candidate.universityId },
      structuredScore: r.structured.total,
      threshold: r.structured.threshold,
      passedThreshold: r.structured.passedThreshold,
      breakdown: r.structured,
      finalScore: r.finalScore,
      llm: r.llm,
    })),
  });
});

// Admin/cron-triggered: run a matchmaking round.
matchingRouter.post("/run", requireAdmin, async (req, res) => {
  const schema = z.object({
    adminSecret: z.string().optional(),
    useLlmJudge: z.boolean().default(true),
    minStructuredScore: z.number().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });
  // require admin secret in non-dev
  // (In MVP we still allow no-secret to keep demo simple; protect properly later.)
  callBudget.reset();
  const db = await ensureDb();
  const result = await runWeeklyMatchmaking(db, {
    useLlmJudge: parsed.data.useLlmJudge,
    minStructuredScore: parsed.data.minStructuredScore,
  });
  await saveDb(db);
  res.json({
    ok: true,
    created: result.created.length,
    skipped: result.skippedNoCandidate.length,
    matches: result.created.map((m) => ({ id: m.id, a: m.userAId, b: m.userBId, score: m.score })),
    llmCalls: callBudget.count(),
  });
});
