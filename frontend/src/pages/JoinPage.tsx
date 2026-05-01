import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { SectionCard } from "../components/SectionCard";
import { TagSelector } from "../components/TagSelector";
import { setStoredToken } from "../lib/session";
import type { Question, QuestionGroup } from "../types";

const DEV_ENABLED = import.meta.env.DEV && Boolean(import.meta.env.VITE_ADMIN_SECRET);

const SLOTS = ["wed_eve", "thu_eve", "fri_aft", "fri_eve", "sat_aft", "sun_aft"];
const TAGS = ["coffee", "cantopop", "art", "film", "night", "hiking", "citywalk", "supper", "tech", "thrifting"];
const VIBES = ["chill", "curious", "empathetic", "playful", "grounded", "creative", "ambitious", "warm"];
const LANGUAGES = ["english", "cantonese", "mandarin", "japanese", "korean"];

type Step = "account" | "profile" | string | "done";

function flowSteps(groups: QuestionGroup[]) {
  return ["account", "profile", ...groups.map((group) => group.template), "done"];
}

function stepIndex(step: Step, groups: QuestionGroup[]) {
  return flowSteps(groups).indexOf(step);
}

function nextStep(step: Step, groups: QuestionGroup[]): Step {
  const steps = flowSteps(groups);
  const idx = steps.indexOf(step);
  return steps[idx + 1] ?? "done";
}

function defaultAnswer(q: Question): unknown {
  if (q.defaultValue !== undefined) return q.defaultValue;
  if (q.kind === "multi" || q.kind === "photos") return [];
  if (q.kind === "scale" || q.kind === "number") return q.min ?? 5;
  if (q.kind === "range") return { min: q.min ?? 18, max: Math.min(q.max ?? 60, 28) };
  return "";
}

function cleanAnswers(group: QuestionGroup, answers: Record<string, unknown>) {
  return Object.fromEntries(
    group.questions.map((q) => [q.id, answers[q.id] ?? defaultAnswer(q)])
  );
}

function toggleAnswer(current: unknown, option: string) {
  const values = Array.isArray(current) ? current.filter((x) => typeof x === "string") as string[] : [];
  return values.includes(option) ? values.filter((x) => x !== option) : [...values, option];
}

const MAX_PHOTO_EDGE = 1200;
const PHOTO_JPEG_QUALITY = 0.78;

async function fileToCompressedDataUrl(file: File): Promise<string> {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to load image."));
    });
    image.src = source;
    await loaded;

    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to compress image.");
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(source);
  }
}

async function filesToDataUrls(files: FileList, limit: number): Promise<string[]> {
  const selected = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, limit);
  return Promise.all(selected.map(fileToCompressedDataUrl));
}

