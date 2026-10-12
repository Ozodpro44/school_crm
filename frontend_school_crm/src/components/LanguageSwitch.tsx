"use client";

import * as React from "react";
import { Languages, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage, useSetLanguage } from "@/hooks/use-language";
import type { Language } from "@/types";

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "uz-latn", label: "O'zbek" },
  { value: "uz-cyrl", label: "Ўзбекча" },
  { value: "en", label: "English" },
];

/**
 * Language picker. Extracted so the login screen can offer it too — the app
 * supports three languages but the switcher previously lived only inside the
 * authenticated Layout, so anyone who couldn't read the default Uzbek had no
 * way to change it before signing in.
 */
export function LanguageSwitch({ align = "end" }: { align?: "start" | "end" }) {
  const language = useLanguage();
  const setLanguage = useSetLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Change language">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.value}
            onClick={() => setLanguage(l.value)}
            className="gap-2"
          >
            <Check
              className={
                l.value === language ? "h-4 w-4 opacity-100" : "h-4 w-4 opacity-0"
              }
            />
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
