import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Sparkles, Heart, Maximize2, Minimize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { QuestionGroup, Question } from "../types";

interface Message {
  id: string;
  role: "ai" | "user";
  text: string;
  kind?: "question" | "feedback" | "system";
  modeLabel?: string;
  progress?: {
    current: number;
    total: number;
  };
  options?: string[];
  optionsKeys?: string[];
  questionId?: string;
}

interface AiChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  currentGroup?: QuestionGroup;
  currentSectionLabel?: string;
  answers: Record<string, unknown>;
  onAnswer: (questionId: string, value: unknown) => void;
  onActiveQuestionChange?: (questionId: string | null) => void;
  language: string;
}

function normalizeExtractedValue(question: Question, extractedValue: unknown, userText: string): unknown {
  if (question.kind === "range") {
    const fromObject = rangeFromObject(extractedValue);
    if (fromObject) return clampRange(fromObject, question);

    const source = typeof extractedValue === "string" ? extractedValue : userText;
    const fromText = rangeFromText(source);
    if (fromText) return clampRange(fromText, question);
  }

  if (question.kind === "number") {
    if (typeof extractedValue === "number" && Number.isFinite(extractedValue)) return extractedValue;
    const source = typeof extractedValue === "string" ? extractedValue : userText;
    const match = source.match(/\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }

  return extractedValue;
}

function localizedRangeAck(language: string, range: { min: number; max: number }): string {
  if (language === "zh-HK") return `明白，你偏好 ${range.min}-${range.max} 呢個年齡範圍。`;
  if (language.startsWith("zh")) return `了解，你偏好 ${range.min}-${range.max} 这个年龄范围。`;
  return `Got it, your preferred age range is ${range.min}-${range.max}.`;
}

function localizedChatError(language: string): string {
  if (language === "zh-HK") return "我暫時未能理解呢個回答，你可以用表格填，或者換個講法再試。";
  if (language.startsWith("zh")) return "我暂时没能理解这个回答，你可以用表格填写，或者换个说法再试。";
  return "I had trouble processing that. Try a clearer format or use the form.";
}

function questionKindLabel(t: (key: string, options?: any) => string, question: Question): string {
  if (question.kind === "single") return t("join.questionKinds.single");
  if (question.kind === "multi") return t("join.questionKinds.multi");
  if (question.kind === "range") return t("join.questionKinds.range");
  return "";
}

function rangeFromObject(value: unknown): { min: number; max: number } | null {
  if (typeof value !== "object" || value === null || !("min" in value) || !("max" in value)) return null;
  const min = Number((value as { min: unknown }).min);
  const max = Number((value as { max: unknown }).max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return min <= max ? { min, max } : { min: max, max: min };
}

function rangeFromText(text: string): { min: number; max: number } | null {
  const nums = Array.from(text.matchAll(/\d+/g)).map((match) => Number(match[0])).filter(Number.isFinite);
  if (nums.length >= 2) {
    const [a, b] = nums;
    return a <= b ? { min: a, max: b } : { min: b, max: a };
  }
  if (nums.length === 1) {
    return { min: nums[0], max: nums[0] };
  }
  return null;
}

function clampRange(range: { min: number; max: number }, question: Question): { min: number; max: number } {
  const lower = question.min ?? Number.NEGATIVE_INFINITY;
  const upper = question.max ?? Number.POSITIVE_INFINITY;
  const min = Math.min(Math.max(range.min, lower), upper);
  const max = Math.min(Math.max(range.max, lower), upper);
  return min <= max ? { min, max } : { min: max, max: min };
}

export function AiChatSidebar({ isOpen, onClose, isExpanded, onToggleExpand, currentGroup, currentSectionLabel, answers, onAnswer, onActiveQuestionChange, language }: AiChatSidebarProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const announcedGroupsRef = useRef<Set<string>>(new Set());

  // Track the current question the AI is asking to avoid asking the same question repeatedly
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "ai",
          kind: "system",
          text: t("join.dev.chatWelcome", "Hi! I'm DopaMine. I'm here to help you complete your profile. You can fill out the form, or just chat with me!")
        }
      ]);
    }
  }, [isOpen, messages.length, t]);

  useEffect(() => {
    if (!isOpen || currentGroup?.template !== "onboarding_basics") return;
    if (announcedGroupsRef.current.has(currentGroup.template)) return;
    announcedGroupsRef.current.add(currentGroup.template);
    setMessages((prev) => [
      ...prev,
      {
        id: `assist-${currentGroup.template}-${Date.now()}`,
        role: "ai",
        kind: "system",
        text: t("join.dev.chatSurveyAssist", "I can help you fill this section. Answer in your own words, and I will place it into the right field."),
      },
    ]);
  }, [currentGroup?.template, isOpen, t]);

  // Find next unanswered question
  useEffect(() => {
    if (!currentGroup || !isOpen) return;

    // Check if we are waiting for an AI response or user input for a specific question
    if (loading) return;

    // Find the first question in the current group that hasn't been answered yet.
    // For simplicity, we consider an empty string, null, or empty array as unanswered.
    const pendingQ = currentGroup.questions.find(q => {
      const val = answers[q.id];
      if (val === undefined || val === null || val === "") return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    });

    if (pendingQ && pendingQ.id !== activeQuestionId) {
      setActiveQuestionId(pendingQ.id);
      onActiveQuestionChange?.(pendingQ.id);

      const basePrompt = pendingQ.promptKey ? t(pendingQ.promptKey) : pendingQ.prompt;
      const modeText = questionKindLabel(t, pendingQ);
      const basePromptText = basePrompt;
      const placeholderText = pendingQ.placeholderKey ? t(pendingQ.placeholderKey) : "";
      const promptText = (pendingQ.kind === "date" || pendingQ.kind === "range") && placeholderText
        ? `${basePromptText}\n${placeholderText}`
        : basePromptText;
      const questionIndex = currentGroup.questions.findIndex((q) => q.id === pendingQ.id);

      setMessages(prev => [
        ...prev,
        {
          id: `q-${pendingQ.id}-${Date.now()}`,
          role: "ai",
          kind: "question",
          modeLabel: modeText,
          progress: {
            current: questionIndex >= 0 ? questionIndex + 1 : 1,
            total: currentGroup.questions.length,
          },
          text: promptText || "Next question...",
          options: pendingQ.options,
          optionsKeys: pendingQ.optionsKeys,
          questionId: pendingQ.id
        }
      ]);
    } else if (!pendingQ && activeQuestionId) {
      // Group complete
      setActiveQuestionId(null);
      onActiveQuestionChange?.(null);
      setMessages(prev => [
        ...prev,
        {
          id: `done-${currentGroup.template}-${Date.now()}`,
          role: "ai",
          kind: "system",
          text: t("join.dev.chatGroupDone", "Awesome! Looks like this section is complete. You can review your answers and click 'Save & Continue' on the left!")
        }
      ]);
    }
  }, [currentGroup, answers, isOpen, loading, activeQuestionId, t]);

  const handleSend = async (text: string, optionValue?: string) => {
    if (!text.trim() && !optionValue) return;

    const userText = optionValue ? (t(optionValue) || optionValue) : text;
    const msgId = Date.now().toString();

      setMessages(prev => [
        ...prev,
      { id: `user-${msgId}`, role: "user", text: userText }
    ]);
    setInput("");

    const activeQ = currentGroup?.questions.find(q => q.id === activeQuestionId);
    if (!activeQ) {
      setLoading(true);
      try {
        const recentMessages = messages.slice(-6).map(({ role, text }) => ({ role, text }));
        const data = await api.chatNudge(userText, language, currentSectionLabel || "profile form", recentMessages);
        setMessages(prev => [
          ...prev,
          { id: `ai-${msgId}`, role: "ai", kind: "feedback", text: data.replyMessage || t("join.dev.chatFormFallback", "I'll keep this focused so we can finish your profile. Start with the current form, then I'll help with the questionnaire.") }
        ]);
      } catch {
        setMessages(prev => [
          ...prev,
          { id: `ai-${msgId}`, role: "ai", kind: "feedback", text: t("join.dev.chatFormFallback", "I'll keep this focused so we can finish your profile. Start with the current form, then I'll help with the questionnaire.") }
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      if (activeQ.kind === "range") {
        const parsedRange = rangeFromText(userText);
        if (parsedRange) {
          const finalRange = clampRange(parsedRange, activeQ);
          onAnswer(activeQ.id, finalRange);
          setMessages(prev => [
            ...prev,
            { id: `ai-${msgId}`, role: "ai", kind: "feedback", text: localizedRangeAck(language, finalRange) }
          ]);
          return;
        }
      }

      const translatedOptions = (activeQ.optionsKeys || activeQ.options || []).map(opt => ({
        key: opt,
        label: t(opt) || opt
      }));
      const recentMessages = messages.slice(-6).map(({ role, text }) => ({ role, text }));
      const data = await api.chatExtract(activeQ, userText, language, translatedOptions, answers, recentMessages);
      
      if (data.shouldUpdateAnswer && data.extractedValue !== null && data.extractedValue !== undefined) {
        // Only update if it's not a generic fallback
        // Handle array toggling for multi-select
        let finalValue = normalizeExtractedValue(activeQ, data.extractedValue, userText);
        if (activeQ.kind === "multi") {
          const currentArr = Array.isArray(answers[activeQ.id]) ? answers[activeQ.id] as string[] : [];
          if (Array.isArray(finalValue)) {
            // Just merge them or replace? The AI should extract the user's intent. 
            // If they said "I like X and Y", we just set it.
            finalValue = Array.from(new Set([...currentArr, ...finalValue]));
          } else {
            finalValue = Array.from(new Set([...currentArr, finalValue]));
          }
        }
        onAnswer(activeQ.id, finalValue);
      }

      setMessages(prev => [
        ...prev,
        { id: `ai-${msgId}`, role: "ai", kind: "feedback", text: data.replyMessage || "Got it!" }
      ]);

    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        { id: `err-${msgId}`, role: "ai", kind: "system", text: localizedChatError(language) }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full ${isExpanded ? "w-full md:w-[75vw]" : "w-full md:w-[25vw]"} z-50 transform transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isOpen ? "translate-x-0" : "translate-x-full"}`}
    >
      <div className={`absolute inset-0 bg-[#020617]/90 backdrop-blur-3xl flex flex-col shadow-2xl transition-all duration-700 ${isOpen ? "border-l border-white/10 rounded-l-[2rem]" : "border-l border-white/5"}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-black border border-white/20 shadow-lg">
              <span className="text-xl font-black text-white leading-none">D</span>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500/80 border-2 border-[#020617] rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
            </div>
            <div>
              <h3 className="font-bold text-white tracking-wide">DopaMine</h3>
              <p className="text-xs text-white/40 font-medium tracking-widest uppercase">Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onToggleExpand && (
              <button onClick={onToggleExpand} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white/70 hover:text-white border border-white/10 active:scale-90">
                {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {messages.map((msg, i) => {
            const isAI = msg.role === "ai";
            const isQuestion = msg.kind === "question";
            const isFeedback = msg.kind === "feedback";
            return (
              <div key={msg.id} className={`flex flex-col ${isAI ? "items-start" : "items-end"}`}>
                <div
                  className={`relative max-w-[85%] rounded-2xl px-5 py-3 leading-relaxed ${
                    isAI
                      ? isQuestion
                        ? "rounded-tl-sm border border-aura/30 bg-aura/[0.08] text-white shadow-[0_0_24px_rgba(255,0,102,0.08)]"
                        : isFeedback
                        ? "rounded-tl-sm border border-white/5 bg-white/[0.045] text-white/75"
                        : "rounded-tl-sm border border-white/5 bg-white/5 text-white/85 backdrop-blur-sm"
                      : "bg-white/15 border border-white/10 text-white rounded-tr-sm"
                  }`}
                >
                  {isQuestion && msg.progress ? (
                    <div className="mb-2 flex items-center justify-between gap-4 border-b border-white/10 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-aura/80">
                        {t("join.dev.chatQuestionLabel", "Question")}
                      </span>
                      <span className="rounded-full border border-aura/30 bg-aura/10 px-2.5 py-0.5 text-[10px] font-black text-aura">
                        {msg.progress.current}/{msg.progress.total}
                      </span>
                    </div>
                  ) : null}
                  {isQuestion && msg.modeLabel ? (
                    <div className="mb-2">
                      <span className="inline-flex rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[11px] font-black italic tracking-wide text-white/55">
                        {msg.modeLabel}
                      </span>
                    </div>
                  ) : null}
                  <div className={`${isQuestion ? "text-base font-black tracking-tight text-white whitespace-pre-line" : isFeedback ? "text-sm font-medium text-white/70 whitespace-pre-line" : "text-sm text-white/85 whitespace-pre-line"}`}>
                    {msg.text}
                  </div>
                </div>

                {/* Render quick options for AI questions */}
                {isAI && (msg.options || msg.optionsKeys) && msg.questionId === activeQuestionId && !loading && (
                  <div className="flex flex-wrap gap-2 mt-3 max-w-[90%]">
                    {(msg.optionsKeys || msg.options || []).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          const activeQ = currentGroup?.questions.find(q => q.id === activeQuestionId);
                          if (activeQ?.kind === 'multi') {
                            const optText = msg.optionsKeys ? t(opt) : opt;
                            setInput(prev => prev ? `${prev}, ${optText}` : optText);
                          } else {
                            handleSend("", opt);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-aura/20 border border-white/10 hover:border-aura/50 rounded-full text-white/80 transition-all active:scale-95"
                      >
                        {msg.optionsKeys ? t(opt) : opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start">
              <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl rounded-tl-sm text-white/50 flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-aura/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-1.5 h-1.5 bg-aura/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-1.5 h-1.5 bg-aura/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02]">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="relative flex items-end"
          >
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !loading) handleSend(input);
                }
              }}
              placeholder={t("join.dev.chatPlaceholder", "Type your answer...")}
              disabled={loading}
              rows={1}
              style={{ height: '46px', minHeight: '46px' }}
              className="w-full bg-white/5 border border-white/10 rounded-3xl py-3 pl-5 pr-14 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-aura/50 transition-all disabled:opacity-50 resize-none overflow-y-auto leading-relaxed"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="absolute right-3 bottom-2 p-1 rounded-full transition-all disabled:opacity-50 hover:scale-110 active:scale-95"
            >
              <img 
                src="/assets/heart_send.svg" 
                alt="Send" 
                className={`w-7 h-7 transition-all duration-300 ${input.trim() ? "opacity-100 drop-shadow-[0_0_8px_rgba(255,0,102,0.8)]" : "opacity-30 grayscale"}`} 
              />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
