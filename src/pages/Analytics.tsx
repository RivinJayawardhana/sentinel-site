import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMonitoringData, useEmployeeHistory } from "@/hooks/useMonitoringData";
import { useMLAlerts } from "@/context/MLAlertContext";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine, Brush,
} from "recharts";
import {
  Download, Users, ShieldAlert, AlertTriangle, Brain,
  X, Link2, TrendingUp, Scale, Info,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TelemetryPoint } from "@/types/monitoring";

// ── Colour tokens ─────────────────────────────────────────────────────────────
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

const COMPARE_COLORS = {
  A: "hsl(210, 70%, 55%)",
  B: "hsl(28, 90%, 55%)",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type AlertBucket = {
  key: string;
  label: string;
  total: number;
  ml: number;
  threshold: number;
  backend: number;
  workerIds: Set<string>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function toTrendPoint(p: TelemetryPoint) {
  return {
    time:        new Date(p.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    heartRate:   p.heartRate   ?? 0,
    temperature: p.temperature ?? 0,
    airQuality:  p.airQuality  ?? 0,
    ts:          p.ts,
  };
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "11px",
};

// ── Component ─────────────────────────────────────────────────────────────────
const Analytics = () => {
  const { data, isLoading, error } = useMonitoringData();
  const { allAlerts }              = useMLAlerts();

  const workers = data?.workers ?? [];
  const zones   = data?.zones   ?? [];

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"overview" | "compare">("overview");

  // ── Main filters ──────────────────────────────────────────────────────────
  const [timeRange,    setTimeRange]    = useState("7d");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [zoneFilter,   setZoneFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Brushing & linking state ──────────────────────────────────────────────
  const [selectedAlertType,  setSelectedAlertType]  = useState<string | null>(null);
  const [selectedSeverity,   setSelectedSeverity]   = useState<string | null>(null);
  const [selectedTimeBucket, setSelectedTimeBucket] = useState<string | null>(null);
  const [brushRange,         setBrushRange]         = useState<{ startIndex: number; endIndex: number } | null>(null);

  // ── Compare tab state ─────────────────────────────────────────────────────
  const [compareWorkerA, setCompareWorkerA] = useState("none");
  const [compareWorkerB, setCompareWorkerB] = useState("none");

  // ref map for scrolling leaderboard to scatter-selected worker
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const rangeDays = timeRange === "24h" ? 1 : timeRange === "30d" ? 30 : 7;

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: workerHistory } = useEmployeeHistory(
    workerFilter !== "all" ? workerFilter : "",
    120,
  );
  const { data: historyA } = useEmployeeHistory(
    compareWorkerA !== "none" ? compareWorkerA : "",
    60,
  );
  const { data: historyB } = useEmployeeHistory(
    compareWorkerB !== "none" ? compareWorkerB : "",
    60,
  );

  // ── Derived alert data ────────────────────────────────────────────────────
  const backendAlerts  = data?.alerts ?? [];
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

  const filteredWorkerIds = useMemo(() =>
    new Set(filteredWorkers.map(w => w.id)), [filteredWorkers]);

  const filteredAlerts = useMemo(() => {
    const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    return combinedAlerts.filter(a => {
      const ts = new Date(a.timestamp).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) return false;
      if (!filteredWorkerIds.has(a.workerId))  return false;
      return true;
    });
  }, [combinedAlerts, filteredWorkerIds, rangeDays]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const criticalCount  = filteredWorkers.filter(w => w.status === "critical").length;
  const warningCount   = filteredWorkers.filter(w => w.status === "warning").length;
  const activeAlerts   = filteredAlerts.filter(a => a.status === "active").length;
  const mlActiveAlerts = filteredAlerts.filter(a =>
    a.status === "active" && (a.source === "ml" || a.source === "threshold"),
  ).length;

  // ── Vital signs trend ─────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    if (!workerHistory || workerFilter === "all") return [];
    return [...workerHistory].sort((a, b) => a.ts - b.ts).slice(-120).map(toTrendPoint);
  }, [workerHistory, workerFilter]);

  const hrComparisonData = useMemo(() =>
    filteredWorkers.map(w => ({
      name: w.name.split(" ")[0],
      heartRate: w.heartRate,
      status: w.status,
    })),
    [filteredWorkers],
  );

  // ── Alerts Over Time ──────────────────────────────────────────────────────
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

  // ── Alert type / severity data ────────────────────────────────────────────
  const alertTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of filteredAlerts) counts[a.type] = (counts[a.type] ?? 0) + 1;
    return Object.entries(counts)
      .map(([typeKey, count]) => ({ type: TYPE_LABELS[typeKey] ?? typeKey, typeKey, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredAlerts]);

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

  // ── BRUSHING: severity pie filtered by selected alert type ────────────────
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

  // ── BRUSHING: type bars filtered by selected severity ─────────────────────
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

  // ── BRUSHING: workers in selected time-bucket (bar click) ─────────────────
  const bucketWorkerIds = useMemo(() => {
    if (!selectedTimeBucket) return null;
    return dailyAlertData.find(b => b.label === selectedTimeBucket)?.workerIds ?? null;
  }, [selectedTimeBucket, dailyAlertData]);

  // ── BRUSH RANGE: workers involved in alerts within the dragged range ───────
  const brushedWorkerIds = useMemo(() => {
    if (!brushRange) return null;
    const buckets = dailyAlertData.slice(brushRange.startIndex, brushRange.endIndex + 1);
    const ids = new Set<string>();
    for (const b of buckets) for (const id of b.workerIds) ids.add(id);
    return ids;
  }, [brushRange, dailyAlertData]);

  // ── Scatter data ──────────────────────────────────────────────────────────
  const scatterNormal   = filteredWorkers.filter(w => w.status === "normal")
    .map(w => ({ name: w.name, temperature: w.temperature, heartRate: w.heartRate, id: w.id }));
  const scatterWarning  = filteredWorkers.filter(w => w.status === "warning")
    .map(w => ({ name: w.name, temperature: w.temperature, heartRate: w.heartRate, id: w.id }));
  const scatterCritical = filteredWorkers.filter(w => w.status === "critical")
    .map(w => ({ name: w.name, temperature: w.temperature, heartRate: w.heartRate, id: w.id }));

  // ── Worker alert leaderboard ──────────────────────────────────────────────
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

  // ── LINKING: leaderboard highlight / dim ──────────────────────────────────
  const anyLinkActive = selectedAlertType !== null || selectedSeverity !== null
    || selectedTimeBucket !== null || brushRange !== null;

  function rowHighlightClass(workerId: string): string {
    if (workerFilter === workerId)              return "bg-primary/15 border-l-2 border-l-primary";
    if (bucketWorkerIds?.has(workerId))         return "bg-warning/15 border-l-2 border-l-warning";
    if (brushedWorkerIds?.has(workerId))        return "bg-primary/10 border-l-2 border-l-primary/50";
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
    if (brushedWorkerIds?.has(workerId))          return false;
    if (selectedAlertType && filteredAlerts.some(a => a.workerId === workerId && a.type === selectedAlertType)) return false;
    if (selectedSeverity  && filteredAlerts.some(a => a.workerId === workerId && a.severity === selectedSeverity)) return false;
    return true;
  }

  // ── Scroll leaderboard to scatter-selected worker ─────────────────────────
  useEffect(() => {
    if (workerFilter !== "all") {
      rowRefs.current.get(workerFilter)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [workerFilter]);

  // ── Compare tab derived data ──────────────────────────────────────────────
  const workerAData = useMemo(() => workers.find(w => w.id === compareWorkerA), [workers, compareWorkerA]);
  const workerBData = useMemo(() => workers.find(w => w.id === compareWorkerB), [workers, compareWorkerB]);

  const trendDataA = useMemo(() => {
    if (!historyA) return [];
    return [...historyA].sort((a, b) => a.ts - b.ts).slice(-60).map(toTrendPoint);
  }, [historyA]);

  const trendDataB = useMemo(() => {
    if (!historyB) return [];
    return [...historyB].sort((a, b) => a.ts - b.ts).slice(-60).map(toTrendPoint);
  }, [historyB]);

  // Merged trend data: align by index position for side-by-side line charts
  const mergedTrendData = useMemo(() => {
    const maxLen = Math.max(trendDataA.length, trendDataB.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      i,
      time:  trendDataA[i]?.time ?? trendDataB[i]?.time ?? String(i),
      hrA:   trendDataA[i]?.heartRate   ?? null,
      hrB:   trendDataB[i]?.heartRate   ?? null,
      tmpA:  trendDataA[i]?.temperature ?? null,
      tmpB:  trendDataB[i]?.temperature ?? null,
      aqA:   trendDataA[i]?.airQuality  ?? null,
      aqB:   trendDataB[i]?.airQuality  ?? null,
    }));
  }, [trendDataA, trendDataB]);

  // Bar chart comparing current vital snapshots
  const compareBarData = useMemo(() => {
    if (!workerAData || !workerBData) return [];
    return [
      { metric: "Heart Rate (BPM)", A: workerAData.heartRate,   B: workerBData.heartRate   },
      { metric: "Temperature (°C)", A: workerAData.temperature, B: workerBData.temperature },
      { metric: "Air Quality",      A: workerAData.airQuality,  B: workerBData.airQuality  },
    ];
  }, [workerAData, workerBData]);

  // Zone-level aggregate comparison
  const zoneComparisonData = useMemo(() =>
    zones.map(zone => {
      const zw = workers.filter(w => w.zone === zone.name);
      const avgHR   = zw.length ? Math.round(zw.reduce((s, w) => s + w.heartRate,   0) / zw.length) : 0;
      const avgTemp = zw.length ? parseFloat((zw.reduce((s, w) => s + w.temperature, 0) / zw.length).toFixed(1)) : 0;
      const avgAQ   = zw.length ? Math.round(zw.reduce((s, w) => s + w.airQuality,  0) / zw.length) : 0;
      const critical = zw.filter(w => w.status === "critical").length;
      const warning  = zw.filter(w => w.status === "warning").length;
      const label = zone.name.length > 14 ? zone.name.slice(0, 13) + "…" : zone.name;
      return { label, fullName: zone.name, workers: zw.length, avgHR, avgTemp, avgAQ, critical, warning };
    }),
    [zones, workers],
  );

  // ── Export ────────────────────────────────────────────────────────────────
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
    setSelectedAlertType(null); setSelectedSeverity(null); setSelectedTimeBucket(null); setBrushRange(null);
  };

  if (isLoading) return <AppLayout><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground" role="status" aria-live="polite">Loading analytics…</div></AppLayout>;
  if (error)     return <AppLayout><div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive" role="alert">Failed to load analytics.</div></AppLayout>;

  const selectedWorker = workers.find(w => w.id === workerFilter);

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-lg font-semibold">Visual Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Explore trends, compare workers, and identify patterns to support evidence-based safety decisions.
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-5 gap-4" role="region" aria-label="Key performance indicators">
          {[
            { label: "Monitored Workers", value: filteredWorkers.length, icon: Users,         color: "text-primary",  desc: "Total workers in current filter" },
            { label: "Critical Status",   value: criticalCount,          icon: ShieldAlert,   color: "text-critical", desc: "Workers requiring immediate action" },
            { label: "Warning Status",    value: warningCount,           icon: AlertTriangle, color: "text-warning",  desc: "Workers with elevated readings" },
            { label: "Active Alerts",     value: activeAlerts,           icon: AlertTriangle, color: "text-critical", desc: "Unresolved alerts in selected period" },
            { label: "ML / Threshold",    value: mlActiveAlerts,         icon: Brain,         color: "text-primary",  desc: "Alerts raised by ML or threshold engine" },
          ].map(kpi => (
            <Card key={kpi.label} role="status" aria-label={`${kpi.label}: ${kpi.value}. ${kpi.desc}`} title={kpi.desc}>
              <CardContent className="flex items-center gap-3 p-5">
                <div className={`rounded-lg bg-muted p-2.5 ${kpi.color}`} aria-hidden="true">
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

        {/* Tabs: Overview / Compare */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "compare")}>
          <TabsList aria-label="Analytics views">
            <TabsTrigger value="overview" className="gap-2">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="compare" className="gap-2">
              <Scale className="h-4 w-4" aria-hidden="true" />
              Compare
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════ OVERVIEW TAB ══════════════════ */}
          <TabsContent value="overview" className="mt-4 space-y-6">

            {/* Filter Bar */}
            <Card>
              <CardContent className="flex items-center gap-3 p-4 flex-wrap">
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-36 h-9 text-xs" aria-label="Select time range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={workerFilter} onValueChange={setWorkerFilter}>
                  <SelectTrigger className="w-40 h-9 text-xs" aria-label="Filter by worker">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Workers</SelectItem>
                    {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={zoneFilter} onValueChange={setZoneFilter}>
                  <SelectTrigger className="w-32 h-9 text-xs" aria-label="Filter by zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Zones</SelectItem>
                    {zones.map(z => <SelectItem key={z.name} value={z.name}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 h-9 text-xs" aria-label="Filter by status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={clearAll} aria-label="Clear all filters and selections">
                  Clear
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} aria-label="Export worker data as CSV">
                  <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
                </Button>
              </CardContent>
            </Card>

            {/* Active linked-selection chips */}
            {(selectedAlertType || selectedSeverity || selectedTimeBucket || brushRange) && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs" role="status" aria-live="polite" aria-label="Active chart selections">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground font-medium">Active links:</span>
                {selectedAlertType && (
                  <Badge
                    variant="outline"
                    className="cursor-pointer gap-1 border-orange-500/60 text-orange-600 hover:bg-orange-500/10"
                    onClick={() => setSelectedAlertType(null)}
                    role="button"
                    aria-label={`Remove alert type filter: ${TYPE_LABELS[selectedAlertType] ?? selectedAlertType}`}
                  >
                    Type: {TYPE_LABELS[selectedAlertType] ?? selectedAlertType}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </Badge>
                )}
                {selectedSeverity && (
                  <Badge
                    variant="outline"
                    className="cursor-pointer gap-1 hover:bg-muted"
                    style={{ borderColor: SEVERITY_FILL[selectedSeverity], color: SEVERITY_FILL[selectedSeverity] }}
                    onClick={() => setSelectedSeverity(null)}
                    role="button"
                    aria-label={`Remove severity filter: ${selectedSeverity}`}
                  >
                    Severity: {selectedSeverity.charAt(0).toUpperCase() + selectedSeverity.slice(1)}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </Badge>
                )}
                {selectedTimeBucket && (
                  <Badge
                    variant="outline"
                    className="cursor-pointer gap-1 border-warning/60 text-warning hover:bg-warning/10"
                    onClick={() => setSelectedTimeBucket(null)}
                    role="button"
                    aria-label={`Remove time period filter: ${selectedTimeBucket}`}
                  >
                    Period: {selectedTimeBucket}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </Badge>
                )}
                {brushRange && (
                  <Badge
                    variant="outline"
                    className="cursor-pointer gap-1 border-primary/60 text-primary hover:bg-primary/10"
                    onClick={() => setBrushRange(null)}
                    role="button"
                    aria-label={`Remove brush range selection: ${dailyAlertData[brushRange.startIndex]?.label} to ${dailyAlertData[brushRange.endIndex]?.label}`}
                  >
                    Brush: {dailyAlertData[brushRange.startIndex]?.label} → {dailyAlertData[brushRange.endIndex]?.label}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </Badge>
                )}
              </div>
            )}

            {/* Vital Signs Section */}
            {workerFilter !== "all" && selectedWorker ? (
              <section aria-label={`Vital signs history for ${selectedWorker.name}`}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-2">
                  Vital Signs History — {selectedWorker.name}
                  <Badge className={`ml-2 text-[10px] py-0 px-1.5 ${
                    selectedWorker.status === "critical" ? "bg-critical text-critical-foreground" :
                    selectedWorker.status === "warning"  ? "bg-warning text-warning-foreground"  :
                    "bg-success text-success-foreground"
                  }`} aria-label={`Worker status: ${selectedWorker.status}`}>
                    {selectedWorker.status.toUpperCase()}
                  </Badge>
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { key: "heartRate"   as const, label: "Heart Rate (BPM)",  color: "hsl(0, 76%, 47%)",   refVal: data?.thresholds?.heartRate.max,    goal: "Identify sustained elevated HR — a leading indicator of heat stress or overexertion" },
                    { key: "temperature" as const, label: "Temperature (°C)",  color: "hsl(45, 96%, 56%)",  refVal: data?.thresholds?.temperature.max,  goal: "Track temperature drift to predict heat-related incidents before they become critical" },
                    { key: "airQuality"  as const, label: "Air Quality (AQI)", color: "hsl(122, 47%, 33%)", refVal: data?.thresholds?.airQuality.min,   goal: "Monitor AQI trend to detect environmental deterioration in the work zone" },
                  ].map(chart => (
                    <Card key={chart.key} aria-label={`${chart.label} trend chart for ${selectedWorker.name}`} title={chart.goal}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{chart.label}</CardTitle>
                        <p className="text-[11px] text-muted-foreground">{chart.goal}</p>
                      </CardHeader>
                      <CardContent className="h-48">
                        {trendData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                              <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                              <Tooltip contentStyle={TOOLTIP_STYLE} />
                              {chart.refVal != null && (
                                <ReferenceLine
                                  y={chart.refVal}
                                  stroke="hsl(0, 76%, 47%)"
                                  strokeDasharray="4 2"
                                  label={{ value: "Threshold", fontSize: 9, fill: "hsl(0, 76%, 47%)" }}
                                  aria-label={`Threshold at ${chart.refVal}`}
                                />
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
              </section>
            ) : (
              <Card aria-label="Current heart rate comparison across all workers" title="Use this chart to spot workers with heart rates approaching warning or critical thresholds — colour-coded by status for rapid triage">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Current Heart Rate — All Workers</CardTitle>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
                    Identify workers approaching warning or critical thresholds. Bars are colour-coded by current status for rapid triage.
                  </p>
                </CardHeader>
                <CardContent className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hrComparisonData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, "auto"]} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      {data?.thresholds?.heartRate.max && (
                        <ReferenceLine y={data.thresholds.heartRate.max} stroke="hsl(45, 96%, 56%)" strokeDasharray="4 2"
                          label={{ value: "Warning", fontSize: 9, fill: "hsl(45, 96%, 56%)" }} />
                      )}
                      {data?.thresholds?.heartRate.criticalMax && (
                        <ReferenceLine y={data.thresholds.heartRate.criticalMax} stroke="hsl(0, 76%, 47%)" strokeDasharray="4 2"
                          label={{ value: "Critical", fontSize: 9, fill: "hsl(0, 76%, 47%)" }} />
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

            {/* Row 1: Alerts Over Time ↔ Alert Type Breakdown */}
            <div className="grid grid-cols-2 gap-6">

              {/* Alerts Over Time — click bar or drag brush to link workers */}
              <Card aria-label="Alerts over time chart" title="Identify peak alert periods to understand workload patterns and plan shift-based interventions. Drag the brush below the chart to zoom into a time range.">
                <CardHeader className="pb-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Alerts Over Time</CardTitle>
                    {selectedTimeBucket && (
                      <span className="flex items-center gap-1 text-xs text-warning font-medium" aria-live="polite">
                        <Link2 className="h-3 w-3" aria-hidden="true" /> {selectedTimeBucket}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
                    Click a bar to highlight workers active in that period · Drag the brush to zoom a time range
                  </p>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dailyAlertData}
                      style={{ cursor: "pointer" }}
                      margin={{ bottom: 8 }}
                      onClick={(d: any) => {
                        const label = d?.activeLabel as string | undefined;
                        if (label) setSelectedTimeBucket(prev => prev === label ? null : label);
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Brush
                        dataKey="label"
                        height={18}
                        stroke="hsl(var(--border))"
                        fill="hsl(var(--muted))"
                        travellerWidth={6}
                        onChange={(d: any) => {
                          if (d && typeof d.startIndex === "number" && typeof d.endIndex === "number") {
                            setBrushRange({ startIndex: d.startIndex, endIndex: d.endIndex });
                          }
                        }}
                        aria-label="Drag to select a time range and highlight workers in the table below"
                      />
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

              {/* Alert Type Breakdown */}
              <Card aria-label="Alert type breakdown chart" title="Determine which alert categories are most prevalent so resources can be directed at the highest-frequency risk type">
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
                    {(selectedAlertType || selectedSeverity) && <Link2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
                    Click a bar to cross-filter the severity chart and identify which alert types are most critical →
                  </p>
                </CardHeader>
                <CardContent className="h-64">
                  {linkedAlertTypeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={linkedAlertTypeData} layout="vertical" margin={{ left: 8 }} style={{ cursor: "pointer" }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                        <YAxis type="category" dataKey="type" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={88} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
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

            {/* Row 2: Severity Pie ↔ Scatter */}
            <div className="grid grid-cols-2 gap-6">

              {/* Severity Distribution */}
              <Card aria-label="Alert severity distribution pie chart" title="Understand severity mix to prioritise response: if critical and high dominate, escalate immediately; if low and medium dominate, consider process improvements">
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
                    {(selectedAlertType || selectedSeverity) && <Link2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
                    ← Click a slice to cross-filter the type chart and pinpoint the highest-severity alert categories
                  </p>
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
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No alerts in this period</div>
                  )}
                </CardContent>
              </Card>

              {/* Scatter — Temperature vs Heart Rate */}
              <Card aria-label="Scatter plot of temperature versus heart rate" title="Spot outliers: workers with both elevated temperature and heart rate signal compounded physiological risk and should be prioritised for immediate check-in">
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm">Temperature vs Heart Rate</CardTitle>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
                    Spot compounded risk: high temp + high HR simultaneously signals heat stress. Click a dot to drill into that worker ↓
                  </p>
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
                        contentStyle={TOOLTIP_STYLE}
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

            {/* Worker Alert Leaderboard */}
            <Card aria-label="Worker alert summary leaderboard">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Worker Alert Summary</CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Ranked by active alerts — use this to prioritise which workers need attention first. Rows highlight based on active chart selections.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground" aria-live="polite">
                    {anyLinkActive || workerFilter !== "all"
                      ? "Highlighted = match · Dimmed = no match"
                      : `Sorted by active alerts · ${timeRange} window`}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto overflow-y-auto max-h-80">
                  <table className="w-full text-sm" aria-label="Worker alert leaderboard — click rows to select a worker and filter charts above">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2 font-medium" scope="col">Worker</th>
                        <th className="text-left py-2 font-medium" scope="col">Zone</th>
                        <th className="text-left py-2 font-medium" scope="col">Status</th>
                        <th className="text-right py-2 font-medium" scope="col">HR (BPM)</th>
                        <th className="text-right py-2 font-medium" scope="col">Temp (°C)</th>
                        <th className="text-right py-2 font-medium" scope="col">AQ (AQI)</th>
                        <th className="text-right py-2 font-medium" scope="col">Active</th>
                        <th className="text-right py-2 font-medium" scope="col">Critical</th>
                        <th className="text-right py-2 font-medium" scope="col">Total</th>
                        <th className="text-right py-2 font-medium" scope="col">Last Alert</th>
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
                            className={`border-b last:border-0 cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${hlClass} ${dimmed ? "opacity-25" : "hover:bg-muted/40"}`}
                            onClick={() => setWorkerFilter(prev => prev === row.id ? "all" : row.id)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setWorkerFilter(prev => prev === row.id ? "all" : row.id); } }}
                            tabIndex={0}
                            aria-label={`${row.name}, ${row.zone}, status ${row.status}, ${row.active} active alerts. Press Enter to select.`}
                            aria-selected={workerFilter === row.id}
                          >
                            <td className="py-2 font-medium">{row.name}</td>
                            <td className="py-2 text-muted-foreground text-xs">{row.zone}</td>
                            <td className="py-2">
                              <Badge className={`text-[10px] py-0 px-1.5 ${
                                row.status === "critical" ? "bg-critical text-critical-foreground" :
                                row.status === "warning"  ? "bg-warning text-warning-foreground"  :
                                "bg-success text-success-foreground"
                              }`} aria-label={`Status: ${row.status}`}>
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
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                            No workers match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════ COMPARE TAB ══════════════════ */}
          <TabsContent value="compare" className="mt-4 space-y-6">

            <div>
              <h2 className="text-sm font-semibold">Comparative Analysis</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compare two workers side-by-side to evaluate relative risk, or analyse zone-level aggregates to identify high-risk areas.
              </p>
            </div>

            {/* Worker A vs B selector */}
            <Card aria-label="Worker comparison selector">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Worker-to-Worker Comparison</CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Select two workers to compare their current vitals, trend history, and relative risk metrics.
                </p>
              </CardHeader>
              <CardContent className="flex items-center gap-4 p-4 pt-0 flex-wrap">
                <Select value={compareWorkerA} onValueChange={setCompareWorkerA}>
                  <SelectTrigger className="w-52 h-9 text-sm" aria-label="Select Worker A for comparison">
                    <SelectValue placeholder="Select Worker A" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select Worker A</SelectItem>
                    {workers.map(w => (
                      <SelectItem key={w.id} value={w.id} disabled={w.id === compareWorkerB}>
                        {w.name} — {w.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground font-medium text-sm" aria-hidden="true">vs</span>
                <Select value={compareWorkerB} onValueChange={setCompareWorkerB}>
                  <SelectTrigger className="w-52 h-9 text-sm" aria-label="Select Worker B for comparison">
                    <SelectValue placeholder="Select Worker B" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select Worker B</SelectItem>
                    {workers.map(w => (
                      <SelectItem key={w.id} value={w.id} disabled={w.id === compareWorkerA}>
                        {w.name} — {w.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(compareWorkerA !== "none" || compareWorkerB !== "none") && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setCompareWorkerA("none"); setCompareWorkerB("none"); }}
                    aria-label="Clear worker comparison selection"
                  >
                    Clear
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Side-by-side worker comparison */}
            {workerAData && workerBData ? (
              <>
                {/* Profile cards */}
                <div className="grid grid-cols-2 gap-4" role="region" aria-label={`Side-by-side comparison: ${workerAData.name} versus ${workerBData.name}`}>
                  {[
                    { worker: workerAData, label: "Worker A", color: COMPARE_COLORS.A },
                    { worker: workerBData, label: "Worker B", color: COMPARE_COLORS.B },
                  ].map(({ worker, label, color }) => (
                    <Card key={worker.id} style={{ borderTop: `3px solid ${color}` }} aria-label={`${label}: ${worker.name}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">{worker.name}</p>
                            <p className="text-xs text-muted-foreground">{worker.role} · {worker.shift} shift</p>
                          </div>
                          <Badge className={`text-[10px] ${
                            worker.status === "critical" ? "bg-critical text-critical-foreground" :
                            worker.status === "warning"  ? "bg-warning text-warning-foreground"  :
                            "bg-success text-success-foreground"
                          }`} aria-label={`Status: ${worker.status}`}>
                            {worker.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          {[
                            { name: "Heart Rate",  value: `${worker.heartRate} BPM`,   compare: workerAData.heartRate   !== workerBData.heartRate   ? (worker.heartRate   > (worker.id === workerAData.id ? workerBData.heartRate   : workerAData.heartRate)   ? "↑" : "↓") : "=" },
                            { name: "Temperature", value: `${worker.temperature}°C`,   compare: workerAData.temperature !== workerBData.temperature ? (worker.temperature > (worker.id === workerAData.id ? workerBData.temperature : workerAData.temperature) ? "↑" : "↓") : "=" },
                            { name: "Air Quality", value: `${worker.airQuality} AQI`,  compare: workerAData.airQuality  !== workerBData.airQuality  ? (worker.airQuality  > (worker.id === workerAData.id ? workerBData.airQuality  : workerAData.airQuality)  ? "↑" : "↓") : "=" },
                            { name: "Zone",        value: worker.zone,                  compare: null },
                          ].map(metric => (
                            <div key={metric.name} className="flex items-center justify-between py-0.5 border-b border-border/50 last:border-0">
                              <span className="text-muted-foreground">{metric.name}</span>
                              <span className="font-medium flex items-center gap-1">
                                {metric.value}
                                {metric.compare && (
                                  <span className={`text-[10px] ${metric.compare === "↑" ? "text-critical" : metric.compare === "↓" ? "text-success" : "text-muted-foreground"}`} aria-label={metric.compare === "↑" ? "higher than other worker" : metric.compare === "↓" ? "lower than other worker" : "same as other worker"}>
                                    {metric.compare}
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Grouped bar: current vital snapshot comparison */}
                <Card aria-label="Vital signs grouped bar chart comparing the two selected workers" title="Side-by-side bar chart makes it easy to spot which worker's vitals are more elevated at this moment">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Vital Signs Snapshot Comparison</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      Current reading for each metric — quickly identify which worker is more elevated and by how much.
                    </p>
                  </CardHeader>
                  <CardContent className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compareBarData} barCategoryGap="30%" barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="metric" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Bar dataKey="A" name={workerAData.name.split(" ")[0]} fill={COMPARE_COLORS.A} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="B" name={workerBData.name.split(" ")[0]} fill={COMPARE_COLORS.B} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Delta summary table */}
                <Card aria-label="Metric delta table showing differences between the two workers">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Difference Summary</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      Absolute difference between the two workers. Large deltas on a single metric indicate diverging physiological responses — investigate environmental or task differences.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full text-xs" aria-label="Metric differences between the two compared workers">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 font-medium" scope="col">Metric</th>
                          <th className="text-right py-2 font-medium" scope="col" style={{ color: COMPARE_COLORS.A }}>{workerAData.name.split(" ")[0]}</th>
                          <th className="text-right py-2 font-medium" scope="col" style={{ color: COMPARE_COLORS.B }}>{workerBData.name.split(" ")[0]}</th>
                          <th className="text-right py-2 font-medium" scope="col">Delta</th>
                          <th className="text-right py-2 font-medium" scope="col">Higher Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            metric: "Heart Rate (BPM)",
                            a: workerAData.heartRate, b: workerBData.heartRate,
                            higherIsWorse: true,
                          },
                          {
                            metric: "Temperature (°C)",
                            a: workerAData.temperature, b: workerBData.temperature,
                            higherIsWorse: true,
                          },
                          {
                            metric: "Air Quality (AQI)",
                            a: workerAData.airQuality, b: workerBData.airQuality,
                            higherIsWorse: false,
                          },
                        ].map(row => {
                          const delta = Math.abs(row.a - row.b);
                          const aIsWorse = row.higherIsWorse ? row.a > row.b : row.a < row.b;
                          const higherRisk = row.a === row.b ? "Equal" : aIsWorse ? workerAData.name.split(" ")[0] : workerBData.name.split(" ")[0];
                          const riskColor = row.a === row.b ? "text-muted-foreground" : aIsWorse ? COMPARE_COLORS.A : COMPARE_COLORS.B;
                          return (
                            <tr key={row.metric} className="border-b last:border-0">
                              <td className="py-2 font-medium">{row.metric}</td>
                              <td className="py-2 text-right font-mono">{row.a}</td>
                              <td className="py-2 text-right font-mono">{row.b}</td>
                              <td className="py-2 text-right font-mono font-bold">{delta === 0 ? "—" : `±${delta.toFixed(1)}`}</td>
                              <td className="py-2 text-right font-medium" style={{ color: riskColor }} aria-label={`Higher risk: ${higherRisk}`}>{higherRisk}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {/* Trend charts with two lines each */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Historical Trend Comparison (last 60 readings)
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { dataKeyA: "hrA",  dataKeyB: "hrB",  label: "Heart Rate (BPM)",  color: "hsl(0, 76%, 47%)",   goal: "Compare heart rate trajectories to detect if one worker is exerting significantly more effort" },
                      { dataKeyA: "tmpA", dataKeyB: "tmpB", label: "Temperature (°C)",  color: "hsl(45, 96%, 56%)",  goal: "Temperature divergence may indicate different environmental exposure or individual heat tolerance" },
                      { dataKeyA: "aqA",  dataKeyB: "aqB",  label: "Air Quality (AQI)", color: "hsl(122, 47%, 33%)", goal: "If AQI differs significantly between two workers in the same zone, investigate micro-environment positioning" },
                    ].map(chart => (
                      <Card key={chart.dataKeyA} aria-label={`${chart.label} trend comparison chart`} title={chart.goal}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{chart.label}</CardTitle>
                          <p className="text-[11px] text-muted-foreground">{chart.goal}</p>
                        </CardHeader>
                        <CardContent className="h-44">
                          {mergedTrendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={mergedTrendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="time" tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" />
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                <Legend
                                  wrapperStyle={{ fontSize: "10px" }}
                                  formatter={(value) => value === "A" ? workerAData.name.split(" ")[0] : workerBData.name.split(" ")[0]}
                                />
                                <Line type="monotone" dataKey={chart.dataKeyA} name="A" stroke={COMPARE_COLORS.A} strokeWidth={1.5} dot={false} connectNulls />
                                <Line type="monotone" dataKey={chart.dataKeyB} name="B" stroke={COMPARE_COLORS.B} strokeWidth={1.5} dot={false} connectNulls />
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
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Select two workers above to see their side-by-side comparison.
                </CardContent>
              </Card>
            )}

            {/* Zone comparison — always visible */}
            <Card aria-label="Zone risk comparison chart" title="Compare aggregate safety metrics across zones to identify which area carries the highest collective risk and should receive priority attention">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Zone Risk Comparison</CardTitle>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Average vitals and critical worker counts per zone — identify which zones carry the highest collective risk to prioritise resource allocation.
                </p>
              </CardHeader>
              <CardContent className="h-64">
                {zoneComparisonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={zoneComparisonData} barCategoryGap="25%" barGap={3}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        content={({ payload, label: lbl }) => {
                          const d = payload?.[0]?.payload;
                          if (!d) return null;
                          return (
                            <div className="rounded-lg border bg-card p-2 text-xs space-y-0.5">
                              <p className="font-medium">{d.fullName}</p>
                              <p>Workers: {d.workers}</p>
                              <p>Avg HR: {d.avgHR} BPM · Avg Temp: {d.avgTemp}°C · Avg AQ: {d.avgAQ}</p>
                              <p>Critical: {d.critical} · Warning: {d.warning}</p>
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="avgHR"   name="Avg HR (BPM)"       fill="hsl(0, 76%, 47%)"    radius={[4, 4, 0, 0]} />
                      <Bar dataKey="avgAQ"   name="Avg Air Quality"     fill="hsl(122, 47%, 33%)"  radius={[4, 4, 0, 0]} />
                      <Bar dataKey="critical" name="Critical Workers"   fill="hsl(28, 100%, 48%)"  radius={[4, 4, 0, 0]} />
                      <Bar dataKey="warning"  name="Warning Workers"    fill="hsl(45, 96%, 56%)"   radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No zone data available</div>
                )}
              </CardContent>
            </Card>

          </TabsContent>
        </Tabs>

      </div>
    </AppLayout>
  );
};

export default Analytics;
