import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Send, Bot, User, Search, Paperclip } from 'lucide-react';
import './Chatbot.css';

export const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I am your QMS Assistant. I can analyze test results, trace pours, and explain quality parameters. What would you like to know?' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setInput('');
    
    // Simulate thinking
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Based on the tracebility records for PRJ-2024-001, the failed cube (RES-2024-1045) was linked to Pour Card PC-T1-5F-SLB-20240601-001. The pour was executed by L&T and the concrete was supplied by UltraTech Whitefield plant. Notably, Truck 7 (KA-05-AB-1240) had an extended transit time of 98 minutes and 12L of water was added at site.' }]);
    }, 1500);
  };

  return (
    <div className="qms-chatbot-container">
      <div className="qms-chatbot-main">
        <div className="qms-chat-header">
          <div className="qms-chat-title">
            <Bot className="qms-bot-icon" size={24} />
            <div>
              <h2>QMS AI Assistant</h2>
              <p>Powered by RAG — Context-aware project querying</p>
            </div>
          </div>
        </div>

        <div className="qms-chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`qms-message qms-message--${msg.role}`}>
              <div className="qms-message-avatar">
                {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
              </div>
              <div className="qms-message-bubble">
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <div className="qms-chat-input-area">
          <div className="qms-input-box">
            <button className="qms-icon-btn"><Paperclip size={18} /></button>
            <input 
              type="text" 
              placeholder="Ask about pour cards, lab results, or NCRs..." 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button className="qms-send-btn" onClick={handleSend}><Send size={18} /></button>
          </div>
        </div>
      </div>

      <div className="qms-chatbot-context">
        <h3 className="qms-context-title"><Search size={16} /> Reference Context</h3>
        <p className="qms-context-desc">The AI is currently retrieving information from the following records:</p>
        
        <Card className="qms-context-card" padding="sm">
          <div className="qms-ctx-type">POUR CARD</div>
          <div className="qms-ctx-id">PC-T1-5F-SLB-20240601-001</div>
          <div className="qms-ctx-meta">01-Jun-2024 · 210 m³</div>
        </Card>
        
        <Card className="qms-context-card" padding="sm">
          <div className="qms-ctx-type">CUBE RESULT</div>
          <div className="qms-ctx-id">RES-2024-1045</div>
          <div className="qms-ctx-meta">FAIL · 37.2 MPa · ENVTECH</div>
        </Card>
        
        <Card className="qms-context-card" padding="sm">
          <div className="qms-ctx-type">NCR</div>
          <div className="qms-ctx-id">NCR-2024-015</div>
          <div className="qms-ctx-meta">High Severity · Open</div>
        </Card>
      </div>
    </div>
  );
};
