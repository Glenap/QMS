// Analyst-agent chat API — POST /projects/{id}/chat.
// See backend/app/routers/chatbot.py. The agent answers from the project's live
// data via read-only tools; tools_used lists which it consulted, and chart (when
// present) is a deterministic chart the backend derived from those tool results.

import { api } from './client';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChartSeries {
  name: string; // legend label
  key: string; // the data-row key this series plots
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie';
  title: string;
  x_key: string; // the data-row key for the category / x-axis
  series: ChartSeries[];
  data: Record<string, string | number | null>[];
}

export interface ClarifyOption {
  label: string; // what the user sees, e.g. "Tower A", "Last 30 days"
  value: string; // phrase appended to the refined question (carries id/date range)
}

export interface ClarifyDimension {
  key: 'period' | 'tower' | 'grade' | 'supplier';
  label: string; // section heading, e.g. "Time period"
  options: ClarifyOption[];
}

export interface Clarification {
  question: string;
  dimensions: ClarifyDimension[];
}

export interface ChatAnswer {
  answer: string;
  tools_used: string[];
  chart?: ChartSpec | null;
  clarification?: Clarification | null;
}

export const chatApi = {
  ask(projectId: number, question: string, history: ChatTurn[] = []): Promise<ChatAnswer> {
    return api
      .post<ChatAnswer>(`/projects/${projectId}/chat`, { question, history })
      .then((r) => r.data);
  },
};
