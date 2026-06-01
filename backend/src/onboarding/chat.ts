import { Router } from "express";
import { z } from "zod";
import { llmCall } from "../llm/client.js";
import { requireAuth } from "../core/auth-middleware.js";
import { getStudentById, saveStudent } from "../db.js";

export const chatRouter = Router();

function languageInstruction(language: string, userMessage?: string): string {
  const hasChinese = /[\u3400-\u9fff]/.test(userMessage ?? "");
  if (language === "zh-HK" || language === "yue") {
    return "Traditional Chinese, Hong Kong style. If natural, use light Cantonese phrasing. Do not reply in English unless the user clearly asks for English.";
  }
  if (language === "zh-CN" || hasChinese) {
    return "Simplified Chinese. Do not reply in English unless the user clearly asks for English.";
  }
  return "English. If the user writes in Chinese, mirror them in Chinese.";
}

chatRouter.post("/nudge", requireAuth, async (req, res) => {
  const schema = z.object({
    userMessage: z.string(),
    language: z.string().default("en"),
    sectionLabel: z.string().default("profile form"),
    recentMessages: z.array(z.object({
      role: z.enum(["ai", "user"]),
      text: z.string(),
    })).max(6).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });

  const { userMessage, language, sectionLabel, recentMessages } = parsed.data;
  const replyLanguage = languageInstruction(language, userMessage);
  const prompt = `
You are DopaMine, a warm but focused AI assistant for a campus dating profile form.
The user is currently in this app section: ${sectionLabel}.
There is no specific active questionnaire question right now, so do not extract or save answers.

Recent chat, newest last:
${JSON.stringify(recentMessages || [])}

User's message: "${userMessage}"

Reply language: ${replyLanguage}
Rules:
- Keep it to 1-2 short sentences.
- You may greet, acknowledge, or lightly answer simple small talk.
- Do not start an open-ended long conversation.
- Always guide them back to completing the current profile form.
- If they ask what to do, tell them to continue the visible current form. Do not name a specific field unless it appears in the section label.
- Do not invent profile fields such as city, photo, age, or bio unless the user mentioned them first.

Output JSON:
{
  "replyMessage": "<short focused reply>"
}
`;

  const result = await llmCall<{ replyMessage: string }>({
    prompt,
    responseJson: true,
    tag: "chat-nudge",
    maxOutputTokens: 180,
    temperature: 0.25,
  });

  if (result.json?.replyMessage) {
    res.json(result.json);
  } else {
    res.json({
      replyMessage: language.startsWith("zh") || /[\u3400-\u9fff]/.test(userMessage)
        ? "你好，我在这里陪你完成资料页。先把当前表格填完，我会在问卷部分帮你更智能地理解答案。"
        : "Hi, I am here to help you finish this profile. Start with the current form, and I will help more deeply once the questionnaire questions begin."
    });
  }
});

