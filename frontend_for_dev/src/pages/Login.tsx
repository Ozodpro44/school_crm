import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { login, register } from "@/services/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Terminal, Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export default function Login() {
  const navigate = useNavigate();
  const { login: authLogin, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password are required"); return; }
    if (mode === "register" && !fullName.trim()) { toast.error("Full name is required"); return; }
    setLoading(true);
    try {
      const res = mode === "login"
        ? await login(email, password)
        : await register(email, password, fullName);
      authLogin(res.token, res.user);
      toast.success(`Welcome${res.user.fullName ? `, ${res.user.fullName}` : ""}!`);
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 font-mono">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(16,185,129,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 mb-4">
            <Terminal className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Developer Portal</h1>
          <p className="text-xs text-muted-foreground mt-1">Wonderkids CRM · Internal Tools</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-status-warning/8 border border-status-warning/20 mb-5">
            <ShieldAlert className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-status-warning/90 leading-relaxed">
              Restricted access — developer credentials only. All actions are logged.
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 bg-muted rounded-lg p-1 mb-5">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 py-1.5 text-xs rounded-md transition-colors capitalize font-medium",
                  mode === m ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            )}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dev@wonderkids.uz"
                autoComplete="email"
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-1 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground rounded-lg py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating...</>
              ) : (
                mode === "login" ? "Sign in" : "Create account"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/40 mt-4 font-mono">
          dev portal v2 · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
