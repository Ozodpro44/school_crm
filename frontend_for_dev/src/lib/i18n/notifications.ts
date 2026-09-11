import { Translation } from "./types";

export const notifications: Translation = {
  notificationsTitle: { en: "Notifications", ru: "Уведомления", uz: "Bildirishnomalar" },
  configureAlertPreferences: { en: "Configure alert preferences for the developer portal", ru: "Настройка предпочтений оповещений для портала разработчика", uz: "Dasturchi portali uchun ogohlantirish sozlamalari" },
  savePreferences: { en: "Save Preferences", ru: "Сохранить настройки", uz: "Sozlamalarni saqlash" },
  displayPreferencesNotice: {
    en: "These toggles are display preferences for this portal only — there is no email/push delivery configured server-side yet.",
    ru: "Эти переключатели являются лишь предпочтениями отображения для этого портала — доставка по email/push на сервере пока не настроена.",
    uz: "Bu tugmalar faqat shu portalning ko'rinish sozlamalari — hozircha server tomonida email/push yuborish sozlanmagan.",
  },
  recentActivity: { en: "Recent Activity", ru: "Недавняя активность", uz: "So'nggi faoliyat" },
  noRecentAlerts: { en: "No recent alerts.", ru: "Нет недавних оповещений.", uz: "So'nggi ogohlantirishlar yo'q." },
  alertTypes: { en: "Alert Types", ru: "Типы оповещений", uz: "Ogohlantirish turlari" },
  currentConfiguration: { en: "Current Configuration", ru: "Текущая конфигурация", uz: "Joriy sozlamalar" },
  unsavedChangesNotice: {
    en: "You have unsaved changes — click Save Preferences to persist them.",
    ru: "У вас есть несохранённые изменения — нажмите «Сохранить настройки», чтобы применить их.",
    uz: "Saqlanmagan o'zgarishlar bor — ularni saqlash uchun \"Sozlamalarni saqlash\"ni bosing.",
  },
  errorAlerts: { en: "Error Alerts", ru: "Оповещения об ошибках", uz: "Xato ogohlantirishlari" },
  errorAlertsDesc: { en: "Get notified when the error rate spikes or critical errors are logged", ru: "Получайте уведомления при резком росте ошибок или критических сбоях", uz: "Xatolik darajasi oshganda yoki jiddiy xatolar qayd etilganda xabar oling" },
  deploymentAlerts: { en: "Deployment Alerts", ru: "Оповещения о развёртывании", uz: "Deploy ogohlantirishlari" },
  deploymentAlertsDesc: { en: "Notify when a new deployment is detected on the backend", ru: "Уведомлять при обнаружении нового развёртывания на сервере", uz: "Backendda yangi deploy aniqlanganda xabar berish" },
  securityAlerts: { en: "Security Alerts", ru: "Оповещения безопасности", uz: "Xavfsizlik ogohlantirishlari" },
  securityAlertsDesc: { en: "Unusual login attempts, failed auth, or suspicious access patterns", ru: "Необычные попытки входа, неудачная аутентификация или подозрительная активность", uz: "G'ayrioddiy kirish urinishlari, muvaffaqiyatsiz autentifikatsiya yoki shubhali harakatlar" },
  weeklyReport: { en: "Weekly Report", ru: "Еженедельный отчёт", uz: "Haftalik hisobot" },
  weeklyReportDesc: { en: "Summary digest of metrics, errors, and activity every Monday", ru: "Сводка метрик, ошибок и активности каждый понедельник", uz: "Har dushanba ko'rsatkichlar, xatolar va faoliyat bo'yicha qisqacha hisobot" },
  notificationPreferencesSaved: { en: "Notification preferences saved", ru: "Настройки уведомлений сохранены", uz: "Bildirishnoma sozlamalari saqlandi" },
  failedToSavePreferences: { en: "Failed to save preferences", ru: "Не удалось сохранить настройки", uz: "Sozlamalarni saqlab bo'lmadi" },
};
