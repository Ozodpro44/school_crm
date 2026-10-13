import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { StatusPill } from "@/components/kit/StatusPill";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { EmptyState, ErrorNotice } from "@/components/kit/States";
import { RefreshButton } from "@/components/kit/Toolbar";
import { RowActions } from "@/components/kit/RowActions";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { Field, SwitchRow } from "@/components/kit/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import {
  createPaymentType, deletePaymentType, listPaymentTypes, togglePaymentType, updatePaymentType,
  type PaymentType,
} from "@/services/api-client";

const bySort = (a: PaymentType, b: PaymentType) => a.sortOrder - b.sortOrder;

export default function PaymentTypes() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const res = useResource(async () => (await listPaymentTypes()).sort(bySort), t("failedToLoadPaymentTypes"));
  const types = res.data ?? [];

  const [dialog, setDialog] = useState<{ kind: "form"; type: PaymentType | null } | { kind: "delete"; type: PaymentType } | null>(null);
  const [seq, setSeq] = useState(0);
  const open = (d: NonNullable<typeof dialog>) => { setSeq((n) => n + 1); setDialog(d); };
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const upsert = (pt: PaymentType) =>
    res.setData((d) => {
      const list = d ?? [];
      return (list.some((x) => x.id === pt.id) ? list.map((x) => (x.id === pt.id ? pt : x)) : [...list, pt]).sort(bySort);
    });

  const toggle = async (pt: PaymentType) => {
    setTogglingId(pt.id);
    try {
      const updated = await togglePaymentType(pt.id);
      upsert(updated);
      toast.success(tf(updated.isActive ? t("typeActivated") : t("typeDeactivated"), { name: updated.displayName }));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("toggleFailed"));
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = types.filter((x) => x.isActive).length;
  const systemCount = types.filter((x) => x.isSystem).length;

  const columns: Column<PaymentType>[] = useMemo(() => [
    {
      key: "code",
      header: t("code"),
      cell: (pt: PaymentType) => <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">{pt.code}</code>,
    },
    { key: "name", header: t("displayName"), cell: (pt: PaymentType) => <span className="font-medium text-foreground">{pt.displayName}</span> },
    {
      key: "desc",
      header: t("description"),
      wrap: true,
      showFrom: "md" as const,
      cell: (pt: PaymentType) => <span className="line-clamp-1 max-w-xs text-muted-foreground">{pt.description || "—"}</span>,
    },
    { key: "order", header: t("order"), align: "center" as const, showFrom: "sm" as const, cell: (pt: PaymentType) => <span className="tnum font-mono text-muted-foreground">{pt.sortOrder}</span> },
    {
      key: "active",
      header: t("active"),
      align: "center" as const,
      cell: (pt: PaymentType) => (
        <Switch checked={pt.isActive} disabled={togglingId === pt.id} onCheckedChange={() => void toggle(pt)} aria-label={t("active")} />
      ),
    },
    {
      key: "kind",
      header: t("type"),
      align: "center" as const,
      showFrom: "sm" as const,
      cell: (pt: PaymentType) => <StatusPill tone={pt.isSystem ? "info" : "neutral"}>{pt.isSystem ? t("system") : t("custom")}</StatusPill>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("actions")}</span>,
      align: "right" as const,
      className: "w-12",
      cell: (pt: PaymentType) => (
        <RowActions
          actions={[
            { label: t("edit"), icon: Pencil, onSelect: () => open({ kind: "form", type: pt }) },
            {
              label: t("delete"), icon: Trash2, destructive: true, separated: true, disabled: pt.isSystem,
              title: pt.isSystem ? t("systemTypesCannotBeDeleted") : undefined,
              onSelect: () => open({ kind: "delete", type: pt }),
            },
          ]}
        />
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [language, togglingId]);

  return (
    <DashboardLayout>
      <PageHeader
        title={t("paymentTypesTitle")}
        description={res.data ? tf(t("typesCountSummary"), { count: types.length, activeCount, systemCount }) : undefined}
        actions={
          <>
            <RefreshButton onClick={() => void res.reload()} busy={res.fetching} />
            <Button className="gap-2" onClick={() => open({ kind: "form", type: null })}>
              <Plus className="h-4 w-4" />
              {t("addType")}
            </Button>
          </>
        }
      />

      {res.error && <ErrorNotice message={res.error} onRetry={() => void res.reload()} />}

      <DataTable
        columns={columns}
        rows={types}
        rowKey={(pt) => pt.id}
        loading={res.loading}
        empty={<EmptyState icon={Wallet} title={t("noPaymentTypesFound")} />}
      />

      <PaymentTypeDialog
        key={`pt-${seq}`}
        open={dialog?.kind === "form"}
        type={dialog?.kind === "form" ? dialog.type : null}
        busy={busy}
        t={t}
        onClose={() => setDialog(null)}
        onSubmit={async (v) => {
          const editing = dialog?.kind === "form" ? dialog.type : null;
          setBusy(true);
          try {
            if (editing) {
              upsert(await updatePaymentType(editing.id, {
                displayName: v.displayName, description: v.description || undefined, isActive: v.isActive, sortOrder: v.sortOrder,
              }));
              toast.success(t("paymentTypeUpdated"));
            } else {
              upsert(await createPaymentType({
                code: v.code, displayName: v.displayName, description: v.description || undefined, isActive: v.isActive, sortOrder: v.sortOrder,
              }));
              toast.success(t("paymentTypeCreated"));
            }
            setDialog(null);
          } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : t("saveFailed"));
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("deletePaymentType")}
        description={tf(t("deletePaymentTypeConfirm"), {
          name: dialog?.kind === "delete" ? dialog.type.displayName : "",
          code: dialog?.kind === "delete" ? dialog.type.code : "",
        })}
        confirmLabel={t("delete")}
        busy={busy}
        onConfirm={async () => {
          if (dialog?.kind !== "delete") return;
          setBusy(true);
          try {
            await deletePaymentType(dialog.type.id);
            res.setData((d) => (d ?? []).filter((x) => x.id !== dialog.type.id));
            toast.success(t("paymentTypeDeleted"));
            setDialog(null);
          } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : t("deleteFailed"));
          } finally {
            setBusy(false);
          }
        }}
      />
    </DashboardLayout>
  );
}