chatRouter.post("/extract", requireAuth, async (req, res) => {
  const schema = z.object({
    question: z.any(),
    userMessage: z.string(),
    language: z.string().default("en"),
    translatedOptions: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
    currentAnswers: z.record(z.string(), z.unknown()).optional(),
    recentMessages: z.array(z.object({
      role: z.enum(["ai", "user"]),
      text: z.string(),
    })).max(6).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });

  const { question, userMessage, language, translatedOptions, currentAnswers, recentMessages } = parsed.data;
  const replyLanguage = languageInstruction(language, userMessage);

  const prompt = `
You are DopaMine, a warm and empathetic AI dating assistant.
Your primary job is to help the user finish the questionnaire. You are not a long-form companion.

Classify the user's message first:
- "answer_current_question": they are answering the current question, even indirectly.
- "form_help": they ask what the question means or how to answer.
- "small_talk": they are casually chatting, venting, joking, flirting, or changing topic.
- "unclear": you cannot confidently map the message to the current question.

Question: ${question.prompt || question.id}
Options Available (JSON mapping 'key' -> 'label'):
${JSON.stringify(translatedOptions || question.optionsKeys || question.options || [])}
Question Kind: ${question.kind}
Selection mode: ${question.kind === "single" ? "single choice; choose exactly one option key" : question.kind === "multi" ? "multiple choice; choose one or more option keys as an array" : question.kind === "range" ? "range; normalize age ranges to an object like {\"min\":18,\"max\":26}; strongly prefer parsing user text written as xx-xx" : "free input"}
Placeholder or expected format: ${question.placeholderKey || question.placeholder || (question.kind === "range" ? "xx-xx, for example 18-26" : "")}
Current section answers so far:
${JSON.stringify(currentAnswers || {})}
Recent chat, newest last:
${JSON.stringify(recentMessages || [])}

User's response: "${userMessage}"

If intent is "answer_current_question":
1. Extract the user's intended value for this question. If it's a single choice, pick the closest option and return its EXACT 'key' from the Options Available. If it's multi-choice, pick an array of EXACT 'key's. If it's text, keep the text. For date/number/range, normalize to the most useful value for the form. For range, return {"min": number, "max": number}; parse patterns like "18-26" or "18到26". Do NOT return labels for option questions, only keys.
2. Set shouldUpdateAnswer true.
3. Reply with exactly one short emotionally supportive acknowledgement using this language rule: ${replyLanguage}.
4. The acknowledgement must lightly reference the user's actual answer or what it suggests about them. Avoid generic replies like "Got it", "Thanks for sharing", "收到", or "已记录" unless they are paired with a specific observation.
5. Do not ask the next question. Do not mention any field that is not the current question. The frontend will show the next real question.

If intent is "form_help":
1. Set extractedValue null and shouldUpdateAnswer false.
2. Explain the question in one short, practical sentence using this language rule: ${replyLanguage}, then ask them to answer it.

If intent is "small_talk" or "unclear":
1. Set extractedValue null and shouldUpdateAnswer false.
2. Give at most one warm sentence using this language rule: ${replyLanguage}, then redirect to the current question shown above. Do not continue open-ended chatting. Do not invent any other form field.

Output JSON:
{
  "intent": "answer_current_question" | "form_help" | "small_talk" | "unclear",
  "shouldUpdateAnswer": <boolean>,
  "extractedValue": <extracted key or keys>,
  "replyMessage": "<your short friendly reply>"
}
`;

  const result = await llmCall({
    prompt,
    responseJson: true,
    tag: "chat-extract",
    maxOutputTokens: 220,
    temperature: 0.2,
  });

  if (result.json) {
    res.json(result.json);
  } else {
    res.status(500).json({ error: "Failed to extract answer" });
  }
});

// Deterministic LDFR scoring
// Rule: A → +1 to L/F(Fantasy)/F(Free) side, B → +1 to D/R/S side, C/D → neutral (no score)
// Each question maps to exactly one dimension. Tie → "grey" persona.
function scoreLdfr(answers: Record<string, unknown>): string {
  // Which dimension each question measures:
  // Energy (L vs D): q1, q4, q5
  // Spark  (F vs R): q7, q8, q9, q10
  // Pace   (F vs S): q14, q15, q16, q18, q19
  const dimensionMap: Record<string, "energy" | "spark" | "pace"> = {
    ldfr_q1: "energy", ldfr_q4: "energy", ldfr_q5: "energy",
    ldfr_q7: "spark", ldfr_q8: "spark", ldfr_q9: "spark", ldfr_q10: "spark",
    ldfr_q14: "pace", ldfr_q15: "pace", ldfr_q16: "pace", ldfr_q18: "pace", ldfr_q19: "pace",
  };

  const scores = { energy: { a: 0, b: 0 }, spark: { a: 0, b: 0 }, pace: { a: 0, b: 0 } };

  for (const [_qId, val] of Object.entries(answers)) {
    const suffix = String(val).slice(-2); // _a, _b, _c, _d
    const qKey = String(val).includes("ldfr_") ? String(val).match(/ldfr_q\d+/)?.[0] : _qId;
    if (!qKey) continue;
    const dim = dimensionMap[qKey];
    if (!dim) continue;
    if (suffix === "_a") scores[dim].a += 1;
    else if (suffix === "_b") scores[dim].b += 1;
    // _c and _d are neutral — no score
  }

  const hasTie = (scores.energy.a === scores.energy.b) ||
    (scores.spark.a === scores.spark.b) ||
    (scores.pace.a === scores.pace.b);

  if (hasTie) return "GREY";

  const d1 = scores.energy.a > scores.energy.b ? "L" : "D";
  const d2 = scores.spark.a > scores.spark.b ? "F" : "R";
  const d3 = scores.pace.a > scores.pace.b ? "F" : "S";
  return `${d1}${d2}${d3}`;
}

