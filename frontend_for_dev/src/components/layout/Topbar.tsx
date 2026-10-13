import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Check, Globe, LogOut, Menu, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/i18n/types";
import { getHealth } from "@/services/api-client";
import { initialsOf } from "@/lib/format";
import { useInterval } from "@/hooks/useInterval";
import { cn } from "@/lib/utils";

type ApiState = { kind: "checking" } | { kind: "up"; ms: number } | { kind: "down" };

function ApiStatus() {
  const { language } = useLanguage();
  const t = (k: string) => getTranslation(k, language);
  const [state, setState] = useState<ApiState>({ kind: "checking" });

  const check = useCallback(async () => {
    try {
      const h = await getHealth();
      setState({ kind: "up", ms: h.responseTime });
    } catch {
      setState({ kind: "down" });
    }
  }, []);

  useEffect(() => { void check(); }, [check]);
  useInterval(() => void check(), 60_000, true);

  const label = state.kind === "up" ? t("apiOnline") : state.kind === "down" ? t("apiOffline") : t("apiChecking");
  const dot = state.kind === "up" ? "bg-status-healthy" : state.kind === "down" ? "bg-status-critical" : "bg-muted-foreground/50";

  return (
    <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground" role="status" aria-live="polite">
      <span className="relative flex h-2 w-2">
        {state.kind === "up" && (
          <span className="absolute inset-0 rounded-full bg-status-healthy" style={{ animation: "live-ping 2.4s ease-out infinite" }} />
        )}
        <span className={cn("relative h-2 w-2 rounded-full", dot)} />
      </span>
      <span className="hidden sm:inline">{label}</span>
      {state.kind === "up" && <span className="tnum font-mono text-foreground">{state.ms}ms</span>}
    </div>
  );
}

export function ThemeMenu() {
  const { theme = "system", setTheme } = useTheme();
  const { language } = useLanguage();
  const t = (k: string) => getTranslation(k, language);
  const options = [
    { value: "light", label: t("themeLight"), icon: Sun },
    { value: "dark", label: t("themeDark"), icon: Moon },
    { value: "system", label: t("themeSystem"), icon: Monitor },
  ];
  const Current = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("theme")}>
          <Current className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t("theme")}</DropdownMenuLabel>
        {options.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)} className="gap-2">
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            {theme === value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LanguageMenu() {
  const { language, setLanguage } = useLanguage();
  const t = (k: string) => getTranslation(k, language);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-1.5 px-2.5" aria-label={t("language")}>
          <Globe className="h-4 w-4" />
          <span className="text-xs font-medium uppercase">{language}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.value} onSelect={() => setLanguage(l.value)} className="gap-2">
            <span className="flex-1">{l.label}</span>
            {language === l.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (k: string) => getTranslation(k, language);
  const name = user?.fullName || "Developer";

  const handleLogout = () => {
    logout();
    toast.success(t("signedOut"));
    navigate("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={t("account")}
        >
          {initialsOf(name || user?.email)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          {user?.role && <p className="mt-1 text-[11px] capitalize text-muted-foreground">{user.role}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} className="gap-2 text-status-critical focus:text-status-critical">
          <LogOut className="h-4 w-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { language } = useLanguage();
  const t = (k: string) => getTranslation(k, language);
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label={t("openMenu")}>
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex-1" />
      <ApiStatus />
      <ThemeMenu />
      <LanguageMenu />
      <UserMenu />
    </div>
  );
}
