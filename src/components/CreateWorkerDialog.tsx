import { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface CreateWorkerDialogProps {
  onCreated?: () => void;
}

export function CreateWorkerDialog({ onCreated }: CreateWorkerDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("worker");
  const [deviceId, setDeviceId] = useState("");
  const [shift, setShift] = useState("Morning");
  const [zone, setZone] = useState("Zone A");
  const [loading, setLoading] = useState(false);

  function generateId() {
    // Simple unique id: EMP + timestamp + random 2 digits
    return `EMP${Date.now()}${Math.floor(Math.random() * 90 + 10)}`;
  }

  const handleCreate = async () => {
    setLoading(true);
    try {
      const id = generateId();
      const res = await fetch("/api/employee", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          email,
          role,
          deviceId: deviceId || `DEV-${id}`,
          shift,
          zone,
        }),
      });
      if (!res.ok) throw new Error("Failed to create worker");
      toast({ title: "Worker created", description: `${name} added successfully.` });
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap"] });
      setOpen(false);
      setName(""); setEmail(""); setRole("worker"); setDeviceId(""); setShift("Morning"); setZone("Zone A");
      onCreated?.();
    } catch {
      toast({ title: "Error", description: "Could not create worker.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">+ Create Worker</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Worker</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="worker">Worker</SelectItem>
                <SelectItem value="safety_officer">Safety Officer</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Device ID (optional)</Label>
            <Input value={deviceId} onChange={e => setDeviceId(e.target.value)} placeholder="e.g. DEV-001" />
          </div>
          <div>
            <Label>Shift</Label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Morning">Morning</SelectItem>
                <SelectItem value="Afternoon">Afternoon</SelectItem>
                <SelectItem value="Night">Night</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zone</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Zone A">Zone A</SelectItem>
                <SelectItem value="Zone B">Zone B</SelectItem>
                <SelectItem value="Zone C">Zone C</SelectItem>
                <SelectItem value="Zone D">Zone D</SelectItem>
                <SelectItem value="Zone E">Zone E</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={loading || !name || !email}>{loading ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
