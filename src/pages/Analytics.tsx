import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMonitoringData, useEmployeeHistory } from "@/hooks/useMonitoringData";
import { useMLAlerts } from "@/context/MLAlertContext";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { Download, Users, ShieldAlert, AlertTriangle, Brain, X, Link2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TelemetryPoint } from "@/types/monitoring";

const STATUS_FILL: Record<string, string> = {
  normal:   "hsl(122, 47%, 33%)",
  warning:  "hsl(45, 96%, 56%)",
  critical: "hsl(0, 76%, 47%)",
};

const SEVERITY_FILL: Record<string, string> = {
  low:      "hsl(210, 40%, 60%)",
  medium:   "hsl(45, 96%, 56%)",
  high:     "hsl(28, 100%, 48%)",
  critical: "hsl(0, 76%, 47%)",
};

const TYPE_LABELS: Record<string, string> = {
  heart_rate:     "Heart Rate",
  temperature:    "Temperature",
  air_quality:    "Air Quality",
  anomaly:        "Anomaly (ML)",
  trend:          "Trend (ML)",
  zone_breach:    "Zone Breach",
  device_offline: "Device Offline",
};

type AlertBucket = {
  key: string;
  label: string;
  total: number;
  ml: number;
  threshold: number;
  backend: number;
  workerIds: Set<string>;
};

