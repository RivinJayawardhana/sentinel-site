import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMonitoringData } from "@/hooks/useMonitoringData";
import { CreateWorkerDialog } from "@/components/CreateWorkerDialog";
import {
  Users, AlertTriangle, Activity, ShieldAlert, Clock,
  Shield, TrendingUp, CheckCircle, ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const statusColors: Record<string, string> = {
  normal:   "bg-success text-success-foreground",
  warning:  "bg-warning text-warning-foreground",
  critical: "bg-critical text-critical-foreground",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useMonitoringData();
  const [zoneFilter,   setZoneFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [shiftFilter,  setShiftFilter]  = useState("all");

  const workers      = data?.workers ?? [];
  const zones        = data?.zones   ?? [];
  const alerts       = data?.alerts  ?? [];

  const normalCount    = workers.filter(w => w.status === "normal").length;
  const warningCount   = workers.filter(w => w.status === "warning").length;
  const criticalCount  = workers.filter(w => w.status === "critical").length;
  const activeAlerts   = alerts.filter(a => a.status === "active");
  const criticalAlerts = alerts.filter(a => a.severity === "critical" && a.status === "active");

  // Safety Health Score: weighted formula — rewards normal %, penalises critical and warning workers
  const healthScore = workers.length > 0
    ? Math.max(0, Math.min(100, Math.round(
        (normalCount / workers.length) * 100 - criticalCount * 10 - warningCount * 3,
      )))
    : 100;
  const healthScoreColor = healthScore >= 80 ? "text-success" : healthScore >= 60 ? "text-warning" : "text-critical";
  const healthScoreBg    = healthScore >= 80 ? "bg-success/5"  : healthScore >= 60 ? "bg-warning/5"  : "bg-critical/5";

  const filtered = workers.filter(w => {
    if (zoneFilter   !== "all" && w.zone   !== zoneFilter)   return false;
    if (statusFilter !== "all" && w.status !== statusFilter) return false;
    if (shiftFilter  !== "all" && w.shift  !== shiftFilter)  return false;
    return true;
  });

  // Auto-generated analytical insights
  const zoneAlertCounts = new Map<string, number>();
  for (const a of activeAlerts) {
    const w = workers.find(x => x.id === a.workerId);
    if (w) zoneAlertCounts.set(w.zone, (zoneAlertCounts.get(w.zone) ?? 0) + 1);
  }
  const topAlertZone   = [...zoneAlertCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const criticalWorker = workers.find(w => w.status === "critical");
  const allClear       = normalCount === workers.length && workers.length > 0;

  const kpis = [
    { label: "Active Workers",  value: workers.length,      icon: Users,         color: "text-primary"  },
    { label: "Normal",          value: normalCount,         icon: Activity,      color: "text-success"  },
    { label: "Warning",         value: warningCount,        icon: AlertTriangle, color: "text-warning"  },
    { label: "Critical",        value: criticalCount,       icon: ShieldAlert,   color: "text-critical" },
    { label: "Active Alerts",   value: activeAlerts.length, icon: AlertTriangle, color: "text-critical" },
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground" role="status" aria-live="polite">
          Loading monitoring data…
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive" role="alert">
          Failed to load dashboard data.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Operations Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time workforce safety overview — triage incidents, monitor vitals, and drill into individual workers.
            </p>
          </div>
          <CreateWorkerDialog />
        </div>

        {/* Critical Alert Banner */}
        {criticalAlerts.length > 0 && (
          <div
            className="flex items-center gap-3 rounded-lg bg-critical/10 border border-critical/30 p-4"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <ShieldAlert className="h-5 w-5 text-critical animate-pulse-glow" aria-hidden="true" />
            <span className="text-sm font-semibold text-critical flex-1">
              {criticalAlerts.length} CRITICAL ALERT{criticalAlerts.length > 1 ? "S" : ""} — {criticalAlerts[0].message}
            </span>
            <Button
              variant="ghost" size="sm"
              className="text-xs text-critical border border-critical/30 hover:bg-critical/10"
              onClick={() => navigate("/alerts")}
              aria-label="View all alerts"
            >
              View All <ArrowRight className="h-3 w-3 ml-1" aria-hidden="true" />
            </Button>
          </div>
        )}

        {/* KPI Cards + Safety Health Score */}
        <div className="grid grid-cols-6 gap-4">
          {kpis.map(kpi => (
            <Card key={kpi.label} role="status" aria-label={`${kpi.label}: ${kpi.value}`}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-lg bg-muted p-2.5 ${kpi.color}`} aria-hidden="true">
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Safety Health Score */}
          <Card
            className={healthScoreBg}
            role="status"
            aria-label={`Safety Health Score: ${healthScore} out of 100`}
            title="Composite score: (% normal workers × 100) minus penalties for critical and warning workers. Use this as a single at-a-glance KPI for shift handover decisions."
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${healthScoreColor}`} aria-hidden="true">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${healthScoreColor}`}>{healthScore}</p>
                <p className="text-xs text-muted-foreground">Health Score</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytical Insight Cards */}
        {(criticalWorker || topAlertZone || allClear || warningCount > 0) && (
          <section aria-label="Analytical insights">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-0.5">
              Analytical Insights
            </p>
            <div className="grid grid-cols-3 gap-4">
              {/* Critical worker insight */}
              {criticalWorker ? (
                <Card
                  className="border-critical/30 bg-critical/5 cursor-pointer hover:bg-critical/10 transition-colors"
                  onClick={() => navigate(`/workers/${criticalWorker.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(`/workers/${criticalWorker.id}`); }}
                  aria-label={`Immediate attention required for ${criticalWorker.name}. Press Enter to view worker details.`}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <ShieldAlert className="h-4 w-4 text-critical mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-critical">Immediate Attention Required</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {criticalWorker.name} ({criticalWorker.zone}) — HR: {criticalWorker.heartRate} BPM, Temp: {criticalWorker.temperature}°C
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                  </CardContent>
                </Card>
              ) : allClear ? (
                <Card className="border-success/30 bg-success/5">
                  <CardContent className="flex items-start gap-3 p-4">
                    <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-success">All Clear</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        All {workers.length} workers are operating within safe parameters.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Top alert zone insight */}
              {topAlertZone ? (
                <Card
                  className="border-warning/30 bg-warning/5 cursor-pointer hover:bg-warning/10 transition-colors"
                  onClick={() => navigate("/analytics")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("/analytics"); }}
                  aria-label={`${topAlertZone[0]} has the highest alert activity. Press Enter to view analytics.`}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <TrendingUp className="h-4 w-4 text-warning mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">Highest Alert Zone</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        <span className="font-medium text-foreground">{topAlertZone[0]}</span> has {topAlertZone[1]} active alert{topAlertZone[1] > 1 ? "s" : ""}. Consider redistributing personnel or inspecting zone conditions.
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                  </CardContent>
                </Card>
              ) : null}

              {/* Warning advisory or placeholder */}
              {warningCount > 0 ? (
                <Card className="border-border bg-muted/20">
                  <CardContent className="flex items-start gap-3 p-4">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">Monitoring Advisory</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {warningCount} worker{warningCount > 1 ? "s" : ""} in warning state. Conduct preemptive check-ins to prevent escalation to critical.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : !criticalWorker && !allClear ? (
                <Card className="border-border bg-muted/20">
                  <CardContent className="flex items-start gap-3 p-4">
                    <Activity className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground">No Active Workers</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Add workers to begin monitoring.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </section>
        )}

        {/* Live Worker Status Table */}
        <Card>
          <CardHeader className="flex-row items-start justify-between pb-4">
            <div>
              <CardTitle className="text-base">Live Worker Status</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use filters to isolate at-risk segments by zone, shift, or status. Click any row to drill into individual vitals and alert history.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-32 h-9 text-xs" aria-label="Filter by zone">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map(z => <SelectItem key={z.name} value={z.name}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-9 text-xs" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={shiftFilter} onValueChange={setShiftFilter}>
                <SelectTrigger className="w-32 h-9 text-xs" aria-label="Filter by shift">
                  <SelectValue placeholder="Shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="Morning">Morning</SelectItem>
                  <SelectItem value="Afternoon">Afternoon</SelectItem>
                  <SelectItem value="Night">Night</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Updated just now</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table aria-label="Live worker status — showing all monitored workers with current vital signs">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Worker</TableHead>
                  <TableHead scope="col">Role</TableHead>
                  <TableHead scope="col">Zone</TableHead>
                  <TableHead scope="col">Shift</TableHead>
                  <TableHead scope="col">Heart Rate</TableHead>
                  <TableHead scope="col">Temp</TableHead>
                  <TableHead scope="col">Air Quality</TableHead>
                  <TableHead scope="col">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(w => (
                  <TableRow
                    key={w.id}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    onClick={() => navigate(`/workers/${w.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/workers/${w.id}`);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`${w.name}, ${w.role}, Zone ${w.zone}, ${w.shift} shift, status ${w.status}. Press Enter to view details.`}
                  >
                    <TableCell className="font-medium">
                      {w.name}
                      <br />
                      <span className="text-xs text-muted-foreground">{w.id}</span>
                    </TableCell>
                    <TableCell>{w.role}</TableCell>
                    <TableCell>{w.zone}</TableCell>
                    <TableCell>{w.shift}</TableCell>
                    <TableCell>
                      <span aria-label={`${w.heartRate} beats per minute`}>{w.heartRate} BPM</span>
                    </TableCell>
                    <TableCell>
                      <span aria-label={`${w.temperature} degrees Celsius`}>{w.temperature}°C</span>
                    </TableCell>
                    <TableCell>{w.airQuality}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[w.status]} aria-label={`Status: ${w.status}`}>
                        {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No workers match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
};

export default Dashboard;
