"""
transaction.py — Live site operations
Schema: transaction
"""

import enum
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class TruckStatus(str, enum.Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    ARRIVED = "ARRIVED"
    PENDING_QE = "PENDING_QE"  # supervisor admitted it; awaiting QE in-situ sign-off
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class PourStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ActionReason(str, enum.Enum):
    GRADE_MISMATCH = "GRADE_MISMATCH"
    SLUMP_MISMATCH = "SLUMP_MISMATCH"
    VOLUME_MISMATCH = "VOLUME_MISMATCH"
    OTHER = "OTHER"


class ActionItemStatus(str, enum.Enum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"


class ActionResolution(str, enum.Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class InsituResult(str, enum.Enum):
    PASS = "PASS"
    FAIL = "FAIL"


class Pour(Base):
    __tablename__ = "pours"
    __table_args__ = (
        Index("idx_pours_project_tower_floor", "project_id", "tower_id", "floor_id"),
        Index("idx_pours_pour_date", "pour_date"),
        # Phase 6 analytics group-bys (supplier scorecard, grade trend) + search.
        Index("idx_pours_project_supplier", "project_id", "supplier_horizontal_id"),
        Index("idx_pours_project_grade", "project_id", "grade_id"),
        Index("idx_pours_reference", "pour_reference"),
        {"schema": "transaction"},
    )

    pour_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.projects.project_id"), nullable=False
    )
    tower_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.towers.tower_id"), nullable=False
    )
    floor_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.floors.floor_id"), nullable=False
    )
    component_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.components.component_id"), nullable=False
    )
    grade_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.grades.grade_id"), nullable=False
    )
    supplier_horizontal_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.suppliers.supplier_id"), nullable=False
    )
    supplier_vertical_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.suppliers.supplier_id"), nullable=True
    )
    mix_design_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.mix_designs.mix_design_id"), nullable=True
    )
    pour_date: Mapped[date] = mapped_column(Date, nullable=False)
    pour_reference: Mapped[str | None] = mapped_column(String(30), nullable=True)
    volume_cum: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    sub_contractor_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[PourStatus] = mapped_column(
        SAEnum(PourStatus, schema="transaction"),
        nullable=False,
        default=PourStatus.PLANNED,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    volume_actual_cum: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    completion_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    recorded_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    cube_samples: Mapped[list["CubeSample"]] = relationship(
        "CubeSample", back_populates="pour"
    )
    dispatch_links: Mapped[list["PourDispatchLink"]] = relationship(
        "PourDispatchLink", back_populates="pour"
    )


class RMCDispatch(Base):
    __tablename__ = "rmc_dispatches"
    __table_args__ = (
        Index("idx_rmc_supplier_date", "supplier_id", "dispatch_time"),
        Index("idx_rmc_dispatch_project", "project_id"),
        {"schema": "transaction"},
    )

    dispatch_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # A dispatch is raised within a project and exists before any pour (the pour
    # is recorded from the accepted delivery), so it carries its own project_id
    # rather than being scoped through a pour.
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.projects.project_id"), nullable=False
    )
    supplier_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.suppliers.supplier_id"), nullable=False
    )
    grade_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.grades.grade_id"), nullable=False
    )
    volume_ordered_cum: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    dispatch_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    volume_received_cum: Mapped[float | None] = mapped_column(
        Numeric(8, 2), nullable=True
    )
    volume_remaining_cum: Mapped[float | None] = mapped_column(
        Numeric(8, 2), nullable=True
    )
    grade_confirmed_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.grades.grade_id"), nullable=True
    )
    grade_mismatch: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    slump_at_site_mm: Mapped[float | None] = mapped_column(
        Numeric(6, 1), nullable=True
    )
    is_complete: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    created_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    pour_links: Mapped[list["PourDispatchLink"]] = relationship(
        "PourDispatchLink", back_populates="dispatch"
    )
    truck_dispatch: Mapped["TruckDispatch | None"] = relationship(
        "TruckDispatch", back_populates="dispatch", uselist=False
    )


