import { useCallback } from "react";

export function useSystemDate() {
  const getSystemMonth = useCallback(() => {
    const month = new Date().getMonth() + 1;
    return month.toString().padStart(2, "0");
  }, []);

  const getSystemYear = useCallback(() => {
    return new Date().getFullYear();
  }, []);

  const getSystemYearString = useCallback(() => {
    return getSystemYear().toString();
  }, [getSystemYear]);

  return {
    getSystemMonth,
    getSystemYear,
    getSystemYearString,
  };
}
