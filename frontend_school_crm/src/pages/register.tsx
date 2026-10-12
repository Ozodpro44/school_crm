import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, AlertCircle, Loader2, Eye, EyeOff, PartyPopper, KeyRound } from "lucide-react";
import { register as apiRegister, verifyRegistrationOtp } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registered, setRegistered] = useState(false);
  // Set once the form step succeeds — switches the card into the "enter the
  // code we emailed you" step. Mirrors login.tsx's mfaEmail exactly.
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      router.push("/");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !confirmPassword || !fullName || !schoolName) {
      setError(t("fillAllFields"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("passwordsDoNotMatch"));
      return;
    }

    if (password.length < 6) {
      setError(t("passwordMinLength"));
      return;
    }

    setLoading(true);

    try {
      const response = await apiRegister({
        email,
        password,
        fullName,
        role: "admin",
        schoolName,
      });

      if (response.emailVerificationRequired) {
        // Nothing is persisted yet — no subscription/permissions exist until
        // the code below is confirmed via verifyRegistrationOtp().
        setOtpEmail(response.email ?? email);
      } else {
        setError(t("registrationFailed"));
      }
    } catch (error) {
      console.error("Registration error:", error);
      setError(
        error instanceof Error ? error.message : t("registrationFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail) return;
    setError("");
    setLoading(true);
    try {
      const response = await verifyRegistrationOtp(otpEmail, otp);
      if (response.token && response.user) {
        // Token and user are stored by verifyRegistrationOtp via persistLogin.
        setRegistered(true);
        // Brief pause so the success banner is readable before redirect.
        // → /onboarding-branch, not "/": a freshly-verified admin has no
        // branch yet (registration no longer manufactures one with fake
        // placeholder address/phone), so every branch-scoped page would
        // otherwise show nothing but empty states.
        setTimeout(() => router.push("/onboarding-branch"), 2000);
      } else {
        setError(t("registrationFailed"));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t("registrationFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-square flex items-center justify-center shadow-lg">
              <PartyPopper className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-brand-gradient">
              {t("welcomeToSchool").replace("{schoolName}", schoolName)}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {/* 30 matches auth_service's freeTrialDays constant — the trial
                  length isn't returned in the API response, so this mirrors
                  that constant. Update both together if it ever changes. */}
              {t("trialStartedMessage").replace("{days}", "30")}
            </p>
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mt-2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-square flex items-center justify-center shadow-lg">
              <GraduationCap className="w-10 h-10 text-white" />
            </div>
          </div>
          {!otpEmail && (
            <>
              <CardTitle className="text-3xl font-bold text-center text-brand-gradient">
                {t("createAccount")}
              </CardTitle>
              <CardDescription className="text-center text-base">
                {t("createAccountSubtitle")}
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {otpEmail ? (
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
                  {t("verificationCodeSentTo").replace("{email}", otpEmail)}
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
                onClick={() => { setOtpEmail(null); setOtp(""); setError(""); }}
                className="w-full text-center text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
              >
                {t("backToLogin")}
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="schoolName">{t("schoolName")}</Label>
                  <Input
                    id="schoolName"
                    type="text"
                    placeholder="Wonderkids Academy"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("fullName")}</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@school.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
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
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 text-base font-semibold bg-brand hover:bg-brand-hover"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {loading ? (t("creatingAccount")) : (t("createAccount"))}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("alreadyHaveAccount")}{" "}
                  <Link
                    href="/login"
                    className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold"
                  >
                    {t("signIn")}
                  </Link>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
