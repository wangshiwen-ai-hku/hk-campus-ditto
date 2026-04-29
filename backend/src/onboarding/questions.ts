// Question bank for onboarding surveys based on Ditto Questionnaire.
// Designed as 3 thematic groups.
// Each question carries a `whyItMatters` so the UI can show transparency.

export type QuestionKind = "single" | "multi" | "text" | "scale" | "range" | "date" | "number" | "photos";

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
    template: "onboarding_basics",
    titleKey: "onboarding.groups.basics.title",
    descriptionKey: "onboarding.groups.basics.desc",
    questions: [
      {
        id: "gender",
        promptKey: "onboarding.q.gender.prompt",
        whyItMattersKey: "onboarding.q.gender.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.male", "onboarding.opt.female", "onboarding.opt.non_binary"],
      },
      {
        id: "birthday",
        promptKey: "onboarding.q.birthday.prompt",
        whyItMattersKey: "onboarding.q.birthday.why",
        kind: "date",
      },
      {
        id: "ethnicity",
        promptKey: "onboarding.q.ethnicity.prompt",
        whyItMattersKey: "onboarding.q.ethnicity.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.prefer_not_say", "onboarding.opt.eth_indian", "onboarding.opt.eth_black", "onboarding.opt.eth_east_asian", "onboarding.opt.eth_latinx", "onboarding.opt.eth_middle_eastern", "onboarding.opt.eth_pacific", "onboarding.opt.eth_south_asian", "onboarding.opt.eth_southeast_asian", "onboarding.opt.eth_white", "onboarding.opt.eth_other"],
        defaultValue: "onboarding.opt.prefer_not_say",
        required: true,
      },
      {
        id: "height",
        promptKey: "onboarding.q.height.prompt",
        whyItMattersKey: "onboarding.q.height.why",
        kind: "number",
        min: 140,
        max: 220,
        required: true,
      },
      {
        id: "hkMtrLocation",
        promptKey: "onboarding.q.hkMtrLocation.prompt",
        whyItMattersKey: "onboarding.q.hkMtrLocation.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.mtr_island", "onboarding.opt.mtr_east", "onboarding.opt.mtr_tsuen_wan_kwun_tong", "onboarding.opt.mtr_tuen_ma", "onboarding.opt.mtr_other"],
        required: true,
      },
      {
        id: "mbtiE",
        promptKey: "onboarding.q.mbtiE.prompt",
        whyItMattersKey: "onboarding.q.mbtiE.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.mbti_e", "onboarding.opt.mbti_i", "onboarding.opt.mbti_none"],
        required: true,
      },
      {
        id: "mbtiS",
        promptKey: "onboarding.q.mbtiS.prompt",
        whyItMattersKey: "onboarding.q.mbtiS.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.mbti_s", "onboarding.opt.mbti_n", "onboarding.opt.mbti_none"],
        required: true,
      },
      {
        id: "mbtiT",
        promptKey: "onboarding.q.mbtiT.prompt",
        whyItMattersKey: "onboarding.q.mbtiT.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.mbti_t", "onboarding.opt.mbti_f", "onboarding.opt.mbti_none"],
        required: true,
      },
      {
        id: "mbtiJ",
        promptKey: "onboarding.q.mbtiJ.prompt",
        whyItMattersKey: "onboarding.q.mbtiJ.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.mbti_j", "onboarding.opt.mbti_p", "onboarding.opt.mbti_none"],
        required: true,
      }
    ]
  },
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
        kind: "single",
        optionsKeys: ["onboarding.opt.life_partner", "onboarding.opt.long_term", "onboarding.opt.casual", "onboarding.opt.friends", "onboarding.opt.unsure"],
        required: true,
      },
      {
        id: "ageRange",
        promptKey: "onboarding.q.ageRange.prompt",
        whyItMattersKey: "onboarding.q.ageRange.why",
        kind: "range",
        min: 18,
        max: 60,
        required: true,
      },
      {
        id: "targetEthnicity",
        promptKey: "onboarding.q.targetEthnicity.prompt",
        whyItMattersKey: "onboarding.q.targetEthnicity.why",
        kind: "multi",
        optionsKeys: ["onboarding.opt.no_pref", "onboarding.opt.eth_indian", "onboarding.opt.eth_black", "onboarding.opt.eth_east_asian", "onboarding.opt.eth_latinx", "onboarding.opt.eth_middle_eastern", "onboarding.opt.eth_pacific", "onboarding.opt.eth_south_asian", "onboarding.opt.eth_southeast_asian", "onboarding.opt.eth_white", "onboarding.opt.eth_other"],
        defaultValue: ["onboarding.opt.no_pref"],
        required: true,
      },
      {
        id: "languagePref",
        promptKey: "onboarding.q.languagePref.prompt",
        whyItMattersKey: "onboarding.q.languagePref.why",
        kind: "multi",
        optionsKeys: ["onboarding.opt.lang_canto", "onboarding.opt.lang_mando", "onboarding.opt.lang_eng", "onboarding.opt.lang_mixed", "onboarding.opt.no_pref"],
        required: true,
      },
      {
        id: "matchMode",
        promptKey: "onboarding.q.matchMode.prompt",
        whyItMattersKey: "onboarding.q.matchMode.why",
        kind: "single",
        optionsKeys: ["onboarding.opt.mode_fast", "onboarding.opt.mode_balanced", "onboarding.opt.mode_intentional", "onboarding.opt.mode_wait"],
        required: true,
      }
    ]
  },
  {
    template: "onboarding_attraction",
    titleKey: "onboarding.groups.attraction.title",
    descriptionKey: "onboarding.groups.attraction.desc",
    questions: [
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
        kind: "single",
        optionsKeys: ["onboarding.opt.vibe_cafe", "onboarding.opt.vibe_nature", "onboarding.opt.vibe_city", "onboarding.opt.vibe_dorm", "onboarding.opt.vibe_food"],
        required: true,
      },
      {
        id: "attractionHeightAndBuild",
        promptKey: "onboarding.q.attractHeight.prompt",
        whyItMattersKey: "onboarding.q.attractHeight.why",
        placeholderKey: "onboarding.q.attractHeight.placeholder",
        kind: "text",
        required: false,
      },
      {
        id: "attractionFacialFeatures",
        promptKey: "onboarding.q.attractFace.prompt",
        whyItMattersKey: "onboarding.q.attractFace.why",
        placeholderKey: "onboarding.q.attractFace.placeholder",
        kind: "text",
        required: false,
      },
      {
        id: "attractionEnergyAndVibe",
        promptKey: "onboarding.q.attractEnergy.prompt",
        whyItMattersKey: "onboarding.q.attractEnergy.why",
        placeholderKey: "onboarding.q.attractEnergy.placeholder",
        kind: "text",
        required: false,
      }
    ]
  },
  {
    template: "onboarding_media",
    titleKey: "onboarding.groups.media.title",
    descriptionKey: "onboarding.groups.media.desc",
    questions: [
      {
        id: "photoUrls",
        promptKey: "onboarding.q.photos.prompt",
        whyItMattersKey: "onboarding.q.photos.why",
        kind: "photos",
        min: 1,
        max: 5,
        required: true,
      },
      {
        id: "mediaNotes",
        promptKey: "onboarding.q.mediaNotes.prompt",
        whyItMattersKey: "onboarding.q.mediaNotes.why",
        placeholderKey: "onboarding.q.mediaNotes.placeholder",
        kind: "text",
        required: false,
      }
    ]
  }
];

export function findGroup(template: string): QuestionGroup | undefined {
  return onboardingGroups.find((g) => g.template === template);
}