const LDFR_ANSWER_MEANINGS: Record<string, string> = {
  "onboarding.opt.ldfr_q1_a": "Friday night: already at a party or bar, meeting new people",
  "onboarding.opt.ldfr_q1_b": "Friday night: staying home, Netflix on, phone quiet",
  "onboarding.opt.ldfr_q1_c": "Friday night: late-night supper with one or two closest friends",
  "onboarding.opt.ldfr_q1_d": "Friday night: exhausted after work or class, only wants sleep",
  "onboarding.opt.ldfr_q4_a": "When emotionally drained: recharges by going out and filling the schedule",
  "onboarding.opt.ldfr_q4_b": "When emotionally drained: recharges alone in a cafe, writing or zoning out",
  "onboarding.opt.ldfr_q4_c": "When emotionally drained: throws themselves into work or projects",
  "onboarding.opt.ldfr_q4_d": "When emotionally drained: eats well and sleeps deeply",
  "onboarding.opt.ldfr_q5_a": "Ideal intimacy: lively group energy where everyone talks",
  "onboarding.opt.ldfr_q5_b": "Ideal intimacy: 2 AM one-on-one conversations about deep inner things",
  "onboarding.opt.ldfr_q5_c": "Ideal intimacy: watching a show together with occasional comments",
  "onboarding.opt.ldfr_q5_d": "Ideal intimacy: relaxed chat while eating",
  "onboarding.opt.ldfr_q7_a": "Desired impression: lights up the whole room",
  "onboarding.opt.ldfr_q7_b": "Desired impression: quiet, but every sentence has depth",
  "onboarding.opt.ldfr_q7_c": "Desired impression: sincere and real",
  "onboarding.opt.ldfr_q7_d": "Desired impression: capable and impressive",
  "onboarding.opt.ldfr_q8_a": "Instant attraction: someone whose inner world feels unique after a short chat",
  "onboarding.opt.ldfr_q8_b": "Instant attraction: someone warm, genuine, and sincere",
  "onboarding.opt.ldfr_q8_c": "Instant attraction: someone exactly their physical type",
  "onboarding.opt.ldfr_q8_d": "Instant attraction: someone with mutual friends or social familiarity",
  "onboarding.opt.ldfr_q9_a": "Flirt signal they notice: existential, dreamlike conversation about restarting life",
  "onboarding.opt.ldfr_q9_b": "Flirt signal they notice: emotional observation about family and gentleness",
  "onboarding.opt.ldfr_q9_c": "Flirt signal they notice: direct compliment about a cute smile",
  "onboarding.opt.ldfr_q9_d": "Flirt signal they notice: simple shared happiness",
  "onboarding.opt.ldfr_q10_a": "Ideal partner: a soul with stories, dreams, and some mystery",
  "onboarding.opt.ldfr_q10_b": "Ideal partner: stable, reliable, and rhythmic in life",
  "onboarding.opt.ldfr_q10_c": "Ideal partner: good-looking and fun",
  "onboarding.opt.ldfr_q10_d": "Ideal partner: someone with a matching vibe",
  "onboarding.opt.ldfr_q14_a": "Definition of the one: understands their dreams and metaphors",
  "onboarding.opt.ldfr_q14_b": "Definition of the one: still says good morning seven years later",
  "onboarding.opt.ldfr_q14_c": "Definition of the one: someone who makes them laugh",
  "onboarding.opt.ldfr_q14_d": "Definition of the one: someone who does not leave",
  "onboarding.opt.ldfr_q15_a": "When asked to define the relationship: feels tense and wants not to label it too early",
  "onboarding.opt.ldfr_q15_b": "When asked to define the relationship: relieved and ready for commitment",
  "onboarding.opt.ldfr_q15_c": "When asked to define the relationship: reads the other person's tone first",
  "onboarding.opt.ldfr_q15_d": "When asked to define the relationship: asks what the other person wants",
  "onboarding.opt.ldfr_q16_a": "View of commitment: pressure, as if freedom is reduced",
  "onboarding.opt.ldfr_q16_b": "View of commitment: safety is the sexiest part of a relationship",
  "onboarding.opt.ldfr_q16_c": "View of commitment: neutral, depends on context",
  "onboarding.opt.ldfr_q16_d": "View of commitment: believes in it but does not say it directly",
  "onboarding.opt.ldfr_q18_a": "Ideal rhythm: like two cats, independent space with cuddles when happy",
  "onboarding.opt.ldfr_q18_b": "Ideal rhythm: building a home together, with routine and future",
  "onboarding.opt.ldfr_q18_c": "Ideal rhythm: clingy, almost seeing each other every day",
  "onboarding.opt.ldfr_q18_d": "Ideal rhythm: long distance is acceptable if they are the one",
  "onboarding.opt.ldfr_q19_a": "Sudden move-in invitation: too sudden, needs personal space",
  "onboarding.opt.ldfr_q19_b": "Sudden move-in invitation: nervous but excited, ready to pack",
  "onboarding.opt.ldfr_q19_c": "Sudden move-in invitation: wants to discuss the reason first",
  "onboarding.opt.ldfr_q19_d": "Sudden move-in invitation: feels a bit strange",
};

