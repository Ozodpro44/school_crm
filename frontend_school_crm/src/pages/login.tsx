import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck, BookOpen, KeyRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { login as apiLogin, verifyLoginOtp } from "@/lib/api";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { ForgotPasswordModal } from "@/components/ForgotPasswordModal";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { cn } from "@/lib/utils";

type LoginMode = "admin" | "teacher";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [mfaEmail, setMfaEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      router.push(user.role === "teacher" ? "/teacher-portal" : "/");
    }
  }, [router]);

  // Clear error when switching mode
  const switchMode = (m: LoginMode) => {
    setMode(m);
    setError("");
    setEmail("");
    setPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiLogin({ email, password });

      if (response.mfaRequired) {
        setMfaEmail(response.email ?? email);
        setLoading(false);
        return;
      }

      if (response.user && response.token) {
        // `apiLogin` (via @/lib/storage's persistLogin) already wrote the
        // token, the user blob, and any branchId from the response, then
        // emitted AuthEvents.LOGIN so BranchContext can reload. No polling.
        if (response.user.role === "teacher") {
          router.push("/teacher-portal");
        } else {
          router.push("/");
        }
      } else {
        setError(t("invalidEmailOrPassword"));
      }
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("too many")) {
          setError(error.message);
        } else if (msg.includes("invalid") || msg.includes("unauthorized")) {
          setError(t("invalidEmailOrPassword"));
        } else if (msg.includes("network")) {
          setError(t("networkError"));
        } else {
          setError(t("errorOccurred"));
        }
      } else {
        setError(t("errorOccurred"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaEmail) return;
    setError("");
    setLoading(true);
    try {
      const response = await verifyLoginOtp(mfaEmail, otp);
      if (response.user && response.token) {
        router.push(response.user.role === "teacher" ? "/teacher-portal" : "/");
      } else {
        setError(t("invalidEmailOrPassword"));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t("errorOccurred"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      {/* Language and theme were only reachable after signing in, which left
          anyone who doesn't read the default Uzbek stuck on this screen. */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        <LanguageSwitch />
        <ThemeSwitch />
      </div>

      <div className="w-full max-w-md space-y-4">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="w-14 h-14 rounded-2xl bg-brand-square flex items-center justify-center shadow-lg">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-brand-gradient">
            School CRM
          </h1>
        </div>

        {/* Mode switcher */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <button
            type="button"
            onClick={() => switchMode("admin")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
              mode === "admin"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin / Manager
          </button>
          <button
            type="button"
            onClick={() => switchMode("teacher")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
              mode === "teacher"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <BookOpen className="w-4 h-4" />
            Teacher
          </button>
        </div>

        {/* Card */}
        <Card className="shadow-xl border-0">
          <CardHeader className="pb-2 pt-6">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              {mode === "admin"
                ? t("adminLoginSubtitle")
                : t("teacherLoginSubtitle")}
            </p>
          </CardHeader>
          <CardContent className="pb-6">
            {mfaEmail ? (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col items-center text-center gap-2 pb-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <KeyRound className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t("verifyIdentity")}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t("verificationCodeSentTo").replace("{email}", mfaEmail)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otp">{t("verificationCode")}</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    required
                    disabled={loading}
                    className="h-11 text-center text-lg tracking-[0.5em]"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 font-semibold bg-brand hover:bg-brand-hover"
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("verifying")}
                    </>
                  ) : (
                    t("verify")
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => { setMfaEmail(null); setOtp(""); setError(""); }}
                  className="w-full text-center text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
                  disabled={loading}
                >
                  {t("backToLogin")}
                </button>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={mode === "admin" ? "admin@school.com" : "teacher@school.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("password")}</Label>
                  <button
                    type="button"
                    onClick={() => setForgotPasswordOpen(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
                    disabled={loading}
                  >
                    {t("forgotPassword")}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("enterPassword")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50 transition-colors"
                    aria-label={showPassword ? (t("hidePassword")) : (t("showPassword"))}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-semibold bg-brand hover:bg-brand-hover"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("signingIn")}
                  </>
                ) : (
                  t("signIn")
                )}
              </Button>
            </form>
            )}

            {/* /register exists and works (new school sign-up, auto-granted
                a trial) but had no link anywhere pointing to it — a new
                customer landing here had no way to discover it short of
                typing the URL. Admin/Manager tab only: teachers don't
                self-register a school, they're invited by one. */}
            {mode === "admin" && (
              <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
                {t("noAccountYet")}{" "}
                <Link
                  href="/register"
                  className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {t("registerSchool")}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ForgotPasswordModal
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
        language={language}
      />
    </div>
  );
}
