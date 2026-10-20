import { useEffect } from "react";
import { useRouter } from "next/router";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { getCurrentUser } from "@/lib/auth";
import { StaffPanel } from "@/components/panels/StaffPanel";

// Face ID staff: admin-only, like every /hikvision endpoint behind it.
export default function StaffPage() {
  const router = useRouter();
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  useEffect(() => {
    if (getCurrentUser()?.role !== "admin") router.replace("/");
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-slate-900 dark:text-slate-100">{t("staffPage")}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{t("staffPageSubtitle")}</p>
      </div>
      <StaffPanel />
    </div>
  );
}
