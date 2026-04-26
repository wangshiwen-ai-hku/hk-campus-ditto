// Post-date survey templates: a short 2-hour and a deeper 24-hour check-in.

import type { Question, QuestionGroup } from "../onboarding/questions.js";

export const postDate2h: QuestionGroup = {
  template: "post_date_2h" as any,
  title: "Quick check-in",
  description: "Three questions, 60 seconds. Directly tunes who we send next.",
  questions: [
    {
      id: "showed",
      prompt: "Did the date happen?",
      whyItMatters: "We track this honestly to keep the pool reliable.",
      kind: "single",
      options: ["both showed", "I showed, they didn't", "we rescheduled", "neither went"],
    },
    {
      id: "vibeScore",
      prompt: "Overall vibe",
      whyItMatters: "Single score we use as ground truth for tuning.",
      kind: "scale",
      min: 1,
      max: 7,
    },
    {
      id: "oneLine",
      prompt: "One line: most memorable moment or weirdest thing",
      whyItMatters: "Free text feeds your persona memory.",
      kind: "text",
    },
  ] as Question[],
};

export const postDate24h: QuestionGroup = {
  template: "post_date_24h" as any,
  title: "A bit more, if you'd like",
  description: "Optional. Goes deeper into who you want next.",
  questions: [
    {
      id: "wantSeeAgain",
      prompt: "Do you want to see them again?",
      whyItMatters: "We use this as the strongest signal.",
      kind: "single",
      options: ["yes", "not sure", "no"],
    },
    {
      id: "matchedExpectations",
      prompt: "Which parts matched / didn't match your expectations?",
      whyItMatters: "Concrete deltas help us re-weight your preferences.",
      kind: "text",
    },
    {
      id: "adjustVibe",
      prompt: "Want us to weight any vibe tag up or down for next round?",
      whyItMatters: "Direct lever on your matching weights.",
      kind: "text",
    },
  ] as Question[],
};

export const postDateGroups = [postDate2h, postDate24h];
