"""graph.py — the LangGraph agent loop.

A small ReAct-style graph: the *model* node calls the LLM with the tool surface;
if it returns tool calls, the *tools* node runs them **concurrently** (that's the
parallel fan-out that answers multi-part questions in one turn), appends the
results, and hands back to the model to synthesise. The loop ends when the model
answers without calling a tool, or the iteration cap is hit.
"""

import asyncio
import json
import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import LLMClient
from app.ai.tools import CLARIFY_TOOL, TOOL_SPECS, run_tool
from app.config import settings
from app.models.master import Project


class AgentState(TypedDict):
    messages: Annotated[list[dict], operator.add]
    iterations: int


def _calls_of(message: dict) -> list[tuple[str, dict]]:
    return [
        (tc["function"]["name"], tc["function"].get("arguments") or {})
        for tc in message.get("tool_calls") or []
    ]


def build_agent_graph(llm: LLMClient, session: AsyncSession, project: Project):
    """Compile a fresh graph bound to one request's llm / session / project."""

    async def call_model(state: AgentState) -> dict:
        reply = await llm.chat(state["messages"], TOOL_SPECS)
        assistant: dict = {"role": "assistant", "content": reply.content or ""}
        if reply.tool_calls:
            assistant["tool_calls"] = [
                {"function": {"name": tc.name, "arguments": tc.arguments}}
                for tc in reply.tool_calls
            ]
        return {"messages": [assistant], "iterations": state["iterations"] + 1}

    async def run_tools(state: AgentState) -> dict:
        calls = _calls_of(state["messages"][-1])

        async def one(name: str, args: dict) -> dict:
            try:
                result = await run_tool(session, project, name, args)
            except Exception as exc:  # surface to the model, don't 500 the request
                result = {"error": f"{type(exc).__name__}: {exc}"}
            return {
                "role": "tool",
                "tool_name": name,
                "content": json.dumps(result, default=str),
            }

        messages = await asyncio.gather(*(one(n, a) for n, a in calls))
        return {"messages": list(messages)}

    def should_continue(state: AgentState) -> str:
        last = state["messages"][-1]
        calls = last.get("tool_calls") or []
        # Asking to clarify ends the turn — the agent returns the structured
        # question instead of running any tool or answering from partial data.
        if any(tc["function"]["name"] == CLARIFY_TOOL for tc in calls):
            return "end"
        if calls and state["iterations"] < settings.AGENT_MAX_ITERATIONS:
            return "tools"
        return "end"

    graph = StateGraph(AgentState)
    graph.add_node("model", call_model)
    graph.add_node("tools", run_tools)
    graph.add_edge(START, "model")
    graph.add_conditional_edges("model", should_continue, {"tools": "tools", "end": END})
    graph.add_edge("tools", "model")
    return graph.compile()
