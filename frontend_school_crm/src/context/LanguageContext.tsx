import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Language, Settings } from "@/types";
import { getSettings, updateSettings } from "@/lib/api";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  settings: Settings | null;
  isInitialized: boolean;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

// Event emitter for language changes
const languageListeners = new Set<(language: Language) => void>();

export function notifyLanguageChange(language: Language) {
  languageListeners.forEach((listener) => listener(language));
}

export function subscribeToLanguageChange(
  callback: (language: Language) => void
) {
  languageListeners.add(callback);
  return () => {
    // ensure cleanup returns void (Set.delete returns boolean)
    languageListeners.delete(callback);
  };
}

// Default settings
const DEFAULT_SETTINGS: Settings = {
  id: "default",
  branchId: "default",
  defaultMonthlyPayment: 500000,
  defaultTeacherSalary: 3000000,
  currency: "UZS",
  language: "uz-latn",
  schoolName: "School CRM",
  currentMonth: "01",
  currentYear: new Date().getFullYear(),
  updatedAt: new Date().toISOString(),
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("uz-latn");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Load settings from backend on mount and when branch changes
    const loadSettings = async () => {
      try {
        // Call without branchId - it will be extracted from JWT by backend
        const data = await getSettings();
        setSettings(data);
        setLanguageState(data.language);
      } catch (error) {
        // Fallback to defaults if loading fails
        setSettings(DEFAULT_SETTINGS);
        setLanguageState("uz-latn");
        console.warn("Failed to load settings from backend:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadSettings();

    // Listen for branch changes via storage events
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "selectedBranchId") {
        loadSettings();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    // Subscribe to language changes from any component
    const unsubscribe = subscribeToLanguageChange((newLanguage) => {
      setLanguageState(newLanguage);
    });

    return unsubscribe;
  }, []);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    // Update language on backend (without branchId - uses JWT)
    updateSettings({ language: newLanguage }).catch(() => {
      // Silently fail - language will still update locally
    });
    notifyLanguageChange(newLanguage);
  };

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, settings, isInitialized }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context.language;
}

export function useSetLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useSetLanguage must be used within LanguageProvider");
  }
  return context.setLanguage;
}

export function useContextSettings() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useContextSettings must be used within LanguageProvider");
  }
  return { settings: context.settings, isInitialized: context.isInitialized };
}