function toTrendPoint(p: TelemetryPoint) {
  return {
    time:        new Date(p.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    heartRate:   p.heartRate   ?? 0,
    temperature: p.temperature ?? 0,
    airQuality:  p.airQuality  ?? 0,
    ts:          p.ts,
  };
}

const Analytics = () => {
  const { data, isLoading, error } = useMonitoringData();
  const { allAlerts }              = useMLAlerts();

  const workers = data?.workers ?? [];
  const zones   = data?.zones   ?? [];

  // ── Main filters ─────────────────────────────────────────────────────────────
  const [timeRange,    setTimeRange]    = useState("7d");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [zoneFilter,   setZoneFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Brushing & linking state ──────────────────────────────────────────────────
  // selectedAlertType  → drives severity pie filter
  // selectedSeverity   → drives alert-type bar filter
  // selectedTimeBucket → drives leaderboard row highlighting
  const [selectedAlertType,  setSelectedAlertType]  = useState<string | null>(null);
  const [selectedSeverity,   setSelectedSeverity]   = useState<string | null>(null);
  const [selectedTimeBucket, setSelectedTimeBucket] = useState<string | null>(null);

  // ref map for scrolling leaderboard to scatter-selected worker
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const rangeDays = timeRange === "24h" ? 1 : timeRange === "30d" ? 30 : 7;

  const { data: workerHistory } = useEmployeeHistory(
    workerFilter !== "all" ? workerFilter : "",
    120,
  );

  // ── Derived data ─────────────────────────────────────────────────────────────
  const backendAlerts = data?.alerts ?? [];
  const combinedAlerts = useMemo(() =>
    [...allAlerts, ...backendAlerts].reduce<typeof allAlerts>((acc, a) => {
      if (!acc.find(x => x.id === a.id)) acc.push(a);
      return acc;
    }, []),
    [allAlerts, backendAlerts],
  );

  const filteredWorkers = useMemo(() => workers.filter(w => {
    if (workerFilter !== "all" && w.id !== workerFilter)     return false;
    if (zoneFilter   !== "all" && w.zone !== zoneFilter)     return false;
    if (statusFilter !== "all" && w.status !== statusFilter) return false;
    return true;
  }), [workers, workerFilter, zoneFilter, statusFilter]);

  const filteredWorkerIds = useMemo(() => new Set(filteredWorkers.map(w => w.id)), [filteredWorkers]);

  const filteredAlerts = useMemo(() => {
    const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    return combinedAlerts.filter(a => {
      const ts = new Date(a.timestamp).getTime();
      if (!Number.isFinite(ts) || ts < cutoff)   return false;
      if (!filteredWorkerIds.has(a.workerId))     return false;
      return true;
    });
  }, [combinedAlerts, filteredWorkerIds, rangeDays]);

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const criticalCount  = filteredWorkers.filter(w => w.status === "critical").length;
  const warningCount   = filteredWorkers.filter(w => w.status === "warning").length;
  const activeAlerts   = filteredAlerts.filter(a => a.status === "active").length;
  const mlActiveAlerts = filteredAlerts.filter(a =>
    a.status === "active" && (a.source === "ml" || a.source === "threshold"),
  ).length;

  // ── Vital signs trend ─────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    if (!workerHistory || workerFilter === "all") return [];
    return [...workerHistory].sort((a, b) => a.ts - b.ts).slice(-120).map(toTrendPoint);
  }, [workerHistory, workerFilter]);

  const hrComparisonData = useMemo(() =>
    filteredWorkers.map(w => ({ name: w.name.split(" ")[0], heartRate: w.heartRate, status: w.status })),
    [filteredWorkers],
  );

  // ── Alerts Over Time — stores workerIds per bucket for time-bucket linking ────
  const dailyAlertData = useMemo((): AlertBucket[] => {
    const now = new Date();

    if (timeRange === "24h") {
      const buckets: AlertBucket[] = Array.from({ length: 24 }, (_, i) => {
        const d = new Date(now);
        d.setHours(now.getHours() - (23 - i), 0, 0, 0);
        return {
          key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`,
          label: d.toLocaleTimeString("en-US", { hour: "2-digit" }),
          total: 0, ml: 0, threshold: 0, backend: 0,
          workerIds: new Set<string>(),
        };
      });
      const byKey = new Map(buckets.map(b => [b.key, b]));
      for (const a of filteredAlerts) {
        const d = new Date(a.timestamp);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
        const bucket = byKey.get(key);
        if (!bucket) continue;
        bucket.total++;
        bucket.workerIds.add(a.workerId);
        if (a.source === "ml")             bucket.ml++;
        else if (a.source === "threshold") bucket.threshold++;
        else                               bucket.backend++;
      }
      return buckets;
    }

    const count = timeRange === "30d" ? 30 : 7;
    const buckets: AlertBucket[] = Array.from({ length: count }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (count - 1 - i));
      d.setHours(0, 0, 0, 0);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
        label: timeRange === "30d"
          ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : d.toLocaleDateString("en-US", { weekday: "short" }),
        total: 0, ml: 0, threshold: 0, backend: 0,
        workerIds: new Set<string>(),
      };
    });
    const byKey = new Map(buckets.map(b => [b.key, b]));
    for (const a of filteredAlerts) {
      const d = new Date(a.timestamp);
      d.setHours(0, 0, 0, 0);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const bucket = byKey.get(key);
      if (!bucket) continue;
      bucket.total++;
      bucket.workerIds.add(a.workerId);
      if (a.source === "ml")             bucket.ml++;
      else if (a.source === "threshold") bucket.threshold++;
      else                               bucket.backend++;
    }
    return buckets;
  }, [filteredAlerts, timeRange]);

  // ── Alert type data — includes typeKey so click handler can identify it ────────
  const alertTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of filteredAlerts) counts[a.type] = (counts[a.type] ?? 0) + 1;
    return Object.entries(counts)
      .map(([typeKey, count]) => ({ type: TYPE_LABELS[typeKey] ?? typeKey, typeKey, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredAlerts]);

  // ── Severity data (base) ─────────────────────────────────────────────────────
  const severityData = useMemo(() => {
    const s = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const a of filteredAlerts) {
      if (a.severity in s) s[a.severity as keyof typeof s]++;
    }
    return Object.entries(s)
      .filter(([, v]) => v > 0)
      .map(([sev, count]) => ({
        name: sev.charAt(0).toUpperCase() + sev.slice(1),
        value: count,
        fill: SEVERITY_FILL[sev],
      }));
  }, [filteredAlerts]);

  // ── BRUSHING: severity pie filtered by selected alert type ────────────────────
  const linkedSeverityData = useMemo(() => {
    if (!selectedAlertType) return severityData;
    const s = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const a of filteredAlerts) {
      if (a.type === selectedAlertType && a.severity in s)
        s[a.severity as keyof typeof s]++;
    }
    return Object.entries(s)
      .filter(([, v]) => v > 0)
      .map(([sev, count]) => ({
        name: sev.charAt(0).toUpperCase() + sev.slice(1),
        value: count,
        fill: SEVERITY_FILL[sev],
      }));
  }, [filteredAlerts, selectedAlertType, severityData]);

  // ── BRUSHING: type bars filtered by selected severity ─────────────────────────
  const linkedAlertTypeData = useMemo(() => {
    if (!selectedSeverity) return alertTypeData;
    const counts: Record<string, number> = {};
    for (const a of filteredAlerts) {
      if (a.severity === selectedSeverity) counts[a.type] = (counts[a.type] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([typeKey, count]) => ({ type: TYPE_LABELS[typeKey] ?? typeKey, typeKey, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredAlerts, selectedSeverity, alertTypeData]);

  // ── BRUSHING: worker IDs in the selected time bucket ─────────────────────────
  const bucketWorkerIds = useMemo(() => {
    if (!selectedTimeBucket) return null;
    return dailyAlertData.find(b => b.label === selectedTimeBucket)?.workerIds ?? null;
  }, [selectedTimeBucket, dailyAlertData]);

  // ── Risk distribution ─────────────────────────────────────────────────────────
  const riskData = useMemo(() => [
    { name: "Normal",   value: filteredWorkers.filter(w => w.status === "normal").length,   fill: STATUS_FILL.normal   },
    { name: "Warning",  value: filteredWorkers.filter(w => w.status === "warning").length,  fill: STATUS_FILL.warning  },
    { name: "Critical", value: filteredWorkers.filter(w => w.status === "critical").length, fill: STATUS_FILL.critical },
  ], [filteredWorkers]);

  // suppress unused warning — riskData used in future drill-down
  void riskData;

  // ── Scatter data ──────────────────────────────────────────────────────────────
  const scatterNormal   = filteredWorkers.filter(w => w.status === "normal").map(w =>
    ({ name: w.name, temperature: w.temperature, heartRate: w.heartRate, id: w.id }));
  const scatterWarning  = filteredWorkers.filter(w => w.status === "warning").map(w =>
    ({ name: w.name, temperature: w.temperature, heartRate: w.heartRate, id: w.id }));
  const scatterCritical = filteredWorkers.filter(w => w.status === "critical").map(w =>
    ({ name: w.name, temperature: w.temperature, heartRate: w.heartRate, id: w.id }));

  // ── Worker alert leaderboard ──────────────────────────────────────────────────
  const leaderboard = useMemo(() =>
    filteredWorkers.map(w => {
      const wa = filteredAlerts.filter(a => a.workerId === w.id);
      const lastAlert = wa.reduce<string | null>((latest, a) =>
        !latest || new Date(a.timestamp) > new Date(latest) ? a.timestamp : latest, null);
      return {
        id: w.id, name: w.name, zone: w.zone, status: w.status,
        active:   wa.filter(a => a.status === "active").length,
        critical: wa.filter(a => a.severity === "critical").length,
        total:    wa.length,
        lastAlert,
      };
    }).sort((a, b) => b.active - a.active || b.critical - a.critical),
    [filteredWorkers, filteredAlerts],
  );

  // ── LINKING: leaderboard row highlight + dim logic ────────────────────────────
  const anyLinkActive = selectedAlertType !== null || selectedSeverity !== null || selectedTimeBucket !== null;

  function rowHighlightClass(workerId: string): string {
    if (workerFilter === workerId)            return "bg-primary/15 border-l-2 border-l-primary";
    if (bucketWorkerIds?.has(workerId))       return "bg-warning/15 border-l-2 border-l-warning";
    if (selectedAlertType && filteredAlerts.some(a => a.workerId === workerId && a.type === selectedAlertType))
      return "bg-orange-500/10 border-l-2 border-l-orange-500";
    if (selectedSeverity && filteredAlerts.some(a => a.workerId === workerId && a.severity === selectedSeverity))
      return "bg-critical/10 border-l-2 border-l-critical";
    return "";
  }

  function isRowDimmed(workerId: string): boolean {
    if (!anyLinkActive && workerFilter === "all") return false;
    if (workerFilter === workerId)                return false;
    if (bucketWorkerIds?.has(workerId))           return false;
    if (selectedAlertType && filteredAlerts.some(a => a.workerId === workerId && a.type === selectedAlertType)) return false;
    if (selectedSeverity && filteredAlerts.some(a => a.workerId === workerId && a.severity === selectedSeverity)) return false;
    return true;
  }

  // ── Scroll leaderboard to scatter-selected worker ─────────────────────────────
  useEffect(() => {
    if (workerFilter !== "all") {
      rowRefs.current.get(workerFilter)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [workerFilter]);

  // ── Export ────────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      "Worker,Zone,Status,Heart Rate,Temperature,Air Quality,Active Alerts,Critical Alerts",
      ...leaderboard.map(r => {
        const w = filteredWorkers.find(x => x.id === r.id);
        return `${r.name},${r.zone},${r.status},${w?.heartRate ?? ""},${w?.temperature ?? ""},${w?.airQuality ?? ""},${r.active},${r.critical}`;
      }),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    a.download = `safety-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const clearAll = () => {
    setTimeRange("7d"); setWorkerFilter("all"); setZoneFilter("all"); setStatusFilter("all");
    setSelectedAlertType(null); setSelectedSeverity(null); setSelectedTimeBucket(null);
  };

  if (isLoading) return <AppLayout><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading analytics...</div></AppLayout>;
  if (error)     return <AppLayout><div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">Failed to load analytics.</div></AppLayout>;

  const selectedWorker = workers.find(w => w.id === workerFilter);

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* KPI Row */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: "Monitored Workers", value: filteredWorkers.length, icon: Users,        color: "text-primary"  },
            { label: "Critical Status",   value: criticalCount,          icon: ShieldAlert,  color: "text-critical" },
            { label: "Warning Status",    value: warningCount,           icon: AlertTriangle, color: "text-warning" },
            { label: "Active Alerts",     value: activeAlerts,           icon: AlertTriangle, color: "text-critical" },
            { label: "ML / Threshold",    value: mlActiveAlerts,         icon: Brain,        color: "text-primary"  },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="flex items-center gap-3 p-5">
                <div className={`rounded-lg bg-muted p-2.5 ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4 flex-wrap">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
              <SelectTrigger className="w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workers</SelectItem>
                {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => <SelectItem key={z.name} value={z.name}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </CardContent>
        </Card>

        {/* Active linked-selection chips */}
        {(selectedAlertType || selectedSeverity || selectedTimeBucket) && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Active links:</span>
            {selectedAlertType && (
              <Badge
                variant="outline"
                className="cursor-pointer gap-1 border-orange-500/60 text-orange-600 hover:bg-orange-500/10"
                onClick={() => setSelectedAlertType(null)}
              >
                Type: {TYPE_LABELS[selectedAlertType] ?? selectedAlertType}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {selectedSeverity && (
              <Badge
                variant="outline"
                className="cursor-pointer gap-1 hover:bg-muted"
                style={{ borderColor: SEVERITY_FILL[selectedSeverity], color: SEVERITY_FILL[selectedSeverity] }}
                onClick={() => setSelectedSeverity(null)}
              >
                Severity: {selectedSeverity.charAt(0).toUpperCase() + selectedSeverity.slice(1)}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {selectedTimeBucket && (
              <Badge
                variant="outline"
                className="cursor-pointer gap-1 border-warning/60 text-warning hover:bg-warning/10"
                onClick={() => setSelectedTimeBucket(null)}
              >
                Period: {selectedTimeBucket}
                <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}

        {/* Vital Signs Section */}
        {workerFilter !== "all" && selectedWorker ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
              Vital Signs History — {selectedWorker.name}
              <Badge className={`ml-2 text-[10px] py-0 px-1.5 ${selectedWorker.status === "critical" ? "bg-critical text-critical-foreground" : selectedWorker.status === "warning" ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"}`}>
                {selectedWorker.status.toUpperCase()}
              </Badge>
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: "heartRate"   as const, label: "Heart Rate (BPM)",  color: "hsl(0, 76%, 47%)",   refVal: data?.thresholds?.heartRate.max },
                { key: "temperature" as const, label: "Temperature (°C)",  color: "hsl(45, 96%, 56%)",  refVal: data?.thresholds?.temperature.max },
                { key: "airQuality"  as const, label: "Air Quality (AQI)", color: "hsl(122, 47%, 33%)", refVal: data?.thresholds?.airQuality.min },
              ].map(chart => (
                <Card key={chart.key}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{chart.label}</CardTitle></CardHeader>
                  <CardContent className="h-48">
                    {trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                          {chart.refVal != null && (
                            <ReferenceLine y={chart.refVal} stroke="hsl(0, 76%, 47%)" strokeDasharray="4 2" label={{ value: "Threshold", fontSize: 9, fill: "hsl(0, 76%, 47%)" }} />
                          )}
                          <Line type="monotone" dataKey={chart.key} stroke={chart.color} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No history data</div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Current Heart Rate — All Workers</CardTitle>
            </CardHeader>
            <CardContent className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hrComparisonData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, "auto"]} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                  {data?.thresholds?.heartRate.max && (
                    <ReferenceLine y={data.thresholds.heartRate.max} stroke="hsl(45, 96%, 56%)" strokeDasharray="4 2" label={{ value: "Warning", fontSize: 9, fill: "hsl(45, 96%, 56%)" }} />
                  )}
                  {data?.thresholds?.heartRate.criticalMax && (
                    <ReferenceLine y={data.thresholds.heartRate.criticalMax} stroke="hsl(0, 76%, 47%)" strokeDasharray="4 2" label={{ value: "Critical", fontSize: 9, fill: "hsl(0, 76%, 47%)" }} />
                  )}
                  <Bar dataKey="heartRate" radius={[4, 4, 0, 0]}>
                    {hrComparisonData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_FILL[entry.status] ?? "hsl(28,100%,48%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* ── Row 1: Alerts Over Time ↔ Alert Type Breakdown ── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Alerts Over Time — click a bar to link workers in the leaderboard */}
          <Card>
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Alerts Over Time</CardTitle>
                {selectedTimeBucket && (
                  <span className="flex items-center gap-1 text-xs text-warning font-medium">
                    <Link2 className="h-3 w-3" /> {selectedTimeBucket}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Click a bar → highlights workers in table below</p>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyAlertData}
                  style={{ cursor: "pointer" }}
                  onClick={(d: any) => {
                    const label = d?.activeLabel as string | undefined;
                    if (label) setSelectedTimeBucket(prev => prev === label ? null : label);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="backend" name="Backend" stackId="a">
                    {dailyAlertData.map((entry, i) => (
                      <Cell key={i} fill="hsl(210, 40%, 60%)"
                        opacity={!selectedTimeBucket || selectedTimeBucket === entry.label ? 1 : 0.2} />
                    ))}
                  </Bar>
                  <Bar dataKey="threshold" name="Threshold" stackId="a">
                    {dailyAlertData.map((entry, i) => (
                      <Cell key={i} fill="hsl(45, 96%, 56%)"
                        opacity={!selectedTimeBucket || selectedTimeBucket === entry.label ? 1 : 0.2} />
                    ))}
                  </Bar>
                  <Bar dataKey="ml" name="ML" stackId="a" radius={[4, 4, 0, 0]}>
                    {dailyAlertData.map((entry, i) => (
                      <Cell key={i} fill="hsl(28, 100%, 48%)"
                        opacity={!selectedTimeBucket || selectedTimeBucket === entry.label ? 1 : 0.2} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Alert Type Breakdown — click bar → filters severity pie */}
          <Card>
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Alert Type Breakdown
                  {selectedSeverity && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      — {selectedSeverity.charAt(0).toUpperCase() + selectedSeverity.slice(1)} only
                    </span>
                  )}
                </CardTitle>
                {(selectedAlertType || selectedSeverity) && <Link2 className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              <p className="text-[11px] text-muted-foreground">Click a bar → filters severity chart →</p>
            </CardHeader>
            <CardContent className="h-56">
              {linkedAlertTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={linkedAlertTypeData} layout="vertical" margin={{ left: 8 }} style={{ cursor: "pointer" }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <YAxis type="category" dataKey="type" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={88} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                    <Bar
                      dataKey="count"
                      radius={[0, 4, 4, 0]}
                      onClick={(d: any) => {
                        const key = d?.typeKey as string | undefined;
                        if (key) {
                          setSelectedAlertType(prev => prev === key ? null : key);
                          setSelectedSeverity(null);
                        }
                      }}
                    >
                      {linkedAlertTypeData.map((entry, i) => (
                        <Cell key={i} fill="hsl(28, 100%, 48%)"
                          opacity={!selectedAlertType || selectedAlertType === entry.typeKey ? 1 : 0.2} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No alerts in this period</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: Severity Pie (linked to type) ↔ Scatter (linked to leaderboard) ── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Severity Distribution — click slice → filters type breakdown */}
          <Card>
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Alert Severity Distribution
                  {selectedAlertType && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      — {TYPE_LABELS[selectedAlertType] ?? selectedAlertType}
                    </span>
                  )}
                </CardTitle>
                {(selectedAlertType || selectedSeverity) && <Link2 className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              <p className="text-[11px] text-muted-foreground">← Click a slice → filters type chart</p>
            </CardHeader>
            <CardContent className="h-56">
              {linkedSeverityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={linkedSeverityData}
                      cx="50%" cy="50%"
                      innerRadius={45} outerRadius={85}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      style={{ cursor: "pointer" }}
                      onClick={(d: any) => {
                        const sev = (d.name as string).toLowerCase();
                        setSelectedSeverity(prev => prev === sev ? null : sev);
                        setSelectedAlertType(null);
                      }}
                    >
                      {linkedSeverityData.map((e, i) => (
                        <Cell
                          key={i}
                          fill={e.fill}
                          opacity={!selectedSeverity || selectedSeverity === e.name.toLowerCase() ? 1 : 0.2}
                          stroke={selectedSeverity === e.name.toLowerCase() ? "hsl(var(--background))" : "none"}
                          strokeWidth={selectedSeverity === e.name.toLowerCase() ? 2 : 0}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No alerts in this period</div>
              )}
            </CardContent>
          </Card>

          {/* Scatter — click dot → highlights worker row in leaderboard below */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">Temperature vs Heart Rate</CardTitle>
              <p className="text-[11px] text-muted-foreground">Click a dot → highlights worker in table below</p>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="temperature" name="Temp (°C)" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                    label={{ value: "Temp °C", position: "insideBottom", offset: -2, fontSize: 10 }} />
                  <YAxis dataKey="heartRate" name="HR (BPM)" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                    content={({ payload }) => {
                      const d = payload?.[0]?.payload;
                      if (!d) return null;
                      return (
                        <div className="rounded-lg border bg-card p-2 text-xs space-y-0.5">
                          <p className="font-medium">{d.name}</p>
                          <p>Temp: {d.temperature}°C · HR: {d.heartRate} BPM</p>
                          {workerFilter === d.id && <p className="text-primary font-semibold">Selected — see table ↓</p>}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Scatter name="Normal"   data={scatterNormal}   fill={STATUS_FILL.normal}
                    style={{ cursor: "pointer" }}
                    onClick={(p: any) => p?.id && setWorkerFilter(prev => prev === p.id ? "all" : p.id)} />
                  <Scatter name="Warning"  data={scatterWarning}  fill={STATUS_FILL.warning}
                    style={{ cursor: "pointer" }}
                    onClick={(p: any) => p?.id && setWorkerFilter(prev => prev === p.id ? "all" : p.id)} />
                  <Scatter name="Critical" data={scatterCritical} fill={STATUS_FILL.critical}
                    style={{ cursor: "pointer" }}
                    onClick={(p: any) => p?.id && setWorkerFilter(prev => prev === p.id ? "all" : p.id)} />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Worker Alert Leaderboard — rows highlight/dim based on all active links */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Worker Alert Summary</CardTitle>
              <span className="text-xs text-muted-foreground">
                {anyLinkActive || workerFilter !== "all"
                  ? "Highlighted = match · Dimmed = no match"
                  : `Sorted by active alerts · ${timeRange} window`}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto overflow-y-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 font-medium">Worker</th>
                    <th className="text-left py-2 font-medium">Zone</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">HR (BPM)</th>
                    <th className="text-right py-2 font-medium">Temp (°C)</th>
                    <th className="text-right py-2 font-medium">AQ (AQI)</th>
                    <th className="text-right py-2 font-medium">Active</th>
                    <th className="text-right py-2 font-medium">Critical</th>
                    <th className="text-right py-2 font-medium">Total</th>
                    <th className="text-right py-2 font-medium">Last Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map(row => {
                    const w = filteredWorkers.find(x => x.id === row.id);
                    const hlClass = rowHighlightClass(row.id);
                    const dimmed  = isRowDimmed(row.id);
                    return (
                      <tr
                        key={row.id}
                        ref={el => { if (el) rowRefs.current.set(row.id, el); else rowRefs.current.delete(row.id); }}
                        className={`border-b last:border-0 cursor-pointer transition-all duration-150 ${hlClass} ${dimmed ? "opacity-25" : "hover:bg-muted/40"}`}
                        onClick={() => setWorkerFilter(prev => prev === row.id ? "all" : row.id)}
                      >
                        <td className="py-2 font-medium">{row.name}</td>
                        <td className="py-2 text-muted-foreground text-xs">{row.zone}</td>
                        <td className="py-2">
                          <Badge className={`text-[10px] py-0 px-1.5 ${
                            row.status === "critical" ? "bg-critical text-critical-foreground" :
                            row.status === "warning"  ? "bg-warning text-warning-foreground"  :
                                                        "bg-success text-success-foreground"
                          }`}>
                            {row.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-2 text-right font-mono">{w?.heartRate ?? "—"}</td>
                        <td className="py-2 text-right font-mono">{w?.temperature ?? "—"}</td>
                        <td className="py-2 text-right font-mono">{w?.airQuality ?? "—"}</td>
                        <td className={`py-2 text-right font-bold ${row.active > 0 ? "text-critical" : "text-success"}`}>{row.active}</td>
                        <td className={`py-2 text-right ${row.critical > 0 ? "text-critical" : "text-muted-foreground"}`}>{row.critical}</td>
                        <td className="py-2 text-right text-muted-foreground">{row.total}</td>
                        <td className="py-2 text-right text-xs text-muted-foreground">
                          {row.lastAlert
                            ? new Date(row.lastAlert).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {leaderboard.length === 0 && (
                    <tr><td colSpan={10} className="py-8 text-center text-sm text-muted-foreground">No workers match the current filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
};

export default Analytics;
