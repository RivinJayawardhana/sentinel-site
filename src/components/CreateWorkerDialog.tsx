import { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface CreateWorkerDialogProps {
  onCreated?: () => void;
}

export function CreateWorkerDialog({ onCreated }: CreateWorkerDialogProps) {
  const { toast } = useToast();
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
            <select className="w-full border rounded px-2 py-1" value={role} onChange={e => setRole(e.target.value)}>
              <option value="worker">Worker</option>
              <option value="safety_officer">Safety Officer</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <Label>Device ID (optional)</Label>
            <Input value={deviceId} onChange={e => setDeviceId(e.target.value)} placeholder="Device ID" />
          </div>
          <div>
            <Label>Shift</Label>
            <select className="w-full border rounded px-2 py-1" value={shift} onChange={e => setShift(e.target.value)}>
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Night">Night</option>
            </select>
          </div>
          <div>
            <Label>Zone</Label>
            <select className="w-full border rounded px-2 py-1" value={zone} onChange={e => setZone(e.target.value)}>
              <option value="Zone A">Zone A</option>
              <option value="Zone B">Zone B</option>
              <option value="Zone C">Zone C</option>
              <option value="Zone D">Zone D</option>
              <option value="Zone E">Zone E</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={loading || !name || !email}>{loading ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
