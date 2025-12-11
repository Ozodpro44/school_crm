import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  Wallet,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";

export default function HelpPage() {
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  return (
    
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {t("help") || "Help"} & {t("documentation") || "Documentation"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            {t("helpDescription") ||
              "Complete guide to using the School Management System"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("gettingStarted") || "Getting Started"}</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p>
              {t("gettingStartedText") ||
                "Welcome to the Private School Management System! This comprehensive platform helps you manage all aspects of your school operations including students, teachers, classes, payments, and finances."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("featureGuide") || "Feature Guide"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="students">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-indigo-600" />
                    {t("studentManagement") || "Student Management"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("addingStudents") || "Adding Students"}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("addingStudentsDesc") ||
                        'Click the "Add Student" button and fill in the required information including full name, class assignment, contact details, and monthly payment amount.'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("managingStudentStatus") || "Managing Student Status"}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("studentStatusHelp") ||
                        "Students can have three statuses:"}
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                      <li>
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800"
                        >
                          {t("active") || "Active"}
                        </Badge>{" "}
                        - {t("activeStudentDesc") || "Currently enrolled"}
                      </li>
                      <li>
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 text-gray-800"
                        >
                          {t("left") || "Left"}
                        </Badge>{" "}
                        - {t("leftStudentDesc") || "No longer enrolled"}
                      </li>
                      <li>
                        <Badge
                          variant="secondary"
                          className="bg-red-100 text-red-800"
                        >
                          {t("suspended") || "Suspended"}
                        </Badge>{" "}
                        - {t("suspendedDesc") || "Temporarily suspended"}
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("markingStudentsAsLeft") || "Marking Students as Left"}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("markingStudentsAsLeftDesc") ||
                        'Use the "Mark as Left" button to automatically stop payment tracking for students who have left the school.'}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="teachers">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-5 h-5 text-purple-600" />
                    {t("teacherManagement") || "Teacher Management"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("addingTeachers") || "Adding Teachers"}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("addingTeachersDesc") ||
                        "Record teacher information including name, subjects, contact details, and monthly salary. You can assign multiple subjects to each teacher."}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("assigningClasses") || "Assigning Classes"}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("assigningClassesDesc") ||
                        "Teachers are assigned to classes through the Class Management section. Each class can have one class teacher."}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="classes">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    {t("classManagement") || "Class Management"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("creatingClasses") || "Creating Classes"}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("creatingClassesDesc") ||
                        "Create class sections (e.g., 7A, 8B, 9C) and assign a class teacher to each. The system automatically tracks student enrollment per class."}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("switchingStudents") ||
                        "Switching Students Between Classes"}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("switchingStudentsDesc") ||
                        "You can move students from one class to another. Select the students, choose the target class, and use the Switch button to transfer them."}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="payments">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    {t("paymentTracking") || "Payment Tracking"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("recordingPayments") || "Recording Payments"}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("recordingPaymentsDesc") ||
                        "Track student fee payments by selecting the student, entering the amount, and marking the payment status. The system automatically generates invoice numbers."}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("paymentStatus") || "Payment Status"}
                    </h4>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                      <li>
                        <Badge className="bg-green-100 text-green-800">
                          {t("paid") || "Paid"}
                        </Badge>{" "}
                        - {t("paidDesc") || "Payment received"}
                      </li>
                      <li>
                        <Badge className="bg-red-100 text-red-800">
                          {t("unpaid") || "Unpaid"}
                        </Badge>{" "}
                        - {t("unpaidDesc") || "Payment pending"}
                      </li>
                      <li>
                        <Badge className="bg-orange-100 text-orange-800">
                          {t("partial") || "Partial"}
                        </Badge>{" "}
                        - {t("partialDesc") || "Partially paid"}
                      </li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="salaries">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-cyan-600" />
                    {t("salaryManagement") || "Salary Management"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("recordingSalaries") || "Recording Salaries"}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("recordingSalariesDesc") ||
                        "Track teacher salary payments monthly. The system auto-fills the amount based on the teacher's monthly salary but allows manual adjustments if needed."}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="reports">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-orange-600" />
                    {t("reportsExport") || "Reports & Export"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("generatingReports") || "Generating Reports"}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("generatingReportsDesc") ||
                        "Generate monthly or yearly financial reports showing income, expenses, and profit. Select the reporting period and export to PDF or CSV format."}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("exportOptions") || "Export Options"}
                    </h4>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                      <li>
                        <strong>PDF:</strong>{" "}
                        {t("pdfDesc") ||
                          "Professional formatted reports for printing"}
                      </li>
                      <li>
                        <strong>CSV:</strong>{" "}
                        {t("csvDesc") ||
                          "Spreadsheet data for further analysis in Excel"}
                      </li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("tipsAndBestPractices") || "Tips & Best Practices"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <HelpCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">
                    {t("regularDataBackups") || "Regular Data Backups"}
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    {t("regularDataBackupsDesc") ||
                      "Export your data regularly to CSV format as a backup. This system uses browser storage, so clearing browser data will remove all records."}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <HelpCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">
                    {t("useSearchFeatures") || "Use Search Features"}
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    {t("useSearchFeaturesDesc") ||
                      "Every page has search functionality. Use it to quickly find students, teachers, or records."}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <HelpCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">
                    {t("monitorDashboard") || "Monitor the Dashboard"}
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    {t("monitorDashboardDesc") ||
                      "Check the dashboard daily for quick insights into pending payments, unpaid salaries, and overall financial health."}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
          <CardHeader>
            <CardTitle>{t("needMoreHelp") || "Need More Help?"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {t("needMoreHelpDesc") ||
                "If you need additional assistance or have questions about specific features:"}
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                {t("checkReadme") ||
                  "Check the README.md file for technical documentation"}
              </li>
              <li>
                {t("reviewSampleData") ||
                  "Review the sample data to see how the system works"}
              </li>
              <li>
                {t("contactAdmin") ||
                  "Contact your system administrator for school-specific setup"}
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    
  );
}
