"""agent.py — analyst-agent entrypoint.

Wraps the LangGraph loop: seed a system + history + user message, run to
completion, and return the final answer, which tools were used (for transparency
in the UI), and — derived deterministically from the tool results — at most one
chart for the UI to render.
"""

import json
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.graph import build_agent_graph
from app.ai.llm import LLMClient
from app.ai.tools import CLARIFY_TOOL, project_dimensions
from app.models.master import Project
from app.schemas.chat import (
    ChartSeries,
    ChartSpec,
    ChatTurn,
    Clarification,
    ClarifyDimension,
    ClarifyOption,
)

SYSTEM_PROMPT = (
    'You are the quality analytics assistant for the construction project '
    '"{project_name}". You help with this project\'s pours, cube-strength tests, '
    "NCRs, suppliers and traceability, and nothing else.\n"
    "TOOLS: Use the tools to fetch data — never invent numbers. Base every figure on "
    "tool results and report numbers with their units. If a tool returns no data, say "
    "so plainly. You may call several tools at once for multi-part questions. Answer a "
    "reference lookup (e.g. 'which RMC supplied CUBE-011') with search_traceability, and "
    "trace_sample for full lineage; use get_target_mean for target-vs-achieved strength. "
    "The grade/supplier/tower filters take IDs — if the user names one (or you offered it "
    "as a filter), the phrase carries its id like '(grade_id 3)'; pass that id straight "
    "through, or call list_project_dimensions to resolve a bare name to its id.\n"
    "CLARIFY FIRST on broad questions: if the question would scan a lot of data and gives "
    "no scope — no period, tower, grade or supplier — (e.g. 'how is quality?', 'compare "
    "suppliers', 'show all cube tests'), call ask_clarifying_question with a short question "
    "and only the dimensions that matter, instead of guessing. Call it alone (no other "
    "tool that turn), and only once — if the user already gave a scope, just answer.\n"
    "ANSWER FORMAT: open with a one-line direct answer, then concise markdown bullets — "
    "each on its own line starting with '- ', numbers with units, no filler, no restating "
    "the question.\n"
    "If a question is outside this project's quality data, say you can only help with this "
    "project."
)

# Period presets offered when the model asks to clarify the time window.
_PERIOD_PRESETS: list[tuple[int, str]] = [(7, "Last 7 days"), (30, "Last 30 days"), (90, "Last 90 days")]


@dataclass
class AgentResult:
    answer: str
    tools_used: list[str]
    chart: ChartSpec | None = None
    clarification: Clarification | None = None


def _last_answer(messages: list[dict]) -> str:
    for msg in reversed(messages):
        if msg.get("role") == "assistant" and not msg.get("tool_calls"):
            return (msg.get("content") or "").strip()
    return ""


def _tools_used(messages: list[dict]) -> list[str]:
    used: list[str] = []
    for msg in messages:
        for tc in msg.get("tool_calls") or []:
            name = tc.get("function", {}).get("name")
            if name and name != CLARIFY_TOOL:
                used.append(name)
    return used


def _find_clarify(messages: list[dict]) -> dict | None:
    """Return the ask_clarifying_question call's arguments, if the model asked."""
    for msg in messages:
        for tc in msg.get("tool_calls") or []:
            if tc.get("function", {}).get("name") != CLARIFY_TOOL:
                continue
            args = tc["function"].get("arguments") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except (ValueError, TypeError):
                    args = {}
            return args if isinstance(args, dict) else {}
    return None


