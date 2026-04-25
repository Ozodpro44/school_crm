import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck, BookOpen } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { login as apiLogin } from "@/lib/api";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { ForgotPasswordModal } from "@/components/ForgotPasswordModal";
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

      if (response.user && response.token) {
        localStorage.removeItem("selectedBranchId");

        if (response.user.role === "teacher") {
          // Teachers don't go through BranchContext — set branchId directly so
          // apiRequest can attach the X-Branch-ID header on subsequent calls.
          if (response.user.branchId) {
            localStorage.setItem("selectedBranchId", response.user.branchId);
          }
          router.push("/teacher-portal");
        } else {
          let retries = 0;
          const maxRetries = 30;
          while (!localStorage.getItem("selectedBranchId") && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }

          router.push("/");
        }
      } else {
        setError(t("invalidEmailOrPassword"));
      }
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("invalid") || msg.includes("unauthorized")) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
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
                ? t("adminLoginSubtitle") || "Sign in to manage your school"
                : t("teacherLoginSubtitle") || "Sign in to access your teacher portal"}
            </p>
          </CardHeader>
          <CardContent className="pb-6">
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
                    aria-label={showPassword ? "Hide password" : "Show password"}
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
