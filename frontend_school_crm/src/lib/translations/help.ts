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
    "uz-cyrl": "КСС (Кўп сўраладиган саволлар)",
    "uz-latn": "KSS (Ko'p so'raladigan savollar)",
    en: "FAQ",
  },
  contactSupport: {
    "uz-cyrl": "Қўллаб-қувватлаш билан боғланиш",
    "uz-latn": "Qo'llab-quvvatlash bilan bog'lanish",
    en: "Contact Support",
  },
  version: { "uz-cyrl": "Версия", "uz-latn": "Versiya", en: "Version" },
  helpDescription: {
    "uz-cyrl": "Мактаб бошқарув тизимидан фойдаланишнинг тўлиқ қўлланмаси",
    "uz-latn": "Maktab boshqaruv tizimdan foydalanishning to'liq qo'llanmasi",
    en: "Complete guide to using the School Management System",
  },
  gettingStarted: {
    "uz-cyrl": "Бошланиш",
    "uz-latn": "Boshlash",
    en: "Getting Started",
  },
  gettingStartedText: {
    "uz-cyrl":
      "Мактаб бошқарув тизимига хуш келибсиз! Бу кўп функционалли платформа сизга мактабнинг барча жихатларини бошқариш, шунингдек ўқувчилар, ўқитувчилар, синфлар, тўловлар ва молиявиятни ўқитиш ёрдам беради.",
    "uz-latn":
      "Maktab boshqaruv tizimga xush kelibsiz! Bu ko'p funktsionalli platforma sizga maktabning barcha jihatlarini boshqarish, shuningdek o'quvchilar, o'qituvchilar, sinflar, to'lovlar va moliyaviyatni o'qitish yordam beradi.",
    en: "Welcome to the Private School Management System! This comprehensive platform helps you manage all aspects of your school operations including students, teachers, classes, payments, and finances.",
  },
  featureGuide: {
    "uz-cyrl": "Функциялар қўлланмаси",
    "uz-latn": "Funktsiyalar qo'llanmasi",
    en: "Feature Guide",
  },
  studentManagement: {
    "uz-cyrl": "Ўқувчиларни бошқариш",
    "uz-latn": "O'quvchilarni boshqarish",
    en: "Student Management",
  },
  addingStudents: {
    "uz-cyrl": "Ўқувчиларни қўшиш",
    "uz-latn": "O'quvchilarni qo'shish",
    en: "Adding Students",
  },
  addingStudentsDesc: {
    "uz-cyrl":
      '"Ўқувчи қўшиш" тугмасини босинг ва шахсий исм, синф назарида қўйиш, алоқа маълумотлари ва ойлик тўлов миқдорини сақланг.',
    "uz-latn":
      "\"O'quvchi qo'shish\" tugmasini bosing va shaxsiy ism, sinf nazarida qo'yish, aloqa ma'lumotlari va oylik to'lov miqdorini saqlang.",
    en: 'Click the "Add Student" button and fill in the required information including full name, class assignment, contact details, and monthly payment amount.',
  },
  managingStudentStatus: {
    "uz-cyrl": "Ўқувчи ҳолатини бошқариш",
    "uz-latn": "O'quvchi holatini boshqarish",
    en: "Managing Student Status",
  },
  studentStatusHelp: {
    "uz-cyrl": "Ўқувчилар уч ҳолатга эга бўлиши мумкин:",
    "uz-latn": "O'quvchilar uch holatga ega bo'lishi mumkin:",
    en: "Students can have three statuses:",
  },
  activeStudentDesc: {
    "uz-cyrl": "Ҳозирда қўйилди",
    "uz-latn": "Hozirda qo'yildi",
    en: "Currently enrolled",
  },
  leftStudentDesc: {
    "uz-cyrl": "Артиқ қўйилмади",
    "uz-latn": "Artiq qo'yilmadi",
    en: "No longer enrolled",
  },
  suspendedDesc: {
    "uz-cyrl": "Вақтинчалик тўхтатилган",
    "uz-latn": "Vaqtinchalik to'xtatilgan",
    en: "Temporarily suspended",
  },
  markingStudentsAsLeft: {
    "uz-cyrl": "Ўқувчиларни чиқиб кетган сифатида белгилаш",
    "uz-latn": "O'quvchilarni chiqib ketgan sifatida belgilash",
    en: "Marking Students as Left",
  },
  markingStudentsAsLeftDesc: {
    "uz-cyrl":
      '"Чиқиб кетган деб белгилаш" тугмасини ишлатинг, ўқувчилар мактабдан чиқиб кетсалар, тўловларни қайд қилишни avtomatik то\'хтатинг.',
    "uz-latn":
      "\"Chiqib ketgan deb belgilash\" tugmasini ishlating, o'quvchilar maktabdan chiqib ketsalar, to'lovlarni qayd qilishni avtomatik to'xtatinг.",
    en: 'Use the "Mark as Left" button to automatically stop payment tracking for students who have left the school.',
  },
  teacherManagement: {
    "uz-cyrl": "Ўқитувчиларни бошқариш",
    "uz-latn": "O'qituvchilarni boshqarish",
    en: "Teacher Management",
  },
  addingTeachers: {
    "uz-cyrl": "Ўқитувчилар қўшиш",
    "uz-latn": "O'qituvchilar qo'shish",
    en: "Adding Teachers",
  },
  addingTeachersDesc: {
    "uz-cyrl":
      "Ўқитувчи маълумотларини қайд қилинг, шунда исм, фанлар, алоқа маълумотлари ва ойлик иш ҳақи. Бир ўқитувчига бирнеча фан назарида қўйиш мумкин.",
    "uz-latn":
      "O'qituvchi ma'lumotlarini qayd qilinг, shunda ism, fanlar, aloqa ma'lumotlari va oylik ish haqi. Bir o'qituvchiga birnecha fan nazarida qo'yish mumkin.",
    en: "Record teacher information including name, subjects, contact details, and monthly salary. You can assign multiple subjects to each teacher.",
  },
  assigningClasses: {
    "uz-cyrl": "Синфларни назарида қўйиш",
    "uz-latn": "Sinflarni nazarida qo'yish",
    en: "Assigning Classes",
  },
  assigningClassesDesc: {
    "uz-cyrl":
      "Ўқитувчилар синф бошқарув бўлимида синфларга назарида қўйилади. Har bir sinf bir sinf o'qituvchisiga ega bo'lishi mumkin.",
    "uz-latn":
      "O'qituvchilar sinf boshqaruv bo'limida sinflarga nazarida qo'yiladi. Har bir sinf bir sinf o'qituvchisiga ega bo'lishi mumkin.",
    en: "Teachers are assigned to classes through the Class Management section. Each class can have one class teacher.",
  },
  classManagement: {
    "uz-cyrl": "Синф бошқарувдан",
    "uz-latn": "Sinf boshqaruvdan",
    en: "Class Management",
  },
  creatingClasses: {
    "uz-cyrl": "Синф яратиш",
    "uz-latn": "Sinf yaratish",
    en: "Creating Classes",
  },
  creatingClassesDesc: {
    "uz-cyrl":
      "Синф бўлимларини (мис. 7A, 8B, 9C) яратинг ва бир ўқитувчини бир ўқитувчига назарида қўйинг. Система avtomatik ҳар bir синфда ўқувчиларнинг рўйхатдан ўтиш жарёнини қайд қилади.",
    "uz-latn":
      "Sinf bo'limlarini (mis. 7A, 8B, 9C) yaratinг va bir o'qituvchini bir o'qituvchiga nazarida qo'yinг. Sistema avtomatik har bir sinfda o'quvchilarning royxatdan o'tish jaryoni qayd qiladi.",
    en: "Create class sections (e.g., 7A, 8B, 9C) and assign a class teacher to each. The system automatically tracks student enrollment per class.",
  },
  switchingStudents: {
    "uz-cyrl": "Ўқувчиларни синфлар ўртасида ўтказиш",
    "uz-latn": "O'quvchilarni sinflar o'rtasida o'tkazish",
    en: "Switching Students Between Classes",
  },
  switchingStudentsDesc: {
    "uz-cyrl":
      "Ўқувчиларни бир синфдан икинчи синфга кўчириш мумкин. Ўқувчиларни танланг, мақсадли синфни танланг ва ўтказиш тугмасини ишлатинг.",
    "uz-latn":
      "O'quvchilarni bir sinfdan ikkinchi sinfga ko'chirish mumkin. O'quvchilarni tanlang, maqsadli sinfni tanlang va o'tkazish tugmasini ishlating.",
    en: "You can move students from one class to another. Select the students, choose the target class, and use the Switch button to transfer them.",
  },
  paymentTracking: {
    "uz-cyrl": "Тўловларни қайд қилиш",
    "uz-latn": "To'lovlarni qayd qilish",
    en: "Payment Tracking",
  },
  recordingPayments: {
    "uz-cyrl": "Тўловларни қайд қилиш",
    "uz-latn": "To'lovlarni qayd qilish",
    en: "Recording Payments",
  },
  recordingPaymentsDesc: {
    "uz-cyrl":
      "Ўқувчи тўловларини қайд қилиш учун ўқувчи танланг, сумма киритинг ва тўлов ҳолатини белгилаб қўйинг. Система avtomatik счёт номерларини тўзади.",
    "uz-latn":
      "O'quvchi to'lovlarini qayd qilish uchun o'quvchi tanlang, summa kiritinq va to'lov holatini belgilab qo'yinq. Sistema avtomatik schet nomerlarini tuzadi.",
    en: "Track student fee payments by selecting the student, entering the amount, and marking the payment status. The system automatically generates invoice numbers.",
  },
  paymentStatus: {
    "uz-cyrl": "Тўлов ҳолати",
    "uz-latn": "To'lov holati",
    en: "Payment Status",
  },
  paidDesc: {
    "uz-cyrl": "Тўлов қабул қилинди",
    "uz-latn": "To'lov qabul qilindi",
    en: "Payment received",
  },
  unpaidDesc: {
    "uz-cyrl": "Тўлов кутилаётур",
    "uz-latn": "To'lov kutilaytgur",
    en: "Payment pending",
  },
  partialDesc: {
    "uz-cyrl": "Қисман тўланган",
    "uz-latn": "Qisman to'langan",
    en: "Partially paid",
  },
  salaryManagement: {
    "uz-cyrl": "Иш ҳақи бошқарувдан",
    "uz-latn": "Ish haqi boshqaruvdan",
    en: "Salary Management",
  },
  recordingSalaries: {
    "uz-cyrl": "Иш ҳақи қайд қилиш",
    "uz-latn": "Ish haqi qayd qilish",
    en: "Recording Salaries",
  },
  recordingSalariesDesc: {
    "uz-cyrl":
      "Ўқитувчи иш ҳақи тўловларни ойлик қайд қилинг. Система avtomatik сумма ўқитувчинг ойлик иш ҳақи асосида тўлдиради, лекин қажириш керак бўлса ўзгартириш мумкин.",
    "uz-latn":
      "O'qituvchi ish haqi to'lovlarni oylik qayd qilinг. Sistema avtomatik summa o'qituvchning oylik ish haqi asosida to'ldiradi, lekin tahrif kerak bo'lsa o'zgartirish mumkin.",
    en: "Track teacher salary payments monthly. The system auto-fills the amount based on the teacher's monthly salary but allows manual adjustments if needed.",
  },
  reportsExport: {
    "uz-cyrl": "Ҳисоботлар ва Экспорт",
    "uz-latn": "Hisobotlar va Eksport",
    en: "Reports & Export",
  },
  generatingReports: {
    "uz-cyrl": "Ҳисоботлар яратиш",
    "uz-latn": "Hisobotlar yaratish",
    en: "Generating Reports",
  },
  generatingReportsDesc: {
    "uz-cyrl":
      "Ойлик ёки йиллик молиявий ҳисоботларни яратинг, даромад, харажатлар ва фойдани кўрсатув. Қайта риёя давридан танланг ва PDF ёки CSV форматига экспорт қилинг.",
    "uz-latn":
      "Oylik yoki yillik moliyaviy hisobotlarni yaratinг, daromad, xarajatlar va foyni ko'rinish. Qayta davridан tanlang va PDF yoki CSV formatiga eksport qilinг.",
    en: "Generate monthly or yearly financial reports showing income, expenses, and profit. Select the reporting period and export to PDF or CSV format.",
  },
  exportOptions: {
    "uz-cyrl": "Экспорт варианти",
    "uz-latn": "Eksport varianti",
    en: "Export Options",
  },
  pdfDesc: {
    "uz-cyrl": "Чопга оптимизланган ҳисоботлар",
    "uz-latn": "Chopga optimizlangan hisobotlar",
    en: "Professional formatted reports for printing",
  },
  csvDesc: {
    "uz-cyrl": "Excel'дағи бўлак маълумотлари яна таҳлил қилиш учун",
    "uz-latn": "Excel'dagi bo'lak ma'lumotlari yana tahlil qilish uchun",
    en: "Spreadsheet data for further analysis in Excel",
  },
  tipsAndBestPractices: {
    "uz-cyrl": "Маслаҳатлар ва Энг яхши амалиётлар",
    "uz-latn": "Maslahatlar va Eng yaxshi amaliyotlar",
    en: "Tips & Best Practices",
  },
  regularDataBackups: {
    "uz-cyrl": "Мунтазам маълумотларни захиралаш",
    "uz-latn": "Muntazam ma'lumotlarni zaxiralash",
    en: "Regular Data Backups",
  },
  regularDataBackupsDesc: {
    "uz-cyrl":
      "Маълумотларни muntazam CSV форматига экспорт қилинг. Бу тизим браузер сақловидан фойдаланади, шунинг учун браузер маълумотларини тозалаш барча ҳисоботлар ўчириб юборади.",
    "uz-latn":
      "Ma'lumotlarni muntazam CSV formatiga eksport qilinг. Bu tizim brauzer saqloshidan foydalanadi, shuning uchun brauzer ma'lumotlarini tozalash barcha hisobotlar o'chirib yuboradi.",
    en: "Export your data regularly to CSV format as a backup. This system uses browser storage, so clearing browser data will remove all records.",
  },
  useSearchFeatures: {
    "uz-cyrl": "Қидириш имкониятидан фойдаланинг",
    "uz-latn": "Qidirish imkoniyatidan foydalaning",
    en: "Use Search Features",
  },
  useSearchFeaturesDesc: {
    "uz-cyrl":
      "Har bir саҳифада қидириш функцияси бор. Ўқувчилар, ўқитувчилар ёки ҳисоботларни тез топишг ишлатинг.",
    "uz-latn":
      "Har bir sahifada qidirish funktsiyasi bor. O'quvchilar, o'qituvchilar yoki hisobotlarni tez topish uchun ishlating.",
    en: "Every page has search functionality. Use it to quickly find students, teachers, or records.",
  },
  monitorDashboard: {
    "uz-cyrl": "Бошқарув панелини мунтазам кузатиб боринг",
    "uz-latn": "Boshqaruv panelinini muntazam kuzatib boring",
    en: "Monitor the Dashboard",
  },
  monitorDashboardDesc: {
    "uz-cyrl":
      "Кутилаётган тўловлар, тўланмаган иш ҳақи ва умумий молиявий соғлиғи ҳақида тез маълумотлар учун har bir kun информацион панельни tekshiring.",
    "uz-latn":
      "Kutilayotgan to'lovlar, to'lanmagan ish haqi va umumiy moliyaviy sog'ligi haqida tez ma'lumotlar uchun har bir kun informatsion panelni tekshirinг.",
    en: "Check the dashboard daily for quick insights into pending payments, unpaid salaries, and overall financial health.",
  },
  needMoreHelp: {
    "uz-cyrl": "Ғалда ёрдам керакми?",
    "uz-latn": "Galda yordam kerakmi?",
    en: "Need More Help?",
  },
  needMoreHelpDesc: {
    "uz-cyrl":
      "Агар сизга қўшимча ёрдам керак бўлса ёки ўзига хос функциялар ҳақида саволларингиз бўлса:",
    "uz-latn":
      "Agar sizga qo'shimcha yordam kerak bo'lsa yoki o'ziga xos funktsiyalar haqida savollaringiz bo'lsa:",
    en: "If you need additional assistance or have questions about specific features:",
  },
  checkReadme: {
    "uz-cyrl": "Техник ҳужјатлар учун README.md файлини tekshiring",
    "uz-latn": "Texnik hujjatlar uchun README.md faylini tekshirinг",
    en: "Check the README.md file for technical documentation",
  },
  reviewSampleData: {
    "uz-cyrl": "Тизим қандай ишлашини кўриш учун намуна маълумотларини куруниз",
    "uz-latn":
      "Tizim qanday ishlavni ko'rish uchun namuna ma'lumotlarini ko'rinг",
    en: "Review the sample data to see how the system works",
  },
  contactAdmin: {
    "uz-cyrl":
      "Мактаб бўйича o'rnatish учун сизнинг система админист ratortiga bog'laniing",
    "uz-latn":
      "Maktab bo'ycha o'rnatish uchun sizning sistema administratorga bog'laning",
    en: "Contact your system administrator for school-specific setup",
  },
};
