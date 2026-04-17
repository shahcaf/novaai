import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SUGGESTIONS = [
  { title: '💡 Explain something', text: 'Explain quantum computing in simple terms' },
  { title: '✍️ Write for me', text: 'Write a professional email requesting a meeting' },
  { title: '🐛 Debug my code', text: 'Help me debug this JavaScript function...' },
  { title: '🌍 Translate', text: 'Translate "Hello, how are you?" into 5 languages' },
];

const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDate = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Generate conversation title from first user message
const generateTitle = (msg) => {
  if (msg.length <= 35) return msg;
  return msg.slice(0, 35) + '…';
};

// Typewriter for AI responses
const Typewriter = ({ text, delay = 8, onDone }) => {
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentText('');
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const t = setTimeout(() => {
        setCurrentText(p => p + text[currentIndex]);
        setCurrentIndex(p => p + 1);
      }, delay);
      return () => clearTimeout(t);
    } else if (onDone) {
      onDone();
    }
  }, [currentIndex, delay, text]);

  return <ReactMarkdown>{currentText || ' '}</ReactMarkdown>;
};

// Unique ID generator
let _id = 0;
const uid = () => `conv_${Date.now()}_${_id++}`;

const newConversation = () => ({
  id: uid(),
  title: 'New Chat',
  messages: [],
  createdAt: new Date(),
});

