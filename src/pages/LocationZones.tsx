import "leaflet/dist/leaflet.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip as MapTooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { useMonitoringData, useZoneDefinitions, useUpsertZone } from "@/hooks/useMonitoringData";
import { useDangerZones } from "@/hooks/useDangerZones";
import { useMLAlerts } from "@/context/MLAlertContext";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search, AlertTriangle, Plus, Trash2, MapPin, ShieldAlert,
  Wifi, WifiOff, Edit2, Navigation, CheckCircle,
} from "lucide-react";
import type { ZoneDefinition } from "@/types/monitoring";

const STATUS_COLORS: Record<string, string> = {
  normal:   "#22c55e",
  warning:  "#f59e0b",
  critical: "#ef4444",
};

const ZONE_TYPE_COLORS: Record<string, string> = {
  safe:       "#22c55e",
  restricted: "#f59e0b",
  emergency:  "#ef4444",
};

// ── Auto-fit the map to all visible points (only on first load) ──────────────
function AutoFitBounds({ points }: { points: [number, number][] }) {
  const map     = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current || points.length === 0) return;
    fittedRef.current = true;
    if (points.length === 1) {
      map.setView(points[0], 16);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points.length]);

  return null;
}

// ── Dialogs ──────────────────────────────────────────────────────────────────

