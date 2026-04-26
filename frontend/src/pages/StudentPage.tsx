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
    <main className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-12">
        <div className="inline-block text-xs font-black uppercase tracking-[0.4em] text-pink-400 mb-2">{t("student.title")}</div>
        <h1 className="text-5xl font-black">{t("student.hi", { name: profile.fullName.split(" ")[0] })}</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        <SectionCard className="h-fit">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-[40px] bg-gradient-to-br from-pink-500 to-rose-400 text-4xl font-black text-white shadow-xl shadow-pink-500/20">
              {initials(profile.fullName)}
            </div>
            <h2 className="text-2xl font-black">{profile.fullName}</h2>
            <div className="mt-1 text-white/40">{profile.email}</div>
          </div>
          
          <div className="mt-10 grid gap-4 border-t border-white/5 pt-8">
            <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-white/30 uppercase tracking-widest">{t("student.major")}</span>
                <span className="text-white/80">{profile.major || t("student.pending")}</span>
            </div>
            <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-white/30 uppercase tracking-widest">{t("student.languages")}</span>
                <div className="flex flex-wrap gap-2">
                    {profile.languages.map(lang => (
                        <span key={lang} className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60 border border-white/10">{lang}</span>
                    ))}
                </div>
            </div>
          </div>
        </SectionCard>

        {view ? (
          <div className="space-y-8">
            <div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-900 to-purple-900 border border-white/10 p-8 text-white shadow-2xl relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
              <div className="relative z-10">
                <div className="text-xs font-black uppercase tracking-[0.4em] text-white/50 mb-4 px-3 py-1 rounded-full bg-white/10 w-fit">{t("student.currentDrop")}</div>
                <h2 className="text-4xl font-black mb-2">{view.match.posterHeadline}</h2>
                <div className="text-white/60 font-medium">{t("student.compatibility")} <span className="text-pink-400 font-black">{view.match.score}%</span></div>
              </div>
            </div>

            <SectionCard>
              <div className="grid gap-8 md:grid-cols-[300px_1fr]">
                <div>
                  <div className="relative aspect-square overflow-hidden rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center">
                    <div className="text-5xl font-black opacity-20">{initials(view.partner.fullName)}</div>
                    <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-lg font-black">{view.partner.fullName}</div>
                        <div className="text-xs text-white/50">{view.partner.major} • {view.partner.yearOfStudy}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">{t("student.aboutThem")}</h3>
                    <p className="text-white/70 leading-relaxed text-lg">{view.partner.bio}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {partnerChips.map((chip) => <span key={chip} className="rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-sm text-pink-400 font-medium italic">#{chip}</span>)}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                      <div className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">{t("student.curatedDate")}</div>
                      <div className="text-xl font-black text-pink-400">{view.match.curatedDateTitle}</div>
                      <div className="text-sm text-white/60 mt-1">{view.match.curatedDateSpot}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                      <div className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">{t("student.scheduling")}</div>
                      <div className="text-lg font-bold text-green-400">{view.match.confirmedSlot || t("student.waitOverlap")}</div>
                      <div className="text-sm text-white/60 mt-1">{t("student.overlap", { slots: view.match.overlapSlots.join(", ") || t("student.noneYet") })}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">Match workflow</div>
                        <div className="text-lg font-black text-white">{view.match.status}</div>
                        {myAcceptance ? <div className="text-sm text-white/50 mt-1">Your response: {myAcceptance}</div> : null}
                        {view.match.proposedPlace ? (
                          <div className="text-sm text-white/60 mt-2">
                            {view.match.proposedPlace.name}
                            {view.match.proposedPlace.address ? ` · ${view.match.proposedPlace.address}` : ""}
                          </div>
                        ) : null}
                      </div>
                      <button className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-bold text-white hover:bg-white hover:text-black transition-all" onClick={() => refresh().catch(console.error)}>
                        Refresh
                      </button>
                    </div>

                    {canRespond ? (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button className="rounded-full bg-pink-500 px-6 py-3 font-black text-white hover:bg-pink-400 transition-all" onClick={() => respond("yes")}>Accept match</button>
                        <button className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-bold text-white hover:bg-white/10 transition-all" onClick={() => respond("no")}>Decline</button>
                      </div>
                    ) : null}

                    {canConfirmSlot ? (
                      <div className="mt-5">
                        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white/30">Confirm time</div>
                        <div className="flex flex-wrap gap-3">
                          {proposedSlots.map((slot) => (
                            <button key={slot} className="rounded-full border border-green-400/30 bg-green-400/10 px-5 py-2 text-sm font-bold text-green-300 hover:bg-green-400 hover:text-black transition-all" onClick={() => confirmSlot(slot)}>
                              {slot}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-wrap gap-3">
                      {canPickPlace ? <button className="rounded-full bg-white px-6 py-3 font-black text-black hover:bg-white/90 transition-all" onClick={pickPlace}>Pick place</button> : null}
                      {canMarkHappened ? <button className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-bold text-white hover:bg-white/10 transition-all" onClick={markHappened}>Mark happened</button> : null}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3 block">{t("student.notesSys")}</label>
                    <textarea 
                      className="w-full min-h-[100px] rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all mb-4" 
                      value={note} 
                      onChange={(e) => setNote(e.target.value)} 
                      placeholder={t("student.notesPlaceholder")} 
                    />
                    <div className="flex flex-wrap gap-3">
                      <button disabled={!canFeedback} className="rounded-full bg-pink-500 px-8 py-3 font-black text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => sendFeedback("love")}>{t("student.lovedIt")}</button>
                      <button disabled={!canFeedback} className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-bold text-white hover:bg-white/10 transition-all disabled:cursor-not-allowed disabled:opacity-40" onClick={() => sendFeedback("pass")}>{t("student.pass")}</button>
                      <button disabled={!canFeedback} className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-bold text-white hover:bg-white/10 transition-all disabled:cursor-not-allowed disabled:opacity-40" onClick={() => sendFeedback("rematch")}>{t("student.requestRematch")}</button>
                    </div>
                    {!canFeedback ? <div className="mt-3 text-xs text-white/40">Feedback opens after the date is marked as happened.</div> : null}
                  </div>
                  {message ? <div className="rounded-xl bg-green-500/20 px-4 py-2 text-sm text-green-300 border border-green-500/30 text-center">{message}</div> : null}
                </div>
              </div>
            </SectionCard>
          </div>
        ) : (
          <SectionCard className="flex flex-col items-center justify-center p-20 text-center bg-gradient-to-br from-white/5 to-transparent">
            <div className="relative mb-10">
              <div className="h-32 w-32 rounded-full bg-pink-500/10 flex items-center justify-center text-5xl animate-pulse">
                ⌛
              </div>
              <div className="absolute top-0 right-0 h-8 w-8 rounded-full bg-pink-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                1
              </div>
            </div>
            
            <h2 className="text-4xl font-black mb-4">{t('student.nextDropView.title')}</h2>
            <p className="mt-2 text-white/50 max-w-md leading-relaxed text-lg">
              {t('student.nextDropView.desc')}
            </p>
            
            <div className="mt-10 rounded-2xl border border-white/5 bg-white/5 p-6 w-full max-w-md">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-white/30 mb-2">{t('student.nextDropView.countdownTitle')}</div>
                <div className="text-3xl sm:text-4xl font-black text-pink-400 tabular-nums flex justify-center gap-2">
                   <span>{timeLeft.d}<span className="text-sm ml-1 text-white/30">{t('student.countdown.days')}</span></span>
                   <span>{timeLeft.h}<span className="text-sm ml-1 text-white/30">{t('student.countdown.hours')}</span></span>
                   <span>{timeLeft.m}<span className="text-sm ml-1 text-white/30">{t('student.countdown.minutes')}</span></span>
                   <span>{timeLeft.s}<span className="text-sm ml-1 text-white/30">{t('student.countdown.seconds')}</span></span>
                </div>
                <div className="mt-2 text-xs text-white/40 italic">{t('student.nextDropView.checkBack')}</div>
            </div>

            <div className="mt-12 grid gap-4 w-full max-w-md text-left">
                <div className="flex gap-4 items-start">
                    <div className="mt-1 h-2 w-2 rounded-full bg-pink-500" />
                    <div>
                        <div className="font-bold">{t('student.nextDropView.verified')}</div>
                        <div className="text-sm text-white/40">{t('student.nextDropView.verifiedDesc')}</div>
                    </div>
                </div>
                <div className="flex gap-4 items-start">
                    <div className="mt-1 h-2 w-2 rounded-full bg-pink-500" />
                    <div>
                        <div className="font-bold">{t('student.nextDropView.highSignal')}</div>
                        <div className="text-sm text-white/40">{t('student.nextDropView.highSignalDesc')}</div>
                    </div>
                </div>
            </div>
          </SectionCard>
        )}
      </div>
    </main>
  );
}
