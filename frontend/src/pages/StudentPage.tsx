import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import type { MatchRecord, StudentProfile, University, ProfileAnalysis, DatingPreferences } from "../types";
import { SectionCard } from "../components/SectionCard";
import { User, Heart, ArrowLeft, X, MapPin, Ruler, Calendar, Sparkles, Target, ChevronDown, ChevronUp, Flame, Pencil } from "lucide-react";

type Tab = "profile" | "matches" | "persona";

type MatchView = {
  match: MatchRecord;
  partner: StudentProfile;
  university?: University;
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

function statusLabel(status: string) {
  const map: Record<string, { text: string; color: string }> = {
    pending: { text: "Pending", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    notified: { text: "Notified", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
    "awaiting-acceptance": { text: "Awaiting", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    "mutual-accepted": { text: "Accepted", color: "text-green-400 bg-green-400/10 border-green-400/20" },
    declined: { text: "Declined", color: "text-red-400 bg-red-400/10 border-red-400/20" },
    "slot-proposing": { text: "Scheduling", color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
    "slot-confirmed": { text: "Confirmed", color: "text-green-400 bg-green-400/10 border-green-400/20" },
    "place-confirmed": { text: "Place Set", color: "text-green-400 bg-green-400/10 border-green-400/20" },
    scheduled: { text: "Scheduled", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    happened: { text: "Happened", color: "text-pink-400 bg-pink-400/10 border-pink-400/20" },
    "feedback-collected": { text: "Complete", color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
    closed: { text: "Closed", color: "text-white/30 bg-white/5 border-white/10" },
  };
  return map[status] ?? { text: status, color: "text-white/40 bg-white/5 border-white/10" };
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
  return t(`onboarding.opt.${val}`, { defaultValue: val });
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
    taglineZh: "一秒爱上你，一秒爱上世界", taglineEn: "Falls in love in a heartbeat — with you, and the whole world",
    campZh: "灵魂共鸣派", campEn: "Soul Resonance", mbti: "ENFP",
    traitsZh: ["热情", "自由", "善变", "灵感型", "易心动"],
    traitsEn: ["Passionate", "Free-spirited", "Changeable", "Inspired", "Easily smitten"],
    strengthsZh: ["把恋爱过成冒险，每天都有新惊喜", "对你的优点会无限放大、用力赞美", "情绪饱满，让你时刻「被爱着」"],
    strengthsEn: ["Turns love into an adventure with daily surprises", "Amplifies your strengths and showers you with praise", "Emotionally rich — you'll always feel loved"],
    trapsZh: ["容易「开始很多事却完成不了」，包括感情", "喜欢自由，被管太紧会窒息", "情绪起伏大"],
    trapsEn: ["Starts many things but finishes few — including relationships", "Needs freedom; feels suffocated when controlled", "Big emotional swings"],
    flirtSignalsZh: ["突然分享一首很私人的歌", "半夜 12 点发来语音长消息", "计划一堆「以后一起去」的地方"],
    flirtSignalsEn: ["Suddenly shares a deeply personal song", "Sends long voice messages at midnight", "Plans tons of 'let's go there someday' places"],
    dateSpotsZh: ["Live House", "探店", "市集", "艺术展", "凌晨便利店"],
    dateSpotsEn: ["Live House", "Café hopping", "Night market", "Art exhibit", "Late-night convenience store"],
    sparkMomentZh: "在人群中央讲故事，全场都在笑，TA 突然抬头跟你对到眼。",
    sparkMomentEn: "Telling a story in a crowd, everyone laughing — then locking eyes with you.",
  },
  LFS: {
    emoji: "🌟", nameZh: "温柔造梦家", nameEn: "Dreamer",
    taglineZh: "想把你雕成你最好的样子", taglineEn: "Wants to sculpt you into your best self",
    campZh: "灵魂共鸣派", campEn: "Soul Resonance", mbti: "ENFJ",
    traitsZh: ["温暖", "引导型", "高情商", "占有欲", "付出型"],
    traitsEn: ["Warm", "Guiding", "High EQ", "Possessive", "Giving"],
    strengthsZh: ["沟通力 max，从来不让你猜", "真心希望你变得更好，会推动你成长", "把关系经营得有节奏、有仪式感"],
    strengthsEn: ["Top-tier communicator — never leaves you guessing", "Genuinely wants you to grow and pushes you forward", "Builds the relationship with rhythm and ceremony"],
    trapsZh: ["容易把「我对你好」变成「你应该听我的」", "占有欲，特别是觉得被忽视时", "会过度投入到怀疑自我"],
    trapsEn: ["'I'm doing this for you' can become 'you should listen to me'", "Gets possessive, especially when feeling ignored", "Over-invests to the point of self-doubt"],
    flirtSignalsZh: ["记得你随口提过的小喜好", "主动帮你解决你没说出口的麻烦", "会「教」你做某件事，借机肢体接触"],
    flirtSignalsEn: ["Remembers tiny preferences you mentioned once", "Proactively solves problems you didn't voice", "Teaches you something as an excuse for physical contact"],
    dateSpotsZh: ["仪式感晚餐", "陶艺/调酒课", "深夜散步聊心事"],
    dateSpotsEn: ["Elegant dinner", "Pottery / cocktail class", "Late-night walk & deep talk"],
    sparkMomentZh: "在你低潮时，一句话戳穿你的心事，然后什么都不说，只是抱住你。",
    sparkMomentEn: "When you're down, they see right through you with one sentence — then just hold you without a word.",
  },
  LRF: {
    emoji: "✨", nameZh: "聚光灯精灵", nameEn: "Spotlight",
    taglineZh: "TA 在的地方，永远是 party", taglineEn: "Wherever they are, it's always a party",
    campZh: "当下心动派", campEn: "In-the-Moment", mbti: "ESFP",
    traitsZh: ["热闹", "当下主义", "感官敏锐", "行动派", "戏剧化"],
    traitsEn: ["Energetic", "Lives in the now", "Sensory-sharp", "Action-driven", "Dramatic"],
    strengthsZh: ["跟 TA 在一起永远不会闷", "当下投入度 max", "情感表达直接，喜欢你就让全世界知道"],
    strengthsEn: ["Never a dull moment with them", "100% present in the moment", "Expresses feelings directly — likes you and lets the world know"],
    trapsZh: ["对未来缺乏 plan", "容易冲动决定（包括分手）", "喜欢被关注"],
    trapsEn: ["Lacks long-term planning", "Impulsive decisions (including breakups)", "Craves attention"],
    flirtSignalsZh: ["在你面前 energy 比平时高 30%", "会「借口」靠近你", "突然带你去 TA 觉得超棒但很少人知道的地方"],
    flirtSignalsEn: ["Energy goes up 30% around you", "Finds excuses to get close", "Takes you to amazing hidden spots"],
    dateSpotsZh: ["演唱会", "主题乐园", "密室逃脱", "即兴旅行"],
    dateSpotsEn: ["Concert", "Theme park", "Escape room", "Spontaneous trip"],
    sparkMomentZh: "在 dancefloor 上转过头朝你伸出手的瞬间。",
    sparkMomentEn: "Turning around on the dance floor and reaching out their hand to you.",
  },
  LRS: {
    emoji: "☀️", nameZh: "人间小太阳", nameEn: "Little Sun",
    taglineZh: "把你照顾到，连你妈都满意", taglineEn: "Takes care of you so well, even your mom approves",
    campZh: "心安港湾派", campEn: "Safe Harbor", mbti: "ESFJ",
    traitsZh: ["温暖", "周到", "社交达人", "重视家庭", "传统派"],
    traitsEn: ["Warm", "Thoughtful", "Social butterfly", "Family-oriented", "Traditional"],
    strengthsZh: ["顶级 caretaker，从你的胃到衣柜都管好", "把你的家人朋友变成「我们的」", "节日仪式感拉满，记得每一个纪念日"],
    strengthsEn: ["Ultimate caretaker — from your stomach to your wardrobe", "Turns your family and friends into 'ours'", "Never misses an anniversary or celebration"],
    trapsZh: ["会用「为你好」包装控制欲", "太在乎别人怎么看", "容易牺牲自己维持表面和谐"],
    trapsEn: ["Wraps controlling behavior in 'it's for your own good'", "Cares too much about others' opinions", "Sacrifices self to keep surface-level peace"],
    flirtSignalsZh: ["主动照顾你的生活细节", "邀请你参加 TA 的家庭聚会", "记得你随口提过的过敏/喜好"],
    flirtSignalsEn: ["Proactively takes care of life's little details for you", "Invites you to family gatherings", "Remembers your allergies and preferences you once mentioned"],
    dateSpotsZh: ["亲手做的家常菜", "烹饪课", "一起看望家人"],
    dateSpotsEn: ["Home-cooked meal", "Cooking class", "Visiting family together"],
    sparkMomentZh: "你病了一整夜，醒来发现 TA 已经熬好粥、关好窗、把药放在床头。",
    sparkMomentEn: "You're sick all night, and wake up to find they've made congee, closed the windows, and left medicine on your nightstand.",
  },
  DFF: {
    emoji: "🌙", nameZh: "月光诗人", nameEn: "Moon Poet",
    taglineZh: "把你写进诗里，但不会念给你听", taglineEn: "Writes you into poetry but never reads it aloud",
    campZh: "灵魂共鸣派", campEn: "Soul Resonance", mbti: "INFP",
    traitsZh: ["理想化", "内向", "深情", "价值观至上", "想象力丰富"],
    traitsEn: ["Idealistic", "Introverted", "Deeply loving", "Values-driven", "Imaginative"],
    strengthsZh: ["一旦爱上，深情得让人心疼", "拥有最浪漫的内心世界", "对关系有近乎信仰的忠诚"],
    strengthsEn: ["Once in love, devotion is heartbreakingly deep", "Has the most romantic inner world", "Loyalty to the relationship borders on faith"],
    trapsZh: ["对爱情期待过高", "不擅直接表达", "容易把对方理想化，幻灭时痛得很深"],
    trapsEn: ["Sets the bar for love impossibly high", "Struggles with direct expression", "Idealizes partners; disillusionment hits hard"],
    flirtSignalsZh: ["把私人歌单/书/电影分享给你", "信息很短但用词很讲究", "突然写一段「灵感」发给你"],
    flirtSignalsEn: ["Shares personal playlists / books / films with you", "Messages are short but every word is chosen", "Sends you a random 'inspired' piece of writing"],
    dateSpotsZh: ["独立书店", "旧物市集", "美术馆", "雨天咖啡馆"],
    dateSpotsEn: ["Indie bookstore", "Vintage market", "Art gallery", "Rainy-day café"],
    sparkMomentZh: "凌晨突然跟你分享一句歌词：「觉得这句很像你」。",
    sparkMomentEn: "At 3 AM, sharing a lyric with you: 'This line reminds me of you.'",
  },
  DFS: {
    emoji: "🌌", nameZh: "深海读心师", nameEn: "Deep Sea Reader",
    taglineZh: "你还没开口，TA 已经懂了一半", taglineEn: "Understands you before you even speak",
    campZh: "灵魂共鸣派", campEn: "Soul Resonance", mbti: "INFJ",
    traitsZh: ["神秘", "共情力极强", "安静", "高标准", "深度型"],
    traitsEn: ["Mysterious", "Extremely empathetic", "Quiet", "High standards", "Deep thinker"],
    strengthsZh: ["世界上最好的倾听者", "能 read 到你自己都没意识到的情绪", "对感情极度认真"],
    strengthsEn: ["The world's best listener", "Reads emotions you didn't even know you had", "Takes relationships extremely seriously"],
    trapsZh: ["门槛很高，能进 TA 心的人很少", "一旦关上心门，很难再打开", "对完美关系的追求让现实关系压力很大"],
    trapsEn: ["Very high barrier to entry — few get into their heart", "Once the door closes, it rarely reopens", "Pursuit of the perfect relationship adds pressure"],
    flirtSignalsZh: ["突然问你一个超级深的问题", "记得你三个月前随口说的细节", "选择性地跟你分享从不告诉别人的事"],
    flirtSignalsEn: ["Suddenly asks a deeply personal question", "Remembers a detail you mentioned 3 months ago", "Selectively shares things they've never told anyone"],
    dateSpotsZh: ["深夜酒吧角落", "长程散步", "心理测试", "安静有故事的小馆子"],
    dateSpotsEn: ["Quiet corner of a late-night bar", "Long walk", "Personality quiz", "Cozy hidden restaurant"],
    sparkMomentZh: "你以为 TA 没听见，第二天 TA 用最准的方式回应了你最隐秘的感受。",
    sparkMomentEn: "You thought they didn't hear — the next day they respond to your deepest feeling with perfect precision.",
  },
  DRF: {
    emoji: "📷", nameZh: "胶片浪漫家", nameEn: "Film Romantic",
    taglineZh: "用一张照片、一首歌，悄悄爱你", taglineEn: "Loves you quietly through a photo, a song",
    campZh: "当下心动派", campEn: "In-the-Moment", mbti: "ISFP",
    traitsZh: ["艺术敏感", "当下主义", "安静温柔", "直觉型", "不爱被定义"],
    traitsEn: ["Artistically sensitive", "Lives in the now", "Quietly gentle", "Intuitive", "Hates being labeled"],
    strengthsZh: ["会用自己的方式记录你", "不给你压力，让你觉得自由", "感官敏锐，约会细节都很有感觉"],
    strengthsEn: ["Documents you in their own special way", "Gives you space and freedom", "Sensory-sharp — every date detail feels curated"],
    trapsZh: ["不擅长讲「我爱你」", "价值观被冒犯时会突然消失", "不喜欢长远规划"],
    trapsEn: ["Struggles to say 'I love you'", "Disappears when values are offended", "Avoids long-term planning"],
    flirtSignalsZh: ["给你拍了照片但不发出来，自己存着", "把喜欢的小东西默默放到你包里", "用作品/创作间接表白"],
    flirtSignalsEn: ["Takes photos of you but keeps them private", "Quietly slips small gifts into your bag", "Confesses indirectly through creative work"],
    dateSpotsZh: ["Vinyl 店", "古着店", "一起拍胶片", "海边看夜景"],
    dateSpotsEn: ["Vinyl shop", "Vintage store", "Film photography together", "Night view by the sea"],
    sparkMomentZh: "把 TA 平时戴的项链/耳机/帽子悄悄给你。",
    sparkMomentEn: "Quietly gives you the necklace / earbuds / hat they always wear.",
  },
  DRS: {
    emoji: "🕯️", nameZh: "暖光守护者", nameEn: "Warm Guardian",
    taglineZh: "不擅言辞，但你冷了 TA 一定知道", taglineEn: "Not great with words, but always knows when you're cold",
    campZh: "心安港湾派", campEn: "Safe Harbor", mbti: "ISFJ",
    traitsZh: ["温柔", "默默付出", "责任感强", "念旧", "安静稳定"],
    traitsEn: ["Gentle", "Quietly devoted", "Responsible", "Nostalgic", "Calm & steady"],
    strengthsZh: ["真正「细水长流」型恋人", "把承诺当生命，说要照顾你就一辈子", "记得你所有的小细节"],
    strengthsEn: ["The true 'slow burn' lover", "Treats promises as sacred — commits for life", "Remembers every small detail about you"],
    trapsZh: ["太会忍，把负面情绪憋到爆炸", "不擅长「被照顾」", "一旦失望累积，会安静地走"],
    trapsEn: ["Bottles up emotions until they explode", "Struggles with being taken care of", "When disappointment accumulates, leaves quietly"],
    flirtSignalsZh: ["默默记下你说的每一句喜好", "在你需要时刚好出现", "看你的眼神特别久、特别温"],
    flirtSignalsEn: ["Silently memorizes every preference you mention", "Shows up right when you need them", "Looks at you with an extra-long, warm gaze"],
    dateSpotsZh: ["家里做饭", "看老电影", "散步", "安静的下午茶"],
    dateSpotsEn: ["Cooking at home", "Classic movies", "A quiet walk", "Peaceful afternoon tea"],
    sparkMomentZh: "你哭得不行的时候，TA 一句话也不说，把你抱住，让你哭完。",
    sparkMomentEn: "When you can't stop crying, they say nothing — just hold you and let you cry it out.",
  },
  GREY: {
    emoji: "🌫️", nameZh: "灰阶人格", nameEn: "Grey Persona",
    taglineZh: "你不属于任何一类，你是所有类的交汇点", taglineEn: "You don't belong to any single type — you're where they all converge",
    campZh: "未定义", campEn: "Undefined", mbti: "—",
    traitsZh: ["适应力强", "多面", "灵活", "难以被定义", "复杂"],
    traitsEn: ["Adaptive", "Multi-faceted", "Flexible", "Hard to define", "Complex"],
    strengthsZh: ["极强的适应力，能切换不同恋爱模式", "复杂而立体，很难被看透", "能与任何类型产生共鸣"],
    strengthsEn: ["Extremely adaptable — can switch between love styles", "Complex and layered, hard to see through", "Can resonate with any type"],
    trapsZh: ["自己也不确定想要什么", "容易在不同模式间迷失", "让对方难以判断你的真实需求"],
    trapsEn: ["Not sure what they really want", "Easily lost between different modes", "Hard for partners to read their true needs"],
    flirtSignalsZh: ["因场景不同而完全不同", "有时像烟花一样热烈，有时像诗人一样安静", "让人猜不透但又放不下"],
    flirtSignalsEn: ["Completely different depending on the setting", "Sometimes fiery like fireworks, sometimes quiet like a poet", "Impossible to figure out but impossible to let go"],
    dateSpotsZh: ["让对方决定", "任何地方都行", "关键是人对了"],
    dateSpotsEn: ["Let the other person decide", "Anywhere works", "It's about the person, not the place"],
    sparkMomentZh: "对方突然说「我从来没遇过像你这样的人」。",
    sparkMomentEn: "When they suddenly say, 'I've never met anyone like you.'",
  },
};

/* Helper to pick bilingual archetype field */
function archL<T>(isZh: boolean, zh: T, en: T): T { return isZh ? zh : en; }

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
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] border border-white/5 p-3.5">
      <div className="text-white/30">{icon}</div>
      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-wider text-white/20">{label}</div>
        <div className={`text-sm font-bold truncate ${color}`}>{value}</div>
      </div>
    </div>
  );
}

/* ─── Profile Analysis Card ─── */
function AnalysisCard({ analysis, t }: { analysis: ProfileAnalysis; t: (k: string, o?: any) => string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <SectionCard className="border-white/10 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-aura" />
          <span className="text-xs font-black uppercase tracking-[0.3em] text-white/20">{t("student.profile.auraAnalysis")}</span>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-white/30 hover:text-white/60 transition-colors">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      <p className="text-sm leading-relaxed text-white/65 font-medium">{analysis.summary}</p>

      {analysis.romanticStyle && (
        <div className="mt-4 rounded-2xl bg-aura/5 border border-aura/10 p-4">
          <div className="text-[9px] font-black uppercase tracking-wider text-aura/40 mb-1">{t("student.profile.romanticStyle")}</div>
          <div className="text-sm text-aura/80 font-bold">{analysis.romanticStyle}</div>
        </div>
      )}

      {expanded && (
        <div className="mt-5 space-y-5 animate-in fade-in duration-300">
          {analysis.strengths?.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">{t("student.persona.strengths")}</div>
              <div className="flex flex-wrap gap-2">
                {analysis.strengths.map((s) => (
                  <span key={s} className="rounded-xl bg-green-400/10 border border-green-400/20 px-3 py-1.5 text-xs font-bold text-green-400">{s}</span>
                ))}
              </div>
            </div>
          )}
          {analysis.idealMatch && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">{t("student.profile.idealMatch")}</div>
              <p className="text-sm text-white/55 font-medium leading-relaxed">{analysis.idealMatch}</p>
            </div>
          )}
          {analysis.conversationHooks?.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">{t("student.profile.conversationStarters")}</div>
              <ul className="space-y-1.5">
                {analysis.conversationHooks.map((h) => (
                  <li key={h} className="text-sm text-white/50 font-medium flex items-start gap-2"><span className="text-aura mt-0.5">•</span>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.firstDateSuggestions?.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">{t("student.profile.firstDateIdeas")}</div>
              <div className="flex flex-wrap gap-2">
                {analysis.firstDateSuggestions.map((s) => (
                  <span key={s} className="rounded-xl bg-harbour/10 border border-harbour/20 px-3 py-1.5 text-xs font-bold text-harbour">{s}</span>
                ))}
              </div>
            </div>
          )}
          {analysis.matchSignals?.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">{t("student.profile.matchSignals")}</div>
              <div className="flex flex-wrap gap-2">
                {analysis.matchSignals.map((s) => (
                  <span key={s} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/55">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/* ─── Inline Tag Row (compact) ─── */
function TagRow({ label, tags, color }: { label: string; tags: string[]; color: string }) {
  if (!tags.length) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-[10px] font-black uppercase tracking-wider text-white/25 mt-1.5 shrink-0 w-16">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => <span key={tag} className={`rounded-xl px-3 py-1 text-xs font-bold ${color}`}>{tag}</span>)}
      </div>
    </div>
  );
}

/* ─── Profile Tab ─── */
function ProfileTab({ profile, t }: { profile: StudentProfile; t: (k: string, o?: any) => string }) {
  const navigate = useNavigate();
  const dp = profile.datingPreferences;
  const photos = dp?.photoUrls?.filter((u) => u && u.length > 10) ?? [];
  const weekendVibes = profile.lifeSignals?.weekendVibes ?? [];
  const mbtiStr = getMbtiString(dp?.mbti);
  const age = getAge(dp?.birthday);
  const hasAttrSignals = dp?.attractionSignals && (dp.attractionSignals.heightAndBuild || dp.attractionSignals.energyAndVibe);

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
          <div className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-3">{t("student.profile.personalInfo")}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {age && <InfoChip icon={<Calendar size={14} />} label={t("student.profile.age")} value={`${age}`} />}
            {profile.gender && <InfoChip icon={<User size={14} />} label={t("student.profile.gender")} value={tOpt(t, profile.gender)} />}
            {dp?.heightCm && <InfoChip icon={<Ruler size={14} />} label={t("student.profile.height")} value={`${dp.heightCm} cm`} />}
            {mbtiStr && <InfoChip icon={<Sparkles size={14} />} label="MBTI" value={mbtiStr} color="text-aura font-black tracking-[0.2em]" />}
            {dp?.datingGoal && <InfoChip icon={<Target size={14} />} label={t("student.profile.datingGoal")} value={tOpt(t, dp.datingGoal)} />}
          </div>
        </SectionCard>

        {/* AI Analysis */}
        {profile.profileAnalysis && <AnalysisCard analysis={profile.profileAnalysis} t={t} />}

        {/* About Me — merged bio, location, languages, interests, vibes, weekend */}
        <SectionCard className="border-white/10 shadow-2xl">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-4">{t("student.profile.aboutMe")}</div>
          <div className="space-y-4">
            {profile.bio && <p className="text-white/70 leading-relaxed text-sm font-medium">{profile.bio}</p>}

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

            {profile.availability.length > 0 && (
              <TagRow label={t("join.availability")} color="bg-green-400/10 border border-green-400/20 text-green-400"
                tags={profile.availability.map((slot) => slot.includes(".") ? t(slot) : t(`join.slots.${slot}`, { defaultValue: slot }))} />
            )}
          </div>
        </SectionCard>

        {/* Preferences & Type — merged dating prefs + attraction signals */}
        {(dp?.dateGenders?.length || dp?.datingGoals?.length || dp?.ageRange || dp?.matchMode || hasAttrSignals) && (
          <SectionCard className="border-white/10 shadow-2xl">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-4">{t("student.profile.prefsAndType")}</div>
            <div className="space-y-3">
              {dp?.dateGenders?.length ? (
                <TagRow label={t("student.profile.lookingFor")} color="bg-white/5 border border-white/10 text-white/60"
                  tags={dp.dateGenders.map((g) => tOpt(t, g))} />
              ) : null}
              {dp?.datingGoals?.length ? (
                <TagRow label={t("student.profile.goals")} color="bg-aura/10 border border-aura/20 text-aura/70"
                  tags={dp.datingGoals.map((g) => tOpt(t, g))} />
              ) : null}
              {dp?.ageRange && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/25 shrink-0 w-16">{t("student.profile.ageRange")}</span>
                  <span className="text-sm font-bold text-white/60">{dp.ageRange.min} – {dp.ageRange.max}</span>
                </div>
              )}
              {dp?.matchMode && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/25 shrink-0 w-16">{t("student.profile.matchMode")}</span>
                  <span className="text-sm font-bold text-white/60">{tOpt(t, `mode_${dp.matchMode}`)}</span>
                </div>
              )}
              {hasAttrSignals && (
                <>
                  <div className="border-t border-white/5 pt-3 mt-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-white/25 mb-2">{t("student.profile.attractionSignals")}</div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {dp!.attractionSignals!.heightAndBuild && (
                      <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                        <div className="text-[9px] font-black uppercase tracking-wider text-white/25 mb-0.5">{t("student.profile.heightBuild")}</div>
                        <div className="text-xs text-white/55 font-medium">{dp!.attractionSignals!.heightAndBuild}</div>
                      </div>
                    )}
                    {dp!.attractionSignals!.energyAndVibe && (
                      <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                        <div className="text-[9px] font-black uppercase tracking-wider text-white/25 mb-0.5">{t("student.profile.energyVibe")}</div>
                        <div className="text-xs text-white/55 font-medium">{dp!.attractionSignals!.energyAndVibe}</div>
                      </div>
                    )}
                  </div>
                </>
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
  const isZh = currentLang.startsWith("zh");

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

  const dp = profile.datingPreferences;
  const mbtiStr = getMbtiString(dp?.mbti);
  const age = getAge(dp?.birthday);

  return (
    <div className="space-y-8">
      {/* Hero Card */}
      <div className="relative rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-aura/20 via-purple-950/60 to-harbour/20 pointer-events-none" />
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-aura/15 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-harbour/15 blur-[120px] pointer-events-none" />

        <div className="relative z-10 p-8 md:p-12">
          <div className="flex flex-col md:flex-row md:items-start gap-8">
            {/* Big Emoji + Code */}
            <div className="shrink-0 flex flex-col items-center">
              <div className="h-32 w-32 rounded-[40px] bg-white/[0.06] border border-white/10 flex items-center justify-center text-6xl shadow-2xl backdrop-blur-xl">
                {archetype.emoji}
              </div>
              <div className="mt-4 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-sm font-black text-white tracking-[0.3em]">
                {ldfrResult.code}
              </div>
              <div className="mt-2 text-xs font-bold text-white/30">{archL(isZh, archetype.campZh, archetype.campEn)}</div>
            </div>

            {/* Title + Tagline + Analysis */}
            <div className="flex-1 min-w-0">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">{isZh ? `${archetype.nameZh} / ${archetype.nameEn}` : `${archetype.nameEn} / ${archetype.nameZh}`}</h2>
              <div className="mt-2 text-lg text-white/50 font-bold italic">{archL(isZh, archetype.taglineZh, archetype.taglineEn)}</div>
              <div className="mt-1 text-sm text-white/30 font-medium">MBTI: {archetype.mbti}{mbtiStr ? ` (${isZh ? "你" : "You"}: ${mbtiStr})` : ""}</div>

              {/* Traits */}
              <div className="mt-6 flex flex-wrap gap-2">
                {archL(isZh, archetype.traitsZh, archetype.traitsEn).map((trait) => (
                  <span key={trait} className="rounded-full bg-white/10 border border-white/10 px-4 py-1.5 text-sm font-bold text-white/70">{trait}</span>
                ))}
              </div>

              {/* Personal Vibe */}
              <div className="mt-6 rounded-2xl bg-white/[0.05] border border-white/10 p-5">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-aura/50 mb-2">{t("student.persona.yourVibe")}</div>
                <p className="text-base text-white/70 font-medium leading-relaxed">{ldfrResult.vibe}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <SectionCard className="border-white/10 shadow-2xl">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={18} className="text-aura" />
          <span className="text-xs font-black uppercase tracking-[0.3em] text-white/20">{t("student.persona.aiAnalysis")}</span>
        </div>
        <p className="text-base leading-relaxed text-white/70 font-medium">{ldfrResult.analysis}</p>

        {/* Quick personal context */}
        {(age || mbtiStr || dp?.heightCm) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {age && <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-sm font-bold text-white/40">{age}yo</span>}
            {dp?.heightCm && <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-sm font-bold text-white/40">{dp.heightCm}cm</span>}
            {mbtiStr && <span className="rounded-full bg-aura/10 border border-aura/20 px-3 py-1 text-sm font-bold text-aura/60">{mbtiStr}</span>}
            {profile.gender && <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-sm font-bold text-white/40">{tOpt(t, profile.gender)}</span>}
          </div>
        )}
      </SectionCard>

      {/* Strengths & Traps */}
      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard className="border-green-400/10 shadow-2xl">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-green-400/40 mb-4">💖 {t("student.persona.strengths")}</div>
          <ul className="space-y-3">
            {archL(isZh, archetype.strengthsZh, archetype.strengthsEn).map((s) => (
              <li key={s} className="flex items-start gap-3">
                <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                <span className="text-sm text-white/65 font-medium leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard className="border-amber-400/10 shadow-2xl">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-amber-400/40 mb-4">⚠️ {t("student.persona.watchOut")}</div>
          <ul className="space-y-3">
            {archL(isZh, archetype.trapsZh, archetype.trapsEn).map((s) => (
              <li key={s} className="flex items-start gap-3">
                <span className="text-amber-400 mt-0.5 shrink-0">!</span>
                <span className="text-sm text-white/65 font-medium leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Flirt Signals */}
      <SectionCard className="border-white/10 shadow-2xl">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-5">💌 {t("student.persona.flirtSignals")}</div>
        <div className="space-y-3">
          {archL(isZh, archetype.flirtSignalsZh, archetype.flirtSignalsEn).map((sig) => (
            <div key={sig} className="flex items-start gap-3 rounded-2xl bg-white/[0.03] border border-white/5 p-4">
              <span className="text-pink-400 shrink-0 mt-0.5">♡</span>
              <span className="text-sm text-white/60 font-medium">{sig}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Spark Moment + Ideal Date */}
      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard className="border-white/10 shadow-2xl">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-4">✨ {t("student.persona.sparkMoment")}</div>
          <p className="text-base text-white/60 font-medium leading-relaxed italic">{archL(isZh, archetype.sparkMomentZh, archetype.sparkMomentEn)}</p>
        </SectionCard>

        <SectionCard className="border-white/10 shadow-2xl">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-4">🌟 {t("student.persona.idealDateSpots")}</div>
          <div className="flex flex-wrap gap-2">
            {archL(isZh, archetype.dateSpotsZh, archetype.dateSpotsEn).map((spot) => (
              <span key={spot} className="rounded-2xl bg-harbour/10 border border-harbour/20 px-4 py-2 text-sm text-harbour font-bold">{spot}</span>
            ))}
          </div>
          {ldfrResult.idealDate && (
            <div className="mt-4 rounded-2xl bg-white/[0.03] border border-white/5 p-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-white/25 mb-1">{t("student.persona.aiSuggested")}</div>
              <p className="text-sm text-white/55 font-medium italic">{ldfrResult.idealDate}</p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Best Matches */}
      <SectionCard className="border-white/10 shadow-2xl">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-5">🔮 {t("student.persona.bestMatchTypes")}</div>
        <div className="grid gap-4 sm:grid-cols-3">
          {bestMatches.map(([code, stars]) => {
            const match = LDFR_ARCHETYPES[code];
            if (!match) return null;
            return (
              <div key={code} className="rounded-2xl bg-white/[0.03] border border-white/5 p-5 text-center hover:bg-white/[0.06] transition-colors">
                <div className="text-3xl mb-2">{match.emoji}</div>
                <div className="text-base font-black text-white">{isZh ? match.nameZh : match.nameEn}</div>
                <div className="text-xs text-white/40 font-bold mt-0.5">{code} · {isZh ? match.nameEn : match.nameZh}</div>
                <div className="mt-2 text-aura text-sm tracking-wider">{"⭐".repeat(stars)}</div>
                <div className="mt-2 text-xs text-white/30 font-medium italic">{archL(isZh, match.taglineZh, match.taglineEn)}</div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* All 8 Types Overview */}
      <SectionCard className="border-white/10 shadow-2xl">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-5">{t("student.persona.allTypes")}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(LDFR_ARCHETYPES).filter(([code]) => code !== "GREY").map(([code, arch]) => {
            const isYou = code === ldfrResult.code;
            const compat = compatRow[code] ?? 0;
            return (
              <div key={code} className={`rounded-2xl p-4 border transition-all ${isYou ? "bg-aura/10 border-aura/30 ring-2 ring-aura/20" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{arch.emoji}</span>
                  <span className={`text-sm font-black ${isYou ? "text-aura" : "text-white/70"}`}>{code}</span>
                  {isYou && <span className="text-[10px] font-black bg-aura/20 text-aura px-2 py-0.5 rounded-full ml-auto">{t("student.persona.you")}</span>}
                </div>
                <div className="text-sm font-bold text-white/60">{isZh ? arch.nameZh : arch.nameEn}</div>
                <div className="text-xs text-white/30 mt-1">{isZh ? arch.nameEn : arch.nameZh}</div>
                {!isYou && <div className="mt-2 text-xs text-aura/50">{"⭐".repeat(compat)}</div>}
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
function PartnerInfoPanel({ partner, t }: { partner: StudentProfile; t: (k: string, o?: any) => string }) {
  const dp = partner.datingPreferences;
  const photos = dp?.photoUrls?.filter((u) => u && u.length > 10) ?? [];
  const mbtiStr = getMbtiString(dp?.mbti);
  const age = getAge(dp?.birthday);
  const weekendVibes = partner.lifeSignals?.weekendVibes ?? [];

  return (
    <div className="space-y-6">
      {photos.length > 0 && <PhotoGallery photos={photos} />}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {age && <InfoChip icon={<Calendar size={16} />} label={t("student.profile.age")} value={`${age}`} />}
        {dp?.heightCm && <InfoChip icon={<Ruler size={16} />} label={t("student.profile.height")} value={`${dp.heightCm} cm`} />}
        {mbtiStr && <InfoChip icon={<Sparkles size={16} />} label="MBTI" value={mbtiStr} color="text-aura font-black tracking-[0.2em]" />}
        {partner.gender && <InfoChip icon={<User size={16} />} label={t("student.profile.gender")} value={tOpt(t, partner.gender)} />}
        {dp?.datingGoal && <InfoChip icon={<Target size={16} />} label={t("student.profile.datingGoal")} value={tOpt(t, dp.datingGoal)} />}
      </div>

      {partner.bio && (
        <div>
          <div className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-3">{t("student.aboutThem")}</div>
          <p className="text-white/70 leading-relaxed text-base font-medium">{partner.bio}</p>
        </div>
      )}

      {partner.interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {partner.interests.map((chip) => (
            <span key={chip} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-aura font-black italic">
              #{chip.includes(".") ? t(chip) : t(`join.tags.${chip}`, { defaultValue: chip })}
            </span>
          ))}
        </div>
      )}

      {partner.vibeTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {partner.vibeTags.map((tag) => (
            <span key={tag} className="rounded-2xl bg-harbour/10 border border-harbour/20 px-3 py-2 text-sm text-harbour font-black">
              {tag.includes(".") ? t(tag) : t(`join.vibes.${tag}`, { defaultValue: tag })}
            </span>
          ))}
        </div>
      )}

      {weekendVibes.length > 0 && (
        <div>
          <div className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-2">{t("student.profile.weekendVibes")}</div>
          <div className="flex flex-wrap gap-2">
            {weekendVibes.map((v) => (
              <span key={v} className="rounded-xl bg-pink-400/10 border border-pink-400/20 px-3 py-1.5 text-sm text-pink-400 font-bold">{tOpt(t, v)}</span>
            ))}
          </div>
        </div>
      )}

      {dp?.hkMtrLocations?.length ? (
        <div>
          <div className="text-xs font-black uppercase tracking-[0.3em] text-white/20 mb-2 flex items-center gap-2"><MapPin size={14} />{t("student.profile.location")}</div>
          <div className="flex flex-wrap gap-2">
            {dp.hkMtrLocations.map((loc) => (
              <span key={loc} className="rounded-xl bg-emerald-400/10 border border-emerald-400/20 px-3 py-1.5 text-sm text-emerald-400 font-bold">{tOpt(t, loc)}</span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Partner LDFR type badge only (no detailed analysis for privacy) */}
      {partner.ldfrResult && LDFR_ARCHETYPES[partner.ldfrResult.code] && (
        <div className="rounded-3xl bg-white/[0.03] border border-white/5 p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3 flex items-center gap-2"><Flame size={14} className="text-pink-400" />{t("student.profile.lovePersona")}</div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{LDFR_ARCHETYPES[partner.ldfrResult.code].emoji}</span>
            <div>
              <div className="text-base font-black text-white">{LDFR_ARCHETYPES[partner.ldfrResult.code].nameZh}</div>
              <div className="text-xs text-white/40 font-bold">{partner.ldfrResult.code} · {LDFR_ARCHETYPES[partner.ldfrResult.code].nameEn}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Match Detail Modal ─── */
function MatchDetail({ view, profile, onClose, onRefresh, t }: {
  view: MatchView; profile: StudentProfile; onClose: () => void; onRefresh: () => void; t: (k: string, o?: any) => string;
}) {
  const { i18n } = useTranslation();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [icebreaker, setIcebreaker] = useState<{ introForA: string; introForB: string; conversationStarters: string[]; dateVibe: string } | null>(null);
  const [icebreakerLoading, setIcebreakerLoading] = useState(false);

  const isUserA = view.match.userAId === profile.id;
  const reasons = isUserA ? view.match.reasonsForA : view.match.reasonsForB;
  const canFeedback = ["happened", "feedback-collected"].includes(view.match.status);

  // Dual-confirmation logic
  const confirmations = view.match.dateConfirmations ?? [];
  const myConfirm = confirmations.find((x) => x.userId === profile.id);
  const partnerConfirm = confirmations.find((x) => x.userId !== profile.id);
  const iConfirmedSlot = !!myConfirm;
  const iConfirmedPlace = !!(myConfirm?.place);
  const partnerConfirmedSlot = !!partnerConfirm;
  const partnerConfirmedPlace = !!(partnerConfirm?.place);
  const bothFullyConfirmed = iConfirmedPlace && partnerConfirmedPlace;

  // For legacy matches (status=scheduled but no dateConfirmations), treat as needing confirmation
  const isLegacyScheduled = ["scheduled", "place-confirmed", "slot-confirmed"].includes(view.match.status) && confirmations.length === 0;

  const hasSlot = !!view.match.confirmedSlot;
  const isPostDate = ["happened", "feedback-collected", "closed"].includes(view.match.status);
  // Contact exchange requires BOTH users to have confirmed (dateConfirmations with place),
  // OR the match has already progressed past the date (post-date feedback stages)
  const isComplete = bothFullyConfirmed || isPostDate;

  // Load icebreaker when both confirmed
  useEffect(() => {
    if (!isComplete || icebreaker || icebreakerLoading) return;
    setIcebreakerLoading(true);
    api.getIcebreaker(view.match.id, i18n.language).then((res) => {
      if (res.icebreaker) setIcebreaker(res.icebreaker);
    }).catch(() => {}).finally(() => setIcebreakerLoading(false));
  }, [isComplete, view.match.id]);

  async function confirmSlot(slot: string) {
    setBusy(true);
    try {
      await api.confirmSlot(view.match.id, slot);
      try { await api.respondToMatch(view.match.id, "yes"); } catch {}
      try { await api.pickPlace(view.match.id); } catch {}
      onRefresh();
    } catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function confirmPlace() {
    setBusy(true);
    try {
      await api.pickPlace(view.match.id);
      try { await api.respondToMatch(view.match.id, "yes"); } catch {}
      onRefresh();
    } catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
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
      <div className="relative w-full max-w-3xl rounded-[2rem] bg-[#0f172a]/95 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden my-8">
        {/* Header */}
        <div className="relative h-48 bg-gradient-to-br from-indigo-950 via-purple-950 to-harbour/30 p-8 flex items-end">
          <button onClick={onClose} className="absolute top-5 right-5 rounded-full bg-black/40 p-2 text-white/60 hover:text-white hover:bg-black/60 transition-all"><X size={20} /></button>
          <div className="absolute top-5 left-5">
            <button onClick={onClose} className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-bold transition-colors"><ArrowLeft size={16} /> {t("join.dev.back")}</button>
          </div>
          <div className="flex items-end gap-5 relative z-10">
            {view.partner.datingPreferences?.photoUrls?.[0] ? (
              <div className="h-20 w-20 rounded-[28px] overflow-hidden shadow-2xl ring-4 ring-[#0f172a] shrink-0">
                <img src={view.partner.datingPreferences.photoUrls[0]} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-20 w-20 rounded-[28px] bg-gradient-to-br from-aura to-harbour flex items-center justify-center text-2xl font-black text-white shadow-2xl ring-4 ring-[#0f172a] shrink-0">{initials(view.partner.fullName)}</div>
            )}
            <div className="pb-1">
              <div className="text-2xl font-black tracking-tight text-white">{view.partner.fullName}</div>
              <div className="text-sm text-white/50 font-medium mt-1">{view.partner.major} · {view.partner.yearOfStudy}</div>
            </div>
          </div>
          <div className="absolute bottom-5 right-8 flex items-center gap-3">
            <span className="text-sm font-bold text-white/50">{t("student.compatibility")}</span>
            <span className="text-2xl font-black text-aura italic">{view.match.score}%</span>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* AI Matchmaker Intro — why you're matched */}
          {reasons?.length > 0 && (
            <div className="rounded-3xl bg-gradient-to-br from-aura/5 to-harbour/5 border border-aura/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-aura" />
                <span className="text-xs font-black uppercase tracking-[0.3em] text-aura/50">{t("student.matchFlow.whyMatched")}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {reasons.map((r) => (
                  <span key={r} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-sm font-bold text-white/60">{r}</span>
                ))}
              </div>
              {partnerArchetype && (
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <span className="text-xl">{partnerArchetype.emoji}</span>
                  <div>
                    <span className="text-sm font-black text-white/70">{partnerArchetype.nameZh}</span>
                    <span className="text-xs text-white/30 font-bold ml-2">{view.partner.ldfrResult!.code} · {partnerArchetype.nameEn}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Partner basic info */}
          <PartnerInfoPanel partner={view.partner} t={t} />

          {/* ── Step 1: Choose Date Time ── */}
          {!iConfirmedSlot && !isPostDate && (
            <div className="rounded-3xl border border-aura/20 bg-aura/5 p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="h-8 w-8 rounded-full bg-aura flex items-center justify-center text-sm font-black text-white">1</span>
                <h3 className="text-base font-black text-white">{t("student.matchFlow.step1Title")}</h3>
              </div>
              <p className="text-sm text-white/40 font-medium mb-5 ml-11">{t("student.matchFlow.step1Desc")}</p>
              {partnerConfirmedSlot && (
                <div className="ml-11 mb-4 rounded-2xl bg-amber-400/10 border border-amber-400/20 px-4 py-3">
                  <span className="text-sm font-bold text-amber-400">{t("student.matchFlow.partnerAlreadyConfirmed")}</span>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2 ml-11">
                {(view.match.overlapSlots?.length ? view.match.overlapSlots : view.match.proposedSlots ?? []).map((slot) => (
                  <button key={slot} disabled={busy} onClick={() => confirmSlot(slot)}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-left hover:bg-aura/10 hover:border-aura/30 transition-all disabled:opacity-30 group">
                    <div className="text-sm font-black text-white group-hover:text-aura transition-colors">
                      {slot.includes(".") ? t(slot) : t(`join.slots.${slot}`, { defaultValue: slot })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Confirm Date Spot ── */}
          {iConfirmedSlot && !iConfirmedPlace && (view.match.curatedDateTitle || view.match.proposedPlace) && (
            <div className="rounded-3xl border border-harbour/20 bg-harbour/5 p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="h-8 w-8 rounded-full bg-harbour flex items-center justify-center text-sm font-black text-white">2</span>
                <h3 className="text-base font-black text-white">{t("student.matchFlow.step2Title")}</h3>
              </div>
              <p className="text-sm text-white/40 font-medium mb-5 ml-11">{t("student.matchFlow.step2Desc")}</p>
              {partnerConfirmedPlace && (
                <div className="ml-11 mb-4 rounded-2xl bg-amber-400/10 border border-amber-400/20 px-4 py-3">
                  <span className="text-sm font-bold text-amber-400">{t("student.matchFlow.partnerAlreadyConfirmed")}</span>
                </div>
              )}
              <div className="ml-11 rounded-2xl bg-white/[0.03] border border-white/10 p-5 mb-4">
                {view.match.curatedDateTitle && <div className="text-xl font-black text-aura tracking-tight">{view.match.curatedDateTitle}</div>}
                <div className="text-sm text-white/50 mt-1 font-medium">{view.match.curatedDateSpot ?? view.match.proposedPlace?.name}</div>
                {view.match.curatedDateTips?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {view.match.curatedDateTips.map((tip) => (
                      <span key={tip} className="text-xs text-white/30 font-medium bg-white/5 rounded-full px-3 py-1">{tip}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="ml-11">
                <button disabled={busy} onClick={confirmPlace}
                  className="rounded-2xl bg-harbour px-8 py-3.5 text-base font-black text-white shadow-lg shadow-harbour/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-30">
                  {t("student.matchFlow.confirmSpot")}
                </button>
              </div>
            </div>
          )}

          {/* Slot confirmed badge (my confirmation) */}
          {iConfirmedSlot && (
            <div className="flex items-center gap-3 rounded-2xl bg-green-400/10 border border-green-400/20 px-5 py-3">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-bold text-green-400">
                {t("student.matchFlow.confirmed")}: {view.match.confirmedSlot?.includes(".") ? t(view.match.confirmedSlot) : t(`join.slots.${view.match.confirmedSlot}`, { defaultValue: view.match.confirmedSlot })}
              </span>
              {view.match.proposedPlace && (
                <span className="text-sm font-bold text-green-400/60 ml-auto">📍 {view.match.proposedPlace.name}</span>
              )}
            </div>
          )}

          {/* ── Waiting for partner ── */}
          {iConfirmedPlace && !partnerConfirmedPlace && !isPostDate && (
            <div className="rounded-3xl bg-gradient-to-br from-amber-400/5 to-orange-400/5 border border-amber-400/15 p-6 text-center">
              <div className="text-3xl mb-3 animate-pulse">⏳</div>
              <h3 className="text-base font-black text-amber-400 mb-2">{t("student.matchFlow.waitingPartnerTitle")}</h3>
              <p className="text-sm text-white/40 font-medium max-w-md mx-auto">{t("student.matchFlow.waitingPartnerDesc")}</p>
              <div className="mt-4 rounded-2xl bg-white/[0.03] border border-white/5 px-4 py-3 inline-block">
                <span className="text-xs font-bold text-white/30">{t("student.matchFlow.emailSent")}</span>
              </div>
            </div>
          )}

          {/* ── Step 3: Contact Exchange + Icebreaker (only after BOTH confirmed) ── */}
          {isComplete && (
            <div className="rounded-3xl border border-green-400/20 bg-green-400/5 p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🎉</span>
                <div>
                  <h3 className="text-base font-black text-green-400">{t("student.matchFlow.dateConfirmed")}</h3>
                  <p className="text-sm text-white/40 font-medium">{t("student.matchFlow.step3Desc")}</p>
                </div>
              </div>

              {/* AI Icebreaker intro */}
              {(myIntro || icebreakerLoading) && (
                <div className="rounded-2xl bg-gradient-to-br from-aura/5 to-purple-500/5 border border-aura/10 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={14} className="text-aura" />
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-aura/50">{t("student.matchFlow.icebreakerTitle")}</span>
                  </div>
                  {icebreakerLoading ? (
                    <div className="text-sm text-white/30 font-medium animate-pulse">{t("student.matchFlow.icebreakerLoading")}</div>
                  ) : (
                    <>
                      <p className="text-sm text-white/60 font-medium leading-relaxed mb-3">{myIntro}</p>
                      {icebreaker!.conversationStarters?.length > 0 && (
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">{t("student.matchFlow.talkAbout")}</div>
                          <div className="flex flex-wrap gap-2">
                            {icebreaker!.conversationStarters.map((topic) => (
                              <span key={topic} className="rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-bold text-white/50">{topic}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {icebreaker!.dateVibe && (
                        <div className="mt-3 text-xs text-white/25 font-medium italic">{icebreaker!.dateVibe}</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Partner contact */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3">{t("student.matchFlow.partnerContact")}</div>
                <div className="flex items-center gap-4">
                  {view.partner.datingPreferences?.photoUrls?.[0] && (
                    <div className="h-12 w-12 rounded-2xl overflow-hidden shrink-0">
                      <img src={view.partner.datingPreferences.photoUrls[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <div className="text-base font-black text-white">{view.partner.fullName}</div>
                    <div className="text-sm text-aura font-bold mt-0.5">{view.partner.email}</div>
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

          {/* Waiting: I confirmed slot but not place yet, and no place info */}
          {iConfirmedSlot && !iConfirmedPlace && !view.match.curatedDateTitle && !view.match.proposedPlace && (
            <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-6 text-center">
              <div className="text-3xl mb-3 animate-pulse">⏳</div>
              <p className="text-sm text-white/40 font-bold">{t("student.matchFlow.waitingPartner")}</p>
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
function MatchesTab({ matches, profile, onRefresh, t }: {
  matches: MatchView[]; profile: StudentProfile; onRefresh: () => void; t: (k: string, o?: any) => string;
}) {
  const [selected, setSelected] = useState<MatchView | null>(null);
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

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
          const st = statusLabel(match.status);
          const partnerPhoto = partner.datingPreferences?.photoUrls?.[0];
          const mbtiStr = getMbtiString(partner.datingPreferences?.mbti);
          const age = getAge(partner.datingPreferences?.birthday);
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
                  <div className="text-sm text-white/40 font-medium mt-0.5">{partner.major} · {university?.shortName ?? partner.universityId}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5"><Heart size={16} className="text-aura" /><span className="text-base font-black text-aura italic">{match.score}%</span></div>
                  <div className="flex items-center gap-2 text-xs text-white/30 font-medium">
                    {age && <span>{age}yo</span>}
                    {mbtiStr && <span className="text-aura/50 font-bold">{mbtiStr}</span>}
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
        <MatchDetail view={selected} profile={profile} onClose={() => setSelected(null)} onRefresh={() => { onRefresh(); setSelected(null); }} t={t} />
      )}
    </>
  );
}

/* ─── Main StudentPage ─── */
export function StudentPage({ userId }: { userId: string | null }) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>("matches");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [personaError, setPersonaError] = useState("");

  const isZh = i18n.language.startsWith("zh");
  const ldfrLang = isZh ? "zh-CN" : "en";

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

      // Auto-generate LDFR persona
      const answers = p.onboardingAnswers?.onboarding_ldfr;
      if (answers) {
        const result = p.ldfrResult;
        const needsGen = !result;
        const langMismatch = result && (
          (isZh && /^[A-Za-z]/.test(result.analysis ?? "")) ||
          (!isZh && /^[\u4e00-\u9fff]/.test(result.analysis ?? ""))
        );
        if (needsGen || langMismatch) {
          generatePersona(p, ldfrLang);
        }
      }

      // Auto-generate profile analysis (or regenerate on language mismatch)
      if (p.profileComplete) {
        const pa = p.profileAnalysis;
        const needsProfileGen = !pa;
        const profileLangMismatch = pa?.summary && (
          (isZh && /^[A-Za-z]/.test(pa.summary)) ||
          (!isZh && /^[\u4e00-\u9fff]/.test(pa.summary))
        );
        if (needsProfileGen || profileLangMismatch) {
          await api.regeneratePersona(ldfrLang);
          refresh();
        }
      }
    }).catch(console.error);
  }, [userId, i18n.language]);

  if (!userId) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-20">
        <SectionCard className="text-center">
          <h1 className="text-3xl font-black">{t("student.title")}</h1>
          <p className="mt-4 text-white/50 text-base">{t("student.signInPrompt")}</p>
        </SectionCard>
      </main>
    );
  }

  if (!profile) return <main className="flex min-h-[60vh] items-center justify-center text-white/50 text-base animate-pulse">{t("student.loading")}</main>;

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:py-20">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">{t("student.hi", { name: profile.fullName.split(" ")[0] })}</h1>
      </div>

      <div className="mb-10 flex gap-2 p-1.5 rounded-2xl bg-white/[0.03] border border-white/10 w-fit">
        <button onClick={() => setTab("matches")}
          className={`flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-black transition-all ${tab === "matches" ? "bg-gradient-to-r from-aura to-pink-500 text-white shadow-lg shadow-aura/20" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
          <Heart size={16} />
          {t("student.tabs.matches", "Matches")}
          {matches.length > 0 && <span className={`ml-1 text-[10px] font-black rounded-full px-2 py-0.5 ${tab === "matches" ? "bg-white/20" : "bg-aura/20 text-aura"}`}>{matches.length}</span>}
        </button>
        <button onClick={() => setTab("persona")}
          className={`flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-black transition-all ${tab === "persona" ? "bg-gradient-to-r from-aura to-pink-500 text-white shadow-lg shadow-aura/20" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
          <Flame size={16} />
          {t("student.tabs.persona", "Love Persona")}
        </button>
        <button onClick={() => setTab("profile")}
          className={`flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-black transition-all ${tab === "profile" ? "bg-gradient-to-r from-aura to-pink-500 text-white shadow-lg shadow-aura/20" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
          <User size={16} />
          {t("student.tabs.profile", "Profile")}
        </button>
      </div>

      {tab === "profile" && <ProfileTab profile={profile} t={t} />}
      {tab === "matches" && <MatchesTab matches={matches} profile={profile} onRefresh={refresh} t={t} />}
      {tab === "persona" && <PersonaTab profile={profile} t={t} lang={i18n.language} personaLoading={personaLoading} personaError={personaError} onRegenerate={() => generatePersona(profile, ldfrLang)} />}
    </main>
  );
}
