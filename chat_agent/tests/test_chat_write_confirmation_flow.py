import os

import pytest

from scripts.run_chat_write_confirmation_check import (
    DEFAULT_BACKEND_URL,
    DEFAULT_CHAT_URL,
    run_check,
)


@pytest.mark.integration
def test_chat_write_confirmation_flow() -> None:
    """
    End-to-end integration check for write-confirmation behavior via /chat.

    Opt-in only:
      RUN_CHAT_WRITE_CONFIRMATION_ITEST=1
    """
    if os.getenv("RUN_CHAT_WRITE_CONFIRMATION_ITEST", "0") != "1":
        pytest.skip("Set RUN_CHAT_WRITE_CONFIRMATION_ITEST=1 to run this integration test")

    chat_url = os.getenv("CHAT_API_BASE_URL", DEFAULT_CHAT_URL)
    backend_url = os.getenv("BACKEND_API_BASE_URL", DEFAULT_BACKEND_URL)
    employee_id = os.getenv("ITEST_EMPLOYEE_ID", "EMP001")

    run_check(
        chat_url=chat_url,
        backend_url=backend_url,
        employee_id=employee_id,
    )

