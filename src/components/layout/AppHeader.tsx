import { Wifi, Bell, User, LogOut } from "lucide-react";
import { useMonitoringData } from "@/hooks/useMonitoringData";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { data } = useMonitoringData();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const alerts = data?.alerts ?? [];
  const activeAlerts = alerts.filter((a) => a.status === "active").length;

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
        <div className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {activeAlerts > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-critical text-[10px] font-bold text-critical-foreground">
              {activeAlerts}
            </span>
          )}
        </div>
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
