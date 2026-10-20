import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmRequest, subscribeConfirm } from "@/lib/confirm";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";

/** Mounted once in _app; renders whatever confirmAction() asks for. */
export function ConfirmHost() {
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [open, setOpen] = useState(false);
  const answered = useRef(false);

  useEffect(
    () =>
      subscribeConfirm((req) => {
        answered.current = false;
        setRequest(req);
        setOpen(true);
      }),
    []
  );

  const answer = (ok: boolean) => {
    if (answered.current) return;
    answered.current = true;
    request?.resolve(ok);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && answer(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title ?? t("confirm")}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answer(false)}>
            {request?.cancelLabel ?? t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => answer(true)}
            className={cn(request?.destructive && buttonVariants({ variant: "destructive" }))}
          >
            {request?.confirmLabel ?? (request?.destructive ? t("delete") : t("confirm"))}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
