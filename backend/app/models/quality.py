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


class PenaltyType(str, enum.Enum):
    RATE_REDUCTION = "RATE_REDUCTION"
    REJECTION = "REJECTION"
    DEMOLITION = "DEMOLITION"


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
    penalties: Mapped[list["Penalty"]] = relationship("Penalty", back_populates="ncr")
    corrective_actions: Mapped[list["CorrectiveAction"]] = relationship(
        "CorrectiveAction", back_populates="ncr"
    )
    ai_suggestion: Mapped["AISuggestion | None"] = relationship(
        "AISuggestion", back_populates="ncr", uselist=False
    )


class Penalty(Base):
    __tablename__ = "penalties"
    __table_args__ = {"schema": "quality"}

    penalty_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ncr_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quality.ncrs.ncr_id"), nullable=False
    )
    penalty_type: Mapped[PenaltyType] = mapped_column(
        SAEnum(PenaltyType, schema="quality"), nullable=False
    )
    amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    applied_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("auth.users.user_id"), nullable=True
    )
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    ncr: Mapped["NCR"] = relationship("NCR", back_populates="penalties")


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


from app.models.transaction import CubeSample  # noqa: E402