import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { getTranslation } from "@/lib/translations";
import {
  forgotPassword,
  verifyOTP,
  resendOTP,
  resetPassword,
} from "@/lib/auth-api";

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: string;
}

type Step = "email" | "otp" | "reset-password";

export function ForgotPasswordModal({
  open,
  onOpenChange,
  language,
}: ForgotPasswordModalProps) {
  const t = (key: string) => getTranslation(key, language);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await forgotPassword(email);
      setMessage(t("otpSent"));
      setStep("otp");
      setResendTimer(60);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t("errorOccurred");
      // Special handling for admin-only error
      if (errorMsg.includes("only admin")) {
        setError("Password reset is only available for admin users");
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (otp.length !== 6) {
        throw new Error("OTP must be 6 digits");
      }

      const response = await verifyOTP(email, otp);
      setResetToken(response.resetToken);
      setMessage(t("otpVerified"));
      setStep("reset-password");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorOccurred"));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      if (newPassword !== confirmPassword) {
        throw new Error(t("passwordsDoNotMatch"));
      }

      await resetPassword(email, resetToken, newPassword);
      setMessage(t("passwordReset"));
      
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorOccurred"));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");
    setLoading(true);

    try {
      await resendOTP(email);
      setMessage(t("otpSent"));
      setResendTimer(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorOccurred"));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep("email");
    setEmail("");
    setOtp("");
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setMessage("");
    setResendTimer(0);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const goBack = () => {
    if (step === "otp") {
      setStep("email");
      setOtp("");
      setError("");
      setMessage("");
      setResendTimer(0);
    } else if (step === "reset-password") {
      setStep("otp");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setMessage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("forgotPasswordTitle")}</DialogTitle>
          <DialogDescription>
            {step === "email" && t("enterEmail")}
            {step === "otp" && t("enterOTP")}
            {step === "reset-password" && t("enterNewPassword")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert className="bg-green-50 border-green-200 text-green-800">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {step === "email" && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">{t("email")}</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="admin@school.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("sendOTP")}
                  </>
                ) : (
                  t("sendOTP")
                )}
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp-code">{t("otp")}</Label>
                <Input
                  id="otp-code"
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  required
                  disabled={loading}
                  className="h-11 text-center text-2xl tracking-widest font-mono"
                />
                <p className="text-sm text-slate-500">
                  {t("otpSent")}
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                disabled={loading || otp.length !== 6}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("verifyOTP")}
                  </>
                ) : (
                  t("verifyOTP")
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11"
                onClick={handleResendOTP}
                disabled={resendTimer > 0 || loading}
              >
                {resendTimer > 0
                  ? t("resendIn").replace("{seconds}", resendTimer.toString())
                  : t("resendOTP")}
              </Button>
            </form>
          )}

          {step === "reset-password" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("newPassword")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder={t("enterNewPassword")}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder={t("confirmPassword")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("resetPassword")}
                  </>
                ) : (
                  t("resetPassword")
                )}
              </Button>
            </form>
          )}

          {step !== "email" && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={goBack}
              disabled={loading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("backToLogin")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
