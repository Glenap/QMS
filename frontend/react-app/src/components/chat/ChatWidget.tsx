// Floating project-analyst launcher: a circular button pinned bottom-right of
// every project page that toggles a compact chat popover. Reuses the same
// useChat conversation as the full Chatbot page (same localStorage memory).

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X, Bot, Trash2 } from 'lucide-react';
import type { ProjectDetail } from '../../types/master';
import { useChat } from './useChat';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import './ChatWidget.css';

export const ChatWidget: React.FC<{ project: ProjectDetail }> = ({ project }) => {
  const [open, setOpen] = useState(false);
  const { messages, loading, send, clear } = useChat(project.project_id, project.project_name);

  // Render into document.body: the page's scroll container (.content-area) has a
  // transform (animate-in), which would otherwise make position:fixed anchor to
  // it and scroll the button away with the page.
  return createPortal(
    <>
      {open && (
        <div className="qms-chat-widget-panel" role="dialog" aria-label="Project analyst">
          <div className="qms-chat-header">
            <div className="qms-chat-title">
              <Bot className="qms-bot-icon" size={20} />
              <div>
                <h2>Project Analyst</h2>
                <p>Answers from this project&apos;s live data</p>
              </div>
            </div>
            <div className="qms-chat-widget-actions">
              <button className="qms-chat-clear" onClick={clear} disabled={loading} title="Clear chat">
                <Trash2 size={14} />
              </button>
              <button className="qms-icon-btn" onClick={() => setOpen(false)} title="Close" aria-label="Close">
                <X size={18} />
              </button>
            </div>
          </div>
          <ChatMessages messages={messages} loading={loading} />
          <ChatInput onSend={send} disabled={loading} />
        </div>
      )}

      <button
        className="qms-chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close project analyst' : 'Open project analyst'}
        aria-expanded={open}
        title="Project analyst"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </>,
    document.body,
  );
};
