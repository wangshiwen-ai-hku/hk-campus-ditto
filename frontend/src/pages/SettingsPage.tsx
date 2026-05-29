import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { Locale, StudentProfile } from "../types";
import { SectionCard } from "../components/SectionCard";
import { ArrowLeft, Languages, LogOut, LogIn, Share2, Copy, Check, User, Settings, Shield } from "lucide-react";

export function SettingsPage({
  userId,
  onUser,
  locale,
  onLocale,
}: {
  userId: string | null;
  onUser: (v: string | null) => void;
  locale: Locale;
  onLocale: (v: Locale) => void;
}) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const txt = {
    en: {
      title: "Settings",
      language: "Language Settings",
      languageDesc: "Choose your preferred language for the app and emails",
      account: "Account Management",
      loggedInAs: "Logged in as:",
      emailLabel: "Email:",
      logoutBtn: "Log Out",
      loginBtn: "Sign In / Register",
      notLoggedIn: "You are not logged in right now.",
      share: "Share DopaMine",
      shareDesc: "Share DopaMine with your friends to find campus matches together!",
      copyLink: "Copy Share Link",
      copied: "Copied!",
      back: "Back",
      loading: "Loading...",
    },
    "zh-HK": {
      title: "設定",
      language: "語言設定",
      languageDesc: "選擇你偏好的應用程式與郵件語言",
      account: "帳號管理",
      loggedInAs: "已登入為：",
      emailLabel: "電子郵件：",
      logoutBtn: "登出帳號",
      loginBtn: "登入 / 註冊",
      notLoggedIn: "你目前尚未登入。",
      share: "推薦與分享",
      shareDesc: "將 DopaMine 分享給朋友，一起開啟校園約會！",
      copyLink: "複製分享連結",
      copied: "已複製到剪貼簿！",
      back: "返回",
      loading: "載入中...",
    },
    "zh-CN": {
      title: "设置",
      language: "语言设定",
      languageDesc: "选择你偏好的应用程序与邮件语言",
      account: "账号管理",
      loggedInAs: "已登录为：",
      emailLabel: "电子邮件：",
      logoutBtn: "登出账号",
      loginBtn: "登入 / 注册",
      notLoggedIn: "你目前尚未登录。",
      share: "推荐与分享",
      shareDesc: "将 DopaMine 分享给朋友，一起开启校园约会！",
      copyLink: "复制分享链接",
      copied: "已复制到剪贴板！",
      back: "返回",
      loading: "载入中...",
    },
  }[locale];

  const languageLabels: Record<Locale, string> = {
    en: "English",
    "zh-HK": "繁體中文",
    "zh-CN": "简体中文",
  };

  useEffect(() => {
    if (userId) {
      setLoading(true);
      api.getProfile(userId)
        .then((res: any) => setProfile(res as StudentProfile))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [userId]);

  const handleLanguageChange = async (newLocale: Locale) => {
    setSavingField("preferredLocale");
    try {
      if (userId) {
        await api.updatePreferredLocale(newLocale);
      }
      onLocale(newLocale);
      i18n.changeLanguage(newLocale);
      if (profile) {
        setProfile({ ...profile, preferredLocale: newLocale });
      }
    } catch (e: any) {
      alert(e.message || "Failed to update language.");
    } finally {
      setSavingField(null);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    onUser(null);
    navigate("/");
  };

  return (
    <div className="min-h-[calc(100vh-88px)] bg-slate-950 text-slate-100 pb-16">
      <div className="mx-auto max-w-2xl px-5 pt-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="group mb-6 flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          <span>{txt.back}</span>
        </button>

        {/* Title */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-aura">
            <Settings size={22} className="animate-spin-slow" />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-white to-purple-400 bg-clip-text text-transparent">
            {txt.title}
          </h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/40 font-bold">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-aura border-t-transparent mr-3" />
            {txt.loading}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Language Card */}
            <SectionCard className="border-white/10 shadow-2xl backdrop-blur-md">
              <div className="mb-4 flex items-center gap-3">
                <Languages size={18} className="text-aura" />
                <div>
                  <h3 className="font-black text-white">{txt.language}</h3>
                  <p className="text-xs text-white/40 mt-0.5">{txt.languageDesc}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {(["en", "zh-HK", "zh-CN"] as Locale[]).map((lang) => {
                  const active = locale === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      disabled={savingField === "preferredLocale" || active}
                      onClick={() => handleLanguageChange(lang)}
                      className={`relative flex flex-col items-center justify-center rounded-xl border py-3 text-center text-xs font-black transition-all ${
                        active
                          ? "border-aura/40 bg-aura/10 text-aura shadow-[0_0_15px_rgba(236,72,153,0.15)]"
                          : "border-white/5 bg-white/[0.02] text-white/45 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{languageLabels[lang]}</span>
                      {active && (
                        <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-aura shadow-[0_0_8px_rgba(255,0,102,0.6)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* Share DopaMine */}
            <SectionCard className="border-white/10 shadow-2xl backdrop-blur-md">
              <div className="mb-4 flex items-center gap-3">
                <Share2 size={18} className="text-aura" />
                <div>
                  <h3 className="font-black text-white">{txt.share}</h3>
                  <p className="text-xs text-white/40 mt-0.5">{txt.shareDesc}</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aura to-purple-600 px-4 py-3 text-sm font-black text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? txt.copied : txt.copyLink}</span>
              </button>
            </SectionCard>

            {/* Account Card */}
            <SectionCard className="border-white/10 shadow-2xl backdrop-blur-md">
              <div className="mb-4 flex items-center gap-3">
                <Shield size={18} className="text-aura" />
                <div>
                  <h3 className="font-black text-white">{txt.account}</h3>
                </div>
              </div>

              {userId && profile ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 text-sm font-medium">
                    <div className="flex items-center gap-2 mb-2 text-white/70">
                      <User size={14} className="text-white/30" />
                      <span>{txt.loggedInAs} <strong>{profile.fullName}</strong></span>
                    </div>
                    <div className="text-white/40 text-xs">
                      {txt.emailLabel} {profile.email}
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
                  >
                    <LogOut size={16} />
                    <span>{txt.logoutBtn}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-white/45">
                    {txt.notLoggedIn}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/join")}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10 active:scale-95 transition-all"
                  >
                    <LogIn size={16} />
                    <span>{txt.loginBtn}</span>
                  </button>
                </div>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
