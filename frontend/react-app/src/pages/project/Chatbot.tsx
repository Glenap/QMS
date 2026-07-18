import React from 'react';
import { Bot, Sparkles, Trash2 } from 'lucide-react';
import { useProject } from '../../components/layout/ProjectLayout';
import { useChat } from '../../components/chat/useChat';
import { ChatMessages } from '../../components/chat/ChatMessages';
import { ChatInput } from '../../components/chat/ChatInput';
import './Chatbot.css';

const SUGGESTIONS = [
  'How is the project doing overall?',
  'Which supplier has the best pass rate?',
  'List the open NCRs.',
  'Show the cube pass rate by grade.',
];

export const Chatbot: React.FC = () => {
  const { project } = useProject();
  const { messages, loading, send, clear } = useChat(project.project_id, project.project_name);

  return (
    <div className="qms-chatbot-container">
      <div className="qms-chatbot-main">
        <div className="qms-chat-header">
          <div className="qms-chat-title">
            <Bot className="qms-bot-icon" size={24} />
            <div>
              <h2>Project Analyst</h2>
              <p>Answers from this project&apos;s live quality data</p>
            </div>
          </div>
          <button className="qms-chat-clear" onClick={clear} disabled={loading} title="Clear chat">
            <Trash2 size={14} /> Clear chat
          </button>
        </div>

        <ChatMessages messages={messages} loading={loading} onSend={send} />
        <ChatInput onSend={send} disabled={loading} />
      </div>

      <div className="qms-chatbot-context">
        <h3 className="qms-context-title"><Sparkles size={16} /> Try asking</h3>
        <p className="qms-context-desc">
          The analyst reads this project&apos;s live data — it won&apos;t make up numbers.
        </p>
        {SUGGESTIONS.map((s, i) => (
          <button key={i} className="qms-suggestion" onClick={() => send(s)} disabled={loading}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};
