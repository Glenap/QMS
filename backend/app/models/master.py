"""
master.py — Reference data
Schema: master

Key addition: ProjectContractor junction table
Handles both cases:
  tower_id = specific tower  → contractor for that tower only
  tower_id = null            → contractor handles whole project
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


class ProjectStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    ON_HOLD = "ON_HOLD"


class ProjectType(str, enum.Enum):
    RESIDENTIAL = "RESIDENTIAL"
    COMMERCIAL = "COMMERCIAL"
    MIXED_USE = "MIXED_USE"
    INFRASTRUCTURE = "INFRASTRUCTURE"


class ComponentType(str, enum.Enum):
    COLUMN = "COLUMN"
    SLAB = "SLAB"
    BEAM = "BEAM"
    RAFT = "RAFT"
    SHEAR_WALL = "SHEAR_WALL"
    STAIRCASE = "STAIRCASE"
    LIFT_CORE = "LIFT_CORE"
    FOUNDATION = "FOUNDATION"


class GradeType(str, enum.Enum):
    NORMAL = "NORMAL"
    FREE_FLOW = "FREE_FLOW"


class ISCode(str, enum.Enum):
    IS_456 = "IS_456"
    IS_516 = "IS_516"


class CementType(str, enum.Enum):
    OPC_43 = "OPC_43"
    OPC_53 = "OPC_53"


class LabType(str, enum.Enum):
    IN_HOUSE = "IN_HOUSE"
    THIRD_PARTY = "THIRD_PARTY"


class MixApprovalStatus(str, enum.Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_PROGRESS = "IN_PROGRESS"


class Project(Base):
    """
    Owned by a CLIENT org.
    Has multiple contractors via ProjectContractor.
    contractor_org_id removed — now handled by ProjectContractor table.
    """
    __tablename__ = "projects"
    __table_args__ = {"schema": "master"}

    project_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # CLIENT org that owns this project
    org_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("auth.organisations.org_id"), nullable=False
    )
    project_name: Mapped[str] = mapped_column(String(200), nullable=False)
    project_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    project_location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        SAEnum(ProjectStatus, schema="master"),
        nullable=False,
        default=ProjectStatus.ACTIVE,
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Size metrics from file headers
    plot_area_acres: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    builtup_area_sqft: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    saleable_area_sqft: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    no_of_towers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    no_of_flats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # ── Phase 1 extension: richer fields captured by the Project Master form ──
    project_type: Mapped[ProjectType | None] = mapped_column(
        SAEnum(ProjectType, schema="master"), nullable=True
    )
    gst_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(300), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pin_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    geo_coordinates: Mapped[str | None] = mapped_column(String(100), nullable=True)
    site_area_sqm: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    no_of_basements: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_floors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    acceptance_criteria: Mapped[str | None] = mapped_column(String(50), nullable=True)
    min_cube_samples: Mapped[str | None] = mapped_column(String(100), nullable=True)
    early_test_age_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mid_test_age_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    final_test_age_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    characteristic_strength_pct: Mapped[float | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    ncr_trigger: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    towers: Mapped[list["Tower"]] = relationship("Tower", back_populates="project")
    project_contractors: Mapped[list["ProjectContractor"]] = relationship(
        "ProjectContractor", back_populates="project"
    )


class ProjectContractor(Base):
    """
    Which contractor is assigned to which project and towers.

    CLIENT registers contractor org on portal, then creates
    this assignment record.

    Two cases handled:
      tower_id filled  → contractor handles that specific tower
      tower_id null    → contractor handles entire project

    Example from Godrej Woods:
      Woods | Chawla | Tower 1 | Phase I
      Woods | Chawla | Tower 2 | Phase I
      Woods | Chawla | Tower 3 | Phase I
      Woods | SS Con | Tower 4 | Phase II
      Woods | SS Con | Tower 5 | Phase II
      Woods | SS Con | Tower 6 | Phase II
    """
    __tablename__ = "project_contractors"
    __table_args__ = (
        Index("idx_pc_project", "project_id"),
        Index("idx_pc_contractor", "contractor_org_id"),
        {"schema": "master"},
    )

    pc_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.projects.project_id"), nullable=False
    )
    contractor_org_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("auth.organisations.org_id"), nullable=False
    )
    # null = handles whole project, filled = handles specific tower
    tower_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.towers.tower_id"), nullable=True
    )
    # e.g. "Phase I", "Phase II", "Civil", "Structural"
    scope: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Contractor accept/decline of the project: PENDING | ACCEPTED | DECLINED
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="PENDING"
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # CLIENT-side user who created this assignment
    assigned_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=False
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    project: Mapped["Project"] = relationship(
        "Project", back_populates="project_contractors"
    )


class Tower(Base):
    __tablename__ = "towers"
    __table_args__ = (
        UniqueConstraint("project_id", "tower_name", name="uq_tower_project_name"),
        {"schema": "master"},
    )

    tower_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.projects.project_id"), nullable=False
    )
    tower_name: Mapped[str] = mapped_column(String(50), nullable=False)
    tower_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # e.g. "2B+G+27"
    tower_description: Mapped[str | None] = mapped_column(String(50), nullable=True)
    floors_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    no_of_flats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    flats_per_floor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # ── Phase 1 extension: per-tower fields from the Project Master form ──
    tower_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    no_of_basements: Mapped[int | None] = mapped_column(Integer, nullable=True)
    floor_height_m: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    start_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    construction_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="towers")
    floors: Mapped[list["Floor"]] = relationship("Floor", back_populates="tower")


class Floor(Base):
    __tablename__ = "floors"
    __table_args__ = (
        UniqueConstraint("tower_id", "floor_label", name="uq_floor_tower_label"),
        {"schema": "master"},
    )

    floor_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tower_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.towers.tower_id"), nullable=False
    )
    floor_label: Mapped[str] = mapped_column(String(50), nullable=False)
    floor_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    tower: Mapped["Tower"] = relationship("Tower", back_populates="floors")


class Component(Base):
    __tablename__ = "components"
    __table_args__ = {"schema": "master"}

    component_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    component_type: Mapped[ComponentType] = mapped_column(
        SAEnum(ComponentType, schema="master"), nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class Grade(Base):
    __tablename__ = "grades"
    __table_args__ = (
        UniqueConstraint("grade_name", name="uq_grade_name"),
        {"schema": "master"},
    )

    grade_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    grade_name: Mapped[str] = mapped_column(String(30), nullable=False)
    grade_type: Mapped[GradeType] = mapped_column(
        SAEnum(GradeType, schema="master"),
        nullable=False,
        default=GradeType.NORMAL,
    )
    min_strength_mpa: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    # Variant suffix: SCC, Screed, P, C, S
    grade_variant: Mapped[str | None] = mapped_column(String(20), nullable=True)

    thresholds: Mapped[list["GradeThreshold"]] = relationship(
        "GradeThreshold", back_populates="grade"
    )
    mix_designs: Mapped[list["MixDesign"]] = relationship(
        "MixDesign", back_populates="grade"
    )


class GradeThreshold(Base):
    __tablename__ = "grade_thresholds"
    __table_args__ = (
        UniqueConstraint("grade_id", "test_age_days", name="uq_threshold_grade_age"),
        {"schema": "master"},
    )

    threshold_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    grade_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.grades.grade_id"), nullable=False
    )
    test_age_days: Mapped[int] = mapped_column(Integer, nullable=False)
    min_strength_mpa: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    is_code: Mapped[ISCode] = mapped_column(
        SAEnum(ISCode, schema="master"),
        nullable=False,
        default=ISCode.IS_456,
    )

    grade: Mapped["Grade"] = relationship("Grade", back_populates="thresholds")


class Supplier(Base):
    """
    RMC company. Created by contractor on portal.
    No portal account — interacts only via email dispatch links.
    Same RMC company (e.g. Ultratech) can appear as separate
    records for different contractors — intentional, different
    contact persons per contractor.
    """
    __tablename__ = "suppliers"
    __table_args__ = {"schema": "master"}

    supplier_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    contractor_org_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("auth.organisations.org_id"), nullable=False
    )
    # Project this supplier was registered for (new records require it).
    project_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.projects.project_id"), nullable=True
    )
    supplier_name: Mapped[str] = mapped_column(String(200), nullable=False)
    plant_location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    plant_distance_km: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # ── Confirmation handshake (passwordless, token-based) ──
    # PENDING → CONFIRMED / DECLINED. The supplier never gets a portal account;
    # they confirm their details via a tokenised email link.
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="PENDING"
    )
    confirmation_token: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )
    confirmation_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # ── Phase 1 extension: fields from the RMC Supplier Registration form ──
    plant_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gst_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    pan_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    transit_time_mins: Mapped[int | None] = mapped_column(Integer, nullable=True)
    primary_contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    primary_contact_designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dispatch_manager_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    dispatch_mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)
    plant_capacity_cum_hr: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    no_transit_mixers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    no_concrete_pumps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    qms_certification: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    mix_designs: Mapped[list["MixDesign"]] = relationship(
        "MixDesign", back_populates="supplier"
    )


class MixDesign(Base):
    __tablename__ = "mix_designs"
    __table_args__ = (
        Index("idx_mix_supplier_grade_project", "supplier_id", "grade_id", "project_id"),
        {"schema": "master"},
    )

    mix_design_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    supplier_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.suppliers.supplier_id"), nullable=False
    )
    grade_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.grades.grade_id"), nullable=False
    )
    project_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.projects.project_id"), nullable=True
    )
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_original_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    contractor_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Proportions (kg/cum SSD)
    cement_kg: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    flyash_kg: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    water_kg: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    fine_agg_kg: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    fine_agg_2_kg: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    coarse_20mm_kg: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    coarse_10mm_kg: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    admixture_kg: Mapped[float | None] = mapped_column(Numeric(7, 3), nullable=True)
    admixture_brand: Mapped[str | None] = mapped_column(String(100), nullable=True)
    admixture_product: Mapped[str | None] = mapped_column(String(100), nullable=True)
    admixture_pct: Mapped[float | None] = mapped_column(Numeric(5, 3), nullable=True)
    wc_ratio: Mapped[float | None] = mapped_column(Numeric(5, 3), nullable=True)
    cement_type: Mapped[CementType | None] = mapped_column(
        SAEnum(CementType, schema="master"), nullable=True
    )
    # Aggregate sources
    coarse_agg_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fine_agg_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fine_agg_2_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    flyash_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Trial mix results
    trial_mix_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    strength_1day_mpa: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    strength_3day_mpa: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    strength_7day_mpa: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    strength_28day_mpa: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    approval_status: Mapped[MixApprovalStatus | None] = mapped_column(
        SAEnum(MixApprovalStatus, schema="master"), nullable=True
    )
    approval_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    approved_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="mix_designs")
    grade: Mapped["Grade"] = relationship("Grade", back_populates="mix_designs")


class TestingLab(Base):
    __tablename__ = "testing_labs"
    __table_args__ = {"schema": "master"}

    lab_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    contractor_org_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("auth.organisations.org_id"), nullable=False
    )
    # Project this lab was registered for (new records require it).
    project_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.projects.project_id"), nullable=True
    )
    lab_name: Mapped[str] = mapped_column(String(200), nullable=False)
    lab_type: Mapped[LabType] = mapped_column(
        SAEnum(LabType, schema="master"), nullable=False
    )
    accreditation_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # ── Confirmation handshake (passwordless, token-based) ──
    # PENDING → CONFIRMED / DECLINED. The lab never gets a portal account; they
    # confirm their details (and complete their profile) via a tokenised link.
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="PENDING"
    )
    confirmation_token: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )
    confirmation_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # ── Phase 1 extension: fields from the External Lab Registration form ──
    registration_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gst_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(300), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lab_manager_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    alternate_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nabl_accredited: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nabl_certificate_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    nabl_expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    ctm_calibration_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ctm_calibration_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    ctm_capacity_kn: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )