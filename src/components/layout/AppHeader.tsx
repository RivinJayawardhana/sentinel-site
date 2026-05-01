import { Wifi, Bell, User, LogOut, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { useMonitoringData } from "@/hooks/useMonitoringData";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Alert } from "@/types/monitoring";

const severityIcon = (severity: Alert["severity"]) => {
  if (severity === "critical") return <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
  if (severity === "high") return <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
  return <Info className="h-3.5 w-3.5 text-yellow-500 shrink-0" />;
};

const severityBorder = (severity: Alert["severity"]) => {
  if (severity === "critical") return "border-l-red-500";
  if (severity === "high") return "border-l-orange-500";
  if (severity === "medium") return "border-l-yellow-500";
  return "border-l-blue-400";
};

export function AppHeader() {
  const { data } = useMonitoringData();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const alerts = data?.alerts ?? [];
  const activeAlerts = alerts.filter((a) => a.status === "active");
  const activeCount = activeAlerts.length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleDisplay = {
    admin: "Administrator",
    safety_officer: "Safety Officer",
    manager: "Manager",
  };

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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {activeCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {activeCount > 9 ? "9+" : activeCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="font-semibold text-sm">Notifications</span>
              {activeCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                  {activeCount} active
                </span>
              )}
            </div>
            {activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">No active alerts</p>
              </div>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="divide-y">
                  {activeAlerts.slice(0, 10).map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex gap-3 border-l-4 px-4 py-3 ${severityBorder(alert.severity)}`}
                    >
                      {severityIcon(alert.severity)}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{alert.workerName}</p>
                        <p className="text-xs text-muted-foreground leading-snug">{alert.message}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                          {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          {alert.zone}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <div className="border-t px-4 py-2">
              <Button
                variant="ghost"
                className="w-full text-xs text-primary hover:text-primary"
                onClick={() => navigate("/alerts")}
              >
                View all in Alerts Center
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 h-auto hover:bg-muted/80">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm text-left">
                <div className="font-medium text-foreground">{user?.name || "User"}</div>
                <div className="text-xs text-muted-foreground">{user?.role ? roleDisplay[user.role] : "User"}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-semibold text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950">
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
