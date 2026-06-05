import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Locale } from "../types";
import { Settings, UserCircle } from "lucide-react";

export function Layout({ locale, onLocale, userId, onUser, children }: { locale: Locale; onLocale: (v: Locale) => void; userId: string | null; onUser: (v: string | null) => void; children: React.ReactNode; }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6">
          <Link to="/" className="flex items-center gap-3 text-2xl font-black italic tracking-tighter">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]">D</span>
            <span className="hidden sm:inline">{t("brand")}</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            
            {!userId && (
              <Link to="/join" className="rounded-full bg-white px-6 py-2 text-sm font-black text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                {t("nav.join")}
              </Link>
            )}

            {/* Settings button */}
            <div className="relative group">
              <Link 
                to="/settings" 
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/75 transition-all duration-300 hover:scale-105 hover:bg-white/10 hover:text-white hover:rotate-45 active:scale-95"
                aria-label="Settings"
              >
                <Settings size={20} />
              </Link>
              {/* Tooltip */}
              <div className="absolute top-[120%] left-1/2 -translate-x-1/2 scale-90 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 z-[110] bg-black/90 border border-white/10 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
                {t("nav.settings")}
              </div>
            </div>

            {/* Profile button */}
            {userId && (
              <div className="relative group">
                <Link
                  to="/student?tab=profile"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/75 transition-all duration-300 hover:scale-105 hover:bg-white/10 hover:text-white active:scale-95"
                  aria-label="Profile"
                >
                  <UserCircle size={20} />
                </Link>
                {/* Tooltip */}
                <div className="absolute top-[120%] left-1/2 -translate-x-1/2 scale-90 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 z-[110] bg-black/90 border border-white/10 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
                  {t("nav.profile")}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
