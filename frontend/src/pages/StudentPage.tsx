import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import type { Locale, MatchRecord, PublicMatchPartner, StudentProfile, University, ProfileAnalysis, DatingPreferences } from "../types";
import { SectionCard } from "../components/SectionCard";
import { User, Heart, ArrowLeft, X, Ruler, Calendar, Sparkles, Target, Flame, Pencil, Copy, Check, MapPin, Users, Clock, Ticket, ArrowRight } from "lucide-react";
import heroImg from "../assets/hero.png";
import galleryImg from "../assets/gallery.png";
import dateSpotImg from "../assets/date-spot.png";
import campusBg from "../assets/campus-bg.png";

type Tab = "profile" | "matches" | "events" | "persona";
const PREFERRED_LOCALES: Locale[] = ["en", "zh-HK", "zh-CN"];
const EVENT_IMAGES = [dateSpotImg, galleryImg, heroImg, campusBg];
const EVENT_CONTACTS = [
  { name: "Jackie", wechat: "aaa1yyy133", whatsapp: "+852 44608721" },
  { name: "Liangchen", wechat: "chenchenlove_3010", whatsapp: "+852 54862050" },
];

function toSupportedLocale(value: string | undefined | null, fallback: Locale = "en"): Locale {
  return PREFERRED_LOCALES.includes(value as Locale) ? value as Locale : fallback;
}

function fixedT(t: (k: string, o?: any) => string, locale: Locale) {
  return (key: string, options?: any) => {
    if (typeof options === "string") return t(key, { defaultValue: options, lng: locale });
    return t(key, { ...(options ?? {}), lng: locale });
  };
}

const OPTION_ALIASES: Record<string, string> = {
  fast: "mode_fast",
  mode_fast: "mode_fast",
  modefast: "mode_fast",
  balanced: "mode_balanced",
  mode_balanced: "mode_balanced",
  intentional: "mode_intentional",
  mode_intentional: "mode_intentional",
  wait: "mode_wait",
  wait_for_the_one: "mode_wait",
  mode_wait: "mode_wait",
};

function toHkText(text: string) {
  return text
    .replace(/根据/g, "根據")
    .replace(/你的/g, "您嘅")
    .replace(/你在/g, "您喺")
    .replace(/你/g, "您")
    .replace(/属于/g, "屬於")
    .replace(/心动/g, "心動")
    .replace(/烟花师/g, "煙花師")
    .replace(/温柔/g, "溫柔")
    .replace(/读心师/g, "讀心師")
    .replace(/胶片/g, "菲林")
    .replace(/浪漫家/g, "浪漫家")
    .replace(/守护者/g, "守護者")
    .replace(/灰阶/g, "灰階")
    .replace(/恋爱/g, "戀愛")
    .replace(/感情中/g, "感情入面")
    .replace(/追求/g, "追求")
    .replace(/深度与真实/g, "深度同真實")
    .replace(/深度和真实/g, "深度同真實")
    .replace(/连接/g, "連結")
    .replace(/表达/g, "表達")
    .replace(/方式/g, "方式")
    .replace(/独特/g, "獨特")
    .replace(/温度/g, "溫度")
    .replace(/优势/g, "優勢")
    .replace(/注意雷区/g, "注意位")
    .replace(/雷区/g, "注意位")
    .replace(/把/g, "將")
    .replace(/过成/g, "變成")
    .replace(/每天/g, "每日")
    .replace(/都有/g, "都有")
    .replace(/新惊喜/g, "新驚喜")
    .replace(/优点/g, "優點")
    .replace(/无限/g, "無限")
    .replace(/放大/g, "放大")
    .replace(/用力赞美/g, "用力讚美")
    .replace(/情绪/g, "情緒")
    .replace(/饱满/g, "飽滿")
    .replace(/让您时刻/g, "令您時刻")
    .replace(/开始/g, "開始")
    .replace(/很多事/g, "好多事")
    .replace(/却/g, "但")
    .replace(/完成不了/g, "完成唔到")
    .replace(/包括/g, "包括")
    .replace(/喜欢/g, "鍾意")
    .replace(/自由/g, "自由")
    .replace(/被管太紧/g, "被管得太緊")
    .replace(/会窒息/g, "會窒息")
    .replace(/起伏大/g, "起伏大")
    .replace(/灵魂/g, "靈魂")
    .replace(/共鸣/g, "共鳴")
    .replace(/当下/g, "當下")
    .replace(/心安港湾/g, "心安港灣")
    .replace(/派/g, "派")
    .replace(/未定义/g, "未定義")
    .replace(/艺术/g, "藝術")
    .replace(/展/g, "展")
    .replace(/散步/g, "散步")
    .replace(/聊/g, "傾")
    .replace(/故事/g, "故事")
    .replace(/安静/g, "安靜")
    .replace(/风格/g, "風格")
    .replace(/风/g, "風");
}

function localizeDisplayText(text: string | undefined, locale: Locale, t?: (k: string, o?: any) => string) {
  if (!text) return "";
  const normalized = text.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const optionKey = OPTION_ALIASES[normalized];
  if (optionKey && t) return t(`onboarding.opt.${optionKey}`, { defaultValue: text });
  return locale === "zh-HK" ? toHkText(text) : text;
}

function localeMismatch(text: string | undefined, locale: Locale) {
  if (!text) return false;
  if (locale === "en") return /^[\u4e00-\u9fff]/.test(text);
  if (locale === "zh-CN") return /嘅|喺|唔|佢|點|係|鍾意|戀愛|個人檔案/.test(text) || /^[A-Za-z]/.test(text);
  if (locale === "zh-HK") return /这|个|们|属|爱|师|与|连|实|独|温|优|势|区|过|会|让|为|说|边|间|开/.test(text) || /^[A-Za-z]/.test(text);
  return false;
}

function personaAnalysisTooShort(text: string | undefined, locale: Locale) {
  if (!text) return true;
  const plain = text.replace(/\s+/g, "");
  return locale.startsWith("zh") ? plain.length < 70 : text.trim().split(/\s+/).length < 55;
}

type MatchView = {
  match: MatchRecord;
  partner: PublicMatchPartner;
  university?: University;
};

