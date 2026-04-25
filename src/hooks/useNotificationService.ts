import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Alert, NotificationSettings } from "@/types/monitoring";

export function useNotificationService(
  alerts: Alert[],
  settings: NotificationSettings | null,
) {
  const seenIds     = useRef(new Set<string>());
  const initialized = useRef(false);

  // Request browser notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // Seed existing alert IDs on first run so we don't flood toasts on load
    if (!initialized.current) {
      for (const a of alerts) seenIds.current.add(a.id);
      initialized.current = true;
      return;
    }

    const criticalOnly = settings?.criticalOnly ?? false;

    for (const alert of alerts) {
      if (seenIds.current.has(alert.id)) continue;
      seenIds.current.add(alert.id);

      if (criticalOnly && alert.severity !== "critical") continue;

      const title = `[${alert.severity.toUpperCase()}] ${alert.workerName}`;

      // In-app toast notification
      if (alert.severity === "critical") {
        toast.error(title, { description: alert.message, duration: 8000 });
      } else if (alert.severity === "high") {
        toast.warning(title, { description: alert.message, duration: 5000 });
      } else {
        toast(title, { description: alert.message, duration: 4000 });
      }

      // Browser push notification (if enabled and permission granted)
      if (
        settings?.push &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(`SafeGuard: ${alert.workerName}`, {
            body: alert.message,
            icon: "/favicon.ico",
            tag: alert.id,
            requireInteraction: alert.severity === "critical",
          });
        } catch {
          // Notification API unavailable in this context
        }
      }
    }
  }, [alerts, settings]);
}
