import { Translation } from "@/types";

export const authTranslations: Partial<Translation> = {
  login: { "uz-cyrl": "Кириш", "uz-latn": "Kirish", en: "Login" },
  logout: { "uz-cyrl": "Чиқиш", "uz-latn": "Chiqish", en: "Logout" },

  password: { "uz-cyrl": "Парол", "uz-latn": "Parol", en: "Password" },

  invalidCredentials: {
    "uz-cyrl": "Нотўғри маълумотлар",
    "uz-latn": "Noto‘g‘ri ma’lumotlar",
    en: "Invalid credentials"
  },

  demoCredentials: {
    "uz-cyrl": "Демо маълумотлари:",
    "uz-latn": "Demo ma’lumotlari:",
    en: "Demo Credentials:"
  },

  emailLabel: {
    "uz-cyrl": "Электрон почта:",
    "uz-latn": "Elektron pochta:",
    en: "Email:"
  },

  passwordLabel: {
    "uz-cyrl": "Парол:",
    "uz-latn": "Parol:",
    en: "Password:"
  },

  forgotPassword: {
    "uz-cyrl": "Паролни унутдингизми?",
    "uz-latn": "Parolni unutdingizmi?",
    en: "Forgot Password?"
  },

  forgotPasswordTitle: {
    "uz-cyrl": "Паролни қайта ўрнатиш",
    "uz-latn": "Parolni qayta o‘rnatish",
    en: "Reset Password"
  },

  enterEmail: {
    "uz-cyrl": "Электрон почтангизни киритинг",
    "uz-latn": "Elektron pochtangizni kiriting",
    en: "Enter your email"
  },

  sendOTP: {
    "uz-cyrl": "OTP жўнатиш",
    "uz-latn": "OTP jo‘natish",
    en: "Send OTP"
  },

  otpSent: {
    "uz-cyrl": "OTP электрон почтангизга жўнатилди",
    "uz-latn": "OTP elektron pochtangizga jo‘natildi",
    en: "OTP sent to your email"
  },

  enterOTP: {
    "uz-cyrl": "6 рақамли кодни киритинг",
    "uz-latn": "6 raqamli kodni kiriting",
    en: "Enter 6-digit code"
  },

  otp: { "uz-cyrl": "OTP", "uz-latn": "OTP", en: "OTP" },

  verifyOTP: {
    "uz-cyrl": "OTPни тасдиқлаш",
    "uz-latn": "OTPni tasdiqlash",
    en: "Verify OTP"
  },

  otpVerified: {
    "uz-cyrl": "OTP тасдиқланди",
    "uz-latn": "OTP tasdiqlandi",
    en: "OTP Verified"
  },

  newPassword: {
    "uz-cyrl": "Янги парол",
    "uz-latn": "Yangi parol",
    en: "New Password"
  },

  confirmPassword: {
    "uz-cyrl": "Паролни тасдиқлаш",
    "uz-latn": "Parolni tasdiqlash",
    en: "Confirm Password"
  },

  enterNewPassword: {
    "uz-cyrl": "Янги паролни киритинг",
    "uz-latn": "Yangi parolni kiriting",
    en: "Enter new password"
  },

  resetPassword: {
    "uz-cyrl": "Паролни ўзгартириш",
    "uz-latn": "Parolni o‘zgartirish",
    en: "Reset Password"
  },

  passwordReset: {
    "uz-cyrl": "Парол муваффақиятли ўзгартирилди",
    "uz-latn": "Parol muvaffaqiyatli o‘zgartirildi",
    en: "Password reset successfully"
  },

  otpExpired: {
    "uz-cyrl": "OTP муддати тугади. Қайта жўнатинг",
    "uz-latn": "OTP muddati tugadi. Qayta jo‘nating",
    en: "OTP expired. Please resend"
  },

  resendOTP: {
    "uz-cyrl": "OTPни қайта жўнатиш",
    "uz-latn": "OTPni qayta jo‘natish",
    en: "Resend OTP"
  },

  resendIn: {
    "uz-cyrl": "Қайта жўнатиш: {seconds}с",
    "uz-latn": "Qayta jo‘natish: {seconds}s",
    en: "Resend in {seconds}s"
  },

  backToLogin: {
    "uz-cyrl": "Киришга қайтиш",
    "uz-latn": "Kirishga qaytish",
    en: "Back to Login"
  },

  passwordsDoNotMatch: {
    "uz-cyrl": "Пароллар бир хил эмас",
    "uz-latn": "Parollar bir xil emas",
    en: "Passwords do not match"
  },

  invalidEmailOrPassword: {
    "uz-cyrl": "Нотўғри электрон почта ёки парол",
    "uz-latn": "Noto‘g‘ri elektron pochta yoki parol",
    en: "Invalid email or password"
  },

  networkError: {
    "uz-cyrl": "Тармоқ хатоси. Интернет уланишини текширинг",
    "uz-latn": "Tarmoq xatosi. Internet ulanishini tekshiring",
    en: "Network error. Please check your internet connection"
  },

  errorOccurred: {
    "uz-cyrl": "Хатолик юзага келди",
    "uz-latn": "Xatolik yuzaga keldi",
    en: "An error occurred"
  },

  signIn: { "uz-cyrl": "Кириш", "uz-latn": "Kirish", en: "Sign In" },
  signingIn: { "uz-cyrl": "Кирмоқда...", "uz-latn": "Kirmoqda...", en: "Signing In..." },

  verifyIdentity: { "uz-cyrl": "Шахсни тасдиқлаш", "uz-latn": "Shaxsni tasdiqlash", en: "Verify your identity" },
  verificationCodeSentTo: {
    "uz-cyrl": "Тасдиқлаш коди {email} манзилига юборилди",
    "uz-latn": "Tasdiqlash kodi {email} manziliga yuborildi",
    en: "A verification code was sent to {email}",
  },
  verificationCode: { "uz-cyrl": "Тасдиқлаш коди", "uz-latn": "Tasdiqlash kodi", en: "Verification code" },
  verify: { "uz-cyrl": "Тасдиқлаш", "uz-latn": "Tasdiqlash", en: "Verify" },
  verifying: { "uz-cyrl": "Тасдиқланмоқда...", "uz-latn": "Tasdiqlanmoqda...", en: "Verifying..." },

  adminLoginSubtitle: {
    "uz-cyrl": "Мактабингизни бошқариш учун киринг",
    "uz-latn": "Maktabingizni boshqarish uchun kiring",
    en: "Sign in to manage your school",
  },
  teacherLoginSubtitle: {
    "uz-cyrl": "Ўқитувчи порталига кириш учун тизимга кириш",
    "uz-latn": "O'qituvchi portaliga kirish uchun tizimga kiring",
    en: "Sign in to access your teacher portal",
  },

  accessDashboard: {
    "uz-cyrl": "Панелга кириш",
    "uz-latn": "Panelga kirish",
    en: "Access Dashboard"
  },

  enterPassword: {
    "uz-cyrl": "Паролни киритинг",
    "uz-latn": "Parolni kiriting",
    en: "Enter password"
  },
  
  // Profile updates
  updateFailed: {
    "uz-cyrl": "Янгилаш муваффақиятсиз бўлди",
    "uz-latn": "Yangilash muvaffaqiyatsiz bo'ldi",
    en: "Update failed",
  },
  profileUpdated: {
    "uz-cyrl": "Профил янгиланди",
    "uz-latn": "Profil yangilandi",
    en: "Profile updated",
  },
  profileUpdatedDescription: {
    "uz-cyrl": "Профилингиз муваффақиятли янгиланди",
    "uz-latn": "Profilingiz muvaffaqiyatli yangilandi",
    en: "Your profile has been updated successfully",
  },
  passwordUpdated: {
    "uz-cyrl": "Парол янгиланди",
    "uz-latn": "Parol yangilandi",
    en: "Password updated",
  },
  passwordUpdatedDescription: {
    "uz-cyrl": "Паролингиз муваффақиятли ўзгартирилди",
    "uz-latn": "Parolingiz muvaffaqiyatli o'zgartirildi",
    en: "Your password has been changed successfully",
  },
  save: {
    "uz-cyrl": "Сақлаш",
    "uz-latn": "Saqlash",
    en: "Save",
  },
  updatePassword: {
    "uz-cyrl": "Паролни янгилаш",
    "uz-latn": "Parolni yangilash",
    en: "Update Password",
  },
  changePassword: {
    "uz-cyrl": "Паролни ўзгартириш",
    "uz-latn": "Parolni o'zgartirish",
    en: "Change Password",
  },
  
  // Validation
  fullNameRequired: {
    "uz-cyrl": "Тўлиқ ism киритилиши керак",
    "uz-latn": "To'liq ism kiritilishi kerak",
    en: "Full name is required",
  },
  emailRequired: {
    "uz-cyrl": "Электрон почта киритилиши керак",
    "uz-latn": "Elektron pochta kiritilishi kerak",
    en: "Email is required",
  },
  invalidEmail: {
    "uz-cyrl": "Нотўғри электрон почта формати",
    "uz-latn": "Noto'g'ri elektron pochta formati",
    en: "Invalid email format",
  },
  currentPasswordRequired: {
    "uz-cyrl": "Жорий парол киритилиши керак",
    "uz-latn": "Joriy parol kiritilishi kerak",
    en: "Current password is required",
  },
  newPasswordRequired: {
    "uz-cyrl": "Янги парол киритилиши керак",
    "uz-latn": "Yangi parol kiritilishi kerak",
    en: "New password is required",
  },
  passwordTooShort: {
    "uz-cyrl": "Парол камида 6 та белгидан иборат бўлиши керак",
    "uz-latn": "Parol kamida 6 ta belgidan iborat bo'lishi kerak",
    en: "Password must be at least 6 characters",
  },
  confirmPasswordRequired: {
    "uz-cyrl": "Паролни тасдиқлаш талаб қилинади",
    "uz-latn": "Parolni tasdiqlash talab qilinadi",
    en: "Confirm password is required",
  },
  passwordMismatch: {
    "uz-cyrl": "Пароллар мос келмайди",
    "uz-latn": "Parollar mos kelmaydi",
    en: "Passwords do not match",
  },
  passwordRequired: {
    "uz-cyrl": "Парол киритилиши шарт",
    "uz-latn": "Parol kiritilishi shart",
    en: "Password is required",
  },

  // Registration page — was entirely hardcoded English (plus two t() calls
  // referencing keys that didn't exist anywhere in this file), and the login
  // page had no link to it at all, so a brand-new school had no discoverable
  // way to create an account.
  noAccountYet: {
    "uz-cyrl": "Ҳисобингиз йўқми?",
    "uz-latn": "Hisobingiz yo'qmi?",
    en: "Don't have an account?",
  },
  registerSchool: {
    "uz-cyrl": "Мактабингизни рўйхатдан ўтказинг",
    "uz-latn": "Maktabingizni ro'yxatdan o'tkazing",
    en: "Register your school",
  },
  createAccountSubtitle: {
    "uz-cyrl": "School CRM билан ишлашни бошлаш учун рўйхатдан ўтинг",
    "uz-latn": "School CRM bilan ishlashni boshlash uchun ro'yxatdan o'ting",
    en: "Sign up to get started with School CRM",
  },
  alreadyHaveAccount: {
    "uz-cyrl": "Ҳисобингиз борми?",
    "uz-latn": "Hisobingiz bormi?",
    en: "Already have an account?",
  },
  welcomeToSchool: {
    // {schoolName} is substituted at the call site with the school's actual
    // name — see the .replace("{schoolName}", …) pattern already used for
    // verificationCodeSentTo above.
    "uz-cyrl": "{schoolName}га хуш келибсиз!",
    "uz-latn": "{schoolName}ga xush kelibsiz!",
    en: "Welcome to {schoolName}!",
  },
  trialStartedMessage: {
    // {days} is substituted with the actual trial length granted by the
    // backend (AdminGrantTrial) — hardcoding "14-day" here previously
    // disagreed with the 30 days the backend actually grants on register.
    "uz-cyrl": "Мактабингиз созланди ва {days} кунлик бепул синов муддатингиз бошланди. Панелга йўналтирилмоқдасиз…",
    "uz-latn": "Maktabingiz sozlandi va {days} kunlik bepul sinov muddatingiz boshlandi. Panelga yo'naltirilmoqdasiz…",
    en: "Your school has been set up and your {days}-day free trial has started. Redirecting you to the dashboard…",
  },
};
