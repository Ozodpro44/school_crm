import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { LanguageProvider } from "@/context/LanguageContext";
import { BranchProvider } from "@/context/BranchContext";
import { Layout } from "@/components/Layout";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { WifiOff, RefreshCw } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { getTranslation } from "@/lib/translations";

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);
  const language = useLanguage();
  const t = useCallback((key: string) => getTranslation(key as never, language), [language]);

  useEffect(() => {
    // Set initial state safely (SSR guard)
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // "Connection restored" flash banner
  if (showRestored) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-500 text-white px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top-2 duration-300">
        <RefreshCw className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">{t("connectionRestored")}</span>
      </div>
    );
  }

  // Persistent offline banner
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2 min-w-0">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-semibold">{t("offlineBannerTitle")} · </span>
            <span className="text-sm text-red-100">{t("offlineBannerDesc")}</span>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex-shrink-0 text-xs font-medium bg-white/20 hover:bg-white/30 transition-colors px-3 py-1 rounded-full"
        >
          {t("retryConnection")}
        </button>
      </div>
    );
  }

  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAuthPage = router.pathname === "/login" || router.pathname === "/register";

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <LanguageProvider>
        <BranchProvider>
          <OfflineBanner />
          {isAuthPage ? (
            <>
              <Component {...pageProps} />
              <Toaster />
            </>
          ) : (
            <Layout>
              <Component {...pageProps} />
              <Toaster />
            </Layout>
          )}
        </BranchProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
