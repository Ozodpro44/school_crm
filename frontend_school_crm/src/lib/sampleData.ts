import { studentsDB, teachersDB, classesDB, paymentsDB, salariesDB, branchesDB } from "./storage";

export function initializeSampleData() {
  const hasData = localStorage.getItem("school_sample_data_initialized");
  
  if (hasData) return;

  // Settings are now fetched from backend, not from local storage

  // Create sample branches
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentYear = now.getFullYear();

  const branch1 = branchesDB.create({
    name: "Марказий филиал",
    address: "Тошкент ш., Чилонзор т., 12-кв, 34-уй",
    phone: "+998 90 123 45 67",
    monthlyPayment: 500000,
    managerIds: [],
  });

  const branch2 = branchesDB.create({
    name: "Яшнобод филиали",
    address: "Тошкент ш., Яшнобод т., 5-кв, 12-уй",
    phone: "+998 90 234 56 78",
    monthlyPayment: 450000,
    managerIds: [],
  });

  // Create sample teachers with branch assignment
  const teacher1 = teachersDB.create({
    fullName: "Алишер Навоий",
    subjects: ["Математика", "Физика"],
    monthlySalary: 3500000,
    phone: "+998 90 111 22 33",
    email: "alisher.navoiy@school.com",
    assignedClasses: [],
    branchId: branch1.id,
    joinedDate: new Date().toISOString(),
  });

  const teacher2 = teachersDB.create({
    fullName: "Фарида Расулова",
    subjects: ["Инглиз тили", "Адабиёт"],
    monthlySalary: 3200000,
    phone: "+998 90 222 33 44",
    email: "farida.rasulova@school.com",
    assignedClasses: [],
    branchId: branch1.id,
    joinedDate: new Date().toISOString(),
  });

  const teacher3 = teachersDB.create({
    fullName: "Жамшид Каримов",
    subjects: ["Кимё", "Биология"],
    monthlySalary: 3400000,
    phone: "+998 90 333 44 55",
    email: "jamshid.karimov@school.com",
    assignedClasses: [],
    branchId: branch2.id,
    joinedDate: new Date().toISOString(),
  });

  const teachers = [teacher1, teacher2, teacher3];

  // Create sample classes with branch assignment
  const class1 = classesDB.create({
    name: "7-А синф",
    teacherId: teachers[0]?.id,
    studentIds: [],
    branchId: branch1.id,
  });

  const class2 = classesDB.create({
    name: "8-Б синф",
    teacherId: teachers[1]?.id,
    studentIds: [],
    branchId: branch1.id,
  });

  const class3 = classesDB.create({
    name: "9-В синф",
    teacherId: teachers[2]?.id,
    studentIds: [],
    branchId: branch2.id,
  });

  const createdClasses = [class1, class2, class3];

  // Create sample students with branch assignment
  const students = [
    {
      fullName: "Азиза Усманова",
      classId: createdClasses[0].id,
      phone: "+998 90 444 55 66",
      parentPhone: "+998 90 444 55 77",
      monthlyPayment: 500000,
      status: "active" as const,
      branchId: branch1.id,
      enrollmentDate: new Date().toISOString(),
    },
    {
      fullName: "Бахтиёр Раҳимов",
      classId: createdClasses[0].id,
      phone: "+998 90 555 66 77",
      parentPhone: "+998 90 555 66 88",
      monthlyPayment: 500000,
      status: "active" as const,
      branchId: branch1.id,
      enrollmentDate: new Date().toISOString(),
    },
    {
      fullName: "Гулнора Ахмедова",
      classId: createdClasses[1].id,
      phone: "+998 90 666 77 88",
      parentPhone: "+998 90 666 77 99",
      monthlyPayment: 550000,
      status: "active" as const,
      branchId: branch1.id,
      enrollmentDate: new Date().toISOString(),
    },
    {
      fullName: "Давлат Туракулов",
      classId: createdClasses[1].id,
      phone: "+998 90 777 88 99",
      parentPhone: "+998 90 777 88 00",
      monthlyPayment: 550000,
      status: "active" as const,
      branchId: branch1.id,
      enrollmentDate: new Date().toISOString(),
    },
    {
      fullName: "Елизавета Иванова",
      classId: createdClasses[2].id,
      phone: "+998 90 888 99 00",
      parentPhone: "+998 90 888 99 11",
      monthlyPayment: 450000,
      status: "active" as const,
      branchId: branch2.id,
      enrollmentDate: new Date().toISOString(),
    },
    {
      fullName: "Жасур Садиков",
      classId: createdClasses[2].id,
      phone: "+998 90 999 00 11",
      parentPhone: "+998 90 999 00 22",
      monthlyPayment: 450000,
      status: "suspended" as const,
      branchId: branch2.id,
      enrollmentDate: new Date().toISOString(),
    },
  ];

  const createdStudents = students.map((student) =>
    studentsDB.create(student)
  );

  // Update class student IDs
  createdClasses.forEach((classItem) => {
    const classStudents = createdStudents
      .filter((s) => s.classId === classItem.id)
      .map((s) => s.id);
    classesDB.update(classItem.id, { studentIds: classStudents });
  });

  // Create sample payments
  const months = ["January", "February", "March", "April", "May"];
  const year = 2025;

  createdStudents.forEach((student) => {
    months.forEach((month, index) => {
      if (student.status === "active") {
        paymentsDB.create({
          studentId: student.id,
          amount: student.monthlyPayment,
          month,
          year,
          paymentMethod: index % 3 === 0 ? "card" : index % 3 === 1 ? "cash" : "bank",
          branchId: student.branchId,
          status: "paid",
          invoiceNumber: `INV-${Date.now()}-${student.id.substring(0,4)}`,
          paidDate: new Date().toISOString(),
        });
      }
    });
  });

  // Create sample salaries
  teachers.forEach((teacher) => {
    months.forEach((month, index) => {
      salariesDB.create({
        teacherId: teacher.id,
        amount: teacher.monthlySalary,
        month,
        year,
        paymentMethod: index % 3 === 0 ? "bank" : index % 3 === 1 ? "card" : "cash",
        branchId: teacher.branchId,
        status: "paid",
        paidDate: new Date().toISOString(),
      });
    });
  });

  localStorage.setItem("school_sample_data_initialized", "true");
}