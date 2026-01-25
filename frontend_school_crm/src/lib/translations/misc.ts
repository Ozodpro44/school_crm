import { Translation } from "@/types";

export const miscTranslations: Partial<Translation> = {
  // Dashboard
  dashboard: { "uz-cyrl": "Асосий панел", "uz-latn": "Asosiy panel", en: "Dashboard" },
  totalIncome: { "uz-cyrl": "Жами даромад", "uz-latn": "Jami daromad", en: "Total Income" },
  totalExpenses: { "uz-cyrl": "Жами харажат", "uz-latn": "Jami xarajat", en: "Total Expenses" },
  profit: { "uz-cyrl": "Фойда", "uz-latn": "Foyda", en: "Profit" },
  netProfit: { "uz-cyrl": "Соф фойда", "uz-latn": "Sof foyda", en: "Net Profit" },
  students: { "uz-cyrl": "Ўқувчилар", "uz-latn": "O'quvchilar", en: "Students" },
  teachers: { "uz-cyrl": "Ўқитувчилар", "uz-latn": "O'qituvchilar", en: "Teachers" },
  totalEnrolled: { "uz-cyrl": "жами ўлшов", "uz-latn": "jami o'quvchilar", en: "total enrolled" },
  activeFacultyMembers: { "uz-cyrl": "фаол ўқитувчилар", "uz-latn": "faol o'qituvchilar", en: "active faculty members" },
  fromStudentPayments: { "uz-cyrl": "ўқувчи тўловларидан", "uz-latn": "o'quvchi to'lovlaridan", en: "from student payments" },
  incomeMinusExpenses: { "uz-cyrl": "даромад минус харажат", "uz-latn": "daromad minus xarajat", en: "income minus expenses" },
  pendingPayments: { "uz-cyrl": "Ўтқазиб юборилган тўловлар", "uz-latn": "O'tkázib yuborilgan to'lovlar", en: "Pending Payments" },
  pendingExpenses: { "uz-cyrl": "Ўтқазиб юборилган харажатлар", "uz-latn": "Kutilayotgan xarajatlar", en: "Pending Expenses" },
  studentDebtors: { "uz-cyrl": "Ўқувчи қарздорлари", "uz-latn": "O'quvchi qarzdorlari", en: "Student Debtors" },
  pendingStudentPayments: { "uz-cyrl": "Ўқувчиларнинг ўтқазиб юборилган тўловлари", "uz-latn": "O'quvchilarning o'tkazib yuborilgan to'lovlari", en: "Students with pending payments" },
  studentsWithUnpaidFees: { "uz-cyrl": "Тўланмаган туй қўшилган ўқувчилар", "uz-latn": "To'lanmagan to'lovlari bor o'quvchilar", en: "Students with unpaid fees" },
  unpaidSalaries: { "uz-cyrl": "Тўланмаган маиш", "uz-latn": "To'lanmagan ish haqi", en: "Unpaid Salaries" },
  teacherSalaryPaymentsDue: { "uz-cyrl": "ўқитувчи маищ тўловлари қўшилиб қолди", "uz-latn": "o'qituvchi ish haqi to'lovlari kutilayotgan", en: "teacher salary payments due" },
  financialOverviewLastSixMonths: { "uz-cyrl": "Молиявий кўриниш - охирги 6 ой", "uz-latn": "Moliyaviy ko'rinish - oxirgi 6 oy", en: "Financial Overview - Last 6 Months" },
  quickStatsSummary: { "uz-cyrl": "Тез статистика ҳулоса", "uz-latn": "Tez statistika xulosa", en: "Quick Stats Summary" },
  welcomeToSchoolManagement: { "uz-cyrl": "мактаб бошқаруви тизимига хуш келибсиз", "uz-latn": "maktab boshqaruvi tizimiga xush kelibsiz", en: "welcome to school management system" },
  financialOverview: { "uz-cyrl": "Молиявий кўриниш", "uz-latn": "Moliyaviy ko'rinish", en: "Financial Overview" },
  last12Months: { "uz-cyrl": "Сўнгги 12 ой", "uz-latn": "So'nggi 12 oy", en: "Last 12 Months" },
  recentActivity: { "uz-cyrl": "Сўнгги фаолият", "uz-latn": "So'nggi faoliyat", en: "Recent Activity" },
  quickActions: { "uz-cyrl": "Тезкор амаллар", "uz-latn": "Tezkor amallar", en: "Quick Actions" },
  viewAll: { "uz-cyrl": "Ҳаммасини кўриш", "uz-latn": "Hammasini ko'rish", en: "View All" },
  welcomeBack: { "uz-cyrl": "Хуш келибсиз", "uz-latn": "Xush kelibsiz", en: "Welcome Back" },
  privateSchoolManagement: { "uz-cyrl": "Хусусий мактаб бошқаруви", "uz-latn": "Xususiy maktab boshqaruvi", en: "Private School Management" },

  // Messages
  success: { "uz-cyrl": "Муваффақият", "uz-latn": "Muvaffaqiyat", en: "Success" },
  error: { "uz-cyrl": "Хато", "uz-latn": "Xato", en: "Error" },
  confirmDelete: { "uz-cyrl": "Ростдан ҳам ўчирмоқчимисиз?", "uz-latn": "Rostdan ham o'chirmoqchimisiz?", en: "Are you sure you want to delete?" },
  noData: { "uz-cyrl": "Маълумот йўқ", "uz-latn": "Ma'lumot yo'q", en: "No data" },
  areYouSure: { "uz-cyrl": "Ишончингиз комилми?", "uz-latn": "Ishonchingiz komilmi?", en: "Are you sure?" },
  cannotBeUndone: { "uz-cyrl": "Бу амални бекор қилиб бўлмайди", "uz-latn": "Bu amalni bekor qilib bo'lmaydi", en: "This action cannot be undone" },
  confirmAction: { "uz-cyrl": "Амални тасдиқланг", "uz-latn": "Amalni tasdiqlang", en: "Confirm Action" },
  
  // Loading states
  loading: { "uz-cyrl": "Юкланмоқда...", "uz-latn": "Yuklanmoqda...", en: "Loading..." },
  pleaseWait: { "uz-cyrl": "Илтимос, кутинг", "uz-latn": "Iltimos, kuting", en: "Please wait" },
  processing: { "uz-cyrl": "Ишланмоқда...", "uz-latn": "Ishlanmoqda...", en: "Processing..." },

  // Form
  required: { "uz-cyrl": "Мажбурий", "uz-latn": "Majburiy", en: "Required" },
  optional: { "uz-cyrl": "Ихтиёрий", "uz-latn": "Ixtiyoriy", en: "Optional" },
  selectOption: { "uz-cyrl": "Вариантни танланг", "uz-latn": "Variantni tanlang", en: "Select Option" },
  enterValue: { "uz-cyrl": "Қийматни киритинг", "uz-latn": "Qiymatni kiriting", en: "Enter Value" },
  chooseFile: { "uz-cyrl": "Файл танланг", "uz-latn": "Fayl tanlang", en: "Choose File" },
  uploadFile: { "uz-cyrl": "Файл юклаш", "uz-latn": "Fayl yuklash", en: "Upload File" },
  fieldRequired: { "uz-cyrl": "Бу майдон мажбурий", "uz-latn": "Bu maydon majburi", en: "This field is required" },
  invalidEmail: { "uz-cyrl": "Яроқсиз email манзил", "uz-latn": "Yaroqsiz email manzil", en: "Invalid email address" },
  invalidPhone: { "uz-cyrl": "Яроқсиз телефон рақами", "uz-latn": "Yaroqsiz telefon raqami", en: "Invalid phone number" },
  passwordTooShort: { "uz-cyrl": "Парол жуда қисқа", "uz-latn": "Parol juda qisqa", en: "Password too short" },
  passwordsDontMatch: { "uz-cyrl": "Пароллар мос келмади", "uz-latn": "Parollar mos kelmadi", en: "Passwords don't match" },
  
  // Table
  showing: { "uz-cyrl": "Кўрсатилмоқда", "uz-latn": "Ko'rsatilmoqda", en: "Showing" },
  results: { "uz-cyrl": "натижалар", "uz-latn": "natijalar", en: "results" },
  
  // Pagination
  perPage: { "uz-cyrl": "Сахифада", "uz-latn": "Sahifada", en: "Per Page" },
  page: { "uz-cyrl": "Сахифа", "uz-latn": "Sahifa", en: "Page" },
  of: { "uz-cyrl": "дан", "uz-latn": "dan", en: "of" },
  to: { "uz-cyrl": "га", "uz-latn": "ga", en: "to" },
  previous: { "uz-cyrl": "Олдинги", "uz-latn": "Oldingi", en: "Previous" },
  next: { "uz-cyrl": "Кейинги", "uz-latn": "Keyingi", en: "Next" },
  
  // Payment methods
  cashPayments: { "uz-cyrl": "Нақд тўловлар", "uz-latn": "Naqd to'lovlar", en: "Cash Payments" },
  cardPayments: { "uz-cyrl": "Карта тўловлари", "uz-latn": "Karta to'lovlari", en: "Card Payments" },
  bankPayments: { "uz-cyrl": "Банк ўтказмалари", "uz-latn": "Bank o'tkazmalari", en: "Bank Payments" },

  // Month abbreviations
  Jan: { "uz-cyrl": "Янв", "uz-latn": "Yanv", en: "Jan" },
  Feb: { "uz-cyrl": "Фев", "uz-latn": "Fev", en: "Feb" },
  Mar: { "uz-cyrl": "Мар", "uz-latn": "Mar", en: "Mar" },
  Apr: { "uz-cyrl": "Апр", "uz-latn": "Apr", en: "Apr" },
  May: { "uz-cyrl": "Май", "uz-latn": "May", en: "May" },
  Jun: { "uz-cyrl": "Июн", "uz-latn": "Iyun", en: "Jun" },
  Jul: { "uz-cyrl": "Июл", "uz-latn": "Iyul", en: "Jul" },
  Aug: { "uz-cyrl": "Авг", "uz-latn": "Aug", en: "Aug" },
  Sep: { "uz-cyrl": "Сен", "uz-latn": "Sen", en: "Sep" },
  Oct: { "uz-cyrl": "Окт", "uz-latn": "Okt", en: "Oct" },
  Nov: { "uz-cyrl": "Ноя", "uz-latn": "Noya", en: "Nov" },
  Dec: { "uz-cyrl": "Дек", "uz-latn": "Dek", en: "Dec" },
  };