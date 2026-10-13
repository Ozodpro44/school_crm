import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface RowAction {
  label: string;
  icon?: React.ElementType;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  title?: string;
  /** Renders a separator above this item. */
  separated?: boolean;
}

/** Kebab menu for a table row. Each item is an explicit, labelled action. */
export function RowActions({ actions, label }: { actions: RowAction[]; label?: ReactNode }) {
  const { language } = useLanguage();
  const t = (k: string) => getTranslation(k, language);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={typeof label === "string" ? label : t("actions")}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {actions.map((a, i) => (
          <div key={i}>
            {a.separated && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onSelect={a.onSelect}
              disabled={a.disabled}
              title={a.title}
              className={cn("gap-2", a.destructive && "text-status-critical focus:text-status-critical")}
            >
              {a.icon && <a.icon className="h-4 w-4" />}
              {a.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
