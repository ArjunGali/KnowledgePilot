import React, { useState, useRef, useEffect } from 'react';
import { Send, Database, Loader2, User, Bot, Sparkles } from 'lucide-react';
import './index.css';

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your RAG AI Assistant. Ingest a document first, and then ask me anything about it.',
    }
  ]);
  const [query, setQuery] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [ingestStatus, setIngestStatus] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleIngest = async () => {
    setIsIngesting(true);
    setIngestStatus(null);
    try {
      const response = await fetch('http://localhost:3000/api/ingest', {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok) {
        setIngestStatus({ success: true, message: `Successfully chunked into ${data.chunks} segments.` });
      } else {
        setIngestStatus({ success: false, message: data.error || 'Failed to ingest.' });
      }
    } catch (error) {
      setIngestStatus({ success: false, message: 'Network error or backend not running.' });
    }
    setIsIngesting(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMessage]);
    setQuery('');
    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:3000/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessages((prev) => [
          ...prev, 
          { 
            role: 'assistant', 
            content: data.answer,
            context: data.context 
          }
        ]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error. Make sure the backend is running on port 3000.' }]);
    }
    
    setIsTyping(false);
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="brand">
          <Sparkles className="text-accent-primary" />
          <span>RAG Nexus</span>
        </div>

        <div className="ingest-card">
          <Database size={32} color="var(--accent-secondary)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Knowledge Base</h3>
          <p>Process your Nvidia DOC.docx file to vectorize its contents for retrieval.</p>
          
          <button 
            className="ingest-btn" 
            onClick={handleIngest} 
            disabled={isIngesting}
          >
            {isIngesting ? <Loader2 className="spin" size={18} /> : <Database size={18} />}
            {isIngesting ? 'Processing...' : 'Ingest Document'}
          </button>
          
          {ingestStatus && (
            <div style={{ 
              marginTop: '1rem', 
              fontSize: '0.8rem', 
              color: ingestStatus.success ? '#10b981' : '#ef4444',
              padding: '0.5rem',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '6px'
            }}>
              {ingestStatus.message}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="avatar">
                {msg.role === 'user' ? <User size={20} color="white" /> : <Bot size={20} color="white" />}
              </div>
              <div className="bubble">
                {msg.content}
                {msg.context && (
                  <div className="context-sources">
                    Retrieved from {msg.context.length} chunks.
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="message assistant">
              <div className="avatar">
                <Bot size={20} color="white" />
              </div>
              <div className="bubble">
                <div className="typing-indicator">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <form className="input-wrapper" onSubmit={handleSend}>
            <input 
              type="text" 
              placeholder="Ask a question about the document..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isTyping}
            />
            <button type="submit" className="send-btn" disabled={!query.trim() || isTyping}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
