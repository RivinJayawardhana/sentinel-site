import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { workers, generateTimeSeries } from "@/data/mockData";
import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Search, Heart, Thermometer, Wind, Radio } from "lucide-react";

const statusColors: Record<string, string> = {
  normal: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  critical: "bg-critical text-critical-foreground",
};

const LiveMonitoring = () => {
  const [selectedId, setSelectedId] = useState(workers[0].id);
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const selected = workers.find((w) => w.id === selectedId)!;
  const timeSeries = useMemo(
    () => generateTimeSeries(selected.heartRate, selected.temperature, selected.airQuality),
    [selectedId]
  );

  const filteredWorkers = workers.filter(
    (w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
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
