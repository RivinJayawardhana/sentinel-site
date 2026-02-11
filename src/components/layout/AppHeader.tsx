import { Wifi, WifiOff, Bell, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { alerts } from "@/data/mockData";

export function AppHeader() {
  const activeAlerts = alerts.filter((a) => a.status === "active").length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-6 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-foreground">
          Industrial Worker Safety Monitoring
        </h1>
        <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1">
          <Wifi className="h-3.5 w-3.5 text-success" />
          <span className="text-xs font-medium text-success">Connected</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {activeAlerts > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-critical text-[10px] font-bold text-critical-foreground">
              {activeAlerts}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-medium text-foreground">John Smith</span>
            <span className="ml-2 text-muted-foreground">Safety Officer</span>
          </div>
        </div>
      </div>
    </header>
  );
}
