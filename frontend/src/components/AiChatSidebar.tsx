import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Sparkles, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { QuestionGroup, Question } from "../types";

interface Message {
  id: string;
  role: "ai" | "user";
  text: string;
  options?: string[];
  optionsKeys?: string[];
  questionId?: string;
}

interface AiChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup?: QuestionGroup;
  answers: Record<string, unknown>;
  onAnswer: (questionId: string, value: unknown) => void;
  language: string;
}

export function AiChatSidebar({ isOpen, onClose, currentGroup, answers, onAnswer, language }: AiChatSidebarProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
          text: t("join.dev.chatWelcome", "Hi! I'm Aura-HK. I'm here to help you complete your profile. You can fill out the form, or just chat with me!")
        }
      ]);
    }
  }, [isOpen, messages.length, t]);

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

      const promptText = pendingQ.promptKey ? t(pendingQ.promptKey) : pendingQ.prompt;

      setMessages(prev => [
        ...prev,
        {
          id: `q-${pendingQ.id}-${Date.now()}`,
          role: "ai",
          text: promptText || "Next question...",
          options: pendingQ.options,
          optionsKeys: pendingQ.optionsKeys,
          questionId: pendingQ.id
        }
      ]);
    } else if (!pendingQ && activeQuestionId) {
      // Group complete
      setActiveQuestionId(null);
      setMessages(prev => [
        ...prev,
        {
          id: `done-${currentGroup.template}-${Date.now()}`,
          role: "ai",
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
      setMessages(prev => [
        ...prev,
        { id: `ai-${msgId}`, role: "ai", text: t("join.dev.chatFormFallback", "I'll guide you through the questions when we get to the survey sections. For now, please use the form!") }
      ]);
      return;
    }

    setLoading(true);
    try {
      const translatedOptions = (activeQ.optionsKeys || activeQ.options || []).map(opt => ({
        key: opt,
        label: t(opt) || opt
      }));
      // Ask API to extract the value
      const data = await api.chatExtract(activeQ, userText, language, translatedOptions);
      
      if (data.extractedValue !== null && data.extractedValue !== undefined) {
        // Only update if it's not a generic fallback
        // Handle array toggling for multi-select
        let finalValue = data.extractedValue;
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
        { id: `ai-${msgId}`, role: "ai", text: data.replyMessage || "Got it!" }
      ]);

    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        { id: `err-${msgId}`, role: "ai", text: "Oops, I had trouble processing that. Could you try again or use the form?" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-full md:w-[400px] z-50 transform transition-transform duration-500 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
    >
      <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-3xl border-l border-white/10 flex flex-col shadow-2xl shadow-aura/20">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-aura to-pink-500 shadow-[0_0_15px_rgba(255,0,102,0.5)]">
              <Sparkles className="w-5 h-5 text-white" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 border-2 border-[#020617] rounded-full"></div>
            </div>
            <div>
              <h3 className="font-bold text-white tracking-wide">Aura-HK</h3>
              <p className="text-xs text-aura/80 font-medium tracking-widest uppercase">AI Assistant</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {messages.map((msg, i) => {
            const isAI = msg.role === "ai";
            return (
              <div key={msg.id} className={`flex flex-col ${isAI ? "items-start" : "items-end"}`}>
                <div
                  className={`relative max-w-[85%] px-5 py-3 rounded-2xl text-sm leading-relaxed ${isAI
                      ? "bg-white/10 border border-white/10 text-white rounded-tl-sm backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                      : "bg-gradient-to-br from-aura to-pink-600 text-white rounded-tr-sm shadow-[0_4px_20px_rgba(255,0,102,0.3)]"
                    }`}
                >
                  {msg.text}
                </div>

                {/* Render quick options for AI questions */}
                {isAI && (msg.options || msg.optionsKeys) && msg.questionId === activeQuestionId && !loading && (
                  <div className="flex flex-wrap gap-2 mt-3 max-w-[90%]">
                    {(msg.optionsKeys || msg.options || []).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleSend("", opt)}
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
