import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import type { MatchRecord, StudentProfile } from "../types";
import { SectionCard } from "../components/SectionCard";

type MatchView = {
  match: MatchRecord;
  partner: StudentProfile;
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function formatMbti(val?: string) {
  if (!val || typeof val !== 'string') return "";
  const slug = val.split(".").pop()?.replace("mbti_", "");
  if (!slug || slug === "none") return "";
  return slug[0].toUpperCase();
}

function getNextDropTime() {
  const now = new Date();
  const next = new Date();
  const day = now.getDay();
  const diff = (3 - day + 7) % 7 || 7;
  next.setDate(now.getDate() + diff);
  next.setHours(19, 0, 0, 0);
  return next.getTime();
}

export function StudentPage({ userId }: { userId: string | null; }) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [view, setView] = useState<MatchView | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const target = getNextDropTime();
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = target - now;
      if (distance < 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      setTimeLeft({
        d: Math.floor(distance / (1000 * 60 * 60 * 24)),
        h: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function refresh() {
    if (!userId) return;
    const [profileRes, matchRes] = await Promise.all([
      api.getProfile(userId),
      api.getCurrentMatch()
    ]);
    setProfile(profileRes as StudentProfile);
    setView((matchRes as { matchView: MatchView | null }).matchView);
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, [userId]);

  const partnerChips = useMemo(() => view?.partner.interests.slice(0, 4) ?? [], [view]);
  const proposedSlots = view?.match.proposedSlots?.length ? view.match.proposedSlots : view?.match.overlapSlots ?? [];
  const myAcceptance = view?.match.acceptances?.find((x) => x.userId === profile?.id)?.choice;
  const canRespond = view ? ["notified", "awaiting-acceptance"].includes(view.match.status) : false;
  const canConfirmSlot = view ? ["slot-proposing", "awaiting-availability"].includes(view.match.status) && proposedSlots.length > 0 : false;
  const canPickPlace = view?.match.status === "slot-confirmed";
  const canMarkHappened = view?.match.status === "scheduled";
  const canFeedback = view ? ["happened", "feedback-collected"].includes(view.match.status) : false;

  function updateMatch(match: MatchRecord) {
    setView((prev) => prev ? { ...prev, match } : prev);
  }

  async function respond(choice: "yes" | "no") {
    if (!view) return;
    try {
      const res = await api.respondToMatch(view.match.id, choice) as { match: MatchRecord };
      updateMatch(res.match);
      setMessage(choice === "yes" ? "已接受。等待对方确认或进入时间选择。" : "已拒绝，本轮 match 已结束。");
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  async function confirmSlot(slot: string) {
    if (!view) return;
    try {
      const res = await api.confirmSlot(view.match.id, slot) as { match: MatchRecord };
      updateMatch(res.match);
      setMessage("时间已确认。下一步选择约会地点。");
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  async function pickPlace() {
    if (!view) return;
    try {
      const res = await api.pickPlace(view.match.id) as { match: MatchRecord };
      updateMatch(res.match);
      setMessage("地点已确认，约会已排期。");
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  async function markHappened() {
    if (!view) return;
    try {
      const res = await api.markHappened(view.match.id) as { match: MatchRecord };
      updateMatch(res.match);
      setMessage("已标记完成。现在可以提交约会反馈。");
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  async function sendFeedback(sentiment: "love" | "pass" | "rematch") {
    if (!view || !profile) return;
    try {
      const res = await api.submitFeedback(view.match.id, "post_date_2h", {
        oneLine: note,
        vibeScore: sentiment === "love" ? 8 : sentiment === "rematch" ? 5 : 2
      }, sentiment) as { match: MatchRecord };
      updateMatch(res.match);
      setMessage(sentiment === "rematch" ? t("student.findingMatch") : t("student.feedbackSaved"));
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-20">
        <SectionCard className="text-center">
          <h1 className="text-3xl font-black">{t("student.title")}</h1>
          <p className="mt-4 text-white/50">{t("student.signInPrompt")}</p>
        </SectionCard>
      </main>
    );
  }

  if (!profile) return <main className="flex min-h-[60vh] items-center justify-center text-white/50 animate-pulse">{t("student.loading")}</main>;

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:py-20">
      <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <div className="inline-block text-[10px] font-black uppercase tracking-[0.5em] text-aura mb-3 px-3 py-1 rounded-full bg-aura/10 border border-aura/20">{t("student.title")}</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">{t("student.hi", { name: profile.fullName.split(" ")[0] })}</h1>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-xl">
                ✨
            </div>
            <div className="text-sm font-bold text-white/40">
                {profile.major || "Ditto Student"}
            </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[380px_1fr] items-stretch">
        <SectionCard className="flex flex-col !p-0 overflow-hidden border-white/10 shadow-2xl lg:sticky lg:top-12">
          <div className="h-28 bg-gradient-to-r from-aura/30 via-harbour/20 to-aura/10 shrink-0" />
          <div className="px-8 pb-10 -mt-14 text-center flex-1 flex flex-col">
            <div className="inline-flex h-28 w-28 items-center justify-center rounded-[40px] bg-gradient-to-br from-aura to-harbour text-4xl font-black text-white shadow-2xl ring-[12px] ring-[#0f172a] shrink-0 mx-auto">
              {initials(profile.fullName)}
            </div>
            <h2 className="mt-6 text-2xl font-black tracking-tight">{profile.fullName}</h2>
            <div className="mt-1 text-white/40 font-medium text-xs">{profile.email}</div>
            
            <div className="mt-10 space-y-6 text-left">
                <div className="group rounded-3xl bg-white/[0.03] p-5 border border-white/5 transition-colors hover:bg-white/[0.05]">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">{t("student.major")}</div>
                    <div className="text-white/90 font-bold text-xs leading-tight">{profile.major || t("student.pending")}</div>
                </div>
                
                {/* Personal Signals Grid */}
                <div className="grid grid-cols-2 gap-2">
                    {profile.datingPreferences?.mbti && (
                        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-3 flex flex-col justify-center">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/20 mb-1">MBTI</div>
                            <div className="text-aura font-black text-xs tracking-[0.2em]">
                                {formatMbti(profile.datingPreferences.mbti.energy)}
                                {formatMbti(profile.datingPreferences.mbti.information)}
                                {formatMbti(profile.datingPreferences.mbti.decision)}
                                {formatMbti(profile.datingPreferences.mbti.lifestyle) || "—"}
                            </div>
                        </div>
                    )}
                    {profile.datingPreferences?.heightCm && (
                        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-3 flex flex-col justify-center">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/20 mb-1">Height</div>
                            <div className="text-white/80 font-black text-xs">{profile.datingPreferences.heightCm} cm</div>
                        </div>
                    )}
                    {profile.datingPreferences?.datingGoal && (
                        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-3 col-span-2">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/20 mb-1">Dating Goal</div>
                            <div className="text-white/80 font-bold text-[11px] leading-tight">
                                {profile.datingPreferences.datingGoal.includes('.') ? t(profile.datingPreferences.datingGoal) : t(`onboarding.opt.${profile.datingPreferences.datingGoal}`)}
                            </div>
                        </div>
                    )}
                    {profile.datingPreferences?.hkMtrLocations?.length && (
                        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-3 col-span-2">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/20 mb-1">Location</div>
                            <div className="text-white/80 font-bold text-[11px] leading-tight truncate">
                                {profile.datingPreferences.hkMtrLocations.map(loc => loc.includes('.') ? t(loc) : t(`onboarding.opt.${loc}`)).join(", ")}
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-2.5 ml-1">{t("student.languages")}</div>
                    <div className="flex flex-wrap gap-2">
                        {profile.languages.map(lang => (
                            <span key={lang} className="rounded-2xl bg-aura/10 px-4 py-1.5 text-xs text-aura font-black border border-aura/20 tracking-wide">
                                {lang.includes('.') ? t(lang) : t(`join.langs.${lang}`, { defaultValue: lang })}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="mt-auto pt-8 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Status</span>
                    <span className="flex items-center gap-2 text-green-400 text-xs font-bold bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        Active in Pool
                    </span>
                </div>
            </div>
          </div>
        </SectionCard>

        {view ? (
          <div className="space-y-10">
            <div className="overflow-hidden rounded-[48px] bg-gradient-to-br from-indigo-950 via-purple-950 to-harbour/20 border border-white/10 p-10 text-white shadow-2xl relative group">
              <div className="absolute -bottom-10 -right-10 p-8 opacity-10 transition-transform group-hover:scale-110 duration-700">
                <svg width="240" height="240" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
              <div className="relative z-10">
                <div className="text-[9px] font-black uppercase tracking-[0.4em] text-white/50 mb-5 px-3 py-1 rounded-full bg-white/10 border border-white/10 w-fit backdrop-blur-md">{t("student.currentDrop")}</div>
                <h2 className="text-xl md:text-2xl font-black mb-2 tracking-tight leading-tight">{view.match.posterHeadline}</h2>
                <div className="flex items-center gap-3">
                    <div className="text-white/60 font-bold text-sm">{t("student.compatibility")}</div>
                    <div className="text-xl font-black text-aura italic tracking-tighter">{view.match.score}%</div>
                </div>
              </div>
            </div>

            <SectionCard className="rounded-[48px] border-white/10 shadow-2xl">
              <div className="grid gap-12 md:grid-cols-[320px_1fr]">
                <div className="space-y-6">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[40px] bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 flex items-center justify-center group">
                    <div className="text-7xl font-black opacity-10 transition-transform group-hover:scale-110 duration-500">{initials(view.partner.fullName)}</div>
                    <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-[#0f172a] to-transparent">
                        <div className="text-xl font-black tracking-tight">{view.partner.fullName}</div>
                        <div className="text-xs text-white/50 font-medium mt-1 uppercase tracking-wider">{view.partner.major} • {view.partner.yearOfStudy}</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                        {partnerChips.map((chip) => <span key={chip} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-xs text-aura font-black italic transition-colors hover:bg-aura/10 hover:border-aura/20">#{chip}</span>)}
                  </div>
                </div>

                <div className="space-y-8">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-4">{t("student.aboutThem")}</h3>
                    <p className="text-white/70 leading-relaxed text-base font-medium">{view.partner.bio}</p>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="rounded-3xl bg-white/[0.03] border border-white/5 p-6 transition-transform hover:-translate-y-1 duration-300">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3">{t("student.curatedDate")}</div>
                      <div className="text-xl font-black text-aura tracking-tight leading-tight">{view.match.curatedDateTitle}</div>
                      <div className="text-xs text-white/50 mt-1 font-medium">{view.match.curatedDateSpot}</div>
                    </div>
                    <div className="rounded-3xl bg-white/[0.03] border border-white/5 p-6 transition-transform hover:-translate-y-1 duration-300">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3">{t("student.scheduling")}</div>
                      <div className="text-lg font-black text-green-400 tracking-tight leading-tight">{view.match.confirmedSlot || t("student.waitOverlap")}</div>
                      <div className="text-xs text-white/40 mt-2 font-medium break-words">{t("student.overlap", { slots: view.match.overlapSlots.join(", ") || t("student.noneYet") })}</div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-md">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-3">Match Status</div>
                        <div className="text-lg font-black text-white tracking-tighter capitalize">{view.match.status.replace(/-/g, ' ')}</div>
                        {myAcceptance ? <div className="inline-block text-xs font-bold text-aura mt-2 px-3 py-1 rounded-full bg-aura/10 border border-aura/20">You responded: {myAcceptance}</div> : null}
                      </div>
                      <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-black text-white hover:bg-white hover:text-black transition-all shadow-xl" onClick={() => refresh().catch(console.error)}>
                        Refresh
                      </button>
                    </div>

                    {canRespond ? (
                      <div className="mt-8 flex flex-wrap gap-4">
                        <button className="rounded-2xl bg-aura px-8 py-4 font-black text-white shadow-lg shadow-aura/30 hover:scale-105 active:scale-95 transition-all" onClick={() => respond("yes")}>Accept Match</button>
                        <button className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 font-black text-white hover:bg-white/10 transition-all" onClick={() => respond("no")}>Decline</button>
                      </div>
                    ) : null}

                    {canConfirmSlot ? (
                      <div className="mt-8">
                        <div className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Confirm Date Time</div>
                        <div className="flex flex-wrap gap-3">
                          {proposedSlots.map((slot) => (
                            <button key={slot} className="rounded-2xl border border-green-400/20 bg-green-400/5 px-6 py-3 text-sm font-black text-green-400 hover:bg-green-400 hover:text-black transition-all" onClick={() => confirmSlot(slot)}>
                              {slot}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-8 flex flex-wrap gap-4">
                      {canPickPlace ? <button className="rounded-2xl bg-white px-8 py-4 font-black text-black shadow-2xl hover:scale-105 transition-all" onClick={pickPlace}>Pick Place</button> : null}
                      {canMarkHappened ? <button className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 font-black text-white hover:bg-white/10 transition-all" onClick={markHappened}>Mark as Happened</button> : null}
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/5">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-4 block">{t("student.notesSys")}</label>
                    <textarea 
                      className="w-full min-h-[120px] rounded-[32px] border border-white/10 bg-white/[0.03] px-6 py-5 text-white font-medium focus:outline-none focus:ring-4 focus:ring-aura/20 transition-all mb-6 placeholder:text-white/20" 
                      value={note} 
                      onChange={(e) => setNote(e.target.value)} 
                      placeholder={t("student.notesPlaceholder")} 
                    />
                    <div className="flex flex-wrap gap-4">
                      <button disabled={!canFeedback} className="rounded-2xl bg-aura px-10 py-4 font-black text-white shadow-xl shadow-aura/20 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30" onClick={() => sendFeedback("love")}>{t("student.lovedIt")}</button>
                      <button disabled={!canFeedback} className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 font-black text-white hover:bg-white/10 transition-all disabled:cursor-not-allowed disabled:opacity-30" onClick={() => sendFeedback("pass")}>{t("student.pass")}</button>
                      <button disabled={!canFeedback} className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 font-black text-white hover:bg-white/10 transition-all disabled:cursor-not-allowed disabled:opacity-30" onClick={() => sendFeedback("rematch")}>{t("student.requestRematch")}</button>
                    </div>
                    {!canFeedback ? <div className="mt-4 text-xs font-bold text-white/20 flex items-center gap-2">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Feedback opens after the date is marked as happened.
                    </div> : null}
                  </div>
                  {message ? <div className="rounded-2xl bg-green-500/10 px-6 py-4 text-sm font-bold text-green-400 border border-green-500/20 text-center animate-in fade-in slide-in-from-bottom-4">{message}</div> : null}
                </div>
              </div>
            </SectionCard>
          </div>
        ) : (
          <SectionCard className="flex flex-col items-center justify-center p-6 md:p-12 text-center relative overflow-hidden rounded-[48px] border-white/10 shadow-2xl h-full">
            {/* Abstract Background Elements */}
            <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-aura/10 blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-harbour/10 blur-[100px] pointer-events-none" />

            <div className="relative mb-12">
              <div className="h-32 w-32 rounded-[48px] bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/10 flex items-center justify-center text-5xl shadow-2xl backdrop-blur-xl group">
                <span className="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">⌛</span>
              </div>
              <div className="absolute -top-2 -right-2 h-12 w-12 rounded-2xl bg-aura flex items-center justify-center text-base font-black text-white shadow-2xl shadow-aura/40 rotate-12 ring-6 ring-[#0f172a]">
                1
              </div>
            </div>
            
            <h2 className="text-xl md:text-3xl font-black mb-3 tracking-tighter leading-tight">{t('student.nextDropView.title')}</h2>
            <p className="mt-1 text-white/50 max-w-lg leading-relaxed text-sm font-medium">
              {t('student.nextDropView.desc')}
            </p>
            
            <div className="mt-14 rounded-[40px] border border-white/10 bg-white/[0.03] p-10 w-full max-w-xl backdrop-blur-2xl shadow-2xl relative">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-[40px] pointer-events-none" />
                <div className="relative z-10">
                    <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 mb-8">{t('student.nextDropView.countdownTitle')}</div>
                    <div className="grid grid-cols-4 gap-6">
                        {[
                            { val: timeLeft.d, label: t('student.countdown.days') },
                            { val: timeLeft.h, label: t('student.countdown.hours') },
                            { val: timeLeft.m, label: t('student.countdown.minutes') },
                            { val: timeLeft.s, label: t('student.countdown.seconds') }
                        ].map((item, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <div className="text-xl md:text-3xl font-black text-white tabular-nums tracking-tighter">{String(item.val).padStart(2, '0')}</div>
                                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mt-3">{item.label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8 text-sm font-black text-aura/60 italic tracking-widest">{t('student.nextDropView.checkBack')}</div>
                </div>
            </div>

            <div className="mt-20 grid gap-6 md:grid-cols-2 w-full max-w-3xl">
                <div className="flex gap-6 p-8 rounded-[40px] bg-white/[0.02] border border-white/5 text-left transition-all hover:bg-white/[0.04] hover:-translate-y-1">
                    <div className="h-16 w-16 shrink-0 rounded-[24px] bg-aura/10 flex items-center justify-center text-3xl shadow-xl border border-aura/20">🛡️</div>
                    <div>
                        <div className="font-black text-xl mb-2 tracking-tight">{t('student.nextDropView.verified')}</div>
                        <div className="text-sm text-white/40 leading-relaxed font-medium">{t('student.nextDropView.verifiedDesc')}</div>
                    </div>
                </div>
                <div className="flex gap-6 p-8 rounded-[40px] bg-white/[0.02] border border-white/5 text-left transition-all hover:bg-white/[0.04] hover:-translate-y-1">
                    <div className="h-16 w-16 shrink-0 rounded-[24px] bg-harbour/10 flex items-center justify-center text-3xl shadow-xl border border-harbour/20">✨</div>
                    <div>
                        <div className="font-black text-xl mb-2 tracking-tight">{t('student.nextDropView.highSignal')}</div>
                        <div className="text-sm text-white/40 leading-relaxed font-medium">{t('student.nextDropView.highSignalDesc')}</div>
                    </div>
                </div>
            </div>
          </SectionCard>
        )}
      </div>
    </main>
  );
}
