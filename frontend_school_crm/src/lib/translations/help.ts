import { Translation } from "@/types";

export const helpTranslations: Partial<Translation> = {
  help: { "uz-cyrl": "Ёрдам", "uz-latn": "Yordam", en: "Help" },
  documentation: {
    "uz-cyrl": "Ҳужжатлар",
    "uz-latn": "Hujjatlar",
    en: "Documentation",
  },
  userGuide: {
    "uz-cyrl": "Фойдаланувчи қўлланмаси",
    "uz-latn": "Foydalanuvchi qo'llanmasi",
    en: "User Guide",
  },
  faq: {
    "uz-cyrl": "Кўп сўраладиган саволлар",
    "uz-latn": "Ko'p so'raladigan savollar",
    en: "FAQ",
  },
  contactSupport: {
    "uz-cyrl": "Қўллаб-қувватлаш билан боғланиш",
    "uz-latn": "Qo'llab-quvvatlash bilan bog'lanish",
    en: "Contact Support",
  },
  version: { "uz-cyrl": "Версия", "uz-latn": "Versiya", en: "Version" },
  helpDescription: {
    "uz-cyrl": "Мактаб бошқарув тизимидан фойдаланиш бўйича тўлиқ қўлланма",
    "uz-latn": "Maktab boshqaruv tizimidan foydalanish bo'yicha to'liq qo'llanma",
    en: "Complete guide to using the School Management System",
  },
  gettingStarted: {
    "uz-cyrl": "Бошлаш учун",
    "uz-latn": "Boshlash uchun",
    en: "Getting Started",
  },
  gettingStartedText: {
    "uz-cyrl":
      "Мактаб бошқарув тизимига хуш келибсиз! Бу платформа орқали ўқувчилар, ўқитувчилар, синфлар, дарс жадвали, давомат, вазифалар, тўловлар ва молиявий ҳисоботларни бир жойдан бошқарасиз.",
    "uz-latn":
      "Maktab boshqaruv tizimiga xush kelibsiz! Bu platforma orqali o'quvchilar, o'qituvchilar, sinflar, dars jadvali, davomat, vazifalar, to'lovlar va moliyaviy hisobotlarni bir joydan boshqarasiz.",
    en: "Welcome to the School Management System! This platform lets you manage students, teachers, classes, schedules, attendance, assignments, payments, and financial reports all in one place.",
  },
  featureGuide: {
    "uz-cyrl": "Функциялар қўлланмаси",
    "uz-latn": "Funksiyalar qo'llanmasi",
    en: "Feature Guide",
  },

  // ── Students ──────────────────────────────────────────────────────────
  studentManagement: {
    "uz-cyrl": "Ўқувчиларни бошқариш",
    "uz-latn": "O'quvchilarni boshqarish",
    en: "Student Management",
  },
  addingStudents: {
    "uz-cyrl": "Ўқувчи қўшиш",
    "uz-latn": "O'quvchi qo'shish",
    en: "Adding Students",
  },
  addingStudentsDesc: {
    "uz-cyrl":
      "«Ўқувчи қўшиш» тугмасини босинг ва тўлиқ исм, синф, алоқа маълумотлари ҳамда ойлик тўлов миқдорини киритинг.",
    "uz-latn":
      "\"O'quvchi qo'shish\" tugmasini bosing va to'liq ism, sinf, aloqa ma'lumotlari hamda oylik to'lov miqdorini kiriting.",
    en: 'Click the "Add Student" button and fill in the full name, class, contact details, and monthly payment amount.',
  },
  managingStudentStatus: {
    "uz-cyrl": "Ўқувчи ҳолатини бошқариш",
    "uz-latn": "O'quvchi holatini boshqarish",
    en: "Managing Student Status",
  },
  studentStatusHelp: {
    "uz-cyrl": "Ўқувчи учта ҳолатдан бирида бўлиши мумкин:",
    "uz-latn": "O'quvchi uchta holatdan birida bo'lishi mumkin:",
    en: "A student can have one of three statuses:",
  },
  activeStudentDesc: {
    "uz-cyrl": "Ҳозирда ўқияпти",
    "uz-latn": "Hozirda o'qiyapti",
    en: "Currently enrolled",
  },
  leftStudentDesc: {
    "uz-cyrl": "Мактабни тарк этган",
    "uz-latn": "Maktabni tark etgan",
    en: "No longer enrolled",
  },
  suspendedDesc: {
    "uz-cyrl": "Вақтинча тўхтатилган",
    "uz-latn": "Vaqtincha to'xtatilgan",
    en: "Temporarily suspended",
  },
  markingStudentsAsLeft: {
    "uz-cyrl": "Ўқувчини «чиққан» деб белгилаш",
    "uz-latn": "O'quvchini \"chiqqan\" deb belgilash",
    en: "Marking Students as Left",
  },
  markingStudentsAsLeftDesc: {
    "uz-cyrl":
      "Ўқувчи мактабни тарк этганда «Чиққан деб белгилаш» тугмасидан фойдаланинг — бу ўша ўқувчи учун тўлов кузатувини автоматик тўхтатади.",
    "uz-latn":
      "O'quvchi maktabni tark etganda \"Chiqqan deb belgilash\" tugmasidan foydalaning — bu o'sha o'quvchi uchun to'lov kuzatuvini avtomatik to'xtatadi.",
    en: 'Use the "Mark as Left" button when a student leaves the school — it automatically stops payment tracking for that student.',
  },

  // ── Teachers ──────────────────────────────────────────────────────────
  teacherManagement: {
    "uz-cyrl": "Ўқитувчиларни бошқариш",
    "uz-latn": "O'qituvchilarni boshqarish",
    en: "Teacher Management",
  },
  addingTeachers: {
    "uz-cyrl": "Ўқитувчи қўшиш",
    "uz-latn": "O'qituvchi qo'shish",
    en: "Adding Teachers",
  },
  addingTeachersDesc: {
    "uz-cyrl":
      "Ўқитувчининг исми, фанлари, алоқа маълумотлари ва ойлик иш ҳақини киритинг. Бир ўқитувчига бир нечта фан бириктириш мумкин.",
    "uz-latn":
      "O'qituvchining ismi, fanlari, aloqa ma'lumotlari va oylik ish haqini kiriting. Bir o'qituvchiga bir nechta fan biriktirish mumkin.",
    en: "Enter the teacher's name, subjects, contact details, and monthly salary. You can assign multiple subjects to each teacher.",
  },
  assigningClasses: {
    "uz-cyrl": "Синф бириктириш",
    "uz-latn": "Sinf biriktirish",
    en: "Assigning Classes",
  },
  assigningClassesDesc: {
    "uz-cyrl":
      "Ўқитувчилар «Синфлар» бўлимида синфга бириктирилади. Ҳар бир синфнинг битта раҳбар ўқитувчиси бўлиши мумкин.",
    "uz-latn":
      "O'qituvchilar \"Sinflar\" bo'limida sinfga biriktiriladi. Har bir sinfning bitta rahbar o'qituvchisi bo'lishi mumkin.",
    en: "Teachers are assigned to a class from the Classes section. Each class can have one class teacher.",
  },

  // ── Classes ───────────────────────────────────────────────────────────
  classManagement: {
    "uz-cyrl": "Синфларни бошқариш",
    "uz-latn": "Sinflarni boshqarish",
    en: "Class Management",
  },
  creatingClasses: {
    "uz-cyrl": "Синф яратиш",
    "uz-latn": "Sinf yaratish",
    en: "Creating Classes",
  },
  creatingClassesDesc: {
    "uz-cyrl":
      "Синф бўлимларини (мас. 7А, 8Б, 9В) яратинг ва ҳар бирига раҳбар ўқитувчи бириктиринг. Тизим ҳар бир синфдаги ўқувчилар сонини автоматик кузатади.",
    "uz-latn":
      "Sinf bo'limlarini (mas. 7A, 8B, 9V) yarating va har biriga rahbar o'qituvchi biriktiring. Tizim har bir sinfdagi o'quvchilar sonini avtomatik kuzatadi.",
    en: "Create class sections (e.g., 7A, 8B, 9C) and assign a class teacher to each. The system automatically tracks student enrollment per class.",
  },
  switchingStudents: {
    "uz-cyrl": "Ўқувчини бошқа синфга ўтказиш",
    "uz-latn": "O'quvchini boshqa sinfga o'tkazish",
    en: "Switching Students Between Classes",
  },
  switchingStudentsDesc: {
    "uz-cyrl":
      "Ўқувчини бир синфдан бошқасига ўтказиш мумкин: ўқувчини танланг, мақсадли синфни белгиланг ва «Ўтказиш» тугмасини босинг.",
    "uz-latn":
      "O'quvchini bir sinfdan boshqasiga o'tkazish mumkin: o'quvchini tanlang, maqsadli sinfni belgilang va \"O'tkazish\" tugmasini bosing.",
    en: "You can move a student from one class to another: select the student, choose the target class, and press the Switch button.",
  },

  // ── Attendance (new) ─────────────────────────────────────────────────
  attendanceManagement: {
    "uz-cyrl": "Давоматни бошқариш",
    "uz-latn": "Davomatni boshqarish",
    en: "Attendance",
  },
  markingAttendance: {
    "uz-cyrl": "Давоматни белгилаш",
    "uz-latn": "Davomatni belgilash",
    en: "Marking Attendance",
  },
  markingAttendanceDesc: {
    "uz-cyrl":
      "«Давомат» бўлимида синф ва санани танлаб, ҳар бир ўқувчи учун ҳозир, кеч қолди ёки йўқ ҳолатини белгиланг.",
    "uz-latn":
      "\"Davomat\" bo'limida sinf va sanani tanlab, har bir o'quvchi uchun hozir, kech qoldi yoki yo'q holatini belgilang.",
    en: "In the Attendance section, pick a class and date, then mark each student as present, late, or absent.",
  },
  viewingAttendanceStats: {
    "uz-cyrl": "Давомат статистикаси",
    "uz-latn": "Davomat statistikasi",
    en: "Attendance Statistics",
  },
  viewingAttendanceStatsDesc: {
    "uz-cyrl":
      "Ойлик давомат фоизини ва кетма-кет дарсга келмаган ўқувчиларни (диққат талаб қиладиганлар) кўриш мумкин.",
    "uz-latn":
      "Oylik davomat foizini va ketma-ket darsga kelmagan o'quvchilarni (diqqat talab qiladiganlar) ko'rish mumkin.",
    en: "View the monthly attendance percentage and students with consecutive absences who may need attention.",
  },

  // ── Schedule (new) ───────────────────────────────────────────────────
  scheduleManagement: {
    "uz-cyrl": "Дарс жадвали",
    "uz-latn": "Dars jadvali",
    en: "Schedule",
  },
  creatingSchedule: {
    "uz-cyrl": "Дарс жадвалини тузиш",
    "uz-latn": "Dars jadvalini tuzish",
    en: "Building the Schedule",
  },
  creatingScheduleDesc: {
    "uz-cyrl":
      "Ҳар бир синф учун ҳафта кунлари бўйича дарс вақтини, фан ва ўқитувчини киритиб, дарс жадвалини яратинг.",
    "uz-latn":
      "Har bir sinf uchun hafta kunlari bo'yicha dars vaqtini, fan va o'qituvchini kiritib, dars jadvalini yarating.",
    en: "Build a weekly timetable for each class by adding time slots with a subject and teacher.",
  },

  // ── Assignments (new) ────────────────────────────────────────────────
  assignmentManagement: {
    "uz-cyrl": "Вазифаларни бошқариш",
    "uz-latn": "Vazifalarni boshqarish",
    en: "Assignments",
  },
  creatingAssignments: {
    "uz-cyrl": "Вазифа яратиш",
    "uz-latn": "Vazifa yaratish",
    en: "Creating Assignments",
  },
  creatingAssignmentsDesc: {
    "uz-cyrl":
      "Синф, фан, сарлавҳа ва топшириш муддатини кўрсатиб янги вазифа қўшинг.",
    "uz-latn":
      "Sinf, fan, sarlavha va topshirish muddatini ko'rsatib yangi vazifa qo'shing.",
    en: "Add a new assignment by choosing the class and subject, then setting a title and due date.",
  },
  trackingSubmissions: {
    "uz-cyrl": "Топширилганини кузатиш",
    "uz-latn": "Topshirilganini kuzatish",
    en: "Tracking Submissions",
  },
  trackingSubmissionsDesc: {
    "uz-cyrl":
      "Ҳар бир вазифа қанча ўқувчи томонидан топширилганини кўрсатади, муддати ўтган вазифалар алоҳида ажратиб кўрсатилади.",
    "uz-latn":
      "Har bir vazifa qancha o'quvchi tomonidan topshirilganini ko'rsatadi, muddati o'tgan vazifalar alohida ajratib ko'rsatiladi.",
    en: "Each assignment shows how many students have submitted it, and overdue assignments are highlighted separately.",
  },

  // ── Messaging (new) ──────────────────────────────────────────────────
  messagingFeature: {
    "uz-cyrl": "Хабар юбориш",
    "uz-latn": "Xabar yuborish",
    en: "Messaging",
  },
  sendingMassMessages: {
    "uz-cyrl": "Оммавий хабар юбориш",
    "uz-latn": "Ommaviy xabar yuborish",
    en: "Sending Mass Messages",
  },
  sendingMassMessagesDesc: {
    "uz-cyrl":
      "Синф ёки тўлов ҳолати бўйича қабул қилувчиларни танлаб, тайёр шаблон ёки ўз матнингиз билан ота-оналарга хабар юборинг.",
    "uz-latn":
      "Sinf yoki to'lov holati bo'yicha qabul qiluvchilarni tanlab, tayyor shablon yoki o'z matningiz bilan ota-onalarga xabar yuboring.",
    en: "Filter recipients by class or payment status, then message parents using a ready-made template or your own text.",
  },

  // ── Payments ──────────────────────────────────────────────────────────
  paymentTracking: {
    "uz-cyrl": "Тўловларни қайд қилиш",
    "uz-latn": "To'lovlarni qayd qilish",
    en: "Payment Tracking",
  },
  recordingPayments: {
    "uz-cyrl": "Тўлов қайд қилиш",
    "uz-latn": "To'lov qayd qilish",
    en: "Recording Payments",
  },
  recordingPaymentsDesc: {
    "uz-cyrl":
      "Ўқувчини танланг, суммани киритинг ва тўлов ҳолатини белгиланг. Ҳисоб-фактура рақами тизим томонидан автоматик яратилади.",
    "uz-latn":
      "O'quvchini tanlang, summani kiriting va to'lov holatini belgilang. Hisob-faktura raqami tizim tomonidan avtomatik yaratiladi.",
    en: "Select the student, enter the amount, and set the payment status. The system automatically generates the invoice number.",
  },
  paymentStatus: {
    "uz-cyrl": "Тўлов ҳолати",
    "uz-latn": "To'lov holati",
    en: "Payment Status",
  },
  paidDesc: {
    "uz-cyrl": "Тўлов қабул қилинган",
    "uz-latn": "To'lov qabul qilingan",
    en: "Payment received",
  },
  unpaidDesc: {
    "uz-cyrl": "Тўлов кутилмоқда",
    "uz-latn": "To'lov kutilmoqda",
    en: "Payment pending",
  },
  partialDesc: {
    "uz-cyrl": "Қисман тўланган",
    "uz-latn": "Qisman to'langan",
    en: "Partially paid",
  },

  // ── Expenses (new) ───────────────────────────────────────────────────
  expenseManagement: {
    "uz-cyrl": "Харажатларни бошқариш",
    "uz-latn": "Xarajatlarni boshqarish",
    en: "Expenses",
  },
  recordingExpenses: {
    "uz-cyrl": "Харажат қайд қилиш",
    "uz-latn": "Xarajat qayd qilish",
    en: "Recording Expenses",
  },
  recordingExpensesDesc: {
    "uz-cyrl":
      "Тоифа, сумма, тўлов усули ва санани кўрсатиб харажатни қайд қилинг — жадвал ва диаграммаларда дарҳол акс этади.",
    "uz-latn":
      "Toifa, summa, to'lov usuli va sanani ko'rsatib xarajatni qayd qiling — jadval va diagrammalarda darhol aks etadi.",
    en: "Record an expense with its category, amount, payment method, and date — it appears in the table and charts immediately.",
  },
  expenseBudgets: {
    "uz-cyrl": "Тоифа бўйича бюджет",
    "uz-latn": "Toifa bo'yicha byudjet",
    en: "Category Budgets",
  },
  expenseBudgetsDesc: {
    "uz-cyrl":
      "Ҳар бир харажат тоифаси учун ойлик бюджет белгиланг — бюджетдан ошиб кетилса, тизим огоҳлантиради.",
    "uz-latn":
      "Har bir xarajat toifasi uchun oylik byudjet belgilang — byudjetdan oshib ketilsa, tizim ogohlantiradi.",
    en: "Set a monthly budget for each expense category — the system warns you when spending goes over it.",
  },

  // ── Salaries ──────────────────────────────────────────────────────────
  salaryManagement: {
    "uz-cyrl": "Иш ҳақини бошқариш",
    "uz-latn": "Ish haqini boshqarish",
    en: "Salary Management",
  },
  recordingSalaries: {
    "uz-cyrl": "Иш ҳақини қайд қилиш",
    "uz-latn": "Ish haqini qayd qilish",
    en: "Recording Salaries",
  },
  recordingSalariesDesc: {
    "uz-cyrl":
      "Ўқитувчиларнинг ойлик иш ҳақи тўловларини қайд қилинг. Сумма ўқитувчининг белгиланган ойлик маошидан автоматик олинади, лекин зарур бўлса ўзгартириш мумкин.",
    "uz-latn":
      "O'qituvchilarning oylik ish haqi to'lovlarini qayd qiling. Summa o'qituvchining belgilangan oylik maoshidan avtomatik olinadi, lekin zarur bo'lsa o'zgartirish mumkin.",
    en: "Record teachers' monthly salary payments. The amount is auto-filled from the teacher's set monthly salary but can be adjusted if needed.",
  },

  // ── Reports ───────────────────────────────────────────────────────────
  reportsExport: {
    "uz-cyrl": "Ҳисоботлар ва экспорт",
    "uz-latn": "Hisobotlar va eksport",
    en: "Reports & Export",
  },
  generatingReports: {
    "uz-cyrl": "Ҳисобот яратиш",
    "uz-latn": "Hisobot yaratish",
    en: "Generating Reports",
  },
  generatingReportsDesc: {
    "uz-cyrl":
      "Даромад, харажат ва фойдани кўрсатувчи ойлик молиявий ҳисоботларни яратинг. Даврни танланг ва PDF ёки CSV форматида экспорт қилинг.",
    "uz-latn":
      "Daromad, xarajat va foydani ko'rsatuvchi oylik moliyaviy hisobotlarni yarating. Davrni tanlang va PDF yoki CSV formatida eksport qiling.",
    en: "Generate monthly financial reports showing income, expenses, and profit. Choose the period and export to PDF or CSV.",
  },
  exportOptions: {
    "uz-cyrl": "Экспорт вариантлари",
    "uz-latn": "Eksport variantlari",
    en: "Export Options",
  },
  pdfDesc: {
    "uz-cyrl": "Чоп этиш учун тайёр форматланган ҳисобот",
    "uz-latn": "Chop etish uchun tayyor formatlangan hisobot",
    en: "Professionally formatted report, ready to print",
  },
  csvDesc: {
    "uz-cyrl": "Excel'да қўшимча таҳлил қилиш учун жадвал маълумотлари",
    "uz-latn": "Excel'da qo'shimcha tahlil qilish uchun jadval ma'lumotlari",
    en: "Spreadsheet data for further analysis in Excel",
  },

  // ── Tips ──────────────────────────────────────────────────────────────
  tipsAndBestPractices: {
    "uz-cyrl": "Маслаҳатлар ва тавсиялар",
    "uz-latn": "Maslahatlar va tavsiyalar",
    en: "Tips & Best Practices",
  },
  regularDataBackups: {
    "uz-cyrl": "Ҳисоботларни мунтазам экспорт қилинг",
    "uz-latn": "Hisobotlarni muntazam eksport qiling",
    en: "Export Reports Regularly",
  },
  regularDataBackupsDesc: {
    "uz-cyrl":
      "Молиявий ва бошқа ҳисоботларни вақти-вақти билан CSV форматида юклаб олиб, ўз архивингизда сақланг.",
    "uz-latn":
      "Moliyaviy va boshqa hisobotlarni vaqti-vaqti bilan CSV formatida yuklab olib, o'z arxivingizda saqlang.",
    en: "Periodically download financial and other reports as CSV and keep them in your own archive.",
  },
  useSearchFeatures: {
    "uz-cyrl": "Қидирувдан фойдаланинг",
    "uz-latn": "Qidiruvdan foydalaning",
    en: "Use Search",
  },
  useSearchFeaturesDesc: {
    "uz-cyrl":
      "Юқоридаги саҳифа сарлавҳасидаги қидирув орқали ўқувчи, ўқитувчи ёки синфни исми бўйича дарҳол топинг. Кўпгина рўйхат саҳифаларида ҳам ўз қидируви мавжуд.",
    "uz-latn":
      "Yuqoridagi sahifa sarlavhasidagi qidiruv orqali o'quvchi, o'qituvchi yoki sinfni ismi bo'yicha darhol toping. Ko'pgina ro'yxat sahifalarida ham o'z qidiruvi mavjud.",
    en: "Use the search bar in the top header to instantly find a student, teacher, or class by name. Most list pages also have their own local search.",
  },
  monitorDashboard: {
    "uz-cyrl": "Бошқарув панелини мунтазам кузатиб боринг",
    "uz-latn": "Boshqaruv panelini muntazam kuzatib boring",
    en: "Monitor the Dashboard",
  },
  monitorDashboardDesc: {
    "uz-cyrl":
      "Кутилаётган тўловлар, тўланмаган иш ҳақи ва умумий молиявий ҳолат ҳақида тезкор маълумот учун бошқарув панелини ҳар куни текширинг.",
    "uz-latn":
      "Kutilayotgan to'lovlar, to'lanmagan ish haqi va umumiy moliyaviy holat haqida tezkor ma'lumot uchun boshqaruv panelini har kuni tekshiring.",
    en: "Check the dashboard daily for a quick view of pending payments, unpaid salaries, and overall financial health.",
  },
  needMoreHelp: {
    "uz-cyrl": "Кўпроқ ёрдам керакми?",
    "uz-latn": "Ko'proq yordam kerakmi?",
    en: "Need More Help?",
  },
  needMoreHelpDesc: {
    "uz-cyrl":
      "Агар сизга қўшимча ёрдам керак бўлса ёки муайян функциялар бўйича саволингиз бўлса:",
    "uz-latn":
      "Agar sizga qo'shimcha yordam kerak bo'lsa yoki muayyan funksiyalar bo'yicha savolingiz bo'lsa:",
    en: "If you need additional assistance or have a question about a specific feature:",
  },
  checkReadme: {
    "uz-cyrl": "Пастдаги мавзулар бўйича шу қўлланмани қайта кўриб чиқинг",
    "uz-latn": "Pastdagi mavzular bo'yicha shu qo'llanmani qayta ko'rib chiqing",
    en: "Revisit the topics in this guide above",
  },
  reviewSampleData: {
    "uz-cyrl": "Функция қандай ишлашини кўриш учун синов сифатида озгина маълумот киритиб кўринг",
    "uz-latn": "Funksiya qanday ishlashini ko'rish uchun sinov sifatida ozgina ma'lumot kiritib ko'ring",
    en: "Try entering a small amount of test data to see how a feature works",
  },
  contactAdmin: {
    "uz-cyrl": "Мактабингизга хос созлашлар учун тизим администраторингизга мурожаат қилинг",
    "uz-latn": "Maktabingizga xos sozlashlar uchun tizim administratoringizga murojaat qiling",
    en: "Contact your system administrator for school-specific setup",
  },
};
