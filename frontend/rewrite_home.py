import os

with open('src/pages/HomePage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('import { api }', 'import { useTranslation } from "react-i18next";\nimport { api }')
c = c.replace('export function HomePage({ onUser }: { onUser: (id: string) => void; }) {', 'export function HomePage({ onUser }: { onUser: (id: string) => void; }) {\n  const { t } = useTranslation();')

# STEPS object modification is tricky string replace, but we can do it textually
c = c.replace('step: "01", \n      title: "Tell us your type", \n      desc: "Complete your profile before Tuesday night.", \n      example: "e.g. \'I love night views at TST\'",',
              'step: "01", \n      title: t("home.steps.step1.title"), \n      desc: t("home.steps.step1.desc"), \n      example: t("home.steps.step1.example"),')
c = c.replace('''"Your profile is your digital vibe. We don't just ask for your degree, we ask for your soul." ✨''', '{t("home.steps.step1.detailQuote")}')
c = c.replace('>Interests<', '>{t("home.steps.step1.interests")}<')
c = c.replace('>From Cantopop to Tech Ethics<', '>{t("home.steps.step1.interestsDesc")}<')
c = c.replace('>Vibe Tags<', '>{t("home.steps.step1.vibeTags")}<')
c = c.replace('>Cloud-chaser, Night-owl, or Library-dweller<', '>{t("home.steps.step1.vibeTagsDesc")}<')
c = c.replace('Your data is encrypted and only shared with your match.', '{t("home.steps.step1.encryptionNote")}')

c = c.replace('step: "02", \n      title: "Wednesday drop", \n      desc: "Receive one high-intent match at 7PM.", \n      example: "e.g. Matching with a fellow HKUer",',
              'step: "02", \n      title: t("home.steps.step2.title"), \n      desc: t("home.steps.step2.desc"), \n      example: t("home.steps.step2.example"),')
c = c.replace('"Every Wednesday at 7PM, the magic happens. No more choice paralysis. Just one person." ✉️', '{t("home.steps.step2.detailQuote")}')
c = c.replace('>Algorithm Focus<', '>{t("home.steps.step2.algoFocus")}<')
c = c.replace('>"High Signal, Low Noise"<', '>{t("home.steps.step2.algoFocusDesc")}<')
c = c.replace('"I checked my phone at 7:01 and there was this person from my own college. It felt intentional." — CUHK Junior', '{t("home.steps.step2.userQuote")}')

c = c.replace('step: "03", \n      title: "Share availability", \n      desc: "Confirm a simple meeting time.", \n      example: "e.g. \'Let\'s meet at Book Cafe!\'",',
              'step: "03", \n      title: t("home.steps.step3.title"), \n      desc: t("home.steps.step3.desc"), \n      example: t("home.steps.step3.example"),')
c = c.replace('''"We find the overlap in your schedules so you don't have to play text-tag." ☕''', '{t("home.steps.step3.detailQuote")}')
c = c.replace('>Choose from pre-set safe campus spots.<', '>{t("home.steps.step3.check1")}<')
c = c.replace('>Suggested under-1-hour date format.<', '>{t("home.steps.step3.check2")}<')
c = c.replace('>High commitment, low pressure meets.<', '>{t("home.steps.step3.check3")}<')

c = c.replace('step: "04", \n      title: "Go on a date", \n      desc: "Refine future matches based on feedback.", \n      example: "e.g. \'Had a great vibe, retry!\'",',
              'step: "04", \n      title: t("home.steps.step4.title"), \n      desc: t("home.steps.step4.desc"), \n      example: t("home.steps.step4.example"),')
c = c.replace('"Meet in the real world. That\'s where the chemistry happens." 🌟', '{t("home.steps.step4.detailQuote")}')
c = c.replace('>Match!<', '>{t("home.steps.step4.match")}<')
c = c.replace('>Friends<', '>{t("home.steps.step4.friends")}<')
c = c.replace('>Retry<', '>{t("home.steps.step4.retry")}<')
c = c.replace('"Feedback improves the HK campus pool for everyone. Your input shapes the next drop."', '{t("home.steps.step4.userQuote")}')

c = c.replace('>get a date every<', '>{t("home.hero.getADate")}<')
c = c.replace('\n            wednesday\n          ', '\n            {t("home.hero.wednesday")}\n          ')
c = c.replace('\n              @YOUR SCHOOL\n            ', '\n              {t("home.hero.atYourSchool")}\n            ')
c = c.replace('Next HK Campus Drop: Wednesday at 7PM', '{t("home.hero.nextDrop")}')
c = c.replace('Join Next Drop\n          <span', '{t("home.hero.joinDrop")}\n          <span')

c = c.replace('{meta?.stats.students ?? \'147,068\'} Students Joined • 100% University Verified • {meta?.stats.scheduledDates ?? \'12,402\'} Dates Met •',
              '{t("home.stats", { students: meta?.stats.students ?? \'147,068\', dates: meta?.stats.scheduledDates ?? \'12,402\' })}')

c = c.replace('Stopping the swipe culture in HK', '{t("home.why.badge")}')
c = c.replace('One intentional <br/> <span className="text-pink-500">Wednesday</span> date', '<span dangerouslySetInnerHTML={{ __html: t("home.why.title").replace("<1>", "<span class=\'text-pink-500\'>").replace("</1>", "</span>") }} />')
c = c.replace('Tired of endless swiping and "Hi" that go nowhere? We drop one intentional match for you every Wednesday. No games, just one high-signal connection from your campus.', '{t("home.why.desc")}')

c = c.replace('{ title: "No Swiping", desc: "Our algorithm does the heavy lifting for you." }', '{ title: t("home.why.noSwiping"), desc: t("home.why.noSwipingDesc") }')
c = c.replace('{ title: "Campus Safe", desc: "Only students with verified .edu.hk emails." }', '{ title: t("home.why.campusSafe"), desc: t("home.why.campusSafeDesc") }')
c = c.replace('{ title: "Personalized", desc: "Matched based on values, vibe, and availability." }', '{ title: t("home.why.personalized"), desc: t("home.why.personalizedDesc") }')

c = c.replace('Curated campus <br/> dates that actually <br/> happen.', '<span dangerouslySetInnerHTML={{ __html: t("home.curated.title") }} />')
c = c.replace('We don\'t just match you; we suggest a safe, high-vibe spot on your campus and a simple idea to break the ice.', '{t("home.curated.desc")}')
c = c.replace('Start your journey →', '{t("home.curated.cta")}')

c = c.replace('How to get a date', '{t("home.stepsTitle")}')

c = c.replace('Common Questions', '{t("home.faqTitle")}')
c = c.replace('Everything you need to know about the Wednesday Drop.', '{t("home.faqSubtitle")}')

# For FAQs: since it's an array, let's just replace the mapped array with `t("home.faqs", { returnObjects: true }) as any[]`
c = c.replace('''[
                { q: "How does the matching work?", a: "Our algorithm doesn't just look at 'likes'. It analyzes your interests, values, and even your weekly availability. We aim for high-signal connections that have a high probability of a great first campus meet." },
                { q: "Is it restricted to .edu.hk emails?", a: "Yes. To ensure safety and a community of peers, we only allow students from supported Hong Kong universities with valid institutional emails (e.g., @connect.hku.hk, @link.cuhk.edu.hk)." },
                { q: "Why only one match per week?", a: "Endless browsing leads to decision fatigue and shallow connections. By giving you one intentional match every Wednesday, we help you focus on really getting to know one person at a time." },
                { q: "What if I get a bad match?", a: "You're always in control. After every drop, you can provide feedback. If you identify as a 'pass' or 'rematch', our algorithm learns your preferences for the next cycle. Safety and comfort are our top priorities." },
                { q: "Where should we meet?", a: "We always suggest safe, public spots on your own campus—like the HKU Book Cafe or the CUHK Pavilion. Keep it low-pressure, keep it public, and keep it under an hour for the first meet." }
            ].map((faq, i)''',
            '''(t("home.faqs", { returnObjects: true }) as {q: string, a: string}[]).map((faq, i)''')

c = c.replace('Ready to meet your <br/> next campus connection?', '<span dangerouslySetInnerHTML={{ __html: t("home.footerTitle") }} />')
c = c.replace('Get Started Now\n          <span', '{t("home.footerCta")}\n          <span')
c = c.replace('Join 147k+ Students across HK', '{t("home.footerDesc")}')

with open('src/pages/HomePage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Done overwriting home page.")
