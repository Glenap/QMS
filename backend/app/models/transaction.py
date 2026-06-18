"""
transaction.py — Live site operations
Schema: transaction
"""

import enum
from datetime import datetime, date
from sqlalchemy import (
    BigInteger, Boolean, String, DateTime, Date, Text,
    Numeric, Integer, ForeignKey, Enum as SAEnum,
    Index, UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base


class TruckStatus(str, enum.Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    ARRIVED = "ARRIVED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class PourStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Pour(Base):
    __tablename__ = "pours"
    __table_args__ = (
        Index("idx_pours_project_tower_floor", "project_id", "tower_id", "floor_id"),
        Index("idx_pours_pour_date", "pour_date"),
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
        {"schema": "transaction"},
    )

    dispatch_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
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
    __tablename__ = "pour_dispatch_links"
    __table_args__ = {"schema": "transaction"}

    link_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pour_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("transaction.pours.pour_id"), nullable=False
    )
    dispatch_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("transaction.rmc_dispatches.dispatch_id"), nullable=False
    )

    pour: Mapped["Pour"] = relationship("Pour", back_populates="dispatch_links")
    dispatch: Mapped["RMCDispatch"] = relationship("RMCDispatch", back_populates="pour_links")


class CubeSample(Base):
    __tablename__ = "cube_samples"
    __table_args__ = (
        Index("idx_cube_sample_pour", "pour_id"),
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
    no_of_cubes: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    lab_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.testing_labs.lab_id"), nullable=True
    )
    lab_dispatch_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_result_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    result_reminder_sent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    lab_dispatch_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    pour: Mapped["Pour"] = relationship("Pour", back_populates="cube_samples")
    cube_tests: Mapped[list["CubeTest"]] = relationship(
        "CubeTest", back_populates="cube_sample"
    )


from app.models.quality import CubeTest  # noqa: E402