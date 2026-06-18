"""
auth.py — Multi-tenant identity layer
Schema: auth
"""

import enum
from datetime import datetime
from sqlalchemy import (
    BigInteger, String, Boolean, DateTime,
    ForeignKey, Enum as SAEnum, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base


class OrgType(str, enum.Enum):
    CLIENT = "CLIENT"
    CONTRACTOR = "CONTRACTOR"


class OrgStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class UserRole(str, enum.Enum):
    CLIENT_ADMIN = "CLIENT_ADMIN"
    CONTRACTOR_ADMIN = "CONTRACTOR_ADMIN"   
    PROJECT_MANAGER = "PROJECT_MANAGER"
    QUALITY_ENGINEER = "QUALITY_ENGINEER"
    SUPERVISOR = "SUPERVISOR"


class TeamRole(str, enum.Enum):
    PROJECT_MANAGER = "PROJECT_MANAGER"
    QUALITY_ENGINEER = "QUALITY_ENGINEER"
    SUPERVISOR = "SUPERVISOR"


class InvitationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"


class Organisation(Base):
    __tablename__ = "organisations"
    __table_args__ = {"schema": "auth"}

    org_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    org_name: Mapped[str] = mapped_column(String(200), nullable=False)
    org_type: Mapped[OrgType] = mapped_column(
        SAEnum(OrgType, schema="auth"), nullable=False
    )
    status: Mapped[OrgStatus] = mapped_column(
        SAEnum(OrgStatus, schema="auth"),
        nullable=False,
        default=OrgStatus.PENDING,
    )
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    registered_by_org_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.organisations.org_id"), nullable=True
    )
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    users: Mapped[list["User"]] = relationship(
        "User", back_populates="organisation",
        foreign_keys="User.org_id"
    )
    invitations: Mapped[list["OrgInvitation"]] = relationship(
        "OrgInvitation", back_populates="organisation"
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    org_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("auth.organisations.org_id"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, schema="auth"), nullable=False
    )
    is_org_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    organisation: Mapped["Organisation"] = relationship(
        "Organisation", back_populates="users",
        foreign_keys=[org_id]
    )
    team_assignments: Mapped[list["ProjectTeam"]] = relationship(
        "ProjectTeam", back_populates="user"
    )


class ProjectTeam(Base):
    __tablename__ = "project_team"
    __table_args__ = {"schema": "auth"}

    team_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.projects.project_id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=False
    )
    role: Mapped[TeamRole] = mapped_column(
        SAEnum(TeamRole, schema="auth"), nullable=False
    )
    contractor_org_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("auth.organisations.org_id"), nullable=False
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="team_assignments")


class OrgInvitation(Base):
    __tablename__ = "org_invitations"
    __table_args__ = {"schema": "auth"}

    invitation_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    org_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("auth.organisations.org_id"), nullable=False
    )
    invited_email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, schema="auth"), nullable=False
    )
    invited_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    status: Mapped[InvitationStatus] = mapped_column(
        SAEnum(InvitationStatus, schema="auth"),
        nullable=False,
        default=InvitationStatus.PENDING,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    organisation: Mapped["Organisation"] = relationship(
        "Organisation", back_populates="invitations"
    )


class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"
    __table_args__ = {"schema": "auth"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    jti: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=False
    )
    revoked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)