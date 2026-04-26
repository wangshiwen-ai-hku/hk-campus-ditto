// Question bank for onboarding surveys.
// Designed as 3 small thematic groups, ~5-7 questions each.
// Each question carries a `whyItMatters` so the UI can show transparency.

export type QuestionKind = "single" | "multi" | "text" | "scale";

export interface Question {
  id: string;
  prompt: string;
  whyItMatters: string;
  kind: QuestionKind;
  options?: string[];
  min?: number;
  max?: number;
}

export interface QuestionGroup {
  template: "onboarding_life" | "onboarding_mind" | "onboarding_social";
  title: string;
  description: string;
  questions: Question[];
}

export const onboardingGroups: QuestionGroup[] = [
  {
    template: "onboarding_life",
    title: "Life rhythm",
    description: "How you actually spend your week — small clues, big signal.",
    questions: [
      {
        id: "coffeeOrTea",
        prompt: "Your default order at a campus café",
        whyItMatters: "Specific tastes (matcha, dirty, cold brew) hint at lifestyle and pace.",
        kind: "multi",
        options: ["latte", "matcha latte", "americano", "dirty", "cold brew", "milk tea", "specialty pour-over", "I don't drink caffeine"],
      },
      {
        id: "weekendVibe",
        prompt: "Ideal Saturday 11am",
        whyItMatters: "Weekend defaults reveal energy and social mode better than self-described traits.",
        kind: "single",
        options: ["sleep in & read", "brunch with friends", "hike or trail run", "gym + cafe", "still in lab", "gaming", "exploring a new neighbourhood"],
      },
      {
        id: "spendingTier",
        prompt: "First-date budget you're comfortable with",
        whyItMatters: "Aligning expectations on spending avoids silent friction.",
        kind: "single",
        options: ["budget", "moderate", "splurge"],
      },
      {
        id: "petAffinity",
        prompt: "Cat or dog?",
        whyItMatters: "Classic axis. We'll honour your pick when matching.",
        kind: "single",
        options: ["dog", "cat", "both", "none"],
      },
      {
        id: "energyMode",
        prompt: "After a long week of classes you feel...",
        whyItMatters: "Introvert/extrovert balance shapes who you click with.",
        kind: "single",
        options: ["introvert", "extrovert", "ambivert"],
      },
      {
        id: "firstDateLength",
        prompt: "Your ideal first date length",
        whyItMatters: "We schedule the slot accordingly.",
        kind: "single",
        options: ["short", "medium", "long"],
      },
    ],
  },
  {
    template: "onboarding_mind",
    title: "Mind habits",
    description: "How you think and consume — tools, taste, openness.",
    questions: [
      {
        id: "devTools",
        prompt: "Editors / tools you actually use (skip if you don't code)",
        whyItMatters: "We're building extra goodies for CS folks; this also reveals work style.",
        kind: "multi",
        options: ["VSCode", "Cursor", "JetBrains", "Neovim", "Xcode", "Figma", "Notion", "Excel power user", "I don't code"],
      },
      {
        id: "consumptionStyle",
        prompt: "When you finish a great film/book, you usually...",
        whyItMatters: "Solo absorbers and instant-sharers tend to want different conversation pace.",
        kind: "single",
        options: ["sit with it alone", "immediately recommend it", "write or post about it", "discuss only when asked"],
      },
      {
        id: "recentMindChange",
        prompt: "Tell us about a recent time you changed your mind about something",
        whyItMatters: "Open-ended answers feed your persona summary — be honest, not polished.",
        kind: "text",
      },
      {
        id: "mediaTaste",
        prompt: "Pick the genres you actually enjoy",
        whyItMatters: "Used as soft signal for shared talking points.",
        kind: "multi",
        options: ["indie film", "blockbuster", "anime", "K-drama", "documentary", "non-fiction", "fiction", "fantasy/sci-fi", "philosophy", "manga", "podcasts"],
      },
    ],
  },
  {
    template: "onboarding_social",
    title: "Social signals",
    description: "Optional public signals to help us understand your taste better.",
    questions: [
      {
        id: "githubUrl",
        prompt: "GitHub profile URL (optional)",
        whyItMatters: "If you code, your GitHub gives us much richer signal than a resume.",
        kind: "text",
      },
      {
        id: "socialNotes",
        prompt: "Anything else you'd like us to know about your taste, friends, or scene?",
        whyItMatters: "Free-text we feed into your persona with care.",
        kind: "text",
      },
      {
        id: "socialAffinity",
        prompt: "Where do you mostly hang out online?",
        whyItMatters: "Quick read on your social texture. We won't crawl, just note it.",
        kind: "single",
        options: ["Instagram", "RedNote (Xiaohongshu)", "Twitter/X", "Discord", "Telegram", "Reddit", "I'm mostly offline"],
      },
    ],
  },
];

export function findGroup(template: string): QuestionGroup | undefined {
  return onboardingGroups.find((g) => g.template === template);
}
