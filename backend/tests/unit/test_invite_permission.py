"""Unit tests for the "who can invite whom" matrix in app.routers.auth."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.models.auth import UserRole
from app.routers.auth import _validate_invite_permission


def _user(role: UserRole) -> SimpleNamespace:
    # _validate_invite_permission only reads `.role` (and `.role.value` on error).
    return SimpleNamespace(role=role)


# (inviter, target) pairs that should be allowed. Org invites are now
# designation-less — an admin only adds generic team members; the functional
# designation (PM/QE/Supervisor) is assigned per project.
ALLOWED = [
    (UserRole.CLIENT_ADMIN, UserRole.CLIENT_USER),
    (UserRole.CONTRACTOR_ADMIN, UserRole.CONTRACTOR_USER),
]

# (inviter, target) pairs that must be rejected.
FORBIDDEN = [
    # Designations are no longer org roles — they can't be invited into the org.
    (UserRole.CONTRACTOR_ADMIN, UserRole.PROJECT_MANAGER),
    (UserRole.CONTRACTOR_ADMIN, UserRole.SUPERVISOR),
    (UserRole.CONTRACTOR_ADMIN, UserRole.QUALITY_ENGINEER),
    # Each admin only builds their own side's team.
    (UserRole.CLIENT_ADMIN, UserRole.CONTRACTOR_USER),
    (UserRole.CONTRACTOR_ADMIN, UserRole.CLIENT_USER),
    (UserRole.CLIENT_ADMIN, UserRole.CONTRACTOR_ADMIN),
    (UserRole.CLIENT_ADMIN, UserRole.CLIENT_ADMIN),
    (UserRole.CONTRACTOR_ADMIN, UserRole.CONTRACTOR_ADMIN),
    # Non-admins cannot invite anyone.
    (UserRole.CLIENT_USER, UserRole.CLIENT_USER),
    (UserRole.CONTRACTOR_USER, UserRole.CONTRACTOR_USER),
    (UserRole.PROJECT_MANAGER, UserRole.QUALITY_ENGINEER),
    (UserRole.QUALITY_ENGINEER, UserRole.SUPERVISOR),
    (UserRole.SUPERVISOR, UserRole.QUALITY_ENGINEER),
]


@pytest.mark.parametrize("inviter, target", ALLOWED)
def test_allowed_invites_do_not_raise(inviter, target):
    # Should simply return without raising.
    _validate_invite_permission(_user(inviter), target)


@pytest.mark.parametrize("inviter, target", FORBIDDEN)
def test_forbidden_invites_raise_403(inviter, target):
    with pytest.raises(HTTPException) as exc_info:
        _validate_invite_permission(_user(inviter), target)
    assert exc_info.value.status_code == 403
