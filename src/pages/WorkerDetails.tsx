import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_EMPLOYEE_ID, useEmployeeHistory, useMonitoringData } from "@/hooks/useMonitoringData";
import { useMLAlerts } from "@/context/MLAlertContext";
import { useParams, useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import { Heart, Thermometer, Wind, MapPin, ArrowLeft, CheckCircle, MessageSquare, AlertTriangle, Brain, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { DeviceChangeDialog } from "@/components/DeviceChangeDialog";
import { cn } from "@/lib/utils";
import type { TrendDirection } from "@/hooks/useMLAlertEngine";

const statusColors: Record<string, string> = {
  normal:   "bg-success text-success-foreground",
  warning:  "bg-warning text-warning-foreground",
  critical: "bg-critical text-critical-foreground",
};

function clusterBadgeClass(cluster: string) {
  if (cluster.includes("Low"))  return "bg-success/20 text-success border border-success/30";
  if (cluster.includes("High")) return "bg-critical/20 text-critical border border-critical/30";
  return "bg-warning/20 text-warning-foreground border border-warning/30";
}

function TrendIcon({ dir }: { dir: TrendDirection }) {
  if (dir === "rising")  return <TrendingUp  className="h-3.5 w-3.5 text-critical" />;
  if (dir === "falling") return <TrendingDown className="h-3.5 w-3.5 text-warning"  />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

const WorkerDetails = () => {
  const { id } = useParams();
  const employeeId = id ?? DEFAULT_EMPLOYEE_ID;
  const { data, isLoading, error } = useMonitoringData(employeeId);
  const { data: history }          = useEmployeeHistory(employeeId, 120);
  const { allAlerts, workerSnapshots } = useMLAlerts();
  const snapshot                       = workerSnapshots.get(employeeId) ?? null;
  const navigate = useNavigate();

  const workers = data?.workers ?? [];
  const alerts  = data?.alerts  ?? [];
  const worker  = workers.find((w) => w.id === id);

  // Combine backend alerts + client-side alerts for this worker
  const clientAlerts   = allAlerts.filter(a => a.workerId === id);
  const backendAlerts  = alerts.filter(a => a.workerId === id);
  const workerAlerts   = [...clientAlerts, ...backendAlerts]
    .reduce<typeof clientAlerts>((acc, a) => {
      if (!acc.find(x => x.id === a.id)) acc.push(a);
      return acc;
    }, [])
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const timeSeries = useMemo(() => {
    if (!history || history.length === 0) return data?.timeSeries ?? [];
    const sorted = [...history].sort((a, b) => a.ts - b.ts).slice(-60);
    return sorted.map((p) => ({
      time:        new Date(p.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      heartRate:   p.heartRate ?? 0,
      temperature: p.temperature,
      airQuality:  p.airQuality,
    }));
  }, [history, data?.timeSeries]);

  if (isLoading) {
    return <AppLayout><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading worker details...</div></AppLayout>;
  }

  if (error) {
    return <AppLayout><div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">Failed to load worker details.</div></AppLayout>;
  }

  if (!worker) {
    return <AppLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Worker not found</p></div></AppLayout>;
  }

  const latest  = history && history.length > 0 ? history[0] : undefined;
  const liveTmp = latest ? latest.temperature : worker.temperature;
  const liveAQ  = latest ? latest.airQuality  : worker.airQuality;
  const liveHR  = latest ? `${latest.heartRate ?? 0} BPM` : (worker.heartRate > 0 ? `${worker.heartRate} BPM` : "N/A");
  const liveGps = worker.zone;

  const metrics = [
    { label: "Heart Rate",  value: liveHR,           icon: Heart,       color: "text-critical", bg: "bg-critical/10" },
    { label: "Temperature", value: `${liveTmp}°C`,   icon: Thermometer, color: "text-warning",  bg: "bg-warning/10"  },
    { label: "Air Quality", value: `${liveAQ} AQI`,  icon: Wind,        color: "text-success",  bg: "bg-success/10"  },
    { label: "Location",    value: liveGps,          icon: MapPin,      color: "text-primary",  bg: "bg-primary/10"  },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Profile Card */}
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                {worker.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <h2 className="text-xl font-bold">{worker.name}</h2>
                <p className="text-sm text-muted-foreground">{worker.role} · {worker.shift} Shift · Device: {worker.deviceId?.trim() ? worker.deviceId : "None"}</p>
              </div>
            </div>
            <Badge className={`${statusColors[worker.status]} text-sm px-3 py-1`}>
              {worker.status.toUpperCase()}
            </Badge>
          </CardContent>
        </Card>

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          {metrics.map((m) => (
            <Card key={m.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-lg p-3 ${m.bg}`}>
                  <m.icon className={`h-5 w-5 ${m.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Per-Worker ML Analysis */}
        {snapshot ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  ML Analysis — {worker.name}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  Updated {snapshot.lastUpdated.toLocaleTimeString()}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
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
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sensor Trends</p>
                  <div className="space-y-1.5">
                    {([
                      { label: "Heart Rate",  dir: snapshot.trends.hr.direction,   slope: snapshot.trends.hr.slope   },
                      { label: "Temperature", dir: snapshot.trends.temp.direction,  slope: snapshot.trends.temp.slope },
                      { label: "Air Quality", dir: snapshot.trends.aq.direction,   slope: snapshot.trends.aq.slope   },
                    ] as Array<{ label: string; dir: TrendDirection; slope: number }>).map(({ label, dir, slope }) => (
                      <div key={label} className="flex items-center gap-2 text-xs">
                        <TrendIcon dir={dir} />
                        <span className="text-muted-foreground w-20">{label}:</span>
                        <span className={cn(
                          dir === "rising"  ? "text-critical" :
                          dir === "falling" ? "text-warning"  : "text-muted-foreground",
                        )}>
                          {dir} ({slope >= 0 ? "+" : ""}{slope.toFixed(3)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Correlations</p>
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
          history && history.length >= 3 ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                <Brain className="h-4 w-4 text-primary animate-pulse" />
                ML engine initialising for {worker.name}...
              </CardContent>
            </Card>
          ) : null
        )}

        {/* Charts */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: "heartRate"   as const, label: "Heart Rate Trend",   color: "hsl(0, 76%, 47%)"   },
            { key: "temperature" as const, label: "Temperature Trend",  color: "hsl(45, 96%, 56%)"  },
            { key: "airQuality"  as const, label: "Air Quality Trend",  color: "hsl(122, 47%, 33%)" },
          ].map((chart) => (
            <Card key={chart.key}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{chart.label}</CardTitle></CardHeader>
              <CardContent className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                    <Line type="monotone" dataKey={chart.key} stroke={chart.color} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alerts Timeline + Actions */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2">
            <CardHeader><CardTitle className="text-base">Alert Timeline</CardTitle></CardHeader>
            <CardContent>
              {workerAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No alerts for this worker</p>
              ) : (
                <div className="space-y-3">
                  {workerAlerts.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${a.severity === "critical" ? "text-critical" : a.severity === "high" ? "text-warning" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium">{a.message}</p>
                          {a.source === "ml" && (
                            <Badge className="text-[10px] py-0 px-1 bg-primary/20 text-primary border border-primary/30">ML</Badge>
                          )}
                          {a.source === "threshold" && (
                            <Badge className="text-[10px] py-0 px-1 bg-warning/20 text-warning-foreground border border-warning/30">THR</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(a.timestamp).toLocaleString()} · {a.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DeviceChangeDialog
                employeeId={worker.id}
                currentDeviceId={worker.deviceId}
                employeeName={worker.name}
              />
              <Button className="w-full justify-start gap-2" variant="outline"><CheckCircle className="h-4 w-4" /> Acknowledge Alert</Button>
              <Button className="w-full justify-start gap-2" variant="outline"><MessageSquare className="h-4 w-4" /> Add Note</Button>
              <Button className="w-full justify-start gap-2 bg-critical text-critical-foreground hover:bg-critical/90"><AlertTriangle className="h-4 w-4" /> Escalate</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default WorkerDetails;
