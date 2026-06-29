// The chat composer: a rounded input + send button. Owns its own draft text and
// calls onSend(text) on Enter / click. Shared by the page and the widget.

import React, { useState } from 'react';
import { Send } from 'lucide-react';

export const ChatInput: React.FC<{ onSend: (text: string) => void; disabled?: boolean }> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');

  const submit = () => {
    const q = input.trim();
    if (!q || disabled) return;
    onSend(q);
    setInput('');
  };

  return (
    <div className="qms-chat-input-area">
      <div className="qms-input-box">
        <input
          type="text"
          placeholder="Ask about pours, lab results, suppliers or NCRs…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          disabled={disabled}
        />
        <button className="qms-send-btn" onClick={submit} disabled={disabled || !input.trim()}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
