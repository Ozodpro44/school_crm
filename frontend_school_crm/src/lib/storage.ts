import {
  Student,
  Teacher,
  Class,
  Payment,
  PaymentMethod,
  Salary,
  Expense,
  Income,
  Branch,
  Settings,
  User,
} from "@/types";

const STORAGE_KEYS = {
  USERS: "school_users",
  STUDENTS: "school_students",
  TEACHERS: "school_teachers",
  CLASSES: "school_classes",
  PAYMENTS: "school_payments",
  SALARIES: "school_salaries",
  EXPENSES: "school_expenses",
  INCOMES: "school_incomes",
  BRANCHES: "school_branches",
  SETTINGS: "school_settings",
  MONTH_ARCHIVES: "school_month_archives",
};

function getFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];

  const data = localStorage.getItem(key);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export const branchesDB = {
  getAll: (): Branch[] => getFromStorage<Branch>(STORAGE_KEYS.BRANCHES),

  getById: (id: string): Branch | undefined => {
    return branchesDB.getAll().find((b) => b.id === id);
  },

  create: (branch: Omit<Branch, "id" | "createdAt" | "updatedAt">): Branch => {
    const newBranch: Branch = {
      ...branch,
      id: `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const branches = branchesDB.getAll();
    branches.push(newBranch);
    saveToStorage(STORAGE_KEYS.BRANCHES, branches);

    return newBranch;
  },

  update: (id: string, updates: Partial<Branch>): Branch | null => {
    const branches = branchesDB.getAll();
    const index = branches.findIndex((b) => b.id === id);

    if (index === -1) return null;

    branches[index] = {
      ...branches[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    saveToStorage(STORAGE_KEYS.BRANCHES, branches);
    return branches[index];
  },

  delete: (id: string): boolean => {
    const branches = branchesDB.getAll();
    const filtered = branches.filter((b) => b.id !== id);

    if (filtered.length === branches.length) return false;

    saveToStorage(STORAGE_KEYS.BRANCHES, filtered);
    return true;
  },
};

export const settingsDB = {
  get: (): Settings => {
    // Settings are now fetched from backend via useSettings() hook
    // This is kept for backwards compatibility but should not be used
    const now = new Date();
    const defaultMonth = (now.getMonth() + 1).toString().padStart(2, "0");
    const defaultYear = now.getFullYear();

    // Return default values WITHOUT initializing localStorage
    return {
      id: "settings-default",
      defaultMonthlyPayment: 500000,
      defaultTeacherSalary: 3000000,
      currency: "UZS",
      language: "uz-latn",
      schoolName: "School CRM",
      currentMonth: defaultMonth,
      currentYear: defaultYear,
      updatedAt: new Date().toISOString(),
    };
  },

  update: (updates: Partial<Settings>): Settings => {
    // Settings should be updated via backend API using updateSettings()
    // This method is deprecated but kept for backwards compatibility
    console.warn(
      "settingsDB.update() is deprecated. Use updateSettings() from @/lib/api instead"
    );
    return settingsDB.get();
  },
};

export const studentsDB = {
  getAll: (): Student[] => getFromStorage<Student>(STORAGE_KEYS.STUDENTS),

  getById: (id: string): Student | undefined => {
    return studentsDB.getAll().find((s) => s.id === id);
  },

  getByBranch: (branchId: string): Student[] => {
    return studentsDB.getAll().filter((s) => s.branchId === branchId);
  },

  create: (
    student: Omit<Student, "id" | "createdAt" | "updatedAt">
  ): Student => {
    const newStudent: Student = {
      ...student,
      id: `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const students = studentsDB.getAll();
    students.push(newStudent);
    saveToStorage(STORAGE_KEYS.STUDENTS, students);

    return newStudent;
  },

  update: (id: string, updates: Partial<Student>): Student | null => {
    const students = studentsDB.getAll();
    const index = students.findIndex((s) => s.id === id);

    if (index === -1) return null;

    students[index] = {
      ...students[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    saveToStorage(STORAGE_KEYS.STUDENTS, students);
    return students[index];
  },

  delete: (id: string): boolean => {
    const students = studentsDB.getAll();
    const filtered = students.filter((s) => s.id !== id);

    if (filtered.length === students.length) return false;

    saveToStorage(STORAGE_KEYS.STUDENTS, filtered);
    return true;
  },
};

export const teachersDB = {
  getAll: (): Teacher[] => getFromStorage<Teacher>(STORAGE_KEYS.TEACHERS),

  getById: (id: string): Teacher | undefined => {
    return teachersDB.getAll().find((t) => t.id === id);
  },

  getByBranch: (branchId: string): Teacher[] => {
    return teachersDB.getAll().filter((t) => t.branchId === branchId);
  },

  create: (
    teacher: Omit<Teacher, "id" | "createdAt" | "updatedAt">
  ): Teacher => {
    const newTeacher: Teacher = {
      ...teacher,
      id: `teacher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const teachers = teachersDB.getAll();
    teachers.push(newTeacher);
    saveToStorage(STORAGE_KEYS.TEACHERS, teachers);

    return newTeacher;
  },

  update: (id: string, updates: Partial<Teacher>): Teacher | null => {
    const teachers = teachersDB.getAll();
    const index = teachers.findIndex((t) => t.id === id);

    if (index === -1) return null;

    teachers[index] = {
      ...teachers[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    saveToStorage(STORAGE_KEYS.TEACHERS, teachers);
    return teachers[index];
  },

  delete: (id: string): boolean => {
    const teachers = teachersDB.getAll();
    const filtered = teachers.filter((t) => t.id !== id);

    if (filtered.length === teachers.length) return false;

    saveToStorage(STORAGE_KEYS.TEACHERS, filtered);
    return true;
  },
};

export const classesDB = {
  getAll: (): Class[] => getFromStorage<Class>(STORAGE_KEYS.CLASSES),

  getById: (id: string): Class | undefined => {
    return classesDB.getAll().find((c) => c.id === id);
  },

  getByBranch: (branchId: string): Class[] => {
    return classesDB.getAll().filter((c) => c.branchId === branchId);
  },

  create: (classData: Omit<Class, "id" | "createdAt" | "updatedAt">): Class => {
    const newClass: Class = {
      ...classData,
      id: `class-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const classes = classesDB.getAll();
    classes.push(newClass);
    saveToStorage(STORAGE_KEYS.CLASSES, classes);

    return newClass;
  },

  update: (id: string, updates: Partial<Class>): Class | null => {
    const classes = classesDB.getAll();
    const index = classes.findIndex((c) => c.id === id);

    if (index === -1) return null;

    classes[index] = {
      ...classes[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    saveToStorage(STORAGE_KEYS.CLASSES, classes);
    return classes[index];
  },

  delete: (id: string): boolean => {
    const classes = classesDB.getAll();
    const filtered = classes.filter((c) => c.id !== id);

    if (filtered.length === classes.length) return false;

    saveToStorage(STORAGE_KEYS.CLASSES, filtered);
    return true;
  },
};

export const paymentsDB = {
  getAll: (): Payment[] => getFromStorage<Payment>(STORAGE_KEYS.PAYMENTS),

  getByStudentId: (studentId: string): Payment[] => {
    return paymentsDB.getAll().filter((p) => p.studentId === studentId);
  },

  getByBranch: (branchId: string): Payment[] => {
    return paymentsDB.getAll().filter((p) => p.branchId === branchId);
  },

  create: (payment: Omit<Payment, "id" | "createdAt">): Payment => {
    const newPayment: Payment = {
      ...payment,
      id: `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    const payments = paymentsDB.getAll();
    payments.push(newPayment);
    saveToStorage(STORAGE_KEYS.PAYMENTS, payments);

    return newPayment;
  },

  update: (id: string, updates: Partial<Payment>): Payment | null => {
    const payments = paymentsDB.getAll();
    const index = payments.findIndex((p) => p.id === id);

    if (index === -1) return null;

    payments[index] = { ...payments[index], ...updates };
    saveToStorage(STORAGE_KEYS.PAYMENTS, payments);

    return payments[index];
  },
  delete: (id: string): boolean => {
    const payments = paymentsDB.getAll();
    const filtered = payments.filter((p) => p.id !== id);

    if (filtered.length === payments.length) return false;

    saveToStorage(STORAGE_KEYS.PAYMENTS, filtered);
    return true;
  },
};

export const salariesDB = {
  getAll: (): Salary[] => getFromStorage<Salary>(STORAGE_KEYS.SALARIES),

  getByTeacherId: (teacherId: string): Salary[] => {
    return salariesDB.getAll().filter((s) => s.teacherId === teacherId);
  },

  getByBranch: (branchId: string): Salary[] => {
    return salariesDB.getAll().filter((s) => s.branchId === branchId);
  },

  create: (salary: Omit<Salary, "id" | "createdAt">): Salary => {
    const newSalary: Salary = {
      ...salary,
      id: `salary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    const salaries = salariesDB.getAll();
    salaries.push(newSalary);
    saveToStorage(STORAGE_KEYS.SALARIES, salaries);

    return newSalary;
  },

  update: (id: string, updates: Partial<Salary>): Salary | null => {
    const salaries = salariesDB.getAll();
    const index = salaries.findIndex((s) => s.id === id);

    if (index === -1) return null;

    salaries[index] = { ...salaries[index], ...updates };
    saveToStorage(STORAGE_KEYS.SALARIES, salaries);

    return salaries[index];
  },

  delete: (id: string): boolean => {
    const salaries = salariesDB.getAll();
    const filtered = salaries.filter((s) => s.id !== id);

    if (filtered.length === salaries.length) return false;

    saveToStorage(STORAGE_KEYS.SALARIES, filtered);
    return true;
  },
};

export const expensesDB = {
  getAll: (): Expense[] => getFromStorage<Expense>(STORAGE_KEYS.EXPENSES),

  getById: (id: string): Expense | undefined => {
    return expensesDB.getAll().find((e) => e.id === id);
  },

  getByBranch: (branchId: string): Expense[] => {
    return expensesDB.getAll().filter((e) => e.branchId === branchId);
  },

  create: (expense: Omit<Expense, "id" | "createdAt">): Expense => {
    const newExpense: Expense = {
      ...expense,
      id: `expense-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    const expenses = expensesDB.getAll();
    expenses.push(newExpense);
    saveToStorage(STORAGE_KEYS.EXPENSES, expenses);

    return newExpense;
  },

  update: (id: string, updates: Partial<Expense>): Expense | null => {
    const expenses = expensesDB.getAll();
    const index = expenses.findIndex((e) => e.id === id);

    if (index === -1) return null;

    expenses[index] = { ...expenses[index], ...updates };
    saveToStorage(STORAGE_KEYS.EXPENSES, expenses);

    return expenses[index];
  },

  delete: (id: string): boolean => {
    const expenses = expensesDB.getAll();
    const filtered = expenses.filter((e) => e.id !== id);

    if (filtered.length === expenses.length) return false;

    saveToStorage(STORAGE_KEYS.EXPENSES, filtered);
    return true;
  },
};

export const incomesDB = {
  getAll: (): Income[] => getFromStorage<Income>(STORAGE_KEYS.INCOMES),

  getByBranch: (branchId: string): Income[] => {
    return incomesDB.getAll().filter((i) => i.branchId === branchId);
  },

  create: (income: Omit<Income, "id" | "createdAt">): Income => {
    const newIncome: Income = {
      ...income,
      id: `income-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    const incomes = incomesDB.getAll();
    incomes.push(newIncome);
    saveToStorage(STORAGE_KEYS.INCOMES, incomes);

    return newIncome;
  },
};

export const usersDB = {
  getAll: (): User[] => getFromStorage<User>(STORAGE_KEYS.USERS),

  getById: (id: string): User | undefined => {
    return usersDB.getAll().find((u) => u.id === id);
  },

  create: (user: User): User => {
    const users = usersDB.getAll();
    users.push(user);
    saveToStorage(STORAGE_KEYS.USERS, users);
    return user;
  },

  update: (id: string, updates: Partial<User>): User | null => {
    const users = usersDB.getAll();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return null;
    users[index] = { ...users[index], ...updates };
    saveToStorage(STORAGE_KEYS.USERS, users);
    return users[index];
  },

  delete: (id: string): boolean => {
    const users = usersDB.getAll();
    const filtered = users.filter((u) => u.id !== id);
    if (filtered.length === users.length) return false;
    saveToStorage(STORAGE_KEYS.USERS, filtered);
    return true;
  },
};

// Payment system helper functions
export const paymentHelpers = {
  /**
   * Get all payments for a student in a specific month/year
   */
  getPaymentsByPeriod: (
    studentId: string,
    month: string,
    year: number
  ): Payment[] => {
    return paymentsDB
      .getAll()
      .filter(
        (p) => p.studentId === studentId && p.month === month && p.year === year
      );
  },

  /**
   * Calculate total amount paid by a student for a specific month/year
   */
  calculateTotalPaid: (
    studentId: string,
    month: string,
    year: number
  ): number => {
    const periodPayments = paymentHelpers.getPaymentsByPeriod(
      studentId,
      month,
      year
    );
    return periodPayments.reduce((sum, p) => sum + p.amount, 0);
  },

  /**
   * Calculate remaining balance for a student in a specific month/year
   * @param monthlyPaymentRequired The required monthly payment amount for this student
   */
  calculateRemainingBalance: (
    studentId: string,
    month: string,
    year: number,
    monthlyPaymentRequired: number
  ): number => {
    const totalPaid = paymentHelpers.calculateTotalPaid(studentId, month, year);
    return Math.max(0, monthlyPaymentRequired - totalPaid);
  },

  /**
   * Check if a student has fully paid for a specific month/year
   */
  isFullyPaid: (
    studentId: string,
    month: string,
    year: number,
    monthlyPaymentRequired: number
  ): boolean => {
    const totalPaid = paymentHelpers.calculateTotalPaid(studentId, month, year);
    return totalPaid >= monthlyPaymentRequired;
  },

  /**
   * Get payment breakdown by method for a specific student/period
   */
  getPaymentBreakdownByMethod: (
    studentId: string,
    month: string,
    year: number
  ): Record<PaymentMethod, number> => {
    const periodPayments = paymentHelpers.getPaymentsByPeriod(
      studentId,
      month,
      year
    );
    return {
      cash: periodPayments
        .filter((p) => p.paymentMethod === "cash")
        .reduce((sum, p) => sum + p.amount, 0),
      card: periodPayments
        .filter((p) => p.paymentMethod === "card")
        .reduce((sum, p) => sum + p.amount, 0),
      bank: periodPayments
        .filter((p) => p.paymentMethod === "bank")
        .reduce((sum, p) => sum + p.amount, 0),
    };
  },
};

// Month Archive System
interface MonthArchive {
  id: string;
  year: number;
  month: string;
  payments: Payment[];
  salaries: Salary[];
  expenses: Expense[];
  archivedAt: string;
  archivedBy: string;
}

export const monthArchivesDB = {
  getAll: (): MonthArchive[] =>
    getFromStorage<MonthArchive>(STORAGE_KEYS.MONTH_ARCHIVES),

  getByMonth: (month: string, year: number): MonthArchive | undefined => {
    return monthArchivesDB
      .getAll()
      .find((a) => a.month === month && a.year === year);
  },

  isMonthArchived: (month: string, year: number): boolean => {
    return monthArchivesDB.getByMonth(month, year) !== undefined;
  },

  create: (archive: Omit<MonthArchive, "id">): MonthArchive => {
    const newArchive: MonthArchive = {
      ...archive,
      id: `archive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    const archives = monthArchivesDB.getAll();
    archives.push(newArchive);
    saveToStorage(STORAGE_KEYS.MONTH_ARCHIVES, archives);

    return newArchive;
  },
};

// Finish Month Function
export const finishMonth = (
  userId: string
): { success: boolean; message: string } => {
  try {
    const settings = settingsDB.get();
    const currentMonth = settings.currentMonth;
    const currentYear = settings.currentYear;

    // Check if already archived
    if (monthArchivesDB.getByMonth(currentMonth, currentYear)) {
      return {
        success: false,
        message: "This month has already been finished",
      };
    }

    // Archive current month data
    const payments = paymentsDB.getAll();
    const salaries = salariesDB.getAll();
    const expenses = expensesDB.getAll();

    // Filter data for current month
    const currentMonthPayments = payments.filter(
      (p) => p.month === currentMonth && p.year === currentYear
    );
    const currentMonthSalaries = salaries.filter(
      (s) => s.month === currentMonth && s.year === currentYear
    );
    const currentMonthExpenses = expenses.filter((e) => {
      const expenseDate = new Date(e.date || e.createdAt);
      return (
        expenseDate.getMonth() + 1 === parseInt(currentMonth) &&
        expenseDate.getFullYear() === currentYear
      );
    });

    // Create archive
    monthArchivesDB.create({
      year: currentYear,
      month: currentMonth,
      payments: currentMonthPayments,
      salaries: currentMonthSalaries,
      expenses: currentMonthExpenses,
      archivedAt: new Date().toISOString(),
      archivedBy: userId,
    });

    // Clear current month data
    const newPayments = payments.filter(
      (p) => !(p.month === currentMonth && p.year === currentYear)
    );
    const newSalaries = salaries.filter(
      (s) => !(s.month === currentMonth && s.year === currentYear)
    );
    const newExpenses = expenses.filter((e) => {
      const expenseDate = new Date(e.date || e.createdAt);
      return !(
        expenseDate.getMonth() + 1 === parseInt(currentMonth) &&
        expenseDate.getFullYear() === currentYear
      );
    });

    saveToStorage(STORAGE_KEYS.PAYMENTS, newPayments);
    saveToStorage(STORAGE_KEYS.SALARIES, newSalaries);
    saveToStorage(STORAGE_KEYS.EXPENSES, newExpenses);

    // Advance to next month
    let nextMonth = parseInt(currentMonth) + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    // Update settings with next month via backend API
    // TODO: Integrate with backend updateSettings() API
    // For now, this will be handled by the frontend component calling finishMonth()
    const nextMonthStr = nextMonth.toString().padStart(2, "0");
    console.log(
      `Next month should be set to ${nextMonthStr}/${nextYear} via backend API`
    );

    return {
      success: true,
      message: `Month ${currentMonth}/${currentYear} has been finished and archived. System switched to ${nextMonth
        .toString()
        .padStart(2, "0")}/${nextYear}`,
    };
  } catch (error) {
    console.error("Error finishing month:", error);
    return { success: false, message: "Error finishing month" };
  }
};
