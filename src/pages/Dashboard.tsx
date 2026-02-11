import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { workers, alerts } from "@/data/mockData";
import { Users, AlertTriangle, Activity, ShieldAlert, Clock } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const statusColors: Record<string, string> = {
  normal: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  critical: "bg-critical text-critical-foreground",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");

  const normalCount = workers.filter((w) => w.status === "normal").length;
  const warningCount = workers.filter((w) => w.status === "warning").length;
  const criticalCount = workers.filter((w) => w.status === "critical").length;
  const activeAlerts = alerts.filter((a) => a.status === "active");
  const criticalAlerts = alerts.filter((a) => a.severity === "critical" && a.status === "active");

  const filtered = workers.filter((w) => {
    if (zoneFilter !== "all" && w.zone !== zoneFilter) return false;
    if (statusFilter !== "all" && w.status !== statusFilter) return false;
    if (shiftFilter !== "all" && w.shift !== shiftFilter) return false;
    return true;
  });

  const kpis = [
    { label: "Active Workers", value: workers.length, icon: Users, color: "text-primary" },
    { label: "Normal", value: normalCount, icon: Activity, color: "text-success" },
    { label: "Warning", value: warningCount, icon: AlertTriangle, color: "text-warning" },
    { label: "Critical", value: criticalCount, icon: ShieldAlert, color: "text-critical" },
    { label: "Active Alerts", value: activeAlerts.length, icon: AlertTriangle, color: "text-critical" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Critical Alert Banner */}
        {criticalAlerts.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg bg-critical/10 border border-critical/30 p-4">
            <ShieldAlert className="h-5 w-5 text-critical animate-pulse-glow" />
            <span className="text-sm font-semibold text-critical">
              {criticalAlerts.length} CRITICAL ALERT{criticalAlerts.length > 1 ? "S" : ""} — {criticalAlerts[0].message}
            </span>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-5 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-lg bg-muted p-2.5 ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters + Table */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Live Worker Status</CardTitle>
            <div className="flex items-center gap-3">
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  <SelectItem value="Zone A">Zone A</SelectItem>
                  <SelectItem value="Zone B">Zone B</SelectItem>
                  <SelectItem value="Zone C">Zone C</SelectItem>
                  <SelectItem value="Zone D">Zone D</SelectItem>
                  <SelectItem value="Zone E">Zone E</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={shiftFilter} onValueChange={setShiftFilter}>
                <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Shift" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="Morning">Morning</SelectItem>
                  <SelectItem value="Afternoon">Afternoon</SelectItem>
                  <SelectItem value="Night">Night</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Updated just now</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Heart Rate</TableHead>
                  <TableHead>Temp</TableHead>
                  <TableHead>Air Quality</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((w) => (
                  <TableRow
                    key={w.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/workers/${w.id}`)}
                  >
                    <TableCell className="font-medium">{w.name}<br/><span className="text-xs text-muted-foreground">{w.id}</span></TableCell>
                    <TableCell>{w.role}</TableCell>
                    <TableCell>{w.zone}</TableCell>
                    <TableCell>{w.shift}</TableCell>
                    <TableCell>{w.heartRate} BPM</TableCell>
                    <TableCell>{w.temperature}°C</TableCell>
                    <TableCell>{w.airQuality}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[w.status]}>
                        {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
