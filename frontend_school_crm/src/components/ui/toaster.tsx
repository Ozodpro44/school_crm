import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_DURATION = 5000;
const ERROR_DURATION = 7000;

const variantStyle = {
  success: { Icon: CheckCircle2, badge: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400", bar: "bg-emerald-500" },
  destructive: { Icon: XCircle, badge: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400", bar: "bg-red-500" },
  warning: { Icon: AlertTriangle, badge: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", bar: "bg-amber-500" },
  default: { Icon: Info, badge: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400", bar: "bg-sky-500" },
} as const;

export function Toaster() {
  const { toasts } = useToast();
  // The viewport is mounted straight on <body>: rendered inside the page layout it
  // could be trapped in a lower stacking context and end up behind the fixed
  // mobile header (seen on iOS Safari).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <ToastProvider swipeDirection="up">
      {toasts.map(function ({ id, title, description, action, variant, duration, ...props }) {
        const { Icon, badge, bar } = variantStyle[variant ?? "default"];
        const ms = duration ?? (variant === "destructive" ? ERROR_DURATION : DEFAULT_DURATION);
        return (
          <Toast key={id} variant={variant} duration={ms} {...props}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${badge}`}>
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
            <span
              aria-hidden
              className={`toast-progress absolute inset-x-0 bottom-0 h-[3px] origin-left opacity-70 ${bar}`}
              style={{ ["--toast-duration" as string]: `${ms}ms` }}
            />
          </Toast>
        );
      })}
      {mounted ? createPortal(<ToastViewport />, document.body) : null}
    </ToastProvider>
  );
}
