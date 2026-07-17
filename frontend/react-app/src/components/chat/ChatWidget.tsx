// Floating project-analyst launcher: a circular button pinned bottom-right of
// every project page that toggles a compact chat popover. On first visit in a
// session it nudges with a one-time greeting bubble. Reuses the same useChat
// conversation as the full Chatbot page (same localStorage memory).

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Bot, Trash2, Sparkles } from 'lucide-react';
import type { ProjectDetail } from '../../types/master';
import { useChat } from './useChat';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import './ChatWidget.css';

// Shown once per browser session so it invites without nagging on every nav.
const GREETED_KEY = 'qms-analyst-greeted';

export const ChatWidget: React.FC<{ project: ProjectDetail }> = ({ project }) => {
  const [open, setOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const { messages, loading, send, clear } = useChat(project.project_id, project.project_name);

  const dismissGreeting = () => {
    setShowGreeting(false);
    try { sessionStorage.setItem(GREETED_KEY, '1'); } catch { /* storage unavailable */ }
  };

  // Reveal the greeting shortly after mount, unless already shown this session.
  useEffect(() => {
    let seen = false;
    try { seen = !!sessionStorage.getItem(GREETED_KEY); } catch { /* ignore */ }
    if (seen) return;
    const t = setTimeout(() => setShowGreeting(true), 1400);
    return () => clearTimeout(t);
  }, []);

  // Auto-hide the greeting after a few seconds.
  useEffect(() => {
    if (!showGreeting) return;
    const t = setTimeout(dismissGreeting, 7000);
    return () => clearTimeout(t);
  }, [showGreeting]);

  const openWidget = () => {
    setOpen(true);
    dismissGreeting();
  };

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

      {showGreeting && !open && (
        <div className="qms-chat-greeting" role="status">
          <button
            className="qms-chat-greeting-close"
            onClick={dismissGreeting}
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
          <button className="qms-chat-greeting-body" onClick={openWidget}>
            <span className="qms-chat-greeting-hi"><Sparkles size={14} /> Hi there! 👋</span>
            <span>Ask me anything about this project&apos;s data →</span>
          </button>
        </div>
      )}

      <button
        className={`qms-chat-fab ${showGreeting && !open ? 'qms-chat-fab-pulse' : ''}`}
        onClick={() => (open ? setOpen(false) : openWidget())}
        aria-label={open ? 'Close project analyst' : 'Open project analyst'}
        aria-expanded={open}
        title="Project analyst"
      >
        {open ? <X size={24} /> : <Sparkles size={24} />}
      </button>
    </>,
    document.body,
  );
};