function summarizeLdfrAnswers(answers: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [questionId, raw] of Object.entries(answers)) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      const key = typeof value === "string" ? value : "";
      const meaning = LDFR_ANSWER_MEANINGS[key];
      if (meaning) lines.push(`- ${questionId}: ${meaning}`);
    }
  }
  return lines.length ? lines.join("\n") : "- No readable option meanings were found; infer cautiously from the raw answer keys.";
}

const LDFR_META: Record<string, {
  titleZh: string; titleEn: string; titleZhHK?: string;
  vibeZh: string; vibeEn: string; vibeZhHK?: string;
  strengthsZh: string[]; strengthsEn: string[]; strengthsZhHK?: string[];
  trapsZh: string[]; trapsEn: string[]; trapsZhHK?: string[];
  idealDateZh: string; idealDateEn: string; idealDateZhHK?: string;
}> = {
  LFF: {
    titleZh: "心动烟花师", titleEn: "Firework", titleZhHK: "心動煙花師",
    vibeZh: "一秒爱上你，一秒爱上世界", vibeEn: "Falls in love in a heartbeat, with you and the world", vibeZhHK: "一秒愛上你，一秒愛上呢個世界",
    strengthsZh: ["把恋爱过成冒险，每天都有新惊喜", "情绪饱满，让你时刻感到被爱"], strengthsEn: ["Turns love into an adventure with daily surprises", "Emotionally generous, makes you feel deeply loved"], strengthsZhHK: ["將戀愛變成冒險，每日都有新驚喜", "情感豐富，令你無時無刻感受到被愛"],
    trapsZh: ["容易开始很多事却完成不了", "情绪起伏大"], trapsEn: ["Starts many things but finishes few, including relationships", "Emotional highs and lows"], trapsZhHK: ["容易開始但難以堅持到底", "情緒起伏大"],
    idealDateZh: "凌晨的便利店，分享一首私人的歌，然后去看夜景", idealDateEn: "A late-night convenience store run, sharing a personal song, then watching city lights", idealDateZhHK: "凌晨去便利店，分享首私藏歌單，然後去睇夜景"
  },
  LFS: {
    titleZh: "温柔造梦家", titleEn: "Dreamer", titleZhHK: "溫柔造夢家",
    vibeZh: "想把你雕成你最好的样子", vibeEn: "Wants to sculpt you into your best self", vibeZhHK: "想將你雕琢成最美好嘅模樣",
    strengthsZh: ["沟通力 max，从来不让你猜", "把关系经营得有节奏、有仪式感"], strengthsEn: ["Top-tier communicator, never leaves you guessing", "Creates rhythm and ritual in relationships"], strengthsZhHK: ["溝通力 Max，從來唔使你估估吓", "將關係經營得有節奏、有儀式感"],
    trapsZh: ["容易把「我对你好」变成控制", "会过度投入到怀疑自我"], trapsEn: ["Can turn 'caring' into controlling", "Over-invests to the point of self-doubt"], trapsZhHK: ["容易將「對你好」變成控制", "會過度投入到懷疑自己"],
    idealDateZh: "一起上一节陶艺课，然后深夜散步聊心事", idealDateEn: "A pottery class together, then a late-night walk talking about life", idealDateZhHK: "一齊上陶藝堂，然後深夜散步傾心事"
  },
  LRF: {
    titleZh: "聚光灯精灵", titleEn: "Spotlight", titleZhHK: "聚光燈精靈",
    vibeZh: "TA 在的地方，永远是 party", vibeEn: "Where they are, the party is", vibeZhHK: "佢喺邊度，邊度就有 party",
    strengthsZh: ["跟 TA 在一起永远不会闷", "情感表达直接，喜欢你就让全世界知道"], strengthsEn: ["Never a dull moment with them", "Expresses feelings directly and openly"], strengthsZhHK: ["同佢一齊永遠唔會悶", "感情表達直接，鍾意你就會令全世界知"],
    trapsZh: ["对未来缺乏 plan", "容易冲动决定"], trapsEn: ["Lacks future planning", "Prone to impulsive decisions"], trapsZhHK: ["對未來缺乏規劃", "容易衝動做決定"],
    idealDateZh: "一起去密室逃脱，然后即兴决定下一站", idealDateEn: "Escape room followed by spontaneously deciding what's next", idealDateZhHK: "一齊玩密室逃脫，然後即興決定下一站去邊"
  },
  LRS: {
    titleZh: "人间小太阳", titleEn: "Little Sun", titleZhHK: "人間小太陽",
    vibeZh: "把你照顾到，连你妈都满意", vibeEn: "Takes care of you so well, even your mom approves", vibeZhHK: "將你照顧到無微不至",
    strengthsZh: ["顶级 caretaker", "节日仪式感拉满，记得每一个纪念日"], strengthsEn: ["Ultimate caretaker, manages everything", "Remembers every anniversary and fills holidays with ritual"], strengthsZhHK: ["頂級 Caretaker", "節日儀式感拉滿，記得每一個紀念日"],
    trapsZh: ["会用「为你好」包装控制欲", "容易牺牲自己维持和谐"], trapsEn: ["Wraps control in 'for your own good'", "Sacrifices self to maintain harmony"], trapsZhHK: ["會用「為你好」包裝控制欲", "容易犧牲自己嚟維持和諧"],
    idealDateZh: "一起做一顿家常菜，然后看老电影", idealDateEn: "Cooking a homemade meal together, then watching a classic film", idealDateZhHK: "一齊煮餐家常飯，然後睇套舊電影"
  },
  DFF: {
    titleZh: "月光诗人", titleEn: "Moon Poet", titleZhHK: "月光詩人",
    vibeZh: "把你写进诗里，但不会念给你听", vibeEn: "Writes you into poetry but won't read it aloud", vibeZhHK: "將你寫進詩入面，但唔會讀俾你聽",
    strengthsZh: ["一旦爱上，深情得让人心疼", "拥有最浪漫的内心世界"], strengthsEn: ["Once in love, deeply devoted", "Has the most romantic inner world"], strengthsZhHK: ["一旦愛上，深情得令人心疼", "擁有最浪漫嘅心靈世界"],
    trapsZh: ["对爱情期待过高", "不擅直接表达"], trapsEn: ["Sets impossibly high expectations for love", "Struggles with direct expression"], trapsZhHK: ["對愛情期望過高", "唔擅長直接表達"],
    idealDateZh: "雨天的独立书店，分享一首各自喜欢的书", idealDateEn: "An indie bookstore on a rainy day, sharing a favorite book", idealDateZhHK: "落雨天去獨立書店，分享一本各自鍾意嘅書"
  },
  DFS: {
    titleZh: "深海读心师", titleEn: "Deep Sea Reader", titleZhHK: "深海讀心師",
    vibeZh: "你还没开口，TA 已经懂了一半", vibeEn: "Before you speak, they already understand half", vibeZhHK: "你仲未開口，佢已經明左大半",
    strengthsZh: ["世界上最好的倾听者", "对感情极度认真"], strengthsEn: ["The world's best listener", "Takes relationships extremely seriously"], strengthsZhHK: ["世界上最好嘅聆聽者", "對感情極度用心同認真"],
    trapsZh: ["门槛很高，能进 TA 心的人很少", "对完美关系的追求压力很大"], trapsEn: ["Very high barrier to entry", "The pursuit of a perfect relationship creates pressure"], trapsZhHK: ["要求好高，極少人能走進佢嘅心", "追求完美關係帶來好大壓力"],
    idealDateZh: "深夜酒吧角落的长谈，分享从不告诉别人的事", idealDateEn: "A long conversation in a quiet bar corner, sharing secrets", idealDateZhHK: "深夜喺酒吧角落長談，分享從不話俾人知嘅秘密"
  },
  DRF: {
    titleZh: "胶片浪漫家", titleEn: "Film Romantic", titleZhHK: "菲林浪漫家",
    vibeZh: "用一张照片、一首歌，悄悄爱你", vibeEn: "Loves you quietly through a photo, a song", vibeZhHK: "用一張相、一首歌，悄悄地愛你",
    strengthsZh: ["会用自己的方式记录你", "不给你压力，让你觉得自由"], strengthsEn: ["Records you in their own artistic way", "Gives you space and freedom"], strengthsZhHK: ["會用自己嘅方式紀錄你", "唔俾壓力你，俾你充足嘅自由度"],
    trapsZh: ["不擅长讲「我爱你」", "价值观被冒犯时会突然消失"], trapsEn: ["Struggles to say 'I love you'", "Disappears when values are challenged"], trapsZhHK: ["唔擅長講「我愛你」", "價值觀被冒犯時會突然消失/已讀不回"],
    idealDateZh: "一起拍胶片，然后去海边看夜景", idealDateEn: "Shooting film photos together, then watching the sea at night", idealDateZhHK: "一齊影菲林相，然後去海邊睇夜景"
  },
  DRS: {
    titleZh: "暖光守护者", titleEn: "Warm Guardian", titleZhHK: "暖光守護者",
    vibeZh: "不擅言辞，但你冷了 TA 一定知道", vibeEn: "Not great with words, but always knows when you're cold", vibeZhHK: "唔叻講嘢，但你凍嘅時候佢一定知",
    strengthsZh: ["真正细水长流型恋人", "记得你所有的小细节"], strengthsEn: ["A true slow-burn lover", "Remembers every little detail about you"], strengthsZhHK: ["真正細水長流型嘅戀人", "記得你所有嘅細節"],
    trapsZh: ["太会忍，把情绪憋到爆炸", "一旦失望累积，会安静地走"], trapsEn: ["Bottles up emotions until they explode", "Leaves quietly when disappointment accumulates"], trapsZhHK: ["太識得忍耐，將情緒憋到爆炸", "一旦失望累積夠，會靜靜雞走開"],
    idealDateZh: "家里做饭，看老电影，安静的下午茶", idealDateEn: "Cooking at home, an old movie, a quiet afternoon tea", idealDateZhHK: "喺屋企煮飯、睇舊電影，享受安靜嘅下午茶時間"
  },
  GREY: {
    titleZh: "灰阶人格", titleEn: "Grey Persona", titleZhHK: "灰階人格",
    vibeZh: "你不属于任何一类，你是所有类的交汇点", vibeEn: "You don't fit into one box — you're where all types converge", vibeZhHK: "你不屬於任何一類，你係所有類型嘅交匯點",
    strengthsZh: ["极强的适应力，能切换不同恋爱模式", "复杂而立体，很难被看透"], strengthsEn: ["Exceptional adaptability across relationship modes", "Complex and multidimensional, hard to read"], strengthsZhHK: ["極強嘅適應力，能切換唔同嘅戀愛模式", "複雜而立體，好難俾人睇透"],
    trapsZh: ["自己也不确定想要什么", "容易在不同模式间迷失"], trapsEn: ["Even you aren't sure what you want", "Can get lost switching between modes"], trapsZhHK: ["自己都唔肯定想要啲咩", "容易喺唔同模式之間迷失"],
    idealDateZh: "让对方决定，然后全心投入体验", idealDateEn: "Let them decide, then throw yourself fully into the experience", idealDateZhHK: "由對方決定，然後全心投入體驗"
  }
};

