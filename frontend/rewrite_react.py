import os
import re

def process_file(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    # Inject useTranslation import if not there
    if 'useTranslation' not in content and 'react-i18next' not in content:
        content = content.replace('import { useEffect', 'import { useTranslation } from "react-i18next";\nimport { useEffect')
        content = content.replace('import { useState', 'import { useTranslation } from "react-i18next";\nimport { useState')
        if 'import { useTranslation' not in content: # fallback
            content = content.replace('import React', 'import React from "react";\nimport { useTranslation } from "react-i18next";')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)


# --- Layout.tsx ---
layout_reps = [
    ('import { t } from "../content";', ''),
    ('export function Layout(', 'export function Layout('),
    ('{t(locale, "brand")}', '{t("brand")}'),
    ('{t(locale, "navJoin")}', '{t("nav.join")}'),
    ('Sign out', '{t("nav.signOut")}'),
]
with open('src/components/Layout.tsx', 'r') as f: c = f.read()
c = c.replace('import { t } from "../content";', 'import { useTranslation } from "react-i18next";')
c = c.replace('export function Layout({ locale, onLocale, userId, onUser, children }: { locale: Locale; onLocale: (v: Locale) => void; userId: string | null; onUser: (v: string | null) => void; children: React.ReactNode; }) {', 'export function Layout({ locale, onLocale, userId, onUser, children }: { locale: Locale; onLocale: (v: Locale) => void; userId: string | null; onUser: (v: string | null) => void; children: React.ReactNode; }) {\n  const { t } = useTranslation();')
c = c.replace('{t(locale, "brand")}', '{t("brand")}')
c = c.replace('{t(locale, "navJoin")}', '{t("nav.join")}')
c = c.replace('Sign out', '{t("nav.signOut")}')
with open('src/components/Layout.tsx', 'w') as f: f.write(c)


# --- JoinPage.tsx ---
join_reps = [
    ('import { t } from "../content";', 'import { useTranslation } from "react-i18next";'),
    ('export function JoinPage(', 'export function JoinPage(')
]
with open('src/pages/JoinPage.tsx', 'r') as f: c = f.read()
c = c.replace('import { t } from "../content";', 'import { useTranslation } from "react-i18next";')
c = c.replace('export function JoinPage({ locale, userId, onUser }: { locale: Locale; userId: string | null; onUser: (id: string) => void; }) {', 'export function JoinPage({ locale, userId, onUser }: { locale: Locale; userId: string | null; onUser: (id: string) => void; }) {\n  const { t } = useTranslation();')
c = c.replace('Student onboarding', '{t("join.pageTitle")}')
c = c.replace('{t(locale, "joinTitle")}', '{t("join.title")}')
c = c.replace('Use a supported university email, verify with the demo code, then complete a preference profile for the next Wednesday drop.', '{t("join.subtitle")}')
c = c.replace('University Email', '{t("join.emailLabel")}')
c = c.replace('"name@connect.hku.hk"', 't("join.emailPlaceholder")')
c = c.replace('<label className="text-xs font-black uppercase tracking-widest text-white/50">Full Name</label>', '<label className="text-xs font-black uppercase tracking-widest text-white/50">{t("join.nameLabel")}</label>')
c = c.replace('placeholder="Full name"', 'placeholder={t("join.namePlaceholder")}')
c = c.replace('>Send code<', '>{t("join.sendCode")}<')
c = c.replace('Verification Code', '{t("join.verifyCodeLabel")}')
c = c.replace('>Verify<', '>{t("join.verifyBtn")}<')
c = c.replace('<label className="text-xs font-black uppercase tracking-widest text-white/50">Major</label>', '<label className="text-xs font-black uppercase tracking-widest text-white/50">{t("join.majorLabel")}</label>')
c = c.replace('placeholder="Major"', 'placeholder={t("join.majorPlaceholder")}')
c = c.replace('<label className="text-xs font-black uppercase tracking-widest text-white/50">Bio</label>', '<label className="text-xs font-black uppercase tracking-widest text-white/50">{t("join.bioLabel")}</label>')
c = c.replace('placeholder="Tell us about yourself..."', 'placeholder={t("join.bioPlaceholder")}')
c = c.replace('title="Languages"', 'title={t("join.languages")}')
c = c.replace('title="Interests"', 'title={t("join.interests")}')
c = c.replace('title="Availability"', 'title={t("join.availability")}')
c = c.replace('>Save profile<', '>{t("join.saveBtn")}<')
c = c.replace('>Open dashboard<', '>{t("join.dashboardBtn")}<')
c = c.replace('Demo verification code: ${data.devCode}', '` + t("join.demoCodeMsg", { code: data.devCode }) + `')
c = c.replace('Verified. Continue your profile.', '` + t("join.verifiedMsg") + `')
c = c.replace('Please verify your email first to save your profile.', '` + t("join.verifyFirstMsg") + `')
c = c.replace('Profile saved! Redirecting to your dashboard...', '` + t("join.savedMsg") + `')
# Fix some quotes
c = c.replace('setMessage(`Demo verification code: ${data.devCode}`)', 'setMessage(t("join.demoCodeMsg", { code: data.devCode }))')
c = c.replace('setMessage("Verified. Continue your profile.")', 'setMessage(t("join.verifiedMsg"))')
c = c.replace('setMessage("Please verify your email first to save your profile.")', 'setMessage(t("join.verifyFirstMsg"))')
c = c.replace('setMessage("Profile saved! Redirecting to your dashboard...")', 'setMessage(t("join.savedMsg"))')
with open('src/pages/JoinPage.tsx', 'w') as f: f.write(c)