class TruckDispatch(Base):
    __tablename__ = "truck_dispatches"
    __table_args__ = (
        UniqueConstraint("token", name="uq_truck_token"),
        # Phase 6: dispatch acceptance metrics + traceability search.
        Index("idx_truck_dispatch", "dispatch_id"),
        Index("idx_truck_status", "status"),
        Index("idx_truck_challan", "challan_number"),
        Index("idx_truck_vehicle", "vehicle_number"),
        {"schema": "transaction"},
    )

    dispatch_token_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    dispatch_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("transaction.rmc_dispatches.dispatch_id"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    supplier_email: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[TruckStatus] = mapped_column(
        SAEnum(TruckStatus, schema="transaction"),
        nullable=False,
        default=TruckStatus.PENDING,
    )
    vehicle_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    driver_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    batch_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    challan_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    volume_cum: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    wc_ratio_actual: Mapped[float | None] = mapped_column(Numeric(5, 3), nullable=True)
    slump_at_plant_mm: Mapped[float | None] = mapped_column(Numeric(6, 1), nullable=True)
    filled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    dispatch: Mapped["RMCDispatch"] = relationship(
        "RMCDispatch", back_populates="truck_dispatch"
    )


class PourDispatchLink(Base):
    """Links a pour to the delivery it records. One delivery yields at most one
    pour, so ``dispatch_id`` is unique."""

    __tablename__ = "pour_dispatch_links"
    __table_args__ = (
        Index("idx_pdl_pour", "pour_id"),
        UniqueConstraint("dispatch_id", name="uq_pdl_dispatch"),
        {"schema": "transaction"},
    )

    link_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pour_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("transaction.pours.pour_id"), nullable=False
    )
    dispatch_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("transaction.rmc_dispatches.dispatch_id"), nullable=False
    )

    pour: Mapped["Pour"] = relationship("Pour", back_populates="dispatch_links")
    dispatch: Mapped["RMCDispatch"] = relationship("RMCDispatch", back_populates="pour_links")


class ActionItem(Base):
    """A mismatch the site supervisor flags on a delivery for the QE to resolve.
    Feeds the QE's action-required inbox; resolved when the QE accepts (after the
    in-situ test) or rejects the delivery."""

    __tablename__ = "action_items"
    __table_args__ = (
        Index("idx_action_items_project_status", "project_id", "status"),
        Index("idx_action_items_dispatch", "dispatch_id"),
        {"schema": "transaction"},
    )

    action_item_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.projects.project_id"), nullable=False
    )
    dispatch_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("transaction.rmc_dispatches.dispatch_id"), nullable=False
    )
    reason: Mapped[ActionReason] = mapped_column(
        SAEnum(ActionReason, schema="transaction"), nullable=False
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ActionItemStatus] = mapped_column(
        SAEnum(ActionItemStatus, schema="transaction"),
        nullable=False,
        default=ActionItemStatus.OPEN,
    )
    resolution: Mapped[ActionResolution | None] = mapped_column(
        SAEnum(ActionResolution, schema="transaction"), nullable=True
    )
    raised_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    resolved_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class InsituTest(Base):
    """The QE's in-situ slump-cone (workability) check on a delivery. Every truck
    the supervisor admits is gated on this: a PASS lets the QE accept the load, a
    FAIL is grounds to reject it. Target slump comes from the approved mix design."""

    __tablename__ = "insitu_tests"
    __table_args__ = (
        Index("idx_insitu_dispatch", "dispatch_id"),
        {"schema": "transaction"},
    )

    insitu_test_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    dispatch_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("transaction.rmc_dispatches.dispatch_id"), nullable=False
    )
    target_slump_mm: Mapped[str | None] = mapped_column(String(30), nullable=True)
    measured_slump_mm: Mapped[float] = mapped_column(Numeric(6, 1), nullable=False)
    result: Mapped[InsituResult] = mapped_column(
        SAEnum(InsituResult, schema="transaction"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tested_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    tested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CubeSample(Base):
    __tablename__ = "cube_samples"
    __table_args__ = (
        Index("idx_cube_sample_pour", "pour_id"),
        Index("idx_cube_sample_reference", "sample_reference"),
        {"schema": "transaction"},
    )

    sample_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pour_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("transaction.pours.pour_id"), nullable=False
    )
    sample_reference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cast_date: Mapped[date] = mapped_column(Date, nullable=False)
    cast_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    # 9 by default — three sets of 3 for the 7/14/28-day tests.
    no_of_cubes: Mapped[int] = mapped_column(Integer, default=9, nullable=False)
    lab_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.testing_labs.lab_id"), nullable=True
    )
    lab_dispatch_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_result_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    result_reminder_sent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    lab_dispatch_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # ── Lab report token flow ──
    # When the QE casts a sample against a lab, a single long-lived token is
    # issued and emailed; the lab submits the 7/14/28-day reports through it
    # (no portal account). ``testing_started_on`` is the day the lab establishes
    # as the start of curing/testing — it anchors the milestone due-date schedule.
    report_token: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )
    report_token_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # When the lab physically received the cubes — a distinct point on the
    # timeline between casting and the testing day it then establishes.
    cube_received_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    testing_started_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    pour: Mapped["Pour"] = relationship("Pour", back_populates="cube_samples")
    cube_tests: Mapped[list["CubeTest"]] = relationship(
        "CubeTest", back_populates="cube_sample"
    )


from app.models.quality import CubeTest  # noqa: E402