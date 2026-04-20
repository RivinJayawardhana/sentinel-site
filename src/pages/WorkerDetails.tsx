import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMonitoringData } from "@/hooks/useMonitoringData";
import { useParams, useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Heart, Thermometer, Wind, MapPin, ArrowLeft, CheckCircle, MessageSquare, AlertTriangle } from "lucide-react";
import { DeviceChangeDialog } from "@/components/DeviceChangeDialog";

const statusColors: Record<string, string> = {
  normal: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  critical: "bg-critical text-critical-foreground",
};

const WorkerDetails = () => {
  const { data, isLoading, error } = useMonitoringData();
  const { id } = useParams();
  const navigate = useNavigate();
  const workers = data?.workers ?? [];
  const alerts = data?.alerts ?? [];
  const worker = workers.find((w) => w.id === id);
  const workerAlerts = alerts.filter((a) => a.workerId === id);
  const timeSeries = data?.timeSeries ?? [];

  if (isLoading) {
    return <AppLayout><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading worker details...</div></AppLayout>;
  }

  if (error) {
    return <AppLayout><div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">Failed to load worker details.</div></AppLayout>;
  }

  if (!worker) {
    return <AppLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Worker not found</p></div></AppLayout>;
  }

  const metrics = [
    { label: "Heart Rate", value: `${worker.heartRate} BPM`, icon: Heart, color: "text-critical", bg: "bg-critical/10" },
    { label: "Temperature", value: `${worker.temperature}°C`, icon: Thermometer, color: "text-warning", bg: "bg-warning/10" },
    { label: "Air Quality", value: `${worker.airQuality} AQI`, icon: Wind, color: "text-success", bg: "bg-success/10" },
    { label: "Location", value: worker.zone, icon: MapPin, color: "text-primary", bg: "bg-primary/10" },
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
                <p className="text-sm text-muted-foreground">{worker.role} · {worker.shift} Shift · Device: {worker.deviceId}</p>
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

        {/* Charts */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: "heartRate" as const, label: "Heart Rate Trend", color: "hsl(0, 76%, 47%)" },
            { key: "temperature" as const, label: "Temperature Trend", color: "hsl(45, 96%, 56%)" },
            { key: "airQuality" as const, label: "Air Quality Trend", color: "hsl(122, 47%, 33%)" },
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
                      <div>
                        <p className="text-sm font-medium">{a.message}</p>
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
