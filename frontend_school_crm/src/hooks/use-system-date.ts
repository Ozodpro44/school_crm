import { useCallback } from "react";
import { useSettings } from "./use-settings";

export function useSystemDate() {
  const { settings } = useSettings();

  const getSystemMonth = useCallback(() => {
    return settings?.currentMonth || "01";
  }, [settings]);

  const getSystemYear = useCallback(() => {
    return settings?.currentYear || new Date().getFullYear();
  }, [settings]);

  const getSystemYearString = useCallback(() => {
    return getSystemYear().toString();
  }, [getSystemYear]);

  return {
    getSystemMonth,
    getSystemYear,
    getSystemYearString,
  };
}
