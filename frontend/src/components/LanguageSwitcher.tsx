import { useState, useRef, useEffect } from "react";
import { Languages, ChevronDown } from "lucide-react";
import type { Locale } from "../types";

interface LanguageSwitcherProps {
  locale: Locale;
  onLocale: (v: Locale) => void;
}

const LANGUAGES: { id: Locale; label: string; flag: string }[] = [
  { id: "en", label: "English", flag: "🇺🇸" },
  { id: "zh-HK", label: "繁體中文", flag: "🇭🇰" },
  { id: "zh-CN", label: "简体中文", flag: "🇨🇳" },
];

export function LanguageSwitcher({ locale, onLocale }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find(l => l.id === locale) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-2 text-sm font-bold text-white transition-all hover:bg-white/10 hover:border-white/20 active:scale-95"
      >
        <Languages size={16} className="text-aura" />
        <span className="hidden sm:inline">{currentLang.label}</span>
        <span className="sm:hidden">{currentLang.flag}</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-background/90 backdrop-blur-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
          <div className="p-2 space-y-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => {
                  onLocale(lang.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  locale === lang.id
                    ? "bg-aura/20 text-aura"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-lg leading-none">{lang.flag}</span>
                <span>{lang.label}</span>
                {locale === lang.id && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-aura shadow-[0_0_8px_rgba(255,0,102,0.6)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
