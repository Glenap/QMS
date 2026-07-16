"""
quality.py — Test results and QA
Schema: quality
"""

import enum
from datetime import date, datetime

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ResultStatus(str, enum.Enum):
    PENDING = "PENDING"
    PASS = "PASS"
    FAIL = "FAIL"
    CRITICAL_FAILURE = "CRITICAL_FAILURE"


class NCRStatus(str, enum.Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    CLOSED = "CLOSED"


class RetestType(str, enum.Enum):
    """IS-456 in-situ verification of hardened concrete when cube tests fail."""

    CORE_CUTTING = "CORE_CUTTING"
    REBOUND_HAMMER = "REBOUND_HAMMER"
    UPV = "UPV"  # Ultrasonic pulse velocity


class RetestResult(str, enum.Enum):
    PASS = "PASS"
    FAIL = "FAIL"


class ActionStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class ConfidenceLevel(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class CubeTest(Base):
    """
    One strength test result for a cube sample.

    result_status set by quality_engine.py (IS 456 Clause 15.4):
      PASS             → observed >= required
      FAIL             → observed >= 85% of required but < required
      CRITICAL_FAILURE → observed < 85% of required

    lab_id links to the lab the contractor chose for this test.
    Different tests on the same project can use different labs.
    """
    __tablename__ = "cube_tests"
    __table_args__ = (
        Index("idx_cube_test_sample", "sample_id"),
        Index("idx_cube_test_status", "result_status"),
        Index("idx_cube_test_date", "test_date"),
        {"schema": "quality"},
    )

    test_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sample_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("transaction.cube_samples.sample_id"), nullable=False
    )
    lab_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.testing_labs.lab_id"), nullable=True
    )
    test_age_days: Mapped[int] = mapped_column(Integer, nullable=False)  # 7 or 28
    test_date: Mapped[date] = mapped_column(Date, nullable=False)
    observed_strength_mpa: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    required_strength_mpa: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    result_status: Mapped[ResultStatus] = mapped_column(
        SAEnum(ResultStatus, schema="quality"),
        nullable=False,
        default=ResultStatus.PENDING,
    )
    tested_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    lab_report_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # PDF report the lab uploaded for this milestone, stored in master.documents.
    report_document_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.documents.document_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    cube_sample: Mapped["CubeSample"] = relationship(
        "CubeSample", back_populates="cube_tests"
    )
    ncr: Mapped["NCR | None"] = relationship(
        "NCR", back_populates="cube_test", uselist=False
    )
    ai_suggestion: Mapped["AISuggestion | None"] = relationship(
        "AISuggestion", back_populates="cube_test", uselist=False
    )


class NCR(Base):
    """
    Non-Conformance Report.
    Auto-raised by quality_engine.py on FAIL or CRITICAL_FAILURE.
    """
    __tablename__ = "ncrs"
    __table_args__ = (
        Index("idx_ncr_status", "status"),
        Index("idx_ncr_pour", "pour_id"),
        Index("idx_ncr_number", "ncr_number"),
        {"schema": "quality"},
    )

    ncr_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quality.cube_tests.test_id"), nullable=False
    )
    pour_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("transaction.pours.pour_id"), nullable=False
    )
    ncr_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    raised_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    status: Mapped[NCRStatus] = mapped_column(
        SAEnum(NCRStatus, schema="quality"),
        nullable=False,
        default=NCRStatus.OPEN,
    )
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    raised_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    cube_test: Mapped["CubeTest"] = relationship("CubeTest", back_populates="ncr")
    retests: Mapped[list["Retest"]] = relationship("Retest", back_populates="ncr")
    rmc_notifications: Mapped[list["NcrRmcNotification"]] = relationship(
        "NcrRmcNotification", back_populates="ncr"
    )
    corrective_actions: Mapped[list["CorrectiveAction"]] = relationship(
        "CorrectiveAction", back_populates="ncr"
    )
    ai_suggestion: Mapped["AISuggestion | None"] = relationship(
        "AISuggestion", back_populates="ncr", uselist=False
    )


class Retest(Base):
    """An IS-456 in-situ verification ordered on an NCR when cube tests fail.

    The QE orders a retest (a corrective measure) — core cutting / rebound
    hammer / UPV — and later records its result. ``result`` is null while the
    retest is pending; a PASS supports closing the NCR without demolition.
    """

    __tablename__ = "retests"
    __table_args__ = (
        Index("idx_retest_ncr", "ncr_id"),
        {"schema": "quality"},
    )

    retest_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ncr_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quality.ncrs.ncr_id"), nullable=False
    )
    retest_type: Mapped[RetestType] = mapped_column(
        SAEnum(RetestType, schema="quality"), nullable=False
    )
    result: Mapped[RetestResult | None] = mapped_column(
        SAEnum(RetestResult, schema="quality"), nullable=True
    )
    test_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    observed_strength_mpa: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    required_strength_mpa: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    lab_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.testing_labs.lab_id"), nullable=True
    )
    report_document_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.documents.document_id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    ordered_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    performed_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    ncr: Mapped["NCR"] = relationship("NCR", back_populates="retests")


