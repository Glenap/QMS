"""external_tokens.py — lifetime policy for the passwordless external links.

Suppliers and labs never get portal accounts; they act through tokenised links
sent by email. Those links are bearer credentials, so they need the same
treatment the truck-dispatch token already had and these did not: an expiry, and
invalidation once used.

Kept in one module so supplier_service and lab_service can't drift apart on the
policy.
"""

from datetime import UTC, datetime, timedelta

# Long enough that a supplier or lab can act on the email without chasing a
# resend, short enough that a forwarded message stops working. Both services
# expose a resend, so the recovery path is cheap.
CONFIRMATION_TOKEN_TTL_DAYS = 14


def confirmation_expiry() -> datetime:
    """Expiry stamp for a freshly minted or resent confirmation token."""
    return datetime.now(UTC) + timedelta(days=CONFIRMATION_TOKEN_TTL_DAYS)


def is_expired(expires_at: datetime | None) -> bool:
    """True when the token may no longer be used.

    A NULL expiry counts as expired: tokens minted before the column existed
    have no bound, and treating them as valid would keep the original
    never-expires behaviour alive forever. The migration backfills a window onto
    rows that held a token, so no in-flight link was cut off by this rule.
    """
    return expires_at is None or expires_at <= datetime.now(UTC)
