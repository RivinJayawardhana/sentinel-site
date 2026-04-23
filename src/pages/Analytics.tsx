import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMonitoringData } from "@/hooks/useMonitoringData";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush,
} from "recharts";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";

const Analytics = () => {
  const { data, isLoading, error } = useMonitoringData();
  const workers = data?.workers ?? [];
  const zones = data?.zones ?? [];
  const alerts = data?.alerts ?? [];
  const hrTrend = data?.timeSeries ?? [];

  const [timeRange, setTimeRange] = useState("7d");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [brushRange, setBrushRange] = useState<{ startIndex?: number; endIndex?: number }>({});

  const rangeDays = timeRange === "24h" ? 1 : timeRange === "30d" ? 30 : 7;

  const workerById = useMemo(() => {
    const map = new Map<string, (typeof workers)[number]>();
    for (const worker of workers) {
      map.set(worker.id, worker);
    }
    return map;
  }, [workers]);

  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      if (workerFilter !== "all" && w.id !== workerFilter) return false;
      if (zoneFilter !== "all" && w.zone !== zoneFilter) return false;
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      return true;
    });
  }, [workers, workerFilter, zoneFilter, statusFilter]);

  const filteredWorkerIds = useMemo(() => new Set(filteredWorkers.map((w) => w.id)), [filteredWorkers]);

  const filteredAlerts = useMemo(() => {
    const now = Date.now();
    const cutoff = now - rangeDays * 24 * 60 * 60 * 1000;

    return alerts.filter((a) => {
      const alertTs = new Date(a.timestamp).getTime();
      if (!Number.isFinite(alertTs) || alertTs < cutoff) return false;
      if (workerFilter !== "all" && a.workerId !== workerFilter) return false;
      if (zoneFilter !== "all" && a.zone !== zoneFilter) return false;
      if (statusFilter !== "all") {
        const workerStatus = workerById.get(a.workerId)?.status;
        if (workerStatus !== statusFilter) return false;
      }
      if (!filteredWorkerIds.has(a.workerId)) return false;
      return true;
    });
  }, [alerts, filteredWorkerIds, rangeDays, statusFilter, workerById, workerFilter, zoneFilter]);

  const visibleTrendBase = useMemo(() => {
    const now = Date.now();
    const cutoff = now - rangeDays * 24 * 60 * 60 * 1000;

    const withTs = hrTrend
      .map((p) => ({ ...p, _ts: new Date(p.timestamp).getTime() }))
      .filter((p) => Number.isFinite(p._ts));

    const filtered = withTs.filter((p) => p._ts >= cutoff);
    const source = filtered.length > 0 ? filtered : withTs;

    return source
      .sort((a, b) => a._ts - b._ts)
      .map(({ _ts, ...rest }) => rest);
  }, [hrTrend, timeRange]);

  const visibleTrend = useMemo(() => {
    const start = brushRange.startIndex ?? 0;
    const end = brushRange.endIndex ?? Math.max(visibleTrendBase.length - 1, 0);
    return visibleTrendBase.slice(start, end + 1);
  }, [visibleTrendBase, brushRange]);

  const visibleDailyAlerts = useMemo(() => {
    const now = new Date();

    if (timeRange === "24h") {
      const buckets = Array.from({ length: 24 }, (_, i) => {
        const d = new Date(now);
        d.setHours(now.getHours() - (23 - i), 0, 0, 0);
        return {
          key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`,
          day: d.toLocaleTimeString("en-US", { hour: "2-digit" }),
          alerts: 0,
        };
      });

      const byKey = new Map(buckets.map((b) => [b.key, b]));
      for (const alert of filteredAlerts) {
        const d = new Date(alert.timestamp);
        d.setMinutes(0, 0, 0);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
        const bucket = byKey.get(key);
        if (bucket) bucket.alerts += 1;
      }
      return buckets;
    }

    const bucketCount = timeRange === "30d" ? 30 : 7;
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (bucketCount - 1 - i));
      d.setHours(0, 0, 0, 0);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
        day: timeRange === "30d"
          ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : d.toLocaleDateString("en-US", { weekday: "short" }),
        alerts: 0,
      };
    });

    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const alert of filteredAlerts) {
      const d = new Date(alert.timestamp);
      d.setHours(0, 0, 0, 0);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const bucket = byKey.get(key);
      if (bucket) bucket.alerts += 1;
    }

    return buckets;
  }, [filteredAlerts, timeRange]);

  const linkedRiskDistribution = useMemo(() => {
    const counts = {
      normal: filteredWorkers.filter((w) => w.status === "normal").length,
      warning: filteredWorkers.filter((w) => w.status === "warning").length,
      critical: filteredWorkers.filter((w) => w.status === "critical").length,
    };
    return [
      { name: "Normal", value: counts.normal, fill: "hsl(122, 47%, 33%)" },
      { name: "Warning", value: counts.warning, fill: "hsl(45, 96%, 56%)" },
      { name: "Critical", value: counts.critical, fill: "hsl(0, 76%, 47%)" },
    ];
  }, [filteredWorkers]);

  const scatterData = filteredWorkers.map((w) => ({
    id: w.id,
    zone: w.zone,
    status: w.status,
    temperature: w.temperature,
    heartRate: w.heartRate,
    name: w.name,
  }));

  const handleExport = () => {
    const csv = "Worker,Heart Rate,Temperature,Air Quality,Status,Zone\n" +
      filteredWorkers.map((w) => `${w.name},${w.heartRate},${w.temperature},${w.airQuality},${w.status},${w.zone}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "safety-report.csv";
    a.click();
  };

  const clearFilters = () => {
    setTimeRange("7d");
    setWorkerFilter("all");
    setZoneFilter("all");
    setStatusFilter("all");
    setBrushRange({});
  };

  if (isLoading) {
    return <AppLayout><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading analytics...</div></AppLayout>;
  }

  if (error) {
    return <AppLayout><div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">Failed to load analytics.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workers</SelectItem>
                {workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((z) => <SelectItem key={z.name} value={z.name}>{z.name}</SelectItem>)}
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
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Heart Rate Trends</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visibleTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                    labelFormatter={(_label: string, payload: Array<{ payload: { timestamp?: string; date?: string; time?: string } }>) => {
                      const point = payload?.[0]?.payload;
                      if (point?.timestamp) {
                        return new Date(point.timestamp).toLocaleString();
                      }
                      if (point?.date && point?.time) {
                        return `${point.date} ${point.time}`;
                      }
                      return String(_label ?? "");
                    }}
                  />
                  <Line type="monotone" dataKey="heartRate" stroke="hsl(0, 76%, 47%)" strokeWidth={2} dot={false} />
                  <Brush
                    dataKey="time"
                    height={20}
                    stroke="hsl(28, 100%, 48%)"
                    onChange={(range) => setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex })}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Alerts Per Day</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visibleDailyAlerts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                  <Bar dataKey="alerts" fill="hsl(28, 100%, 48%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Risk Distribution</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={linkedRiskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    onClick={(entry) => {
                      const key = String(entry.name).toLowerCase();
                      setStatusFilter(statusFilter === key ? "all" : key);
                    }}
                  >
                    {linkedRiskDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Temperature vs Heart Rate</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="temperature" name="Temp (°C)" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="heartRate" name="HR (BPM)" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter
                    data={scatterData}
                    fill="hsl(28, 100%, 48%)"
                    onClick={(point: any) => {
                      if (point?.id) setWorkerFilter(point.id);
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Drill-down comparative table */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Comparative Worker View</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2">Worker</th>
                    <th className="text-left py-2">Zone</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-right py-2">Heart Rate</th>
                    <th className="text-right py-2">Temperature</th>
                    <th className="text-right py-2">Air Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkers.map((w) => (
                    <tr key={w.id} className="border-b last:border-0">
                      <td className="py-2">{w.name}</td>
                      <td className="py-2">{w.zone}</td>
                      <td className="py-2">{w.status}</td>
                      <td className="py-2 text-right">{w.heartRate}</td>
                      <td className="py-2 text-right">{w.temperature}</td>
                      <td className="py-2 text-right">{w.airQuality}</td>
                    </tr>
                  ))}
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
