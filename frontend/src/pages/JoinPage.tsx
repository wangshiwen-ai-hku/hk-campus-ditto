import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import type { StudentProfile } from "../types";
import { SectionCard } from "../components/SectionCard";
import { TagSelector } from "../components/TagSelector";
import { setStoredToken } from "../lib/session";

const SLOTS = ["Wed 6pm", "Thu 6pm", "Fri 4pm", "Sat 2pm", "Sun 4pm"];
const TAGS = ["coffee", "books", "cantopop", "museum dates", "design", "beach sunsets", "podcasts", "night views"];

export function JoinPage({ userId, onUser }: { userId: string | null; onUser: (id: string) => void; }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState("DITTO-HK-001");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [profileId, setProfileId] = useState(userId ?? "");
  const [major, setMajor] = useState("");
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [interests, setInterests] = useState<string[]>(["coffee"]);
  const [availability, setAvailability] = useState<string[]>(["Fri 4pm"]);
  const [loading, setLoading] = useState(false);

  async function requestCode() {
    try {
      const data = await api.requestCode(email) as { devCode: string };
      setMessage(t("join.demoCodeMsg", { code: data.devCode }));
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  async function verify() {
    setLoading(true);
    try {
      const data = await api.verifyCode(email, code, fullName, inviteCode);
      setStoredToken(data.token);
      setProfileId(data.user.id);
      onUser(data.user.id);
      setMessage(t("join.verifiedMsg"));
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!profileId) {
      setMessage(t("join.verifyFirstMsg"));
      return;
    }
    setLoading(true);
    try {
      await api.saveProfile({
        id: profileId,
        fullName,
        universityId: "",
        yearOfStudy: "Year 3",
        major,
        gender: "Prefer not to say",
        seeking: "Meaningful connection",
        bio,
        languages,
        interests,
        vibeTags: ["calm", "curious"],
        dealBreakers: [],
        optedIn: true,
        availability
      });
      setMessage(t("join.savedMsg"));
      setTimeout(() => {
        navigate("/student");
      }, 1500);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-20">
      <SectionCard>
        <div className="mb-8 text-center">
            <div className="inline-block text-xs font-black uppercase tracking-[0.4em] text-pink-400 mb-2">{t("join.title")}</div>
            <h1 className="text-5xl font-black">{t("join.pageTitle")}</h1>
            <p className="mt-4 text-white/50 leading-relaxed max-w-2xl mx-auto">{t("join.subtitle")}</p>
        </div>

        <div className="grid gap-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-white/50">{t("join.emailLabel")}</label>
                <input 
                  className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all" 
                  placeholder={t("join.emailPlaceholder")} 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                />
            </div>
            <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-white/50">{t("join.nameLabel")}</label>
                <input 
                  className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all" 
                  placeholder={t("join.namePlaceholder")} 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-black uppercase tracking-widest text-white/50">邀请码 (Invite Code)</label>
            <input 
              className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all" 
              placeholder="DITTO-HK-001" 
              value={inviteCode} 
              onChange={(e) => setInviteCode(e.target.value)} 
            />
          </div>

          <div className="flex flex-col sm:flex-row items-end gap-4">
            <button 
              disabled={loading}
              className="h-[60px] w-full sm:w-auto rounded-full bg-white px-8 font-black text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50" 
              onClick={requestCode}
            >
              {t("join.sendCode")}
            </button>
            <div className="flex-1 space-y-4 w-full">
                <label className="text-xs font-black uppercase tracking-widest text-white/50">{t("join.verifyCodeLabel")}</label>
                <input 
                  className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 text-black focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all" 
                  value={code} 
                  onChange={(e) => setCode(e.target.value)} 
                />
            </div>
            <button 
              disabled={loading}
              className="h-[60px] w-full sm:w-auto rounded-full border border-white/10 bg-white px-8 font-black text-black hover:bg-white/90 transition-all disabled:opacity-50" 
              onClick={verify}
            >
              {loading ? "..." : t("join.verifyBtn")}
            </button>
          </div>

          <div className="grid gap-6">
            <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-white/50">{t("join.majorLabel")}</label>
                <input className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 text-black focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all" placeholder={t("join.majorPlaceholder")} value={major} onChange={(e) => setMajor(e.target.value)} />
            </div>
            <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-white/50">{t("join.bioLabel")}</label>
                <textarea className="w-full min-h-[120px] rounded-2xl border border-white/10 bg-white px-5 py-4 text-black focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all" placeholder={t("join.bioPlaceholder")} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
          </div>

          <div className="space-y-8">
            <TagSelector title={t("join.languages")} items={["English", "Cantonese", "Mandarin"]} values={languages} setValues={setLanguages} />
            <TagSelector title={t("join.interests")} items={TAGS} values={interests} setValues={setInterests} />
            <TagSelector title={t("join.availability")} items={SLOTS} values={availability} setValues={setAvailability} />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/5">
            <button 
              disabled={loading || !profileId}
              className="rounded-full bg-pink-500 px-10 py-5 text-xl font-black text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50" 
              onClick={saveProfile}
            >
              {t("join.saveBtn")}
            </button>
            <Link to="/student" className="rounded-full border border-white/10 bg-white/5 px-10 py-5 text-center font-bold text-white hover:bg-white/10 transition-all">{t("join.dashboardBtn")}</Link>
          </div>
          
          {message ? (
            <div className={`rounded-2xl border p-4 text-center text-sm ${profileId ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-red-500/20 border-red-500/30 text-red-300'}`}>
              {message}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </main>
  );
}
