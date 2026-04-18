import React, { useState, useEffect, useRef, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import { AuthContext } from './context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SUGGESTIONS = [
  { title: '✍️ Write a story', text: 'about a time-traveling robot in ancient Rome.' },
  { title: '💡 Explain coding', text: 'concept of "Recursion" for a 5-year-old.' },
  { title: '✈️ Plan a trip', text: '5-day itinerary for Tokyo with a focus on food.' },
  { title: '🚀 Debugging help', text: 'Why is my React useEffect running twice?' },
];

function App() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem('nova_convs');
    return saved ? JSON.parse(saved) : [{ 
      id: 'default', 
      title: 'New Chat', 
      messages: [], 
      createdAt: new Date().toISOString() 
    }];
  });
  const [activeId, setActiveId] = useState('default');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  // Settings State
  const [activeModel, setActiveModel] = useState('Llama 3.3 (70B)');
  const [fontSize, setFontSize] = useState('Medium');

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const editInputRef = useRef(null);

  const activeConv = conversations.find(c => c.id === activeId) || conversations[0];

  useEffect(() => {
    localStorage.setItem('nova_convs', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages, isLoading]);

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

  const createNewConversation = () => {
    const newConv = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString()
    };
    setConversations([newConv, ...conversations]);
    setActiveId(newConv.id);
    setIsSidebarOpen(false);
  };

  const deleteConversation = (id, e) => {
    e.stopPropagation();
    const filtered = conversations.filter(c => c.id !== id);
    if (!filtered.length) {
      createNewConversation();
    } else {
      if (activeId === id) setActiveId(filtered[0].id);
      setConversations(filtered);
    }
  };

  const clearAllHistory = () => {
    if (window.confirm('Are you sure you want to delete ALL chat history? This cannot be undone.')) {
      const resetConv = [{ 
        id: 'default', 
        title: 'New Chat', 
        messages: [], 
        createdAt: new Date().toISOString() 
      }];
      setConversations(resetConv);
      setActiveId('default');
      setIsSettingsOpen(false);
    }
  };

  const startEditing = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const saveTitle = (id) => {
    if (!editingTitle.trim()) return setEditingId(null);
    setConversations(conversations.map(c => 
      c.id === id ? { ...c, title: editingTitle } : c
    ));
    setEditingId(null);
  };

  const handleSend = async (text = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage = { 
      role: 'user', 
      content: text, 
      timestamp: new Date().toISOString() 
    };
    
    const updatedMessages = [...activeConv.messages, userMessage];
    
    let newTitle = activeConv.title;
    if (activeConv.title === 'New Chat') {
      newTitle = text.slice(0, 30) + (text.length > 30 ? '...' : '');
    }

    setConversations(conversations.map(c => 
      c.id === activeId ? { ...c, messages: updatedMessages, title: newTitle } : c
    ));
    
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/chat`, {
        messages: updatedMessages.map(m => ({ role: m.role, content: m.content }))
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });

      const aiMessage = { 
        role: 'assistant', 
        content: response.data.content, 
        timestamp: new Date().toISOString(),
        isNew: true 
      };

      setConversations(prev => prev.map(c => 
        c.id === activeId ? { ...c, messages: [...c.messages, aiMessage] } : c
      ));
    } catch (err) {
      console.error(err);
      const errorMessage = { 
        role: 'assistant', 
        content: "I'm sorry, I encountered an error. Please check your connection.", 
        timestamp: new Date().toISOString() 
      };
      setConversations(prev => prev.map(c => 
        c.id === activeId ? { ...c, messages: [...c.messages, errorMessage] } : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Today';
    now.setDate(now.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const grouped = conversations.reduce((acc, c) => {
    const label = formatDate(c.createdAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(c);
    return acc;
  }, {});

  return (
    <div className="app-container">
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">N</div>
          <span className="sidebar-logo-text">Nova AI</span>
        </div>

        <button className="new-chat-btn" onClick={createNewConversation}>
          ＋ New Chat
        </button>

        <div className="sidebar-scroll">
          {Object.entries(grouped).map(([label, convs]) => (
            <div key={label}>
              <div className="sidebar-section-title">{label}</div>
              {convs.map(conv => (
                <div 
                  key={conv.id} 
                  className={`conv-item ${conv.id === activeId ? 'active' : ''}`}
                  onClick={() => editingId !== conv.id && setActiveId(conv.id)}
                >
                  <span className="conv-icon">💬</span>
                  {editingId === conv.id ? (
                    <input 
                      ref={editInputRef}
                      className="conv-rename-input"
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onBlur={() => saveTitle(conv.id)}
                      onKeyDown={e => e.key === 'Enter' && saveTitle(conv.id)}
                    />
                  ) : (
                    <span className="conv-title">{conv.title}</span>
                  )}
                  <button className="conv-action-btn" onClick={e => startEditing(conv, e)}>✏️</button>
                  <button className="conv-action-btn conv-delete" onClick={e => deleteConversation(conv.id, e)}>✕</button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">
            {user?.avatar ? <img src={user.avatar} style={{width: '100%', borderRadius: '50%'}} /> : (user?.username?.[0]?.toUpperCase() || 'U')}
          </div>
          <div className="profile-info">
            <div className="profile-name">{user?.username}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="logout-btn" onClick={() => setIsSettingsOpen(true)}>Settings</button>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <button className="logout-btn" onClick={logout}>Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {isSettingsOpen && (
          <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
            <motion.div 
              className="settings-modal" 
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="modal-header">
                <h3>System Settings</h3>
                <button className="close-btn" onClick={() => setIsSettingsOpen(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="setting-section">
                  <h4>Profile & Account</h4>
                  <div className="setting-item">
                    <div className="setting-label">Email Address</div>
                    <div className="setting-value">{user?.email}</div>
                  </div>
                  <div className="setting-item">
                    <div className="setting-label">Membership</div>
                    <div className="setting-value" style={{ color: 'var(--accent)' }}>Basic Plan</div>
                  </div>
                </div>

                <div className="setting-section">
                  <h4>Chat Preferences</h4>
                  <div className="setting-item">
                    <div className="setting-label">AI Model</div>
                    <select value={activeModel} onChange={e => setActiveModel(e.target.value)} className="setting-select">
                      <option>Llama 3.3 (70B)</option>
                      <option>Mixtral 8x7B</option>
                      <option>Gemma 2 (9B)</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <div className="setting-label">Text Size</div>
                    <select value={fontSize} onChange={e => setFontSize(e.target.value)} className="setting-select">
                      <option>Small</option>
                      <option>Medium</option>
                      <option>Large</option>
                    </select>
                  </div>
                </div>

                <div className="setting-section">
                  <h4>Security & Privacy</h4>
                  <div className="setting-item">
                    <div className="setting-label">Data Retention</div>
                    <div className="setting-value">Stored Locally</div>
                  </div>
                  <button className="danger-btn" onClick={clearAllHistory}>Delete All Chat History</button>
                </div>

                <div className="setting-footer">
                  <button className="auth-btn logout-final" onClick={logout}>Logout of all sessions</button>
                  <div className="v-info">Nova AI Version 2.1.0 · Build 418</div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="chat-main" style={{ fontSize: fontSize === 'Small' ? '0.9rem' : fontSize === 'Large' ? '1.1rem' : '1rem' }}>
        <header className="chat-header">
          <button className="menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
          <div className="header-title">Nova AI</div>
          <div style={{ width: 32 }} />
        </header>

        <section className="messages-container">
          {!activeConv?.messages.length ? (
            <div className="empty-state">
              <div className="empty-logo">N</div>
              <h1 className="empty-title">How can I help you?</h1>
              <p className="empty-subtitle">Currently using <span>{activeModel}</span> assistant.</p>
              <div className="suggestions-grid">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggestion-card" onClick={() => handleSend(s.text)}>
                    <strong>{s.title}</strong>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            activeConv.messages.map((msg, i) => (
              <div key={i} className={`message-wrapper ${msg.role === 'user' ? 'user' : 'ai'}`}>
                <div className="message-content">
                  <div className={`avatar ${msg.role === 'user' ? 'user-avatar' : 'ai-avatar'}`}>
                    {msg.role === 'user' ? (user?.username?.[0] || 'U') : 'N'}
                  </div>
                  <div className="message-box">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="message-wrapper ai">
              <div className="message-content">
                <div className="avatar ai-avatar">N</div>
                <div className="message-box">Thinking...</div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </section>

        <footer className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input"
              rows={1}
              placeholder="Message Nova AI..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            />
            <button className="send-btn" onClick={() => handleSend()} disabled={!input.trim() || isLoading}>
              ➤
            </button>
          </div>
          <p className="input-footer">Nova AI Powered by <strong>{activeModel}</strong> · Verify accuracy.</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
