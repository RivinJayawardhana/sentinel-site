import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { workers, dailyAlertData, riskDistribution, generateTimeSeries } from "@/data/mockData";
import { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Download } from "lucide-react";

const Analytics = () => {
  const hrTrend = useMemo(() => generateTimeSeries(80, 36.8, 85), []);

  const scatterData = workers.map((w) => ({
    temperature: w.temperature,
    heartRate: w.heartRate,
    name: w.name,
  }));

  const handleExport = () => {
    const csv = "Worker,Heart Rate,Temperature,Air Quality,Status,Zone\n" +
      workers.map((w) => `${w.name},${w.heartRate},${w.temperature},${w.airQuality},${w.status},${w.zone}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "safety-report.csv";
    a.click();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <Select defaultValue="7d">
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workers</SelectItem>
                {workers.slice(0, 5).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                <SelectItem value="Zone A">Zone A</SelectItem>
                <SelectItem value="Zone B">Zone B</SelectItem>
                <SelectItem value="Zone C">Zone C</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Heart Rate Trends</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hrTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                  <Line type="monotone" dataKey="heartRate" stroke="hsl(0, 76%, 47%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Alerts Per Day</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyAlertData}>
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
                  <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {riskDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
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
                  <Scatter data={scatterData} fill="hsl(28, 100%, 48%)" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Analytics;
