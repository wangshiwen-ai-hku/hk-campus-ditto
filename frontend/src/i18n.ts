import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getStoredLocale } from "./lib/session";

import en from "./locales/en.json";
import zhHK from "./locales/zh-HK.json";
import zhCN from "./locales/zh-CN.json";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "zh-HK": { translation: zhHK },
      "zh-CN": { translation: zhCN },
    },
    lng: getStoredLocale(),
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
