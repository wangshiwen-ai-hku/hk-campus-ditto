import type { Locale } from "../types";

const LOCALES: Locale[] = ["en", "zh-HK", "zh-CN"];

export function WelcomePage({
  locale,
  onLocale,
  onContinue,
}: {
  locale: Locale;
  onLocale: (locale: Locale) => void;
  onContinue: () => void;
}) {
  const labels: Record<Locale, { name: string; title: string; desc: string; cta: string }> = {
    en: {
      name: "English",
      title: "Welcome to Aura HK",
      desc: "Choose your preferred language before entering. We will use it for the app experience and future match emails.",
      cta: "Enter Aura HK",
    },
    "zh-HK": {
      name: "繁體中文",
      title: "歡迎嚟到 Aura HK",
      desc: "請先選擇偏好語言。之後 App 體驗同配對電郵都會跟隨呢個設定。",
      cta: "進入 Aura HK",
    },
    "zh-CN": {
      name: "简体中文",
      title: "欢迎来到 Aura HK",
      desc: "请先选择偏好语言。之后 App 体验和匹配邮件都会使用这个设置。",
      cta: "进入 Aura HK",
    },
  };
  const content = labels[locale] ?? labels.en;

  return (
    <main className="min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,0,102,0.20),transparent_32%),radial-gradient(circle_at_72%_35%,rgba(56,189,248,0.16),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-5 py-16 text-center">
        <div className="mb-8 h-20 w-20 rounded-[28px] border border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl flex items-center justify-center">
          <span className="text-4xl font-black">A</span>
        </div>
        <div className="mb-4 text-xs font-black uppercase tracking-[0.45em] text-aura/80">Aura HK</div>
        <h1 className="max-w-3xl text-5xl font-black tracking-tight md:text-7xl">{content.title}</h1>
        <p className="mt-6 max-w-2xl text-base font-medium leading-relaxed text-white/55 md:text-lg">{content.desc}</p>

        <div className="mt-10 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
          {LOCALES.map((item) => {
            const active = item === locale;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onLocale(item)}
                className={`rounded-2xl border px-5 py-4 text-sm font-black transition-all ${
                  active
                    ? "border-aura/50 bg-aura text-white shadow-xl shadow-aura/25"
                    : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:bg-white/10 hover:text-white"
                }`}
              >
                {labels[item].name}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-10 rounded-2xl bg-white px-8 py-4 text-sm font-black text-black shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {content.cta}
        </button>
      </div>
    </main>
  );
}
