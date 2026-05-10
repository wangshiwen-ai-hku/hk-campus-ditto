import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, MessageSquare, X } from "lucide-react";
import { api } from "../lib/api";
import { SectionCard } from "../components/SectionCard";
import { TagSelector } from "../components/TagSelector";
import { setStoredToken } from "../lib/session";
import { AiChatSidebar } from "../components/AiChatSidebar";
import type { Question, QuestionGroup } from "../types";

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
        <div className="mt-4 flex flex-wrap gap-3">
          {options.map((option) => {
            const active = value === option;
            return (
              <button
                type="button"
                key={option}
                onClick={() => onChange(option)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${active ? "bg-aura/90 text-white shadow-lg shadow-aura/20" : "border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"}`}
              >
                {question.optionsKeys ? t(option) : option}
              </button>
            );
          })}
        </div>
      ) : null}

      {question.kind === "multi" ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {options.map((option) => {
            const active = Array.isArray(value) && value.includes(option);
            return (
              <button
                type="button"
                key={option}
                onClick={() => onChange(toggleAnswer(value, option))}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${active ? "bg-aura/90 text-white shadow-lg shadow-aura/20" : "border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"}`}
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
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<Step>(userId ? "profile" : "account");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);
  const [ldfrCard, setLdfrCard] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
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

  // Pre-populate form fields with existing profile data
  useEffect(() => {
    if (!userId) return;
    api.getProfile(userId).then((data: any) => {
      if (!data) return;
      if (data.fullName) setFullName(data.fullName);
      if (data.email) setEmail(data.email);
      if (data.bio) setBio(data.bio);
      if (data.languages?.length) setLanguages(data.languages);
      if (data.interests?.length) setInterests(data.interests);
      if (data.vibeTags?.length) setVibeTags(data.vibeTags);
      if (data.availability?.length) setAvailability(data.availability);
      if (data.crossUniOk !== undefined) setCrossUniOk(data.crossUniOk);
      // Parse "degreeLevel - grade" from yearOfStudy
      if (data.yearOfStudy) {
        const parts = data.yearOfStudy.split(" - ");
        if (parts.length >= 2) {
          setDegreeLevel(parts[0].trim());
          setGrade(parts.slice(1).join(" - ").trim());
        } else {
          setDegreeLevel(data.yearOfStudy);
        }
      }
      // Parse "faculty - department" from major
      if (data.major) {
        const parts = data.major.split(" - ");
        if (parts.length >= 2) {
          setFaculty(parts[0].trim());
          setDepartment(parts.slice(1).join(" - ").trim());
        } else {
          setFaculty(data.major);
        }
      }
    }).catch(() => {});
  }, [userId]);

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

  async function requestCode() {
    setLoading(true);
    setMessage("");
    try {
      await api.requestCode(email);
      setMessage(t("join.dev.codeSent"));
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
      
      if (currentGroup.template === "onboarding_ldfr") {
        api.ldfrAnalyze(answers[currentGroup.template], i18n.language).then(card => setLdfrCard(card)).catch(() => {});
      }

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
    const emojis = ["🫧", "✨"];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const id = Date.now().toString() + Math.random();
    setFloatingEmojis(prev => [...prev, { id, emoji, x: 10 + Math.random() * 80, y: 10 }]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2000);
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
    <div className="relative min-h-screen overflow-x-hidden bg-[#020617]">
      <style>{`
        @keyframes floatUpAndFade {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          20% { transform: translateY(-20px) scale(1.1); opacity: 0.6; }
          50% { transform: translateY(-60px) scale(0.9); opacity: 0.8; }
          100% { transform: translateY(-120px) scale(1); opacity: 0; }
        }
        .animate-float-up {
          animation: floatUpAndFade 2s ease-out forwards;
        }
      `}</style>
      {floatingEmojis.map(e => (
        <div key={e.id} className="fixed z-50 animate-float-up pointer-events-none text-4xl font-bold drop-shadow-lg" style={{ left: `${e.x}%`, bottom: `${e.y}%` }}>
          {e.emoji}
        </div>
      ))}
      {/* Main Content Wrapper */}
      <div className={`transition-all duration-500 ease-in-out ${isChatOpen ? "md:pr-[400px]" : ""}`}>
        {/* Refined Hero Section with Collage Background */}
        <header className="relative pt-32 pb-24 px-5 border-b border-white/[0.05] overflow-hidden">
        {/* Puzzle Collage Background - Clearer Visibility */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 gap-4 p-8 opacity-80 scale-110">
            <div className="col-span-2 row-span-2 overflow-hidden rounded-[2rem] border border-white/20 shadow-2xl -rotate-2 transform hover:rotate-0 transition-transform duration-700">
              <img src="/assets/hero1.png" className="h-full w-full object-cover brightness-110" alt="" />
            </div>
            <div className="col-span-2 row-span-1 overflow-hidden rounded-[2rem] border border-white/20 shadow-2xl rotate-1 transform hover:rotate-0 transition-transform duration-700">
              <img src="/assets/hero2.png" className="h-full w-full object-cover brightness-110" alt="" />
            </div>
            <div className="col-span-1 row-span-1 overflow-hidden rounded-[2rem] border border-white/20 shadow-2xl -rotate-1 transform hover:rotate-0 transition-transform duration-700">
              <img src="/assets/hero3.png" className="h-full w-full object-cover brightness-110" alt="" />
            </div>
            <div className="col-span-1 row-span-1 overflow-hidden rounded-[2rem] border border-white/20 shadow-2xl rotate-3 transform hover:rotate-0 transition-transform duration-700">
              <img src="/assets/hero4.png" className="h-full w-full object-cover brightness-110" alt="" />
            </div>
          </div>
          
          {/* Frosted Glass Overlay - Further Lightened */}
          <div className="absolute inset-0 bg-[#020617]/30 backdrop-blur-md" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/30 to-[#020617]" />
        </div>

        {/* Refined & Centered Typography Header */}
        <div className="mx-auto max-w-4xl flex flex-col items-center text-center relative z-20">
          {/* Subtle central glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-aura/20 blur-[150px] rounded-full pointer-events-none -z-10" />

          <div className="mb-8 flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-gradient-to-r from-transparent via-aura/40 to-transparent" />
            <span className="text-xs font-black uppercase tracking-[0.5em] text-aura/90">
              {t("join.dev.eyebrow")}
            </span>
            <span className="h-px w-12 bg-gradient-to-r from-transparent via-aura/40 to-transparent" />
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-8xl tracking-tighter text-white mb-8 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <span className="font-romantic font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              {t("join.dev.title").split(" ")[0]}
            </span>{" "}
            <span className="font-romantic italic bg-gradient-to-r from-aura via-pink-400 to-aura bg-clip-text text-transparent">
              {t("join.dev.title").split(" ")[1] || "Ditto"}
            </span>
          </h1>

          <p className="max-w-2xl text-lg md:text-xl font-medium leading-relaxed text-white/60 mb-12">
            {t("join.dev.subtitle")}
          </p>

          <Link 
            to="/student" 
            className="group flex items-center gap-4 rounded-full border border-white/20 bg-white/10 px-8 py-4 transition-all duration-500 hover:bg-white/20 hover:border-white/30 hover:shadow-[0_0_40px_rgba(255,0,102,0.15)] active:scale-95 backdrop-blur-md"
          >
            <span className="text-sm font-black uppercase tracking-[0.2em] text-white transition-colors">
              {t("join.dev.studentDashboard")}
            </span>
            <svg className="h-5 w-5 text-aura transition-all group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 relative z-10">

        <div className="mb-16 relative">
          {/* Romantic Background Decor for Stepper */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-aura/10 via-transparent to-harbour/10 blur-[100px] opacity-40" />
          
          <div className="flex items-center gap-2 overflow-x-auto pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x px-4">
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
              <div key={item} className="flex items-center gap-3 shrink-0 snap-start">
                <div className="relative">
                  {/* Floating Hearts for Active Step */}
                  {active && (
                    <div className="absolute inset-0 -top-8 pointer-events-none">
                      <Heart size={12} className="absolute left-1/4 text-pink-400 animate-heart-float fill-pink-400/30" style={{ animationDelay: "0s" }} />
                      <Heart size={16} className="absolute left-1/2 text-aura animate-heart-float fill-aura/40" style={{ animationDelay: "1.2s" }} />
                      <Heart size={10} className="absolute left-3/4 text-pink-300 animate-heart-float fill-pink-300/20" style={{ animationDelay: "2.4s" }} />
                    </div>
                  )}
                  
                  <button
                    type="button"
                    disabled={index > stepIndex(step, groups)}
                    onClick={() => goToStep(item)}
                    className={`relative flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold transition-all duration-500 disabled:cursor-not-allowed group ${
                      active 
                        ? "bg-gradient-to-br from-aura to-pink-500 text-white shadow-[0_10px_25px_-5px_rgba(255,0,102,0.4)] border border-aura/50 scale-105" 
                        : complete 
                        ? "bg-aura/10 text-aura hover:bg-aura/20 border border-aura/20" 
                        : "bg-white/5 text-white/30 border border-white/10 hover:border-white/20"
                    }`}
                  >
                    {complete && !active && (
                      <Heart size={14} className="mr-2 fill-aura text-aura animate-pulse" />
                    )}
                    {!complete && active && (
                      <div className="mr-2 h-2 w-2 rounded-full bg-white animate-ping" />
                    )}
                    {label}
                  </button>
                </div>
                
                {index < flowSteps(groups).length - 1 && (
                  <div className="flex items-center">
                    <div className={`h-[2px] w-8 sm:w-12 rounded-full transition-all duration-700 ${
                      complete ? "bg-gradient-to-r from-aura to-aura/20" : "bg-white/10"
                    }`} />
                    <Heart size={10} className={`ml-[-4px] transition-colors duration-700 ${complete ? "text-aura fill-aura/30" : "text-white/5"}`} />
                  </div>
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
                  <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-white hover:bg-white/10" type="button" onClick={goBack}>{t("join.dev.back")}</button>
                ) : null}
                <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-white hover:bg-white/10 disabled:opacity-50" disabled={loading} onClick={requestCode}>{t("join.sendCode")}</button>
                <button className="rounded-2xl bg-white px-6 py-3 font-black text-black disabled:opacity-50" disabled={loading} onClick={verify}>{t("join.dev.verifyContinue")}</button>
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
                  <button className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 font-bold text-white hover:bg-white/10" type="button" onClick={goBack}>{t("join.dev.back")}</button>
                ) : null}
                <button className="rounded-2xl bg-aura px-8 py-4 font-black text-white disabled:opacity-50" disabled={loading || !profileId} onClick={saveProfile}>{t("join.dev.saveProfileContinue")}</button>
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
                  <button className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 font-bold text-white hover:bg-white/10" type="button" onClick={goBack}>{t("join.dev.back")}</button>
                ) : null}
                <button className="rounded-2xl bg-aura px-8 py-4 font-black text-white disabled:opacity-50" disabled={loading} onClick={submitCurrentSurvey}>
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
                <Link className="rounded-2xl bg-aura px-8 py-4 font-black text-white" to="/student">{t("join.dev.openStudent")}</Link>
              </div>
            </div>
          ) : null}

          {message ? (
            <div className="mt-8 rounded-2xl border border-aura/30 bg-aura/15 px-4 py-3 text-center text-sm text-pink-100">
              {message}
            </div>
          ) : null}
        </SectionCard>

      </div>
    </main>
    </div>

    {/* AI Chat Sidebar */}
    <AiChatSidebar 
      isOpen={isChatOpen} 
      onClose={() => setIsChatOpen(false)} 
      currentGroup={currentGroup} 
      answers={currentGroup ? (answers[currentGroup.template] as Record<string, unknown> ?? {}) : {}}
      onAnswer={(qid, val) => currentGroup && setQuestionAnswer(currentGroup, qid, val)}
      language={i18n.language}
    />

    {/* Floating Chat Button */}
    {!isChatOpen && step !== "account" && step !== "done" && (
      <button 
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-8 right-8 z-40 p-4 rounded-full bg-gradient-to-tr from-aura to-pink-500 text-white shadow-[0_0_20px_rgba(255,0,102,0.4)] hover:scale-110 active:scale-95 transition-all animate-bounce hover:animate-none"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
      </button>
    )}

    {/* LDFR Card Modal */}
    {ldfrCard && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-md rounded-[2rem] bg-[#0f172a]/95 border border-white/20 p-8 shadow-2xl overflow-hidden backdrop-blur-xl text-center">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-aura/20 to-transparent blur-[50px]"></div>
          
          <button onClick={() => setLdfrCard(null)} className="absolute top-4 right-4 text-white/50 hover:text-white"><X /></button>
          
          <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${ldfrCard.code}&backgroundColor=020617`} alt="Avatar" className="w-32 h-32 mx-auto rounded-full border-4 border-aura/30 shadow-[0_0_20px_rgba(255,0,102,0.3)] mb-6" />
          
          <div className="inline-block px-3 py-1 bg-aura/20 border border-aura/50 rounded-full text-aura font-bold tracking-widest text-xs mb-2">{ldfrCard.code}</div>
          <h3 className="text-2xl font-black text-white mb-2">{ldfrCard.title}</h3>
          <p className="text-white/70 text-sm italic mb-6">"{ldfrCard.vibe}"</p>
          
          <div className="text-sm text-left text-white/80 space-y-4 mb-8 bg-white/5 p-4 rounded-xl border border-white/10">
            <p>{ldfrCard.analysis}</p>
            <div><strong className="text-aura">✨ Strengths:</strong> {ldfrCard.strengths?.join(", ")}</div>
            <div><strong className="text-pink-400">⚠️ Traps:</strong> {ldfrCard.traps?.join(", ")}</div>
            <div><strong className="text-green-400">☕ Ideal Date:</strong> {ldfrCard.idealDate}</div>
          </div>
          
          <button onClick={() => setLdfrCard(null)} className="w-full py-4 rounded-2xl bg-gradient-to-r from-aura to-pink-500 font-bold text-white shadow-lg hover:opacity-90 active:scale-95 transition-all text-lg">
            {t("join.dev.continue", "Continue")}
          </button>
        </div>
      </div>
    )}
    </div>
  );
}
