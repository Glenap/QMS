"""Integration tests for Phase 8 — the analyst agent (LLM stubbed).

A deterministic fake LLM is injected via the ``get_llm`` dependency, so these
exercise the LangGraph loop, tool dispatch and message threading without a
running Ollama model. The tools themselves run the real Phase-6 services against
the project, so a tool result reflects real (here, empty) project data.
"""

import json

import pytest

from app.ai.agent import _derive_chart
from app.ai.llm import LLMReply, ToolCall, get_llm
from app.main import app
from tests.helpers import API, bearer
from tests.integration.test_phase1_master_flow import _client_with_project


class ScriptedLLM:
    """Returns canned replies in order and records the messages it was handed."""

    def __init__(self, replies: list[LLMReply]):
        self.replies = list(replies)
        self.seen: list[list[dict]] = []

    async def chat(self, messages: list[dict], tools: list[dict]) -> LLMReply:
        self.seen.append(messages)
        return self.replies.pop(0)


def _use_llm(fake: ScriptedLLM) -> None:
    app.dependency_overrides[get_llm] = lambda: fake


@pytest.fixture(autouse=True)
def _clear_llm_override():
    yield
    app.dependency_overrides.pop(get_llm, None)


class TestAnalystAgent:
    async def test_tool_call_then_answer(self, client, db_session):
        token, project_id = await _client_with_project(client)
        fake = ScriptedLLM([
            LLMReply(tool_calls=[ToolCall(name="get_overview_kpis", arguments={})]),
            LLMReply(content="The project has 0 pours so far."),
        ])
        _use_llm(fake)

        resp = await client.post(
            f"{API}/projects/{project_id}/chat",
            json={"question": "How is the project doing?"},
            headers=bearer(token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["answer"] == "The project has 0 pours so far."
        assert body["tools_used"] == ["get_overview_kpis"]
        # The real tool result was threaded back to the model on the 2nd call.
        tool_msgs = [m for m in fake.seen[1] if m["role"] == "tool"]
        assert tool_msgs and '"pour_count": 0' in tool_msgs[0]["content"]

    async def test_history_threaded_into_prompt(self, client, db_session):
        token, project_id = await _client_with_project(client)
        fake = ScriptedLLM([LLMReply(content="You asked about pours.")])
        _use_llm(fake)

        resp = await client.post(
            f"{API}/projects/{project_id}/chat",
            json={
                "question": "what did I just ask?",
                "history": [
                    {"role": "user", "content": "How many pours are there?"},
                    {"role": "assistant", "content": "There are 0 pours."},
                ],
            },
            headers=bearer(token),
        )
        assert resp.status_code == 200, resp.text
        # The seeded history sits between the system prompt and the new question
        # on the first (only) LLM call.
        seeded = fake.seen[0]
        assert [m["role"] for m in seeded] == ["system", "user", "assistant", "user"]
        assert seeded[1]["content"] == "How many pours are there?"
        assert seeded[2]["content"] == "There are 0 pours."
        assert seeded[3]["content"] == "what did I just ask?"

    async def test_chart_is_none_when_tool_data_empty(self, client, db_session):
        token, project_id = await _client_with_project(client)
        # Empty project → the supplier scorecard tool returns [], so no chart.
        fake = ScriptedLLM([
            LLMReply(tool_calls=[ToolCall(name="get_supplier_scorecard", arguments={})]),
            LLMReply(content="No suppliers scored yet."),
        ])
        _use_llm(fake)

        resp = await client.post(
            f"{API}/projects/{project_id}/chat",
            json={"question": "show the supplier scorecard"},
            headers=bearer(token),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["chart"] is None

    async def test_direct_answer_without_tools(self, client, db_session):
        token, project_id = await _client_with_project(client)
        fake = ScriptedLLM([LLMReply(content="I can help with this project's quality data.")])
        _use_llm(fake)

        resp = await client.post(
            f"{API}/projects/{project_id}/chat",
            json={"question": "hello"},
            headers=bearer(token),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["tools_used"] == []
        assert "quality data" in resp.json()["answer"]

    async def test_parallel_multi_tool_fanout(self, client, db_session):
        token, project_id = await _client_with_project(client)
        fake = ScriptedLLM([
            LLMReply(tool_calls=[
                ToolCall(name="get_overview_kpis", arguments={}),
                ToolCall(name="get_supplier_scorecard", arguments={}),
            ]),
            LLMReply(content="Both done."),
        ])
        _use_llm(fake)

        resp = await client.post(
            f"{API}/projects/{project_id}/chat",
            json={"question": "give me the overview and the supplier scorecard"},
            headers=bearer(token),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["tools_used"] == ["get_overview_kpis", "get_supplier_scorecard"]
        tool_msgs = [m for m in fake.seen[1] if m["role"] == "tool"]
        assert {m["tool_name"] for m in tool_msgs} == {
            "get_overview_kpis",
            "get_supplier_scorecard",
        }

    async def test_tool_error_is_surfaced_not_500(self, client, db_session):
        token, project_id = await _client_with_project(client)
        fake = ScriptedLLM([
            # Ask to trace a sample that doesn't exist → tool raises NotFoundError,
            # which the loop must capture as a tool result, not a 500.
            LLMReply(tool_calls=[ToolCall(name="trace_sample", arguments={"sample_id": 999999})]),
            LLMReply(content="That sample wasn't found."),
        ])
        _use_llm(fake)

        resp = await client.post(
            f"{API}/projects/{project_id}/chat",
            json={"question": "trace sample 999999"},
            headers=bearer(token),
        )
        assert resp.status_code == 200, resp.text
        tool_msgs = [m for m in fake.seen[1] if m["role"] == "tool"]
        assert tool_msgs and "error" in tool_msgs[0]["content"]

    async def test_broad_question_returns_structured_clarification(self, client, db_session):
        token, project_id = await _client_with_project(client)
        # The model asks to clarify instead of answering a broad question.
        fake = ScriptedLLM([
            LLMReply(tool_calls=[ToolCall(
                name="ask_clarifying_question",
                arguments={
                    "question": "Which slice should I analyse?",
                    "dimensions": ["period", "tower", "grade"],
                },
            )]),
        ])
        _use_llm(fake)

        resp = await client.post(
            f"{API}/projects/{project_id}/chat",
            json={"question": "how is quality?"},
            headers=bearer(token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        clar = body["clarification"]
        assert clar is not None
        assert clar["question"] == "Which slice should I analyse?"
        # The time window is always offered, with the presets and an "All time"
        # choice; other dimensions appear only when the project has real values.
        keys = [d["key"] for d in clar["dimensions"]]
        assert "period" in keys
        period = next(d for d in clar["dimensions"] if d["key"] == "period")
        labels = [o["label"] for o in period["options"]]
        assert "Last 30 days" in labels and "All time" in labels
        assert body["tools_used"] == []          # clarify isn't a data tool
        assert body["chart"] is None
        # Clarifying ends the turn: no tools ran and no second LLM call happened.
        assert len(fake.seen) == 1

    async def test_list_project_dimensions_tool(self, client, db_session):
        token, project_id = await _client_with_project(client)
        fake = ScriptedLLM([
            LLMReply(tool_calls=[ToolCall(name="list_project_dimensions", arguments={})]),
            LLMReply(content="This project has no towers with pours yet."),
        ])
        _use_llm(fake)

        resp = await client.post(
            f"{API}/projects/{project_id}/chat",
            json={"question": "which towers do we have?"},
            headers=bearer(token),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["tools_used"] == ["list_project_dimensions"]
        tool_msgs = [m for m in fake.seen[1] if m["role"] == "tool"]
        assert tool_msgs and '"towers"' in tool_msgs[0]["content"]

    async def test_unknown_project_rejected(self, client, db_session):
        token, _ = await _client_with_project(client)
        _use_llm(ScriptedLLM([LLMReply(content="x")]))
        resp = await client.post(
            f"{API}/projects/999999/chat",
            json={"question": "hi"},
            headers=bearer(token),
        )
        assert resp.status_code == 404, resp.text


class TestChartDerivation:
    """``_derive_chart`` is pure — it builds one chart from tool-result JSON."""

    @staticmethod
    def _tool_msg(name: str, payload) -> dict:
        return {"role": "tool", "tool_name": name, "content": json.dumps(payload)}

    def test_supplier_scorecard_builds_bar_chart(self):
        messages = [
            {"role": "user", "content": "scorecard"},
            self._tool_msg("get_supplier_scorecard", [
                {"supplier_id": 1, "supplier_name": "ACME RMC", "pass_rate_pct": 92.5},
                {"supplier_id": 2, "supplier_name": "BuildMix", "pass_rate_pct": 80.0},
            ]),
            {"role": "assistant", "content": "done"},
        ]
        chart = _derive_chart(messages)
        assert chart is not None
        assert chart.type == "bar"
        assert chart.x_key == "supplier_name"
        assert [s.key for s in chart.series] == ["pass_rate_pct"]
        assert chart.data == [
            {"supplier_name": "ACME RMC", "pass_rate_pct": 92.5},
            {"supplier_name": "BuildMix", "pass_rate_pct": 80.0},
        ]

    def test_empty_supplier_scorecard_yields_no_chart(self):
        assert _derive_chart([self._tool_msg("get_supplier_scorecard", [])]) is None

    def test_target_mean_builds_grouped_bar(self):
        chart = _derive_chart([
            self._tool_msg("get_target_mean", {
                "rows": [
                    {"grade_name": "M30", "fck": 30.0, "target_mean": 38.25, "actual_mean": 34.0, "sample_count": 3},
                ],
            }),
        ])
        assert chart is not None
        assert chart.type == "bar"
        assert chart.x_key == "grade_name"
        assert [s.key for s in chart.series] == ["target_mean", "actual_mean"]
        assert chart.data[0] == {"grade_name": "M30", "target_mean": 38.25, "actual_mean": 34.0}

    def test_overview_kpis_builds_results_bar(self):
        chart = _derive_chart([
            self._tool_msg("get_overview_kpis", {
                "pass_count": 10, "fail_count": 2, "critical_count": 1,
            }),
        ])
        assert chart is not None
        assert chart.type == "bar"
        assert [row["label"] for row in chart.data] == ["Pass", "Fail", "Critical"]
        assert [row["count"] for row in chart.data] == [10, 2, 1]

    def test_no_tool_messages_yields_no_chart(self):
        assert _derive_chart([{"role": "assistant", "content": "hi"}]) is None
