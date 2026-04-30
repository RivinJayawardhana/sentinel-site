"""
Short-term memory store - in-process global ring buffer.

This store is intentionally authentication-agnostic:
- No per-user/session partitioning
- One shared short-term memory context for the running API process

It keeps the most recent conversation turns with TTL-based expiry.
"""

import threading
import time
from dataclasses import dataclass
from typing import List, Optional

from loguru import logger

from memory.schemas import ConversationTurn


@dataclass
class _StoredTurn:
    turn: ConversationTurn
    expires_at: Optional[float]


class ShortTermMemoryStore:
    """
    In-memory short-term memory store.

    Notes:
    - Global conversation memory (no user/session isolation).
    - Data is process-local and resets when the API restarts.
    """

    def __init__(self, supabase_session_factory=None):
        # Keep arg for backward compatibility with callers/tests.
        self._lock = threading.Lock()
        self._turns: List[_StoredTurn] = []
        logger.info("Short-term memory store initialised in global in-memory mode")

    def _purge_expired_locked(self, now: Optional[float] = None) -> None:
        now = now if now is not None else time.time()
        self._turns = [
            item for item in self._turns
            if item.expires_at is None or item.expires_at > now
        ]

    def add(self, user_id: str, session_id: str, turn: ConversationTurn) -> None:
        """Add a conversation turn using configured defaults."""
        from infrastructure.config import ST_MAX_TURNS, ST_TTL_SECONDS

        # API is auth-agnostic: normalise identity to shared global context.
        turn.user_id = "global"
        turn.session_id = "global"
        self.append(turn, max_turns=ST_MAX_TURNS, ttl_seconds=ST_TTL_SECONDS)

    def append(self, turn: ConversationTurn, max_turns: int, ttl_seconds: int) -> None:
        """Append a conversation turn to the global ring buffer."""
        now = time.time()
        if not getattr(turn, "ts", None):
            turn.ts = now

        expires_at = None if ttl_seconds <= 0 else (now + ttl_seconds)

        with self._lock:
            self._purge_expired_locked(now)
            self._turns.append(_StoredTurn(turn=turn, expires_at=expires_at))
            if max_turns > 0 and len(self._turns) > max_turns:
                self._turns = self._turns[-max_turns:]

    def recent(self, user_id: str, session_id: str, k: int) -> List[ConversationTurn]:
        """Return the most recent *k* turns from global memory."""
        if k <= 0:
            return []

        with self._lock:
            self._purge_expired_locked()
            turns = [item.turn for item in self._turns[-k:]]

        return turns

    def clear(self, user_id: str, session_id: str) -> None:
        """Clear global short-term memory (args ignored by design)."""
        with self._lock:
            self._turns.clear()
        logger.info("Cleared global short-term memory")
