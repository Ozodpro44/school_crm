import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { LanguageProvider } from "@/context/LanguageContext";
import { Layout } from "@/components/Layout";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";

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
      </LanguageProvider>
    </ThemeProvider>
  );
}
