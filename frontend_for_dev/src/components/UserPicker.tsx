import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { listUsers, type CRMUser } from "@/services/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/i18n";

interface UserPickerProps {
  value: string;
  onChange: (userId: string) => void;
  className?: string;
}

// Searchable user combobox — replaces raw-UUID text inputs anywhere a
// developer needs to pick a CRM user (subscriptions, branch admin, …).
// Users load once per mount and filter client-side; this app's user count
// doesn't warrant a server-side search endpoint.
export function UserPicker({ value, onChange, className }: UserPickerProps) {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "error">("idle");

  // Load once per mount, on first open. Tracking an explicit state (rather than
  // "users.length === 0") matters: an empty list or a failed request must not
  // re-trigger the fetch on every render while the popover is open.
  useEffect(() => {
    if (!open || state !== "idle") return;
    setState("loading");
    listUsers()
      .then((list) => { setUsers(list); setState("loaded"); })
      .catch(() => setState("error"));
  }, [open, state]);

  const loading = state === "loading";
  const loadError = state === "error";
  const selected = users.find((u) => u.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">
            {selected
              ? `${selected.fullName || selected.email} — ${selected.email}`
              : value
                ? value // still resolving, or the id belongs to a user outside the fetched list
                : t("selectUser")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("searchUsersPlaceholder")} />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("loading")}
              </div>
            )}
            {!loading && loadError && (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-status-critical">
                {t("failedToLoadData")}
                <Button variant="outline" size="sm" onClick={() => setState("idle")}>{t("retry")}</Button>
              </div>
            )}
            {state === "loaded" && <CommandEmpty>{t("noUsersFound")}</CommandEmpty>}
            <CommandGroup>
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={`${u.fullName} ${u.email} ${u.id}`}
                  onSelect={() => {
                    onChange(u.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === u.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{u.fullName || u.email}</span>
                    <span className="text-xs text-muted-foreground truncate">{u.email} · {u.role}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
