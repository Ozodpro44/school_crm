import { Translation } from "@/types";

export const commonTranslations: Partial<Translation> = {
  // Navigation
  dashboard: {
    "uz-cyrl": "Бош саҳифа",
    "uz-latn": "Bosh sahifa",
    en: "Dashboard",
  },
  students: {
    "uz-cyrl": "Ўқувчилар",
    "uz-latn": "O'quvchilar",
    en: "Students",
  },
  teachers: {
    "uz-cyrl": "Ўқитувчилар",
    "uz-latn": "O'qituvchilar",
    en: "Teachers",
  },
  classes: {
    "uz-cyrl": "Синфлар",
    "uz-latn": "Sinflar",
    en: "Classes",
  },
  payments: {
    "uz-cyrl": "Тўловлар",
    "uz-latn": "To'lovlar",
    en: "Payments",
  },
  salaries: {
    "uz-cyrl": "Иш ҳақи",
    "uz-latn": "Ish haqqi",
    en: "Salaries",
  },
  expenses: {
    "uz-cyrl": "Харажатлар",
    "uz-latn": "Xarajatlar",
    en: "Expenses",
  },
  income: {
    "uz-cyrl": "Даромад",
    "uz-latn": "Daromad",
    en: "Income",
  },
  reports: {
    "uz-cyrl": "Ҳисоботлар",
    "uz-latn": "Hisobotlar",
    en: "Reports",
  },
  branches: {
    "uz-cyrl": "Филиаллар",
    "uz-latn": "Filiallar",
    en: "Branches",
  },
  settings: {
    "uz-cyrl": "Созламалар",
    "uz-latn": "Sozlamalar",
    en: "Settings",
  },
  help: {
    "uz-cyrl": "Ёрдам",
    "uz-latn": "Yordam",
    en: "Help",
  },

  // Common actions
  add: { "uz-cyrl": "Қўшиш", "uz-latn": "Qo'shish", en: "Add" },
  edit: { "uz-cyrl": "Таҳрирлаш", "uz-latn": "Tahrirlash", en: "Edit" },
  delete: { "uz-cyrl": "Ўчириш", "uz-latn": "O'chirish", en: "Delete" },
  subjectsPlaceholder: {
    "uz-cyrl": "Математика, Физика, Химия",
    "uz-latn": "Matematika, Fizika, Ximiya",
    en: "Mathematics, Physics, Chemistry",
  },
  commaSeparated: {
    "uz-cyrl": "пуллиқ ажратилган",
    "uz-latn": "vergul bilan ajratilgan",
    en: "comma separated",
  },
  contact: { "uz-cyrl": "Алоқа", "uz-latn": "Aloqa", en: "Contact" },
  searchTeachers: {
    "uz-cyrl": "Ўқитувчиларни қидириш...",
    "uz-latn": "O'qituvchilarni qidirish...",
    en: "Search teachers...",
  },
  manageClasses: {
    "uz-cyrl": "Синфларни ва ўқувчиларни ажратишни бошқариш",
    "uz-latn": "Sinflarni va o'quvchilarni ajratishni boshqarish",
    en: "Manage classes and student assignments",
  },
  chooseClassPlaceholder: {
    "uz-cyrl": "Синфни танланг",
    "uz-latn": "Sinfni tanlang",
    en: "Choose a class",
  },
  selectTeacherOptional: {
    "uz-cyrl": "Ўргитувчини танлаш (ихтиёрий)",
    "uz-latn": "O'qituvchini tanlash (ixtiyoriy)",
    en: "Select teacher (optional)",
  },
  noTeacherAssigned: {
    "uz-cyrl": "Ўқитувчи тайинланмаган",
    "uz-latn": "O'qituvchi tayinlanmagan",
    en: "No teacher assigned",
  },
  assignedStudents: {
    "uz-cyrl": "Тайинланган ўқувчилар",
    "uz-latn": "Tayinlangan o'quvchilar",
    en: "Assigned Students",
  },
  noUnassignedStudentsFound: {
    "uz-cyrl": "Ҳеч қандай таъинланмаган ўқувчи топилмади",
    "uz-latn": "Hech qanday tayinlanmagan o'quvchi topilmadi",
    en: "No unassigned students found",
  },
  noStudentsAssigned: {
    "uz-cyrl": "Ҳеч қандай ўқувчи тайинланмаган",
    "uz-latn": "Hech qanday o'quvchi tayinlanmagan",
    en: "No students assigned",
  },
  searchClasses: {
    "uz-cyrl": "Синфларни қидириш...",
    "uz-latn": "Sinflarni qidirish...",
    en: "Search classes...",
  },
  selectAllUnassignedStudents: {
    "uz-cyrl": "Барча тайинланмаган ўқувчиларни танлаш",
    "uz-latn": "Barcha tayinlanmagan o'quvchilarni tanlash",
    en: "Select All Unassigned Students",
  },
  unassignedStudents: {
    "uz-cyrl": "Тайинланмаган ўқувчилар",
    "uz-latn": "Tayinlanmagan o'quvchilar",
    en: "Unassigned Students",
  },
  alreadyPaid: { "uz-cyrl": "Тўланди", "uz-latn": "To'landi", en: "Paid" },
  partialPaid: {
    "uz-cyrl": "Қисман тўланган",
    "uz-latn": "Qisman to'langan",
    en: "Partially paid",
  },
  noPaymentsYet: {
    "uz-cyrl": "Ҳали тўловлар йўқ",
    "uz-latn": "Hali to'lovlar yo'q",
    en: "No payments yet",
  },
  remainingAmount: {
    "uz-cyrl": "Қолган сумма",
    "uz-latn": "Qolgan summa",
    en: "Remaining amount",
  },
  editPayment: {
    "uz-cyrl": "Тўловни таҳрирлаш",
    "uz-latn": "To'lovni tahrirlash",
    en: "Edit Payment",
  },
  saveChanges: {
    "uz-cyrl": "Ўзгартиришларни сақлаш",
    "uz-latn": "O'zgartirishlarni saqlash",
    en: "Save changes",
  },
  deletePaymentConfirmation: {
    "uz-cyrl": "Ҳақиқатан ҳам ушбу тўловни ўчирмоқчимисиз?",
    "uz-latn": "Haqiqatan ham ushbu to'lovni o'chirmoqchimisiz?",
    en: "Are you sure you want to delete this payment?",
  },
  paymentDeleted: {
    "uz-cyrl": "Тўлов ўчирилди",
    "uz-latn": "To'lov o'chirildi",
    en: "Payment deleted",
  },
  alreadyFullyPaidForPeriod: {
    "uz-cyrl": "Ушбу ой учун тўлиқ тўланган",
    "uz-latn": "Ushbu oy uchun to'liq to'langan",
    en: "This student is already fully paid for the selected period",
  },
  bulkSkippedFullyPaid: {
    "uz-cyrl": "Бир неча ўқувчилар аллақачон тўлиқ тўланган, улар ўтилдирилди",
    "uz-latn":
      "Bir necha oʻquvchilar allaqachon toʻliq toʻlangan, ular o'tkazib yuborildi",
    en: "Some students were already fully paid and were skipped",
  },
  save: { "uz-cyrl": "Сақлаш", "uz-latn": "Saqlash", en: "Save" },
  cancel: { "uz-cyrl": "Бекор қилиш", "uz-latn": "Bekor qilish", en: "Cancel" },
  search: { "uz-cyrl": "Қидириш", "uz-latn": "Qidirish", en: "Search" },
  filter: { "uz-cyrl": "Филтр", "uz-latn": "Filtr", en: "Filter" },
  export: { "uz-cyrl": "Экспорт", "uz-latn": "Eksport", en: "Export" },

  // Common terms
  status: { "uz-cyrl": "Ҳолат", "uz-latn": "Holat", en: "Status" },
  active: { "uz-cyrl": "Фаол", "uz-latn": "Faol", en: "Active" },
  suspended: {
    "uz-cyrl": "Тўхтатилган",
    "uz-latn": "To'xtatilgan",
    en: "Suspended",
  },
  left: { "uz-cyrl": "Чиқиб кетган", "uz-latn": "Chiqib ketgan", en: "Left" },
  amount: { "uz-cyrl": "Миқдор", "uz-latn": "Miqdor", en: "Amount" },
  date: { "uz-cyrl": "Сана", "uz-latn": "Sana", en: "Date" },
  period: { "uz-cyrl": "Davr", "uz-latn": "Davr", en: "Period" },
  description: { "uz-cyrl": "Тавсиф", "uz-latn": "Tavsif", en: "Description" },
  actions: { "uz-cyrl": "Амаллар", "uz-latn": "Amallar", en: "Actions" },

  // Time periods
  month: { "uz-cyrl": "Ой", "uz-latn": "Oy", en: "Month" },
  year: { "uz-cyrl": "Йил", "uz-latn": "Yil", en: "Year" },

  // Drag and drop
  dragToMove: {
    "uz-cyrl": "Суриб кўчириш",
    "uz-latn": "Sudrab ko‘chirish",
    en: "Drag to move",
  },


  // Form fields
  fullName: {
    "uz-cyrl": "Тўлиқ исми",
    "uz-latn": "To'liq ismi",
    en: "Full Name",
  },
  email: {
    "uz-cyrl": "Электрон почта",
    "uz-latn": "Elektron pochta",
    en: "Email",
  },
  password: { "uz-cyrl": "Пароль", "uz-latn": "Parol", en: "Password" },
  branch: { "uz-cyrl": "Филиал", "uz-latn": "Filial", en: "Branch" },
  name: { "uz-cyrl": "Исм", "uz-latn": "Ism", en: "Name" },
  role: { "uz-cyrl": "Роль", "uz-latn": "Rol", en: "Role" },

  // Permissions
  permissions: {
    "uz-cyrl": "Рухсатлар",
    "uz-latn": "Ruhsatlar",
    en: "Permissions",
  },
  canView: { "uz-cyrl": "Кўриш", "uz-latn": "Ko'rish", en: "View" },
  canCreate: { "uz-cyrl": "Яратиш", "uz-latn": "Yaratish", en: "Create" },
  canEdit: { "uz-cyrl": "Таҳрирлаш", "uz-latn": "Tahrirlash", en: "Edit" },
  canDelete: { "uz-cyrl": "Ўчириш", "uz-latn": "O'chirish", en: "Delete" },

  // Managers specific
  managers: {
    "uz-cyrl": "Мўдирийатчилар",
    "uz-latn": "Mudiriyatchilar",
    en: "Managers",
  },
  manageManagersPermissions: {
    "uz-cyrl": "Мўдирийатчилар ва уларнинг рухсатларини бошқариш",
    "uz-latn": "Mudiriyatchilar va ularning ruhsatlarini boshqarish",
    en: "Manage managers and their permissions",
  },
  addManager: {
    "uz-cyrl": "Мўдир қўшиш",
    "uz-latn": "Mudir qo'shish",
    en: "Add Manager",
  },
  addNewManager: {
    "uz-cyrl": "Янги мўдир қўшиш",
    "uz-latn": "Yangi mudir qo'shish",
    en: "Add New Manager",
  },
  editManager: {
    "uz-cyrl": "Мўдирни таҳрирлаш",
    "uz-latn": "Mudirni tahrirlash",
    en: "Edit Manager",
  },
  managersList: {
    "uz-cyrl": "Мўдирлар рўйхати",
    "uz-latn": "Mudirlar royxati",
    en: "Managers List",
  },
  noManagersYet: {
    "uz-cyrl": "Ҳали мўдир йўқ",
    "uz-latn": "Hali mudir yo'q",
    en: "No managers yet",
  },
  managerDeleted: {
    "uz-cyrl": "Мўдир ўчирилди",
    "uz-latn": "Mudir o'chirildi",
    en: "Manager deleted",
  },
  permissionsUpdatedSuccess: {
    "uz-cyrl": "Рухсатлар янгиланди",
    "uz-latn": "Ruhsatlar yangilandi",
    en: "Permissions updated successfully",
  },
  permissionsUpdateError: {
    "uz-cyrl": "Рухсатларни янгилашда хато",
    "uz-latn": "Ruhsatlarni yangilashda xato",
    en: "Error updating permissions",
  },
  managerCreated: {
    "uz-cyrl": "Мўдир яратилди",
    "uz-latn": "Mudir yaratildi",
    en: "Manager created",
  },
  confirmDelete: {
    "uz-cyrl": "Ростдан ҳам ўчирмоқчимисиз?",
    "uz-latn": "Rostdan ham o‘chirmoqchimisiz?",
    en: "Are you sure you want to delete?",
  },
  deleted: { "uz-cyrl": "Ўчирилди", "uz-latn": "O'chirildi", en: "Deleted" },
  create: { "uz-cyrl": "Яратиш", "uz-latn": "Yaratish", en: "Create" },
  update: { "uz-cyrl": "Янгилаш", "uz-latn": "Yangilash", en: "Update" },
  selectBranch: {
    "uz-cyrl": "Филиални танлаш",
    "uz-latn": "Filialni tanlash",
    en: "Select Branch",
  },
  editPermissions: {
    "uz-cyrl": "Рухсатларни таҳрирлаш",
    "uz-latn": "Ruhsatlarni tahrirlash",
    en: "Edit Permissions",
  },

  // Common dialog/form messages
  permissionDenied: {
    "uz-cyrl": "Рухсат берилмаган",
    "uz-latn": "Ruxsat berilmagan",
    en: "Permission Denied",
  },

  noPermission: {
    "uz-cyrl": "Ҳуқуқи йўқ",
    "uz-latn": "Haqqi yo'q",
    en: "No permission",
  },
  noPermissionCreate: {
    "uz-cyrl": "Қўшиш ҳуқуқи йўқ",
    "uz-latn": "Qo'shish haqqi yo'q",
    en: "You don't have permission to create or edit",
  },
  noPermissionDelete: {
    "uz-cyrl": "Ўчириш ҳуқуқи йўқ",
    "uz-latn": "O'chirish haqqi yo'q",
    en: "You don't have permission to delete",
  },
  noPermissionEdit: {
    "uz-cyrl": "Таҳрирлаш ҳуқуқи йўқ",
    "uz-latn": "Tahrirlash haqqi yo'q",
    en: "You don't have permission to edit",
  },
  confirmDeleteItem: {
    "uz-cyrl": "Бу элементни ўчиришни хоҳлайсизми?",
    "uz-latn": "Bu elementni o'chirishni xohlaymi siz?",
    en: "Are you sure you want to delete this item?",
  },
  deletedSuccess: {
    "uz-cyrl": "Муваффақиятли ўчирилди",
    "uz-latn": "Muvaffaqiyatli o'chirildi",
    en: "Successfully deleted",
  },
  createdSuccess: {
    "uz-cyrl": "Муваффақиятли қўшилди",
    "uz-latn": "Muvaffaqiyatli qo'shildi",
    en: "Successfully created",
  },
  updatedSuccess: {
    "uz-cyrl": "Муваффақиятли янгиланди",
    "uz-latn": "Muvaffaqiyatli yangilandi",
    en: "Successfully updated",
  },
  importError: {
    "uz-cyrl": "Импорт хатоси",
    "uz-latn": "Import xatosi",
    en: "Import Error",
  },
  importSuccess: {
    "uz-cyrl": "Импорт мувaffақ",
    "uz-latn": "Import muvaffaq",
    en: "Import Success",
  },

  // Student page specific
  phone: { "uz-cyrl": "Телефон", "uz-latn": "Telefon", en: "Phone" },
  parentPhone: {
    "uz-cyrl": "Ота-онанинг телефони",
    "uz-latn": "Ota-oning telefoni",
    en: "Parent Phone",
  },
  monthlyPayment: {
    "uz-cyrl": "Ойлик тўлов",
    "uz-latn": "Oylik to'lov",
    en: "Monthly Payment",
  },
  paid: { "uz-cyrl": "Тўланди", "uz-latn": "To'landi", en: "Paid" },
  unpaid: { "uz-cyrl": "Тўланмади", "uz-latn": "To'lanmadi", en: "Unpaid" },
  partial: { "uz-cyrl": "Қисман", "uz-latn": "Qisman", en: "Partial" },
  fromPaidFees: {
    "uz-cyrl": "Тўланган тўловлардан",
    "uz-latn": "To'langan to'lovlardan",
    en: "From paid fees",
  },
  thankYouForPayment: {
    "uz-cyrl": "Тўловингиз учун рахмат",
    "uz-latn": "To'lovingiz uchun rahmat",
    en: "Thank you for your payment",
  },
  pleaseKeepReceipt: {
    "uz-cyrl": "Квитанцияни сақлаб қўйинг",
    "uz-latn": "Kvitansiyani saqlab qo‘ying",
    en: "Please keep this receipt",
  },

  noStudentsYet: {
    "uz-cyrl": "Ҳали ўқувчи йўқ",
    "uz-latn": "Hali o'quvchi yo'q",
    en: "No students found",
  },
  downloadTemplate: {
    "uz-cyrl": "Шаблон юклаш",
    "uz-latn": "Shablon yuklash",
    en: "Download Template",
  },
  importStudents: {
    "uz-cyrl": "Ўқувчиларни импорт қилиш",
    "uz-latn": "O'quvchilarni import qilish",
    en: "Import Students",
  },
  manageStudents: {
    "uz-cyrl": "Ўқувчиларни бошқариш ва рўйхатни назорат қилиш",
    "uz-latn": "O'quvchilarni boshqarish va ro'yxatni nazorat qilish",
    en: "Manage student records and enrollment",
  },
  pasteCSVData: {
    "uz-cyrl": "CSV маълумотларини пастга киритинг",
    "uz-latn": "CSV ma'lumotlarini pastga kiriting",
    en: "Paste CSV Data",
  },
  pasteYourCSVDataHere: {
    "uz-cyrl": "CSV маълумотларингизни шу ерга паст қилинг...",
    "uz-latn": "CSV ma'lumotlaringizni shu yerga past qiling...",
    en: "Paste your CSV data here...",
  },
  selectClass: {
    "uz-cyrl": "Синфни танлаш",
    "uz-latn": "Sinfni tanlash",
    en: "Select class",
  },
  allClasses: {
    "uz-cyrl": "Барча синфлар",
    "uz-latn": "Barcha sinflar",
    en: "All Classes",
  },
  allStatus: {
    "uz-cyrl": "Барча ҳолатлар",
    "uz-latn": "Barcha holatlar",
    en: "All Status",
  },
  allPayments: {
    "uz-cyrl": "Барча тўловлар",
    "uz-latn": "Barcha to'lovlar",
    en: "All Payments",
  },
  allPaymentMethods: {
    "uz-cyrl": "Барча усуллар",
    "uz-latn": "Barcha usullar",
    en: "All Methods",
  },
  searchStudents: {
    "uz-cyrl": "Ўқувчиларни қидириш...",
    "uz-latn": "O'quvchilarni qidirish...",
    en: "Search students...",
  },

  // Login page
  signIn: { "uz-cyrl": "Кириш", "uz-latn": "Kirish", en: "Sign In" },
  accessDashboard: {
    "uz-cyrl": "Панелга кириш",
    "uz-latn": "Panelga kirish",
    en: "to access your dashboard",
  },
  signingIn: {
    "uz-cyrl": "Киришяпди...",
    "uz-latn": "Kirishyapdi...",
    en: "Signing in...",
  },
  invalidEmailOrPassword: {
    "uz-cyrl": "Нотўғри электрон почта ёки пароль",
    "uz-latn": "Notog'ri elektron pochta yoki parol",
    en: "Invalid email or password",
  },
  errorOccurred: {
    "uz-cyrl": "Хатолик юзага келди. Қайта уриниб кўринг",
    "uz-latn": "Xatolik yuz berdi. Qayta urinib ko‘ring",
    en: "An error occurred. Please try again.",
  },

  enterEmail: {
    "uz-cyrl": "Электрон почтаңизни киритинг",
    "uz-latn": "Elektron pochtangizni kiritinг",
    en: "Enter your email",
  },
  enterPassword: {
    "uz-cyrl": "Паролингизни киритинг",
    "uz-latn": "Parolingizni kiritinг",
    en: "Enter your password",
  },

  // Common toast messages
  updated: { "uz-cyrl": "Янгиланди", "uz-latn": "Yangilandi", en: "Updated" },
  created: { "uz-cyrl": "Яратилди", "uz-latn": "Yaratildi", en: "Created" },
  deletedItem: {
    "uz-cyrl": "Ўчирилди",
    "uz-latn": "O'chirildi",
    en: "Deleted",
  },

  // Expense specific
  expense: { "uz-cyrl": "Харажат", "uz-latn": "Xarajat", en: "Expense" },
  category: { "uz-cyrl": "Категория", "uz-latn": "Kategoriya", en: "Category" },
  selectCategory: {
    "uz-cyrl": "Категорияни танлаш",
    "uz-latn": "Kategoriyani tanlash",
    en: "Select category",
  },
  briefDescription: {
    "uz-cyrl": "Харажатнинг қисқа тавсифи",
    "uz-latn": "Xarajatning qisqa tavsifi",
    en: "Brief description of the expense",
  },
  confirmDeleteExpense: {
    "uz-cyrl": "Бу харажатни ўчиришни хоҳлайсизми?",
    "uz-latn": "Bu xarajatni o'chirishni xohlaymi siz?",
    en: "Are you sure you want to delete this expense?",
  },
  editExpense: {
    "uz-cyrl": "Харажатни таҳрирлаш",
    "uz-latn": "Xarajatni tahrirlash",
    en: "Edit Expense",
  },
  addNewExpense: {
    "uz-cyrl": "Янги харажат қўшиш",
    "uz-latn": "Yangi xarajat qo'shish",
    en: "Add New Expense",
  },
  addExpense: {
    "uz-cyrl": "Харажат қўшиш",
    "uz-latn": "Xarajat qo'shish",
    en: "Add Expense",
  },
  expenseAdded: {
    "uz-cyrl": "Харажат қўшилди",
    "uz-latn": "Xarajat qo'shildi",
    en: "Expense added",
  },
  expenseUpdated: {
    "uz-cyrl": "Харажат янгиланди",
    "uz-latn": "Xarajat yangilandi",
    en: "Expense updated",
  },
  expenseDeleted: {
    "uz-cyrl": "Харажат ўчирилди",
    "uz-latn": "Xarajat o'chirildi",
    en: "Expense deleted",
  },
  expenseCreatedSuccess: {
    "uz-cyrl": "Харажат муваффақиятли яратилди",
    "uz-latn": "Xarajat muvaffaqiyatli yaratildi",
    en: "Expense created successfully",
  },
  paymentMethod: {
    "uz-cyrl": "Тўлов усули",
    "uz-latn": "To'lov usuli",
    en: "Payment Method",
  },
  card: { "uz-cyrl": "Карта", "uz-latn": "Karta", en: "Card" },
  click: { "uz-cyrl": "Клик", "uz-latn": "Click", en: "Click" },
  cash: { "uz-cyrl": "Нақд", "uz-latn": "Naqd", en: "Cash" },
  terminal: { "uz-cyrl": "Терминал", "uz-latn": "Terminal", en: "Terminal" },
  bankTransfer: {
    "uz-cyrl": "Банк ўтказмаси",
    "uz-latn": "Bank o'tkazmasi",
    en: "Bank Transfer",
  },
  trackManageExpenses: {
    "uz-cyrl": "Мактаб харажатларини қайд қилиш ва бошқариш",
    "uz-latn": "Maktab xarajatlarini qayd qilish va boshqarish",
    en: "Track and manage school expenses",
  },

  trackTeacherSalaries: {
    "uz-cyrl": "Ўқитувчиларнинг иш ҳақини қайд қилиш ва бошқариш",
    "uz-latn": "O'qituvchilarning ish haqini qayd qilish va boshqarish",
    en: "Track teacher salaries and expenses",
  },

  // Teacher specific
  teacher: { "uz-cyrl": "Ўқитувчи", "uz-latn": "O'qituvchi", en: "Teacher" },
  addTeacher: {
    "uz-cyrl": "Ўқитувчи қўшиш",
    "uz-latn": "O'qituvchi qo'shish",
    en: "Add Teacher",
  },
  addNewTeacher: {
    "uz-cyrl": "Янги ўқитувчи қўшиш",
    "uz-latn": "Yangi o'qituvchi qo'shish",
    en: "Add New Teacher",
  },
  editTeacher: {
    "uz-cyrl": "Ўқитувчини таҳрирлаш",
    "uz-latn": "O'qituvchini tahrirlash",
    en: "Edit Teacher",
  },
  teachersList: {
    "uz-cyrl": "Ўқитувчилар рўйхати",
    "uz-latn": "O'qituvchilar royxati",
    en: "Teachers List",
  },
  noTeachersYet: {
    "uz-cyrl": "Ҳали ўқитувчи йўқ",
    "uz-latn": "Hali o'qituvchi yoq",
    en: "No teachers yet",
  },
  teacherDeleted: {
    "uz-cyrl": "Ўқитувчи ўчирилди",
    "uz-latn": "O'qituvchi o'chirildi",
    en: "Teacher deleted",
  },
  manageFaculty: {
    "uz-cyrl": "О'қитувчиларни бошқариш",
    "uz-latn": "O'qituvchilarni boshqarish",
    en: "Manage teachers",
  },

  activeTeachers: {
    "uz-cyrl": "Фаол ўқитувчилар",
    "uz-latn": "Faol o'qituvchilar",
    en: "Active teachers",
  },
  ushbuOyUchun: {
    "uz-cyrl": "Ушбу ой учун",
    "uz-latn": "Ushbu oy uchun",
    en: "For this month",
  },

  // Class specific
  class: { "uz-cyrl": "Синф", "uz-latn": "Sinf", en: "Class" },
  addClass: {
    "uz-cyrl": "Синф қўшиш",
    "uz-latn": "Sinf qo'shish",
    en: "Add Class",
  },
  addNewClass: {
    "uz-cyrl": "Янги синф қўшиш",
    "uz-latn": "Yangi sinf qo'shish",
    en: "Add New Class",
  },
  editClass: {
    "uz-cyrl": "Синфни таҳрирлаш",
    "uz-latn": "Sinfni tahrirlash",
    en: "Edit Class",
  },
  classList: {
    "uz-cyrl": "Синфлар рўйхати",
    "uz-latn": "Sinflar royxati",
    en: "Classes List",
  },
  noClassesYet: {
    "uz-cyrl": "Ҳали синф йўқ",
    "uz-latn": "Hali sinf yoq",
    en: "No classes yet",
  },
  classDeleted: {
    "uz-cyrl": "Синф ўчирилди",
    "uz-latn": "Sinf o'chirildi",
    en: "Class deleted",
  },
  addMultipleStudentsToClass: {
    "uz-cyrl": "Синфга бир неча ўқувчини қўшиш",
    "uz-latn": "Sinfga bir necha o'quvchini qo'shish",
    en: "Add Multiple Students to Class",
  },

  // Salary specific
  salary: { "uz-cyrl": "Иш ҳақи", "uz-latn": "Ish haqqi", en: "Salary" },
  addSalary: {
    "uz-cyrl": "Иш ҳақи қўшиш",
    "uz-latn": "Ish haqqi qo'shish",
    en: "Add Salary",
  },
  editSalary: {
    "uz-cyrl": "Иш ҳақини таҳрирлаш",
    "uz-latn": "Ish haqini tahrirlash",
    en: "Edit Salary",
  },
  salaryList: {
    "uz-cyrl": "Иш ҳақилар рўйхати",
    "uz-latn": "Ish haqilar royxati",
    en: "Salary List",
  },
  noSalariesYet: {
    "uz-cyrl": "Ҳали иш ҳақи йўқ",
    "uz-latn": "Hali ish haqqi yoq",
    en: "No salaries yet",
  },
  salaryDeleted: {
    "uz-cyrl": "Иш ҳақи ўчирилди",
    "uz-latn": "Ish haqqi o'chirildi",
    en: "Salary deleted",
  },
  recordSalaryPayment: {
    "uz-cyrl": "Иш ҳақини қайд қилиш",
    "uz-latn": "Ish haqini qayd qilish",
    en: "Record Salary Payment",
  },

  // Branch specific
  addBranch: {
    "uz-cyrl": "Филиал қўшиш",
    "uz-latn": "Filial qo'shish",
    en: "Add Branch",
  },
  addNewBranch: {
    "uz-cyrl": "Янги филиал қўшиш",
    "uz-latn": "Yangi filial qo'shish",
    en: "Add New Branch",
  },
  editBranch: {
    "uz-cyrl": "Филиални таҳрирлаш",
    "uz-latn": "Filialni tahrirlash",
    en: "Edit Branch",
  },
  branchList: {
    "uz-cyrl": "Филиаллар рўйхати",
    "uz-latn": "Filiallar royxati",
    en: "Branch List",
  },
  noBranchesYet: {
    "uz-cyrl": "Ҳали филиал йўқ",
    "uz-latn": "Hali filial yoq",
    en: "No branches yet",
  },
  branchDeleted: {
    "uz-cyrl": "Филиал ўчирилди",
    "uz-latn": "Filial o'chirildi",
    en: "Branch deleted",
  },
  selectAdmin: {
    "uz-cyrl": "Админни танланг",
    "uz-latn": "Adminni tanlang",
    en: "Select admin",
  },
  createAdmin: {
    "uz-cyrl": "Админ яратиш",
    "uz-latn": "Admin yaratish",
    en: "Create Admin",
  },
  createBranchAdminDescription: {
    "uz-cyrl": "Филиал учун администратор яратинг",
    "uz-latn": "Filial uchun administrator yarating",
    en: "Create an administrator for the branch",
  },

  // Report specific
  report: { "uz-cyrl": "Ҳисобот", "uz-latn": "Hisobot", en: "Report" },
  generateReport: {
    "uz-cyrl": "Ҳисобот яратиш",
    "uz-latn": "Hisobot yaratish",
    en: "Generate Report",
  },
  reportGenerated: {
    "uz-cyrl": "Ҳисобот яратилди",
    "uz-latn": "Hisobot yaratildi",
    en: "Report generated",
  },
  schoolManagementReport: {
    "uz-cyrl": "Мактаб бошқарув ҳисоботи",
    "uz-latn": "Maktab boshqaruv hisobot",
    en: "School Management Report",
  },
  overview: { "uz-cyrl": "Умуман", "uz-latn": "Umuman", en: "Overview" },
  totalStudents: {
    "uz-cyrl": "Жами ўқувчилар",
    "uz-latn": "Jami o'quvchilar",
    en: "Total Students",
  },
  activeStudents: {
    "uz-cyrl": "Фаол ўқувчилар",
    "uz-latn": "Faol o'quvchilar",
    en: "Active Students",
  },
  totalTeachers: {
    "uz-cyrl": "Жами ўқитувчилар",
    "uz-latn": "Jami o'qituvchilar",
    en: "Total Teachers",
  },

  // Student payment specific
  student: { "uz-cyrl": "Ўқувчи", "uz-latn": "O'quvchi", en: "Student" },
  addStudent: {
    "uz-cyrl": "Ўқувчи қўшиш",
    "uz-latn": "O'quvchi qo'shish",
    en: "Add Student",
  },
  addNewStudent: {
    "uz-cyrl": "Янги ўқувчи қўшиш",
    "uz-latn": "Yangi o'quvchi qo'shish",
    en: "Add New Student",
  },
  editStudent: {
    "uz-cyrl": "Ўқувчини таҳрирлаш",
    "uz-latn": "O'quvchini tahrirlash",
    en: "Edit Student",
  },
  studentList: {
    "uz-cyrl": "Ўқувчилар рўйхати",
    "uz-latn": "O'quvchilar royxati",
    en: "Student List",
  },
  studentDeleted: {
    "uz-cyrl": "Ўқувчи ўчирилди",
    "uz-latn": "O'quvchi o'chirildi",
    en: "Student deleted",
  },
  studentAdded: {
    "uz-cyrl": "Ўқувчи қўшилди",
    "uz-latn": "O'quvchi qo'shildi",
    en: "Student added",
  },
  studentUpdated: {
    "uz-cyrl": "Ўқувчи янгиланди",
    "uz-latn": "O'quvchi yangilandi",
    en: "Student updated",
  },

  // Settings page
  language: { "uz-cyrl": "Тил", "uz-latn": "Til", en: "Language" },
  selectLanguage: {
    "uz-cyrl": "Тилни танлаш",
    "uz-latn": "Tilni tanlash",
    en: "Select Language",
  },
  uzbekCyrillic: {
    "uz-cyrl": "Ўзбек (Кириллица)",
    "uz-latn": "Uzbek (Kirilica)",
    en: "Uzbek (Cyrillic)",
  },
  uzbekLatin: {
    "uz-cyrl": "Ўзбек (Латин)",
    "uz-latn": "Uzbek (Latin)",
    en: "Uzbek (Latin)",
  },
  english: { "uz-cyrl": "Инглиз", "uz-latn": "Ingliz", en: "English" },
  theme: { "uz-cyrl": "Мавзу", "uz-latn": "Mavzu", en: "Theme" },
  darkMode: {
    "uz-cyrl": "Қора режим",
    "uz-latn": "Qora rejim",
    en: "Dark Mode",
  },
  lightMode: {
    "uz-cyrl": "Ёруғ режим",
    "uz-latn": "Yorugh rejim",
    en: "Light Mode",
  },

  // Error messages
  fieldRequired: {
    "uz-cyrl": "Ушбу майдон керак",
    "uz-latn": "Ushbu maydon kerak",
    en: "This field is required",
  },
  invalidEmail: {
    "uz-cyrl": "Электрон почта ноғич",
    "uz-latn": "Elektron pochta noghich",
    en: "Invalid email",
  },
  passwordMinLength: {
    "uz-cyrl": "Пароль камида 6 та белгидан иборат бўлиши керак",
    "uz-latn": "Parol kamida 6 ta belgidan iborat bolishi kerak",
    en: "Password must be at least 6 characters",
  },

  // Help page
  helpCenter: {
    "uz-cyrl": "Ёрдам маркази",
    "uz-latn": "Yordam markazi",
    en: "Help Center",
  },
  faq: {
    "uz-cyrl": "Савол ва жавобlar",
    "uz-latn": "Savol va javoblar",
    en: "FAQs",
  },
  contactSupport: {
    "uz-cyrl": "Қўллаб қўвваш билан алоқа",
    "uz-latn": "Qullob quvvash bilan aloqa",
    en: "Contact Support",
  },

  // Navigation pages
  goHome: {
    "uz-cyrl": "Бошқа сахифага бўлиш",
    "uz-latn": "Boshqa sahifaga bolish",
    en: "Go to Home",
  },
  notFound: {
    "uz-cyrl": "Сахифа топилмади",
    "uz-latn": "Sahifa topilmadi",
    en: "Page Not Found",
  },

  // Common modal messages
  confirmAction: {
    "uz-cyrl": "Амалниконфирм қилиш",
    "uz-latn": "Amalnikonfirm qilish",
    en: "Confirm Action",
  },
  yes: { "uz-cyrl": "Ха", "uz-latn": "Ha", en: "Yes" },
  no: { "uz-cyrl": "Йўқ", "uz-latn": "Yoq", en: "No" },
  close: { "uz-cyrl": "Ёпиш", "uz-latn": "Yopish", en: "Close" },
  printReceipt: {
    "uz-cyrl": "Квитанциялар матнини чоп қилиш",
    "uz-latn": "Kvitansiyalar matnini chop qilish",
    en: "Print Receipt",
  },
  loading: {
    "uz-cyrl": "Юкланяпди...",
    "uz-latn": "Yuklanyapdi...",
    en: "Loading...",
  },
  success: {
    "uz-cyrl": "Муваффақиятли",
    "uz-latn": "Muvaffaqiyatli",
    en: "Success",
  },
  error: { "uz-cyrl": "Хато", "uz-latn": "Xato", en: "Error" },
  warning: {
    "uz-cyrl": "Огоҳлантириш",
    "uz-latn": "Ogohlantirilsh",
    en: "Warning",
  },
  info: { "uz-cyrl": "Ахборот", "uz-latn": "Akhborot", en: "Information" },

  importComplete: {
    "uz-cyrl": "Импорт якунланди",
    "uz-latn": "Import yakunlandi",
    en: "Import Complete",
  },
  successfullyImported: {
    "uz-cyrl": "Муваффақиятли импорт қилинди",
    "uz-latn": "Muvaffaqiyatli import qilindi",
    en: "Successfully imported",
  },
  errorCheckFormat: {
    "uz-cyrl": "Хато. Маълумот форматини текширинг",
    "uz-latn": "Xato. Malumat formatini tekshiring",
    en: "Error importing. Please check the format.",
  },
  dontHavePermission: {
    "uz-cyrl": "Бу амални бажариш ҳуқуқи йўқ",
    "uz-latn": "Bu amalni bajarish haqqi yoq",
    en: "You don't have permission",
  },
  permissionDeniedEdit: {
    "uz-cyrl": "Таҳрирлаш ҳуқуқи йўқ",
    "uz-latn": "Tahrirlash haqqi yoq",
    en: "You don't have permission to edit",
  },
  permissionDeniedDelete: {
    "uz-cyrl": "Ўчириш ҳуқуқи йўқ",
    "uz-latn": "O'chirish haqqi yoq",
    en: "You don't have permission to delete",
  },
  successfullyDeleted: {
    "uz-cyrl": "Муваффақиятли ўчирилди",
    "uz-latn": "Muvaffaqiyatli o'chirildi",
    en: "Successfully deleted",
  },
  addedSuccessfully: {
    "uz-cyrl": "Муваффақиятли қўшилди",
    "uz-latn": "Muvaffaqiyatli qo'shildi",
    en: "Added successfully",
  },
  updatedSuccessfully: {
    "uz-cyrl": "Муваффақиятли янгиланди",
    "uz-latn": "Muvaffaqiyatli yangilandi",
    en: "Updated successfully",
  },

  // Dashboard page
  welcomeToSchoolManagement: {
    "uz-cyrl": "Мактаб бошқарув тизимига хуш келибсиз",
    "uz-latn": "Maktab boshqaruv tiziamga xush kelibsiz",
    en: "Welcome to your school management system",
  },
  totalEnrolled: {
    "uz-cyrl": "жами рўйхатдан ўтган",
    "uz-latn": "jami royxatdan o'tgan",
    en: "total enrolled",
  },
  activeFacultyMembers: {
    "uz-cyrl": "Фаол факультет аъзолари",
    "uz-latn": "Faol fakultet a'zolari",
    en: "Active faculty members",
  },
  totalIncome: {
    "uz-cyrl": "Жами даромад",
    "uz-latn": "Jami daromad",
    en: "Total Income",
  },
  fromStudentPayments: {
    "uz-cyrl": "Ўқувчилар тўловларидан",
    "uz-latn": "O'quvchilar to'lovlaridan",
    en: "From student payments",
  },
  netProfit: {
    "uz-cyrl": "Холис фойда",
    "uz-latn": "Xolis foyda",
    en: "Net Profit",
  },
  incomeMinusExpenses: {
    "uz-cyrl": "Даромад - Харажатлар",
    "uz-latn": "Daromad - Xarajatlar",
    en: "Income - Expenses",
  },
  pendingPayments: {
    "uz-cyrl": "Кутилаётган тўловлар",
    "uz-latn": "Kutilaytgan to'lovlar",
    en: "Pending Payments",
  },
  studentDebtors: {
    "uz-cyrl": "Ўқувчилар қарзмандлари",
    "uz-latn": "O'quvchilar qarzmandlari",
    en: "Student Debtors",
  },
  studentsWithUnpaidFees: {
    "uz-cyrl": "Тўловини қилмаган ўқувчилар",
    "uz-latn": "To'lovini qilmagan o'quvchilar",
    en: "Students with unpaid fees",
  },
  pendingExpenses: {
    "uz-cyrl": "Кутилаётган харажатлар",
    "uz-latn": "Kutilaytgan xarajatlar",
    en: "Pending Expenses",
  },
  unpaidSalaries: {
    "uz-cyrl": "Тўланмаган иш ҳақи",
    "uz-latn": "To'lanmagan ish haqqi",
    en: "Unpaid Salaries",
  },
  teacherSalaryPaymentsDue: {
    "uz-cyrl": "Ўқитувчилар иш ҳақи тўловлари йўллантирилиши керак",
    "uz-latn": "O'qituvchilar ish haqqi to'lovlari yo'llantirishi kerak",
    en: "Teacher salary payments due",
  },
  financialOverviewLastSixMonths: {
    "uz-cyrl": "Молиявий кўриниш (охирги 6 ой)",
    "uz-latn": "Moliyaviy ko'rinish (oxirgi 6 oy)",
    en: "Financial Overview (Last 6 Months)",
  },
  quickStatsSummary: {
    "uz-cyrl": "Тезкор статистика хулосаси",
    "uz-latn": "Tezkor statistika hulosasi",
    en: "Quick Stats Summary",
  },
  totalExpenses: {
    "uz-cyrl": "Жами харажатлар",
    "uz-latn": "Jami xarajatlar",
    en: "Total Expenses",
  },
  daily: { "uz-cyrl": "Кунлик", "uz-latn": "Kunlik", en: "Daily" },
  monthly: { "uz-cyrl": "Ойлик", "uz-latn": "Oylik", en: "Monthly" },
  dailyFourteenDays: {
    "uz-cyrl": "Кунлик - 14 кун",
    "uz-latn": "Kunlik - 14 kun",
    en: "Daily - 14 Days",
  },
  recordPayment: {
    "uz-cyrl": "Тўловни қайд қилиш",
    "uz-latn": "To'lovni qayd qilish",
    en: "Record Payment",
  },
  studentsSelected: {
    "uz-cyrl": "Ўқувчилар танланди",
    "uz-latn": "O'quvchilar tanlandi",
    en: "students selected",
  },
  recordNewPayment: {
    "uz-cyrl": "Янги тўловни қайд қилиш",
    "uz-latn": "Yangi to'lovni qayd qilish",
    en: "Record New Payment",
  },
  selectStudent: {
    "uz-cyrl": "Ўқувчини танлаш",
    "uz-latn": "O'quvchini tanlash",
    en: "Select student",
  },
  itemsSelected: {
    "uz-cyrl": "танланган элементлар",
    "uz-latn": "tanlangan elementlar",
    en: "items selected",
  },
  changeClass: {
    "uz-cyrl": "Синфни ўзгартириш",
    "uz-latn": "Sinfni o'zgartirish",
    en: "Change Class",
  },
  deleteSelected: {
    "uz-cyrl": "Танланганларни ўчириш",
    "uz-latn": "Tanlanganlarni o'chirish",
    en: "Delete Selected",
  },
  items: {
    "uz-cyrl": "элементлар",
    "uz-latn": "elementlar",
    en: "items",
  },
  payment: {
    "uz-cyrl": "Тўлов",
    "uz-latn": "To'lov",
    en: "Payment",
  },
  removedFromClass: {
    "uz-cyrl": "Синфдан ўчирилди",
    "uz-latn": "Sinfdan o'chirildi",
    en: "Removed from class",
  },
  selectedStudents: {
    "uz-cyrl": "танланган ўқувчилар",
    "uz-latn": "tanlangan o'quvchilar",
    en: "selected students",
  },
  managersDeleted: {
    "uz-cyrl": "мўдирлар ўчирилди",
    "uz-latn": "mudirlar o'chirildi",
    en: "managers deleted",
  },
  expensesDeleted: {
    "uz-cyrl": "харажатлар ўчирилди",
    "uz-latn": "xarajatlar o'chirildi",
    en: "expenses deleted",
  },
  selectAll: {
    "uz-cyrl": "Ҳаммасини танлаш",
    "uz-latn": "Hammasini tanlash",
    en: "Select All",
  },
  switch: {
    "uz-cyrl": "Алмашиш",
    "uz-latn": "Almashish",
    en: "Switch",
  },
  remove: {
    "uz-cyrl": "Ўчириш",
    "uz-latn": "O'chirish",
    en: "Remove",
  },
  basicInformation: {
    "uz-cyrl": "Асосий маълумот",
    "uz-latn": "Asosiy ma'lumot",
    en: "Basic Information",
  },
  classDetails: {
    "uz-cyrl": "Синф маълумотлари",
    "uz-latn": "Sinf ma'lumotlari",
    en: "Class Details",
  },
  className: {
    "uz-cyrl": "Синф номи",
    "uz-latn": "Sinf nomi",
    en: "Class Name",
  },
  classTeacher: {
    "uz-cyrl": "Синф ўқитувчиси",
    "uz-latn": "Sinf o'qituvchisi",
    en: "Class Teacher",
  },
  studentCount: {
    "uz-cyrl": "Ўқувчилар сони",
    "uz-latn": "O'quvchilar soni",
    en: "Student Count",
  },
  classNamePlaceholder: {
    "uz-cyrl": "масалан, 7А, 9Б",
    "uz-latn": "masalan, 7A, 9B",
    en: "e.g., 7A, Grade 9B",
  },
  deleteClassConfirmation: {
    "uz-cyrl": "Ҳақиқатан ҳам ушбу синфни ўчирмоқчимисиз?",
    "uz-latn": "Haqiqatan ham ushbu sinfni o'chirmoqchimisiz?",
    en: "Are you sure you want to delete this class?",
  },
  classDeletedSuccessfully: {
    "uz-cyrl": "Синф муваффақиятли ўчирилди",
    "uz-latn": "Sinf muvaffaqiyatli o'chirildi",
    en: "Class deleted successfully",
  },
  removeStudentFromClassConfirmation: {
    "uz-cyrl": "Ўқувчини синфдан ўчирмоқ",
    "uz-latn": "O'quvchini sinfdan o'chirmoq",
    en: "Remove student from class",
  },
  switchConfirmation: {
    "uz-cyrl": "Синф алмашиш",
    "uz-latn": "Sinf almashish",
    en: "Switch class",
  },
  chooseClass: {
    "uz-cyrl": "Синфни танланг",
    "uz-latn": "Sinfni tanlang",
    en: "Choose Class",
  },
  confirm: {
    "uz-cyrl": "Тасдиқлаш",
    "uz-latn": "Tasdiqlaš",
    en: "Confirm",
  },
  backToClasses: {
    "uz-cyrl": "Синфларга қайтиш",
    "uz-latn": "Sinflarga qaytish",
    en: "Back to Classes",
  },
  classNotFound: {
    "uz-cyrl": "Синф топилмади",
    "uz-latn": "Sinf topilmadi",
    en: "Class not found",
  },
  noStudentsFound: {
    "uz-cyrl": "Ўқувчи топилмади",
    "uz-latn": "O'quvchi topilmadi",
    en: "No students found",
  },
  importStudentsFromCSV: {
    "uz-cyrl": "CSV дан ўқувчиларни импорт қилиш",
    "uz-latn": "CSV dan o'quvchilarni import qilish",
    en: "Import Students From CSV",
  },
  csvFormat: {
    "uz-cyrl": "CSV формат",
    "uz-latn": "CSV format",
    en: "CSV Format",
  },
  csvFormatOptions: {
    "uz-cyrl": "2та вариант",
    "uz-latn": "2ta variant",
    en: "2 options",
  },
  withClass: {
    "uz-cyrl": "Синф билан",
    "uz-latn": "Sinf bilan",
    en: "With Class",
  },
  withoutClass: {
    "uz-cyrl": "Синфсиз",
    "uz-latn": "Sinfsi",
    en: "Without Class",
  },
  uploadCSVFile: {
    "uz-cyrl": "CSV файлни юклаш",
    "uz-latn": "CSV faylni yuklash",
    en: "Upload CSV File",
  },
  clickToUploadOrDragDrop: {
    "uz-cyrl": "Юклаш учун босинг ёки суриб ташланг",
    "uz-latn": "Yuklash uchun bosing yoki sudrab tashlang",
    en: "Click to upload or drag and drop",
  },
  csvFilesOnly: {
    "uz-cyrl": "Фақат CSV файллар",
    "uz-latn": "Faqat CSV fayllar",
    en: "CSV files only",
  },
  orPasteCSVDataBelow: {
    "uz-cyrl": "ёки CSV маълумотларини пастда жойлаштиринг",
    "uz-latn": "yoki CSV ma'lumotlarini pastda joylashtirinq",
    en: "Or paste CSV data below",
  },
  importing: {
    "uz-cyrl": "Импорт қилинявди...",
    "uz-latn": "Import qilinjavdi...",
    en: "Importing...",
  },
  optional: {
    "uz-cyrl": "ихтиёрий",
    "uz-latn": "ixtiyoriy",
    en: "optional",
  },

  // Password management
  changePassword: {
    "uz-cyrl": "Паролни ўзгартириш",
    "uz-latn": "Parolni o'zgartirish",
    en: "Change Password",
  },
  newPassword: {
    "uz-cyrl": "Янги пароль",
    "uz-latn": "Yangi parol",
    en: "New Password",
  },
  enterNewPassword: {
    "uz-cyrl": "Янги паролни киритинг",
    "uz-latn": "Yangi parolni kiritinq",
    en: "Enter new password",
  },
  confirmPassword: {
    "uz-cyrl": "Паролни тасдиқлаш",
    "uz-latn": "Parolni tasdiqlash",
    en: "Confirm Password",
  },
  confirmNewPassword: {
    "uz-cyrl": "Янги паролни тасдиқлаш",
    "uz-latn": "Yangi parolni tasdiqlash",
    en: "Confirm new password",
  },
  updatePassword: {
    "uz-cyrl": "Паролни янгилаш",
    "uz-latn": "Parolni yangilash",
    en: "Update Password",
  },

  // Mobile button labels
  addStudents: {
    "uz-cyrl": "Ўқувчилар қўшиш",
    "uz-latn": "O'quvchilar qo'shish",
    en: "Add Students",
  },

  // Drag and drop messages
  dropHereToAdd: {
    "uz-cyrl": "Қўшиш учун шу ерга қўйинг",
    "uz-latn": "Qo'shish uchun shu yerga qo'ying",
    en: "Drop here to add",
  },
  dropHereToAddMultiple: {
    "uz-cyrl": "Шу ерга қўйинг ўқувчиларни қўшиш учун",
    "uz-latn": "Shu yerga qo'ying o'quvchilarni qo'shish uchun",
    en: "Drop here to add",
  },

  // Move student confirmation
  moveStudent: {
    "uz-cyrl": "Ўқувчини кўчириш",
    "uz-latn": "O'quvchini ko'chirish",
    en: "Move Student",
  },
  moveStudents: {
    "uz-cyrl": "Ўқувчиларни кўчириш",
    "uz-latn": "O'quvchilarni ko'chirish",
    en: "Move Students",
  },
  moveToClass: {
    "uz-cyrl": "Синфга кўчирилади",
    "uz-latn": "Sinfga ko‘chiriladi",
    en: "Will be moved to this class",
  },
  movedAndSigned: {
    "uz-cyrl": "кўчирилди ва ўнатилди",
    "uz-latn": "ko'chirildi va o'natildi",
    en: "moved and signed to",
  },

  // Expense confirmations
  deleteExpense: {
    "uz-cyrl": "Харажатни ўчириш",
    "uz-latn": "Xarajatni o'chirish",
    en: "Delete Expense",
  },
  confirmDeleteExpenseMessage: {
    "uz-cyrl": "Ҳақиқатан ҳам ушбу харажатни ўчирмоқчимисиз? Бу амали қайтарилмас.",
    "uz-latn": "Haqiqatan ham ushbu xarajatni o'chirmoqchimisiz? Bu amali qaytarilmas.",
    en: "Are you sure you want to delete this expense? This action cannot be undone.",
  },
  deleteMultipleExpenses: {
    "uz-cyrl": "Харажатларни ўчириш",
    "uz-latn": "Xarajatlarni o'chirish",
    en: "Delete Expenses",
  },
  confirmDeleteMultipleExpensesMessage: {
    "uz-cyrl": "Ҳақиқатан ҳам ушбу харажатларни ўчирмоқчимисиз? Бу амали қайтарилмас.",
    "uz-latn": "Haqiqatan ham ushbu xarajatlarni o'chirmoqchimisiz? Bu amali qaytarilmas.",
    en: "Are you sure you want to delete these expenses? This action cannot be undone.",
  },

  // Salary delete confirmations
  deleteSalary: {
    "uz-cyrl": "Маошни ўчириш",
    "uz-latn": "Maoshni o'chirish",
    en: "Delete Salary",
  },
  deleteWarning: {
    "uz-cyrl": "Ҳақиқатан ҳам ушбу маош қайдини ўчирмоқчимисиз? Бу амали қайтарилмас.",
    "uz-latn": "Haqiqatan ham ushbu maosh qaydini o'chirmoqchimisiz? Bu amali qaytarilmas.",
    en: "Are you sure you want to delete this salary record? This action cannot be undone.",
  },
  salaryRecordDeleted: {
    "uz-cyrl": "Маош қайди ўчирилди",
    "uz-latn": "Maosh qaydi o'chirildi",
    en: "Salary record deleted",
  },
  statusUpdated: {
    "uz-cyrl": "Ҳолат янгиланди",
    "uz-latn": "Holat yangilandi",
    en: "Status updated",
  },
  deletedSuccessfully: {
    "uz-cyrl": "Муваффақиятли ўчирилди",
    "uz-latn": "Muvaffaqiyatli o'chirildi",
    en: "deleted successfully",
  },

  // Who added entries
  whoAddedExpenses: {
    "uz-cyrl": "Киритган шахс",
    "uz-latn": "Kiritgan shaxs",
    en: "Added by",
  },
  addPayment: {
    "uz-cyrl": "Киритган шахс",
    "uz-latn": "Kiritgan shaxs",
    en: "Added by",
  },
  whoAddedSalaries: {
    "uz-cyrl": "Киритган шахс",
    "uz-latn": "Kiritgan shaxs",
    en: "Added by",
  },

  // Pagination
  showing: {
    "uz-cyrl": "Кўрсатилаётган",
    "uz-latn": "Ko'rsatilyotgan",
    en: "Showing",
  },
  of: {
    "uz-cyrl": "дан",
    "uz-latn": "dan",
    en: "of",
  },
  previous: {
    "uz-cyrl": "Ундан олдинги",
    "uz-latn": "Undan oldingi",
    en: "Previous",
  },
  next: {
    "uz-cyrl": "Кейинги",
    "uz-latn": "Keyingi",
    en: "Next",
  },
  current: {
    "uz-cyrl": "жорий",
    "uz-latn": "joriy",
    en: "current",
  },
  goToCurrent: {
    "uz-cyrl": "Жорийга ўтиш",
    "uz-latn": "Joriyga o'tish",
    en: "Go to Current",
  },
  archive: {
    "uz-cyrl": "архив",
    "uz-latn": "arxiv",
    en: "archive",
  },
  thisMonth: {
    "uz-cyrl": "ушбу ойда",
    "uz-latn": "ushbu oyda",
    en: "this month",
  },

  // Admin Profile
  adminProfile: {
    "uz-cyrl": "Админ профили",
    "uz-latn": "Admin profili",
    en: "Admin Profile",
  },
  viewAdminDetails: {
    "uz-cyrl": "Админ ҳисобини тафсилотларини кўринг",
    "uz-latn": "Admin hisobini tafsilo­tlarini ko'ring",
    en: "View and manage admin account details",
  },
  contactInformation: {
    "uz-cyrl": "Алоқа маълумотлари",
    "uz-latn": "Aloqa ma'lumotlari",
    en: "Contact Information",
  },
  emailAddress: {
    "uz-cyrl": "Электрон почта манзили",
    "uz-latn": "Elektron pochta manzili",
    en: "Email Address",
  },
  phoneNumber: {
    "uz-cyrl": "Телефон рақами",
    "uz-latn": "Telefon raqami",
    en: "Phone Number",
  },
  accountStatus: {
    "uz-cyrl": "Ҳисоб ҳолати",
    "uz-latn": "Hisob holati",
    en: "Account Status",
  },
  accountDetails: {
    "uz-cyrl": "Ҳисоб тафсилотлари",
    "uz-latn": "Hisob tafsilo­tlari",
    en: "Account Details",
  },
  userId: {
    "uz-cyrl": "Фойдаланувчи ID",
    "uz-latn": "Foydalanuvchi ID",
    en: "User ID",
  },
  createdDate: {
    "uz-cyrl": "Яратилган сана",
    "uz-latn": "Yaratilgan sana",
    en: "Created Date",
  },
  lastUpdated: {
    "uz-cyrl": "Охирги янгилашлар",
    "uz-latn": "Oxirgi yangillashlar",
    en: "Last Updated",
  },
  editProfile: {
    "uz-cyrl": "Профилни таҳрирлаш",
    "uz-latn": "Profilni tahrirlash",
    en: "Edit Profile",
  },
  granted: {
    "uz-cyrl": "Берилган",
    "uz-latn": "Berilgan",
    en: "Granted",
  },
  canManageUsers: {
    "uz-cyrl": "Фойдаланувчиларни бошқариш",
    "uz-latn": "Foydalanuvchilarni boshqarish",
    en: "Manage Users",
  },
  canManageBranches: {
    "uz-cyrl": "Филиаллларни бошқариш",
    "uz-latn": "Filiallarni boshqarish",
    en: "Manage Branches",
  },
  canManageClasses: {
    "uz-cyrl": "Синфларни бошқариш",
    "uz-latn": "Sinflarni boshqarish",
    en: "Manage Classes",
  },
  canManageStudents: {
    "uz-cyrl": "Ўқувчиларни бошқариш",
    "uz-latn": "O'quvchilarni boshqarish",
    en: "Manage Students",
  },
  canManageTeachers: {
    "uz-cyrl": "Ўқитувчиларни бошқариш",
    "uz-latn": "O'qituvchilarni boshqarish",
    en: "Manage Teachers",
  },
  canViewReports: {
    "uz-cyrl": "Ҳисоботларни кўриш",
    "uz-latn": "Hisobotlarni ko'rish",
    en: "View Reports",
  },
  canManagePayments: {
    "uz-cyrl": "Тўловларни бошқариш",
    "uz-latn": "To'lovlarni boshqarish",
    en: "Manage Payments",
  },
  canManageSalaries: {
    "uz-cyrl": "Маошларни бошқариш",
    "uz-latn": "Maoshlarni boshqarish",
    en: "Manage Salaries",
  },
  canManageExpenses: {
    "uz-cyrl": "Харажатларни бошқариш",
    "uz-latn": "Xarajatlarni boshqarish",
    en: "Manage Expenses",
  },
  canManageSettings: {
    "uz-cyrl": "Созламаларни бошқариш",
    "uz-latn": "Sozlamalarni boshqarish",
    en: "Manage Settings",
  },

  // Profile update translations
  profileUpdated: {
    "uz-cyrl": "Профил янгилан",
    "uz-latn": "Profil yangilandi",
    en: "Profile Updated",
  },
  profileUpdatedDescription: {
    "uz-cyrl": "Сизнинг профил муваффақиятли янгилан",
    "uz-latn": "Sizning profil muvaffaqiyatli yangilandi",
    en: "Your profile has been updated successfully",
  },
  passwordUpdated: {
    "uz-cyrl": "Пароль янгилан",
    "uz-latn": "Parol yangilandi",
    en: "Password Updated",
  },
  passwordUpdatedDescription: {
    "uz-cyrl": "Сизнинг пароль муваффақиятли ўзгартирилди",
    "uz-latn": "Sizning parol muvaffaqiyatli o'zgartirildi",
    en: "Your password has been changed successfully",
  },
  currentPassword: {
    "uz-cyrl": "Жорий пароль",
    "uz-latn": "Joriy parol",
    en: "Current Password",
  },
  currentPasswordRequired: {
    "uz-cyrl": "Жорий пароль керак",
    "uz-latn": "Joriy parol kerak",
    en: "Current password is required",
  },
  enterCurrentPassword: {
    "uz-cyrl": "Жорий паролни киритинг",
    "uz-latn": "Joriy parolni kiritng",
    en: "Enter current password",
  },
  enterFullName: {
    "uz-cyrl": "Тўлиқ исмни киритинг",
    "uz-latn": "To'liq ismni kiritng",
    en: "Enter full name",
  },
  fullNameRequired: {
    "uz-cyrl": "Тўлиқ исм керак",
    "uz-latn": "To'liq ism kerak",
    en: "Full name is required",
  },
  updateFailed: {
    "uz-cyrl": "Янгилаш мувафаққиятсиз бўлди",
    "uz-latn": "Yangilash muvaffaqiyatsiz bo'ldi",
    en: "Failed to update profile",
  },
  updateError: {
    "uz-cyrl": "Хатолик юзага келди",
    "uz-latn": "Xatolic yuzaga keldi",
    en: "An error occurred",
  },
  emptyResponse: {
    "uz-cyrl": "Сервердан бўш жавоб",
    "uz-latn": "Serverdan bo'sh javob",
    en: "Empty response from server",
  },
  updating: {
    "uz-cyrl": "Янгиланиёр...",
    "uz-latn": "Yangilaniyor...",
    en: "Updating...",
  },
  saving: {
    "uz-cyrl": "Сақланаёр...",
    "uz-latn": "Saqlanayo...",
    en: "Saving...",
  },

  // Payment translations
  paymentCreated: {
    "uz-cyrl": "Тўлов яратилди",
    "uz-latn": "To'lov yaratildi",
    en: "Payment Created",
  },
  paymentCreatedDescription: {
    "uz-cyrl": "Тўлов муваффақиятли яратилди",
    "uz-latn": "To'lov muvaffaqiyatli yaratildi",
    en: "Payment has been created successfully",
  },
  paymentUpdated: {
    "uz-cyrl": "Тўлов янгилан",
    "uz-latn": "To'lov yangilandi",
    en: "Payment Updated",
  },
  paymentUpdatedDescription: {
    "uz-cyrl": "Тўлов муваффақиятли янгилан",
    "uz-latn": "To'lov muvaffaqiyatli yangilandi",
    en: "Payment has been updated successfully",
  },

  // Payment form fields
  additionalNotes: {
    "uz-cyrl": "Қўшимча эслатмалар",
    "uz-latn": "Qo'shimcha eslatmalar",
    en: "Additional Notes",
  },
  method: {
    "uz-cyrl": "Усул",
    "uz-latn": "Usul",
    en: "Method",
  },
  receipt: {
    "uz-cyrl": "Квитанция",
    "uz-latn": "Kvitansiya",
    en: "Receipt",
  },
  updateProfileInfo: {
    "uz-cyrl": "Профилнингиз маълумотларини янгилаш",
    "uz-latn": "Profilningiz ma'lumotlarini yangilash",
    en: "Update your profile information",
  },
  changePasswordDescription: {
    "uz-cyrl": "Жорий паролни ва янги паролни киритинг",
    "uz-latn": "Joriy parolni va yangi parolni kiritng",
    en: "Enter your current password and new password",
  },

  // Dashboard indicators
  paymentsIncome: {
    "uz-cyrl": "Тўловлар даромади",
    "uz-latn": "To'lovlar daromadi",
    en: "Payments Income",
  },
  expensesAndSalaries: {
    "uz-cyrl": "Харажатлар ва маошлар",
    "uz-latn": "Xarajatlar va maoshlar",
    en: "Expenses & Salaries",
  },
  operatingCosts: {
    "uz-cyrl": "Ишчи харажатлари",
    "uz-latn": "Ishchi xarajatlari",
    en: "Operating Costs",
  },
  positive: {
    "uz-cyrl": "Мусбат",
    "uz-latn": "Musbat",
    en: "Positive",
  },
  deficit: {
    "uz-cyrl": "Дефицит",
    "uz-latn": "Defisit",
    en: "Deficit",
  },

  // Payment methods breakdown
  incomeByPaymentMethod: {
    "uz-cyrl": "Ўдиниш усулига кўра даромад",
    "uz-latn": "O'dinish usuliga ko'ra daromad",
    en: "Income by Payment Method",
  },

  // Month abbreviations
  Jan: {
    "uz-cyrl": "Янв",
    "uz-latn": "Yanv",
    en: "Jan",
  },
  Feb: {
    "uz-cyrl": "Фев",
    "uz-latn": "Fev",
    en: "Feb",
  },
  Mar: {
    "uz-cyrl": "Мар",
    "uz-latn": "Mar",
    en: "Mar",
  },
  Apr: {
    "uz-cyrl": "Апр",
    "uz-latn": "Apr",
    en: "Apr",
  },
  May: {
    "uz-cyrl": "Май",
    "uz-latn": "May",
    en: "May",
  },
  Jun: {
    "uz-cyrl": "Июн",
    "uz-latn": "Iyun",
    en: "Jun",
  },
  Jul: {
    "uz-cyrl": "Июл",
    "uz-latn": "Iyul",
    en: "Jul",
  },
  Aug: {
    "uz-cyrl": "Авг",
    "uz-latn": "Avg",
    en: "Aug",
  },
  Sep: {
    "uz-cyrl": "Сен",
    "uz-latn": "Sen",
    en: "Sep",
  },
  Oct: {
    "uz-cyrl": "Окт",
    "uz-latn": "Okt",
    en: "Oct",
  },
  Nov: {
    "uz-cyrl": "Ноя",
    "uz-latn": "Noya",
    en: "Nov",
  },
  Dec: {
    "uz-cyrl": "Дек",
    "uz-latn": "Dek",
    en: "Dec",
  },

  // Payment methods
  bankPayments: {
    "uz-cyrl": "Банк тўловлари",
    "uz-latn": "Bank to'lovlari",
    en: "Bank Payments",
  },

  // Pagination
  page: {
    "uz-cyrl": "Саҳифа",
    "uz-latn": "Sahifa",
    en: "Page",
  },
  perPage: {
    "uz-cyrl": "Саҳифада",
    "uz-latn": "Sahifada",
    en: "Per Page",
  },

  // Actions
  change: {
    "uz-cyrl": "Ўзгартириш",
    "uz-latn": "O‘zgartirish",
    en: "Change",
  },

  // Field labels
  notes: {
    "uz-cyrl": "Изоҳлар",
    "uz-latn": "Izohlar",
    en: "Notes",
  },
  };