async def build_clarification(
    session: AsyncSession, project: Project, question: str, dimensions: list[str]
) -> Clarification:
    """Expand the model's requested dimensions into concrete, clickable options
    drawn from the project's real towers / grades / suppliers (+ period presets).

    Each option's ``value`` is a phrase the UI appends to the refined question,
    carrying a concrete id or date range so the next turn needs no guessing.
    """
    wanted = [d for d in dimensions if d in ("period", "tower", "grade", "supplier")]
    need_data = any(d in ("tower", "grade", "supplier") for d in wanted)
    data = await project_dimensions(session, project) if need_data else {}
    today = date.today()

    def period_dim() -> ClarifyDimension:
        opts = [
            ClarifyOption(
                label=lbl,
                value=(
                    f"from {(today - timedelta(days=n)).isoformat()} "
                    f"to {today.isoformat()} ({lbl.lower()})"
                ),
            )
            for n, lbl in _PERIOD_PRESETS
        ]
        opts.append(ClarifyOption(label="All time", value="over the entire project history"))
        return ClarifyDimension(key="period", label="Time period", options=opts)

    dims: list[ClarifyDimension] = []
    for d in wanted:
        if d == "period":
            dims.append(period_dim())
        elif d == "tower":
            opts = [ClarifyOption(label="All towers", value="across all towers")]
            opts += [
                ClarifyOption(label=t["tower_name"], value=f'in tower "{t["tower_name"]}" (tower_id {t["tower_id"]})')
                for t in data.get("towers", [])
            ]
            if len(opts) > 1:
                dims.append(ClarifyDimension(key="tower", label="Tower", options=opts))
        elif d == "grade":
            opts = [ClarifyOption(label="All grades", value="for all grades")]
            opts += [
                ClarifyOption(label=g["grade_name"], value=f'for grade {g["grade_name"]} (grade_id {g["grade_id"]})')
                for g in data.get("grades", [])
            ]
            if len(opts) > 1:
                dims.append(ClarifyDimension(key="grade", label="Grade", options=opts))
        elif d == "supplier":
            opts = [ClarifyOption(label="All suppliers", value="from all suppliers")]
            opts += [
                ClarifyOption(label=s["supplier_name"], value=f'from supplier "{s["supplier_name"]}" (supplier_id {s["supplier_id"]})')
                for s in data.get("suppliers", [])
            ]
            if len(opts) > 1:
                dims.append(ClarifyDimension(key="supplier", label="Supplier", options=opts))

    # Always give the user at least the time window to choose from.
    if not dims:
        dims.append(period_dim())
    return Clarification(question=question or "Which slice should I analyse?", dimensions=dims)


def _tool_results(messages: list[dict]) -> dict[str, Any]:
    """The first JSON result of each tool that ran, keyed by tool name."""
    results: dict[str, Any] = {}
    for msg in messages:
        if msg.get("role") != "tool":
            continue
        name = msg.get("tool_name")
        if not name or name in results:
            continue
        try:
            results[name] = json.loads(msg.get("content") or "")
        except (ValueError, TypeError):
            continue
    return results


