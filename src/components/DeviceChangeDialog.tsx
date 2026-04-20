import { useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUpdateDevice } from "@/hooks/useMonitoringData";
import { useToast } from "@/hooks/use-toast";

interface DeviceChangeDialogProps {
  employeeId: string;
  currentDeviceId: string;
  employeeName: string;
}

export function DeviceChangeDialog({ employeeId, currentDeviceId, employeeName }: DeviceChangeDialogProps) {
  const [newDeviceId, setNewDeviceId] = useState("");
  const [open, setOpen] = useState(false);
  const updateDevice = useUpdateDevice(employeeId);
  const { toast } = useToast();

  const handleChangeDevice = async () => {
    if (!newDeviceId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a device ID",
        variant: "destructive",
      });
      return;
    }

    if (newDeviceId === currentDeviceId) {
      toast({
        title: "Error",
        description: "New device ID is the same as current device",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateDevice.mutateAsync(newDeviceId.trim());
      toast({
        title: "Success",
        description: `Device changed from ${currentDeviceId} to ${newDeviceId}`,
      });
      setNewDeviceId("");
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change device",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Change Device</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change IoT Device</DialogTitle>
          <DialogDescription>Assign a new device to {employeeName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Current device: <span className="font-mono font-semibold">{currentDeviceId}</span>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="new-device">New Device ID</Label>
            <Input
              id="new-device"
              placeholder="e.g., DEV-EMP002"
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
              disabled={updateDevice.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Enter the device ID of the new IoT device to assign
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={updateDevice.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangeDevice}
              disabled={updateDevice.isPending}
              className="flex-1"
            >
              {updateDevice.isPending ? "Changing..." : "Change Device"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
