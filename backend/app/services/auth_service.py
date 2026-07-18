"""
auth_service.py — all auth business logic
"""

import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.email import (
    send_account_exists_email,
    send_invitation_email,
    send_otp_email,
)
from app.core.exceptions import (
    AccountDeactivatedError,
    AccountLockedError,
    AlreadyExistsError,
    EmailAlreadyVerifiedError,
    EmailNotVerifiedError,
    InvalidCredentialsError,
    InvalidInvitationError,
    InvalidOtpError,
    InvalidTokenError,
    InvitationAlreadyUsedError,
    NotFoundError,
    PermissionDeniedError,
)
from app.core.fallback_log import fallback_detail
from app.core.security import (
    create_access_token,
    create_invitation_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    hash_password,
    verify_password,
)
from app.models.auth import (
    InvitationStatus,
    OrgInvitation,
    OrgType,
    User,
    UserRole,
)
from app.repositories.auth_repo import AuthRepository
from app.schemas.auth import (
    AcceptInvitationRequest,
    AccessTokenResponse,
    InviteRequest,
    LoginRequest,
    MeResponse,
    OrgRegisterRequest,
    OrgResponse,
    OtpChallengeResponse,
    ResendOtpRequest,
    TeamMemberResponse,
    TokenResponse,
    UserResponse,
    VerifyOtpRequest,
)

logger = logging.getLogger(__name__)

OTP_EXPIRY_MINUTES = 10
# Wrong-code guesses allowed against a single issued OTP before it is burned —
# bounds brute-forcing of the 6-digit code within its validity window.
MAX_OTP_ATTEMPTS = 5
# Minimum gap between OTP (re)issues for an email — throttles the resend
# email-bomb vector. A resend inside this window is a silent no-op.
OTP_RESEND_COOLDOWN_SECONDS = 60
# Consecutive wrong passwords before an account is temporarily locked. Password
# login previously had no cap at all — only the OTP paths were bounded — leaving
# bcrypt's cost as the sole brake on sustained online guessing.
MAX_LOGIN_ATTEMPTS = 10
LOGIN_LOCKOUT_MINUTES = 15

_dummy_hash: str | None = None


def _dummy_password_hash() -> str:
    """A hash of an unguessable value, for verifying against a missing account.

    Computed lazily and cached: bcrypt at cost 12 is deliberately slow, and
    doing it at import would add that to every cold start.
    """
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = hash_password(secrets.token_urlsafe(32))
    return _dummy_hash


async def _try_send_invitation_email(**kwargs) -> None:
    """
    Send an invitation email, but never let an SMTP failure roll back the
    invitation that was just created. On failure we log the accept link so the
    flow still works in local dev (where SMTP may be unconfigured/unreachable).
    """
    token = kwargs.get("token")
    invited_email = kwargs.get("invited_email")
    try:
        await send_invitation_email(**kwargs)
    except Exception as exc:  # noqa: BLE001 — best-effort email, must not 500
        accept_url = f"{settings.FRONTEND_URL}/auth/accept-invitation?token={token}"
        logger.warning(
            "Invitation email to %s failed (%s). Accept link: %s",
            invited_email,
            exc,
            fallback_detail(accept_url),
        )


async def _try_send_account_exists(user: User) -> None:
    """Best-effort — a mail failure must not turn the generic register response
    into an error, which would re-open the existence oracle it exists to close."""
    try:
        await send_account_exists_email(email=user.email, full_name=user.full_name)
    except Exception as exc:  # noqa: BLE001 — best-effort email, must not 500
        logger.warning("Account-exists notice to %s failed (%s).", user.email, exc)


