import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DEFAULT_EMPLOYEE_ID, useMonitoringData, useUpdateAlertStatus } from "@/hooks/useMonitoringData";
import { useMLAlerts } from "@/context/MLAlertContext";
import type { Alert } from "@/types/monitoring";
import { useState, useMemo } from "react";
import { CheckCircle, ArrowUpCircle, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const severityColors: Record<string, string> = {
  low:      "bg-muted text-muted-foreground",
  medium:   "bg-warning/20 text-warning-foreground border-warning/30",
  high:     "bg-primary/20 text-primary border-primary/30",
  critical: "bg-critical text-critical-foreground",
};

const statusColors: Record<string, string> = {
  active:       "bg-critical text-critical-foreground",
  acknowledged: "bg-warning text-warning-foreground",
  resolved:     "bg-success text-success-foreground",
};

const AlertsCenter = () => {
  const employeeId = DEFAULT_EMPLOYEE_ID;
  const { data, isLoading, error } = useMonitoringData();
  const { mlAlerts, updateMLAlertStatus } = useMLAlerts();
  const updateAlertStatusMutation = useUpdateAlertStatus(employeeId);
  const { toast } = useToast();

  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [typeFilter,     setTypeFilter]     = useState("all");
  const [selectedAlert,  setSelectedAlert]  = useState<Alert | null>(null);

  // Merge ML alerts (newest first) with backend alerts
  const allAlerts = useMemo<Alert[]>(() => {
    const backend = data?.alerts ?? [];
    return [...mlAlerts, ...backend].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [data?.alerts, mlAlerts]);

  const filtered = allAlerts.filter(a => {
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    if (statusFilter   !== "all" && a.status   !== statusFilter)   return false;
    if (typeFilter     !== "all" && a.type     !== typeFilter)     return false;
    return true;
  });

  const mlCount     = allAlerts.filter(a => a.source === "ml"      && a.status === "active").length;
  const activeCount = allAlerts.filter(a => a.status === "active").length;

  const handleAlertStatusChange = async (status: "active" | "acknowledged" | "resolved") => {
    if (!selectedAlert) return;

    // ML alerts are managed locally — no backend call needed
    if (selectedAlert.source === "ml") {
      updateMLAlertStatus(selectedAlert.id, status);
      setSelectedAlert({ ...selectedAlert, status });
      toast({ title: "Alert updated", description: `Alert marked as ${status}.` });
      return;
    }

    try {
      await updateAlertStatusMutation.mutateAsync({ alertId: selectedAlert.id, status });
      setSelectedAlert({ ...selectedAlert, status });
      toast({ title: "Alert updated", description: `Alert marked as ${status}.` });
    } catch {
      toast({ title: "Update failed", description: "Could not update alert status.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <AppLayout><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading alerts...</div></AppLayout>;
  }

  if (error) {
    return <AppLayout><div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">Failed to load alerts.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Summary row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{activeCount} active alerts</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Brain className="h-3.5 w-3.5 text-primary" />
            {mlCount} from ML engine
          </span>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Alerts Management</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="heart_rate">Heart Rate</SelectItem>
                  <SelectItem value="temperature">Temperature</SelectItem>
                  <SelectItem value="air_quality">Air Quality</SelectItem>
                  <SelectItem value="anomaly">Anomaly (ML)</SelectItem>
                  <SelectItem value="trend">Trend (ML)</SelectItem>
                  <SelectItem value="zone_breach">Zone Breach</SelectItem>
                  <SelectItem value="device_offline">Device Offline</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>

            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => setSelectedAlert(a)}>
                    <TableCell className="font-medium">
                      {a.workerName}
                      <br />
                      <span className="text-xs text-muted-foreground">{a.workerId}</span>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{a.type.replace("_", " ")}</span>
                      {a.source === "ml" && (
                        <Badge className="ml-1.5 text-[10px] py-0 px-1 bg-primary/20 text-primary border border-primary/30">
                          ML
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={severityColors[a.severity]}>{a.severity.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(a.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{a.zone}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[a.status]}>{a.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No alerts match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Alert Detail Drawer */}
        <Sheet open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
          <SheetContent className="w-[420px]">
            {selectedAlert && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    Alert Detail
                    {selectedAlert.source === "ml" && (
                      <Badge className="text-[10px] py-0 px-1.5 bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                        <Brain className="h-3 w-3" /> ML Generated
                      </Badge>
                    )}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div className="space-y-3">
                    {[
                      { label: "Alert ID",  value: selectedAlert.id },
                      { label: "Worker",    value: selectedAlert.workerName },
                      { label: "Type",      value: <span className="capitalize">{selectedAlert.type.replace("_", " ")}</span> },
                      { label: "Severity",  value: <Badge className={severityColors[selectedAlert.severity]}>{selectedAlert.severity.toUpperCase()}</Badge> },
                      { label: "Zone",      value: selectedAlert.zone },
                      { label: "Status",    value: <Badge className={statusColors[selectedAlert.status]}>{selectedAlert.status}</Badge> },
                      { label: "Time",      value: new Date(selectedAlert.timestamp).toLocaleString() },
                      ...(selectedAlert.anomalyScore != null ? [{ label: "Anomaly Score", value: selectedAlert.anomalyScore.toFixed(4) }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm">{selectedAlert.message}</p>
                  </div>
                  <div className="space-y-2">
                    <Button
                      className="w-full gap-2" variant="outline"
                      disabled={updateAlertStatusMutation.isPending || selectedAlert.status === "acknowledged"}
                      onClick={() => handleAlertStatusChange("acknowledged")}
                    >
                      <CheckCircle className="h-4 w-4" /> Acknowledge
                    </Button>
                    <Button
                      className="w-full gap-2 bg-success text-success-foreground hover:bg-success/90"
                      disabled={updateAlertStatusMutation.isPending || selectedAlert.status === "resolved"}
                      onClick={() => handleAlertStatusChange("resolved")}
                    >
                      <CheckCircle className="h-4 w-4" /> Resolve
                    </Button>
                    <Button
                      className="w-full gap-2 bg-critical text-critical-foreground hover:bg-critical/90"
                      disabled={updateAlertStatusMutation.isPending || selectedAlert.status === "active"}
                      onClick={() => handleAlertStatusChange("active")}
                    >
                      <ArrowUpCircle className="h-4 w-4" /> Escalate
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

      </div>
    </AppLayout>
  );
};

export default AlertsCenter;
