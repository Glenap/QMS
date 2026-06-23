"""In-memory capture of outbound email for tests (no real SMTP).

The conftest `client` fixture monkeypatches the email senders to write here, so
tests can read the OTP code that "would have been emailed".
"""

# email -> latest OTP code that was sent
OTP_CODES: dict[str, str] = {}


def reset() -> None:
    OTP_CODES.clear()
