export type Language = "en" | "ru" | "uz";

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "uz", label: "O'zbek" },
];

export type TranslationEntry = Record<Language, string>;
export type Translation = Record<string, TranslationEntry>;
