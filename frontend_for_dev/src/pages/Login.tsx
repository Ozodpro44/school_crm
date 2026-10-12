import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ShieldAlert, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/kit/Field";
import { LanguageMenu, ThemeMenu } from "@/components/layout/Topbar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/i18n";
import { login } from "@/services/api-client";

export default function Login() {
  const navigate = useNavigate();
  const { login: authLogin, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error(t("emailPasswordRequired"));
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      authLogin(res.token, res.user);
      toast.success(`${t("welcomeBack")}${res.user.fullName ? `, ${res.user.fullName}` : ""}!`);
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t("authenticationFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex justify-end gap-1 p-4">
        <ThemeMenu />
        <LanguageMenu />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background">
              <Terminal className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("developerPortal")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("internalTools")}</p>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
              <p className="text-xs leading-relaxed text-status-warning">{t("restrictedAccessNotice")}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Field label={t("email")} htmlFor="login-email">
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dev@wonderkids.uz"
                  autoComplete="email"
                  autoFocus
                />
              </Field>
              <Field label={t("password")} htmlFor="login-password">
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Button type="submit" className="w-full gap-2" disabled={loading || !email || !password}>
                {loading ? (<><Loader2 className="h-4 w-4 animate-spin" />{t("authenticating")}</>) : t("signIn")}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