chatRouter.post("/ldfr-analyze", requireAuth, async (req, res) => {
  const schema = z.object({
    answers: z.record(z.string(), z.any()),
    language: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });

  // Resolve language: explicit param > user's preferredLocale > fallback "en"
  const user = await getStudentById(req.auth!.sub);
  const language = parsed.data.language ?? user?.preferredLocale ?? "en";
  const langInstruction = language === "zh-HK" || language === "yue"
    ? "Write every user-facing field in Hong Kong Traditional Chinese with natural Hong Kong wording. Use 您 as the second-person pronoun."
    : language.startsWith("zh")
    ? "Write every user-facing field in Simplified Chinese. Use 您 as the second-person pronoun."
    : "Write every user-facing field in English.";

  const answerSummary = summarizeLdfrAnswers(parsed.data.answers);
  const analysisLengthRule = language === "zh-HK" || language === "yue" || language.startsWith("zh")
    ? "For analysis, write about 90-120 Chinese characters. Make it one polished paragraph, not bullet points."
    : "For analysis, write about 75-95 English words. Make it one polished paragraph, not bullet points.";

  const prompt = `
You are an expert personality analyst for DopaMine. The user has completed the LDFR (Love, Desire, Flow, Rhythm) personality test.
Based on their answers, analyze their personality and assign them one of the 8 LDFR types.
${langInstruction}
${analysisLengthRule}
The 3 dimensions are:
1. Energy (L Lumen / D Dusk)
2. Spark (F Fantasy / R Real)
3. Pace (F Free / S Stay)

The 8 types are:
- LFF (Firework / 心动烟花师)
- LFS (Dreamer / 温柔造梦家)
- LRF (Spotlight / 聚光灯精灵)
- LRS (Little Sun / 人间小太阳)
- DFF (Moon Poet / 月光诗人)
- DFS (Deep Sea Reader / 深海读心师)
- DRF (Film Romantic / 胶片浪漫家)
- DRS (Warm Guardian / 暖光守护者)

User's Answers:
${JSON.stringify(parsed.data.answers, null, 2)}

Selected Answer Meanings:
${answerSummary}

Analysis requirements:
- Reference at least 3 concrete signals from Selected Answer Meanings.
- Cover their attraction pattern, relationship rhythm, emotional need, and one gentle growth edge.
- Be warm, precise, and useful; avoid vague praise and avoid clinical labels.
- Do not mention MBTI.

Please output a JSON with the following structure in ${language}:
{
  "code": "LFF", // One of the 8 codes
  "title": "...", // The localized title
  "vibe": "...", // A short 1-sentence vibe description
  "analysis": "...", // About 100 Chinese characters for Chinese, or 75-95 words for English. Deep, personalized romantic analysis based on their specific answers.
  "strengths": ["...", "..."], // 2 key strengths
  "traps": ["...", "..."], // 2 potential traps/blind spots
  "idealDate": "..." // A highly specific ideal date scenario
}
`;

  const result = await llmCall({
    prompt,
    responseJson: true,
    maxOutputTokens: 1200,
    tag: "ldfr-analyze",
  });

  let ldfrData: any = result.json;

  // Fallback: deterministic scoring if LLM fails
  if (!ldfrData) {
    const code = scoreLdfr(parsed.data.answers);
    const meta = LDFR_META[code] ?? LDFR_META.DFF;
    const isZh = language.startsWith("zh");
    const isHk = language === "zh-HK" || language === "yue";
    ldfrData = {
      code,
      title: isHk ? (meta.titleZhHK ?? meta.titleZh) : isZh ? meta.titleZh : meta.titleEn,
      vibe: isHk ? (meta.vibeZhHK ?? meta.vibeZh) : isZh ? meta.vibeZh : meta.vibeEn,
      analysis: isHk
        ? `根據您嘅回答，您屬於「${meta.titleZhHK ?? meta.titleZh}」。您會被有故事、有情緒質感嘅人吸引，關係入面既想保留真實自我，又渴望被認真理解。您嘅心動來得有畫面感，但最好留意節奏，俾安全感同自由同時存在。`
        : isZh
        ? `根据您的回答，您属于「${meta.titleZh}」。您容易被有故事、有情绪质感的人吸引，在关系里既想保留真实自我，也渴望被认真理解。您的心动来得有画面感，但最好留意节奏，让安全感和自由同时存在。`
        : `Based on your answers, you are a "${meta.titleEn}" love persona. You are drawn to people with stories, emotional texture, and a world of their own. In relationships, you want to stay fully yourself while also being deeply understood. Your attraction often arrives with a vivid scene or feeling, so your growth edge is pacing: let safety and freedom exist together.`,
      strengths: isHk ? (meta.strengthsZhHK ?? meta.strengthsZh) : isZh ? meta.strengthsZh : meta.strengthsEn,
      traps: isHk ? (meta.trapsZhHK ?? meta.trapsZh) : isZh ? meta.trapsZh : meta.trapsEn,
      idealDate: isHk ? (meta.idealDateZhHK ?? meta.idealDateZh) : isZh ? meta.idealDateZh : meta.idealDateEn,
    };
  }

  // Persist LDFR result on user profile
  if (user) {
    user.ldfrResult = ldfrData;
    await saveStudent(user);
  }
  res.json(ldfrData);
});
