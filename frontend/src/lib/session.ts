import type { Locale } from "../types";

const USER_KEY = "campus-ditto-hk-user";
const TOKEN_KEY = "campus-ditto-hk-token";
const LOCALE_KEY = "campus-ditto-hk-locale";

export function getStoredUserId() { return localStorage.getItem(USER_KEY); }
export function setStoredUserId(id: string | null) { if (!id) localStorage.removeItem(USER_KEY); else localStorage.setItem(USER_KEY, id); }

export function getStoredToken() { return localStorage.getItem(TOKEN_KEY); }
export function setStoredToken(token: string | null) { if (!token) localStorage.removeItem(TOKEN_KEY); else localStorage.setItem(TOKEN_KEY, token); }

export function getStoredLocale(): Locale { 
  const val = localStorage.getItem(LOCALE_KEY);
  if (val === "yue") return "zh-HK"; // Migration
  return (val as Locale) ?? "en"; 
}
export function setStoredLocale(locale: Locale) { localStorage.setItem(LOCALE_KEY, locale); }
