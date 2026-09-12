import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { LanguageProvider } from "@/context/LanguageContext";
import { BranchProvider } from "@/context/BranchContext";
import { Layout } from "@/components/Layout";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { getTranslation } from "@/lib/translations";
import { validateConfig, hasFatalConfigError, type ConfigError } from "@/lib/config";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/query-client";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Run config validation once at module load (server + client).
// Logs warnings to console; fatal errors are surfaced in the UI.
const configErrors: ConfigError[] = validateConfig();
if (typeof window === "undefined") {
  // Server-side: always log so Railway/Docker logs capture it
  for (const e of configErrors) {
    const prefix = e.fatal ? "[CONFIG FATAL]" : "[CONFIG WARN]";
    console.warn(`${prefix} ${e.variable}: ${e.message}`);
  }
}

function ConfigErrorScreen({ errors }: { errors: ConfigError[] }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-white flex-shrink-0" />
          <div>
            <h1 className="text-white font-bold text-lg">Configuration Error</h1>
            <p className="text-red-100 text-sm">The app cannot start due to missing environment variables.</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {errors.map((e, i) => (
            <div key={i} className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-mono text-sm font-semibold text-red-700">{e.variable}</p>
                <p className="text-sm text-red-600 mt-0.5">{e.message}</p>
              </div>
            </div>
          ))}
          <div className="text-sm text-slate-500 pt-2 border-t">
            Set the missing environment variables in your Railway / Vercel dashboard, then redeploy.
          </div>
        </div>
      </div>
    </div>
  );
}

function useLastSyncAgo() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    function compute() {
      const raw = localStorage.getItem("lastSyncAt");
      if (!raw) { setLabel(null); return; }
      const diffMs = Date.now() - parseInt(raw, 10);
      const diffMin = Math.floor(diffMs / 60_000);
      if (diffMin < 1) setLabel("< 1 min ago");
      else if (diffMin < 60) setLabel(`${diffMin} min ago`);
      else setLabel(`${Math.floor(diffMin / 60)} h ago`);
    }
    compute();
    const id = setInterval(compute, 30_000);
    return () => clearInterval(id);
  }, []);

  return label;
}

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);
  const lastSyncAgo = useLastSyncAgo();
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
            {lastSyncAgo && (
              <span className="text-xs text-red-200 ml-2">
                {t("lastUpdated")} {lastSyncAgo}
              </span>
            )}
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
  const isAuthPage =
    router.pathname === "/login" ||
    router.pathname === "/register" ||
    router.pathname === "/onboarding-branch";

  // Show fatal config error screen before rendering anything else
  if (hasFatalConfigError(configErrors)) {
    return <ConfigErrorScreen errors={configErrors.filter((e) => e.fatal)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <LanguageProvider>
          <BranchProvider>
            <OfflineBanner />
            <ErrorBoundary>
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
            </ErrorBoundary>
          </BranchProvider>
        </LanguageProvider>
      </ThemeProvider>
      {/* DevTools only visible in development */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
