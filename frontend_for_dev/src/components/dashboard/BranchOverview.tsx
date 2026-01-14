import { Building2, Users, GraduationCap, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface Branch {
  id: string;
  name: string;
  status: "active" | "disabled" | "suspended";
  students: number;
  teachers: number;
  errors24h: number;
  lastActivity: string;
}

const branches: Branch[] = [
  {
    id: "1",
    name: "Moscow Central",
    status: "active",
    students: 245,
    teachers: 18,
    errors24h: 0,
    lastActivity: "2 min ago",
  },
  {
    id: "2",
    name: "Saint Petersburg",
    status: "active",
    students: 189,
    teachers: 14,
    errors24h: 2,
    lastActivity: "5 min ago",
  },
  {
    id: "3",
    name: "Kazan Branch",
    status: "suspended",
    students: 76,
    teachers: 6,
    errors24h: 12,
    lastActivity: "3 days ago",
  },
  {
    id: "4",
    name: "Sochi Campus",
    status: "active",
    students: 112,
    teachers: 9,
    errors24h: 1,
    lastActivity: "15 min ago",
  },
];

export function BranchOverview() {
  return (
    <div className="glass-card rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Branch Health</h2>
        <button className="text-xs text-primary hover:underline">Manage Branches</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left py-3 px-4 font-medium">Branch</th>
              <th className="text-left py-3 px-4 font-medium">Status</th>
              <th className="text-center py-3 px-4 font-medium">Students</th>
              <th className="text-center py-3 px-4 font-medium">Teachers</th>
              <th className="text-center py-3 px-4 font-medium">Errors (24h)</th>
              <th className="text-right py-3 px-4 font-medium">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id} className="data-table-row border-b border-border last:border-0">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{branch.name}</p>
                      <p className="text-xs text-muted-foreground">{branch.lastActivity}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={cn(
                    "badge-status capitalize",
                    branch.status === "active" && "badge-healthy",
                    branch.status === "suspended" && "badge-warning",
                    branch.status === "disabled" && "badge-critical"
                  )}>
                    {branch.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    {branch.students}
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {branch.teachers}
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className={cn(
                    "flex items-center justify-center gap-1 text-sm",
                    branch.errors24h > 5 && "text-status-critical",
                    branch.errors24h > 0 && branch.errors24h <= 5 && "text-status-warning",
                    branch.errors24h === 0 && "text-status-healthy"
                  )}>
                    {branch.errors24h > 0 && <AlertCircle className="w-4 h-4" />}
                    {branch.errors24h}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <Switch checked={branch.status === "active"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
