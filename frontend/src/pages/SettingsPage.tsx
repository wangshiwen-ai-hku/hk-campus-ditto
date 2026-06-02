import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { Locale, StudentProfile } from "../types";
import { SectionCard } from "../components/SectionCard";
import { ArrowLeft, Languages, LogOut, LogIn, Share2, ToggleLeft, ToggleRight, Copy, Check, User, Heart, Settings, Shield } from "lucide-react";

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

  const isZhHK = locale === "zh-HK";
  const isZhCN = locale === "zh-CN";
  const isZh = isZhHK || isZhCN;

  // Localized text dictionary for zero-conflict translations
  const txt = {
    title: isZhHK ? "設定" : isZhCN ? "设置" : "Settings",
    language: isZhHK ? "語言設定" : isZhCN ? "语言设定" : "Language Settings",
    languageDesc: isZhHK ? "選擇你偏好的應用程式與郵件語言" : isZhCN ? "选择你偏好的应用程序与邮件语言" : "Choose your preferred language for the app and emails",
    account: isZhHK ? "帳號管理" : isZhCN ? "账号管理" : "Account Management",
    loggedInAs: isZhHK ? "已登入為：" : isZhCN ? "已登录为：" : "Logged in as:",
    emailLabel: isZhHK ? "電子郵件：" : isZhCN ? "电子邮件：" : "Email:",
    logoutBtn: isZhHK ? "登出帳號" : isZhCN ? "登出账号" : "Log Out",
    loginBtn: isZhHK ? "登入 / 註冊" : isZhCN ? "登入 / 注册" : "Sign In / Register",
    notLoggedIn: isZhHK ? "你目前尚未登入。" : isZhCN ? "你目前尚未登录。" : "You are not logged in right now.",
    preferences: isZhHK ? "匹配與約會偏好" : isZhCN ? "匹配与约会偏好" : "Match & Dating Preferences",
    crossCampus: isZhHK ? "接受跨校配對" : isZhCN ? "接受跨校匹配" : "Cross-Campus Matching",
    crossCampusDesc: isZhHK ? "開啟後，匹配池中會包含其他學校的候選人" : isZhCN ? "开启后，匹配池中会包含其他学校的候选人" : "Include cross-campus candidates in your matching pool",
    matchMode: isZhHK ? "匹配節奏" : isZhCN ? "匹配节奏" : "Matching Pace",
    matchModeDesc: isZhHK ? "控制匹配的精準度與速度" : isZhCN ? "控制匹配的精准度与速度" : "Control the speed and selectivity of the matching algorithm",
    datingGoal: isZhHK ? "約會目標" : isZhCN ? "约会目标" : "Dating Goal",
    datingGoalDesc: isZhHK ? "與你目標相近的人進行配對" : isZhCN ? "与你目标相近的人进行配对" : "Match with people looking for a similar connection",
    share: isZhHK ? "推薦與分享" : isZhCN ? "推荐与分享" : "Share DopaMine",
    shareDesc: isZhHK ? "將 DopaMine 分享給朋友，一起開啟校園約會！" : isZhCN ? "将 DopaMine 分享给朋友，一起开启校园约会！" : "Share DopaMine with your friends to find campus matches together!",
    copyLink: isZhHK ? "複製分享連結" : isZhCN ? "复制分享链接" : "Copy Share Link",
    copied: isZhHK ? "已複製到剪貼簿！" : isZhCN ? "已复制到剪贴板！" : "Copied!",
    back: isZhHK ? "返回" : isZhCN ? "返回" : "Back",
    loading: isZhHK ? "載入中..." : isZhCN ? "载入中..." : "Loading...",
    saving: isZhHK ? "儲存中..." : isZhCN ? "保存中..." : "Saving...",
  };

  const datingGoalOptions = [
    { value: "life_partner", label: isZhHK ? "終生伴侶" : isZhCN ? "终生伴侣" : "Life Partner" },
    { value: "long_term", label: isZhHK ? "長期穩定關係" : isZhCN ? "长期稳定关系" : "Long-term relationship" },
    { value: "casual", label: isZhHK ? "輕鬆約會" : isZhCN ? "轻松约会" : "Casual dating" },
    { value: "friends", label: isZhHK ? "結交新朋友" : isZhCN ? "结交新朋友" : "Making new friends" },
    { value: "unsure", label: isZhHK ? "還不確定" : isZhCN ? "还不确定" : "Still figuring it out" },
  ];

  const matchModeOptions = [
    { value: "fast", label: isZhHK ? "速度優先 (快速配對)" : isZhCN ? "速度优先 (快速匹配)" : "Fast (Speed over perfection)" },
    { value: "balanced", label: isZhHK ? "平衡模式" : isZhCN ? "平衡模式" : "Balanced" },
    { value: "intentional", label: isZhHK ? "精準優先 (注重合適度)" : isZhCN ? "精准优先 (注重合适度)" : "Intentional (Strong preference fit)" },
    { value: "wait_for_the_one", label: isZhHK ? "寧缺勿濫 (極高標準)" : isZhCN ? "宁缺勿滥 (极高标准)" : "Wait for the one (Strictest criteria)" },
  ];

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

  const handleToggleCrossUni = async () => {
    if (!profile) return;
    setSavingField("crossUniOk");
    const updatedStatus = !profile.crossUniOk;
    try {
      const res: any = await api.saveProfile({
        ...profile,
        crossUniOk: updatedStatus,
      });
      if (res.user) {
        setProfile(res.user);
      }
    } catch (e: any) {
      alert(e.message || "Failed to update preference.");
    } finally {
      setSavingField(null);
    }
  };

  const handleDatingGoalChange = async (goal: string) => {
    if (!profile) return;
    setSavingField("datingGoal");
    const updatedPrefs = {
      ...(profile.datingPreferences ?? {}),
      datingGoal: goal,
    };
    try {
      const res: any = await api.saveProfile({
        ...profile,
        datingPreferences: updatedPrefs,
      });
      if (res.user) {
        setProfile(res.user);
      }
    } catch (e: any) {
      alert(e.message || "Failed to update dating goal.");
    } finally {
      setSavingField(null);
    }
  };

  const handleMatchModeChange = async (mode: string) => {
    if (!profile) return;
    setSavingField("matchMode");
    const updatedPrefs = {
      ...(profile.datingPreferences ?? {}),
      matchMode: mode,
    };
    try {
      const res: any = await api.saveProfile({
        ...profile,
        datingPreferences: updatedPrefs,
      });
      if (res.user) {
        setProfile(res.user);
      }
    } catch (e: any) {
      alert(e.message || "Failed to update match mode.");
    } finally {
      setSavingField(null);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://www.aurahk.me");
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
                      <span>
                        {lang === "en" ? "English" : lang === "zh-HK" ? "繁體中文" : "简体中文"}
                      </span>
                      {active && (
                        <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-aura shadow-[0_0_8px_rgba(255,0,102,0.6)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* Profile Matching Preferences */}
            {userId && profile && (
              <SectionCard className="border-white/10 shadow-2xl backdrop-blur-md space-y-6">
                <div className="flex items-center gap-3">
                  <Heart size={18} className="text-aura" />
                  <div>
                    <h3 className="font-black text-white">{txt.preferences}</h3>
                  </div>
                </div>

                {/* Cross campus matching toggle */}
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="max-w-[80%]">
                    <span className="text-sm font-bold text-white block">{txt.crossCampus}</span>
                    <span className="text-xs text-white/45 leading-relaxed">{txt.crossCampusDesc}</span>
                  </div>
                  <button
                    disabled={savingField === "crossUniOk"}
                    onClick={handleToggleCrossUni}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    {profile.crossUniOk ? (
                      <ToggleRight size={44} className="text-aura cursor-pointer" />
                    ) : (
                      <ToggleLeft size={44} className="text-white/20 cursor-pointer" />
                    )}
                  </button>
                </div>

                {/* Match pace dropdown selector */}
                <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                  <div>
                    <span className="text-sm font-bold text-white block">{txt.matchMode}</span>
                    <span className="text-xs text-white/45 leading-relaxed">{txt.matchModeDesc}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {matchModeOptions.map((opt) => {
                      const active = (profile.datingPreferences?.matchMode ?? "balanced") === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={savingField === "matchMode" || active}
                          onClick={() => handleMatchModeChange(opt.value)}
                          className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition-all ${
                            active
                              ? "border-aura/40 bg-aura/5 text-aura"
                              : "border-white/5 bg-white/[0.01] text-white/50 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dating Goal dropdown selector */}
                <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                  <div>
                    <span className="text-sm font-bold text-white block">{txt.datingGoal}</span>
                    <span className="text-xs text-white/45 leading-relaxed">{txt.datingGoalDesc}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {datingGoalOptions.map((opt) => {
                      const active = (profile.datingPreferences?.datingGoal ?? "unsure") === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={savingField === "datingGoal" || active}
                          onClick={() => handleDatingGoalChange(opt.value)}
                          className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition-all ${
                            active
                              ? "border-aura/40 bg-aura/5 text-aura"
                              : "border-white/5 bg-white/[0.01] text-white/50 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>
            )}

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
