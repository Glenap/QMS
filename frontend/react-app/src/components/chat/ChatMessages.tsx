// The scrollable message thread: user/assistant bubbles with pre-wrap text,
// an optional derived chart, and the "which data I consulted" tool chips.
// Shared by the Chatbot page and the floating ChatWidget.

import React, { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import { ChatChart } from './ChatChart';
import type { ChatMsg } from './useChat';
import './chat.css';

const TOOL_LABEL: Record<string, string> = {
  get_overview_kpis: 'Overview KPIs',
  get_quality_analytics: 'Quality analytics',
  get_supplier_scorecard: 'Supplier scorecard',
  search_traceability: 'Traceability search',
  trace_sample: 'Sample lineage',
  list_ncrs: 'NCRs',
};

export const ChatMessages: React.FC<{ messages: ChatMsg[]; loading: boolean }> = ({ messages, loading }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="qms-chat-messages">
      {messages.map((msg, i) => (
        <div key={i} className={`qms-message qms-message--${msg.role}`}>
          <div className="qms-message-avatar">
            {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
          </div>
          <div className="qms-message-bubble">
            <div className="qms-msg-text">{msg.text}</div>
            {msg.chart && <ChatChart spec={msg.chart} />}
            {msg.tools && msg.tools.length > 0 && (
              <div className="qms-msg-tools">
                {msg.tools.map((t, j) => (
                  <span key={j} className="qms-tool-chip">{TOOL_LABEL[t] ?? t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {loading && (
        <div className="qms-message qms-message--assistant">
          <div className="qms-message-avatar"><Bot size={18} /></div>
          <div className="qms-message-bubble qms-message-bubble--thinking">Analysing…</div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
};
