import { env } from "../core/env.js";

export interface LlmCallOptions {
  system?: string;
  prompt: string;
  responseJson?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  tag?: string; // for logging / cost attribution
}

export interface LlmResult<T = unknown> {
  text: string;
  json?: T;
  usedFallback: boolean;
  provider: string;
  model: string;
}

class CallBudget {
  private used = 0;
  bump() {
    this.used += 1;
  }
  exceeded() {
    return this.used >= env.llm.budgetPerRun;
  }
  reset() {
    this.used = 0;
  }
  count() {
    return this.used;
  }
}

export const callBudget = new CallBudget();

function tryParseJson<T>(text: string): T | undefined {
  // Models often wrap JSON in ```json ... ``` fences.
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // try to find first {...} or [...] block
    const match = cleaned.match(/[\{\[][\s\S]*[\}\]]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

async function callGemini(opts: LlmCallOptions): Promise<string> {
  const url = `${env.llm.baseUrl}/models/${env.llm.model}:generateContent?key=${env.llm.apiKey}`;
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxOutputTokens ?? 800,
      ...(opts.responseJson ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (opts.system) {
    body.systemInstruction = { role: "system", parts: [{ text: opts.system }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text;
}

export async function llmCall<T = unknown>(
  opts: LlmCallOptions
): Promise<LlmResult<T>> {
  if (env.llm.provider === "mock" || callBudget.exceeded()) {
    return { text: "", usedFallback: true, provider: "mock", model: env.llm.model };
  }
  callBudget.bump();
  try {
    const text = await callGemini(opts);
    const json = opts.responseJson ? tryParseJson<T>(text) : undefined;
    return {
      text,
      json,
      usedFallback: false,
      provider: env.llm.provider,
      model: env.llm.model,
    };
  } catch (err) {
    console.warn(`[llm] ${opts.tag ?? "call"} failed:`, (err as Error).message);
    return { text: "", usedFallback: true, provider: env.llm.provider, model: env.llm.model };
  }
}
