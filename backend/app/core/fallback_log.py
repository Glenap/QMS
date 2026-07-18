"""fallback_log.py — keep dev-convenience credentials out of production logs.

Email delivery is best-effort everywhere (an SMTP failure must never roll back
the request), and each fallback logs the thing the email would have carried so
local dev still works without a mail server: the OTP code, an invitation accept
link, a supplier/lab confirmation token, a lab report link, a mix submission
link, a truck dispatch token.

Those are bearer credentials. Several never expire. In a hosted deploy stdout is
captured into retained, searchable log storage, so writing them there hands a
working credential to anyone with log access. This redacts the credential in
production and keeps it in local environments, where it is the point.
"""

from app.config import settings

_REDACTED = "<redacted in production>"


def fallback_detail(detail: str) -> str:
    """The credential in local environments; a placeholder in production."""
    return _REDACTED if settings.is_production else detail
