import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMonitoringData, useIoTData } from "@/hooks/useMonitoringData";
import { useDangerZones } from "@/hooks/useDangerZones";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { haversineDistance, isInsideZone } from "@/lib/geo";
import {
  Search, AlertTriangle, Plus, Trash2, MapPin,
  ShieldAlert, Wifi, WifiOff, X, CheckCheck,
} from "lucide-react";

const zoneTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  safe:       { bg: "fill-success/20",  border: "stroke-success",  text: "text-success"  },
  restricted: { bg: "fill-warning/20",  border: "stroke-warning",  text: "text-warning"  },
  emergency:  { bg: "fill-critical/20", border: "stroke-critical", text: "text-critical" },
};

const statusDotColors: Record<string, string> = {
  normal:   "fill-success",
  warning:  "fill-warning",
  critical: "fill-critical",
};

function getZonePosition(index: number) {
  const cols = 3;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: 30 + col * 220,
    y: 30 + row * 120,
    w: 180,
    h: 90,
  };
}


function AddZoneDialog({ onAdd, createdBy }: {
  onAdd: (zone: { name: string; centerLat: number; centerLng: number; radiusMeters: number; createdBy: string }) => void;
  createdBy: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", centerLat: "", centerLng: "", radiusMeters: "50" });
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(form.centerLat);
    const lng = parseFloat(form.centerLng);
    const r   = parseFloat(form.radiusMeters);
    if (!form.name.trim())            return setError("Name is required.");
    if (isNaN(lat) || lat < -90 || lat > 90)  return setError("Latitude must be −90 to 90.");
    if (isNaN(lng) || lng < -180 || lng > 180) return setError("Longitude must be −180 to 180.");
    if (isNaN(r) || r <= 0)           return setError("Radius must be > 0 metres.");
    setError("");
    onAdd({ name: form.name.trim(), centerLat: lat, centerLng: lng, radiusMeters: r, createdBy });
    setForm({ name: "", centerLat: "", centerLng: "", radiusMeters: "50" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 w-full">
          <Plus className="h-4 w-4" /> Add Danger Zone
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-critical" /> Define GPS Danger Zone
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="dz-name">Zone Name</Label>
            <Input id="dz-name" placeholder="e.g. Chemical Storage Area" value={form.name} onChange={set("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dz-lat">Center Latitude</Label>
              <Input id="dz-lat" type="number" step="any" placeholder="e.g. 1.3521" value={form.centerLat} onChange={set("centerLat")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dz-lng">Center Longitude</Label>
              <Input id="dz-lng" type="number" step="any" placeholder="e.g. 103.8198" value={form.centerLng} onChange={set("centerLng")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dz-radius">Radius (metres)</Label>
            <Input id="dz-radius" type="number" min="1" placeholder="50" value={form.radiusMeters} onChange={set("radiusMeters")} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1 bg-critical hover:bg-critical/90">Create Danger Zone</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const LocationZones = () => {
  const { data, isLoading, error } = useMonitoringData();
  const { data: iot } = useIoTData();
  const { user } = useAuth();
  const { zones: dangerZones, breachAlerts, addZone, removeZone, dismissAlert, clearAllAlerts } = useDangerZones();

  const workers = data?.workers ?? [];
  const zones   = data?.zones ?? [];
  const [search, setSearch] = useState("");

  const hasGps = !!iot && (iot.latitude !== 0 || iot.longitude !== 0);

  const filteredWorkers = search
    ? workers.filter((w) =>
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.id.toLowerCase().includes(search.toLowerCase())
      )
    : workers;

  const activeBreaches = breachAlerts.filter((a) => a.status === "active");

  if (isLoading) {
    return <AppLayout><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading location data…</div></AppLayout>;
  }
  if (error) {
    return <AppLayout><div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">Failed to load location and zones.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="grid grid-cols-12 gap-6">
        {/* ── Left: Site Map ── */}
        <div className="col-span-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workers on map…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Site Map Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <svg viewBox="0 0 700 400" className="w-full rounded-lg bg-muted/30 border">
                {/* Grid */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={400} stroke="hsl(var(--border))" strokeWidth={0.5} />
                ))}
                {Array.from({ length: 5 }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 100} x2={700} y2={i * 100} stroke="hsl(var(--border))" strokeWidth={0.5} />
                ))}

                {/* Zones */}
                {zones.map((zone, idx) => {
                  const pos    = getZonePosition(idx);
                  const colors = zoneTypeColors[zone.type];
                  return (
                    <g key={zone.name}>
                      <rect x={pos.x} y={pos.y} width={pos.w} height={pos.h} className={`${colors.bg} ${colors.border}`} strokeWidth={2} rx={8} />
                      <text x={pos.x + 10} y={pos.y + 22} fontSize={12} fontWeight={600} fill="currentColor" className={colors.text}>{zone.name}</text>
                      <text x={pos.x + 10} y={pos.y + 38} fontSize={10} fill="hsl(var(--muted-foreground))">{zone.description}</text>
                    </g>
                  );
                })}

                {/* Worker dots */}
                {filteredWorkers.map((w) => (
                  <g key={w.id}>
                    <circle cx={w.location.x * 7} cy={w.location.y * 4} r={8} className={statusDotColors[w.status]} opacity={0.8} />
                    <circle cx={w.location.x * 7} cy={w.location.y * 4} r={4} fill="white" />
                    <text x={w.location.x * 7 + 12} y={w.location.y * 4 + 4} fontSize={9} fill="hsl(var(--foreground))" fontWeight={500}>
                      {w.name.split(" ")[0]}
                    </text>
                  </g>
                ))}
              </svg>

              {/* Legend */}
              <div className="mt-4 flex gap-6 flex-wrap">
                {[{ label: "Safe Zone", color: "bg-success" }, { label: "Restricted", color: "bg-warning" }, { label: "Emergency", color: "bg-critical" }].map((i) => (
                  <div key={i.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className={`h-3 w-3 rounded ${i.color}`} /> {i.label}
                  </div>
                ))}
                <div className="ml-4 flex gap-4">
                  {[{ label: "Normal", color: "bg-success" }, { label: "Warning", color: "bg-warning" }, { label: "Critical", color: "bg-critical" }].map((i) => (
                    <div key={i.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className={`h-2.5 w-2.5 rounded-full ${i.color}`} /> {i.label}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* GPS Position Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {hasGps
                  ? <><Wifi className="h-4 w-4 text-success" /> Live GPS Position</>
                  : <><WifiOff className="h-4 w-4 text-muted-foreground" /> GPS Position</>
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasGps ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Latitude</p>
                    <p className="text-lg font-bold font-mono">{iot!.latitude.toFixed(6)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Longitude</p>
                    <p className="text-lg font-bold font-mono">{iot!.longitude.toFixed(6)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Active Breaches</p>
                    <p className={`text-lg font-bold ${activeBreaches.length > 0 ? "text-critical" : "text-success"}`}>
                      {activeBreaches.length}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-muted-foreground py-2">
                  <WifiOff className="h-4 w-4" />
                  <span>No GPS fix — device is reporting lat/lng as 0.0. Breach detection will activate once GPS signal is acquired.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Panel ── */}
        <div className="col-span-4 space-y-4">

          {/* Add Danger Zone (admin only) */}
          {user?.role === "admin" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-critical" /> Danger Zone Management
                  <Badge className="ml-auto text-[10px] bg-primary/10 text-primary border-primary/20">Admin</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AddZoneDialog onAdd={addZone} createdBy={user.name} />
              </CardContent>
            </Card>
          )}

          {/* Active Danger Zones */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-warning" />
                GPS Danger Zones
                <Badge variant="outline" className="ml-auto text-xs">{dangerZones.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dangerZones.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  {user?.role === "admin"
                    ? "No danger zones defined. Use the form above to add one."
                    : "No danger zones defined by admin."}
                </p>
              ) : (
                dangerZones.map((dz) => {
                  const distNow = hasGps
                    ? haversineDistance(iot!.latitude, iot!.longitude, dz.centerLat, dz.centerLng)
                    : null;
                  const inside = distNow !== null && distNow <= dz.radiusMeters;
                  return (
                    <div key={dz.id} className={`rounded-lg border p-3 space-y-1 ${inside ? "border-critical/50 bg-critical/5" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {inside && <span className="inline-block h-2 w-2 rounded-full bg-critical animate-pulse" />}
                          <span className="text-sm font-semibold">{dz.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {inside && <Badge className="text-[10px] bg-critical text-white px-1.5 py-0">BREACH</Badge>}
                          {user?.role === "admin" && (
                            <button
                              onClick={() => removeZone(dz.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {dz.centerLat.toFixed(5)}, {dz.centerLng.toFixed(5)}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Radius: {dz.radiusMeters} m</span>
                        {distNow !== null
                          ? <span className={inside ? "text-critical font-medium" : "text-success"}>
                              {distNow < 1000 ? `${Math.round(distNow)} m away` : `${(distNow / 1000).toFixed(1)} km away`}
                            </span>
                          : <span>No GPS fix</span>
                        }
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Zone Breach Alerts */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Zone Breach Alerts
                  {activeBreaches.length > 0 && (
                    <Badge className="bg-critical text-white text-[10px] px-1.5">{activeBreaches.length} active</Badge>
                  )}
                </CardTitle>
                {breachAlerts.length > 0 && (
                  <button onClick={clearAllAlerts} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <CheckCheck className="h-3.5 w-3.5" /> Clear all
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-80 overflow-y-auto">
              {breachAlerts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No zone breach alerts recorded.</p>
              ) : (
                breachAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3 space-y-1 ${
                      alert.status === "active" ? "border-critical/40 bg-critical/5" : "opacity-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {alert.status === "active" && (
                          <span className="inline-block h-2 w-2 rounded-full bg-critical animate-pulse shrink-0 mt-0.5" />
                        )}
                          <span className="text-xs font-semibold">{alert.message}</span>
                      </div>
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {alert.status === "active" && (
                      <Badge className="text-[10px] bg-critical/10 text-critical border-critical/30 px-1.5">
                        ACTIVE BREACH
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default LocationZones;