type CampusEvent = {
  id: string;
  title: string;
  category: string;
  status: string;
  date: string;
  location: string;
  capacity: number;
  joined: number;
  tags: string[];
  summary: string;
  content: string[];
  schedule: Array<{ time: string; title: string; desc: string }>;
  cta: string;
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function formatMbti(val?: string) {
  if (!val || typeof val !== "string") return "";
  const slug = val.split(".").pop()?.replace("mbti_", "");
  if (!slug || slug === "none") return "";
  return slug[0].toUpperCase();
}

function getMbtiString(mbti?: DatingPreferences["mbti"]) {
  if (!mbti) return null;
  const letters = [
    formatMbti(mbti.energy),
    formatMbti(mbti.information),
    formatMbti(mbti.decision),
    formatMbti(mbti.lifestyle),
  ].filter(Boolean);
  return letters.length >= 2 ? letters.join("") : null;
}

function getAge(birthday?: string) {
  if (!birthday) return null;
  const diff = Date.now() - new Date(birthday).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function statusLabel(status: string, t: (k: string, o?: any) => string) {
  const map: Record<string, { key: string; fallback: string; color: string }> = {
    pending: { key: "pending", fallback: "Pending", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    notified: { key: "notified", fallback: "Notified", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
    "awaiting-acceptance": { key: "awaiting", fallback: "Awaiting", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    "mutual-accepted": { key: "accepted", fallback: "Accepted", color: "text-green-400 bg-green-400/10 border-green-400/20" },
    declined: { key: "declined", fallback: "Declined", color: "text-red-400 bg-red-400/10 border-red-400/20" },
    "slot-proposing": { key: "scheduling", fallback: "Scheduling", color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
    "slot-confirmed": { key: "confirmed", fallback: "Confirmed", color: "text-green-400 bg-green-400/10 border-green-400/20" },
    "place-confirmed": { key: "placeSet", fallback: "Place Set", color: "text-green-400 bg-green-400/10 border-green-400/20" },
    scheduled: { key: "scheduled", fallback: "Scheduled", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    happened: { key: "happened", fallback: "Happened", color: "text-pink-400 bg-pink-400/10 border-pink-400/20" },
    "feedback-collected": { key: "complete", fallback: "Complete", color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
    closed: { key: "closed", fallback: "Closed", color: "text-white/30 bg-white/5 border-white/10" },
  };
  const item = map[status];
  return item
    ? { text: t(`student.status.${item.key}`, { defaultValue: item.fallback }), color: item.color }
    : { text: status, color: "text-white/40 bg-white/5 border-white/10" };
}

function viewerStatusLabel(match: MatchRecord, viewerId: string, t: (k: string, o?: any) => string) {
  const myAcceptance = match.acceptances?.find((item) => item.userId === viewerId);
  if (myAcceptance?.choice === "yes") {
    return {
      text: t("student.status.accepted", { defaultValue: "Accepted" }),
      color: "text-green-400 bg-green-400/10 border-green-400/20",
    };
  }
  if (myAcceptance?.choice === "no") {
    return {
      text: t("student.status.declined", { defaultValue: "Declined" }),
      color: "text-red-400 bg-red-400/10 border-red-400/20",
    };
  }
  return statusLabel(match.status, t);
}

function getNextDropTime() {
  const now = new Date();
  const next = new Date();
  const day = now.getDay();
  const diff = (3 - day + 7) % 7 || 7;
  next.setDate(now.getDate() + diff);
  next.setHours(19, 0, 0, 0);
  return next.getTime();
}

function tOpt(t: (k: string, o?: any) => string, val: string) {
  if (!val) return "";
  if (val.includes(".")) return t(val);
  const normalized = val.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const key = OPTION_ALIASES[normalized] ?? normalized;
  return t(`onboarding.opt.${key}`, { defaultValue: val });
}

/* ─── 8 LDFR Archetype Data (bilingual) ─── */
const LDFR_ARCHETYPES: Record<string, {
  emoji: string; nameZh: string; nameEn: string;
  taglineZh: string; taglineEn: string;
  campZh: string; campEn: string; mbti: string;
  traitsZh: string[]; traitsEn: string[];
  strengthsZh: string[]; strengthsEn: string[];
  trapsZh: string[]; trapsEn: string[];
  flirtSignalsZh: string[]; flirtSignalsEn: string[];
  dateSpotsZh: string[]; dateSpotsEn: string[];
  sparkMomentZh: string; sparkMomentEn: string;
}> = {
  LFF: {
    emoji: "🎆", nameZh: "心动烟花师", nameEn: "Firework",
    taglineZh: "一秒爱上您，一秒爱上世界", taglineEn: "Falls in love in a heartbeat — with you, and the whole world",
    campZh: "灵魂共鸣派", campEn: "Soul Resonance", mbti: "ENFP",
    traitsZh: ["热情", "自由", "善变", "灵感型", "易心动"],
    traitsEn: ["Passionate", "Free-spirited", "Changeable", "Inspired", "Easily smitten"],
    strengthsZh: ["把恋爱过成冒险，每天都有新惊喜", "对您的优点会无限放大、用力赞美", "情绪饱满，让您时刻「被爱着」"],
    strengthsEn: ["Turns love into an adventure with daily surprises", "Amplifies your strengths and showers you with praise", "Emotionally rich — you'll always feel loved"],
    trapsZh: ["容易「开始很多事却完成不了」，包括感情", "喜欢自由，被管太紧会窒息", "情绪起伏大"],
    trapsEn: ["Starts many things but finishes few — including relationships", "Needs freedom; feels suffocated when controlled", "Big emotional swings"],
    flirtSignalsZh: ["突然分享一首很私人的歌", "半夜 12 点发来语音长消息", "计划一堆「以后一起去」的地方"],
    flirtSignalsEn: ["Suddenly shares a deeply personal song", "Sends long voice messages at midnight", "Plans tons of 'let's go there someday' places"],
    dateSpotsZh: ["Live House", "探店", "市集", "艺术展", "凌晨便利店"],
    dateSpotsEn: ["Live House", "Café hopping", "Night market", "Art exhibit", "Late-night convenience store"],
    sparkMomentZh: "在人群中央讲故事，全场都在笑，TA 突然抬头跟您对到眼。",
    sparkMomentEn: "Telling a story in a crowd, everyone laughing — then locking eyes with you.",
  },
  LFS: {
    emoji: "🌟", nameZh: "温柔造梦家", nameEn: "Dreamer",
    taglineZh: "想把您雕成您最好的样子", taglineEn: "Wants to sculpt you into your best self",
    campZh: "灵魂共鸣派", campEn: "Soul Resonance", mbti: "ENFJ",
    traitsZh: ["温暖", "引导型", "高情商", "占有欲", "付出型"],
    traitsEn: ["Warm", "Guiding", "High EQ", "Possessive", "Giving"],
    strengthsZh: ["沟通力 max，从来不让您猜", "真心希望您变得更好，会推动您成长", "把关系经营得有节奏、有仪式感"],
    strengthsEn: ["Top-tier communicator — never leaves you guessing", "Genuinely wants you to grow and pushes you forward", "Builds the relationship with rhythm and ceremony"],
    trapsZh: ["容易把「我对您好」变成「您应该听我的」", "占有欲，特别是觉得被忽视时", "会过度投入到怀疑自我"],
    trapsEn: ["'I'm doing this for you' can become 'you should listen to me'", "Gets possessive, especially when feeling ignored", "Over-invests to the point of self-doubt"],
    flirtSignalsZh: ["记得您随口提过的小喜好", "主动帮您解决您没说出口的麻烦", "会「教」您做某件事，借机肢体接触"],
    flirtSignalsEn: ["Remembers tiny preferences you mentioned once", "Proactively solves problems you didn't voice", "Teaches you something as an excuse for physical contact"],
    dateSpotsZh: ["仪式感晚餐", "陶艺/调酒课", "深夜散步聊心事"],
    dateSpotsEn: ["Elegant dinner", "Pottery / cocktail class", "Late-night walk & deep talk"],
    sparkMomentZh: "在您低潮时，一句话戳穿您的心事，然后什么都不说，只是抱住您。",
    sparkMomentEn: "When you're down, they see right through you with one sentence — then just hold you without a word.",
  },
  LRF: {
    emoji: "✨", nameZh: "聚光灯精灵", nameEn: "Spotlight",
    taglineZh: "TA 在的地方，永远是 party", taglineEn: "Wherever they are, it's always a party",
    campZh: "当下心动派", campEn: "In-the-Moment", mbti: "ESFP",
    traitsZh: ["热闹", "当下主义", "感官敏锐", "行动派", "戏剧化"],
    traitsEn: ["Energetic", "Lives in the now", "Sensory-sharp", "Action-driven", "Dramatic"],
    strengthsZh: ["跟 TA 在一起永远不会闷", "当下投入度 max", "情感表达直接，喜欢您就让全世界知道"],
    strengthsEn: ["Never a dull moment with them", "100% present in the moment", "Expresses feelings directly — likes you and lets the world know"],
    trapsZh: ["对未来缺乏 plan", "容易冲动决定（包括分手）", "喜欢被关注"],
    trapsEn: ["Lacks long-term planning", "Impulsive decisions (including breakups)", "Craves attention"],
    flirtSignalsZh: ["在您面前 energy 比平时高 30%", "会「借口」靠近您", "突然带您去 TA 觉得超棒但很少人知道的地方"],
    flirtSignalsEn: ["Energy goes up 30% around you", "Finds excuses to get close", "Takes you to amazing hidden spots"],
    dateSpotsZh: ["演唱会", "主题乐园", "密室逃脱", "即兴旅行"],
    dateSpotsEn: ["Concert", "Theme park", "Escape room", "Spontaneous trip"],
    sparkMomentZh: "在 dancefloor 上转过头朝您伸出手的瞬间。",
    sparkMomentEn: "Turning around on the dance floor and reaching out their hand to you.",
  },
  LRS: {
    emoji: "☀️", nameZh: "人间小太阳", nameEn: "Little Sun",
    taglineZh: "把您照顾到，连您妈都满意", taglineEn: "Takes care of you so well, even your mom approves",
    campZh: "心安港湾派", campEn: "Safe Harbor", mbti: "ESFJ",
    traitsZh: ["温暖", "周到", "社交达人", "重视家庭", "传统派"],
    traitsEn: ["Warm", "Thoughtful", "Social butterfly", "Family-oriented", "Traditional"],
    strengthsZh: ["顶级 caretaker，从您的胃到衣柜都管好", "把您的家人朋友变成「我们的」", "节日仪式感拉满，记得每一个纪念日"],
    strengthsEn: ["Ultimate caretaker — from your stomach to your wardrobe", "Turns your family and friends into 'ours'", "Never misses an anniversary or celebration"],
    trapsZh: ["会用「为您好」包装控制欲", "太在乎别人怎么看", "容易牺牲自己维持表面和谐"],
    trapsEn: ["Wraps controlling behavior in 'it's for your own good'", "Cares too much about others' opinions", "Sacrifices self to keep surface-level peace"],
    flirtSignalsZh: ["主动照顾您的生活细节", "邀请您参加 TA 的家庭聚会", "记得您随口提过的过敏/喜好"],
    flirtSignalsEn: ["Proactively takes care of life's little details for you", "Invites you to family gatherings", "Remembers your allergies and preferences you once mentioned"],
    dateSpotsZh: ["亲手做的家常菜", "烹饪课", "一起看望家人"],
    dateSpotsEn: ["Home-cooked meal", "Cooking class", "Visiting family together"],
    sparkMomentZh: "您病了一整夜，醒来发现 TA 已经熬好粥、关好窗、把药放在床头。",
    sparkMomentEn: "You're sick all night, and wake up to find they've made congee, closed the windows, and left medicine on your nightstand.",
  },
  DFF: {
    emoji: "🌙", nameZh: "月光诗人", nameEn: "Moon Poet",
    taglineZh: "把您写进诗里，但不会念给您听", taglineEn: "Writes you into poetry but never reads it aloud",
    campZh: "灵魂共鸣派", campEn: "Soul Resonance", mbti: "INFP",
    traitsZh: ["理想化", "内向", "深情", "价值观至上", "想象力丰富"],
    traitsEn: ["Idealistic", "Introverted", "Deeply loving", "Values-driven", "Imaginative"],
    strengthsZh: ["一旦爱上，深情得让人心疼", "拥有最浪漫的内心世界", "对关系有近乎信仰的忠诚"],
    strengthsEn: ["Once in love, devotion is heartbreakingly deep", "Has the most romantic inner world", "Loyalty to the relationship borders on faith"],
    trapsZh: ["对爱情期待过高", "不擅直接表达", "容易把对方理想化，幻灭时痛得很深"],
    trapsEn: ["Sets the bar for love impossibly high", "Struggles with direct expression", "Idealizes partners; disillusionment hits hard"],
    flirtSignalsZh: ["把私人歌单/书/电影分享给您", "信息很短但用词很讲究", "突然写一段「灵感」发给您"],
    flirtSignalsEn: ["Shares personal playlists / books / films with you", "Messages are short but every word is chosen", "Sends you a random 'inspired' piece of writing"],
    dateSpotsZh: ["独立书店", "旧物市集", "美术馆", "雨天咖啡馆"],
    dateSpotsEn: ["Indie bookstore", "Vintage market", "Art gallery", "Rainy-day café"],
    sparkMomentZh: "凌晨突然跟您分享一句歌词：「觉得这句很像您」。",
    sparkMomentEn: "At 3 AM, sharing a lyric with you: 'This line reminds me of you.'",
  },
  DFS: {
    emoji: "🌌", nameZh: "深海读心师", nameEn: "Deep Sea Reader",
    taglineZh: "您还没开口，TA 已经懂了一半", taglineEn: "Understands you before you even speak",
    campZh: "灵魂共鸣派", campEn: "Soul Resonance", mbti: "INFJ",
    traitsZh: ["神秘", "共情力极强", "安静", "高标准", "深度型"],
    traitsEn: ["Mysterious", "Extremely empathetic", "Quiet", "High standards", "Deep thinker"],
    strengthsZh: ["世界上最好的倾听者", "能 read 到您自己都没意识到的情绪", "对感情极度认真"],
    strengthsEn: ["The world's best listener", "Reads emotions you didn't even know you had", "Takes relationships extremely seriously"],
    trapsZh: ["门槛很高，能进 TA 心的人很少", "一旦关上心门，很难再打开", "对完美关系的追求让现实关系压力很大"],
    trapsEn: ["Very high barrier to entry — few get into their heart", "Once the door closes, it rarely reopens", "Pursuit of the perfect relationship adds pressure"],
    flirtSignalsZh: ["突然问您一个超级深的问题", "记得您三个月前随口说的细节", "选择性地跟您分享从不告诉别人的事"],
    flirtSignalsEn: ["Suddenly asks a deeply personal question", "Remembers a detail you mentioned 3 months ago", "Selectively shares things they've never told anyone"],
    dateSpotsZh: ["深夜酒吧角落", "长程散步", "心理测试", "安静有故事的小馆子"],
    dateSpotsEn: ["Quiet corner of a late-night bar", "Long walk", "Personality quiz", "Cozy hidden restaurant"],
    sparkMomentZh: "您以为 TA 没听见，第二天 TA 用最准的方式回应了您最隐秘的感受。",
    sparkMomentEn: "You thought they didn't hear — the next day they respond to your deepest feeling with perfect precision.",
  },
  DRF: {
    emoji: "📷", nameZh: "胶片浪漫家", nameEn: "Film Romantic",
    taglineZh: "用一张照片、一首歌，悄悄爱您", taglineEn: "Loves you quietly through a photo, a song",
    campZh: "当下心动派", campEn: "In-the-Moment", mbti: "ISFP",
    traitsZh: ["艺术敏感", "当下主义", "安静温柔", "直觉型", "不爱被定义"],
    traitsEn: ["Artistically sensitive", "Lives in the now", "Quietly gentle", "Intuitive", "Hates being labeled"],
    strengthsZh: ["会用自己的方式记录您", "不给您压力，让您觉得自由", "感官敏锐，约会细节都很有感觉"],
    strengthsEn: ["Documents you in their own special way", "Gives you space and freedom", "Sensory-sharp — every date detail feels curated"],
    trapsZh: ["不擅长讲「我爱您」", "价值观被冒犯时会突然消失", "不喜欢长远规划"],
    trapsEn: ["Struggles to say 'I love you'", "Disappears when values are offended", "Avoids long-term planning"],
    flirtSignalsZh: ["给您拍了照片但不发出来，自己存着", "把喜欢的小东西默默放到您包里", "用作品/创作间接表白"],
    flirtSignalsEn: ["Takes photos of you but keeps them private", "Quietly slips small gifts into your bag", "Confesses indirectly through creative work"],
    dateSpotsZh: ["Vinyl 店", "古着店", "一起拍胶片", "海边看夜景"],
    dateSpotsEn: ["Vinyl shop", "Vintage store", "Film photography together", "Night view by the sea"],
    sparkMomentZh: "把 TA 平时戴的项链/耳机/帽子悄悄给您。",
    sparkMomentEn: "Quietly gives you the necklace / earbuds / hat they always wear.",
  },
  DRS: {
    emoji: "🕯️", nameZh: "暖光守护者", nameEn: "Warm Guardian",
    taglineZh: "不擅言辞，但您冷了 TA 一定知道", taglineEn: "Not great with words, but always knows when you're cold",
    campZh: "心安港湾派", campEn: "Safe Harbor", mbti: "ISFJ",
    traitsZh: ["温柔", "默默付出", "责任感强", "念旧", "安静稳定"],
    traitsEn: ["Gentle", "Quietly devoted", "Responsible", "Nostalgic", "Calm & steady"],
    strengthsZh: ["真正「细水长流」型恋人", "把承诺当生命，说要照顾您就一辈子", "记得您所有的小细节"],
    strengthsEn: ["The true 'slow burn' lover", "Treats promises as sacred — commits for life", "Remembers every small detail about you"],
    trapsZh: ["太会忍，把负面情绪憋到爆炸", "不擅长「被照顾」", "一旦失望累积，会安静地走"],
    trapsEn: ["Bottles up emotions until they explode", "Struggles with being taken care of", "When disappointment accumulates, leaves quietly"],
    flirtSignalsZh: ["默默记下您说的每一句喜好", "在您需要时刚好出现", "看您的眼神特别久、特别温"],
    flirtSignalsEn: ["Silently memorizes every preference you mention", "Shows up right when you need them", "Looks at you with an extra-long, warm gaze"],
    dateSpotsZh: ["家里做饭", "看老电影", "散步", "安静的下午茶"],
    dateSpotsEn: ["Cooking at home", "Classic movies", "A quiet walk", "Peaceful afternoon tea"],
    sparkMomentZh: "您哭得不行的时候，TA 一句话也不说，把您抱住，让您哭完。",
    sparkMomentEn: "When you can't stop crying, they say nothing — just hold you and let you cry it out.",
  },
  GREY: {
    emoji: "🌫️", nameZh: "灰阶人格", nameEn: "Grey Persona",
    taglineZh: "您不属于任何一类，您是所有类的交汇点", taglineEn: "You don't belong to any single type — you're where they all converge",
    campZh: "未定义", campEn: "Undefined", mbti: "—",
    traitsZh: ["适应力强", "多面", "灵活", "难以被定义", "复杂"],
    traitsEn: ["Adaptive", "Multi-faceted", "Flexible", "Hard to define", "Complex"],
    strengthsZh: ["极强的适应力，能切换不同恋爱模式", "复杂而立体，很难被看透", "能与任何类型产生共鸣"],
    strengthsEn: ["Extremely adaptable — can switch between love styles", "Complex and layered, hard to see through", "Can resonate with any type"],
    trapsZh: ["自己也不确定想要什么", "容易在不同模式间迷失", "让对方难以判断您的真实需求"],
    trapsEn: ["Not sure what they really want", "Easily lost between different modes", "Hard for partners to read their true needs"],
    flirtSignalsZh: ["因场景不同而完全不同", "有时像烟花一样热烈，有时像诗人一样安静", "让人猜不透但又放不下"],
    flirtSignalsEn: ["Completely different depending on the setting", "Sometimes fiery like fireworks, sometimes quiet like a poet", "Impossible to figure out but impossible to let go"],
    dateSpotsZh: ["让对方决定", "任何地方都行", "关键是人对了"],
    dateSpotsEn: ["Let the other person decide", "Anywhere works", "It's about the person, not the place"],
    sparkMomentZh: "对方突然说「我从来没遇过像您这样的人」。",
    sparkMomentEn: "When they suddenly say, 'I've never met anyone like you.'",
  },
};

/* Helper to pick and lightly localize archetype fields */
function archL<T extends string | string[]>(locale: string, zh: T, en: T): T {
  if (!locale.startsWith("zh")) return en;
  if (locale === "zh-HK") {
    return (Array.isArray(zh) ? zh.map(toHkText) : toHkText(zh)) as T;
  }
  return zh;
}

/* ─── LDFR Compatibility Matrix ─── */
const LDFR_COMPAT: Record<string, Record<string, number>> = {
  LFF: { LFF: 4, LFS: 5, LRF: 4, LRS: 3, DFF: 5, DFS: 4, DRF: 3, DRS: 2 },
  LFS: { LFF: 5, LFS: 4, LRF: 3, LRS: 4, DFF: 5, DFS: 5, DRF: 3, DRS: 4 },
  LRF: { LFF: 4, LFS: 3, LRF: 4, LRS: 5, DFF: 2, DFS: 3, DRF: 5, DRS: 3 },
  LRS: { LFF: 3, LFS: 4, LRF: 5, LRS: 5, DFF: 3, DFS: 4, DRF: 3, DRS: 5 },
  DFF: { LFF: 5, LFS: 5, LRF: 2, LRS: 3, DFF: 5, DFS: 5, DRF: 4, DRS: 3 },
  DFS: { LFF: 4, LFS: 5, LRF: 3, LRS: 4, DFF: 5, DFS: 4, DRF: 3, DRS: 4 },
  DRF: { LFF: 3, LFS: 3, LRF: 5, LRS: 3, DFF: 4, DFS: 3, DRF: 4, DRS: 4 },
  DRS: { LFF: 2, LFS: 4, LRF: 3, LRS: 5, DFF: 3, DFS: 4, DRF: 4, DRS: 5 },
};

const LDFR_COVERS: Record<string, { bg: string; glow: string; symbol: string; label: string }> = {
  LFF: {
    bg: "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.95) 0 4%, rgba(255,51,136,0.8) 5% 8%, transparent 9%), radial-gradient(circle at 50% 42%, rgba(255,0,102,0.42), transparent 38%), linear-gradient(145deg, #300022, #17003b 58%, #071541)",
    glow: "shadow-aura/40",
    symbol: "✹",
    label: "Firework",
  },
  LFS: {
    bg: "radial-gradient(circle at 45% 35%, rgba(255,250,205,0.9), transparent 12%), radial-gradient(circle at 70% 70%, rgba(255,0,102,0.28), transparent 30%), linear-gradient(145deg, #4a214d, #151642 58%, #09172e)",
    glow: "shadow-pink-300/30",
    symbol: "✦",
    label: "Dreamer",
  },
  LRF: {
    bg: "conic-gradient(from 210deg at 50% 25%, rgba(255,236,120,0.8), transparent 18%, rgba(55,163,255,0.42), transparent 50%), linear-gradient(145deg, #1d1246, #07172f 65%, #050814)",
    glow: "shadow-yellow-300/25",
    symbol: "✧",
    label: "Spotlight",
  },
  LRS: {
    bg: "radial-gradient(circle at 50% 48%, rgba(255,238,138,0.95), rgba(255,177,65,0.58) 18%, transparent 38%), linear-gradient(145deg, #3d1908, #1a2c34 62%, #07162b)",
    glow: "shadow-amber-300/30",
    symbol: "☀",
    label: "Little Sun",
  },
  DFF: {
    bg: "radial-gradient(circle at 38% 38%, rgba(255,245,188,0.92), transparent 12%), radial-gradient(circle at 62% 62%, rgba(176,119,255,0.24), transparent 34%), linear-gradient(145deg, #180b37, #06152d 68%, #020617)",
    glow: "shadow-indigo-300/25",
    symbol: "☾",
    label: "Moon Poet",
  },
  DFS: {
    bg: "radial-gradient(circle at 50% 78%, rgba(69,191,255,0.36), transparent 35%), radial-gradient(circle at 45% 30%, rgba(255,255,255,0.78), transparent 4%), linear-gradient(145deg, #061b3c, #020617 60%, #000b1f)",
    glow: "shadow-cyan-300/25",
    symbol: "◇",
    label: "Deep Sea",
  },
  DRF: {
    bg: "radial-gradient(circle at 35% 36%, rgba(255,255,255,0.75), transparent 9%), radial-gradient(circle at 68% 68%, rgba(255,0,102,0.22), transparent 32%), linear-gradient(145deg, #2f1a24, #141226 55%, #061728)",
    glow: "shadow-rose-300/25",
    symbol: "◈",
    label: "Film",
  },
  DRS: {
    bg: "radial-gradient(circle at 50% 38%, rgba(255,239,190,0.95), rgba(255,181,96,0.42) 16%, transparent 34%), linear-gradient(145deg, #2d1c18, #101932 58%, #050814)",
    glow: "shadow-orange-300/25",
    symbol: "✧",
    label: "Warm",
  },
  GREY: {
    bg: "radial-gradient(circle at 45% 45%, rgba(255,255,255,0.42), transparent 26%), linear-gradient(145deg, #30313d, #111827 58%, #050814)",
    glow: "shadow-slate-300/20",
    symbol: "○",
    label: "Grey",
  },
};

function LdfrCover({ code, size = "lg" }: { code: string; size?: "sm" | "lg" }) {
  const cover = LDFR_COVERS[code] ?? LDFR_COVERS.GREY;
  const isSmall = size === "sm";
  return (
    <div
      className={`relative overflow-hidden border border-white/15 bg-white/5 shadow-2xl ${cover.glow} ${
        isSmall ? "h-14 w-14 rounded-2xl" : "h-44 w-44 rounded-[2.25rem] md:h-52 md:w-52"
      }`}
      style={{ background: cover.bg }}
      aria-label={cover.label}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0,rgba(255,255,255,0.08)_1px,transparent_2px)] [background-size:18px_18px] opacity-60" />
      <div className="absolute -left-1/4 top-1/4 h-2/3 w-2/3 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -right-1/4 bottom-0 h-2/3 w-2/3 rounded-full bg-aura/20 blur-2xl" />
      <div className={`absolute inset-0 flex items-center justify-center font-black text-white drop-shadow-2xl ${isSmall ? "text-3xl" : "text-7xl md:text-8xl"}`}>
        {cover.symbol}
      </div>
      {!isSmall && (
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-black tracking-[0.25em] text-white/80 backdrop-blur">{code}</span>
          <span className="text-xs font-black uppercase tracking-[0.22em] text-white/45">{cover.label}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Photo Gallery ─── */
function PhotoGallery({ photos }: { photos: string[] }) {
  const [active, setActive] = useState(0);
  if (!photos.length) return null;
  return (
    <div className="space-y-3">
      <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-white/5 border border-white/10 relative">
        <img src={photos[active]} alt="" className="w-full h-full object-cover" />
        {photos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.map((_, i) => (
              <button key={i} onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-white" : "w-1.5 bg-white/40"}`} />
            ))}
          </div>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`h-14 w-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${i === active ? "border-aura" : "border-white/10 opacity-60 hover:opacity-100"}`}>
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Info Chip ─── */
function InfoChip({ icon, label, value, color = "text-white/80" }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/10 p-4">
      <div className="text-white/45">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-wider text-white/38">{label}</div>
        <div className={`text-base font-black truncate ${color}`}>{value}</div>
      </div>
    </div>
  );
}

function ProfileSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 bg-gradient-to-r from-aura via-pink-300 to-harbour bg-clip-text text-sm font-black uppercase tracking-[0.24em] text-transparent">
      {children}
    </div>
  );
}

/* ─── Profile Analysis Card ─── */
function AnalysisCard({ analysis, t, locale }: { analysis: ProfileAnalysis; t: (k: string, o?: any) => string; locale: Locale }) {
  return (
    <SectionCard className="border-white/10 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-aura" />
          <span className="text-sm font-black uppercase tracking-[0.26em] text-aura/70">{t("student.profile.auraAnalysis")}</span>
        </div>
      </div>

      {analysis.romanticStyle && (
        <div className="rounded-2xl border border-aura/20 bg-aura/10 p-4">
          <div className="mb-1 text-sm font-black uppercase tracking-wider text-aura/70">{t("student.profile.romanticStyle")}</div>
          <div className="text-lg font-black text-aura">{localizeDisplayText(analysis.romanticStyle, locale, t)}</div>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {analysis.strengths?.length > 0 && (
          <div className="rounded-2xl border border-green-400/15 bg-green-400/[0.06] p-4">
            <div className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-green-300/75">{t("student.persona.strengths")}</div>
            <div className="flex flex-wrap gap-2">
              {analysis.strengths.map((s) => (
                <span key={s} className="rounded-xl border border-green-300/25 bg-green-300/10 px-4 py-2 text-base font-black text-green-300">{localizeDisplayText(s, locale, t)}</span>
              ))}
            </div>
          </div>
        )}

        {analysis.idealMatch && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-white/45">{t("student.profile.idealMatch")}</div>
            <p className="text-base font-medium leading-relaxed text-white/70">{localizeDisplayText(analysis.idealMatch, locale, t)}</p>
          </div>
        )}

        {analysis.conversationHooks?.length > 0 && (
          <div className="rounded-2xl border border-aura/15 bg-aura/[0.06] p-4">
            <div className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-aura/75">{t("student.profile.conversationStarters")}</div>
            <div className="flex flex-wrap gap-2">
              {analysis.conversationHooks.map((h) => (
                <span key={h} className="rounded-xl border border-aura/25 bg-aura/10 px-4 py-2 text-base font-black text-pink-200">{localizeDisplayText(h, locale, t)}</span>
              ))}
            </div>
          </div>
        )}

        {analysis.firstDateSuggestions?.length > 0 && (
          <div className="rounded-2xl border border-harbour/20 bg-harbour/[0.07] p-4">
            <div className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-harbour/80">{t("student.profile.firstDateIdeas")}</div>
            <div className="flex flex-wrap gap-2">
              {analysis.firstDateSuggestions.map((s) => (
                <span key={s} className="rounded-xl border border-harbour/25 bg-harbour/10 px-4 py-2 text-base font-black text-sky-200">{localizeDisplayText(s, locale, t)}</span>
              ))}
            </div>
          </div>
        )}

        {analysis.matchSignals?.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 lg:col-span-2">
            <div className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-white/45">{t("student.profile.matchSignals")}</div>
            <div className="flex flex-wrap gap-2">
              {analysis.matchSignals.map((s) => (
                <span key={s} className="rounded-xl border border-white/15 bg-white/[0.07] px-4 py-2 text-base font-black text-white/75">{localizeDisplayText(s, locale, t)}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/* ─── Inline Tag Row (compact) ─── */
function TagRow({ label, tags, color }: { label: string; tags: string[]; color: string }) {
  if (!tags.length) return null;
  return (
    <div className="flex items-start gap-4">
      <span className="mt-2 w-28 shrink-0 text-sm font-black uppercase tracking-wider text-white/50">{label}</span>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => <span key={tag} className={`rounded-xl px-4 py-2 text-base font-black ${color}`}>{tag}</span>)}
      </div>
    </div>
  );
}

/* ─── Profile Tab ─── */
function ProfileTab({
  profile,
  t,
  locale,
}: {
  profile: StudentProfile;
  t: (k: string, o?: any) => string;
  locale: Locale;
}) {
  const navigate = useNavigate();
  const dp = profile.datingPreferences;
  const photos = dp?.photoUrls?.filter((u) => u && u.length > 10) ?? [];
  const weekendVibes = profile.lifeSignals?.weekendVibes ?? [];
  const mbtiStr = getMbtiString(dp?.mbti);
  const age = getAge(dp?.birthday);
  const ldfrCode = profile.ldfrResult?.code;
  const ldfrArch = ldfrCode ? LDFR_ARCHETYPES[ldfrCode] : null;
  const hasIdealAppearance = Boolean(dp?.attractionSignals?.heightAndBuild);

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      {/* Left Column — Photo + Identity */}
      <div className="space-y-5">
        {photos.length > 0 ? (
          <PhotoGallery photos={photos} />
        ) : (
          <div className="aspect-[4/5] rounded-3xl bg-gradient-to-br from-aura/20 via-purple-900/20 to-harbour/20 border border-white/10 flex items-center justify-center">
            <div className="h-28 w-28 rounded-[40px] bg-gradient-to-br from-aura to-harbour flex items-center justify-center text-4xl font-black text-white shadow-2xl">
              {initials(profile.fullName)}
            </div>
          </div>
        )}
        <div className="text-center">
          <h2 className="text-2xl font-black tracking-tight">{profile.fullName}</h2>
          <div className="mt-1 text-white/40 font-medium text-sm">{profile.email}</div>
          {profile.major && <div className="mt-1 text-white/50 font-bold text-sm">{profile.major} · {profile.yearOfStudy}</div>}
        </div>
        <div className="flex items-center justify-between px-2">
          <span className="flex items-center gap-2 text-green-400 text-xs font-bold bg-green-400/10 px-3 py-1.5 rounded-full border border-green-400/20">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            {t("student.profile.activeInPool")}
          </span>
          <button onClick={() => navigate("/join")}
            className="flex items-center gap-2 text-xs font-black text-white/40 hover:text-aura border border-white/10 hover:border-aura/30 rounded-xl px-3 py-1.5 transition-all">
            <Pencil size={12} /> {t("student.profile.editProfile")}
          </button>
        </div>
      </div>

      {/* Right Column */}
      <div className="space-y-5">
        {/* Personal Info — compact grid */}
        <SectionCard className="border-white/10 shadow-2xl">
          <ProfileSectionTitle>{t("student.profile.personalInfo")}</ProfileSectionTitle>
          {ldfrArch && (
            <div className="mb-4 flex items-center gap-4 rounded-3xl border border-aura/30 bg-gradient-to-r from-aura/22 via-purple-500/15 to-harbour/20 p-4 shadow-2xl shadow-aura/10">
              <LdfrCover code={ldfrCode!} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="bg-gradient-to-r from-pink-200 via-aura to-harbour bg-clip-text text-3xl font-black tracking-[0.22em] text-transparent drop-shadow-[0_0_18px_rgba(255,0,102,0.35)]">{ldfrCode}</div>
                <div className="mt-1 text-lg font-black text-white/85">{archL(locale, ldfrArch.nameZh, ldfrArch.nameEn)}</div>
              </div>
              <Flame size={22} className="text-aura shrink-0" />
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {age && <InfoChip icon={<Calendar size={14} />} label={t("student.profile.age")} value={`${age}`} />}
            {profile.gender && <InfoChip icon={<User size={14} />} label={t("student.profile.gender")} value={tOpt(t, profile.gender)} />}
            {dp?.heightCm && <InfoChip icon={<Ruler size={14} />} label={t("student.profile.height")} value={`${dp.heightCm} cm`} />}
            {mbtiStr && <InfoChip icon={<Sparkles size={14} />} label="MBTI" value={mbtiStr} color="text-aura font-black tracking-[0.2em]" />}
            {dp?.datingGoal && <InfoChip icon={<Target size={14} />} label={t("student.profile.datingGoal")} value={tOpt(t, dp.datingGoal)} />}
          </div>
        </SectionCard>

        {/* AI Analysis */}
        {profile.profileAnalysis && <AnalysisCard analysis={profile.profileAnalysis} t={t} locale={locale} />}

        {/* About Me — public profile signals only. Bio is reserved for AI prompt context. */}
        <SectionCard className="border-white/10 shadow-2xl">
          <ProfileSectionTitle>{t("student.profile.aboutMe")}</ProfileSectionTitle>
          <div className="space-y-4">
            {dp?.hkMtrLocations?.length ? (
              <TagRow label={t("student.profile.location")} color="bg-emerald-400/10 border border-emerald-400/20 text-emerald-400"
                tags={dp.hkMtrLocations.map((loc) => tOpt(t, loc))} />
            ) : null}

            {profile.languages.length > 0 && (
              <TagRow label={t("student.languages")} color="bg-aura/10 border border-aura/20 text-aura"
                tags={profile.languages.map((lang) => lang.includes(".") ? t(lang) : t(`join.langs.${lang}`, { defaultValue: lang }))} />
            )}

            {profile.interests.length > 0 && (
              <TagRow label={t("join.interests")} color="bg-white/5 border border-white/10 text-aura italic"
                tags={profile.interests.map((tag) => `#${tag.includes(".") ? t(tag) : t(`join.tags.${tag}`, { defaultValue: tag })}`)} />
            )}

            {profile.vibeTags.length > 0 && (
              <TagRow label={t("student.profile.vibes")} color="bg-harbour/10 border border-harbour/20 text-harbour"
                tags={profile.vibeTags.map((tag) => tag.includes(".") ? t(tag) : t(`join.vibes.${tag}`, { defaultValue: tag }))} />
            )}

            {weekendVibes.length > 0 && (
              <TagRow label={t("student.profile.weekendVibes")} color="bg-pink-400/10 border border-pink-400/20 text-pink-400"
                tags={weekendVibes.map((v) => tOpt(t, v))} />
            )}

          </div>
        </SectionCard>

        {/* Preferences & Type — merged dating prefs + ideal type notes */}
        {(dp?.dateGenders?.length || dp?.datingGoals?.length || dp?.ageRange || dp?.matchMode || hasIdealAppearance) && (
          <SectionCard className="border-white/10 shadow-2xl">
            <ProfileSectionTitle>{t("student.profile.prefsAndType")}</ProfileSectionTitle>
            <div className="space-y-4">
              {dp?.dateGenders?.length ? (
                <TagRow label={t("student.profile.lookingFor")} color="bg-white/[0.07] border border-white/15 text-white/78"
                  tags={dp.dateGenders.map((g) => tOpt(t, g))} />
              ) : null}
              {dp?.datingGoals?.length ? (
                <TagRow label={t("student.profile.goals")} color="bg-aura/10 border border-aura/25 text-aura"
                  tags={dp.datingGoals.map((g) => tOpt(t, g))} />
              ) : null}
              {dp?.ageRange && (
                <div className="flex items-center gap-4">
                  <span className="w-28 shrink-0 text-sm font-black uppercase tracking-wider text-white/50">{t("student.profile.ageRange")}</span>
                  <span className="text-xl font-black text-white/78">{dp.ageRange.min} – {dp.ageRange.max}</span>
                </div>
              )}
              {dp?.matchMode && (
                <div className="flex items-center gap-4">
                  <span className="w-28 shrink-0 text-sm font-black uppercase tracking-wider text-white/50">{t("student.profile.matchMode")}</span>
                  <span className="text-xl font-black text-white/78">{tOpt(t, dp.matchMode)}</span>
                </div>
              )}
              {hasIdealAppearance && (
                <div className="border-t border-white/10 pt-4">
                  <div className="rounded-2xl border border-pink-300/20 bg-pink-300/[0.07] p-4">
                    <div className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-pink-300/75">{t("student.profile.heightBuild")}</div>
                    <div className="text-lg font-black leading-relaxed text-white/78">{dp!.attractionSignals!.heightAndBuild}</div>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

/* ─── Persona Tab (LDFR) ─── */
function PersonaTab({ profile, t, lang: currentLang, personaLoading, personaError, onRegenerate }: {
  profile: StudentProfile; t: (k: string, o?: any) => string; lang: string;
  personaLoading: boolean; personaError: string; onRegenerate: () => void;
}) {
  const ldfrResult = profile.ldfrResult;
  const ldfrAnswers = profile.onboardingAnswers?.onboarding_ldfr;
  const locale = toSupportedLocale(currentLang, "en");
  const isZh = locale.startsWith("zh");

  // No LDFR answers at all
  if (!ldfrAnswers) {
    return (
      <SectionCard className="flex flex-col items-center justify-center p-10 md:p-16 text-center relative overflow-hidden rounded-[48px] border-white/10 shadow-2xl">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-aura/10 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-harbour/10 blur-[100px] pointer-events-none" />
        <div className="text-6xl mb-8">🔮</div>
        <h2 className="text-2xl md:text-3xl font-black mb-4 tracking-tight">{t("student.persona.discoverTitle")}</h2>
        <p className="text-base text-white/50 max-w-lg leading-relaxed font-medium">
          {t("student.persona.discoverDesc")}
        </p>
      </SectionCard>
    );
  }

  // Loading state
  if (personaLoading || (!ldfrResult && ldfrAnswers)) {
    return (
      <SectionCard className="flex flex-col items-center justify-center p-16 text-center rounded-[48px] border-white/10 shadow-2xl">
        <div className="text-5xl mb-6 animate-pulse">🔮</div>
        <h2 className="text-xl font-black mb-2">{t("student.persona.analyzing")}</h2>
        <p className="text-sm text-white/40 font-medium">{t("student.persona.analyzingDesc")}</p>
      </SectionCard>
    );
  }

  if (personaError) {
    return (
      <SectionCard className="flex flex-col items-center justify-center p-10 text-center rounded-[48px] border-white/10 shadow-2xl">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-sm text-red-400 font-bold mb-4">{personaError}</p>
        <button onClick={onRegenerate} className="rounded-2xl bg-aura px-6 py-3 font-black text-white hover:scale-105 active:scale-95 transition-all">
          {t("student.persona.retry")}
        </button>
      </SectionCard>
    );
  }

  if (!ldfrResult) return null;

  const archetype = LDFR_ARCHETYPES[ldfrResult.code];
  if (!archetype) return null;

  // Best matches from matrix
  const compatRow = LDFR_COMPAT[ldfrResult.code] ?? {};
  const bestMatches = Object.entries(compatRow)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  const zhName = archL(locale, archetype.nameZh, archetype.nameEn);
  const enName = archetype.nameEn;

  return (
    <div className="space-y-8">
      {/* Hero Card */}
      <div className="relative rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-aura/20 via-purple-950/60 to-harbour/20 pointer-events-none" />
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-aura/15 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-harbour/15 blur-[120px] pointer-events-none" />

        <div className="relative z-10 p-8 md:p-12">
          <div className="flex flex-col md:flex-row md:items-start gap-8">
            {/* Cover + LDFR Code */}
            <div className="shrink-0 flex flex-col items-center">
              <LdfrCover code={ldfrResult.code} />
              <div className="mt-5 rounded-[1.4rem] border border-aura/45 bg-gradient-to-br from-aura/25 via-fuchsia-500/15 to-harbour/15 px-7 py-3 text-4xl font-black tracking-[0.28em] shadow-2xl shadow-aura/25 md:text-5xl">
                <span className="bg-gradient-to-r from-pink-200 via-aura to-harbour bg-clip-text text-transparent drop-shadow-[0_0_22px_rgba(255,0,102,0.45)]">
                {ldfrResult.code}
                </span>
              </div>
              <div className="mt-3 bg-gradient-to-r from-aura via-pink-300 to-harbour bg-clip-text text-sm font-black tracking-[0.18em] text-transparent">{archL(locale, archetype.campZh, archetype.campEn)}</div>
            </div>

            {/* Title + Tagline + Analysis */}
            <div className="flex-1 min-w-0">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                {isZh ? (
                  <>
                    <span className="bg-gradient-to-r from-pink-100 via-aura to-pink-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(255,0,102,0.22)]">{zhName}</span>
                    <span className="mx-3 text-white/35">/</span>
                    <span className="bg-gradient-to-r from-harbour via-sky-200 to-white bg-clip-text text-transparent">{enName}</span>
                  </>
                ) : (
                  <>
                    <span className="bg-gradient-to-r from-harbour via-sky-200 to-white bg-clip-text text-transparent">{enName}</span>
                    <span className="mx-3 text-white/35">/</span>
                    <span className="bg-gradient-to-r from-pink-100 via-aura to-pink-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(255,0,102,0.22)]">{zhName}</span>
                  </>
                )}
              </h2>
              <div className="mt-2 text-lg text-white/50 font-bold italic">{archL(locale, archetype.taglineZh, archetype.taglineEn)}</div>

              {/* Traits */}
              <div className="mt-7 flex flex-wrap gap-3">
                {archL(locale, archetype.traitsZh, archetype.traitsEn).map((trait) => (
                  <span key={trait} className="rounded-full border border-aura/25 bg-aura/15 px-5 py-2 text-base font-black text-white shadow-lg shadow-aura/10">{trait}</span>
                ))}
              </div>

              {/* Personal Vibe */}
              <div className="mt-6 rounded-2xl bg-white/[0.05] border border-white/10 p-5">
                <div className="text-sm font-black uppercase tracking-[0.24em] text-aura/70 mb-2">{t("student.persona.yourVibe")}</div>
                <p className="text-lg text-white/78 font-bold leading-relaxed">{localizeDisplayText(ldfrResult.vibe, locale, t)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <SectionCard className="border-white/10 shadow-2xl">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={18} className="text-aura" />
          <span className="text-sm font-black uppercase tracking-[0.28em] text-aura/65">{t("student.persona.aiAnalysis")}</span>
        </div>
        <p className="text-lg leading-relaxed text-white/75 font-medium">{localizeDisplayText(ldfrResult.analysis, locale, t)}</p>

      </SectionCard>

      {/* Strengths & Traps */}
      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard className="border-green-400/10 shadow-2xl">
          <div className="text-sm font-black uppercase tracking-[0.26em] text-green-300/75 mb-5">💖 {t("student.persona.strengths")}</div>
          <ul className="space-y-4">
            {archL(locale, archetype.strengthsZh, archetype.strengthsEn).map((s) => (
              <li key={s} className="flex items-start gap-3">
                <span className="text-green-300 mt-0.5 shrink-0 text-xl">✓</span>
                <span className="text-base text-white/72 font-medium leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard className="border-amber-400/10 shadow-2xl">
          <div className="text-sm font-black uppercase tracking-[0.26em] text-amber-300/75 mb-5">⚠️ {t("student.persona.watchOut")}</div>
          <ul className="space-y-4">
            {archL(locale, archetype.trapsZh, archetype.trapsEn).map((s) => (
              <li key={s} className="flex items-start gap-3">
                <span className="text-amber-300 mt-0.5 shrink-0 text-xl">!</span>
                <span className="text-base text-white/72 font-medium leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Flirt Signals */}
      <SectionCard className="border-white/10 shadow-2xl">
        <div className="text-sm font-black uppercase tracking-[0.26em] text-pink-300/75 mb-5">💌 {t("student.persona.flirtSignals")}</div>
        <div className="space-y-3">
          {archL(locale, archetype.flirtSignalsZh, archetype.flirtSignalsEn).map((sig) => (
            <div key={sig} className="flex items-start gap-3 rounded-2xl bg-white/[0.03] border border-white/5 p-4">
              <span className="text-pink-300 shrink-0 mt-0.5 text-lg">♡</span>
              <span className="text-base text-white/70 font-medium">{sig}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Spark Moment + Ideal Date */}
      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard className="border-white/10 shadow-2xl">
          <div className="text-sm font-black uppercase tracking-[0.26em] text-aura/70 mb-4">✨ {t("student.persona.sparkMoment")}</div>
          <p className="text-lg text-white/70 font-medium leading-relaxed italic">{archL(locale, archetype.sparkMomentZh, archetype.sparkMomentEn)}</p>
        </SectionCard>

        <SectionCard className="border-white/10 shadow-2xl">
          <div className="text-sm font-black uppercase tracking-[0.26em] text-harbour/75 mb-4">🌟 {t("student.persona.idealDateSpots")}</div>
          <div className="flex flex-wrap gap-2.5">
            {archL(locale, archetype.dateSpotsZh, archetype.dateSpotsEn).map((spot) => (
              <span key={spot} className="rounded-2xl bg-harbour/15 border border-harbour/30 px-4 py-2 text-base text-white font-black shadow-lg shadow-harbour/10">{spot}</span>
            ))}
          </div>
          {ldfrResult.idealDate && (
            <div className="mt-4 rounded-2xl bg-white/[0.03] border border-white/5 p-4">
              <div className="text-xs font-black uppercase tracking-wider text-white/35 mb-1">{t("student.persona.aiSuggested")}</div>
              <p className="text-base text-white/65 font-medium italic">{localizeDisplayText(ldfrResult.idealDate, locale, t)}</p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Best Matches */}
      <SectionCard className="border-white/10 shadow-2xl">
        <div className="text-sm font-black uppercase tracking-[0.26em] text-aura/70 mb-5">🔮 {t("student.persona.bestMatchTypes")}</div>
        <div className="grid gap-4 sm:grid-cols-3">
          {bestMatches.map(([code, stars]) => {
            const match = LDFR_ARCHETYPES[code];
            if (!match) return null;
            return (
              <div key={code} className="rounded-3xl bg-white/[0.04] border border-white/10 p-5 text-left hover:bg-white/[0.07] transition-colors">
                <div className="flex items-center gap-4">
                  <LdfrCover code={code} size="sm" />
                  <div>
                    <div className="text-2xl font-black tracking-[0.18em] text-aura">{code}</div>
                    <div className="mt-1 text-base font-black text-white">{isZh ? archL(locale, match.nameZh, match.nameEn) : match.nameEn}</div>
                  </div>
                </div>
                <div className="mt-4 text-aura text-base tracking-wider">{"⭐".repeat(stars)}</div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Regenerate button */}
      <div className="flex justify-center">
        <button onClick={onRegenerate} disabled={personaLoading}
          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-black text-white/50 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30">
          {t("student.persona.reanalyze")}
        </button>
      </div>
    </div>
  );
}

/* ─── Partner Info Panel (for Match Detail) ─── */
function PartnerInfoPanel({ partner, t, locale }: { partner: PublicMatchPartner; t: (k: string, o?: any) => string; locale: Locale }) {
  const dp = partner.datingPreferences;
  const photos = dp?.photoUrls?.filter((u) => u && u.length > 10) ?? [];
  const partnerCode = partner.ldfrResult?.code;
  const partnerArch = partnerCode ? LDFR_ARCHETYPES[partnerCode] : null;

  return (
    <div className="space-y-5">
      {photos.length > 0 && <PhotoGallery photos={photos} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {partner.universityShortName && <InfoChip icon={<User size={16} />} label={t("student.profile.school", { defaultValue: "School" })} value={partner.universityShortName} />}
        {partner.major && <InfoChip icon={<Sparkles size={16} />} label={t("student.profile.major", { defaultValue: "Major" })} value={partner.major} />}
        {partner.yearOfStudy && <InfoChip icon={<Calendar size={16} />} label={t("student.profile.year", { defaultValue: "Year" })} value={partner.yearOfStudy} />}
      </div>

      {partner.languages.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-black uppercase tracking-[0.22em] text-white/45">{t("student.languages")}</div>
          <div className="flex flex-wrap gap-2">
            {partner.languages.map((lang) => (
              <span key={lang} className="rounded-xl border border-white/15 bg-white/[0.07] px-4 py-2 text-base font-black text-white/75">{lang}</span>
            ))}
          </div>
        </div>
      )}

      {partner.interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {partner.interests.map((chip) => (
            <span key={chip} className="rounded-2xl border border-aura/25 bg-aura/10 px-4 py-2 text-base font-black text-aura italic">
              #{chip.includes(".") ? t(chip) : t(`join.tags.${chip}`, { defaultValue: chip })}
            </span>
          ))}
        </div>
      )}

      {partner.vibeTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {partner.vibeTags.map((tag) => (
            <span key={tag} className="rounded-2xl border border-harbour/25 bg-harbour/10 px-4 py-2 text-base font-black text-harbour">
              {tag.includes(".") ? t(tag) : t(`join.vibes.${tag}`, { defaultValue: tag })}
            </span>
          ))}
        </div>
      )}

      {partnerCode && partnerArch && (
        <div className="rounded-3xl border border-aura/25 bg-gradient-to-r from-aura/14 via-purple-500/10 to-harbour/12 p-5 shadow-2xl shadow-aura/10">
          <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.22em] text-aura/75">
            <Flame size={16} className="text-aura" />
            {t("student.profile.lovePersona")}
          </div>
          <div className="flex items-center gap-4">
            <LdfrCover code={partnerCode} size="sm" />
            <div className="min-w-0">
              <div className="bg-gradient-to-r from-pink-200 via-aura to-harbour bg-clip-text text-3xl font-black tracking-[0.18em] text-transparent">{partnerCode}</div>
              <div className="mt-1 text-lg font-black text-white/85">{archL(locale, partnerArch.nameZh, partnerArch.nameEn)}</div>
              <div className="text-sm font-bold text-white/45">{partnerArch.nameEn}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Match Detail Modal ─── */
function MatchDetail({ view, profile, locale, onClose, onRefresh, t }: {
  view: MatchView; profile: StudentProfile; locale: Locale; onClose: () => void; onRefresh: () => void; t: (k: string, o?: any) => string;
}) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [responseBusy, setResponseBusy] = useState<"yes" | "no" | null>(null);
  const [icebreaker, setIcebreaker] = useState<{ introForA: string; introForB: string; conversationStarters: string[]; dateVibe: string } | null>(null);
  const [icebreakerLoading, setIcebreakerLoading] = useState(false);

  const isUserA = view.match.userAId === profile.id;
  const reasons = isUserA ? view.match.reasonsForA : view.match.reasonsForB;
  const canFeedback = ["happened", "feedback-collected"].includes(view.match.status);

  const acceptances = view.match.acceptances ?? [];
  const myAcceptance = acceptances.find((x) => x.userId === profile.id);
  const bothAccepted = acceptances.some((x) => x.userId === view.match.userAId && x.choice === "yes") &&
    acceptances.some((x) => x.userId === view.match.userBId && x.choice === "yes");
  const isPostDate = ["happened", "feedback-collected", "closed"].includes(view.match.status);
  const isComplete = bothAccepted || isPostDate || ["mutual-accepted", "slot-proposing", "slot-confirmed", "place-confirmed", "scheduled"].includes(view.match.status);

  useEffect(() => {
    setIcebreaker(null);
  }, [view.match.id, locale]);

  // Load icebreaker when both confirmed
  useEffect(() => {
    if (!isComplete || icebreaker || icebreakerLoading) return;
    setIcebreakerLoading(true);
    api.getIcebreaker(view.match.id, locale).then((res) => {
      if (res.icebreaker) setIcebreaker(res.icebreaker);
    }).catch(() => {}).finally(() => setIcebreakerLoading(false));
  }, [isComplete, view.match.id, locale, icebreaker, icebreakerLoading]);

  async function respond(choice: "yes" | "no") {
    setResponseBusy(choice);
    setMessage("");
    try {
      await api.respondToMatch(view.match.id, choice);
      setMessage(choice === "yes" ? t("student.matchFlow.confirmToast") : t("student.matchFlow.cancelToast"));
      onRefresh();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setResponseBusy(null);
    }
  }

  async function sendFeedback(sentiment: "love" | "pass" | "rematch") {
    try {
      await api.submitFeedback(view.match.id, "post_date_2h", { oneLine: note, vibeScore: sentiment === "love" ? 8 : sentiment === "rematch" ? 5 : 2 }, sentiment);
      setMessage(t("student.feedbackSaved")); onRefresh();
    } catch (e: any) { setMessage(e.message); }
  }

  const partnerArchetype = view.partner.ldfrResult?.code ? LDFR_ARCHETYPES[view.partner.ldfrResult.code] : null;
  const myIntro = icebreaker ? (isUserA ? icebreaker.introForA : icebreaker.introForB) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4 md:p-8">
      <div className="relative my-8 w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f172a]/95 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="relative flex min-h-56 items-end bg-gradient-to-br from-indigo-950 via-purple-950 to-harbour/30 p-8 md:p-10">
          <button onClick={onClose} className="absolute top-5 right-5 rounded-full bg-black/40 p-2 text-white/60 hover:text-white hover:bg-black/60 transition-all"><X size={20} /></button>
          <div className="absolute top-5 left-5">
            <button onClick={onClose} className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-bold transition-colors"><ArrowLeft size={16} /> {t("join.dev.back")}</button>
          </div>
          <div className="relative z-10 flex items-end gap-5">
            {view.partner.datingPreferences?.photoUrls?.[0] ? (
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[30px] shadow-2xl ring-4 ring-[#0f172a]">
                <img src={view.partner.datingPreferences.photoUrls[0]} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[30px] bg-gradient-to-br from-aura to-harbour text-3xl font-black text-white shadow-2xl ring-4 ring-[#0f172a]">{initials(view.partner.fullName)}</div>
            )}
            <div className="pb-1">
              <div className="text-3xl font-black tracking-tight text-white md:text-4xl">{view.partner.fullName}</div>
              <div className="mt-2 text-base font-bold text-white/58">
                {[view.partner.major, view.partner.yearOfStudy, view.partner.universityShortName].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <div className="absolute bottom-5 right-8 flex items-center gap-3">
            <span className="text-sm font-black uppercase tracking-[0.18em] text-white/45">{t("student.compatibility")}</span>
            <span className="text-3xl font-black text-aura italic">{view.match.score}%</span>
          </div>
        </div>

        <div className="space-y-8 p-6 md:p-8">
          {/* AI Matchmaker Intro — why you're matched */}
          {reasons?.length > 0 && (
            <div className="rounded-3xl border border-aura/15 bg-gradient-to-br from-aura/8 to-harbour/8 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-aura" />
                <span className="text-sm font-black uppercase tracking-[0.24em] text-aura/70">{t("student.matchFlow.whyMatched")}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {reasons.map((r) => (
                  <span key={r} className="rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-2 text-base font-black text-white/75">{r}</span>
                ))}
              </div>
              {partnerArchetype && (
                <div className="mt-4 flex items-center gap-4 rounded-2xl border border-aura/15 bg-white/[0.04] p-4">
                  <LdfrCover code={view.partner.ldfrResult!.code} size="sm" />
                  <div>
                    <div className="text-lg font-black text-white/85">{archL(locale, partnerArchetype.nameZh, partnerArchetype.nameEn)}</div>
                    <div className="mt-0.5 text-base font-black tracking-[0.16em] text-aura">{view.partner.ldfrResult!.code} · {partnerArchetype.nameEn}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Partner basic info */}
          <PartnerInfoPanel partner={view.partner} t={t} locale={locale} />

          {/* Contact Exchange + Icebreaker (after BOTH confirmed) */}
          {isComplete && (
            <div className="rounded-3xl border border-green-400/20 bg-green-400/5 p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🎉</span>
                <div>
                  <h3 className="text-2xl font-black text-green-300">{t("student.matchFlow.dateConfirmed")}</h3>
                  <p className="mt-1 text-lg font-bold text-white/55">{t("student.matchFlow.step3Desc")}</p>
                </div>
              </div>

              {/* AI Icebreaker intro */}
              {(myIntro || icebreakerLoading) && (
                <div className="rounded-3xl border border-aura/15 bg-gradient-to-br from-aura/8 to-purple-500/8 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={18} className="text-aura" />
                    <span className="text-sm font-black uppercase tracking-[0.24em] text-aura/75">{t("student.matchFlow.icebreakerTitle")}</span>
                  </div>
                  {icebreakerLoading ? (
                    <div className="animate-pulse text-base font-bold text-white/45">{t("student.matchFlow.icebreakerLoading")}</div>
                  ) : (
                    <>
                      <p className="mb-4 text-lg font-medium leading-relaxed text-white/72">{myIntro}</p>
                      {icebreaker!.conversationStarters?.length > 0 && (
                        <div>
                          <div className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-white/45">{t("student.matchFlow.talkAbout")}</div>
                          <div className="flex flex-wrap gap-2">
                            {icebreaker!.conversationStarters.map((topic) => (
                              <span key={topic} className="rounded-xl border border-white/15 bg-white/[0.07] px-4 py-2 text-base font-black text-white/70">{topic}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {icebreaker!.dateVibe && (
                        <div className="mt-4 text-base font-bold italic text-white/40">{icebreaker!.dateVibe}</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Partner contact */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-4 text-sm font-black uppercase tracking-[0.22em] text-white/45">{t("student.matchFlow.partnerContact")}</div>
                <div className="flex items-center gap-4">
                  {view.partner.datingPreferences?.photoUrls?.[0] && (
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
                      <img src={view.partner.datingPreferences.photoUrls[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <div className="text-2xl font-black text-white">{view.partner.fullName}</div>
                    {view.partner.email && <div className="mt-1 text-base font-black text-aura">{view.partner.email}</div>}
                    {view.partner.phoneNumber && <div className="mt-1 text-base font-black text-harbour">WhatsApp: {view.partner.phoneNumber}</div>}
                  </div>
                </div>
              </div>

              {/* AI Gift Suggestions */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🎁</span>
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-white/20">{t("student.matchFlow.giftTitle")}</span>
                </div>
                <p className="text-sm text-white/40 font-medium mb-3">{t("student.matchFlow.giftDesc")}</p>
                <ul className="space-y-2">
                  {(t("student.matchFlow.giftIdeas", { returnObjects: true }) as unknown as string[]).map((idea: string) => (
                    <li key={idea} className="flex items-start gap-3">
                      <span className="text-pink-400 mt-0.5 shrink-0">♡</span>
                      <span className="text-sm text-white/60 font-medium">{idea}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Confirm / Cancel */}
          {!isPostDate && (
            <div className="rounded-3xl border border-aura/20 bg-gradient-to-br from-aura/10 via-pink-500/8 to-harbour/8 p-6">
              <div className="mb-5">
                <div className="text-sm font-black uppercase tracking-[0.24em] text-aura/75">{t("student.matchFlow.responseTitle")}</div>
                <p className="mt-2 text-base font-bold leading-relaxed text-white/55">{t("student.matchFlow.responseDesc")}</p>
              </div>
              {myAcceptance ? (
                <div className={`rounded-2xl border px-5 py-4 text-base font-black ${
                  myAcceptance.choice === "yes"
                    ? "border-green-400/20 bg-green-400/10 text-green-300"
                    : "border-white/10 bg-white/[0.04] text-white/62"
                }`}>
                  {myAcceptance.choice === "yes" ? t("student.matchFlow.confirmedGentle") : t("student.matchFlow.cancelledGentle")}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    disabled={!!responseBusy}
                    onClick={() => respond("yes")}
                    className="rounded-2xl bg-gradient-to-r from-aura to-pink-500 px-6 py-4 text-base font-black text-white shadow-xl shadow-aura/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {responseBusy === "yes" ? t("student.matchFlow.saving") : "Confirm"}
                  </button>
                  <button
                    disabled={!!responseBusy}
                    onClick={() => respond("no")}
                    className="rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-4 text-base font-black text-white/75 transition-all hover:bg-white/[0.1] active:scale-[0.98] disabled:opacity-50"
                  >
                    {responseBusy === "no" ? t("student.matchFlow.saving") : "Cancel"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Post-date Feedback ── */}
          {canFeedback && (
            <div className="pt-6 border-t border-white/5">
              <label className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-4 block">{t("student.matchFlow.feedbackTitle")}</label>
              <textarea className="w-full min-h-[100px] rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-base text-white font-medium focus:outline-none focus:ring-4 focus:ring-aura/20 transition-all mb-4 placeholder:text-white/20" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("student.notesPlaceholder")} />
              <div className="flex flex-wrap gap-3">
                <button className="rounded-2xl bg-aura px-8 py-3 font-black text-white shadow-xl shadow-aura/20 transition-all hover:scale-105 active:scale-95" onClick={() => sendFeedback("love")}>{t("student.lovedIt")}</button>
                <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-black text-white hover:bg-white/10 transition-all" onClick={() => sendFeedback("pass")}>{t("student.pass")}</button>
                <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-black text-white hover:bg-white/10 transition-all" onClick={() => sendFeedback("rematch")}>{t("student.requestRematch")}</button>
              </div>
            </div>
          )}

          {message && <div className="rounded-2xl bg-green-500/10 px-6 py-4 text-base font-bold text-green-400 border border-green-500/20 text-center">{message}</div>}
        </div>
      </div>
    </div>
  );
}

/* ─── Matches Tab ─── */
function MatchesTab({ matches, profile, locale, onRefresh, t }: {
  matches: MatchView[]; profile: StudentProfile; locale: Locale; onRefresh: () => void; t: (k: string, o?: any) => string;
}) {
  const [selected, setSelected] = useState<MatchView | null>(null);
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    setSelected(null);
  }, [locale]);

  useEffect(() => {
    const target = getNextDropTime();
    const timer = setInterval(() => {
      const distance = target - Date.now();
      if (distance < 0) { setTimeLeft({ d: 0, h: 0, m: 0, s: 0 }); return; }
      setTimeLeft({
        d: Math.floor(distance / (1000 * 60 * 60 * 24)),
        h: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((distance % (1000 * 60)) / 1000),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (matches.length === 0) {
    return (
      <SectionCard className="flex flex-col items-center justify-center p-6 md:p-12 text-center relative overflow-hidden rounded-[48px] border-white/10 shadow-2xl">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-aura/10 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-harbour/10 blur-[100px] pointer-events-none" />
        <div className="relative mb-12">
          <div className="h-32 w-32 rounded-[48px] bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/10 flex items-center justify-center text-5xl shadow-2xl backdrop-blur-xl"><span>⌛</span></div>
          <div className="absolute -top-2 -right-2 h-12 w-12 rounded-2xl bg-aura flex items-center justify-center text-base font-black text-white shadow-2xl shadow-aura/40 rotate-12 ring-6 ring-[#0f172a]">1</div>
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-3 tracking-tighter">{t("student.nextDropView.title")}</h2>
        <p className="mt-1 text-white/50 max-w-lg leading-relaxed text-base font-medium">{t("student.nextDropView.desc")}</p>
        <div className="mt-14 rounded-[40px] border border-white/10 bg-white/[0.03] p-10 w-full max-w-xl backdrop-blur-2xl shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-[40px] pointer-events-none" />
          <div className="relative z-10">
            <div className="text-xs font-black uppercase tracking-[0.5em] text-white/20 mb-8">{t("student.nextDropView.countdownTitle")}</div>
            <div className="grid grid-cols-4 gap-6">
              {[
                { val: timeLeft.d, label: t("student.countdown.days") },
                { val: timeLeft.h, label: t("student.countdown.hours") },
                { val: timeLeft.m, label: t("student.countdown.minutes") },
                { val: timeLeft.s, label: t("student.countdown.seconds") },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="text-2xl md:text-4xl font-black text-white tabular-nums tracking-tighter">{String(item.val).padStart(2, "0")}</div>
                  <div className="text-xs font-black text-white/20 uppercase tracking-[0.2em] mt-3">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-base font-black text-aura/60 italic tracking-widest">{t("student.nextDropView.checkBack")}</div>
          </div>
        </div>
        <div className="mt-20 grid gap-6 md:grid-cols-2 w-full max-w-3xl">
          <div className="flex gap-6 p-8 rounded-[40px] bg-white/[0.02] border border-white/5 text-left">
            <div className="h-16 w-16 shrink-0 rounded-[24px] bg-aura/10 flex items-center justify-center text-3xl shadow-xl border border-aura/20">🛡️</div>
            <div>
              <div className="font-black text-xl mb-2 tracking-tight">{t("student.nextDropView.verified")}</div>
              <div className="text-base text-white/40 leading-relaxed font-medium">{t("student.nextDropView.verifiedDesc")}</div>
            </div>
          </div>
          <div className="flex gap-6 p-8 rounded-[40px] bg-white/[0.02] border border-white/5 text-left">
            <div className="h-16 w-16 shrink-0 rounded-[24px] bg-harbour/10 flex items-center justify-center text-3xl shadow-xl border border-harbour/20">✨</div>
            <div>
              <div className="font-black text-xl mb-2 tracking-tight">{t("student.nextDropView.highSignal")}</div>
              <div className="text-base text-white/40 leading-relaxed font-medium">{t("student.nextDropView.highSignalDesc")}</div>
            </div>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <>
      <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-aura/5 via-transparent to-harbour/5 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.5em] text-white/20 mb-2">{t("student.nextDropView.countdownTitle")}</div>
            <div className="text-base text-white/50 font-medium">{t("student.nextDropView.desc")}</div>
          </div>
          <div className="flex gap-5 shrink-0">
            {[
              { val: timeLeft.d, label: t("student.countdown.days") },
              { val: timeLeft.h, label: t("student.countdown.hours") },
              { val: timeLeft.m, label: t("student.countdown.minutes") },
              { val: timeLeft.s, label: t("student.countdown.seconds") },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="text-2xl font-black text-white tabular-nums tracking-tighter">{String(item.val).padStart(2, "0")}</div>
                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.15em] mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map(({ match, partner, university }) => {
          const st = viewerStatusLabel(match, profile.id, t);
          const partnerPhoto = partner.datingPreferences?.photoUrls?.[0];
          return (
            <button key={match.id} onClick={() => setSelected({ match, partner, university })}
              className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] text-left transition-all hover:bg-white/[0.06] hover:border-white/20 hover:-translate-y-1 hover:shadow-2xl hover:shadow-aura/5 duration-300">
              <div className="h-28 bg-gradient-to-br from-aura/20 via-purple-900/30 to-harbour/20 flex items-center justify-center relative">
                {partnerPhoto ? (
                  <div className="h-18 w-18 rounded-[22px] overflow-hidden shadow-xl ring-4 ring-[#0f172a] group-hover:scale-110 transition-transform duration-300">
                    <img src={partnerPhoto} alt="" className="object-cover" style={{ width: 72, height: 72 }} />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-[22px] bg-gradient-to-br from-aura to-harbour flex items-center justify-center text-xl font-black text-white shadow-xl ring-4 ring-[#0f172a] group-hover:scale-110 transition-transform duration-300">{initials(partner.fullName)}</div>
                )}
                <div className="absolute top-3 right-3"><span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${st.color}`}>{st.text}</span></div>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <div className="text-lg font-black tracking-tight text-white group-hover:text-aura transition-colors">{partner.fullName}</div>
                  <div className="text-sm text-white/40 font-medium mt-0.5">
                    {[partner.major, partner.universityShortName ?? university?.shortName ?? partner.universityId].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5"><Heart size={16} className="text-aura" /><span className="text-base font-black text-aura italic">{match.score}%</span></div>
                  <div className="flex items-center gap-2 text-xs text-white/30 font-medium">
                    <span>{new Date(match.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {partner.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {partner.interests.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs text-white/40 font-bold">
                        #{tag.includes(".") ? t(tag) : t(`join.tags.${tag}`, { defaultValue: tag })}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <MatchDetail view={selected} profile={profile} locale={locale} onClose={() => setSelected(null)} onRefresh={() => { onRefresh(); setSelected(null); }} t={t} />
      )}
    </>
  );
}

/* ─── Events Tab ─── */
function EventsTab({ t }: { t: (k: string, o?: any) => string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const eventsRaw = t("student.events.items", { returnObjects: true });
  const events = Array.isArray(eventsRaw) ? eventsRaw as CampusEvent[] : [];
  const selected = events.find((event) => event.id === selectedId) ?? null;

  async function copyContact(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  function capacityText(event: CampusEvent) {
    const left = Math.max(event.capacity - event.joined, 0);
    return left > 0
      ? t("student.events.seatsLeft", { joined: event.joined, left })
      : t("student.events.fullCount", { joined: event.joined, capacity: event.capacity });
  }

  if (selected) {
    const selectedIndex = Math.max(0, events.findIndex((event) => event.id === selected.id));
    const image = EVENT_IMAGES[selectedIndex % EVENT_IMAGES.length];
    const detailImages = [0, 1, 2].map((offset) => EVENT_IMAGES[(selectedIndex + offset) % EVENT_IMAGES.length]);
    return (
      <div className="space-y-7">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/50 transition-all hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={16} /> {t("student.events.backToEvents")}
        </button>

        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03]">
          <div className="relative min-h-[320px]">
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050814] via-[#050814]/45 to-black/20" />
            <div className="relative flex min-h-[320px] flex-col justify-end p-6 md:p-10">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-aura px-4 py-1.5 text-xs font-black text-white">{selected.status}</span>
                <span className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-black text-white">{selected.category}</span>
              </div>
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="max-w-3xl text-3xl font-black leading-tight tracking-tight text-white md:text-5xl">{selected.title}</h2>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-white/65">
                    <span className="inline-flex items-center gap-2"><Clock size={16} />{selected.date}</span>
                    <span className="inline-flex items-center gap-2"><MapPin size={16} />{selected.location}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-7 p-6 md:grid-cols-[1fr_320px] md:p-10">
            <div className="space-y-7">
              <div>
                <h3 className="text-lg font-black text-white">{t("student.events.contentTitle")}</h3>
                <div className="mt-4 space-y-3">
                  {selected.content.map((line) => (
                    <p key={line} className="text-base font-medium leading-relaxed text-white/58">{line}</p>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-white">{t("student.events.galleryTitle")}</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {detailImages.map((src, index) => (
                    <div key={`${selected.id}-gallery-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/5">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-white">{t("student.events.scheduleTitle")}</h3>
                <div className="mt-5 space-y-5 border-l border-white/10 pl-5">
                  {selected.schedule.map((item) => (
                    <div key={`${item.time}-${item.title}`} className="relative">
                      <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-aura shadow-[0_0_16px_rgba(255,0,102,0.7)]" />
                      <div className="text-sm font-black text-aura">{item.time}</div>
                      <div className="mt-1 text-base font-black text-white">{item.title}</div>
                      <div className="mt-1 text-sm font-medium leading-relaxed text-white/45">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-[0.24em] text-white/25">{t("student.events.signup")}</span>
                  <Users size={18} className="text-aura" />
                </div>
                <div className="mt-5 text-2xl font-black text-white">{capacityText(selected)}</div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-aura to-harbour" style={{ width: `${Math.min(100, (selected.joined / selected.capacity) * 100)}%` }} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-white/45">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-aura/20 bg-aura/10 p-5">
                <h3 className="text-base font-black text-white">{t("student.events.contactCtaTitle")}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-white/48">{t("student.events.contactCtaDesc")}</p>
                <div className="mt-5 grid gap-3">
                  {EVENT_CONTACTS.map((contact) => (
                    <div key={contact.name} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-sm font-black text-white">{contact.name}</div>
                      <div className="mt-2 grid gap-2">
                        <button
                          type="button"
                          onClick={() => copyContact(`detail-${contact.name}-wechat`, contact.wechat)}
                          className="rounded-xl bg-white px-4 py-2 text-xs font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          {copied === `detail-${contact.name}-wechat` ? t("student.events.copied") : t("student.events.copyWechat")}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyContact(`detail-${contact.name}-whatsapp`, contact.whatsapp)}
                          className="rounded-xl bg-gradient-to-r from-aura to-harbour px-4 py-2 text-xs font-black text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          {copied === `detail-${contact.name}-whatsapp` ? t("student.events.copied") : t("student.events.copyWhatsapp")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.4em] text-aura/50">{t("student.events.eyebrow")}</div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">{t("student.events.title")}</h2>
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-[1.25fr_0.75fr]">
          <div className="relative min-h-[220px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03]">
            <img src={dateSpotImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050814]/90 via-[#050814]/40 to-transparent" />
            <div className="relative flex min-h-[220px] flex-col justify-end p-6">
              <div className="max-w-md text-2xl font-black leading-tight text-white md:text-3xl">{events[0]?.title}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {events[0]?.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/60">{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
            {[galleryImg, campusBg].map((src, index) => (
              <div key={`event-preview-${index}`} className="relative min-h-[104px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.03]">
                <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5">
          {events.map((event, index) => {
            const image = EVENT_IMAGES[index % EVENT_IMAGES.length];
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedId(event.id)}
                className="group grid gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] md:grid-cols-[220px_1fr]"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-white/5 md:aspect-square">
                  <img src={image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-aura px-3 py-1 text-xs font-black text-white">{event.status}</span>
                </div>

                <div className="flex min-w-0 flex-col justify-between gap-5 p-1 md:p-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {event.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-white/40">{tag}</span>
                      ))}
                    </div>
                    <h3 className="mt-4 text-2xl font-black leading-tight text-white group-hover:text-aura">{event.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-relaxed text-white/45">{event.summary}</p>
                    <div className="mt-4 grid gap-2 text-sm font-bold text-white/45 md:grid-cols-2">
                      <span className="inline-flex items-center gap-2"><Clock size={15} />{event.date}</span>
                      <span className="inline-flex items-center gap-2"><MapPin size={15} />{event.location}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-white/35">{capacityText(event)}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-aura to-harbour" style={{ width: `${Math.min(100, (event.joined / event.capacity) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-aura to-harbour px-5 py-3 text-sm font-black text-white">
                      {t("student.events.view")} <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Main StudentPage ─── */
export function StudentPage({ userId, onLocale }: { userId: string | null; onLocale: (locale: Locale) => void }) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>("matches");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [personaError, setPersonaError] = useState("");
  const effectiveLocale = toSupportedLocale(profile?.preferredLocale, toSupportedLocale(i18n.language, "en"));
  const tLocal = useMemo(() => fixedT(t, effectiveLocale), [t, effectiveLocale]);
  const ldfrLang = effectiveLocale;

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [profileRes, matchesRes] = await Promise.all([
      api.getProfile(userId),
      api.getAllMatches(),
    ]);
    setProfile(profileRes as StudentProfile);
    setMatches((matchesRes.matches ?? []).filter((m: any) => m.partner !== null) as MatchView[]);
    return profileRes as StudentProfile;
  }, [userId]);

  const generatePersona = useCallback(async (p: StudentProfile, lang: string) => {
    const answers = p.onboardingAnswers?.onboarding_ldfr;
    if (!answers) return;
    setPersonaLoading(true);
    setPersonaError("");
    try {
      await api.ldfrAnalyze(answers, lang);
      await refresh();
    } catch (e: any) {
      setPersonaError(e.message);
    } finally {
      setPersonaLoading(false);
    }
  }, [refresh]);

  // Initial load + auto-generate persona & profile analysis if needed
  useEffect(() => {
    refresh().then(async (p) => {
      if (!p) return;
      const profileLocale = toSupportedLocale(p.preferredLocale, toSupportedLocale(i18n.language, "en"));

      // Sync UI language from user's preferredLocale
      if (profileLocale !== i18n.language) {
        await i18n.changeLanguage(profileLocale);
        onLocale(profileLocale);
      }

      // Auto-generate LDFR persona
      const answers = p.onboardingAnswers?.onboarding_ldfr;
      if (answers) {
        const result = p.ldfrResult;
        const needsGen = !result;
        const langMismatch = result && localeMismatch(result.analysis ?? result.vibe, profileLocale);
        const analysisShort = result && personaAnalysisTooShort(result.analysis, profileLocale);
        if (needsGen || langMismatch || analysisShort) {
          generatePersona(p, profileLocale);
        }
      }

      // Auto-generate profile analysis (or regenerate on language mismatch)
      if (p.profileComplete) {
        const pa = p.profileAnalysis;
        const needsProfileGen = !pa;
        const profileLangMismatch = pa?.summary && localeMismatch(pa.summary, profileLocale);
        if (needsProfileGen || profileLangMismatch) {
          await api.regeneratePersona(profileLocale);
          refresh();
        }
      }
    }).catch(console.error);
  }, [userId, i18n.language, refresh, generatePersona]);

  if (!userId) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-20">
        <SectionCard className="text-center">
          <h1 className="text-3xl font-black">{tLocal("student.title")}</h1>
          <p className="mt-4 text-white/50 text-base">{tLocal("student.signInPrompt")}</p>
        </SectionCard>
      </main>
    );
  }

  if (!profile) return <main className="flex min-h-[60vh] items-center justify-center text-white/50 text-base animate-pulse">{tLocal("student.loading")}</main>;

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:py-20">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">{tLocal("student.hi", { name: profile.fullName.split(" ")[0] })}</h1>
      </div>

      <div className="mb-10 flex w-full max-w-5xl flex-wrap gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/20">
        <button onClick={() => setTab("matches")}
          className={`flex min-w-[150px] flex-1 items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-black transition-all md:text-lg ${tab === "matches" ? "bg-gradient-to-r from-aura to-pink-500 text-white shadow-xl shadow-aura/25" : "text-white/62 hover:text-white hover:bg-white/[0.07]"}`}>
          <Heart size={20} />
          {tLocal("student.tabs.matches", "Matches")}
          {matches.length > 0 && <span className={`ml-1 rounded-full px-2.5 py-1 text-xs font-black ${tab === "matches" ? "bg-white/22 text-white" : "bg-aura/20 text-aura"}`}>{matches.length}</span>}
        </button>
        <button onClick={() => setTab("events")}
          className={`flex min-w-[150px] flex-1 items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-black transition-all md:text-lg ${tab === "events" ? "bg-gradient-to-r from-aura to-pink-500 text-white shadow-xl shadow-aura/25" : "text-white/62 hover:text-white hover:bg-white/[0.07]"}`}>
          <Ticket size={20} />
          {tLocal("student.tabs.events", "Events")}
        </button>
        <button onClick={() => setTab("persona")}
          className={`flex min-w-[150px] flex-1 items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-black transition-all md:text-lg ${tab === "persona" ? "bg-gradient-to-r from-aura to-pink-500 text-white shadow-xl shadow-aura/25" : "text-white/62 hover:text-white hover:bg-white/[0.07]"}`}>
          <Flame size={20} />
          {tLocal("student.tabs.persona", "Love Persona")}
        </button>
        <button onClick={() => setTab("profile")}
          className={`flex min-w-[150px] flex-1 items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-black transition-all md:text-lg ${tab === "profile" ? "bg-gradient-to-r from-aura to-pink-500 text-white shadow-xl shadow-aura/25" : "text-white/62 hover:text-white hover:bg-white/[0.07]"}`}>
          <User size={20} />
          {tLocal("student.tabs.profile", "Profile")}
        </button>
      </div>

      {tab === "profile" && <ProfileTab profile={profile} t={tLocal} locale={effectiveLocale} />}
      {tab === "matches" && <MatchesTab matches={matches} profile={profile} locale={effectiveLocale} onRefresh={refresh} t={tLocal} />}
      {tab === "events" && <EventsTab t={tLocal} />}
      {tab === "persona" && <PersonaTab profile={profile} t={tLocal} lang={effectiveLocale} personaLoading={personaLoading} personaError={personaError} onRegenerate={() => generatePersona(profile, ldfrLang)} />}
    </main>
  );
}
