// The project-analyst conversation: state + localStorage memory + send/clear.
// Shared by the full Chatbot page and the floating ChatWidget so both drive the
// same per-project conversation (same qms-chat-{pid} key).

import { useEffect, useRef, useState } from 'react';
import { chatApi, type ChatTurn } from '../../api/chat';
import { getApiErrorMessage } from '../../api/client';
import { loadChat, saveChat, clearChat, type StoredMsg } from '../../lib/chatStore';

export type ChatMsg = StoredMsg;

export const greeting = (name: string): ChatMsg => ({
  role: 'assistant',
  text: `Hi! I can answer questions about ${name} — pours, cube tests, NCRs, suppliers and traceability. Ask away.`,
});

export function useChat(pid: number, projectName: string) {
  const [messages, setMessages] = useState<ChatMsg[]>(
    () => loadChat(pid) ?? [greeting(projectName)],
  );
  const [loading, setLoading] = useState(false);
  const activePid = useRef(pid);

  // Re-load when switching projects (the first load is the lazy initializer).
  useEffect(() => {
    if (activePid.current === pid) return;
    activePid.current = pid;
    setMessages(loadChat(pid) ?? [greeting(projectName)]);
  }, [pid, projectName]);

  // Persist on every change — survives navigation and refreshes the 24h window.
  useEffect(() => {
    saveChat(activePid.current, messages);
  }, [messages]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    // Send only clean prior turns (role + text), capped — keeps the request
    // small and matches the backend ChatTurn shape (no charts / tool chips).
    const history: ChatTurn[] = messages.slice(-10).map((m) => ({ role: m.role, content: m.text }));
    setMessages((p) => [...p, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await chatApi.ask(pid, q, history);
      setMessages((p) => [
        ...p,
        {
          role: 'assistant',
          text: res.answer,
          tools: res.tools_used,
          chart: res.chart ?? undefined,
          clarification: res.clarification ?? undefined,
        },
      ]);
    } catch (err) {
      setMessages((p) => [
        ...p,
        { role: 'assistant', text: getApiErrorMessage(err, 'Sorry — I could not answer that.') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    clearChat(pid);
    setMessages([greeting(projectName)]);
  };

  return { messages, loading, send, clear };
}
