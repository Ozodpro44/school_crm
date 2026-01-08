import { useEffect } from 'react';

/**
 * Hook that refetches data when the page regains focus
 * (user switches back from another tab/app or unminiminizes the window)
 */
export function useRefetchOnFocus(callback: () => void | Promise<void>) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        callback();
      }
    };

    const handleFocus = () => {
      callback();
    };

    // Listen for visibility changes (tab switching, minimize/restore)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for window focus (some browsers may not trigger visibilitychange)
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [callback]);
}