# --- StudentPage.tsx ---
with open('src/pages/StudentPage.tsx', 'r') as f: c = f.read()
c = c.replace('import { t } from "../content";', 'import { useTranslation } from "react-i18next";')
c = c.replace('export function StudentPage({ locale, userId }: { locale: Locale; userId: string | null; }) {', 'export function StudentPage({ locale, userId }: { locale: Locale; userId: string | null; }) {\n  const { t } = useTranslation();')

c = c.replace('setMessage(sentiment === "rematch" ? "Finding you a new match..." : "Feedback saved.")', 'setMessage(sentiment === "rematch" ? t("student.findingMatch") : t("student.feedbackSaved"))')
c = c.replace('{t(locale, "dashboardTitle")}', '{t("student.title")}')
c = c.replace('Please sign in to view your dashboard.', '{t("student.signInPrompt")}')
c = c.replace('Loading profile…', '{t("student.loading")}')
c = c.replace('Hi, {profile.fullName.split(" ")[0]}!', '{t("student.hi", { name: profile.fullName.split(" ")[0] })}')
c = c.replace('<span className="font-bold text-white/30 uppercase tracking-widest">Major</span>', '<span className="font-bold text-white/30 uppercase tracking-widest">{t("student.major")}</span>')
c = c.replace('profile.major || "Pending"', 'profile.major || t("student.pending")')
c = c.replace('<span className="text-xs font-bold text-white/30 uppercase tracking-widest">Languages</span>', '<span className="text-xs font-bold text-white/30 uppercase tracking-widest">{t("student.languages")}</span>')

c = c.replace('Current Drop', '{t("student.currentDrop")}')
c = c.replace('Compatibility score: ', '{t("student.compatibility")} ')
c = c.replace('About them', '{t("student.aboutThem")}')
c = c.replace('Curated Date', '{t("student.curatedDate")}')
c = c.replace('Scheduling', '{t("student.scheduling")}')
c = c.replace('view.match.confirmedSlot || "Wait for overlap"', 'view.match.confirmedSlot || t("student.waitOverlap")')
c = c.replace('Overlap: {view.match.overlapSlots.join(", ") || "None yet"}', '{t("student.overlap", { slots: view.match.overlapSlots.join(", ") || t("student.noneYet") })}')

c = c.replace('Notes for System', '{t("student.notesSys")}')
c = c.replace('placeholder="What should the system learn?"', 'placeholder={t("student.notesPlaceholder")}')
c = c.replace('>Loved it<', '>{t("student.lovedIt")}<')
c = c.replace('>Pass<', '>{t("student.pass")}<')
c = c.replace('>Request rematch<', '>{t("student.requestRematch")}<')

c = c.replace(">You're in the next drop!<", ">{t('student.nextDropView.title')}<")
c = c.replace("At Ditto, we believe in quality over quantity. Instead of swiping, you get **one intentional match** every Wednesday at 7:00 PM.", "{t('student.nextDropView.desc')}")
c = c.replace("Next Match Drop In", "{t('student.nextDropView.countdownTitle')}")
c = c.replace("Check back on Wednesday!", "{t('student.nextDropView.checkBack')}")
c = c.replace("Verified Students Only", "{t('student.nextDropView.verified')}")
c = c.replace("We ensure everyone is a real person from your campus.", "{t('student.nextDropView.verifiedDesc')}")
c = c.replace("High Signal Matching", "{t('student.nextDropView.highSignal')}")
c = c.replace("Our algorithm focuses on shared interests and values.", "{t('student.nextDropView.highSignalDesc')}")

with open('src/pages/StudentPage.tsx', 'w') as f: f.write(c)

# --- AdminPage.tsx ---
with open('src/pages/AdminPage.tsx', 'r') as f: c = f.read()
c = c.replace('import { t } from "../content";', 'import { useTranslation } from "react-i18next";')
c = c.replace('export function AdminPage({ locale, onUser }: { locale: Locale; onUser: (id: string) => void; }) {', 'export function AdminPage({ locale, onUser }: { locale: Locale; onUser: (id: string) => void; }) {\n  const { t } = useTranslation();')

c = c.replace('`Created ${result.created.length} new match(es).`', 't("admin.msgCreated", { count: result.created.length })')
c = c.replace('"Demo data reset."', 't("admin.msgReset")')
c = c.replace('{t(locale, "adminTitle")}', '{t("admin.title")}')
c = c.replace('Operator dashboard', '{t("admin.pageTitle")}')
c = c.replace('>Reset demo data<', '>{t("admin.resetDemo")}<')
c = c.replace('>Run Wednesday drop<', '>{t("admin.runDrop")}<')

c = c.replace('label: "Students"', 'label: t("admin.stats.students")')
c = c.replace('label: "Profiles"', 'label: t("admin.stats.profiles")')
c = c.replace('label: "Dates"', 'label: t("admin.stats.dates")')
c = c.replace('label: "Rematch"', 'label: t("admin.stats.rematch")')

c = c.replace('Recent matches', '{t("admin.recentMatches")}')
c = c.replace('• score {match.score}', '• {t("admin.score")} {match.score}')
c = c.replace('>Open<', '>{t("admin.open")}<')
c = c.replace('Student Directory', '{t("admin.studentDir")}')
c = c.replace('student.major || "Incomplete"', 'student.major || t("admin.incomplete")')
c = c.replace('>View<', '>{t("admin.view")}<')
c = c.replace('Loading records…', '{t("admin.loading")}')

with open('src/pages/AdminPage.tsx', 'w') as f: f.write(c)

print("Done rewriting basic pages.")