function AddZoneDialog({ onAdd, createdBy }: {
  onAdd: (zone: { name: string; centerLat: number; centerLng: number; radiusMeters: number; createdBy: string }) => void;
  createdBy: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", centerLat: "", centerLng: "", radiusMeters: "50" });
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(form.centerLat);
    const lng = parseFloat(form.centerLng);
    const r   = parseFloat(form.radiusMeters);
    if (!form.name.trim())                       return setError("Name is required.");
    if (isNaN(lat) || lat < -90  || lat > 90)   return setError("Latitude must be −90 to 90.");
    if (isNaN(lng) || lng < -180 || lng > 180)  return setError("Longitude must be −180 to 180.");
    if (isNaN(r)   || r <= 0)                   return setError("Radius must be > 0 metres.");
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
            <Label>Zone Name</Label>
            <Input placeholder="e.g. Chemical Storage Area" value={form.name} onChange={set("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Center Latitude</Label>
              <Input type="number" step="any" placeholder="e.g. 1.3521" value={form.centerLat} onChange={set("centerLat")} />
            </div>
            <div className="space-y-1.5">
              <Label>Center Longitude</Label>
              <Input type="number" step="any" placeholder="e.g. 103.8198" value={form.centerLng} onChange={set("centerLng")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Radius (metres)</Label>
            <Input type="number" min="1" placeholder="50" value={form.radiusMeters} onChange={set("radiusMeters")} />
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

function EditZoneGPSDialog({ zone, onSave }: {
  zone: ZoneDefinition;
  onSave: (updated: ZoneDefinition) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    centerLat:    zone.centerLat?.toString()    ?? "",
    centerLng:    zone.centerLng?.toString()    ?? "",
    radiusMeters: zone.radiusMeters?.toString() ?? "100",
  });
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleOpen = (o: boolean) => {
    if (o) setForm({
      centerLat:    zone.centerLat?.toString()    ?? "",
      centerLng:    zone.centerLng?.toString()    ?? "",
      radiusMeters: zone.radiusMeters?.toString() ?? "100",
    });
    setOpen(o);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = form.centerLat    ? parseFloat(form.centerLat)    : undefined;
    const lng = form.centerLng    ? parseFloat(form.centerLng)    : undefined;
    const r   = form.radiusMeters ? parseFloat(form.radiusMeters) : undefined;
    if (lat !== undefined && (isNaN(lat) || lat < -90  || lat > 90))  return setError("Latitude must be −90 to 90.");
    if (lng !== undefined && (isNaN(lng) || lng < -180 || lng > 180)) return setError("Longitude must be −180 to 180.");
    if (r   !== undefined && (isNaN(r)   || r <= 0))                  return setError("Radius must be > 0 metres.");
    if ((lat !== undefined) !== (lng !== undefined))                   return setError("Both lat and lng required together.");
    setError("");
    onSave({ ...zone, centerLat: lat, centerLng: lng, radiusMeters: r });
    setOpen(false);
  };

  const handleClear = () => {
    onSave({ ...zone, centerLat: undefined, centerLng: undefined, radiusMeters: undefined });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
          <Edit2 className="h-3.5 w-3.5" />
          {zone.centerLat ? "Edit GPS" : "Set GPS"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> GPS Boundary — {zone.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Center Latitude</Label>
              <Input type="number" step="any" placeholder="e.g. 1.3521" value={form.centerLat} onChange={set("centerLat")} />
            </div>
            <div className="space-y-1.5">
              <Label>Center Longitude</Label>
              <Input type="number" step="any" placeholder="e.g. 103.8198" value={form.centerLng} onChange={set("centerLng")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Radius (metres)</Label>
            <Input type="number" min="1" placeholder="100" value={form.radiusMeters} onChange={set("radiusMeters")} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1">Save GPS Boundary</Button>
            {zone.centerLat && (
              <Button type="button" variant="outline" className="text-destructive border-destructive/40" onClick={handleClear}>
                Clear GPS
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LocationZones = () => {
  const { data, isLoading, error }  = useMonitoringData();
  const { data: zdData }            = useZoneDefinitions();
  const upsertZone                  = useUpsertZone();
  const { user }                    = useAuth();
  const { zones: dangerZones, addZone, removeZone } = useDangerZones();
  const { zoneAlerts, workerPositions, updateZoneAlertStatus } = useMLAlerts();

  const workers  = data?.workers ?? [];
  const zoneDefs = zdData?.zones ?? [];
  const [search, setSearch] = useState("");

  const workersWithGps  = workers.filter(w => workerPositions.get(w.id)?.hasGps).length;
  const workersInDanger = workers.filter(w => (workerPositions.get(w.id)?.inDangerZones ?? []).length > 0).length;
  const workersOutside  = workers.filter(w => workerPositions.get(w.id)?.outsideAssignedZone).length;
  const activeZoneAlerts = zoneAlerts.filter(a => a.status === "active").length;

  // All GPS points for auto-fit (workers + zone centers)
  const allGpsPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    workers.forEach(w => {
      const pos = workerPositions.get(w.id);
      if (pos?.hasGps) pts.push([pos.lat, pos.lng]);
    });
    dangerZones.forEach(dz => pts.push([dz.centerLat, dz.centerLng]));
    zoneDefs.forEach(zd => {
      if (zd.centerLat && zd.centerLng) pts.push([zd.centerLat, zd.centerLng]);
    });
    return pts;
  }, [workers, workerPositions, dangerZones, zoneDefs]);

  const defaultCenter: [number, number] = allGpsPoints[0] ?? [20, 0];
  const defaultZoom = allGpsPoints.length > 0 ? 14 : 2;

  const filteredWorkers = search
    ? workers.filter(w =>
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.zone.toLowerCase().includes(search.toLowerCase())
      )
    : workers;

  if (isLoading) {
    return <AppLayout><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading location data…</div></AppLayout>;
  }
  if (error) {
    return <AppLayout><div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">Failed to load location and zones.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Workers with GPS",     value: `${workersWithGps}/${workers.length}`, color: "text-primary"  },
            { label: "In Danger Zones",       value: workersInDanger,  color: workersInDanger  > 0 ? "text-critical" : "text-success" },
            { label: "Outside Assigned Zone", value: workersOutside,   color: workersOutside   > 0 ? "text-warning"  : "text-success" },
            { label: "Active Zone Alerts",    value: activeZoneAlerts, color: activeZoneAlerts > 0 ? "text-critical" : "text-success" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-6">

          {/* ── Left col ── */}
          <div className="col-span-8 space-y-4">

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workers or zones…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Live Map */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" />
                  Live Worker Map
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {workersWithGps} worker{workersWithGps !== 1 ? "s" : ""} tracked
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden rounded-b-lg">
                <div style={{ height: 420 }}>
                  <MapContainer
                    center={defaultCenter}
                    zoom={defaultZoom}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    <AutoFitBounds points={allGpsPoints} />

                    {/* GPS Zone Definition boundaries */}
                    {zoneDefs
                      .filter(zd => zd.centerLat && zd.centerLng && zd.radiusMeters)
                      .map(zd => (
                        <Circle
                          key={`zd-${zd.name}`}
                          center={[zd.centerLat!, zd.centerLng!]}
                          radius={zd.radiusMeters!}
                          pathOptions={{
                            color:       ZONE_TYPE_COLORS[zd.type] ?? "#888",
                            fillColor:   ZONE_TYPE_COLORS[zd.type] ?? "#888",
                            fillOpacity: 0.08,
                            weight:      2,
                          }}
                        >
                          <MapTooltip>{zd.name} ({zd.type})</MapTooltip>
                        </Circle>
                      ))
                    }

                    {/* Danger zone circles */}
                    {dangerZones.map(dz => (
                      <Circle
                        key={`dz-${dz.id}`}
                        center={[dz.centerLat, dz.centerLng]}
                        radius={dz.radiusMeters}
                        pathOptions={{
                          color:       "#ef4444",
                          fillColor:   "#ef4444",
                          fillOpacity: 0.12,
                          weight:      2,
                          dashArray:   "6 4",
                        }}
                      >
                        <MapTooltip>⚠ Danger: {dz.name}</MapTooltip>
                      </Circle>
                    ))}

                    {/* Worker markers */}
                    {workers.map(w => {
                      const pos = workerPositions.get(w.id);
                      if (!pos?.hasGps) return null;
                      const inDanger = pos.inDangerZones.length > 0;
                      const color    = STATUS_COLORS[w.status] ?? "#888";
                      return (
                        <CircleMarker
                          key={w.id}
                          center={[pos.lat, pos.lng]}
                          radius={inDanger ? 11 : 8}
                          pathOptions={{
                            color:       inDanger ? "#ef4444" : color,
                            fillColor:   color,
                            fillOpacity: 0.9,
                            weight:      inDanger ? 3 : 2,
                          }}
                        >
                          <MapTooltip direction="top" offset={[0, -10]}>
                            <strong>{w.name}</strong>
                            {inDanger && <span style={{ color: "#ef4444" }}> ⚠ Danger zone</span>}
                            {pos.outsideAssignedZone && !inDanger && <span style={{ color: "#f59e0b" }}> ⚠ Outside zone</span>}
                          </MapTooltip>
                          <Popup>
                            <div style={{ minWidth: 160, fontSize: 12, lineHeight: 1.6 }}>
                              <p style={{ fontWeight: 700, marginBottom: 4 }}>{w.name}</p>
                              <p style={{ color: "#6b7280" }}>{w.role}</p>
                              <p>Zone: {w.zone}</p>
                              <p>Status: <span style={{ color: color, fontWeight: 600 }}>{w.status.toUpperCase()}</span></p>
                              <p style={{ fontFamily: "monospace", fontSize: 10, color: "#9ca3af" }}>
                                {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                              </p>
                              {inDanger && (
                                <p style={{ color: "#ef4444", fontWeight: 600, marginTop: 4 }}>
                                  ⚠ In: {pos.inDangerZones.join(", ")}
                                </p>
                              )}
                              {pos.outsideAssignedZone && (
                                <p style={{ color: "#f59e0b", fontWeight: 600, marginTop: 4 }}>
                                  Outside assigned zone
                                </p>
                              )}
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </div>

                {/* Map legend */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 border-t text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Workers:</span>
                  {[
                    { label: "Normal",   color: "bg-[#22c55e]" },
                    { label: "Warning",  color: "bg-[#f59e0b]" },
                    { label: "Critical", color: "bg-[#ef4444]" },
                  ].map(i => (
                    <div key={i.label} className="flex items-center gap-1.5">
                      <div className={`h-3 w-3 rounded-full ${i.color}`} /> {i.label}
                    </div>
                  ))}
                  <span className="ml-4 font-medium text-foreground">Zones:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-8 rounded border-2 border-[#ef4444] border-dashed bg-[#ef4444]/10" /> Danger zone
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-8 rounded border-2 border-[#22c55e] bg-[#22c55e]/10" /> Safe zone
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-8 rounded border-2 border-[#f59e0b] bg-[#f59e0b]/10" /> Restricted
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Worker GPS Compliance Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" />
                  Worker GPS Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Assigned Zone</TableHead>
                      <TableHead>GPS Position</TableHead>
                      <TableHead>Danger Zones</TableHead>
                      <TableHead>Zone Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkers.map(w => {
                      const pos = workerPositions.get(w.id);
                      return (
                        <TableRow key={w.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{w.name}</div>
                            <div className="text-xs text-muted-foreground">{w.role}</div>
                          </TableCell>
                          <TableCell className="text-sm">{w.zone}</TableCell>
                          <TableCell>
                            {pos?.hasGps ? (
                              <div>
                                <div className="flex items-center gap-1 text-xs text-success">
                                  <Wifi className="h-3 w-3" /> Active
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <WifiOff className="h-3 w-3" /> No GPS
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {pos?.inDangerZones && pos.inDangerZones.length > 0 ? (
                              <div className="space-y-0.5">
                                {pos.inDangerZones.map(z => (
                                  <Badge key={z} className="text-[10px] bg-critical text-white block w-fit py-0">
                                    ⚠ {z}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-success">Safe</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {!pos?.hasGps ? (
                              <span className="text-xs text-muted-foreground">No GPS</span>
                            ) : pos.outsideAssignedZone ? (
                              <Badge className="text-[10px] bg-warning/20 text-warning-foreground border border-warning/30">
                                Outside Zone
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] bg-success/20 text-success border border-success/30">
                                In Zone
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredWorkers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                          No workers found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Zone GPS Configuration (admin only) */}
            {user?.role === "admin" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Zone GPS Configuration
                    <Badge className="ml-auto text-[10px] bg-primary/10 text-primary border-primary/20">Admin</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {zoneDefs.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No zone definitions found.</p>
                  ) : (
                    <div className="space-y-2">
                      {zoneDefs.map(zd => (
                        <div key={zd.name} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{zd.name}</p>
                              <Badge variant="outline" className="text-[10px] capitalize">{zd.type}</Badge>
                            </div>
                            {zd.centerLat && zd.centerLng ? (
                              <p className="text-xs text-success font-mono mt-0.5">
                                GPS: {zd.centerLat.toFixed(5)}, {zd.centerLng.toFixed(5)} · r={zd.radiusMeters}m
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-0.5">No GPS boundary configured</p>
                            )}
                          </div>
                          <EditZoneGPSDialog zone={zd} onSave={updated => upsertZone.mutate(updated)} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right panel ── */}
          <div className="col-span-4 space-y-4">

            {/* Admin: Add Danger Zone */}
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

            {/* GPS Danger Zones list */}
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
                      ? "No danger zones. Use the form above to add one."
                      : "No danger zones defined by admin."}
                  </p>
                ) : (
                  dangerZones.map(dz => {
                    const workersInside = workers.filter(w =>
                      workerPositions.get(w.id)?.inDangerZones.includes(dz.name)
                    );
                    const hasBreaches = workersInside.length > 0;
                    return (
                      <div
                        key={dz.id}
                        className={`rounded-lg border p-3 space-y-1.5 ${hasBreaches ? "border-critical/50 bg-critical/5" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {hasBreaches && <span className="h-2 w-2 rounded-full bg-critical animate-pulse inline-block" />}
                            <span className="text-sm font-semibold">{dz.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {hasBreaches && (
                              <Badge className="text-[10px] bg-critical text-white px-1.5 py-0">
                                {workersInside.length} inside
                              </Badge>
                            )}
                            {user?.role === "admin" && (
                              <button
                                onClick={() => removeZone(dz.id)}
                                className="text-muted-foreground hover:text-destructive ml-1 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          {dz.centerLat.toFixed(5)}, {dz.centerLng.toFixed(5)}
                        </p>
                        <p className="text-xs text-muted-foreground">Radius: {dz.radiusMeters} m</p>
                        {workersInside.length > 0 && (
                          <div className="text-xs text-critical space-y-0.5 pt-1 border-t border-critical/20">
                            {workersInside.map(w => (
                              <div key={w.id} className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 shrink-0" /> {w.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Zone Breach Alerts */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Zone Breach Alerts
                  {activeZoneAlerts > 0 && (
                    <Badge className="bg-critical text-white text-[10px] px-1.5">{activeZoneAlerts} active</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                {zoneAlerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No zone breach alerts recorded.</p>
                ) : (
                  zoneAlerts.slice(0, 30).map(alert => (
                    <div
                      key={alert.id}
                      className={`rounded-lg border p-2.5 space-y-1 ${
                        alert.status === "active" ? "border-critical/40 bg-critical/5" : "opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {alert.status === "active" && (
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-critical animate-pulse mr-1.5 align-middle" />
                          )}
                          <span className="text-xs font-medium leading-snug">{alert.message}</span>
                        </div>
                        {alert.status === "active" && (
                          <button
                            onClick={() => updateZoneAlertStatus(alert.id, "acknowledged")}
                            title="Acknowledge"
                            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] px-1.5 py-0 ${
                          alert.severity === "critical"
                            ? "bg-critical text-white"
                            : "bg-warning/20 text-warning-foreground border border-warning/30"
                        }`}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleTimeString()} · {alert.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default LocationZones;
