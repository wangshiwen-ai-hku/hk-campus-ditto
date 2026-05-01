import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import type { MatchRecord, StudentProfile } from "../types";
import { SectionCard } from "../components/SectionCard";
import { setStoredToken } from "../lib/session";

export function AdminPage({ onUser }: { onUser: (id: string) => void; }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<{ stats: { students: number; completedProfiles: number; scheduledDates: number; rematchFlags: number; }; students: Array<StudentProfile & { universityLabel: string }>; matches: Array<MatchRecord & { userALabel: string; userBLabel: string }>; } | null>(null);
  const [message, setMessage] = useState("");
  const [labUsers, setLabUsers] = useState<any[]>([]);
  const [selectedLabId, setSelectedLabId] = useState("");
  const [labScenario, setLabScenario] = useState("balanced");
  const [labCount, setLabCount] = useState(50);
  const [useLlmJudge, setUseLlmJudge] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [simulation, setSimulation] = useState<any | null>(null);

  const handleUserSelect = async (id: string) => {
    const session = await api.loginAsDevUser({ userId: id });
    setStoredToken(session.token);
    onUser(session.user.id);
    navigate("/student");
  };

  async function load() {
    const [overview, lab] = await Promise.all([
      api.getAdminOverview(),
      api.getMatchLabUsers().catch(() => ({ users: [] })),
    ]);
    setData(overview as never);
    setLabUsers(lab.users);
    if (!selectedLabId && lab.users[0]) setSelectedLabId(lab.users[0].id);
  }
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

  const selectedLabUser = labUsers.find((user) => user.id === selectedLabId);

  async function seedLab() {
    const result = await api.seedMatchLab({ count: labCount, scenario: labScenario, resetMatches: true });
    setLabUsers(result.users);
    setSelectedLabId(result.users[0]?.id ?? "");
    setPreview(null);
    setSimulation(null);
    setMessage(`Seeded ${result.users.length} lab users.`);
    await load();
  }

  async function saveLabUser(patch: any) {
    if (!selectedLabId) return;
    const result = await api.updateMatchLabUser(selectedLabId, patch);
    setLabUsers((users) => users.map((user) => user.id === selectedLabId ? result.user : user));
  }

  async function runPreview() {
    if (!selectedLabId) return;
    const result = await api.previewMatchLab({ userId: selectedLabId, useLlmJudge });
    setPreview(result.candidates);
  }

  async function runSimulation() {
    const result = await api.simulateMatchLab({ useLlmJudge });
    setSimulation(result);
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div>
            <div className="inline-block text-xs font-black uppercase tracking-[0.4em] text-aura mb-2">{t("admin.title")}</div>
            <h1 className="text-4xl font-black">{t("admin.pageTitle")}</h1>
        </div>
        <div className="flex flex-wrap gap-4">
          <button className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-bold text-white hover:bg-white/10 transition-all" onClick={resetDemo}>{t("admin.resetDemo")}</button>
          <button className="rounded-full bg-white px-8 py-3 font-black text-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/10" onClick={runDrop}>{t("admin.runDrop")}</button>
        </div>
      </div>

      {message ? <div className="mb-8 rounded-2xl bg-aura/20 border border-aura/30 p-4 text-center text-sm text-aura animate-pulse">{message}</div> : null}
      
      {data ? (
        <div className="grid gap-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
                { label: t("admin.stats.students"), val: data.stats.students, color: "text-blue-400" },
                { label: t("admin.stats.profiles"), val: data.stats.completedProfiles, color: "text-aura" },
                { label: t("admin.stats.dates"), val: data.stats.scheduledDates, color: "text-green-400" },
                { label: t("admin.stats.rematch"), val: data.stats.rematchFlags, color: "text-yellow-400" }
            ].map(stat => (
                <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition-colors">
                    <div className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">{stat.label}</div>
                    <div className={`text-3xl font-black ${stat.color}`}>{stat.val}</div>
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
                        <div className="text-lg font-black group-hover:text-aura transition-colors">{match.userALabel} × {match.userBLabel}</div>
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

          <SectionCard>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Match Lab</div>
                <h2 className="mt-2 text-2xl font-black">Algorithm sandbox</h2>
                <p className="mt-2 max-w-2xl text-sm text-white/45">Seed diverse users, edit inputs, preview hard rejects and score breakdowns, then simulate global pairing.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <select className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" value={labScenario} onChange={(e) => setLabScenario(e.target.value)}>
                  {["balanced", "strict", "sparse", "extreme"].map((scenario) => <option className="bg-black" key={scenario} value={scenario}>{scenario}</option>)}
                </select>
                <input className="w-24 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white" type="number" min={2} max={200} value={labCount} onChange={(e) => setLabCount(Number(e.target.value))} />
                <button className="rounded-full bg-aura px-6 py-3 font-black text-white" onClick={seedLab}>Seed users</button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <label className="text-xs font-black uppercase tracking-widest text-white/30">Lab user</label>
                  <select className="mt-3 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white" value={selectedLabId} onChange={(e) => { setSelectedLabId(e.target.value); setPreview(null); }}>
                    {labUsers.map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.universityId}</option>)}
                  </select>
                </div>

                {selectedLabUser ? (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <input className="w-full rounded-xl bg-white px-3 py-2 text-sm text-black" value={selectedLabUser.major} onChange={(e) => saveLabUser({ major: e.target.value })} />
                    <input className="w-full rounded-xl bg-white px-3 py-2 text-sm text-black" value={selectedLabUser.yearOfStudy} onChange={(e) => saveLabUser({ yearOfStudy: e.target.value })} />
                    <select className="w-full rounded-xl bg-white px-3 py-2 text-sm text-black" value={selectedLabUser.universityId} onChange={(e) => saveLabUser({ universityId: e.target.value })}>
                      {["hku", "cuhk", "hkust", "polyu", "cityu", "hkbu", "lingnan", "eduhk"].map((id) => <option key={id} value={id}>{id}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-sm font-bold text-white/70">
                      <input type="checkbox" checked={Boolean(selectedLabUser.crossUniOk)} onChange={(e) => saveLabUser({ crossUniOk: e.target.checked })} />
                      crossUniOk
                    </label>
                    <label className="flex items-center gap-2 text-sm font-bold text-white/70">
                      <input type="checkbox" checked={Boolean(selectedLabUser.optedIn)} onChange={(e) => saveLabUser({ optedIn: e.target.checked })} />
                      optedIn
                    </label>
                    <label className="flex items-center gap-2 text-sm font-bold text-white/70">
                      <input type="checkbox" checked={Boolean(selectedLabUser.photoUrl)} onChange={(e) => saveLabUser({ hasPhoto: e.target.checked })} />
                      has photo
                    </label>
                    <label className="flex items-center gap-2 text-sm font-bold text-white/70">
                      <input type="checkbox" checked={useLlmJudge} onChange={(e) => setUseLlmJudge(e.target.checked)} />
                      use LLM judge
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10" onClick={runPreview}>Preview</button>
                      <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10" onClick={runSimulation}>Simulate all</button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/45">Seed lab users to start.</div>
                )}
              </div>

              <div className="space-y-6">
                {preview ? (
                  <div>
                    <div className="mb-3 text-xs font-black uppercase tracking-widest text-white/30">Candidate preview</div>
                    <div className="grid gap-3">
                      {preview.slice(0, 12).map((item) => (
                        <div key={item.candidate.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-black">{item.candidate.fullName} · {item.candidate.universityId}</div>
                              <div className="text-xs text-white/40">{item.candidate.major} · {item.candidate.yearOfStudy}</div>
                            </div>
                            <div className={`rounded-full px-3 py-1 text-xs font-black ${item.hardPassed ? "bg-green-400/20 text-green-300" : "bg-red-400/20 text-red-300"}`}>
                              {item.hardPassed ? `score ${item.finalScore}` : "rejected"}
                            </div>
                          </div>
                          {item.rejectReasons?.length ? <div className="mt-3 text-sm text-red-300">{item.rejectReasons.join(" · ")}</div> : null}
                          {item.breakdown ? (
                            <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                              {["intent", "targetPreference", "language", "logistics", "academic", "interests", "lifestyle", "attraction", "media", "campus"].map((key) => (
                                <div key={key} className="rounded-xl bg-white/5 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-widest text-white/30">{key}</div>
                                  <div className="text-lg font-black">{Math.round(item.breakdown[key] ?? 0)}</div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {simulation ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="mb-4 flex flex-wrap gap-3">
                      <div className="rounded-xl bg-white/5 px-4 py-3"><div className="text-xs text-white/35">Users</div><div className="text-2xl font-black">{simulation.users}</div></div>
                      <div className="rounded-xl bg-white/5 px-4 py-3"><div className="text-xs text-white/35">Pairs</div><div className="text-2xl font-black">{simulation.pairs.length}</div></div>
                      <div className="rounded-xl bg-white/5 px-4 py-3"><div className="text-xs text-white/35">Skipped</div><div className="text-2xl font-black">{simulation.skipped.length}</div></div>
                      <div className="rounded-xl bg-white/5 px-4 py-3"><div className="text-xs text-white/35">Avg score</div><div className="text-2xl font-black">{simulation.scoreStats.avg}</div></div>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div>
                        <div className="mb-2 text-xs font-black uppercase tracking-widest text-white/30">Top pairs</div>
                        <div className="space-y-2">
                          {simulation.pairs.slice(0, 10).map((pair: any) => (
                            <div key={`${pair.a.id}-${pair.b.id}`} className="rounded-xl bg-white/5 px-4 py-3 text-sm">
                              <span className="font-black">{pair.a.fullName}</span> × <span className="font-black">{pair.b.fullName}</span>
                              <span className="float-right text-aura font-black">{pair.finalScore}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-black uppercase tracking-widest text-white/30">Reject stats</div>
                        <div className="space-y-2">
                          {Object.entries(simulation.rejectStats).slice(0, 10).map(([reason, count]) => (
                            <div key={reason} className="rounded-xl bg-white/5 px-4 py-3 text-sm text-white/70">
                              {reason}<span className="float-right font-black text-white">{String(count)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </SectionCard>
        </div>
      ) : <div className="flex min-h-[40vh] items-center justify-center text-white/20">{t("admin.loading")}</div>}
    </main>
  );
}
