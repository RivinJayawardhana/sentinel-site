import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMonitoringData } from "@/hooks/useMonitoringData";
import { CreateWorkerDialog } from "@/components/CreateWorkerDialog";

import { DeviceChangeDialog } from "@/components/DeviceChangeDialog";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Search, Users, Activity, AlertTriangle, ShieldAlert } from "lucide-react";

const statusColors: Record<string, string> = {
  normal: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  critical: "bg-critical text-critical-foreground",
};

const Workers = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useMonitoringData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const workers = data?.workers ?? [];

  const filtered = workers.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.id.toLowerCase().includes(search.toLowerCase()) ||
      w.role.toLowerCase().includes(search.toLowerCase()) ||
      w.deviceId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    total: workers.length,
    normal: workers.filter((w) => w.status === "normal").length,
    warning: workers.filter((w) => w.status === "warning").length,
    critical: workers.filter((w) => w.status === "critical").length,
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading workers...</div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          Failed to load workers.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Workers</h1>
            <p className="text-sm text-muted-foreground">{workers.length} registered workers</p>
          </div>
          <div className="flex gap-2">
            
            <CreateWorkerDialog />
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Workers", value: counts.total, icon: Users, color: "text-primary", bg: "bg-primary/10" },
            { label: "Normal", value: counts.normal, icon: Activity, color: "text-success", bg: "bg-success/10" },
            { label: "Warning", value: counts.warning, icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
            { label: "Critical", value: counts.critical, icon: ShieldAlert, color: "text-critical", bg: "bg-critical/10" },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-lg p-2.5 ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters + Table */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">All Workers</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, role, device..."
                  className="pl-9 w-72 h-9 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                {["all", "normal", "warning", "critical"].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={statusFilter === s ? "default" : "outline"}
                    className="h-9 text-xs capitalize"
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "all" ? "All" : s}
                  </Button>
                ))}
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
                  <TableHead>Device ID</TableHead>
                  <TableHead>Heart Rate</TableHead>
                  <TableHead>Temp</TableHead>
                  <TableHead>AQI</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-10">
                      No workers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell
                        className="cursor-pointer font-medium hover:underline"
                        onClick={() => navigate(`/workers/${w.id}`)}
                      >
                        {w.name}
                        <br />
                        <span className="text-xs text-muted-foreground font-normal">{w.id}</span>
                      </TableCell>
                      <TableCell className="text-sm">{w.role}</TableCell>
                      <TableCell className="text-sm">{w.zone}</TableCell>
                      <TableCell className="text-sm">{w.shift}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{w.deviceId}</TableCell>
                      <TableCell className="text-sm">{w.heartRate} BPM</TableCell>
                      <TableCell className="text-sm">{w.temperature}°C</TableCell>
                      <TableCell className="text-sm">{w.airQuality}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[w.status]}>
                          {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <DeviceChangeDialog
                            employeeId={w.id}
                            currentDeviceId={w.deviceId}
                            employeeName={w.name}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => navigate(`/workers/${w.id}`)}
                          >
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Workers;
