import { cn } from "@/lib/utils";
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    // lang matches the app's default language (LanguageContext starts at
    // "uz-latn"); it used to be hardcoded "en", which told screen readers and
    // browser translation that an Uzbek UI was English. LanguageContext keeps
    // this attribute in sync when the user switches language.
    // data-scroll-behavior is required by Next 15 to keep it from warning
    // about the global `scroll-behavior: smooth`.
    <Html lang="uz" data-scroll-behavior="smooth">
      <Head>
        {/* Favicons and App Icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        {/* Was a single hardcoded white, which left the mobile browser chrome
            light while the app rendered in dark mode. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0f19" />
        

      </Head>
      <body
        className={cn(
          "min-h-screen w-full scroll-smooth bg-background text-foreground antialiased"
        )}
      >
        <Main />
        <NextScript />


      </body>
    </Html>
  );
}