interface TypeValues { code: string; displayName: string; description: string; isActive: boolean; sortOrder: number }

function PaymentTypeDialog({
  open, type, busy, t, onClose, onSubmit,
}: {
  open: boolean; type: PaymentType | null; busy: boolean; t: (k: string) => string;
  onClose: () => void; onSubmit: (v: TypeValues) => void;
}) {
  const [v, setV] = useState({
    code: type?.code ?? "",
    displayName: type?.displayName ?? "",
    description: type?.description ?? "",
    isActive: type?.isActive ?? true,
    sortOrder: String(type?.sortOrder ?? 0),
  });

  const submit = () => {
    if (!v.code.trim() || !v.displayName.trim()) return void toast.error(t("codeDisplayNameRequired"));
    const order = Number(v.sortOrder);
    onSubmit({
      code: v.code.trim(),
      displayName: v.displayName.trim(),
      description: v.description.trim(),
      isActive: v.isActive,
      sortOrder: Number.isFinite(order) ? Math.trunc(order) : 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{type ? t("editPaymentType") : t("newPaymentType")}</DialogTitle>
          <DialogDescription>{type ? t("internalIdentifierNotice") : t("shortDescriptionShownToUsers")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("code")}>
            <Input
              value={v.code}
              disabled={!!type}
              onChange={(e) => setV({ ...v, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
              placeholder="click_uz"
              className="font-mono"
              autoFocus={!type}
            />
          </Field>
          <Field label={t("displayName")}>
            <Input value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} autoFocus={!!type} />
          </Field>
          <Field label={t("description")}>
            <Input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder={t("shortDescriptionShownToUsers")} />
          </Field>
          <Field label={t("sortOrder")}>
            <Input type="number" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: e.target.value })} className="w-28 font-mono" />
          </Field>
          <SwitchRow label={t("activeByDefault")}>
            <Switch checked={v.isActive} onCheckedChange={(x) => setV({ ...v, isActive: x })} />
          </SwitchRow>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {type ? t("update") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
