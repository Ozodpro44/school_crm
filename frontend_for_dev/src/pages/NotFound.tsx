import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/i18n";

export default function NotFound() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-sm text-center">
        <p className="font-mono text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{t("pageDoesNotExist")}</h1>
        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{window.location.pathname}</p>
        <Button asChild className="mt-6 gap-2">
          <Link to="/"><ArrowLeft className="h-4 w-4" />{t("backToDashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
