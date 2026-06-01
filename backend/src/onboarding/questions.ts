// Question bank for onboarding surveys based on DopaMine Questionnaire.
// Designed as 3 thematic groups.
// Each question carries a `whyItMatters` so the UI can show transparency.

export type QuestionKind = "single" | "multi" | "text" | "scale" | "range" | "date" | "number" | "photos" | "mediaCards";

export interface Question {
  id: string;
  prompt?: string;
  promptKey?: string;
  whyItMatters?: string;
  whyItMattersKey?: string;
  kind: QuestionKind;
  options?: string[];
  optionsKeys?: string[];
  placeholderKey?: string;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  required?: boolean;
}

export interface QuestionGroup {
  template:
  | "onboarding_basics"
  | "onboarding_preferences"
  | "onboarding_attraction"
  | "onboarding_ldfr"
  | "onboarding_media"
  | "post_date_2h"
  | "post_date_24h";
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  questions: Question[];
}

export const onboardingGroups: QuestionGroup[] = [
  {
    template: "onboarding_preferences",
    titleKey: "onboarding.groups.prefs.title",
    descriptionKey: "onboarding.groups.prefs.desc",
    questions: [
      {
        id: "targetGender",
        promptKey: "onboarding.q.targetGender.prompt",
        whyItMattersKey: "onboarding.q.targetGender.why",
        kind: "multi",
        optionsKeys: ["onboarding.opt.male", "onboarding.opt.female", "onboarding.opt.non_binary", "onboarding.opt.everyone"],
        required: true,
      },
      {
        id: "datingGoal",
        promptKey: "onboarding.q.datingGoal.prompt",
        whyItMattersKey: "onboarding.q.datingGoal.why",
        kind: "multi",
        optionsKeys: ["onboarding.opt.life_partner", "onboarding.opt.long_term", "onboarding.opt.casual", "onboarding.opt.friends", "onboarding.opt.unsure"],
        required: true,
      },
      {
        id: "ageRange",
        promptKey: "onboarding.q.ageRange.prompt",
        whyItMattersKey: "onboarding.q.ageRange.why",
        placeholderKey: "onboarding.q.ageRange.placeholder",
        kind: "range",
        min: 18,
        max: 60,
        required: true,
      },
      {
        id: "matchMode",
        promptKey: "onboarding.q.matchMode.prompt",
        whyItMattersKey: "onboarding.q.matchMode.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.mode_fast", "onboarding.opt.mode_balanced", "onboarding.opt.mode_intentional", "onboarding.opt.mode_wait"],
        required: true,
      },
      {
        id: "hobbies",
        promptKey: "onboarding.q.hobbies.prompt",
        whyItMattersKey: "onboarding.q.hobbies.why",
        placeholderKey: "onboarding.q.hobbies.placeholder",
        kind: "text",
        required: false,
      },
      {
        id: "hkWeekendVibe",
        promptKey: "onboarding.q.hkWeekendVibe.prompt",
        whyItMattersKey: "onboarding.q.hkWeekendVibe.why",
        kind: "multi",
        optionsKeys: [
          "onboarding.opt.vibe_cafe",
          "onboarding.opt.vibe_nature",
          "onboarding.opt.vibe_city",
          "onboarding.opt.vibe_food",
          "onboarding.opt.vibe_movie",
          "onboarding.opt.vibe_gallery",
          "onboarding.opt.vibe_workshop",
          "onboarding.opt.vibe_walk",
        ],
        required: true,
      },
      {
        id: "attractionHeightAndBuild",
        promptKey: "onboarding.q.attractHeight.prompt",
        whyItMattersKey: "onboarding.q.attractHeight.why",
        placeholderKey: "onboarding.q.attractHeight.placeholder",
        kind: "text",
        required: false,
      }
    ]
  },
  {
    template: "onboarding_ldfr",
    titleKey: "onboarding.groups.ldfr.title",
    descriptionKey: "onboarding.groups.ldfr.desc",
    questions: [
      {
        id: "ldfr_q1",
        promptKey: "onboarding.q.ldfr_q1.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q1.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q1_a", "onboarding.opt.ldfr_q1_b", "onboarding.opt.ldfr_q1_c", "onboarding.opt.ldfr_q1_d"],
        required: true,
      },
      {
        id: "ldfr_q4",
        promptKey: "onboarding.q.ldfr_q4.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q4.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q4_a", "onboarding.opt.ldfr_q4_b", "onboarding.opt.ldfr_q4_c", "onboarding.opt.ldfr_q4_d"],
        required: true,
      },
      {
        id: "ldfr_q5",
        promptKey: "onboarding.q.ldfr_q5.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q5.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q5_a", "onboarding.opt.ldfr_q5_b", "onboarding.opt.ldfr_q5_c", "onboarding.opt.ldfr_q5_d"],
        required: true,
      },
      {
        id: "ldfr_q7",
        promptKey: "onboarding.q.ldfr_q7.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q7.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q7_a", "onboarding.opt.ldfr_q7_b", "onboarding.opt.ldfr_q7_c", "onboarding.opt.ldfr_q7_d"],
        required: true,
      },
      {
        id: "ldfr_q8",
        promptKey: "onboarding.q.ldfr_q8.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q8.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q8_a", "onboarding.opt.ldfr_q8_b", "onboarding.opt.ldfr_q8_c", "onboarding.opt.ldfr_q8_d"],
        required: true,
      },
      {
        id: "ldfr_q9",
        promptKey: "onboarding.q.ldfr_q9.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q9.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q9_a", "onboarding.opt.ldfr_q9_b", "onboarding.opt.ldfr_q9_c", "onboarding.opt.ldfr_q9_d"],
        required: true,
      },
      {
        id: "ldfr_q10",
        promptKey: "onboarding.q.ldfr_q10.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q10.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q10_a", "onboarding.opt.ldfr_q10_b", "onboarding.opt.ldfr_q10_c", "onboarding.opt.ldfr_q10_d"],
        required: true,
      },
      {
        id: "ldfr_q14",
        promptKey: "onboarding.q.ldfr_q14.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q14.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q14_a", "onboarding.opt.ldfr_q14_b", "onboarding.opt.ldfr_q14_c", "onboarding.opt.ldfr_q14_d"],
        required: true,
      },
      {
        id: "ldfr_q15",
        promptKey: "onboarding.q.ldfr_q15.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q15.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q15_a", "onboarding.opt.ldfr_q15_b", "onboarding.opt.ldfr_q15_c", "onboarding.opt.ldfr_q15_d"],
        required: true,
      },
      {
        id: "ldfr_q16",
        promptKey: "onboarding.q.ldfr_q16.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q16.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q16_a", "onboarding.opt.ldfr_q16_b", "onboarding.opt.ldfr_q16_c", "onboarding.opt.ldfr_q16_d"],
        required: true,
      },
      {
        id: "ldfr_q18",
        promptKey: "onboarding.q.ldfr_q18.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q18.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q18_a", "onboarding.opt.ldfr_q18_b", "onboarding.opt.ldfr_q18_c", "onboarding.opt.ldfr_q18_d"],
        required: true,
      },
      {
        id: "ldfr_q19",
        promptKey: "onboarding.q.ldfr_q19.prompt",
        whyItMattersKey: "onboarding.q.ldfr_q19.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.ldfr_q19_a", "onboarding.opt.ldfr_q19_b", "onboarding.opt.ldfr_q19_c", "onboarding.opt.ldfr_q19_d"],
        required: true,
      }
    ]
  },
  {
    template: "onboarding_media",
    titleKey: "onboarding.groups.media.title",
    descriptionKey: "onboarding.groups.media.desc",
    questions: [
      {
        id: "mediaCards",
        promptKey: "onboarding.q.photos.prompt",
        whyItMattersKey: "onboarding.q.photos.why",
        placeholderKey: "onboarding.q.mediaNotes.placeholder",
        kind: "mediaCards",
        min: 1,
        max: 5,
        required: true,
      }
    ]
  }
];

export function findGroup(template: string): QuestionGroup | undefined {
  return onboardingGroups.find((g) => g.template === template);
}