function App() {
  const [conversations, setConversations] = useState([newConversation()]);
  const [activeId, setActiveId] = useState(conversations[0].id);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const editInputRef = useRef(null);

  const activeConv = conversations.find(c => c.id === activeId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [activeConv?.messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const updateConversation = (id, updater) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updater(c) } : c));
  };

  const handleSend = async (msgText) => {
    const text = (msgText || input).trim();
    if (!text || isLoading) return;

    const convId = activeId;
    const timestamp = new Date();

    const userMessage = { role: 'user', content: text, timestamp };

    // Update title on first message
    updateConversation(convId, c => ({
      messages: [...c.messages, userMessage],
      title: c.messages.length === 0 ? generateTitle(text) : c.title,
    }));

    setInput('');
    setIsLoading(true);

    try {
      // Build history to send (only role+content, no timestamps)
      const history = activeConv.messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data } = await axios.post(`${API_BASE_URL}/chat`, {
        message: text,
        history,
      });

      const aiMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        isNew: true,
      };

      updateConversation(convId, c => ({
        messages: [...c.messages.filter(m => m.timestamp !== timestamp || m.role !== 'user'), 
                   userMessage, aiMessage],
      }));
    } catch (error) {
      let errorText = 'Connection failed. Is the server running?';
      if (error.response?.data?.error) errorText = error.response.data.error;
      updateConversation(convId, c => ({
        messages: [...c.messages, {
          role: 'assistant',
          content: `❌ ${errorText}`,
          timestamp: new Date(),
          isError: true,
        }],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const createNewConversation = () => {
    const conv = newConversation();
    setConversations(prev => [conv, ...prev]);
    setActiveId(conv.id);
    setIsSidebarOpen(false);
  };

  const deleteConversation = (id, e) => {
    e.stopPropagation();
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) {
        const fresh = newConversation();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const switchConversation = (id) => {
    setActiveId(id);
    setIsSidebarOpen(false);
  };

  const startEditing = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveTitle = (id) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      updateConversation(id, () => ({ title: trimmed }));
    }
    setEditingId(null);
  };

  const handleEditKeyDown = (e, id) => {
    if (e.key === 'Enter') { e.preventDefault(); saveTitle(id); }
    if (e.key === 'Escape') setEditingId(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group conversations by date
  const grouped = conversations.reduce((acc, c) => {
    const label = formatDate(c.createdAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(c);
    return acc;
  }, {});

  return (
    <div className="app-container">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 40,
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar ─────────────────────── */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">N</div>
          <span className="sidebar-logo-text">Nova AI</span>
        </div>

        <button className="new-chat-btn" onClick={createNewConversation}>
          ＋ New Chat
        </button>

        {/* Conversation history */}
        <div className="sidebar-scroll">
          {Object.entries(grouped).map(([label, convs]) => (
            <div key={label}>
              <div className="sidebar-section-title">{label}</div>
              {convs.map(conv => (
                <motion.div
                  key={conv.id}
                  className={`conv-item ${conv.id === activeId ? 'active' : ''}`}
                  onClick={() => editingId !== conv.id && switchConversation(conv.id)}
                  whileHover={{ x: 2 }}
                  layout
                >
                  <span className="conv-icon">💬</span>
                  {editingId === conv.id ? (
                    <input
                      ref={editInputRef}
                      className="conv-rename-input"
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onBlur={() => saveTitle(conv.id)}
                      onKeyDown={e => handleEditKeyDown(e, conv.id)}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="conv-title">{conv.title}</span>
                  )}
                  <button
                    className="conv-action-btn"
                    onClick={(e) => startEditing(conv, e)}
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    className="conv-action-btn conv-delete"
                    onClick={(e) => deleteConversation(conv.id, e)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </motion.div>
              ))}
            </div>
          ))}
        </div>

        {/* Model info */}
        <div className="sidebar-model-info">
          🤖 Model: <span>Llama 3.3</span><br />
          ⚡ Provider: <span>Groq</span><br />
          ✨ Mode: <span>Free</span>
        </div>
      </aside>

      {/* ─── Main ──────────────────────── */}
      <main className="chat-main">
        <header className="chat-header">
          <button className="menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
          <div className="header-title">
            {activeConv?.title === 'New Chat' ? 'Nova AI' : activeConv?.title}
          </div>
          <div style={{ width: 32 }} />
        </header>

        {/* Messages */}
        <section className="messages-container">
          {!activeConv?.messages.length ? (
            <div className="empty-state">
              <motion.div
                className="empty-logo"
                animate={{ boxShadow: ['0 0 20px rgba(124,106,247,0.2)', '0 0 50px rgba(124,106,247,0.5)', '0 0 20px rgba(124,106,247,0.2)'] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >N</motion.div>
              <h1 className="empty-title">How can I help you today?</h1>
              <p className="empty-subtitle">I'm Nova AI, powered by Llama 3.3. Ask me anything!</p>
              <div className="suggestions-grid">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    className="suggestion-card"
                    onClick={() => handleSend(s.text)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <strong>{s.title}</strong>
                    {s.text}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            activeConv.messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`message-wrapper ${msg.role === 'user' ? 'user' : 'ai'}`}
              >
                <div className="message-content">
                  {msg.role === 'assistant' && <div className="avatar ai-avatar">N</div>}
                  <div className="message-box">
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      msg.isNew && index === activeConv.messages.length - 1
                        ? <Typewriter text={msg.content} />
                        : <ReactMarkdown>{msg.content}</ReactMarkdown>
                    )}
                    <div className="message-meta">
                      {msg.role === 'assistant' ? 'Nova AI' : 'You'} · {formatTime(msg.timestamp)}
                    </div>
                  </div>
                  {msg.role === 'user' && <div className="avatar user-avatar">U</div>}
                </div>
              </motion.div>
            ))
          )}

          {isLoading && (
            <motion.div className="message-wrapper ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="message-content">
                <div className="avatar ai-avatar">N</div>
                <div className="message-box">
                  <div className="typing-dots"><span /><span /><span /></div>
                  <div className="message-meta">Nova AI is thinking...</div>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </section>

        {/* Input */}
        <footer className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input"
              rows={1}
              placeholder="Message Nova AI…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="input-actions">
              {input.length > 0 && <span className="char-count">{input.length}</span>}
              <button className="send-btn" onClick={() => handleSend()} disabled={!input.trim() || isLoading}>
                ➤
              </button>
            </div>
          </div>
          <div className="input-footer">
            <div className="powered-badge">
              Powered by <span className="nova-text">Nova AI</span> · Llama 3.3 via Groq
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