def _derive_chart(messages: list[dict]) -> ChartSpec | None:
    """Build at most one chart from the tool results, deterministically.

    The model is not asked to produce charts (unreliable on a small local model);
    instead we read the role=='tool' JSON payloads and pick ONE chart by tool
    priority, only when the underlying data is non-empty.
    """
    results = _tool_results(messages)

    # 1. Supplier scorecard → bar of pass-rate by supplier.
    rows = results.get("get_supplier_scorecard")
    if isinstance(rows, list):
        data = [
            {"supplier_name": r.get("supplier_name"), "pass_rate_pct": r.get("pass_rate_pct")}
            for r in rows
            if isinstance(r, dict)
        ]
        if data:
            return ChartSpec(
                type="bar",
                title="Pass rate by supplier",
                x_key="supplier_name",
                series=[ChartSeries(name="Pass rate %", key="pass_rate_pct")],
                data=data[:50],
            )

    # 1b. Target mean vs achieved → grouped bar per grade (IS 10262).
    tm = results.get("get_target_mean")
    if isinstance(tm, dict):
        trows = tm.get("rows")
        if isinstance(trows, list) and trows:
            return ChartSpec(
                type="bar",
                title="Target mean vs achieved (per grade)",
                x_key="grade_name",
                series=[
                    ChartSeries(name="Target mean", key="target_mean"),
                    ChartSeries(name="Achieved avg", key="actual_mean"),
                ],
                data=[
                    {
                        "grade_name": r.get("grade_name"),
                        "target_mean": r.get("target_mean"),
                        "actual_mean": r.get("actual_mean"),
                    }
                    for r in trows
                    if isinstance(r, dict)
                ][:50],
            )

    # 2. Quality analytics → pie of result breakdown, else bar of strength buckets.
    qa = results.get("get_quality_analytics")
    if isinstance(qa, dict):
        breakdown = qa.get("result_breakdown")
        if isinstance(breakdown, list) and breakdown:
            return ChartSpec(
                type="pie",
                title="Result breakdown",
                x_key="status",
                series=[ChartSeries(name="Count", key="count")],
                data=[
                    {"status": b.get("status"), "count": b.get("count")}
                    for b in breakdown
                    if isinstance(b, dict)
                ][:50],
            )
        dist = qa.get("strength_distribution")
        if isinstance(dist, list) and dist:
            return ChartSpec(
                type="bar",
                title="Strength distribution",
                x_key="label",
                series=[ChartSeries(name="Count", key="count")],
                data=[
                    {"label": d.get("label"), "count": d.get("count")}
                    for d in dist
                    if isinstance(d, dict)
                ][:50],
            )

    # 3. NCR list → pie of NCR counts by status.
    ncrs = results.get("list_ncrs")
    if isinstance(ncrs, list) and ncrs:
        counts: dict[str, int] = {}
        for n in ncrs:
            if isinstance(n, dict):
                status = n.get("status") or "UNKNOWN"
                counts[status] = counts.get(status, 0) + 1
        if counts:
            return ChartSpec(
                type="pie",
                title="NCRs by status",
                x_key="status",
                series=[ChartSeries(name="Count", key="count")],
                data=[{"status": k, "count": v} for k, v in counts.items()],
            )

    # 4. Overview KPIs → bar of pass / fail / critical counts.
    kpis = results.get("get_overview_kpis")
    if isinstance(kpis, dict):
        data = [
            {"label": "Pass", "count": kpis.get("pass_count") or 0},
            {"label": "Fail", "count": kpis.get("fail_count") or 0},
            {"label": "Critical", "count": kpis.get("critical_count") or 0},
        ]
        if any(d["count"] for d in data):
            return ChartSpec(
                type="bar",
                title="Test results",
                x_key="label",
                series=[ChartSeries(name="Count", key="count")],
                data=data,
            )

    return None


async def run_agent(
    session: AsyncSession,
    project: Project,
    question: str,
    llm: LLMClient,
    history: list[ChatTurn] | None = None,
) -> AgentResult:
    graph = build_agent_graph(llm, session, project)
    seed: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT.format(project_name=project.project_name)},
    ]
    for turn in history or []:
        seed.append({"role": turn.role, "content": turn.content})
    seed.append({"role": "user", "content": question})

    final = await graph.ainvoke({"messages": seed, "iterations": 0})
    messages = final["messages"]

    # If the model chose to clarify, short-circuit: return the structured prompt
    # (with real filter options) instead of an answer or chart.
    clarify = _find_clarify(messages)
    if clarify is not None:
        question = str(clarify.get("question") or "").strip() or "Which slice should I analyse?"
        raw_dims = clarify.get("dimensions")
        dims = [str(d) for d in raw_dims] if isinstance(raw_dims, list) else []
        clarification = await build_clarification(session, project, question, dims)
        return AgentResult(
            answer=question, tools_used=_tools_used(messages), clarification=clarification
        )

    answer = _last_answer(messages) or "I couldn't produce an answer."
    return AgentResult(
        answer=answer,
        tools_used=_tools_used(messages),
        chart=_derive_chart(messages),
    )
