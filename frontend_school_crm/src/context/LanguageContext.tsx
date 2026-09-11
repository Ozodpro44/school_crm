import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Language, Settings } from "@/types";
import { getSettings } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { AuthEvents, getStoredBranchId, StorageKeys } from "@/lib/storage";

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
  name: "Wonderkids' CRM",
  monthlyPayment: 500000,
  currency: "UZS",
  updatedDate: new Date().toISOString(),
  createdDate: new Date().toISOString(),
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("uz-latn");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Load language from localStorage
    const savedLanguage = localStorage.getItem("language") as Language | null;
    if (savedLanguage && ["uz-cyrl", "uz-latn", "en"].includes(savedLanguage)) {
      setLanguageState(savedLanguage);
    }

    // Load settings from backend on mount and when branch changes.
    // Always reads selectedBranchId from localStorage so the backend gets a
    // branchId even when called before the BranchContext has fully hydrated.
    const loadSettings = async () => {
      try {
        // Only fetch settings if user is authenticated
        const user = getCurrentUser();
        if (!user) {
          setSettings(DEFAULT_SETTINGS);
          setIsInitialized(true);
          return;
        }

        const branchId = getStoredBranchId() ?? undefined;
        const data = await getSettings(branchId);
        setSettings(data);
      } catch (error) {
        // Fallback to defaults if loading fails
        setSettings(DEFAULT_SETTINGS);
        console.warn("Failed to load settings from backend:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadSettings();

    // Cross-tab: another tab changed branch.
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === StorageKeys.BRANCH_ID) {
        loadSettings();
      }
    };
    // Same-tab: BranchContext / api.ts fire this on branch change.
    const handleBranchChange = () => loadSettings();

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(AuthEvents.BRANCH_CHANGE, handleBranchChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(AuthEvents.BRANCH_CHANGE, handleBranchChange);
    };
  }, []);

  useEffect(() => {
    // Subscribe to language changes from any component
    const unsubscribe = subscribeToLanguageChange((newLanguage) => {
      setLanguageState(newLanguage);
    });

    return unsubscribe;
  }, []);

  // Keep <html lang> in step with the chosen language so screen readers use
  // the right pronunciation rules and browsers offer the right translation.
  // _document renders a static lang="uz"; this updates it on every change,
  // including the initial read from localStorage.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language === "en" ? "en" : "uz";
  }, [language]);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    // Store language preference in localStorage
    localStorage.setItem("language", newLanguage);
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
