import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMonitoringData } from "@/hooks/useMonitoringData";
import { useMLAlerts } from "@/context/MLAlertContext";
import { CreateWorkerDialog } from "@/components/CreateWorkerDialog";
import { Users, AlertTriangle, Activity, ShieldAlert, Clock, Brain, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { TrendDirection } from "@/hooks/useMLAlertEngine";

const statusColors: Record<string, string> = {
  normal:   "bg-success text-success-foreground",
  warning:  "bg-warning text-warning-foreground",
  critical: "bg-critical text-critical-foreground",
};

function clusterBadgeClass(cluster: string) {
  if (cluster.includes("Low"))      return "bg-success/20 text-success border border-success/30";
  if (cluster.includes("High"))     return "bg-critical/20 text-critical border border-critical/30";
  return "bg-warning/20 text-warning-foreground border border-warning/30";
}

function TrendIcon({ dir }: { dir: TrendDirection }) {
  if (dir === "rising")  return <TrendingUp  className="h-3.5 w-3.5 text-critical" />;
  if (dir === "falling") return <TrendingDown className="h-3.5 w-3.5 text-warning"  />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useMonitoringData();
  const { snapshot } = useMLAlerts();
  const [zoneFilter,   setZoneFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [shiftFilter,  setShiftFilter]  = useState("all");

  const workers      = data?.workers ?? [];
  const zones        = data?.zones   ?? [];
  const alerts       = data?.alerts  ?? [];

  const normalCount   = workers.filter(w => w.status === "normal").length;
  const warningCount  = workers.filter(w => w.status === "warning").length;
  const criticalCount = workers.filter(w => w.status === "critical").length;
  const activeAlerts  = alerts.filter(a => a.status === "active");
  const criticalAlerts = alerts.filter(a => a.severity === "critical" && a.status === "active");

  const filtered = workers.filter(w => {
    if (zoneFilter   !== "all" && w.zone   !== zoneFilter)   return false;
    if (statusFilter !== "all" && w.status !== statusFilter) return false;
    if (shiftFilter  !== "all" && w.shift  !== shiftFilter)  return false;
    return true;
  });

  const kpis = [
    { label: "Active Workers", value: workers.length,      icon: Users,        color: "text-primary"  },
    { label: "Normal",         value: normalCount,         icon: Activity,     color: "text-success"  },
    { label: "Warning",        value: warningCount,        icon: AlertTriangle, color: "text-warning" },
    { label: "Critical",       value: criticalCount,       icon: ShieldAlert,  color: "text-critical" },
    { label: "Active Alerts",  value: activeAlerts.length, icon: AlertTriangle, color: "text-critical" },
  ];

  if (isLoading) {
    return <AppLayout><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading monitoring data...</div></AppLayout>;
  }

  if (error) {
    return <AppLayout><div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">Failed to load dashboard data.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Create Worker */}
        <div className="flex justify-end">
          <CreateWorkerDialog />
        </div>

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
          {kpis.map(kpi => (
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

        {/* ML Analysis Widget */}
        {snapshot ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  ML Analysis
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  Updated {snapshot.lastUpdated.toLocaleTimeString()}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">

                {/* Activity Cluster */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity Level</p>
                  <Badge className={clusterBadgeClass(snapshot.activityCluster)}>
                    {snapshot.activityCluster}
                  </Badge>
                  {snapshot.isAnomaly && (
                    <p className="text-xs text-critical font-medium">
                      ⚠ Anomaly detected — score {snapshot.anomalyScore.toFixed(3)}
                    </p>
                  )}
                </div>

                {/* Sensor Trends */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sensor Trends (last {30} readings)</p>
                  <div className="space-y-1.5">
                    {([
                      { label: "Heart Rate",   dir: snapshot.trends.hr.direction,   slope: snapshot.trends.hr.slope   },
                      { label: "Temperature",  dir: snapshot.trends.temp.direction,  slope: snapshot.trends.temp.slope  },
                      { label: "Air Quality",  dir: snapshot.trends.aq.direction,   slope: snapshot.trends.aq.slope   },
                    ] as Array<{ label: string; dir: TrendDirection; slope: number }>).map(({ label, dir, slope }) => (
                      <div key={label} className="flex items-center gap-2 text-xs">
                        <TrendIcon dir={dir} />
                        <span className="text-muted-foreground w-20">{label}:</span>
                        <span className={cn(
                          dir === "rising"  ? "text-critical" :
                          dir === "falling" ? "text-warning"  : "text-muted-foreground"
                        )}>
                          {dir} ({slope >= 0 ? "+" : ""}{slope.toFixed(3)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Anomaly Count + Correlations */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last 30 Min</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn("text-3xl font-bold", snapshot.anomalyCountLast30Min > 0 ? "text-critical" : "text-success")}>
                      {snapshot.anomalyCountLast30Min}
                    </span>
                    <span className="text-xs text-muted-foreground">anomalies</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>HR↔Temp: <span className="text-foreground">{snapshot.liveCorrelations.hr_temp.toFixed(2)}</span></div>
                    <div>HR↔AQ: <span className="text-foreground">{snapshot.liveCorrelations.hr_aq.toFixed(2)}</span></div>
                    <div>Temp↔AQ: <span className="text-foreground">{snapshot.liveCorrelations.temp_aq.toFixed(2)}</span></div>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <Brain className="h-4 w-4 text-primary animate-pulse" />
              ML engine initialising — collecting readings...
            </CardContent>
          </Card>
        )}

        {/* Filters + Worker Table */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Live Worker Status</CardTitle>
            <div className="flex items-center gap-3">
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map(z => <SelectItem key={z.name} value={z.name}>{z.name}</SelectItem>)}
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
                {filtered.map(w => (
                  <TableRow key={w.id} className="cursor-pointer" onClick={() => navigate(`/workers/${w.id}`)}>
                    <TableCell className="font-medium">{w.name}<br /><span className="text-xs text-muted-foreground">{w.id}</span></TableCell>
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
