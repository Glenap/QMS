"""
security.py
-----------
JWT token creation/verification and bcrypt password hashing.

Token strategy:
  access_token  → short-lived (30 min), used for every API request
  refresh_token → long-lived (7 days), used only to get a new access token
  token blacklist → revoked tokens stored in DB (auth.token_blacklist)

JWT payload structure:
  sub   → user_id (as string)
  role  → UserRole value
  org   → org_id
  type  → "access" or "refresh"
  exp   → expiry timestamp
  jti   → unique token ID (for blacklisting)
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def _prepare_password(plain_password: str) -> str:
    """
    SHA256-encodes the password before bcrypt hashing.
    This bypasses bcrypt's 72-byte limit safely —
    SHA256 always produces a 64-char hex string regardless of input length.
    """
    import hashlib
    return hashlib.sha256(plain_password.encode()).hexdigest()


def hash_password(plain_password: str) -> str:
    """Returns bcrypt hash of the password."""
    return pwd_context.hash(_prepare_password(plain_password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Returns True if plain_password matches the stored hash."""
    return pwd_context.verify(_prepare_password(plain_password), hashed_password)


# ---------------------------------------------------------------------------
# Token creation
# ---------------------------------------------------------------------------

def _create_token(
    user_id: int,
    role: str,
    org_id: int,
    token_type: str,
    expire_delta: timedelta,
) -> tuple[str, str]:
    """
    Internal: creates a signed JWT.
    Returns (token_string, jti) — jti is the unique token ID
    used to blacklist the token on logout.
    """
    jti = str(uuid.uuid4())
    expire = datetime.now(UTC) + expire_delta

    payload = {
        "sub": str(user_id),
        "role": role,
        "org": org_id,
        "type": token_type,
        "exp": expire,
        "jti": jti,
    }

    token = jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, jti


def create_access_token(user_id: int, role: str, org_id: int) -> tuple[str, str]:
    """
    Creates a short-lived access token.
    Returns (token, jti).
    """
    return _create_token(
        user_id=user_id,
        role=role,
        org_id=org_id,
        token_type="access",
        expire_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int, role: str, org_id: int) -> tuple[str, str]:
    """
    Creates a long-lived refresh token.
    Returns (token, jti).
    """
    return _create_token(
        user_id=user_id,
        role=role,
        org_id=org_id,
        token_type="refresh",
        expire_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


# ---------------------------------------------------------------------------
# Token verification
# ---------------------------------------------------------------------------

class TokenData:
    """Decoded token payload."""
    def __init__(self, user_id: int, role: str, org_id: int, jti: str, token_type: str):
        self.user_id = user_id
        self.role = role
        self.org_id = org_id
        self.jti = jti
        self.token_type = token_type


def decode_token(token: str) -> TokenData | None:
    """
    Decodes and validates a JWT.
    Returns TokenData if valid, None if expired or invalid.
    Does NOT check the blacklist — that happens in dependencies.py.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id = int(payload.get("sub"))
        role = payload.get("role")
        org_id = int(payload.get("org"))
        jti = payload.get("jti")
        token_type = payload.get("type")

        # user_id / org_id are already valid ints here (int() above would have
        # raised otherwise) — check the string claims for presence. Don't use a
        # truthiness test: a legitimate id of 0 would be wrongly rejected.
        if not role or not jti or not token_type:
            return None

        return TokenData(
            user_id=user_id,
            role=role,
            org_id=org_id,
            jti=jti,
            token_type=token_type,
        )
    except (JWTError, ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Invitation token (not JWT — just a secure random string)
# ---------------------------------------------------------------------------

def create_invitation_token() -> str:
    """
    Creates a secure random token for email invitations.
    Stored in OrgInvitation.token — not a JWT.
    """
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Email OTP (numeric verification code)
# ---------------------------------------------------------------------------

def generate_otp(length: int = 6) -> str:
    """Cryptographically-random numeric code for email verification."""
    return "".join(secrets.choice("0123456789") for _ in range(length))