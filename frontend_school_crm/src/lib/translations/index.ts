import { Language, Translation } from "@/types";
import { commonTranslations } from "./common";
import { toastTranslations } from "./toasts";
import { studentTranslations } from "./students";
import { teacherTranslations } from "./teachers";
import { classTranslations } from "./classes";
import { paymentTranslations } from "./payments";
import { salaryTranslations } from "./salaries";
import { expenseTranslations } from "./expenses";
import { reportTranslations } from "./reports";
import { branchTranslations } from "./branches";
import { settingsTranslations } from "./settings";
import { helpTranslations } from "./help";
import { authTranslations } from "./auth";
import { miscTranslations } from "./misc";
import { attendanceTranslations } from "./attendance";

// Combine all translations into one object
export const translations: Translation = {
  ...commonTranslations,
  ...toastTranslations,
  ...studentTranslations,
  ...teacherTranslations,
  ...classTranslations,
  ...paymentTranslations,
  ...salaryTranslations,
  ...expenseTranslations,
  ...reportTranslations,
  ...branchTranslations,
  ...settingsTranslations,
  ...helpTranslations,
  ...authTranslations,
  ...miscTranslations,
  ...attendanceTranslations
};

/**
 * Retrieves a translation string for a given key and language.
 * Falls back to English if the specified language is not available.
 * @param key - The key of the translation string.
 * @param language - The desired language.
 * @returns The translated string.
 */
export function getTranslation(
  key: keyof Translation,
  language: Language
): string {
  const translationSet = translations[key];
  if (!translationSet) {
    console.warn(`Translation key not found: ${key}`);
    return String(key); // Return the key itself as a fallback
  }

  const translation = translationSet[language] || translationSet.en;
  return translation || String(key); // Fallback to key if no translation is found
}