function QuestionField({
  question,
  value,
  onChange,
  t,
}: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const prompt = (
    <>
      {question.promptKey ? t(question.promptKey) : question.prompt ?? question.id}
      {question.required && <span className="ml-1 text-pink-400">*</span>}
    </>
  );
  const why = question.whyItMattersKey ? t(question.whyItMattersKey) : question.whyItMatters ?? "";
  const options = question.optionsKeys ?? question.options ?? [];
  const photos = Array.isArray(value) ? value.filter((x) => typeof x === "string") as string[] : [];
  const rangeValue = typeof value === "object" && value !== null && "min" in value && "max" in value
    ? value as { min: number; max: number }
    : { min: question.min ?? 18, max: Math.min(question.max ?? 60, 28) };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-lg font-black text-white">{prompt}</div>
      <div className="mt-1 text-sm text-white/45">{why}</div>

      {question.kind === "text" || question.kind === "date" ? (
        <textarea
          className="mt-4 min-h-[92px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none transition-all focus:ring-2 focus:ring-aura/50"
          rows={question.kind === "date" ? 1 : 3}
          value={typeof value === "string" ? value : ""}
          placeholder={question.kind === "date" ? "YYYY-MM-DD" : (question.placeholderKey ? t(question.placeholderKey) : "")}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}

      {question.kind === "single" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {options.map((option) => {
            const active = value === option;
            return (
              <button
                type="button"
                key={option}
                onClick={() => onChange(option)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${active ? "bg-aura text-white" : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
              >
                {question.optionsKeys ? t(option) : option}
              </button>
            );
          })}
        </div>
      ) : null}

      {question.kind === "multi" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {options.map((option) => {
            const active = Array.isArray(value) && value.includes(option);
            return (
              <button
                type="button"
                key={option}
                onClick={() => onChange(toggleAnswer(value, option))}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${active ? "bg-aura text-white" : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
              >
                {question.optionsKeys ? t(option) : option}
              </button>
            );
          })}
        </div>
      ) : null}

      {question.kind === "scale" || question.kind === "number" ? (
        <input
          className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50"
          type="number"
          min={question.min ?? 1}
          max={question.max ?? 10}
          value={typeof value === "number" ? value : question.min ?? 5}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      ) : null}

      {question.kind === "range" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-white/50">
            Min
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50"
              type="number"
              min={question.min ?? 18}
              max={rangeValue.max}
              value={rangeValue.min}
              onChange={(e) => onChange({ ...rangeValue, min: Number(e.target.value) })}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-white/50">
            Max
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50"
              type="number"
              min={rangeValue.min}
              max={question.max ?? 60}
              value={rangeValue.max}
              onChange={(e) => onChange({ ...rangeValue, max: Number(e.target.value) })}
            />
          </label>
        </div>
      ) : null}

      {question.kind === "photos" ? (
        <div className="mt-4 grid gap-4">
          <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-5 py-8 text-center transition-all hover:bg-white/[0.06]">
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              multiple
              onChange={async (e) => {
                if (!e.target.files) return;
                const next = await filesToDataUrls(e.target.files, Math.max((question.max ?? 5) - photos.length, 0));
                onChange([...photos, ...next].slice(0, question.max ?? 5));
                e.target.value = "";
              }}
            />
            <span className="text-base font-black text-white">{t("join.dev.uploadPhotos")}</span>
            <span className="mt-2 text-sm text-white/45">{t("join.dev.uploadPhotosHint", { count: question.max ?? 5 })}</span>
          </label>
          {photos.length ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {photos.map((photo, index) => (
                <div key={`${photo.slice(0, 32)}-${index}`} className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <img className="h-full w-full object-cover" src={photo} alt="" />
                  <button
                    type="button"
                    className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => onChange(photos.filter((_, i) => i !== index))}
                  >
                    {t("join.dev.remove")}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function JoinPage({ userId, onUser }: { userId: string | null; onUser: (id: string) => void; }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(userId ? "profile" : "account");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState(`local-${Date.now()}@connect.hku.hk`);
  const [fullName, setFullName] = useState("Local Test");
  const [inviteCode, setInviteCode] = useState("DITTO-HK-001");
  const [code, setCode] = useState("");
  const [profileId, setProfileId] = useState(userId ?? "");

  const [degreeLevel, setDegreeLevel] = useState("");
  const [grade, setGrade] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>(["english", "cantonese"]);
  const [interests, setInterests] = useState<string[]>(["coffee", "hiking", "citywalk"]);
  const [vibeTags, setVibeTags] = useState<string[]>(["chill", "empathetic", "grounded"]);
  const [availability, setAvailability] = useState<string[]>(["fri_eve", "sat_aft"]);
  const [crossUniOk, setCrossUniOk] = useState(true);

  const [groups, setGroups] = useState<QuestionGroup[]>([]);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    api.getQuestions()
      .then((data) => {
        const loaded = (data as { groups: QuestionGroup[] }).groups;
        setGroups(loaded);
        setAnswers(Object.fromEntries(loaded.map((group) => [
          group.template,
          Object.fromEntries(group.questions.map((q) => [q.id, defaultAnswer(q)])),
        ])));
        setStep((prev) => flowSteps(loaded).includes(prev) ? prev : loaded[0]?.template ?? "profile");
      })
      .catch((e) => setMessage(e.message));
  }, []);

  const currentGroup = useMemo(
    () => groups.find((group) => group.template === step),
    [groups, step]
  );

  function acceptSession(data: { token: string; user: { id: string; fullName?: string; email?: string } }) {
    setStoredToken(data.token);
    setProfileId(data.user.id);
    onUser(data.user.id);
    if (data.user.fullName) setFullName(data.user.fullName);
    if (data.user.email) setEmail(data.user.email);
  }

  async function createDevUser() {
    setLoading(true);
    setMessage("");
    try {
      const data = await api.createDevUser({ email, fullName, universityId: "hku", stage: "basic" });
      acceptSession(data);
      setStep("profile");
      setMessage(t("join.dev.userCreated"));
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function requestCode() {
    setLoading(true);
    setMessage("");
    try {
      const data = await api.requestCode(email) as { devCode?: string };
      setMessage(data.devCode ? t("join.demoCodeMsg", { code: data.devCode }) : t("join.dev.codeSent"));
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setLoading(true);
    setMessage("");
    try {
      const data = await api.verifyCode(email, code, fullName, inviteCode);
      acceptSession(data);
      setStep("profile");
      setMessage(t("join.dev.signedIn"));
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!profileId) {
      setMessage("Create or verify a user first.");
      return;
    }
    if (!fullName || !degreeLevel || !grade || !faculty || !bio || languages.length === 0 || interests.length === 0 || vibeTags.length === 0 || availability.length === 0) {
      alert(t("join.errors.required"));
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await api.saveProfile({
        fullName,
        yearOfStudy: `${degreeLevel} - ${grade}`,
        major: department ? `${faculty} - ${department}` : faculty,
        gender: "Prefer not to say",
        seeking: "Meaningful connection",
        bio,
        languages,
        interests,
        vibeTags,
        dealBreakers: [],
        optedIn: true,
        crossUniOk,
        availability,
      });
      setStep(groups[0]?.template ?? "done");
      setMessage(t("join.dev.profileSaved"));
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitCurrentSurvey() {
    if (!currentGroup) return;
    
    // Validate required fields
    const missingRequired = currentGroup.questions.find((q) => {
      if (q.required) {
        const val = (answers[currentGroup.template] ?? {})[q.id];
        if (val === undefined || val === null || val === "") return true;
        if (Array.isArray(val) && val.length === 0) return true;
      }
      return false;
    });
    
    if (missingRequired) {
      alert(t("join.errors.required"));
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await api.submitSurvey(currentGroup.template, cleanAnswers(currentGroup, answers[currentGroup.template] ?? {}));
      const next = nextStep(step, groups);
      setStep(next);
      setMessage(next === "done" ? t("join.dev.completeMsg") : t("join.dev.sectionSaved"));
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  function setQuestionAnswer(group: QuestionGroup, questionId: string, value: unknown) {
    setAnswers((prev) => ({
      ...prev,
      [group.template]: {
        ...(prev[group.template] ?? {}),
        [questionId]: value,
      },
    }));
  }

  function goToStep(target: Step) {
    if (!flowSteps(groups).includes(target)) return;
    setStep(target);
    setMessage("");
  }

  function goBack() {
    const steps = flowSteps(groups);
    const idx = stepIndex(step, groups);
    if (idx > 0) goToStep(steps[idx - 1]);
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 text-xs font-black uppercase tracking-[0.4em] text-aura">{t("join.dev.eyebrow")}</div>
          <h1 className="text-3xl font-black md:text-4xl">{t("join.dev.title")}</h1>
          <p className="mt-3 max-w-2xl text-white/50">{t("join.dev.subtitle")}</p>
        </div>
        <Link to="/student" className="shrink-0 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-center font-bold text-white hover:bg-white/10">
          {t("join.dev.studentDashboard")}
        </Link>
      </div>

      <div className="mb-10 relative">
        <div className="flex items-center gap-2 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x">
          {flowSteps(groups).map((item, index) => {
            const group = groups.find((g) => g.template === item);
            const label = item === "account"
              ? t("join.dev.account")
              : item === "profile"
              ? t("join.dev.profile")
              : item === "done"
              ? t("join.dev.done")
              : group?.titleKey
              ? t(group.titleKey)
              : group?.title ?? item;
            const active = index === stepIndex(step, groups);
            const complete = index < stepIndex(step, groups);
            return (
              <div key={item} className="flex items-center gap-2 shrink-0 snap-start">
                <button
                  type="button"
                  disabled={index > stepIndex(step, groups)}
                  onClick={() => goToStep(item)}
                  className={`relative flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300 disabled:cursor-not-allowed ${
                    active 
                      ? "bg-aura text-white shadow-[0_0_15px_rgba(var(--color-aura),0.4)] border border-aura/50" 
                      : complete 
                      ? "bg-white/10 text-white hover:bg-white/20 border border-white/10" 
                      : "bg-transparent text-white/30 border border-white/10"
                  }`}
                >
                  {complete && !active && (
                    <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {label}
                </button>
                {index < flowSteps(groups).length - 1 && (
                  <div className={`h-px w-6 sm:w-10 transition-colors ${complete ? "bg-aura/50" : "bg-white/10"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <SectionCard className="w-full">
          {step === "account" ? (
            <div className="grid gap-6">
              <div>
                <h2 className="text-2xl font-black">{t("join.dev.account")}</h2>
                <p className="mt-2 text-white/50">{t("join.dev.accountDesc")}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-white/50">
                  <span>{t("join.emailLabel")} <span className="text-pink-400">*</span></span>
                  <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-bold text-white/50">
                  <span>{t("join.nameLabel")} <span className="text-pink-400">*</span></span>
                  <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-bold text-white/50">
                  <span>{t("join.dev.inviteCode")} <span className="text-pink-400">*</span></span>
                  <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-bold text-white/50">
                  <span>{t("join.verifyCodeLabel")} <span className="text-pink-400">*</span></span>
                  <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50" value={code} onChange={(e) => setCode(e.target.value)} />
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                {stepIndex(step, groups) > 0 ? (
                  <button className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-bold text-white hover:bg-white/10" type="button" onClick={goBack}>{t("join.dev.back")}</button>
                ) : null}
                <button className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-bold text-white hover:bg-white/10 disabled:opacity-50" disabled={loading} onClick={requestCode}>{t("join.sendCode")}</button>
                <button className="rounded-full bg-white px-6 py-3 font-black text-black disabled:opacity-50" disabled={loading} onClick={verify}>{t("join.dev.verifyContinue")}</button>
              </div>
            </div>
          ) : null}

          {step === "profile" ? (
            <div className="grid gap-7">
              <div>
                <h2 className="text-2xl font-black">{t("join.dev.profileBasics")}</h2>
                <p className="mt-2 text-white/50">{t("join.dev.profileDesc")}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-white/50 md:col-span-2">
                  <span>{t("join.nameLabel")} <span className="text-pink-400">*</span></span>
                  <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("join.placeholders.fullName")} />
                </label>
                <label className="grid gap-2 text-sm font-bold text-white/50">
                  <span>{t("join.degreeLevel")} <span className="text-pink-400">*</span></span>
                  <select className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50" value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value)}>
                    <option value="" disabled>{t("join.placeholders.select")}</option>
                    <option value="Undergraduate">{t("join.degrees.undergrad")}</option>
                    <option value="Taught Master">{t("join.degrees.taught_master")}</option>
                    <option value="MPhil / PhD">{t("join.degrees.mphil_phd")}</option>
                    <option value="Other">{t("join.degrees.other")}</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-white/50">
                  <span>{t("join.grade")} <span className="text-pink-400">*</span></span>
                  <select className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50" value={grade} onChange={(e) => setGrade(e.target.value)}>
                    <option value="" disabled>{t("join.placeholders.select")}</option>
                    <option value="Year 1">{t("join.grades.y1")}</option>
                    <option value="Year 2">{t("join.grades.y2")}</option>
                    <option value="Year 3">{t("join.grades.y3")}</option>
                    <option value="Year 4">{t("join.grades.y4")}</option>
                    <option value="Year 5+">{t("join.grades.y5_plus")}</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-white/50">
                  <span>{t("join.faculty")} <span className="text-pink-400">*</span></span>
                  <select className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50" value={faculty} onChange={(e) => setFaculty(e.target.value)}>
                    <option value="" disabled>{t("join.placeholders.select")}</option>
                    <option value="Arts / Humanities">{t("join.faculties.arts")}</option>
                    <option value="Business / Economics">{t("join.faculties.business")}</option>
                    <option value="Engineering">{t("join.faculties.engineering")}</option>
                    <option value="Science">{t("join.faculties.science")}</option>
                    <option value="Social Sciences">{t("join.faculties.social")}</option>
                    <option value="Medicine / Health">{t("join.faculties.medicine")}</option>
                    <option value="Law">{t("join.faculties.law")}</option>
                    <option value="Architecture / Design">{t("join.faculties.architecture")}</option>
                    <option value="Education">{t("join.faculties.education")}</option>
                    <option value="Other">{t("join.faculties.other")}</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-white/50">
                  <span>{t("join.department")} <span className="text-pink-400">*</span></span>
                  <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors [&>option]:bg-[#0f172a] outline-none focus:ring-2 focus:ring-aura/50" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder={t("join.placeholders.major")} />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-bold text-white/50">
                <span>{t("join.bioLabel")} <span className="text-pink-400">*</span></span>
                <textarea className="min-h-[110px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 hover:bg-white/10 transition-colors outline-none focus:ring-2 focus:ring-aura/50" value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("join.placeholders.bio")} />
              </label>
              <div className="space-y-7">
                <TagSelector title={<span>{t("join.languages")} <span className="text-pink-400">*</span></span>} items={LANGUAGES} values={languages} setValues={setLanguages} renderLabel={(item) => t(`join.langs.${item}`)} />
                <TagSelector title={<span>{t("join.interests")} <span className="text-pink-400">*</span></span>} items={TAGS} values={interests} setValues={setInterests} renderLabel={(item) => t(`join.tags.${item}`)} />
                <TagSelector title={<span>{t("join.dev.vibeTags")} <span className="text-pink-400">*</span></span>} items={VIBES} values={vibeTags} setValues={setVibeTags} renderLabel={(item) => t(`join.vibes.${item}`)} />
                <TagSelector title={<span>{t("join.availability")} <span className="text-pink-400">*</span></span>} items={SLOTS} values={availability} setValues={setAvailability} renderLabel={(item) => t(`join.slots.${item}`)} />
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/70">
                <input type="checkbox" checked={crossUniOk} onChange={(e) => setCrossUniOk(e.target.checked)} />
                {t("join.dev.crossCampus")}
              </label>
              <div className="flex flex-wrap gap-3">
                {stepIndex(step, groups) > 0 ? (
                  <button className="rounded-full border border-white/10 bg-white/5 px-8 py-4 font-bold text-white hover:bg-white/10" type="button" onClick={goBack}>{t("join.dev.back")}</button>
                ) : null}
                <button className="rounded-full bg-aura px-8 py-4 font-black text-white disabled:opacity-50" disabled={loading || !profileId} onClick={saveProfile}>{t("join.dev.saveProfileContinue")}</button>
              </div>
            </div>
          ) : null}

          {currentGroup ? (
            <div className="grid gap-6">
              <div>
                <h2 className="text-2xl font-black">{currentGroup.titleKey ? t(currentGroup.titleKey) : currentGroup.title}</h2>
                <p className="mt-2 text-white/50">{currentGroup.descriptionKey ? t(currentGroup.descriptionKey) : currentGroup.description}</p>
              </div>
              <div className="grid gap-4">
                {currentGroup.questions.map((question) => (
                  <QuestionField
                    key={question.id}
                    question={question}
                    value={answers[currentGroup.template]?.[question.id] ?? defaultAnswer(question)}
                    onChange={(value) => setQuestionAnswer(currentGroup, question.id, value)}
                    t={t}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                {stepIndex(step, groups) > 0 ? (
                  <button className="rounded-full border border-white/10 bg-white/5 px-8 py-4 font-bold text-white hover:bg-white/10" type="button" onClick={goBack}>{t("join.dev.back")}</button>
                ) : null}
                <button className="rounded-full bg-aura px-8 py-4 font-black text-white disabled:opacity-50" disabled={loading} onClick={submitCurrentSurvey}>
                  {t("join.dev.saveSection", { section: currentGroup.titleKey ? t(currentGroup.titleKey) : currentGroup.title })}
                </button>
              </div>
            </div>
          ) : null}

          {step === "done" ? (
            <div className="grid gap-5 text-center">
              <h2 className="text-3xl font-black">{t("join.dev.completeTitle")}</h2>
              <p className="mx-auto max-w-xl text-white/55">{t("join.dev.completeDesc")}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link className="rounded-full bg-aura px-8 py-4 font-black text-white" to="/admin">{t("join.dev.runMatchAdmin")}</Link>
                <Link className="rounded-full border border-white/10 bg-white/5 px-8 py-4 font-bold text-white hover:bg-white/10" to="/student">{t("join.dev.openStudent")}</Link>
              </div>
            </div>
          ) : null}

          {message ? (
            <div className="mt-8 rounded-2xl border border-aura/30 bg-aura/15 px-4 py-3 text-center text-sm text-pink-100">
              {message}
            </div>
          ) : null}
        </SectionCard>

        {/* Development Session Info */}
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            <div className="text-xs font-black uppercase tracking-[0.25em] text-white/30">{t("join.dev.session")}</div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3 text-sm text-white/60">
              <div>{t("join.dev.user")}: <span className="font-bold text-white">{profileId || t("join.dev.notSignedIn")}</span></div>
              <div>{t("join.dev.email")}: <span className="font-bold text-white break-all">{email}</span></div>
              <div>{t("join.dev.mode")}: <span className="font-bold text-white">{DEV_ENABLED ? t("join.dev.devMode") : t("join.dev.prodMode")}</span></div>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-2 sm:flex-row sm:items-start md:justify-end">
              {DEV_ENABLED ? (
                <button
                  className="rounded-full bg-aura px-6 py-3 text-sm font-black text-white transition-all hover:scale-[1.02] disabled:opacity-50"
                  disabled={loading}
                  onClick={createDevUser}
                >
                  {t("join.dev.createUser")}
                </button>
              ) : null}
              <button
                className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-white/10"
                onClick={() => navigate("/admin")}
              >
                {t("join.dev.openAdmin")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
