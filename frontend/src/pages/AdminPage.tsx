import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import type { MatchRecord, StudentProfile } from "../types";
import { SectionCard } from "../components/SectionCard";

export function AdminPage({ onUser }: { onUser: (id: string) => void; }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<{ stats: { students: number; completedProfiles: number; scheduledDates: number; rematchFlags: number; }; students: Array<StudentProfile & { universityLabel: string }>; matches: Array<MatchRecord & { userALabel: string; userBLabel: string }>; } | null>(null);
  const [message, setMessage] = useState("");

  const handleUserSelect = (id: string) => {
    onUser(id);
    navigate("/student");
  };

  async function load() { setData(await api.getAdminOverview() as never); }
  useEffect(() => { load().catch(console.error); }, []);

  async function runDrop() {
    const result = await api.runMatchmaking(false) as { created: number };
    await api.triggerDrop();
    setMessage(t("admin.msgCreated", { count: result.created }));
    await load();
  }
  async function resetDemo() {
    await api.resetDemo();
    setMessage(t("admin.msgReset"));
    await load();
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div>
            <div className="inline-block text-xs font-black uppercase tracking-[0.4em] text-pink-400 mb-2">{t("admin.title")}</div>
            <h1 className="text-5xl font-black">{t("admin.pageTitle")}</h1>
        </div>
        <div className="flex flex-wrap gap-4">
          <button className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-bold text-white hover:bg-white/10 transition-all" onClick={resetDemo}>{t("admin.resetDemo")}</button>
          <button className="rounded-full bg-white px-8 py-3 font-black text-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/10" onClick={runDrop}>{t("admin.runDrop")}</button>
        </div>
      </div>

      {message ? <div className="mb-8 rounded-2xl bg-pink-500/20 border border-pink-500/30 p-4 text-center text-sm text-pink-300 animate-pulse">{message}</div> : null}
      
      {data ? (
        <div className="grid gap-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
                { label: t("admin.stats.students"), val: data.stats.students, color: "text-blue-400" },
                { label: t("admin.stats.profiles"), val: data.stats.completedProfiles, color: "text-pink-400" },
                { label: t("admin.stats.dates"), val: data.stats.scheduledDates, color: "text-green-400" },
                { label: t("admin.stats.rematch"), val: data.stats.rematchFlags, color: "text-yellow-400" }
            ].map(stat => (
                <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition-colors">
                    <div className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">{stat.label}</div>
                    <div className={`text-4xl font-black ${stat.color}`}>{stat.val}</div>
                </div>
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
            <SectionCard>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-6">{t("admin.recentMatches")}</div>
              <div className="space-y-4">
                {data.matches.map((match) => (
                  <div key={match.id} className="rounded-2xl border border-white/5 bg-white/5 p-5 transition-all hover:border-white/20 hover:bg-white/10 group">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-lg font-black group-hover:text-pink-400 transition-colors">{match.userALabel} × {match.userBLabel}</div>
                        <div className="text-xs text-white/40 mt-1 uppercase tracking-widest">{match.status} • {t("admin.score")} {match.score}</div>
                      </div>
                      <button className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-bold hover:bg-white text-white hover:text-black transition-all" onClick={() => handleUserSelect(match.userAId)}>{t("admin.open")}</button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
            
            <SectionCard>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-6">{t("admin.studentDir")}</div>
              <div className="space-y-3">
                {data.students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-5 py-4 transition-all hover:bg-white/10">
                    <div>
                      <div className="font-black">{student.fullName}</div>
                      <div className="text-xs text-white/40 mt-0.5">{student.universityLabel} • {student.major || t("admin.incomplete")}</div>
                    </div>
                    <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold hover:bg-white text-white hover:text-black transition-all" onClick={() => handleUserSelect(student.id)}>{t("admin.view")}</button>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      ) : <div className="flex min-h-[40vh] items-center justify-center text-white/20">{t("admin.loading")}</div>}
    </main>
  );
}
