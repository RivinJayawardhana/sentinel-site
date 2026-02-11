import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { workers, zones, alerts } from "@/data/mockData";
import { useState } from "react";
import { Search, AlertTriangle } from "lucide-react";

const zoneTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  safe: { bg: "fill-success/20", border: "stroke-success", text: "text-success" },
  restricted: { bg: "fill-warning/20", border: "stroke-warning", text: "text-warning" },
  emergency: { bg: "fill-critical/20", border: "stroke-critical", text: "text-critical" },
};

const statusDotColors: Record<string, string> = {
  normal: "fill-success",
  warning: "fill-warning",
  critical: "fill-critical",
};

const zonePositions: Record<string, { x: number; y: number; w: number; h: number }> = {
  "Zone A": { x: 30, y: 50, w: 200, h: 150 },
  "Zone B": { x: 260, y: 30, w: 180, h: 120 },
  "Zone C": { x: 260, y: 180, w: 200, h: 140 },
  "Zone D": { x: 30, y: 230, w: 200, h: 130 },
  "Zone E": { x: 490, y: 80, w: 160, h: 200 },
};

const LocationZones = () => {
  const [search, setSearch] = useState("");
  const zoneBreachAlerts = alerts.filter((a) => a.type === "zone_breach");

  const filteredWorkers = search
    ? workers.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.id.toLowerCase().includes(search.toLowerCase()))
    : workers;

  return (
    <AppLayout>
      <div className="grid grid-cols-12 gap-6">
        {/* Map */}
        <div className="col-span-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search workers on map..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Site Map Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <svg viewBox="0 0 700 400" className="w-full rounded-lg bg-muted/30 border">
                {/* Grid lines */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={400} stroke="hsl(var(--border))" strokeWidth={0.5} />
                ))}
                {Array.from({ length: 5 }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 100} x2={700} y2={400 > 0 ? i * 100 : 0} stroke="hsl(var(--border))" strokeWidth={0.5} />
                ))}

                {/* Zones */}
                {zones.map((zone) => {
                  const pos = zonePositions[zone.name];
                  const colors = zoneTypeColors[zone.type];
                  return (
                    <g key={zone.name}>
                      <rect
                        x={pos.x} y={pos.y} width={pos.w} height={pos.h}
                        className={`${colors.bg} ${colors.border}`}
                        strokeWidth={2} rx={8}
                      />
                      <text x={pos.x + 10} y={pos.y + 22} className={`${colors.text} text-xs font-bold`} fontSize={12} fontWeight={600}>
                        {zone.name}
                      </text>
                      <text x={pos.x + 10} y={pos.y + 38} className="text-muted-foreground" fontSize={10} fill="hsl(var(--muted-foreground))">
                        {zone.description}
                      </text>
                    </g>
                  );
                })}

                {/* Worker dots */}
                {filteredWorkers.map((w) => (
                  <g key={w.id}>
                    <circle
                      cx={w.location.x * 7}
                      cy={w.location.y * 4}
                      r={8}
                      className={statusDotColors[w.status]}
                      opacity={0.8}
                    />
                    <circle cx={w.location.x * 7} cy={w.location.y * 4} r={4} fill="white" />
                    <text
                      x={w.location.x * 7 + 12}
                      y={w.location.y * 4 + 4}
                      fontSize={9}
                      fill="hsl(var(--foreground))"
                      fontWeight={500}
                    >
                      {w.name.split(" ")[0]}
                    </text>
                  </g>
                ))}
              </svg>

              {/* Legend */}
              <div className="mt-4 flex gap-6">
                {[
                  { label: "Safe Zone", color: "bg-success" },
                  { label: "Restricted", color: "bg-warning" },
                  { label: "Emergency", color: "bg-critical" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className={`h-3 w-3 rounded ${item.color}`} />
                    {item.label}
                  </div>
                ))}
                <div className="ml-4 flex gap-4">
                  {[
                    { label: "Normal", color: "bg-success" },
                    { label: "Warning", color: "bg-warning" },
                    { label: "Critical", color: "bg-critical" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Zone Breach Alerts */}
        <div className="col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Zone Breach Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {zoneBreachAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No zone breach alerts</p>
              ) : (
                zoneBreachAlerts.map((a) => (
                  <div key={a.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{a.workerName}</span>
                      <Badge variant={a.status === "active" ? "destructive" : "secondary"} className="text-xs">
                        {a.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.timestamp).toLocaleString()}</p>
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
