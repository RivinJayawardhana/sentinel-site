import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMonitoringData, useIoTData } from "@/hooks/useMonitoringData";
import { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Search, Heart, Thermometer, Wind, Radio, MapPin } from "lucide-react";

const statusColors: Record<string, string> = {
  normal: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  critical: "bg-critical text-critical-foreground",
};

const MAX_HISTORY = 20;

const LiveMonitoring = () => {
  const { data, isLoading, error } = useMonitoringData();
  const { data: iot } = useIoTData();
  const workers = data?.workers ?? [];

  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const iotHistory = useRef<Array<{ time: string; temperature: number; air_quality: number; heart_rate: number }>>([]);
  const [iotChart, setIotChart] = useState(iotHistory.current);

  useEffect(() => {
    if (!iot) return;
    const point = {
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      temperature: iot.temperature,
      air_quality: iot.air_quality,
      heart_rate: iot.heart_rate,
    };
    iotHistory.current = [...iotHistory.current.slice(-(MAX_HISTORY - 1)), point];
    setIotChart([...iotHistory.current]);
  }, [iot]);

  useEffect(() => {
    if (!selectedId && workers.length > 0) {
      setSelectedId(workers[0].id);
    }
  }, [workers, selectedId]);

  const selected = workers.find((w) => w.id === selectedId) ?? workers[0];
  const timeSeries = data?.timeSeries ?? [];

  const filteredWorkers = workers.filter(
    (w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.id.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading live telemetry...</div>
      </AppLayout>
    );
  }

  if (error || !selected) {
    return (
      <AppLayout>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          Failed to load live monitoring data.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* IoT Live Sensor Strip */}
      {iot && (
        <div className="mb-5 grid grid-cols-5 gap-3">
          <div className="col-span-5 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
            Live Sensor — Device {iot.id}
          </div>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-warning/10 p-2.5"><Thermometer className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-2xl font-bold">{iot.temperature.toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-1">°C</span></p>
                <p className="text-xs text-muted-foreground">Temperature</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-success/10 p-2.5"><Wind className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-2xl font-bold">{iot.air_quality.toFixed(0)}<span className="text-xs font-normal text-muted-foreground ml-1">AQI</span></p>
                <p className="text-xs text-muted-foreground">Air Quality</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-critical/10 p-2.5"><Heart className="h-5 w-5 text-critical" /></div>
              <div>
                <p className="text-2xl font-bold">{iot.heart_rate.toFixed(0)}<span className="text-xs font-normal text-muted-foreground ml-1">BPM</span></p>
                <p className="text-xs text-muted-foreground">Heart Rate</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-muted p-2.5"><MapPin className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <p className="text-sm font-bold">{iot.latitude.toFixed(4)}, {iot.longitude.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">GPS (lat, lon)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="p-4 h-full flex flex-col justify-center">
              <p className="text-xs text-muted-foreground mb-1">Refreshes every 5s</p>
              <p className="text-xs font-mono text-muted-foreground">ID: {iot.id}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* IoT Chart */}
      {iotChart.length > 1 && (
        <Card className="mb-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Live Sensor History</CardTitle>
          </CardHeader>
          <CardContent className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={iotChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                <Line type="monotone" dataKey="temperature" stroke="hsl(45, 96%, 56%)" strokeWidth={2} dot={false} name="Temp °C" />
                <Line type="monotone" dataKey="air_quality" stroke="hsl(122, 47%, 33%)" strokeWidth={2} dot={false} name="AQI" />
                <Line type="monotone" dataKey="heart_rate" stroke="hsl(0, 76%, 47%)" strokeWidth={2} dot={false} name="Heart Rate BPM" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
        {/* Left Panel - Worker List */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workers..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-auto space-y-1.5 pr-1">
            {filteredWorkers.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                  selectedId === w.id ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                }`}
              >
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  w.status === "normal" ? "bg-success" : w.status === "warning" ? "bg-warning" : "bg-critical"
                }`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{w.name}</p>
                  <p className={`text-xs ${selectedId === w.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {w.id} · {w.zone}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Center Panel - Live Data */}
        <div className="col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">{selected.name}</h2>
              <p className="text-sm text-muted-foreground">{selected.role} · {selected.zone}</p>
            </div>
            <Badge className={statusColors[selected.status]}>
              {selected.status.toUpperCase()}
            </Badge>
          </div>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-critical/10 p-3">
                <Heart className="h-6 w-6 text-critical" />
              </div>
              <div>
                <p className="text-3xl font-bold">{selected.heartRate} <span className="text-sm font-normal text-muted-foreground">BPM</span></p>
                <p className="text-xs text-muted-foreground">Heart Rate</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-warning/10 p-3">
                <Thermometer className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-3xl font-bold">{selected.temperature} <span className="text-sm font-normal text-muted-foreground">°C</span></p>
                <p className="text-xs text-muted-foreground">Body Temperature</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-success/10 p-3">
                <Wind className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-3xl font-bold">{selected.airQuality} <span className="text-sm font-normal text-muted-foreground">AQI</span></p>
                <p className="text-xs text-muted-foreground">Air Quality Index</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto-refresh" />
            <Label htmlFor="auto-refresh" className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5" />
              Auto-refresh
            </Label>
          </div>
        </div>

        {/* Right Panel - Chart */}
        <div className="col-span-5 space-y-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Real-Time Vitals (Last 10 min)</CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-4rem)]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line type="monotone" dataKey="heartRate" stroke="hsl(0, 76%, 47%)" strokeWidth={2} dot={false} name="Heart Rate" />
                  <Line type="monotone" dataKey="temperature" stroke="hsl(45, 96%, 56%)" strokeWidth={2} dot={false} name="Temperature" />
                  <Line type="monotone" dataKey="airQuality" stroke="hsl(122, 47%, 33%)" strokeWidth={2} dot={false} name="Air Quality" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default LiveMonitoring;
