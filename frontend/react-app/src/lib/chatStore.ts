// Browser-local memory for the project analyst chat.
//
// The backend stays stateless; the running conversation lives in localStorage
// with a 24h TTL so it survives page switches and reloads but resets after a day.
// One entry per project, keyed qms-chat-{pid}. Everything here is best-effort —
// any storage/parse error degrades to "no history" rather than throwing.

import type { ChartSpec, Clarification } from '../api/chat';

export interface StoredMsg {
  role: 'user' | 'assistant';
  text: string;
  tools?: string[];
  chart?: ChartSpec | null;
  clarification?: Clarification | null;
}

interface ChatEnvelope {
  updatedAt: number; // epoch ms of the last write
  messages: StoredMsg[];
}

const TTL_MS = 24 * 60 * 60 * 1000;
// Exported so the session teardown in tokenStorage can purge every transcript
// without re-hardcoding the prefix.
export const CHAT_KEY_PREFIX = 'qms-chat-';
const keyFor = (pid: number) => `${CHAT_KEY_PREFIX}${pid}`;

// Returns the stored messages if the entry exists and is younger than 24h,
// otherwise null (and prunes an expired entry).
export function loadChat(pid: number): StoredMsg[] | null {
  try {
    const raw = localStorage.getItem(keyFor(pid));
    if (!raw) return null;
    const env = JSON.parse(raw) as ChatEnvelope;
    if (!env || typeof env.updatedAt !== 'number' || !Array.isArray(env.messages)) return null;
    if (Date.now() - env.updatedAt >= TTL_MS) {
      localStorage.removeItem(keyFor(pid));
      return null;
    }
    return env.messages;
  } catch {
    return null;
  }
}

export function saveChat(pid: number, messages: StoredMsg[]): void {
  try {
    const env: ChatEnvelope = { updatedAt: Date.now(), messages };
    localStorage.setItem(keyFor(pid), JSON.stringify(env));
  } catch {
    // ignore quota / serialization errors — chat memory is best-effort.
  }
}

export function clearChat(pid: number): void {
  try {
    localStorage.removeItem(keyFor(pid));
  } catch {
    // ignore
  }
}
