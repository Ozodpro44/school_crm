import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { LanguageProvider } from "@/context/LanguageContext";
import { BranchProvider } from "@/context/BranchContext";
import { Layout } from "@/components/Layout";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import { toast, useToast } from "@/hooks/use-toast";

function NetworkStatusHandler() {
  const { dismiss } = useToast();
  const offlineToastIdRef = useRef<string | null>(null);
  const isOnlineRef = useRef<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      // Prevent multiple calls
      if (isOnlineRef.current) return;
      isOnlineRef.current = true;

      // Dismiss the offline toast if it exists
      if (offlineToastIdRef.current) {
        dismiss(offlineToastIdRef.current);
        offlineToastIdRef.current = null;
      }

      // Show reconnected toast
      toast({
        title: "Connected",
        description: "Network connection restored. Reloading page...",
        variant: "default",
      });

      // Reload the page after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };

    const handleOffline = () => {
      // Prevent multiple calls
      if (!isOnlineRef.current) return;
      isOnlineRef.current = false;

      // Don't create duplicate toasts
      if (offlineToastIdRef.current) return;

      // Show offline toast
      const offlineToast = toast({
        title: "No Connection",
        description: "You are currently offline. Please check your internet connection.",
        variant: "destructive",
      });
      offlineToastIdRef.current = offlineToast.id;
    };

    // Check initial connection status
    if (!navigator.onLine) {
      handleOffline();
    }

    // Add event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [dismiss]);

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
          <NetworkStatusHandler />
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
