import { createContext, useContext, useState, ReactNode } from "react";
import { Language } from "@/lib/i18n/types";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem("language");
    if (stored === "en" || stored === "ru" || stored === "uz") return stored;
  } catch {
    // localStorage unavailable — fall through to default
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("language", lang);
    } catch {
      // best-effort persistence only
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
