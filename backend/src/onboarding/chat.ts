import { Router } from "express";
import { z } from "zod";
import { llmCall } from "../llm/client.js";
import { requireAuth } from "../core/auth-middleware.js";

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
Current section answers so far:
${JSON.stringify(currentAnswers || {})}
Recent chat, newest last:
${JSON.stringify(recentMessages || [])}

User's response: "${userMessage}"

If intent is "answer_current_question":
1. Extract the user's intended value for this question. If it's a single choice, pick the closest option and return its EXACT 'key' from the Options Available. If it's multi-choice, pick an array of EXACT 'key's. If it's text, keep the text. For date/number/range, normalize to the most useful value for the form. Do NOT return labels for option questions, only keys.
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

chatRouter.post("/ldfr-analyze", requireAuth, async (req, res) => {
  const schema = z.object({
    answers: z.record(z.string(), z.any()),
    language: z.string().default("en")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });

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

Please output a JSON with the following structure in ${parsed.data.language}:
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

  if (result.json) {
    res.json(result.json);
  } else {
    res.status(500).json({ error: "Failed to analyze LDFR" });
  }
});
