import { Translation, Language } from "./types";
import { common } from "./common";
import { nav } from "./nav";
import { login } from "./login";
import { dashboard } from "./dashboard";
import { subscriptions } from "./subscriptions";
import { subscriptionPlans } from "./subscriptionPlans";
import { paymentTypes } from "./paymentTypes";
import { branches } from "./branches";
import { users } from "./users";
import { analytics } from "./analytics";
import { logs } from "./logs";
import { incidents } from "./incidents";
import { notifications } from "./notifications";
import { settings } from "./settings";

export type { Language } from "./types";
export { LANGUAGES } from "./types";

const translations: Translation = {
  ...common,
  ...nav,
  ...login,
  ...dashboard,
  ...subscriptions,
  ...subscriptionPlans,
  ...paymentTypes,
  ...branches,
  ...users,
  ...analytics,
  ...logs,
  ...incidents,
  ...notifications,
  ...settings,
};

export function getTranslation(key: string, language: Language): string {
  const entry = translations[key];
  if (!entry) {
    console.warn(`Missing translation key: ${key}`);
    return key;
  }
  return entry[language] || entry.en || key;
}

// Substitutes {placeholder} tokens in a translated string, e.g.
// tf(t("updateSubscriptionFor"), { name: "Ozod" }) → "Update subscription for Ozod."
export function tf(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}
