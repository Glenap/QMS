"""agent.py — analyst-agent entrypoint.

Wraps the LangGraph loop: seed a system + history + user message, run to
completion, and return the final answer, which tools were used (for transparency
in the UI), and — derived deterministically from the tool results — at most one
chart for the UI to render.
"""

import json
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.graph import build_agent_graph
from app.ai.llm import LLMClient
from app.models.master import Project
from app.schemas.chat import ChartSeries, ChartSpec, ChatTurn

SYSTEM_PROMPT = (
    'You are the quality analytics assistant for the construction project '
    '"{project_name}". You help with this project\'s pours, cube-strength tests, '
    "NCRs, suppliers and traceability.\n"
    "Use the provided tools to fetch data — never invent numbers. Base every figure "
    "on tool results and report numbers with their units. If a tool returns no data, "
    "say so plainly. You may call several tools at once for multi-part questions. "
    "If a question is outside this project's quality data, say you can only help with "
    "this project.\n"
    "Answer format: open with a one-line direct answer, then present the details as "
    "concise markdown bullet points — each bullet on its own line starting with "
    "'- '. Keep every bullet short, give numbers with their units, and don't restate "
    "the question or add filler.\n"
    "If the question is ambiguous about the time period or about which grade, supplier "
    "or tower it means, ask ONE short clarifying question that offers 2–4 concrete "
    "options, instead of guessing — and do not call any tools on that turn."
)


@dataclass
class AgentResult:
    answer: str
    tools_used: list[str]
    chart: ChartSpec | None = None


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
            if name:
                used.append(name)
    return used


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
    answer = _last_answer(final["messages"]) or "I couldn't produce an answer."
    return AgentResult(
        answer=answer,
        tools_used=_tools_used(final["messages"]),
        chart=_derive_chart(final["messages"]),
    )
