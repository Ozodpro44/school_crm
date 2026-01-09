import { useEffect, useState, useContext } from "react";
import { getSettings } from "@/lib/api";
import { Settings } from "@/types";
import { LanguageContext } from "@/context/LanguageContext";
import { getCurrentUser } from "@/lib/auth";

// Default settings fallback
const DEFAULT_SETTINGS: Settings = {
  name: "Wonderkids' CRM",
  monthlyPayment: 500000,
  currency: "UZS",
  updatedDate: new Date().toISOString(),
  createdDate: new Date().toISOString(),
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Try to get settings from LanguageContext (loaded once on app mount)
  const context = useContext(LanguageContext);

  useEffect(() => {
    // If settings already loaded via LanguageContext, use them
    if (context?.settings && context?.isInitialized) {
      setSettings(context.settings);
      setLoading(false);
      return;
    }

    // Otherwise fetch from backend
    const fetchSettings = async () => {
      try {
        setLoading(true);
        
        // Check if user is authenticated before fetching
        const user = getCurrentUser();
        if (!user) {
          // User not logged in, use defaults
          setSettings(DEFAULT_SETTINGS);
          setError(null);
          setLoading(false);
          return;
        }

        const data = await getSettings();
        setSettings(data);
        setError(null);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to load settings");
        setError(error);
        // Use default settings as fallback
        setSettings(DEFAULT_SETTINGS);
        console.warn(
          "Failed to fetch settings from backend, using defaults:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [context?.settings, context?.isInitialized]);

  return { settings, loading, error };
}
