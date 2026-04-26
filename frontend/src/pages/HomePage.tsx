import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { countdown } from "../lib/utils";
import { Modal } from "../components/Modal";
import heroImg from "../assets/hero.png";
import galleryImg from "../assets/gallery.png";
import dateSpotImg from "../assets/date-spot.png";
import campusBg from "../assets/campus-bg.png";

export function HomePage({ onUser }: { onUser: (id: string) => void; }) {
  const { t } = useTranslation();
  const [meta, setMeta] = useState<any>(null);
  const [tick, setTick] = useState("");
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const STEPS = [
    { 
      step: "01", 
      title: t("home.steps.step1.title"), 
      desc: t("home.steps.step1.desc"), 
      example: t("home.steps.step1.example"),
      details: (
        <div className="space-y-4">
          <p className="text-white/60 text-lg italic">{t("home.steps.step1.detailQuote")}</p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-aura font-black tracking-tighter mb-1 uppercase text-xs">{t("home.steps.step1.interests")}</div>
                <div className="text-sm text-white/60">{t("home.steps.step1.interestsDesc")}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-aura font-black tracking-tighter mb-1 uppercase text-xs">{t("home.steps.step1.vibeTags")}</div>
                <div className="text-sm text-white/60">{t("home.steps.step1.vibeTagsDesc")}</div>
            </div>
          </div>
          <p className="text-xs text-white/20 italic pt-4">{t("home.steps.step1.encryptionNote")}</p>
        </div>
      )
    },
    { 
      step: "02", 
      title: t("home.steps.step2.title"), 
      desc: t("home.steps.step2.desc"), 
      example: t("home.steps.step2.example"),
      details: (
        <div className="space-y-4">
          <p className="text-white/60 text-lg italic">{t("home.steps.step2.detailQuote")}</p>
          <div className="bg-aura/10 p-6 rounded-3xl border border-aura/20 text-center my-6">
             <div className="text-sm font-black text-aura uppercase tracking-widest mb-2">{t("home.steps.step2.algoFocus")}</div>
             <div className="text-2xl font-black text-white italic font-romantic">{t("home.steps.step2.algoFocusDesc")}</div>
          </div>
          <p className="text-white/40 text-sm italic">{t("home.steps.step2.userQuote")}</p>
        </div>
      )
    },
    { 
      step: "03", 
      title: t("home.steps.step3.title"), 
      desc: t("home.steps.step3.desc"), 
      example: t("home.steps.step3.example"),
      details: (
        <div className="space-y-4">
          <p className="text-white/60 text-lg italic">{t("home.steps.step3.detailQuote")}</p>
          <ul className="space-y-4 mt-6">
             <li className="flex gap-4 items-center">
                <div className="h-6 w-6 rounded-full bg-aura/20 flex items-center justify-center text-aura text-xs">✔</div>
                <span className="text-white/70">{t("home.steps.step3.check1")}</span>
             </li>
             <li className="flex gap-4 items-center">
                <div className="h-6 w-6 rounded-full bg-aura/20 flex items-center justify-center text-aura text-xs">✔</div>
                <span className="text-white/70">{t("home.steps.step3.check2")}</span>
             </li>
             <li className="flex gap-4 items-center">
                <div className="h-6 w-6 rounded-full bg-aura/20 flex items-center justify-center text-aura text-xs">✔</div>
                <span className="text-white/70">{t("home.steps.step3.check3")}</span>
             </li>
          </ul>
        </div>
      )
    },
    { 
      step: "04", 
      title: t("home.steps.step4.title"), 
      desc: t("home.steps.step4.desc"), 
      example: t("home.steps.step4.example"),
      details: (
        <div className="space-y-4">
          <p className="text-white/60 text-lg italic">{t("home.steps.step4.detailQuote")}</p>
          <div className="flex gap-4 my-8">
             <div className="flex-1 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
                <span className="text-3xl mb-2 block">💖</span>
                <span className="text-xs font-black text-green-400 uppercase tracking-tighter">{t("home.steps.step4.match")}</span>
             </div>
             <div className="flex-1 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
                <span className="text-3xl mb-2 block">🤝</span>
                <span className="text-xs font-black text-blue-400 uppercase tracking-tighter">{t("home.steps.step4.friends")}</span>
             </div>
             <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/10 text-center opacity-40">
                <span className="text-3xl mb-2 block">♻</span>
                <span className="text-xs font-black uppercase tracking-tighter">{t("home.steps.step4.retry")}</span>
             </div>
          </div>
          <p className="text-white/40 text-sm italic">{t("home.steps.step4.userQuote")}</p>
        </div>
      )
    }
  ];

  useEffect(() => {
    api.getMeta().then(setMeta).catch(console.error);
    const itv = setInterval(() => {
      if (meta?.nextDrop) setTick(countdown(meta.nextDrop));
    }, 1000);
    return () => clearInterval(itv);
  }, [meta?.nextDrop]);

  return (
    <div className="relative overflow-hidden pb-32 bg-mesh bg-noise min-h-screen">
      {/* Frosted Fixed Background */}
      <img src={campusBg} className="frosted-bg" alt="" aria-hidden="true" />
      
      {/* Subtle Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[-15] opacity-20 bg-noise" />

      {/* Hero Section */}
      <section className="mx-auto max-w-5xl px-5 pt-20 text-center">
        <div className="mb-10 space-y-0">
          <h2 className="animate-float text-3xl font-romantic italic text-white/90 drop-shadow-md">{t("home.hero.getADate")}</h2>
          <h1 className="text-[15vw] md:text-[120px] font-black tracking-tighter leading-none text-white my-[-10px] text-neon font-romantic italic">
            {t("home.hero.wednesday")}
          </h1>
          <div className="relative inline-block mt-4">
            <h3 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white opacity-90 drop-shadow-lg font-romantic">
              {t("home.hero.atYourSchool")}
            </h3>
            <div className="absolute bottom-[-5px] left-0 right-0 h-1 bg-aura rounded-full opacity-50" />
          </div>
        </div>

        <div className="relative mx-auto mb-10 max-w-sm">
          <div className="aspect-[3.5/4.5] overflow-hidden rounded-[32px] border-[10px] border-white bg-white p-1 shadow-2xl rotate-[-1deg] transition-transform hover:rotate-0 hover:scale-[1.03]">
            <img src={heroImg} alt="HKU Couple" className="h-full w-full rounded-[20px] object-cover" />
          </div>
          <div className="absolute top-[10%] left-[-15%] rotate-[-20deg] text-aura drop-shadow-lg animate-pulse">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        </div>

        <div className="mb-12">
          <div className="text-[12vw] md:text-[80px] font-black italic tabular-nums text-aura drop-shadow-[0_0_20px_rgba(255,0,102,0.4)] font-romantic">
            {tick || "00:00:00:00"}
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-sm font-black text-white/40 uppercase tracking-widest">{t("home.hero.nextDrop")}</div>
          </div>
        </div>

        <Link to="/join" className="group relative inline-flex items-center gap-3 rounded-full bg-white px-10 py-5 text-xl font-black text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
          {t("home.hero.joinDrop")}
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </section>

      {/* Marquee Ticker */}
      <div className="mt-32 border-y border-white/5 bg-white/5 py-4 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block">
          {[...Array(10)].map((_, i) => (
            <span key={i} className="mx-8 text-sm font-bold uppercase tracking-[0.3em] text-white/30">
              {t("home.stats", { students: meta?.stats.students ?? '147,068', dates: meta?.stats.scheduledDates ?? '12,402' })} 
            </span>
          ))}
        </div>
      </div>

      {/* Why Aura Section */}
      <section className="mx-auto mt-40 max-w-6xl px-5 text-center">
        <div className="mb-20 inline-block rounded-full border border-aura/30 bg-aura/10 px-6 py-2 text-sm font-bold text-aura">
           {t("home.why.badge")}
        </div>
        
        <div className="grid gap-20 md:grid-cols-2 items-center text-left">
          <div className="space-y-8">
            <h2 className="text-5xl md:text-6xl font-black leading-tight font-romantic italic">
              <span dangerouslySetInnerHTML={{ __html: t("home.why.title").replace("<1>", "<span class='text-aura'>").replace("</1>", "</span>") }} />
            </h2>
            <p className="text-xl text-white/60 leading-relaxed">
              {t("home.why.desc")}
            </p>
            <div className="space-y-4">
               {[
                 { title: t("home.why.noSwiping"), desc: t("home.why.noSwipingDesc") },
                 { title: t("home.why.campusSafe"), desc: t("home.why.campusSafeDesc") },
                 { title: t("home.why.personalized"), desc: t("home.why.personalizedDesc") }
               ].map((item, i) => (
                 <div key={i} className="flex gap-4 items-center">
                    <div className="h-2 w-2 rounded-full bg-aura"/>
                    <div className="text-lg"><span className="font-black text-white">{item.title}:</span> <span className="text-white/50">{item.desc}</span></div>
                 </div>
               ))}
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-4 bg-aura/20 blur-xl rounded-[40px] transition-all group-hover:bg-aura/30" />
            <img src={galleryImg} className="relative rounded-[40px] shadow-2xl border border-white/10" alt="HK Students Gallery" />
          </div>
        </div>
      </section>

      {/* Curated Date Section */}
      <section className="mx-auto mt-40 max-w-6xl px-5">
        <div className="rounded-[48px] bg-white/5 border border-white/10 p-12 md:p-20 flex flex-col md:flex-row gap-12 items-center overflow-hidden">
            <div className="flex-1 space-y-8 text-left">
                <h2 className="text-4xl md:text-5xl font-black font-romantic italic"><span dangerouslySetInnerHTML={{ __html: t("home.curated.title") }} /></h2>
                <p className="text-lg text-white/50">
                    {t("home.curated.desc")}
                </p>
                <Link to="/join" className="inline-block font-black text-aura hover:text-aura underline underline-offset-8 decoration-2">{t("home.curated.cta")}</Link>
            </div>
            <div className="flex-1 w-full scale-110">
                <img src={dateSpotImg} className="rounded-3xl shadow-2xl object-cover aspect-square" alt="Date Spot" />
            </div>
        </div>
      </section>

      {/* Steps (Now with Modal) */}
      <section className="mx-auto mt-40 max-w-7xl px-5">
        <div className="mb-16 text-center">
            <h2 className="text-4xl md:text-5xl font-romantic font-black mb-4 uppercase tracking-tighter italic">{t("home.stepsTitle")}</h2>
            <div className="h-1 w-20 bg-aura mx-auto rounded-full" />
        </div>
        <div className="grid gap-6 md:grid-cols-4">
            {STEPS.map((step, i) => (
            <div 
                key={i} 
                onClick={() => setActiveStep(i)}
                className="group cursor-pointer hover-glow block rounded-[32px] border border-white/5 bg-white/[0.01] p-8 transition-all"
            >
                <div className="mb-6 text-5xl font-romantic italic font-black text-white/5 transition-colors group-hover:text-aura/30">{step.step}</div>
                <h3 className="mb-3 text-2xl font-romantic font-black italic">{step.title}</h3>
                <p className="text-sm leading-relaxed text-white/50 mb-6">{step.desc}</p>
                
                <div className="mt-4 rounded-xl bg-aura/5 p-4 border border-aura/10 opacity-60 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs font-medium italic text-aura/80">{step.example}</p>
                </div>
            </div>
            ))}
        </div>
      </section>

      {/* Modals */}
      {activeStep !== null && (
        <Modal 
            isOpen={activeStep !== null} 
            onClose={() => setActiveStep(null)} 
            title={STEPS[activeStep].title}
        >
            {STEPS[activeStep].details}
        </Modal>
      )}

      {/* FAQ Section */}
      <section className="mx-auto mt-40 max-w-4xl px-5">
        <div className="mb-16 text-center">
            <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter font-romantic italic">{t("home.faqTitle")}</h2>
            <p className="text-white/40">{t("home.faqSubtitle")}</p>
        </div>
        <div className="space-y-4">
            {(t("home.faqs", { returnObjects: true }) as {q: string, a: string}[]).map((faq, i) => (
                <details key={i} className="group rounded-[24px] border border-white/5 bg-white/[0.02] transition-all hover:bg-white/[0.04]">
                    <summary className="flex cursor-pointer items-center justify-between p-6 list-none">
                        <span className="text-lg font-black tracking-tight group-open:text-aura transition-colors">{faq.q}</span>
                        <span className="text-2xl text-white/20 transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <div className="px-6 pb-6 text-white/50 leading-relaxed italic">
                        {faq.a}
                    </div>
                </details>
            ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="mx-auto mt-40 max-w-4xl px-5 text-center">
        <h2 className="text-5xl font-black mb-10 tracking-tighter font-romantic italic"><span dangerouslySetInnerHTML={{ __html: t("home.footerTitle") }} /></h2>
        <Link to="/join" className="group relative inline-flex items-center gap-3 rounded-full bg-aura px-12 py-6 text-2xl font-black text-white shadow-[0_0_40px_rgba(255,0,102,0.3)] transition-all hover:scale-110 active:scale-95">
          {t("home.footerCta")}
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
        <p className="mt-8 text-white/30 text-sm font-black uppercase tracking-[0.4em]">
            {t("home.footerDesc")}
        </p>
      </section>
    </div>
  );
}
