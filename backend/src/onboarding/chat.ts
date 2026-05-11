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
You are Aura-HK, a warm but focused AI assistant for a campus dating profile form.
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
You are Aura-HK, a warm and empathetic AI dating assistant.
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

const LDFR_META: Record<string, { titleZh: string; titleEn: string; vibeZh: string; vibeEn: string; strengthsZh: string[]; strengthsEn: string[]; trapsZh: string[]; trapsEn: string[]; idealDateZh: string; idealDateEn: string }> = {
  LFF: { titleZh: "心动烟花师", titleEn: "Firework", vibeZh: "一秒爱上你，一秒爱上世界", vibeEn: "Falls in love in a heartbeat, with you and the world", strengthsZh: ["把恋爱过成冒险，每天都有新惊喜", "情绪饱满，让你时刻感到被爱"], strengthsEn: ["Turns love into an adventure with daily surprises", "Emotionally generous, makes you feel deeply loved"], trapsZh: ["容易开始很多事却完成不了", "情绪起伏大"], trapsEn: ["Starts many things but finishes few, including relationships", "Emotional highs and lows"], idealDateZh: "凌晨的便利店，分享一首私人的歌，然后去看夜景", idealDateEn: "A late-night convenience store run, sharing a personal song, then watching city lights" },
  LFS: { titleZh: "温柔造梦家", titleEn: "Dreamer", vibeZh: "想把你雕成你最好的样子", vibeEn: "Wants to sculpt you into your best self", strengthsZh: ["沟通力 max，从来不让你猜", "把关系经营得有节奏、有仪式感"], strengthsEn: ["Top-tier communicator, never leaves you guessing", "Creates rhythm and ritual in relationships"], trapsZh: ["容易把「我对你好」变成控制", "会过度投入到怀疑自我"], trapsEn: ["Can turn 'caring' into controlling", "Over-invests to the point of self-doubt"], idealDateZh: "一起上一节陶艺课，然后深夜散步聊心事", idealDateEn: "A pottery class together, then a late-night walk talking about life" },
  LRF: { titleZh: "聚光灯精灵", titleEn: "Spotlight", vibeZh: "TA 在的地方，永远是 party", vibeEn: "Where they are, the party is", strengthsZh: ["跟 TA 在一起永远不会闷", "情感表达直接，喜欢你就让全世界知道"], strengthsEn: ["Never a dull moment with them", "Expresses feelings directly and openly"], trapsZh: ["对未来缺乏 plan", "容易冲动决定"], trapsEn: ["Lacks future planning", "Prone to impulsive decisions"], idealDateZh: "一起去密室逃脱，然后即兴决定下一站", idealDateEn: "Escape room followed by spontaneously deciding what's next" },
  LRS: { titleZh: "人间小太阳", titleEn: "Little Sun", vibeZh: "把你照顾到，连你妈都满意", vibeEn: "Takes care of you so well, even your mom approves", strengthsZh: ["顶级 caretaker", "节日仪式感拉满，记得每一个纪念日"], strengthsEn: ["Ultimate caretaker, manages everything", "Remembers every anniversary and fills holidays with ritual"], trapsZh: ["会用「为你好」包装控制欲", "容易牺牲自己维持和谐"], trapsEn: ["Wraps control in 'for your own good'", "Sacrifices self to maintain harmony"], idealDateZh: "一起做一顿家常菜，然后看老电影", idealDateEn: "Cooking a homemade meal together, then watching a classic film" },
  DFF: { titleZh: "月光诗人", titleEn: "Moon Poet", vibeZh: "把你写进诗里，但不会念给你听", vibeEn: "Writes you into poetry but won't read it aloud", strengthsZh: ["一旦爱上，深情得让人心疼", "拥有最浪漫的内心世界"], strengthsEn: ["Once in love, deeply devoted", "Has the most romantic inner world"], trapsZh: ["对爱情期待过高", "不擅直接表达"], trapsEn: ["Sets impossibly high expectations for love", "Struggles with direct expression"], idealDateZh: "雨天的独立书店，分享一本各自喜欢的书", idealDateEn: "An indie bookstore on a rainy day, sharing a favorite book" },
  DFS: { titleZh: "深海读心师", titleEn: "Deep Sea Reader", vibeZh: "你还没开口，TA 已经懂了一半", vibeEn: "Before you speak, they already understand half", strengthsZh: ["世界上最好的倾听者", "对感情极度认真"], strengthsEn: ["The world's best listener", "Takes relationships extremely seriously"], trapsZh: ["门槛很高，能进 TA 心的人很少", "对完美关系的追求压力很大"], trapsEn: ["Very high barrier to entry", "The pursuit of a perfect relationship creates pressure"], idealDateZh: "深夜酒吧角落的长谈，分享从不告诉别人的事", idealDateEn: "A long conversation in a quiet bar corner, sharing secrets" },
  DRF: { titleZh: "胶片浪漫家", titleEn: "Film Romantic", vibeZh: "用一张照片、一首歌，悄悄爱你", vibeEn: "Loves you quietly through a photo, a song", strengthsZh: ["会用自己的方式记录你", "不给你压力，让你觉得自由"], strengthsEn: ["Records you in their own artistic way", "Gives you space and freedom"], trapsZh: ["不擅长讲「我爱你」", "价值观被冒犯时会突然消失"], trapsEn: ["Struggles to say 'I love you'", "Disappears when values are challenged"], idealDateZh: "一起拍胶片，然后去海边看夜景", idealDateEn: "Shooting film photos together, then watching the sea at night" },
  DRS: { titleZh: "暖光守护者", titleEn: "Warm Guardian", vibeZh: "不擅言辞，但你冷了 TA 一定知道", vibeEn: "Not great with words, but always knows when you're cold", strengthsZh: ["真正细水长流型恋人", "记得你所有的小细节"], strengthsEn: ["A true slow-burn lover", "Remembers every little detail about you"], trapsZh: ["太会忍，把情绪憋到爆炸", "一旦失望累积，会安静地走"], trapsEn: ["Bottles up emotions until they explode", "Leaves quietly when disappointment accumulates"], idealDateZh: "家里做饭，看老电影，安静的下午茶", idealDateEn: "Cooking at home, an old movie, a quiet afternoon tea" },
  GREY: { titleZh: "灰阶人格", titleEn: "Grey Persona", vibeZh: "你不属于任何一类，你是所有类的交汇点", vibeEn: "You don't fit into one box — you're where all types converge", strengthsZh: ["极强的适应力，能切换不同恋爱模式", "复杂而立体，很难被看透"], strengthsEn: ["Exceptional adaptability across relationship modes", "Complex and multidimensional, hard to read"], trapsZh: ["自己也不确定想要什么", "容易在不同模式间迷失"], trapsEn: ["Even you aren't sure what you want", "Can get lost switching between modes"], idealDateZh: "让对方决定，然后全心投入体验", idealDateEn: "Let them decide, then throw yourself fully into the experience" },
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

  const prompt = `
You are an expert personality analyst for Aura-HK. The user has completed the LDFR (Love, Desire, Flow, Rhythm) personality test.
Based on their answers, analyze their personality and assign them one of the 8 LDFR types.
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

Please output a JSON with the following structure in ${language}:
{
  "code": "LFF", // One of the 8 codes
  "title": "...", // The localized title
  "vibe": "...", // A short 1-sentence vibe description
  "analysis": "...", // 2-3 sentences of deep, personalized romantic analysis based on their specific answers. Make it feel very personal and insightful.
  "strengths": ["...", "..."], // 2 key strengths
  "traps": ["...", "..."], // 2 potential traps/blind spots
  "idealDate": "..." // A highly specific ideal date scenario
}
`;

  const result = await llmCall({
    prompt,
    responseJson: true,
    tag: "ldfr-analyze",
  });

  let ldfrData: any = result.json;

  // Fallback: deterministic scoring if LLM fails
  if (!ldfrData) {
    const code = scoreLdfr(parsed.data.answers);
    const meta = LDFR_META[code] ?? LDFR_META.DFF;
    const isZh = language.startsWith("zh");
    ldfrData = {
      code,
      title: isZh ? meta.titleZh : meta.titleEn,
      vibe: isZh ? meta.vibeZh : meta.vibeEn,
      analysis: isZh
        ? `根据你的回答，你属于「${meta.titleZh}」型恋爱人格。你在感情中追求深度与真实的连接，你的情感表达方式独特而有温度。`
        : `Based on your answers, you are a "${meta.titleEn}" love persona. You seek depth and authentic connection in relationships, with a unique and warm way of expressing emotions.`,
      strengths: isZh ? meta.strengthsZh : meta.strengthsEn,
      traps: isZh ? meta.trapsZh : meta.trapsEn,
      idealDate: isZh ? meta.idealDateZh : meta.idealDateEn,
    };
  }

  // Persist LDFR result on user profile
  if (user) {
    user.ldfrResult = ldfrData;
    await saveStudent(user);
  }
  res.json(ldfrData);
});
