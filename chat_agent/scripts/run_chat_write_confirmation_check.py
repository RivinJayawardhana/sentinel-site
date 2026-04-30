#!/usr/bin/env python
"""
Integration check for chat write-confirmation flow.

Scenario:
1. Ask the chat API to update a worker device WITHOUT confirmation.
   Expected: assistant blocks write with a confirmation-required response.
2. Ask again WITH explicit confirmation.
   Expected: write succeeds and backend worker device changes.

Prerequisites:
- Sentinel backend API running (default: http://localhost:4000)
- Chat API running (default: http://localhost:8000)
"""

from __future__ import annotations

import argparse
import sys
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests


DEFAULT_CHAT_URL = "http://localhost:8000"
DEFAULT_BACKEND_URL = "http://localhost:4000"


class IntegrationError(RuntimeError):
    """Raised when an integration assertion fails."""


@dataclass
class ChatTurn:
    answer: str
    route: str
    action: Optional[str]
    tool_output: str
    raw: Dict[str, Any]


def _request_json(
    method: str,
    url: str,
    *,
    timeout_s: float = 30.0,
    params: Optional[Dict[str, Any]] = None,
    json_body: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    try:
        response = requests.request(
            method=method,
            url=url,
            params=params,
            json=json_body,
            timeout=timeout_s,
        )
    except requests.RequestException as exc:
        raise IntegrationError(f"Request failed: {method} {url}: {exc}") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise IntegrationError(
            f"Non-JSON response from {method} {url} (status {response.status_code})"
        ) from exc

    if response.status_code >= 400:
        raise IntegrationError(
            f"HTTP {response.status_code} for {method} {url}: {payload}"
        )
    return payload


def _check_health(chat_url: str, backend_url: str) -> None:
    _request_json("GET", f"{chat_url.rstrip('/')}/health", timeout_s=20)
    _request_json("GET", f"{backend_url.rstrip('/')}/health", timeout_s=20)


def _get_worker_from_bootstrap(backend_url: str, employee_id: str) -> Dict[str, Any]:
    payload = _request_json(
        "GET",
        f"{backend_url.rstrip('/')}/api/bootstrap",
        params={"employeeId": employee_id, "sync": "false"},
        timeout_s=45,
    )
    workers = payload.get("workers", [])
    if not isinstance(workers, list):
        raise IntegrationError("Invalid bootstrap payload: workers is not a list")

    for worker in workers:
        if isinstance(worker, dict) and worker.get("id") == employee_id:
            return worker

    if workers and isinstance(workers[0], dict):
        return workers[0]

    raise IntegrationError(f"No worker found in bootstrap for employee_id={employee_id}")


def _get_device_id(backend_url: str, employee_id: str) -> str:
    worker = _get_worker_from_bootstrap(backend_url, employee_id)
    device_id = worker.get("deviceId")
    if not isinstance(device_id, str) or not device_id.strip():
        raise IntegrationError(f"Worker {employee_id} has no valid deviceId in bootstrap")
    return device_id


def _set_device_id_direct(backend_url: str, employee_id: str, device_id: str) -> None:
    _request_json(
        "PUT",
        f"{backend_url.rstrip('/')}/api/employee/{employee_id}/device",
        json_body={"deviceId": device_id},
        timeout_s=30,
    )


def _post_chat(chat_url: str, user_id: str, session_id: str, user_message: str) -> ChatTurn:
    payload = _request_json(
        "POST",
        f"{chat_url.rstrip('/')}/chat",
        json_body={
            "user_message": user_message,
            "user_id": user_id,
            "session_id": session_id,
        },
        timeout_s=120,
    )
    return ChatTurn(
        answer=str(payload.get("answer", "")),
        route=str(payload.get("route", "")),
        action=payload.get("action"),
        tool_output=str(payload.get("tool_output", "")),
        raw=payload,
    )


def _wait_for_device(
    backend_url: str,
    employee_id: str,
    expected_device_id: str,
    timeout_s: float = 20.0,
) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        current = _get_device_id(backend_url, employee_id)
        if current == expected_device_id:
            return True
        time.sleep(1.0)
    return False


def run_check(chat_url: str, backend_url: str, employee_id: str) -> None:
    _check_health(chat_url, backend_url)

    user_id = f"integration-user-{uuid.uuid4().hex[:8]}"
    session_id = f"confirm-flow-{uuid.uuid4().hex[:8]}"

    original_device = _get_device_id(backend_url, employee_id)
    new_device = f"DEV-AI-TEST-{uuid.uuid4().hex[:6].upper()}"

    if new_device == original_device:
        new_device = f"{new_device}-X"

    print(f"[info] employee={employee_id}")
    print(f"[info] original_device={original_device}")
    print(f"[info] test_device={new_device}")
    print(f"[info] user_id={user_id}, session_id={session_id}")

    rollback_needed = False
    try:
        msg_unconfirmed = (
            f"Update employee {employee_id} device to {new_device}"
        )
        turn1 = _post_chat(chat_url, user_id, session_id, msg_unconfirmed)
        print(f"[turn1] route={turn1.route} action={turn1.action}")

        combined_text = f"{turn1.answer}\n{turn1.tool_output}".lower()
        if "confirmation required" not in combined_text:
            raise IntegrationError(
                "Turn 1 should require confirmation, but no confirmation prompt was returned."
            )

        device_after_turn1 = _get_device_id(backend_url, employee_id)
        if device_after_turn1 != original_device:
            raise IntegrationError(
                f"Device changed before confirmation. expected={original_device} actual={device_after_turn1}"
            )
        print("[turn1] guardrail verified (no write without confirmation)")

        msg_confirmed = (
            f"Confirm and proceed. Update employee {employee_id} device to {new_device}"
        )
        turn2 = _post_chat(chat_url, user_id, session_id, msg_confirmed)
        print(f"[turn2] route={turn2.route} action={turn2.action}")

        combined_text_turn2 = f"{turn2.answer}\n{turn2.tool_output}".lower()
        if "confirmation required" in combined_text_turn2:
            raise IntegrationError(
                "Turn 2 still requested confirmation after explicit confirmation."
            )

        if not _wait_for_device(backend_url, employee_id, new_device, timeout_s=20):
            current = _get_device_id(backend_url, employee_id)
            raise IntegrationError(
                f"Confirmed write did not update device. expected={new_device} actual={current}"
            )
        rollback_needed = True
        print("[turn2] confirmed write verified")

        print("[ok] Integration check passed")
    finally:
        if rollback_needed:
            try:
                _set_device_id_direct(backend_url, employee_id, original_device)
                print(f"[cleanup] restored device to {original_device}")
            except Exception as exc:
                print(f"[cleanup] failed to restore original device: {exc}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run chat write-confirmation integration check."
    )
    parser.add_argument(
        "--chat-url",
        default=DEFAULT_CHAT_URL,
        help=f"Chat API base URL (default: {DEFAULT_CHAT_URL})",
    )
    parser.add_argument(
        "--backend-url",
        default=DEFAULT_BACKEND_URL,
        help=f"Backend API base URL (default: {DEFAULT_BACKEND_URL})",
    )
    parser.add_argument(
        "--employee-id",
        default="EMP001",
        help="Employee ID for the test flow (default: EMP001)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        run_check(
            chat_url=args.chat_url,
            backend_url=args.backend_url,
            employee_id=args.employee_id,
        )
    except IntegrationError as exc:
        print(f"[error] {exc}")
        return 1
    except Exception as exc:
        print(f"[error] Unexpected failure: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

