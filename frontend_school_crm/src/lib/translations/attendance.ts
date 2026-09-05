import { Translation } from "@/types";

// Hikvision Face ID attendance integration (admin-only section).
export const attendanceTranslations: Partial<Translation> = {
  attendance: { "uz-cyrl": "Давомат", "uz-latn": "Davomat", en: "Attendance" },
  attendanceSubtitle: {
    "uz-cyrl": "Face ID қурилмалари орқали ходимлар давоматини бошқаринг",
    "uz-latn": "Face ID qurilmalari orqali xodimlar davomatini boshqaring",
    en: "Manage staff attendance via Face ID devices",
  },

  tabDevices: { "uz-cyrl": "Қурилмалар", "uz-latn": "Qurilmalar", en: "Devices" },
  tabEmployees: { "uz-cyrl": "Ходимлар", "uz-latn": "Xodimlar", en: "Employees" },
  tabRecords: { "uz-cyrl": "Давомат ёзувлари", "uz-latn": "Davomat yozuvlari", en: "Attendance log" },

  hikvisionCliNote: {
    "uz-cyrl": "Эслатма: агар қурилма мактабнинг ички тармоғида бўлса (роутерга кириш йўқ бўлса), уни бу ердан эмас, ноутбукдаги hikvision-cli буйруғи орқали қўшинг — иккаласи ҳам битта базага ёзади.",
    "uz-latn": "Eslatma: agar qurilma maktabning ichki tarmog'ida bo'lsa (routerga kirish yo'q bo'lsa), uni bu yerdan emas, noutbukdagi hikvision-cli buyrug'i orqali qo'shing — ikkalasi ham bitta bazaga yozadi.",
    en: "Note: if the device sits on a private network with no router access, add it via the hikvision-cli tool on a laptop on that network instead — both write to the same database.",
  },

  selectBranchFirst: {
    "uz-cyrl": "Аввал филиални танланг",
    "uz-latn": "Avval filialni tanlang",
    en: "Select a branch first",
  },

  addDevice: { "uz-cyrl": "Қурилма қўшиш", "uz-latn": "Qurilma qo'shish", en: "Add Device" },
  addNewDevice: { "uz-cyrl": "Янги қурилма қўшиш", "uz-latn": "Yangi qurilma qo'shish", en: "Add New Device" },
  deviceName: { "uz-cyrl": "Қурилма номи", "uz-latn": "Qurilma nomi", en: "Device Name" },
  deviceHost: { "uz-cyrl": "IP манзил", "uz-latn": "IP manzil", en: "Device IP" },
  deviceHostHint: {
    "uz-cyrl": "Масалан: 192.168.0.115",
    "uz-latn": "Masalan: 192.168.0.115",
    en: "e.g. 192.168.0.115",
  },
  deviceUsername: { "uz-cyrl": "Фойдаланувчи номи", "uz-latn": "Foydalanuvchi nomi", en: "Username" },
  noDevicesYet: { "uz-cyrl": "Ҳали қурилмалар йўқ", "uz-latn": "Hali qurilmalar yo'q", en: "No devices yet" },
  failedToLoadDevices: {
    "uz-cyrl": "Қурилмаларни юклаб бўлмади",
    "uz-latn": "Qurilmalarni yuklab bo'lmadi",
    en: "Failed to load devices",
  },
  deviceAdded: {
    "uz-cyrl": "Қурилма муваффақиятли қўшилди",
    "uz-latn": "Qurilma muvaffaqiyatli qo'shildi",
    en: "Device added successfully",
  },
  failedToAddDevice: {
    "uz-cyrl": "Қурилмани қўшиб бўлмади — IP, логин ёки паролни текширинг",
    "uz-latn": "Qurilmani qo'shib bo'lmadi — IP, login yoki parolni tekshiring",
    en: "Failed to add device — check the IP, username and password",
  },

  configurePush: { "uz-cyrl": "Push созлаш", "uz-latn": "Push sozlash", en: "Configure Push" },
  configurePushDescription: {
    "uz-cyrl": "Қурилмага юз таниганда шу манзилга хабар юборишни буюринг",
    "uz-latn": "Qurilmaga yuz taniganda shu manzilga xabar yuborishni buyuring",
    en: "Tell the device to push face-match events to this address",
  },
  publicHost: { "uz-cyrl": "Оммавий домен/host", "uz-latn": "Ommaviy domen/host", en: "Public Host" },
  publicPort: { "uz-cyrl": "Порт", "uz-latn": "Port", en: "Port" },
  useHttps: { "uz-cyrl": "HTTPS ишлатиш", "uz-latn": "HTTPS ishlatish", en: "Use HTTPS" },
  pushConfigured: {
    "uz-cyrl": "Push хабарномалар созланди",
    "uz-latn": "Push xabarnomalar sozlandi",
    en: "Push notifications configured",
  },
  failedToConfigurePush: {
    "uz-cyrl": "Push созлашда хатолик — қурилма бу ердан кўринмаслиги мумкин",
    "uz-latn": "Push sozlashda xatolik — qurilma bu yerdan ko'rinmasligi mumkin",
    en: "Failed to configure push — the device may not be reachable from here",
  },

  selectDevice: { "uz-cyrl": "Қурилмани танланг", "uz-latn": "Qurilmani tanlang", en: "Select device" },
  addEmployeeToDevice: {
    "uz-cyrl": "Аввал юқорида қурилма танланг",
    "uz-latn": "Avval yuqorida qurilma tanlang",
    en: "Select a device above first",
  },
  addEmployee: { "uz-cyrl": "Ходим қўшиш", "uz-latn": "Xodim qo'shish", en: "Add Employee" },
  addNewEmployee: { "uz-cyrl": "Янги ходим қўшиш", "uz-latn": "Yangi xodim qo'shish", en: "Add New Employee" },
  employeeNo: { "uz-cyrl": "Ходим рақами (ID)", "uz-latn": "Xodim raqami (ID)", en: "Employee No" },
  employeeNoHint: {
    "uz-cyrl": "Қурилмада ходимни белгилаш учун ихтиёрий рақам, м: 1001",
    "uz-latn": "Qurilmada xodimni belgilash uchun ixtiyoriy raqam, m: 1001",
    en: "Any number identifying this person on the device, e.g. 1001",
  },
  linkedTeacherOptional: {
    "uz-cyrl": "Боғланган ўқитувчи (ихтиёрий)",
    "uz-latn": "Bog'langan o'qituvchi (ixtiyoriy)",
    en: "Linked teacher (optional)",
  },
  noneOption: { "uz-cyrl": "Йўқ", "uz-latn": "Yo'q", en: "None" },
  noEmployeesYet: { "uz-cyrl": "Ҳали ходимлар йўқ", "uz-latn": "Hali xodimlar yo'q", en: "No employees yet" },
  failedToLoadEmployees: {
    "uz-cyrl": "Ходимларни юклаб бўлмади",
    "uz-latn": "Xodimlarni yuklab bo'lmadi",
    en: "Failed to load employees",
  },
  employeeAdded: {
    "uz-cyrl": "Ходим муваффақиятли қўшилди",
    "uz-latn": "Xodim muvaffaqiyatli qo'shildi",
    en: "Employee added successfully",
  },
  failedToAddEmployee: {
    "uz-cyrl": "Ходимни қўшиб бўлмади",
    "uz-latn": "Xodimni qo'shib bo'lmadi",
    en: "Failed to add employee",
  },

  uploadFace: { "uz-cyrl": "Юз расмини юклаш", "uz-latn": "Yuz rasmini yuklash", en: "Upload Face" },
  uploadFaceDescription: {
    "uz-cyrl": "Аниқ, олдиндан олинган JPEG расм танланг",
    "uz-latn": "Aniq, oldindan olingan JPEG rasm tanlang",
    en: "Choose a clear, front-facing JPEG photo",
  },
  choosePhoto: { "uz-cyrl": "Расм танлаш", "uz-latn": "Rasm tanlash", en: "Choose photo" },
  photoRequired: {
    "uz-cyrl": "Аввал расм танланг",
    "uz-latn": "Avval rasm tanlang",
    en: "Choose a photo first",
  },
  faceUploaded: {
    "uz-cyrl": "Юз расми юкланди",
    "uz-latn": "Yuz rasmi yuklandi",
    en: "Face photo uploaded",
  },
  failedToUploadFace: {
    "uz-cyrl": "Юз расмини юклаб бўлмади",
    "uz-latn": "Yuz rasmini yuklab bo'lmadi",
    en: "Failed to upload face photo",
  },

  removeEmployee: { "uz-cyrl": "Ходимни ўчириш", "uz-latn": "Xodimni o'chirish", en: "Remove Employee" },
  confirmRemoveEmployee: {
    "uz-cyrl": "Бу ходимни қурилма ва рўйхатдан ўчиришни тасдиқлайсизми?",
    "uz-latn": "Bu xodimni qurilma va ro'yxatdan o'chirishni tasdiqlaysizmi?",
    en: "Remove this employee from the device and the list?",
  },
  employeeRemoved: {
    "uz-cyrl": "Ходим ўчирилди",
    "uz-latn": "Xodim o'chirildi",
    en: "Employee removed",
  },
  failedToRemoveEmployee: {
    "uz-cyrl": "Ходимни ўчириб бўлмади",
    "uz-latn": "Xodimni o'chirib bo'lmadi",
    en: "Failed to remove employee",
  },

  checkIn: { "uz-cyrl": "Келди", "uz-latn": "Keldi", en: "Check-in" },
  checkOut: { "uz-cyrl": "Кетди", "uz-latn": "Ketdi", en: "Check-out" },
  eventTime: { "uz-cyrl": "Вақт", "uz-latn": "Vaqt", en: "Time" },
  employeeColumn: { "uz-cyrl": "Ходим", "uz-latn": "Xodim", en: "Employee" },
  eventSource: { "uz-cyrl": "Манба", "uz-latn": "Manba", en: "Source" },
  allDevices: { "uz-cyrl": "Барча қурилмалар", "uz-latn": "Barcha qurilmalar", en: "All devices" },
  allEmployees: { "uz-cyrl": "Барча ходимлар", "uz-latn": "Barcha xodimlar", en: "All employees" },
  dateFrom: { "uz-cyrl": "Санадан", "uz-latn": "Sanadan", en: "From" },
  dateTo: { "uz-cyrl": "Санагача", "uz-latn": "Sanagacha", en: "To" },
  noAttendanceYet: {
    "uz-cyrl": "Бу даврда давомат ёзувлари топилмади",
    "uz-latn": "Bu davrda davomat yozuvlari topilmadi",
    en: "No attendance records for this period",
  },
  failedToLoadAttendance: {
    "uz-cyrl": "Давомат ёзувларини юклаб бўлмади",
    "uz-latn": "Davomat yozuvlarini yuklab bo'lmadi",
    en: "Failed to load attendance records",
  },
};
