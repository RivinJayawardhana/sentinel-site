import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMonitoringData, useUpdateThresholds } from "@/hooks/useMonitoringData";
import { useEffect, useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeviceChangeDialog } from "@/components/DeviceChangeDialog";
import { CreateWorkerDialog } from "@/components/CreateWorkerDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const { toast } = useToast();
  const { data, isLoading, error } = useMonitoringData();
  const saveThresholds = useUpdateThresholds();

  const [hrMax, setHrMax] = useState("100");
  const [hrCritical, setHrCritical] = useState("120");
  const [tempMax, setTempMax] = useState("37.5");
  const [tempCritical, setTempCritical] = useState("38.0");
  const [aqMin, setAqMin] = useState("70");
  const [aqCritical, setAqCritical] = useState("50");

  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
    criticalOnly: false,
  });

  const thresholds = data?.thresholds;
  const zones = data?.zones ?? [];
  const workers = data?.workers ?? [];
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!thresholds) {
      return;
    }
    setHrMax(String(thresholds.heartRate.max));
    setHrCritical(String(thresholds.heartRate.criticalMax));
    setTempMax(String(thresholds.temperature.max));
    setTempCritical(String(thresholds.temperature.criticalMax));
    setAqMin(String(thresholds.airQuality.min));
    setAqCritical(String(thresholds.airQuality.criticalMin));
  }, [thresholds]);

  const handleSave = async () => {
    try {
      await saveThresholds.mutateAsync({
        heartRate: { min: 60, max: Number(hrMax), criticalMax: Number(hrCritical) },
        temperature: { min: 35.5, max: Number(tempMax), criticalMax: Number(tempCritical) },
        airQuality: { min: Number(aqMin), criticalMin: Number(aqCritical) },
      });
      toast({ title: "Settings saved", description: "Threshold configurations updated successfully." });
    } catch {
      toast({ title: "Save failed", description: "Could not persist thresholds to backend.", variant: "destructive" });
    }
  };

  const users = [
    { name: "John Smith", email: "john@safeguard.io", role: "Safety Officer" },
    { name: "Maria Garcia", email: "maria@safeguard.io", role: "Manager" },
    { name: "Robert Lee", email: "robert@safeguard.io", role: "Admin" },
  ];

  // Refresh workers after creating a new one
  const handleWorkerCreated = () => setRefreshKey((k) => k + 1);

  if (isLoading) {
    return <AppLayout><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading settings...</div></AppLayout>;
  }

  if (error) {
    return <AppLayout><div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">Failed to load settings.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alert Thresholds</CardTitle>
            <CardDescription>Configure warning and critical thresholds for worker vitals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Heart Rate (BPM)</h4>
                <div className="space-y-2">
                  <Label className="text-xs">Warning Threshold</Label>
                  <Input type="number" value={hrMax} onChange={(e) => setHrMax(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Critical Threshold</Label>
                  <Input type="number" value={hrCritical} onChange={(e) => setHrCritical(e.target.value)} />
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Temperature (°C)</h4>
                <div className="space-y-2">
                  <Label className="text-xs">Warning Threshold</Label>
                  <Input type="number" value={tempMax} onChange={(e) => setTempMax(e.target.value)} step="0.1" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Critical Threshold</Label>
                  <Input type="number" value={tempCritical} onChange={(e) => setTempCritical(e.target.value)} step="0.1" />
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Air Quality (AQI)</h4>
                <div className="space-y-2">
                  <Label className="text-xs">Warning Minimum</Label>
                  <Input type="number" value={aqMin} onChange={(e) => setAqMin(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Critical Minimum</Label>
                  <Input type="number" value={aqCritical} onChange={(e) => setAqCritical(e.target.value)} />
                </div>
              </div>
            </div>
            <Button className="gap-2" onClick={handleSave}><Save className="h-4 w-4" /> Save Thresholds</Button>
          </CardContent>
        </Card>

        {/* Zone Management */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Zone Management</CardTitle>
              <CardDescription>Manage site zones and classifications</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Zone</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Workers</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((z) => (
                  <TableRow key={z.name}>
                    <TableCell className="font-medium">{z.name}</TableCell>
                    <TableCell>{z.description}</TableCell>
                    <TableCell>
                      <Badge className={z.type === "safe" ? "bg-success text-success-foreground" : z.type === "restricted" ? "bg-warning text-warning-foreground" : "bg-critical text-critical-foreground"}>
                        {z.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{z.workers}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-critical"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {z.name}?</AlertDialogTitle>
                            <AlertDialogDescription>This will remove the zone and reassign all workers. This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-critical text-critical-foreground hover:bg-critical/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Device Management */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Device Management</CardTitle>
              <CardDescription>Monitor IoT device status and change device assignments</CardDescription>
            </div>
            <CreateWorkerDialog onCreated={handleWorkerCreated} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Assigned Worker</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-sm">{w.deviceId}</TableCell>
                    <TableCell>{w.name}</TableCell>
                    <TableCell>
                      <Badge className="bg-success text-success-foreground">
                        connected
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DeviceChangeDialog
                        employeeId={w.id}
                        currentDeviceId={w.deviceId}
                        employeeName={w.name}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "email" as const, label: "Email Notifications" },
              { key: "sms" as const, label: "SMS Notifications" },
              { key: "push" as const, label: "Push Notifications" },
              { key: "criticalOnly" as const, label: "Critical Alerts Only" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <Label>{item.label}</Label>
                <Switch checked={notifications[item.key]} onCheckedChange={(v) => setNotifications({ ...notifications, [item.key]: v })} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* User Roles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Role Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.email}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