class NcrRmcNotification(Base):
    """Audit trail of a QE emailing the RMC about an NCR (with an optional PDF
    report attached). Replaces the old money-penalty record — the lever is now a
    formal notification to the plant, not a deduction."""

    __tablename__ = "ncr_rmc_notifications"
    __table_args__ = (
        Index("idx_ncr_rmc_notification_ncr", "ncr_id"),
        {"schema": "quality"},
    )

    notification_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ncr_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quality.ncrs.ncr_id"), nullable=False
    )
    supplier_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.suppliers.supplier_id"), nullable=True
    )
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    report_document_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.documents.document_id"), nullable=True
    )
    sent_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    ncr: Mapped["NCR"] = relationship("NCR", back_populates="rmc_notifications")


class CorrectiveAction(Base):
    __tablename__ = "corrective_actions"
    __table_args__ = {"schema": "quality"}

    action_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ncr_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quality.ncrs.ncr_id"), nullable=False
    )
    action_description: Mapped[str] = mapped_column(Text, nullable=False)
    assigned_to: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[ActionStatus] = mapped_column(
        SAEnum(ActionStatus, schema="quality"),
        nullable=False,
        default=ActionStatus.PENDING,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    ncr: Mapped["NCR"] = relationship("NCR", back_populates="corrective_actions")


class AISuggestion(Base):
    """
    Ollama RAG output for a failed cube test.
    Full audit trail — stores exactly what the AI said and what context it used.
    """
    __tablename__ = "ai_suggestions"
    __table_args__ = {"schema": "quality"}

    suggestion_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ncr_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quality.ncrs.ncr_id"), nullable=False
    )
    test_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quality.cube_tests.test_id"), nullable=False
    )
    root_cause_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrective_actions_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    retrieved_chunks_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    confidence_level: Mapped[ConfidenceLevel | None] = mapped_column(
        SAEnum(ConfidenceLevel, schema="quality"), nullable=True
    )
    ndt_recommended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    ncr: Mapped["NCR"] = relationship("NCR", back_populates="ai_suggestion")
    cube_test: Mapped["CubeTest"] = relationship("CubeTest", back_populates="ai_suggestion")


class NCREmbedding(Base):
    """Cached embedding of a CLOSED NCR's resolved-case text (Phase 9 RAG corpus).

    One row per NCR, embedded from ``source_text`` (the NCR's failure context +
    its recorded root cause + corrective actions). The vector is stored as a
    plain ``double precision[]`` and similarity is computed in Python — the
    per-project corpus is small, so there is no need for pgvector. ``source_text``
    is kept so the cache can be invalidated (re-embedded) if a reopened NCR's
    resolution changes; ``model``/``dim`` record what produced the vector.
    """
    __tablename__ = "ncr_embeddings"
    __table_args__ = (
        Index("idx_ncr_embedding_ncr", "ncr_id", unique=True),
        {"schema": "quality"},
    )

    embedding_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # Uniqueness is enforced by the explicit unique index in __table_args__
    # (mirrors the migration) — no column-level unique= to avoid a duplicate.
    ncr_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quality.ncrs.ncr_id"), nullable=False
    )
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    dim: Mapped[int] = mapped_column(Integer, nullable=False)
    vector: Mapped[list[float]] = mapped_column(ARRAY(Float), nullable=False)
    source_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AlertLevel(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class AlertStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"


class Alert(Base):
    """An IS-456/10262 quality alert for the QE + PM: the 4-sample moving average
    drifting below the acceptance floor (STRENGTH_GROUP). Individual failures
    raise NCRs, not alerts, so the feed holds only what NCRs don't catch. Feeds
    the alert bell/feed."""

    __tablename__ = "alerts"
    __table_args__ = (
        Index("idx_alerts_project_status", "project_id", "status"),
        {"schema": "quality"},
    )

    alert_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("master.projects.project_id"), nullable=False
    )
    level: Mapped[AlertLevel] = mapped_column(
        SAEnum(AlertLevel, schema="quality"), nullable=False
    )
    # STRENGTH_INDIVIDUAL / STRENGTH_GROUP / TREND — kept as a string so new
    # categories don't need a DB enum migration.
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    sample_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("transaction.cube_samples.sample_id"), nullable=True
    )
    pour_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("transaction.pours.pour_id"), nullable=True
    )
    supplier_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("master.suppliers.supplier_id"), nullable=True
    )
    status: Mapped[AlertStatus] = mapped_column(
        SAEnum(AlertStatus, schema="quality"),
        nullable=False,
        default=AlertStatus.OPEN,
    )
    acknowledged_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


from app.models.transaction import CubeSample  # noqa: E402