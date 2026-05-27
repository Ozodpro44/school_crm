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
          <h1 className="text-4xl font-bold text-brand-gradient">
            {t("help")} & {t("documentation")}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            {t("helpDescription")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("gettingStarted")}</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p>
              {t("gettingStartedText")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("featureGuide")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="students">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-indigo-600" />
                    {t("studentManagement")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("addingStudents")}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("addingStudentsDesc") ||
                        'Click the "Add Student" button and fill in the required information including full name, class assignment, contact details, and monthly payment amount.'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("managingStudentStatus")}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("studentStatusHelp")}
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                      <li>
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800"
                        >
                          {t("active")}
                        </Badge>{" "}
                        - {t("activeStudentDesc")}
                      </li>
                      <li>
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 text-gray-800"
                        >
                          {t("left")}
                        </Badge>{" "}
                        - {t("leftStudentDesc")}
                      </li>
                      <li>
                        <Badge
                          variant="secondary"
                          className="bg-red-100 text-red-800"
                        >
                          {t("suspended")}
                        </Badge>{" "}
                        - {t("suspendedDesc")}
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("markingStudentsAsLeft")}
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
                    {t("teacherManagement")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("addingTeachers")}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("addingTeachersDesc")}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("assigningClasses")}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("assigningClassesDesc")}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="classes">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    {t("classManagement")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("creatingClasses")}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("creatingClassesDesc")}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("switchingStudents")}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("switchingStudentsDesc")}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="payments">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    {t("paymentTracking")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("recordingPayments")}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("recordingPaymentsDesc")}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("paymentStatus")}
                    </h4>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                      <li>
                        <Badge className="bg-green-100 text-green-800">
                          {t("paid")}
                        </Badge>{" "}
                        - {t("paidDesc")}
                      </li>
                      <li>
                        <Badge className="bg-red-100 text-red-800">
                          {t("unpaid")}
                        </Badge>{" "}
                        - {t("unpaidDesc")}
                      </li>
                      <li>
                        <Badge className="bg-orange-100 text-orange-800">
                          {t("partial")}
                        </Badge>{" "}
                        - {t("partialDesc")}
                      </li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="salaries">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-cyan-600" />
                    {t("salaryManagement")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("recordingSalaries")}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("recordingSalariesDesc")}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="reports">
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-orange-600" />
                    {t("reportsExport")}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("generatingReports")}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400">
                      {t("generatingReportsDesc")}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("exportOptions")}
                    </h4>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                      <li>
                        <strong>PDF:</strong>{" "}
                        {t("pdfDesc")}
                      </li>
                      <li>
                        <strong>CSV:</strong>{" "}
                        {t("csvDesc")}
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
              {t("tipsAndBestPractices")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <HelpCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">
                    {t("regularDataBackups")}
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    {t("regularDataBackupsDesc")}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <HelpCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">
                    {t("useSearchFeatures")}
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    {t("useSearchFeaturesDesc")}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <HelpCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">
                    {t("monitorDashboard")}
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    {t("monitorDashboardDesc")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
          <CardHeader>
            <CardTitle>{t("needMoreHelp")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {t("needMoreHelpDesc")}
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                {t("checkReadme")}
              </li>
              <li>
                {t("reviewSampleData")}
              </li>
              <li>
                {t("contactAdmin")}
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    
  );
}
