import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DEFAULT_EMPLOYEE_ID, useMonitoringData, useUpdateAlertStatus } from "@/hooks/useMonitoringData";
import type { Alert } from "@/types/monitoring";
import { useState } from "react";
import { CheckCircle, ArrowUpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const severityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/20 text-warning-foreground border-warning/30",
  high: "bg-primary/20 text-primary border-primary/30",
  critical: "bg-critical text-critical-foreground",
};

const statusColors: Record<string, string> = {
  active: "bg-critical text-critical-foreground",
  acknowledged: "bg-warning text-warning-foreground",
  resolved: "bg-success text-success-foreground",
};

const AlertsCenter = () => {
  const employeeId = DEFAULT_EMPLOYEE_ID;
  const { data, isLoading, error } = useMonitoringData();
  const updateAlertStatusMutation = useUpdateAlertStatus(employeeId);
  const { toast } = useToast();
  const alerts = data?.alerts ?? [];
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const filtered = alerts.filter((a) => {
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const handleAlertStatusChange = async (status: "active" | "acknowledged" | "resolved") => {
    if (!selectedAlert) return;
    try {
      await updateAlertStatusMutation.mutateAsync({ alertId: selectedAlert.id, status });
      setSelectedAlert({ ...selectedAlert, status });
      toast({ title: "Alert updated", description: `Alert marked as ${status}.` });
    } catch {
      toast({
        title: "Update failed",
        description: "Could not update alert status.",
        variant: "destructive",
      });
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
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Alerts Management</CardTitle>
            <div className="flex items-center gap-3">
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
                {filtered.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => setSelectedAlert(a)}>
                    <TableCell className="font-medium">{a.workerName}<br/><span className="text-xs text-muted-foreground">{a.workerId}</span></TableCell>
                    <TableCell className="capitalize">{a.type.replace("_", " ")}</TableCell>
                    <TableCell><Badge className={severityColors[a.severity]}>{a.severity.toUpperCase()}</Badge></TableCell>
                    <TableCell className="text-sm">{new Date(a.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{a.zone}</TableCell>
                    <TableCell><Badge className={statusColors[a.status]}>{a.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Alert Detail Drawer */}
        <Sheet open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
          <SheetContent className="w-[400px]">
            {selectedAlert && (
              <>
                <SheetHeader>
                  <SheetTitle>Alert Detail</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Alert ID</span>
                      <span className="text-sm font-medium">{selectedAlert.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Worker</span>
                      <span className="text-sm font-medium">{selectedAlert.workerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Type</span>
                      <span className="text-sm font-medium capitalize">{selectedAlert.type.replace("_", " ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Severity</span>
                      <Badge className={severityColors[selectedAlert.severity]}>{selectedAlert.severity.toUpperCase()}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Zone</span>
                      <span className="text-sm font-medium">{selectedAlert.zone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge className={statusColors[selectedAlert.status]}>{selectedAlert.status}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Time</span>
                      <span className="text-sm">{new Date(selectedAlert.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm">{selectedAlert.message}</p>
                  </div>
                  <div className="space-y-2">
                    <Button
                      className="w-full gap-2"
                      variant="outline"
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