async def _try_send_otp_email(email: str, code: str, full_name: str | None) -> None:
    """
    Send the verification code, but never let an SMTP failure roll back the
    pending account. On failure we log the code so local dev still works.
    """
    try:
        await send_otp_email(email=email, code=code, full_name=full_name)
    except Exception as exc:  # noqa: BLE001 — best-effort email, must not 500
        logger.warning(
            "OTP email to %s failed (%s). Code: %s",
            email,
            exc,
            fallback_detail(code),
        )


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = AuthRepository(session)

    # ── Client self-registration ─────────────────────────────────────────────

    async def register_client(self, data: OrgRegisterRequest) -> OtpChallengeResponse:
        """
        Client creates their org and first admin user. The user is created
        inactive and must verify the emailed OTP (via verify_otp) before any
        tokens are issued.
        """
        # An existing address returns the SAME response as a fresh one. A 409
        # "Email already exists" on an unauthenticated endpoint is an account
        # existence oracle — anyone could test addresses in bulk. The real owner
        # is told out-of-band instead, by email.
        existing = await self.repo.get_user_by_email(data.contact_email)
        if existing:
            if existing.is_active:
                await _try_send_account_exists(existing)
            else:
                # Never verified — treat this as "I didn't get the code" and
                # reissue, which is what the caller actually wants. The resend
                # cooldown inside _issue_otp still applies.
                await self._issue_otp(existing, purpose="SIGNUP")
            return OtpChallengeResponse(email=data.contact_email)

        org = await self.repo.create_org(
            org_name=data.org_name,
            org_type=OrgType.CLIENT,
            contact_email=data.contact_email,
            contact_phone=data.contact_phone,
        )

        user = await self.repo.create_user(
            org_id=org.org_id,
            email=data.contact_email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            role=UserRole.CLIENT_ADMIN,
            is_org_admin=True,
            is_active=False,
        )

        await self._issue_otp(user, purpose="SIGNUP")
        return OtpChallengeResponse(email=user.email)

    # ── Login ────────────────────────────────────────────────────────────────

    async def login(self, data: LoginRequest) -> TokenResponse:
        """Validates credentials and returns access + refresh tokens."""
        user = await self.repo.get_user_by_email(data.email)

        if user and user.locked_until and user.locked_until > datetime.now(UTC):
            remaining = user.locked_until - datetime.now(UTC)
            raise AccountLockedError(max(1, int(remaining.total_seconds() // 60)))

        # Always run a verify, even when the email is unknown, so a missing
        # account costs the same time as a wrong password. Short-circuiting on
        # `not user` left a bcrypt-sized timing difference that answered "does
        # this address have an account?" without authenticating.
        password_ok = verify_password(
            data.password,
            user.hashed_password if user else _dummy_password_hash(),
        )
        if not user or not password_ok:
            if user:
                await self._register_failed_login(user)
            raise InvalidCredentialsError()

        if user.failed_login_attempts or user.locked_until:
            user.failed_login_attempts = 0
            user.locked_until = None
            await self.session.flush()

        # Offboarded by an admin — block before the OTP path so they can't
        # re-verify their way back in.
        if user.is_offboarded:
            raise AccountDeactivatedError()

        # Credentials are correct but the account hasn't been activated yet —
        # tell the caller so the UI can route to the OTP screen.
        if not user.is_active:
            raise EmailNotVerifiedError()

        return self._build_token_response(user)

    async def _register_failed_login(self, user: User) -> None:
        """Count a wrong password, and lock the account once the cap is hit.

        Deliberately ``commit()``s — the second documented exception to the
        flush-only rule, for the same reason as the OTP attempt counter above.
        The caller raises immediately after this returns, and ``get_db`` rolls
        back on an error, so a flush alone would discard the increment and the
        cap would never bite.
        """
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= MAX_LOGIN_ATTEMPTS:
            user.locked_until = datetime.now(UTC) + timedelta(
                minutes=LOGIN_LOCKOUT_MINUTES
            )
            # Reset the counter so the next lockout needs a fresh run of
            # failures rather than triggering on every attempt after the cap.
            user.failed_login_attempts = 0
        await self.session.commit()

    # ── Token refresh ────────────────────────────────────────────────────────

    async def refresh_access_token(self, refresh_token: str) -> AccessTokenResponse:
        """Validates refresh token and returns a new access token."""
        token_data = decode_token(refresh_token)

        if not token_data or token_data.token_type != "refresh":
            raise InvalidTokenError()

        if await self.repo.is_token_blacklisted(token_data.jti):
            raise InvalidTokenError()

        user = await self.repo.get_user_by_id(token_data.user_id)
        # is_offboarded is checked here too, not just in get_current_user: an
        # offboarded user must not be able to keep minting access tokens for the
        # refresh token's remaining lifetime. Mirrors login/verify_otp.
        if not user or not user.is_active or user.is_offboarded:
            raise InvalidTokenError()

        access_token, _ = create_access_token(
            user_id=user.user_id,
            role=user.role.value,
            org_id=user.org_id,
        )

        return AccessTokenResponse(access_token=access_token)

    # ── Logout ───────────────────────────────────────────────────────────────

    async def logout(
        self, access_jti: str, user_id: int, refresh_token: str | None = None
    ) -> None:
        """Blacklists the access token JTI, and the refresh token's if supplied.

        Blacklisting only the access token would leave logout cosmetic: the
        refresh token outlives it by days and can mint fresh access tokens the
        whole time. The refresh token is only honoured when it actually belongs
        to the caller, so this can't be used to revoke someone else's session.
        """
        await self.repo.blacklist_token(
            jti=access_jti,
            user_id=user_id,
            expires_at=datetime.now(UTC)
            + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )

        if not refresh_token:
            return
        token_data = decode_token(refresh_token)
        if (
            token_data
            and token_data.token_type == "refresh"
            and token_data.user_id == user_id
        ):
            await self.repo.blacklist_token(
                jti=token_data.jti,
                user_id=user_id,
                expires_at=datetime.now(UTC)
                + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            )

    # ── Invitation flow ──────────────────────────────────────────────────────

    async def invite_user(
        self,
        data: InviteRequest,
        inviting_user: User,
    ) -> OrgInvitation:
        """
        Sends an email invitation to join the inviting user's org.

        Permission (who may invite which role) is enforced upstream in the
        router via _validate_invite_permission:
          CLIENT_ADMIN     → CLIENT_USER
          CONTRACTOR_ADMIN → CONTRACTOR_USER, PROJECT_MANAGER,
                             SUPERVISOR, QUALITY_ENGINEER
          CONTRACTOR_USER  → PROJECT_MANAGER, SUPERVISOR, QUALITY_ENGINEER
        """
        token = create_invitation_token()
        expires_at = datetime.now(UTC) + timedelta(hours=48)

        invitation = await self.repo.create_invitation(
            org_id=inviting_user.org_id,
            invited_email=data.invited_email,
            role=data.role,
            invited_by=inviting_user.user_id,
            token=token,
            expires_at=expires_at,
        )

        org = await self.repo.get_org_by_id(inviting_user.org_id)

        await _try_send_invitation_email(
            invited_email=data.invited_email,
            invited_by_name=inviting_user.full_name,
            org_name=org.org_name,
            role=data.role.value,
            token=token,
        )

        return invitation

    async def accept_invitation(
        self, data: AcceptInvitationRequest
    ) -> OtpChallengeResponse:
        """
        User accepts an invitation and creates their (inactive) account. They
        must then verify the emailed OTP (via verify_otp) before tokens issue.
        """
        invitation = await self.repo.get_invitation_by_token(data.token)

        if not invitation:
            raise InvalidInvitationError()

        if invitation.status == InvitationStatus.ACCEPTED:
            raise InvitationAlreadyUsedError()

        if invitation.expires_at < datetime.now(UTC):
            raise InvalidInvitationError()

        if await self.repo.email_exists(invitation.invited_email):
            raise AlreadyExistsError("Email")

        # First user of an org is automatically org admin
        existing_org_users = await self.repo.get_users_by_org(invitation.org_id)
        is_first_user = len(existing_org_users) == 0

        user = await self.repo.create_user(
            org_id=invitation.org_id,
            email=invitation.invited_email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            role=invitation.role,
            is_org_admin=is_first_user,
            is_active=False,
        )

        # If the invite carried a project assignment, record the membership now
        # (it shows as UNVERIFIED in the team list until they verify the OTP).
        if invitation.project_id and invitation.project_role:
            await self.repo.create_project_member(
                project_id=invitation.project_id,
                user_id=user.user_id,
                org_id=user.org_id,
                project_role=invitation.project_role,
                assigned_by=invitation.invited_by,
            )

        await self.repo.mark_invitation_accepted(invitation.invitation_id)

        await self._issue_otp(user, purpose="INVITE")
        return OtpChallengeResponse(email=user.email)

    # ── Email OTP (activation) ─────────────────────────────────────────────────

    async def _issue_otp(self, user: User, purpose: str) -> None:
        """Generate, store (hashed) and email a fresh OTP for a user."""
        code = generate_otp()
        expires_at = datetime.now(UTC) + timedelta(minutes=OTP_EXPIRY_MINUTES)
        await self.repo.create_otp(
            user_id=user.user_id,
            email=user.email,
            code_hash=hash_password(code),
            purpose=purpose,
            expires_at=expires_at,
        )
        await _try_send_otp_email(email=user.email, code=code, full_name=user.full_name)

    async def verify_otp(self, data: VerifyOtpRequest) -> TokenResponse:
        """Validate the code, activate the account, and return tokens."""
        user = await self.repo.get_user_by_email(data.email)
        if not user:
            raise InvalidOtpError()

        # A deactivated account can never be reactivated through the OTP flow.
        if user.is_offboarded:
            raise AccountDeactivatedError()

        # Already-active accounts must authenticate via /auth/login — NEVER issue
        # tokens here without a valid code, or this public endpoint becomes an
        # email-only account-takeover bypass.
        if user.is_active:
            raise EmailAlreadyVerifiedError()

        otp = await self.repo.get_latest_active_otp(data.email)
        if not otp or otp.expires_at < datetime.now(UTC):
            raise InvalidOtpError()

        if not verify_password(data.code, otp.code_hash):
            # Count the miss and burn the code once the cap is hit, so the
            # 6-digit space can't be walked within the validity window. A burned
            # OTP is no longer "active", so the next attempt needs a fresh resend.
            otp.attempts += 1
            if otp.attempts >= MAX_OTP_ATTEMPTS:
                otp.consumed_at = datetime.now(UTC)
            # Deliberately commit before raising: this 400 would otherwise let
            # get_db roll the increment back, and the cap could never accumulate
            # across attempts. Only the OTP row is dirty here, so this is safe.
            await self.session.commit()
            raise InvalidOtpError()

        await self.repo.mark_otp_consumed(otp.otp_id)
        await self.repo.activate_user(user.user_id)
        user.is_active = True

        return self._build_token_response(user)

    async def resend_otp(self, data: ResendOtpRequest) -> OtpChallengeResponse:
        """Issue a fresh OTP for a not-yet-verified account."""
        user = await self.repo.get_user_by_email(data.email)
        # Only issue for a real, still-inactive, non-offboarded user. Always
        # return the same response so we don't leak which emails exist.
        if user and not user.is_active and not user.is_offboarded:
            if not await self._resend_on_cooldown(data.email):
                await self._issue_otp(user, purpose="RESEND")
        return OtpChallengeResponse(email=data.email)

    async def _resend_on_cooldown(self, email: str) -> bool:
        """True if the most recent OTP for this email is younger than the resend
        cooldown — used to throttle the email-bomb vector without leaking which
        emails exist (the caller silently no-ops either way)."""
        latest = await self.repo.get_latest_active_otp(email)
        if latest is None:
            return False
        age = datetime.now(UTC) - latest.created_at
        return age < timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS)

    # ── Me ───────────────────────────────────────────────────────────────────

    async def get_me(self, user: User) -> MeResponse:
        org = await self.repo.get_org_by_id(user.org_id)
        return MeResponse(
            user=UserResponse.model_validate(user),
            organisation=OrgResponse.model_validate(org),
        )

    # ── Profile picture ────────────────────────────────────────────────────────

    async def update_avatar(self, user: User, avatar_url: str | None) -> UserResponse:
        await self.repo.update_avatar(user.user_id, avatar_url)
        user.avatar_url = avatar_url
        return UserResponse.model_validate(user)

    # ── Offboarding (org admin deactivates/reactivates a member) ────────────────

    async def set_member_offboarded(
        self, actor: User, target_user_id: int, offboarded: bool
    ) -> UserResponse:
        """An org admin deactivates (or reactivates) one of their own users.

        Guards: only an org admin may do this; the target must be in the same
        org; an admin can neither offboard themselves nor another admin.
        """
        if not actor.is_org_admin:
            raise PermissionDeniedError(
                "Only an organisation admin can deactivate team members"
            )

        target = await self.repo.get_user_by_id(target_user_id)
        if not target or target.org_id != actor.org_id:
            raise NotFoundError("User")
        if target.user_id == actor.user_id:
            raise PermissionDeniedError("You cannot deactivate your own account")
        if target.is_org_admin:
            raise PermissionDeniedError("You cannot deactivate another admin")

        await self.repo.set_offboarded(target.user_id, offboarded)
        target.is_offboarded = offboarded
        return UserResponse.model_validate(target)

    # ── Team directory ─────────────────────────────────────────────────────────

    async def get_team(self, user: User) -> list[TeamMemberResponse]:
        """
        Everyone in the current user's org: active/unverified users plus
        pending invitations that haven't been accepted yet.
        """
        users = await self.repo.get_users_by_org(user.org_id)
        members = []
        for u in users:
            busy = await self.repo.active_project_for_user(u.user_id)
            members.append(
                TeamMemberResponse(
                    email=u.email,
                    full_name=u.full_name,
                    role=u.role,
                    status=(
                        "DEACTIVATED"
                        if u.is_offboarded
                        else "ACTIVE"
                        if u.is_active
                        else "UNVERIFIED"
                    ),
                    is_org_admin=u.is_org_admin,
                    joined_at=u.created_at,
                    user_id=u.user_id,
                    active_project_id=busy[0] if busy else None,
                    active_project_name=busy[1] if busy else None,
                )
            )

        user_emails = {u.email for u in users}
        invitations = await self.repo.get_pending_invitations_by_org(user.org_id)
        members.extend(
            TeamMemberResponse(
                email=inv.invited_email,
                full_name=None,
                role=inv.role,
                status="INVITED",
                is_org_admin=False,
                joined_at=None,
            )
            for inv in invitations
            if inv.invited_email not in user_emails
        )
        return members

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _build_token_response(self, user: User) -> TokenResponse:
        access_token, _ = create_access_token(
            user_id=user.user_id,
            role=user.role.value,
            org_id=user.org_id,
        )
        refresh_token, _ = create_refresh_token(
            user_id=user.user_id,
            role=user.role.value,
            org_id=user.org_id,
        )
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user),
        )