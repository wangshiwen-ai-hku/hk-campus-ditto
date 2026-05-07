import { Router } from "express";
import { z } from "zod";
import { llmCall } from "../llm/client.js";
import { requireAuth } from "../core/auth-middleware.js";

export const chatRouter = Router();

chatRouter.post("/extract", requireAuth, async (req, res) => {
  const schema = z.object({
    question: z.any(),
    userMessage: z.string(),
    language: z.string().default("en"),
    translatedOptions: z.array(z.object({ key: z.string(), label: z.string() })).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload." });

  const { question, userMessage, language, translatedOptions } = parsed.data;

  const prompt = `
You are Aura-HK, a warm and empathetic AI dating assistant.
The user is answering a questionnaire.
Question: ${question.prompt || question.id}
Options Available (JSON mapping 'key' -> 'label'):
${JSON.stringify(translatedOptions || question.optionsKeys || question.options || [])}
Question Kind: ${question.kind}

User's response: "${userMessage}"

1. Extract the user's intended value for this question. If it's a single choice, pick the closest option and return its EXACT 'key' from the Options Available. If it's multi-choice, pick an array of EXACT 'key's. If it's text, keep the text. Do NOT return the label, only the key.
2. Formulate a short, friendly reply in ${language} to acknowledge their answer and smoothly transition. If they gave a great answer, you can add an emoji!

Output JSON:
{
  "extractedValue": <extracted key or keys>,
  "replyMessage": "<your short friendly reply>"
}
`;

  const result = await llmCall({
    prompt,
    responseJson: true,
    tag: "chat-extract",
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
