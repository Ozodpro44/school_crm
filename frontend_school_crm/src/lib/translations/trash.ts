import { Translation } from "@/types";

// Trash / Restore — every delete across the app is soft: recoverable here
// for 7 days for a regular admin (own branch only), 30 days for a
// developer/super_admin (platform-wide). See api_gateway's
// consolidatedTrash and each service's own trash/restore handlers.
export const trashTranslations: Partial<Translation> = {
  trash: { "uz-cyrl": "Ўчирилганлар", "uz-latn": "O'chirilganlar", en: "Trash" },
  trashDesc: {
    "uz-cyrl": "Ўчирилган маълумотларни кўриш ва тиклаш",
    "uz-latn": "O'chirilgan ma'lumotlarni ko'rish va tiklash",
    en: "View and restore deleted items",
  },
  trashEmpty: {
    "uz-cyrl": "Ўчирилганлар бўш",
    "uz-latn": "O'chirilganlar bo'sh",
    en: "Nothing in the trash",
  },
  trashEmptyDesc: {
    "uz-cyrl": "Ҳозирча ҳеч нарса ўчирилмаган",
    "uz-latn": "Hozircha hech narsa o'chirilmagan",
    en: "Nothing has been deleted yet",
  },
  restore: { "uz-cyrl": "Тиклаш", "uz-latn": "Tiklash", en: "Restore" },
  restored: { "uz-cyrl": "Тикланди", "uz-latn": "Tiklandi", en: "Restored" },
  restoreConfirm: {
    "uz-cyrl": "Ушбуни тиклашни хоҳлайсизми?",
    "uz-latn": "Ushbuni tiklashni xohlaysizmi?",
    en: "Restore this item?",
  },
  failedToRestore: {
    "uz-cyrl": "Тиклаб бўлмади",
    "uz-latn": "Tiklab bo'lmadi",
    en: "Failed to restore",
  },
  deletedBy: { "uz-cyrl": "Ким ўчирди", "uz-latn": "Kim o'chirdi", en: "Deleted by" },
  deletedAt: { "uz-cyrl": "Ўчирилган вақт", "uz-latn": "O'chirilgan vaqt", en: "Deleted at" },
  daysLeft: { "uz-cyrl": "қолди", "uz-latn": "qoldi", en: "left" },
  expiringSoon: {
    "uz-cyrl": "Тезда бутунлай ўчади",
    "uz-latn": "Tezda butunlay o'chadi",
    en: "Expiring soon",
  },
  trashResourceType: { "uz-cyrl": "Тури", "uz-latn": "Turi", en: "Type" },
  allTypes: { "uz-cyrl": "Барча турлар", "uz-latn": "Barcha turlar", en: "All types" },

  // Resource type labels shown as a badge per row
  trashResBranch: { "uz-cyrl": "Филиал", "uz-latn": "Filial", en: "Branch" },
  trashResUser: { "uz-cyrl": "Менежер", "uz-latn": "Menejer", en: "Manager" },
  trashResStudent: { "uz-cyrl": "Ўқувчи", "uz-latn": "O'quvchi", en: "Student" },
  trashResClass: { "uz-cyrl": "Синф", "uz-latn": "Sinf", en: "Class" },
  trashResAssignment: { "uz-cyrl": "Вазифа", "uz-latn": "Vazifa", en: "Assignment" },
  trashResTeacher: { "uz-cyrl": "Ўқитувчи", "uz-latn": "O'qituvchi", en: "Teacher" },
  trashResSalary: { "uz-cyrl": "Иш ҳақи", "uz-latn": "Ish haqqi", en: "Salary" },
  trashResPayment: { "uz-cyrl": "Тўлов", "uz-latn": "To'lov", en: "Payment" },
  trashResExpense: { "uz-cyrl": "Харажат", "uz-latn": "Xarajat", en: "Expense" },
};
