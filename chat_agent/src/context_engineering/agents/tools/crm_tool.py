"""
CRM Tool for SafeguardIoT operational database actions.

This tool talks to the Sentinel backend REST API, which already owns
DynamoDB connectivity and business logic.
"""

from __future__ import annotations

import json
import os
import time
import inspect
from typing import Any, Dict, Optional, Tuple

import requests

from infrastructure.observability import observe, update_current_observation


class CRMTool:
    """
    Operational DB tool for the routing-engine agent.

    Route name remains `crm` for compatibility, but actions are
    SafeguardIoT monitoring operations.
    """
    WRITE_ACTIONS = {
        "set_alert_status",
        "update_thresholds",
        "update_notifications",
        "update_device",
    }

    CONFIRM_KEYS = ("confirm", "confirmed", "approval")

    def __init__(self, backend_base_url: Optional[str] = None, timeout_s: float = 12.0) -> None:
        env_url = os.getenv("SENTINEL_BACKEND_URL")
        if backend_base_url:
            base_url = backend_base_url
        elif env_url:
            base_url = env_url
        else:
            port = os.getenv("BACKEND_PORT", "4000")
            base_url = f"http://localhost:{port}"

        self.base_url = base_url.rstrip("/")
        self.timeout_s = float(os.getenv("SENTINEL_BACKEND_TIMEOUT_S", str(timeout_s)))
        self.default_employee_id = (
            os.getenv("VITE_EMPLOYEE_ID")
            or os.getenv("DEFAULT_EMPLOYEE_ID")
            or "EMP001"
        )

    # helpers --------------------------------------------------------------

    @staticmethod
    def _as_bool(value: Any, default: bool = False) -> bool:
        if isinstance(value, bool):
            return value
        if value is None:
            return default
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "y", "on"}
        return bool(value)

    def _resolve_employee_id(self, employee_id: Optional[str]) -> str:
        if isinstance(employee_id, str) and employee_id.strip():
            return employee_id.strip()
        return self.default_employee_id

    def _is_confirmed(self, params: Dict[str, Any]) -> bool:
        for key in self.CONFIRM_KEYS:
            if key in params and self._as_bool(params.get(key), default=False):
                return True
        return False

    def _strip_confirm_keys(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return {k: v for k, v in params.items() if k not in self.CONFIRM_KEYS}

    @staticmethod
    def _filter_handler_kwargs(handler: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        sig = inspect.signature(handler)
        accepted = set(sig.parameters.keys())
        return {k: v for k, v in params.items() if k in accepted}

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, Any, Optional[str]]:
        url = f"{self.base_url}{path}"

        try:
            response = requests.request(
                method=method,
                url=url,
                params=params,
                json=json_body,
                timeout=self.timeout_s,
            )
        except requests.RequestException as exc:
            return False, None, f"Request failed: {exc}"

        try:
            payload = response.json()
        except ValueError:
            payload = response.text

        if response.status_code >= 400:
            detail = payload
            if isinstance(payload, dict):
                detail = payload.get("message") or payload.get("error") or payload
            return False, payload, f"Backend error {response.status_code}: {detail}"

        return True, payload, None

    def _ingest_if_realtime(self, employee_id: str, realtime: bool) -> str:
        if not realtime:
            return "Realtime sync: skipped"

        ok, payload, error = self._request(
            "POST",
            "/api/ingest",
            params={"employeeId": employee_id},
        )
        if not ok:
            return f"Realtime sync: failed ({error})"

        if isinstance(payload, dict):
            inserted = payload.get("inserted", 0)
            scanned = payload.get("scanned", 0)
            return f"Realtime sync: success (inserted={inserted}, scanned={scanned})"

        return "Realtime sync: success"

    @staticmethod
    def _to_json(data: Any) -> str:
        try:
            return json.dumps(data, indent=2, ensure_ascii=True)
        except Exception:
            return str(data)

    # actions --------------------------------------------------------------

    def get_live_snapshot(self, employee_id: Optional[str] = None, realtime: bool = False) -> str:
        employee_id = self._resolve_employee_id(employee_id)
        realtime = self._as_bool(realtime, default=False)
        sync_note = self._ingest_if_realtime(employee_id, realtime)

        ok, payload, error = self._request(
            "GET",
            "/api/bootstrap",
            params={
                "employeeId": employee_id,
                "sync": "true" if realtime else "false",
            },
        )
        if not ok:
            return f"{sync_note}\n{error}"

        workers = payload.get("workers", []) if isinstance(payload, dict) else []
        alerts = payload.get("alerts", []) if isinstance(payload, dict) else []
        zones = payload.get("zones", []) if isinstance(payload, dict) else []

        lines = [
            sync_note,
            f"Snapshot: workers={len(workers)}, alerts={len(alerts)}, zones={len(zones)}",
        ]

        target = None
        for worker in workers:
            if isinstance(worker, dict) and worker.get("id") == employee_id:
                target = worker
                break
        if target is None and workers:
            target = workers[0]

        if isinstance(target, dict):
            lines.append(
                "Primary worker: "
                f"id={target.get('id')} status={target.get('status')} "
                f"hr={target.get('heartRate')} temp={target.get('temperature')} "
                f"aq={target.get('airQuality')} zone={target.get('zone')}"
            )

        top_alerts = []
        for alert in alerts[:5]:
            if isinstance(alert, dict):
                top_alerts.append(
                    f"- {alert.get('severity')} {alert.get('type')} for {alert.get('workerId')} "
                    f"status={alert.get('status')}"
                )
        if top_alerts:
            lines.append("Top alerts:\n" + "\n".join(top_alerts))

        lines.append("Raw payload:\n" + self._to_json(payload))
        return "\n\n".join(lines)

    def get_worker_latest(self, employee_id: Optional[str] = None, realtime: bool = False) -> str:
        employee_id = self._resolve_employee_id(employee_id)
        realtime = self._as_bool(realtime, default=False)
        sync_note = self._ingest_if_realtime(employee_id, realtime)

        ok, payload, error = self._request("GET", f"/api/employee/{employee_id}/latest")
        if not ok:
            return f"{sync_note}\n{error}"

        if payload in (None, "", []):
            # Fallback to worker registry snapshot so identity fields like deviceId
            # can still be answered even when telemetry rows are missing.
            snap_ok, snap_payload, snap_error = self._request(
                "GET",
                "/api/bootstrap",
                params={
                    "employeeId": employee_id,
                    "sync": "false",
                },
            )
            if not snap_ok:
                return (
                    f"{sync_note}\nNo latest telemetry found for employee {employee_id}.\n"
                    f"Snapshot fallback failed: {snap_error}"
                )

            workers = snap_payload.get("workers", []) if isinstance(snap_payload, dict) else []
            target = None
            for worker in workers:
                if isinstance(worker, dict) and str(worker.get("id", "")).upper() == employee_id.upper():
                    target = worker
                    break

            if isinstance(target, dict):
                device_id = target.get("deviceId")
                lines = [
                    sync_note,
                    f"No latest telemetry found for employee {employee_id}.",
                    "Using worker registry fallback:",
                    self._to_json(
                        {
                            "id": target.get("id"),
                            "name": target.get("name"),
                            "role": target.get("role"),
                            "zone": target.get("zone"),
                            "shift": target.get("shift"),
                            "status": target.get("status"),
                            "deviceId": device_id,
                        }
                    ),
                ]
                return "\n\n".join(lines)

            return (
                f"{sync_note}\nNo latest telemetry found for employee {employee_id}.\n"
                "Worker not found in registry fallback."
            )

        lines = [
            sync_note,
            f"Latest telemetry for {employee_id}:",
            self._to_json(payload),
        ]
        return "\n\n".join(lines)

    def get_worker_history(
        self,
        employee_id: Optional[str] = None,
        limit: int = 120,
        realtime: bool = False,
    ) -> str:
        employee_id = self._resolve_employee_id(employee_id)
        realtime = self._as_bool(realtime, default=False)
        sync_note = self._ingest_if_realtime(employee_id, realtime)

        try:
            bounded_limit = max(1, min(int(limit), 500))
        except (TypeError, ValueError):
            bounded_limit = 120

        ok, payload, error = self._request(
            "GET",
            f"/api/employee/{employee_id}/history",
            params={"limit": bounded_limit},
        )
        if not ok:
            return f"{sync_note}\n{error}"

        if not isinstance(payload, list):
            return f"{sync_note}\nUnexpected history payload:\n{self._to_json(payload)}"

        preview = payload[: min(len(payload), 20)]
        lines = [
            sync_note,
            f"History for {employee_id}: {len(payload)} points (requested limit={bounded_limit}).",
            "Preview (up to 20 rows):",
            self._to_json(preview),
        ]
        return "\n\n".join(lines)

    def get_worker_alerts(self, employee_id: Optional[str] = None, realtime: bool = False) -> str:
        employee_id = self._resolve_employee_id(employee_id)
        realtime = self._as_bool(realtime, default=False)
        sync_note = self._ingest_if_realtime(employee_id, realtime)

        ok, payload, error = self._request("GET", f"/api/employee/{employee_id}/alerts")
        if not ok:
            return f"{sync_note}\n{error}"

        if not isinstance(payload, list):
            return f"{sync_note}\nUnexpected alerts payload:\n{self._to_json(payload)}"

        summary = f"Alerts for {employee_id}: {len(payload)}"
        top = payload[: min(len(payload), 10)]
        return "\n\n".join([sync_note, summary, self._to_json(top)])

    def list_zones(self) -> str:
        ok, payload, error = self._request("GET", "/api/zones")
        if not ok:
            return error or "Failed to list zones"

        zones = payload.get("zones", []) if isinstance(payload, dict) else []
        return "\n\n".join([
            f"Zones: {len(zones)}",
            self._to_json(zones),
        ])

    def get_thresholds(self, employee_id: Optional[str] = None) -> str:
        employee_id = self._resolve_employee_id(employee_id)
        ok, payload, error = self._request(
            "GET",
            "/api/settings",
            params={"employeeId": employee_id},
        )
        if not ok:
            return error or "Failed to fetch thresholds"

        return self._to_json(payload)

    def set_alert_status(self, alert_id: str, status: str) -> str:
        ok, payload, error = self._request(
            "PUT",
            f"/api/alerts/{alert_id}/status",
            json_body={"status": status},
        )
        if not ok:
            return error or "Failed to update alert status"

        return self._to_json(payload)

    def update_thresholds(self, employee_id: Optional[str] = None, thresholds: Optional[Dict[str, Any]] = None) -> str:
        employee_id = self._resolve_employee_id(employee_id)
        if not isinstance(thresholds, dict):
            return "Invalid thresholds payload."

        ok, payload, error = self._request(
            "PUT",
            "/api/settings",
            params={"employeeId": employee_id},
            json_body=thresholds,
        )
        if not ok:
            return error or "Failed to update thresholds"

        return self._to_json(payload)

    def update_notifications(
        self,
        employee_id: Optional[str] = None,
        notifications: Optional[Dict[str, Any]] = None,
    ) -> str:
        employee_id = self._resolve_employee_id(employee_id)
        if not isinstance(notifications, dict):
            return "Invalid notifications payload."

        ok, payload, error = self._request(
            "PUT",
            "/api/notifications",
            params={"employeeId": employee_id},
            json_body=notifications,
        )
        if not ok:
            return error or "Failed to update notifications"

        return self._to_json(payload)

    def update_device(self, employee_id: Optional[str] = None, device_id: Optional[str] = None) -> str:
        employee_id = self._resolve_employee_id(employee_id)
        if not isinstance(device_id, str) or not device_id.strip():
            return "device_id is required."

        ok, payload, error = self._request(
            "PUT",
            f"/api/employee/{employee_id}/device",
            json_body={"deviceId": device_id.strip()},
        )
        if not ok:
            return error or "Failed to update device"

        return self._to_json(payload)

    # dispatch -------------------------------------------------------------

    @observe(name="crm_dispatch")
    def dispatch(self, action: str, params: Dict[str, Any]) -> str:
        handler_map = {
            "get_live_snapshot": self.get_live_snapshot,
            "get_worker_latest": self.get_worker_latest,
            "get_worker_history": self.get_worker_history,
            "get_worker_alerts": self.get_worker_alerts,
            "list_zones": self.list_zones,
            "get_thresholds": self.get_thresholds,
            "set_alert_status": self.set_alert_status,
            "update_thresholds": self.update_thresholds,
            "update_notifications": self.update_notifications,
            "update_device": self.update_device,
        }

        handler = handler_map.get(action)
        if not handler:
            return (
                f"Unknown CRM action: {action}. "
                f"Available: {list(handler_map.keys())}"
            )

        safe_params = dict(params or {})

        if action in self.WRITE_ACTIONS and not self._is_confirmed(safe_params):
            return (
                f"Confirmation required before write action '{action}'. "
                "Please confirm explicitly (for example: 'confirm and proceed')."
            )

        safe_params = self._strip_confirm_keys(safe_params)
        safe_params = self._filter_handler_kwargs(handler, safe_params)

        update_current_observation(input=f"action={action} params={safe_params}")

        start = time.time()
        result = handler(**safe_params)
        latency_ms = int((time.time() - start) * 1000)

        update_current_observation(
            output=result[:500],
            metadata={"action": action, "latency_ms": latency_ms, "backend": self.base_url},
        )

        return result
