import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Locale } from "../types";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Settings } from "lucide-react";

export function Layout({ locale, onLocale, userId, onUser, children }: { locale: Locale; onLocale: (v: Locale) => void; userId: string | null; onUser: (v: string | null) => void; children: React.ReactNode; }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6">
          <Link to="/" className="flex items-center gap-3 text-2xl font-black italic tracking-tighter">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]">A</span>
            <span className="hidden sm:inline">{t("brand")}</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            {!userId && <LanguageSwitcher locale={locale} onLocale={onLocale} />}
            
            {!userId && (
              <Link to="/join" className="rounded-full bg-white px-6 py-2 text-sm font-black text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                {t("nav.join")}
              </Link>
            )}
            
            {userId && (
              <button 
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-white/10" 
                onClick={() => onUser(null)}
              >
                {t("nav.signOut")}
              </button>
            )}
          </div>
        </div>
      </header>
      {children}

      {/* Floating Settings Gear Icon in Bottom Left */}
      <Link 
        to="/settings" 
        className="fixed bottom-6 left-6 z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/70 backdrop-blur-md shadow-2xl transition-all hover:scale-110 hover:text-white hover:border-white/20 hover:rotate-45 active:scale-95 duration-300"
        title="Settings"
      >
        <Settings size={20} />
      </Link>
    </div>
  );
}
