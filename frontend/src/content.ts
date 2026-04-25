import type { Locale } from "./types";

type Dict = Record<string, { en: string; "zh-HK": string; "zh-CN": string }>;

export const copy: Dict = {
  brand: { en: "Campus Ditto HK", "zh-HK": "Campus Ditto HK", "zh-CN": "Campus Ditto HK" },
  navHow: { en: "How it works", "zh-HK": "點樣運作", "zh-CN": "如何运作" },
  navSafety: { en: "Safety", "zh-HK": "安全", "zh-CN": "安全保障" },
  navFAQ: { en: "FAQ", "zh-HK": "常見問題", "zh-CN": "常见问题" },
  navJoin: { en: "Join now", "zh-HK": "立即加入", "zh-CN": "立即加入" },
  heroTitle: { en: "One curated campus date, every Wednesday.", "zh-HK": "逢星期三，送你一個精心安排嘅校園約會。", "zh-CN": "每周三，为你送上一份精心安排的校园约会。" },
  heroSubtitle: {
    en: "Built for Hong Kong universities: verified students, intentional matching, and low-pressure first dates near campus.",
    "zh-HK": "專為香港大學而設：學生認證、認真配對、校園附近低壓力第一次見面。",
    "zh-CN": "专为香港大学而设：学生认证、认真配对、校园附近低压力初次面基。"
  },
  heroCta: { en: "Start with your school email", "zh-HK": "用學校 email 開始", "zh-CN": "使用学校邮箱开始" },
  heroDemo: { en: "Open demo dashboard", "zh-HK": "打開 demo 面板", "zh-CN": "查看演示面板" },
  how1: { en: "Tell us your type", "zh-HK": "講你鍾意咩類型", "zh-CN": "告诉我们你的理想型" },
  how1b: { en: "Complete your profile before Tuesday night.", "zh-HK": "星期二晚之前填好個人檔案。", "zh-CN": "在周二晚上之前完善个人资料。" },
  how2: { en: "Wednesday drop", "zh-HK": "星期三配對投放", "zh-CN": "周三匹配发布" },
  how2b: { en: "Receive one high-intent match with a campus-safe date suggestion.", "zh-HK": "收到一個高配對度對象，同安全校園約會建議。", "zh-CN": "收到一位高契合度的匹配对象及校园安全约会建议。" },
  how3: { en: "Share availability", "zh-HK": "填可用時間", "zh-CN": "分享空闲时间" },
  how3b: { en: "We look for overlap and confirm a simple first meet.", "zh-HK": "系統搵重疊時段，再確認第一次見面。", "zh-CN": "系统寻找重合时段，并确认初次见面。" },
  how4: { en: "Give feedback", "zh-HK": "提供 feedback", "zh-CN": "提供反馈" },
  how4b: { en: "Refine future drops based on what worked and what did not.", "zh-HK": "根據你鍾意同唔鍾意嘅地方優化之後配對。", "zh-CN": "通过你的喜好反馈，持续优化后续匹配质量。" },
  safetyTitle: { en: "Verified. Private. Campus-first.", "zh-HK": "已驗證、私隱優先、校園為本。", "zh-CN": "实名认证、隐私保护、校园优先。" },
  faqTitle: { en: "FAQ", "zh-HK": "FAQ", "zh-CN": "常见问题" },
  joinTitle: { en: "Join your next Wednesday drop", "zh-HK": "加入下一次星期三配對", "zh-CN": "加入下周三匹配发布" },
  dashboardTitle: { en: "Student dashboard", "zh-HK": "學生控制台", "zh-CN": "学生仪表盘" },
  adminTitle: { en: "Admin console", "zh-HK": "管理員控制台", "zh-CN": "管理控制台" }
};

export function t(locale: Locale, key: keyof typeof copy) {
  return copy[key][locale] || copy[key]["en"];
}
