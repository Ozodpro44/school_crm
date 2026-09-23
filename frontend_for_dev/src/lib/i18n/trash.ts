import { Translation } from "./types";

// Deleting a user or branch elsewhere in this app is soft, not immediate —
// recoverable here for 30 days (platform-wide; this whole app is
// developer-only, so there's no shorter 7-day/own-branch variant).
export const trash: Translation = {
  trashTitle: { en: "Trash", ru: "Корзина", uz: "O'chirilganlar" },
  manageTrash: { en: "Restore deleted users and branches", ru: "Восстановление удалённых пользователей и филиалов", uz: "O'chirilgan foydalanuvchi va filiallarni tiklash" },
  noTrashYet: { en: "Nothing in the trash", ru: "Корзина пуста", uz: "Hozircha hech narsa o'chirilmagan" },
  noTrashMatchSearch: { en: "No items match your search", ru: "Ничего не найдено", uz: "Qidiruvga mos narsa topilmadi" },
  restore: { en: "Restore", ru: "Восстановить", uz: "Tiklash" },
  restored: { en: "Restored", ru: "Восстановлено", uz: "Tiklandi" },
  failedToRestore: { en: "Failed to restore", ru: "Не удалось восстановить", uz: "Tiklab bo'lmadi" },
  deletedAt: { en: "Deleted", ru: "Удалено", uz: "O'chirilgan vaqt" },
  daysLeft: { en: "days left", ru: "дней осталось", uz: "kun qoldi" },
  searchTrashPlaceholder: { en: "Search trash...", ru: "Поиск в корзине...", uz: "O'chirilganlardan qidirish..." },
  trashResUser: { en: "Manager", ru: "Менеджер", uz: "Menejer" },
  trashResBranch: { en: "Branch", ru: "Филиал", uz: "Filial" },
};
