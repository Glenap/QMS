"""tools.py — the analyst agent's tool surface.

Each tool is a thin, typed wrapper over an existing Phase-6 service (the metrics
chokepoint). The LLM never writes SQL: it picks a tool by name and fills its
arguments; we run the already project-scoped, RBAC-checked service and feed the
JSON result back. Adding a capability = adding a service-backed tool here.
"""

from datetime import date
from typing import Any

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.master import Grade, Project, Supplier, Tower
from app.models.transaction import Pour
from app.services.analytics_service import AnalyticsService
from app.services.ncr_service import NCRService
from app.services.traceability_service import TraceabilityService

# Tool specs in the OpenAI/Ollama function-calling shape the model consumes.
TOOL_SPECS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_overview_kpis",
            "description": (
                "Project-wide KPI summary: pour count and volume, cube-test count and "
                "pass-rate, average strength, NCR counts (open / under review / closed) "
                "and average days-to-close, and truck acceptance rate. Use for "
                "'how is the project doing' style questions."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_quality_analytics",
            "description": (
                "Cube-strength quality breakdown: pass-rate trend by grade and month, "
                "strength distribution buckets, and PASS/FAIL/CRITICAL counts. "
                "Optionally filter by grade_id, supplier_id, tower_id, or a test-date "
                "range (date_from / date_to, YYYY-MM-DD)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "grade_id": {"type": "integer"},
                    "supplier_id": {"type": "integer"},
                    "tower_id": {"type": "integer"},
                    "date_from": {"type": "string", "description": "YYYY-MM-DD"},
                    "date_to": {"type": "string", "description": "YYYY-MM-DD"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_supplier_scorecard",
            "description": (
                "Per-supplier scorecard: pours, volume, test count, pass count, "
                "pass-rate and average strength. Use to compare or rank suppliers."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_target_mean",
            "description": (
                "IS 10262 target mean strength (fck + 1.65*S) vs the actual achieved "
                "site average, per concrete grade. Use for 'are we hitting target "
                "strength' questions. Optionally filter by tower_id or a test-date range."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "tower_id": {"type": "integer"},
                    "date_from": {"type": "string", "description": "YYYY-MM-DD"},
                    "date_to": {"type": "string", "description": "YYYY-MM-DD"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_traceability",
            "description": (
                "Find cube samples by any reference (sample, pour, NCR number, challan "
                "or vehicle number). An empty query returns the most recent samples. "
                "Returns sample summaries with their worst result and NCR number."
            ),
            "parameters": {
                "type": "object",
                "properties": {"q": {"type": "string", "description": "search term"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trace_sample",
            "description": (
                "Full lineage of one cube sample by sample_id: pour, location, grade, "
                "supplier, the trucks that supplied it, and every strength test with "
                "any NCR."
            ),
            "parameters": {
                "type": "object",
                "properties": {"sample_id": {"type": "integer"}},
                "required": ["sample_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_ncrs",
            "description": (
                "List the project's NCRs (non-conformance reports) with status, grade, "
                "location, strengths and corrective-action / retest counts."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_project_dimensions",
            "description": (
                "List this project's filterable dimensions with their IDs and names: "
                "towers (tower_id/tower_name), grades used (grade_id/grade_name) and "
                "suppliers used (supplier_id/supplier_name). Call this to resolve a "
                "tower / grade / supplier NAME the user typed into the ID the other "
                "tools need."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ask_clarifying_question",
            "description": (
                "Ask the user to narrow a broad question BEFORE fetching data, when it "
                "would otherwise scan a large amount of it and no scope was given "
                "(e.g. 'how is quality?', 'compare suppliers', 'show all tests'). "
                "Provide a short question and the dimensions to offer as filter options; "
                "the UI turns each dimension into concrete clickable choices from this "
                "project's real data. Do NOT call any other tool on the same turn."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "One short question, e.g. 'Which slice should I analyse?'",
                    },
                    "dimensions": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": ["period", "tower", "grade", "supplier"],
                        },
                        "description": "Which filters to offer (only those relevant to the question).",
                    },
                },
                "required": ["question", "dimensions"],
            },
        },
    },
]

# The clarify tool is intercepted by the agent loop (it never runs as a query).
CLARIFY_TOOL = "ask_clarifying_question"

TOOL_NAMES = [spec["function"]["name"] for spec in TOOL_SPECS]


async def project_dimensions(session: AsyncSession, project: Project) -> dict[str, list[dict]]:
    """This project's towers + the grades and suppliers actually used, id + name.

    Shared by the ``list_project_dimensions`` tool (name→id resolution for the
    model) and by the clarify flow (concrete filter options for the user).
    """
    pid = project.project_id
    towers = (
        await session.execute(
            select(Tower.tower_id, Tower.tower_name)
            .where(Tower.project_id == pid)
            .order_by(Tower.tower_name)
        )
    ).all()
    grades = (
        await session.execute(
            select(Grade.grade_id, Grade.grade_name)
            .join(Pour, Pour.grade_id == Grade.grade_id)
            .where(Pour.project_id == pid)
            .distinct()
            .order_by(Grade.grade_name)
        )
    ).all()
    suppliers = (
        await session.execute(
            select(Supplier.supplier_id, Supplier.supplier_name)
            .join(Pour, Pour.supplier_horizontal_id == Supplier.supplier_id)
            .where(Pour.project_id == pid)
            .distinct()
            .order_by(Supplier.supplier_name)
        )
    ).all()
    return {
        "towers": [{"tower_id": t, "tower_name": name} for t, name in towers],
        "grades": [{"grade_id": g, "grade_name": name} for g, name in grades],
        "suppliers": [{"supplier_id": s, "supplier_name": name} for s, name in suppliers],
    }


def _jsonable(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    return value


async def run_tool(session: AsyncSession, project: Project, name: str, args: dict) -> Any:
    """Execute one tool against the project; returns a JSON-serialisable result."""
    args = args or {}

    if name == "get_overview_kpis":
        return _jsonable(await AnalyticsService(session).overview(project))

    if name == "get_quality_analytics":
        return _jsonable(
            await AnalyticsService(session).quality(
                project,
                grade_id=_as_int(args.get("grade_id")),
                supplier_id=_as_int(args.get("supplier_id")),
                tower_id=_as_int(args.get("tower_id")),
                date_from=_as_date(args.get("date_from")),
                date_to=_as_date(args.get("date_to")),
            )
        )

    if name == "get_supplier_scorecard":
        return _jsonable(await AnalyticsService(session).suppliers(project))

    if name == "get_target_mean":
        return _jsonable(
            await AnalyticsService(session).target_mean_bar(
                project,
                tower_id=_as_int(args.get("tower_id")),
                date_from=_as_date(args.get("date_from")),
                date_to=_as_date(args.get("date_to")),
            )
        )

    if name == "search_traceability":
        q = args.get("q")
        return _jsonable(
            await TraceabilityService(session).search(project, q if isinstance(q, str) else None)
        )

    if name == "trace_sample":
        sample_id = _as_int(args.get("sample_id"))
        if sample_id is None:
            return {"error": "sample_id is required"}
        return _jsonable(await TraceabilityService(session).trace_detail(project, sample_id))

    if name == "list_ncrs":
        return _jsonable(await NCRService(session).list_ncrs(project))

    if name == "list_project_dimensions":
        return await project_dimensions(session, project)

    return {"error": f"Unknown tool: {name}"}


def _as_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None
