import { useEffect, useState } from "react";
import { useRouter } from "next/router";
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
import { Building2, AlertCircle, Loader2 } from "lucide-react";
import * as api from "@/lib/api";
import { getCurrentUser, logout } from "@/lib/auth";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";

export default function OnboardingBranchPage() {
  const router = useRouter();
  const { branches, isLoading: branchesLoading, refreshBranches } = useBranch();
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState(100000);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push("/login");
      return;
    }
    // Someone who already has a branch (e.g. hit this URL directly, or an
    // existing multi-branch admin) has nothing to onboard — send them home.
    if (!branchesLoading && branches.length > 0) {
      router.push("/");
    }
  }, [router, branches.length, branchesLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || !address || !phone) {
      setError(t("fillAllFields"));
      return;
    }
    if (monthlyPayment <= 0) {
      setError(t("monthlyPaymentMustBePositive"));
      return;
    }

    setLoading(true);
    try {
      const user = getCurrentUser();
      await api.createBranch({
        name,
        address,
        phone,
        monthlyPayment,
        adminId: user?.id,
      });
      await refreshBranches();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToSaveBranch"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-square flex items-center justify-center shadow-lg">
              <Building2 className="w-10 h-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center text-brand-gradient">
            {t("setUpFirstBranch")}
          </CardTitle>
          <CardDescription className="text-center text-base">
            {t("setUpFirstBranchSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{t("branchName")} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Чилонзор филиали"
                required
                disabled={loading}
                className="h-11"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{t("address")} *</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Тошкент ш., Чилонзор т., 12-кв, 34-уй"
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")} *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyPayment">{t("monthlyPaymentForBranch")} *</Label>
              <Input
                id="monthlyPayment"
                type="number"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(parseInt(e.target.value) || 0)}
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-base font-semibold bg-brand hover:bg-brand-hover"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("createBranchAndContinue")}
            </Button>

            <button
              type="button"
              onClick={() => logout()}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium transition-colors"
            >
              {t("logout")}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
