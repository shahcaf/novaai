/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { AuthContext } from './context/AuthContext';
import { Plus, Send, Square, Trash2, Settings, LogOut, Copy, RefreshCw, Edit2, Check, X, MessageSquare, Loader2, Search } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SUGGESTIONS = [
  { title: '✍️ Write a story', text: 'about a time-traveling robot in ancient Rome.' },
  { title: '💡 Explain coding', text: 'concept of "Recursion" for a 5-year-old.' },
  { title: '✈️ Plan a trip', text: '5-day itinerary for Tokyo with a focus on food.' },
  { title: '🚀 Debugging help', text: 'Why is my React useEffect running twice?' },
];

function App() {
  const { user, logout, updateProfile } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Settings State
  const [activeModel, setActiveModel] = useState('Gemini 1.5 Pro');
  const [fontSize, setFontSize] = useState('Medium');
  const [theme, setTheme] = useState('Dark');
  const [aiSpeed, setAiSpeed] = useState('Fast');
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customPersona, setCustomPersona] = useState(localStorage.getItem('novacustomPersona') || '');

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const editInputRef = useRef(null);
  const fileInputRef = useRef(null);
  // --- Drag and Drop Logic ---
  const onDrop = (acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onloadend = () => setFilePreview(reader.result);
        reader.readAsDataURL(file);
      } else {
        setFilePreview('file');
      }
    }
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true, noKeyboard: true });

  const abortControllerRef = useRef(null);

  const activeConv = conversations.find(c => c.id === activeId);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/chat/conversations`, {
        headers: { 'x-auth-token': token }
      });
      
      const convs = res.data;
      setConversations(convs);
      
      if (convs.length > 0 && !activeId) {
        setActiveId(convs[0].id);
      } else if (convs.length === 0) {
        // Create a default one if none exist
        await createNewConversation();
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setIsInitialLoad(false);
    }
  };

  const fetchHistory = async (id) => {
    if (!id) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/chat/history/${id}`, {
        headers: { 'x-auth-token': token }
      });
      
      setConversations(prev => prev.map(c => 
        c.id === id ? { ...c, messages: res.data } : c
      ));
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (activeId && activeConv && !activeConv.messages) {
      fetchHistory(activeId);
    }
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages, isLoading]);

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);


  const createNewConversation = async () => {
    try {
      // Prevent creating multiple empty chats if current active one is already empty
      const current = conversations.find(c => c.id === activeId);
      if (current && (!current.messages || current.messages.length === 0)) {
        setIsSidebarOpen(false);
        return current;
      }

      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/api/chat/conversations`, { title: 'New Chat' }, {
        headers: { 'x-auth-token': token }
      });
      
      const newConv = { ...res.data, messages: [] };
      setConversations([newConv, ...conversations]);
      setActiveId(newConv.id);
      setIsSidebarOpen(false);
      return newConv;
    } catch (err) {
      alert('Failed to create new chat');
    }
  };

  const deleteConversation = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/chat/conversations/${id}`, {
        headers: { 'x-auth-token': token }
      });
      
      const filtered = conversations.filter(c => c.id !== id);
      if (!filtered.length) {
        await createNewConversation();
      } else {
        if (activeId === id) setActiveId(filtered[0].id);
        setConversations(filtered);
      }
    } catch (err) {
      alert('Failed to delete conversation');
    }
  };

  const clearAllHistory = async () => {
    if (window.confirm('Are you sure you want to delete ALL chat history? This cannot be undone.')) {
      try {
        const token = localStorage.getItem('token');
        for (const conv of conversations) {
          await axios.delete(`${API_URL}/api/chat/conversations/${conv.id}`, {
            headers: { 'x-auth-token': token }
          });
        }
        await fetchConversations();
        setIsSettingsOpen(false);
      } catch (err) {
        alert('Failed to clear history');
      }
    }
  };

  const startEditing = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const saveTitle = async (id) => {
    if (!editingTitle.trim() || editingTitle === activeConv?.title) return setEditingId(null);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/chat/conversations/${id}`, { title: editingTitle }, {
        headers: { 'x-auth-token': token }
      });
      
      setConversations(conversations.map(c => 
        c.id === id ? { ...c, title: editingTitle } : c
      ));
      setEditingId(null);
    } catch (err) {
      alert('Failed to rename conversation');
    }
  };

  const handleSend = async (text = input) => {
    if (!text.trim() || isLoading) return;

    abortControllerRef.current = new AbortController();

    const userMessage = { 
      role: 'user', 
      content: text, 
      timestamp: new Date().toISOString(),
      senderId: user?.id,
      conversationId: activeId
    };
    
    // Append locally for immediate feedback
    setConversations(prev => prev.map(c => 
      c.id === activeId ? { ...c, messages: [...(c.messages || []), userMessage] } : c
    ));
    
    setInput('');
    setIsLoading(true);

    let finalUserMessage = userMessage;

    try {
      // If there is a selected file, upload it first
      if (selectedFile) {
        const formData = new FormData();
        formData.append('media', selectedFile);
        formData.append('content', text);
        formData.append('conversationId', activeId);

        const token = localStorage.getItem('token');
        const uploadRes = await axios.post(`${API_URL}/api/media/upload`, formData, {
          headers: { 'x-auth-token': token }
        });

        finalUserMessage = {
          ...userMessage,
          content: uploadRes.data.content || text,
          mediaUrl: uploadRes.data.mediaUrl,
          mediaType: uploadRes.data.mediaType,
        };

        // Update the last message in local state to include media
        setConversations(prev => prev.map(c => 
          c.id === activeId ? { 
            ...c, 
            messages: c.messages.map((m, idx) => 
              idx === c.messages.length - 1 ? finalUserMessage : m
            ) 
          } : c
        ));
        
        setSelectedFile(null);
        setFilePreview(null);
      }

      const selectedModel = activeModel.includes('Vision (11B)') ? 'llama-3.2-11b-vision-preview' : 
                            activeModel.includes('Vision (90B)') ? 'llama-3.2-90b-vision-preview' :
                            activeModel.includes('GPT-4o - Premium') ? 'gpt-4o' :
                            activeModel.includes('GPT-4o-mini') ? 'gpt-4o-mini' :
                            activeModel.includes('o1-mini') ? 'o1-mini' :
                            activeModel.includes('o3-mini') ? 'o3-mini' :
                            activeModel.includes('DeepSeek R1') ? 'deepseek-r1-distill-llama-70b' :
                            activeModel.includes('Gemini 2.0 Flash') ? 'gemini-2.0-flash' :
                            activeModel.includes('Gemini 1.5 Pro') ? 'gemini-1.5-pro' :
                            activeModel.includes('Gemini 1.5 Flash') ? 'gemini-1.5-flash' :
                            activeModel.includes('3.3 (70B)') ? 'llama-3.3-70b-versatile' : 
                            activeModel.includes('3.1 (405B)') ? 'llama-3.1-405b-reasoning' :
                            activeModel.includes('3.1 (8B)') ? 'llama-3.1-8b-instant' : 
                            activeModel.includes('Mixtral') ? 'mixtral-8x7b-32768' : 'llama-3.1-8b-instant';
      
      const chatMessages = [...(activeConv.messages || []), finalUserMessage].map(m => {
        const msgObj = { role: m.role, content: m.content || (m.mediaType === 'image' ? '[Image]' : `[User uploaded a ${m.mediaType || 'file'}]`) };
        if (m.mediaUrl && m.mediaType === 'image' && selectedModel.includes('vision')) {
          msgObj.mediaUrl = m.mediaUrl;
        }
        return msgObj;
      });

      const response = await axios.post(`${API_URL}/api/chat`, {
        messages: chatMessages,
        model: selectedModel,
        conversationId: activeId,
        userName: user?.username || 'User',
        aiSpeed: aiSpeed,
        customPersona: customPersona
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') },
        signal: abortControllerRef.current.signal
      });

      const aiMessage = { 
        role: 'assistant', 
        content: response.data.content, 
        timestamp: new Date().toISOString(),
        isNew: true 
      };

      setConversations(prev => prev.map(c => 
        c.id === activeId ? { ...c, messages: [...(c.messages || []), aiMessage] } : c
      ));
    } catch (err) {
      console.error(err);
      if (err.name !== 'CanceledError') {
        alert('AI Generation failed: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleEdit = (text, index) => {
    setInput(text);
    setConversations(prev => prev.map(c => 
      c.id === activeId ? { ...c, messages: c.messages.slice(0, index) } : c
    ));
    textareaRef.current?.focus();
  };

  const handleRegenerate = async (index) => {
    if (isLoading) return;
    const newMessages = activeConv.messages.slice(0, index);
    
    setConversations(prev => prev.map(c => 
      c.id === activeId ? { ...c, messages: newMessages } : c
    ));
    
    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    
    try {
      const selectedModel = activeModel.includes('Llama 3.3') ? 'llama-3.3-70b-versatile' : activeModel.includes('Mixtral') ? 'mixtral-8x7b-32768' : activeModel.includes('Gemma') ? 'gemma2-9b-it' : 'llama3-8b-8192';
      const response = await axios.post(`${API_URL}/api/chat`, {
        messages: newMessages.map(m => ({ role: m.role, content: m.content || `[User uploaded a ${m.mediaType || 'file'}]` })),
        model: selectedModel,
        conversationId: activeId
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') },
        signal: abortControllerRef.current.signal
      });

      const aiMessage = { 
        role: 'assistant', 
        content: response.data.content, 
        timestamp: new Date().toISOString(),
        isNew: true 
      };

      setConversations(prev => prev.map(c => 
        c.id === activeId ? { ...c, messages: [...newMessages, aiMessage] } : c
      ));
    } catch (err) {
      console.error(err);
      alert('AI Generation failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith('image')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview('file');
    }
    if (e.target) e.target.value = '';
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Today';
    now.setDate(now.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const grouped = conversations
    .filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .reduce((acc, c) => {
      const label = formatDate(c.createdAt);
      if (!acc[label]) acc[label] = [];
      acc[label].push(c);
      return acc;
    }, {});

  const saveProfileChanges = async () => {
    try {
      setIsUpdating(true);
      await updateProfile({ username: editUsername });
      alert('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update profile.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isInitialLoad && user) {
    return (
      <div className="initial-loader">
        <Loader2 className="spinning" size={48} />
        <p>Syncing Nova Pulse...</p>
      </div>
    );
  }

  return (
    <div {...getRootProps()} style={{ width: '100%', height: '100%', display: 'flex' }}>
      <input {...getInputProps()} />
      {isDragActive && (
        <div className="drag-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(16, 185, 129, 0.2)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: '1rem', border: '2px dashed var(--accent)', color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 'bold' }}>
            Drop file to upload to Nova
          </div>
        </div>
      )}
      <div className="app-container" data-theme={theme.toLowerCase()} style={{ flex: 1 }}>
        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">N</div>
          <span className="sidebar-logo-text">Nova AI</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
          <button className="new-chat-btn" onClick={createNewConversation}>
            ＋ New Chat
          </button>
          
          <div className="sidebar-search-wrapper" style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              className="sidebar-search-input"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px 8px 32px', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>
        </div>

        <button className="sidebar-action-btn" onClick={() => setIsSettingsOpen(true)}>
          <Settings size={18} /> Settings
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
                  <MessageSquare size={14} style={{ opacity: 0.5 }} />
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
                  <button className="conv-action-btn" onClick={e => startEditing(conv, e)} title="Rename">✏️</button>
                  <button className="conv-action-btn conv-delete" onClick={e => deleteConversation(conv.id, e)} title="Delete">✕</button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">
            {user?.avatar ? <img src={user.avatar} style={{width: '100%', borderRadius: '50%'}} /> : (user?.username ? user.username[0].toUpperCase() : 'U')}
          </div>
          <div className="profile-info">
            <div className="profile-name">{user?.username}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{user?.email}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={logout} title="Sign out" style={{ marginLeft: 'auto' }}>
            <LogOut size={16} />
          </button>
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
                <h3>System Preferences</h3>
                <button className="close-btn" onClick={() => setIsSettingsOpen(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="setting-section">
                  <h4>Profile & Identity</h4>
                  <div className="setting-item">
                    <div className="setting-label">Display Name</div>
                    <div className="setting-group-v">
                      <input 
                        className="setting-input" 
                        value={editUsername} 
                        onChange={e => setEditUsername(e.target.value)}
                        placeholder="Enter username"
                      />
                      <button className="save-mini-btn" onClick={saveProfileChanges} disabled={isUpdating}>
                        {isUpdating ? 'Saving...' : 'Save Name'}
                      </button>
                    </div>
                  </div>
                  <div className="setting-item">
                    <div className="setting-label">Email</div>
                    <div className="setting-value">{user?.email}</div>
                  </div>
                </div>

                <div className="setting-section">
                  <h4>Interface & Appearance</h4>
                  <div className="setting-item">
                    <div className="setting-label">Color Theme</div>
                    <select value={theme} onChange={e => setTheme(e.target.value)} className="setting-select">
                      <option>Dark</option>
                      <option>Light</option>
                      <option>Cyberpunk</option>
                      <option>Midnight</option>
                      <option>Emerald</option>
                      <option>Sunset</option>
                      <option>Amethyst</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <div className="setting-label">Typography</div>
                    <select value={fontSize} onChange={e => setFontSize(e.target.value)} className="setting-select">
                      <option>Small</option>
                      <option>Medium</option>
                      <option>Large</option>
                    </select>
                  </div>
                </div>

                <div className="setting-section">
                  <h4>AI Engine Settings</h4>
                  <div className="setting-item">
                    <div className="setting-label">Preferred Model</div>
                    <select value={activeModel} onChange={e => setActiveModel(e.target.value)} className="setting-select">
                      <option>Gemini 1.5 Pro</option>
                      <option>Gemini 1.5 Flash</option>
                      <option>Gemini 2.0 Flash - NextGen</option>
                      <option>GPT-4o - Premium</option>
                      <option>GPT-4o-mini - Fast</option>
                      <option>o1-mini - Reasoning</option>
                      <option>o3-mini - Advanced</option>
                      <option>DeepSeek R1 (70B) - Distill</option>
                      <option>Llama 3.3 (70B) - Versatile</option>
                      <option>Llama 3.2 Vision (11B)</option>
                      <option>Llama 3.2 Vision (90B) - Pro</option>
                      <option>Llama 3.1 (405B) - Extreme</option>
                      <option>Llama 3.1 (8B) - Instant</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <div className="setting-label">Response Mode</div>
                    <select value={aiSpeed} onChange={e => setAiSpeed(e.target.value)} className="setting-select">
                      <option>Fast (Balanced)</option>
                      <option>Precise (Strict)</option>
                      <option>Creative (Unfiltered)</option>
                    </select>
                  </div>
                  <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                    <div className="setting-label">Nova Custom Persona (Global)</div>
                    <textarea 
                      className="setting-input"
                      placeholder="e.g. You are a Senior Developer. Be concise and use emojis."
                      style={{ width: '100%', minHeight: '80px', resize: 'vertical', fontSize: '13px' }}
                      value={customPersona}
                      onChange={e => {
                        setCustomPersona(e.target.value);
                        localStorage.setItem('novacustomPersona', e.target.value);
                      }}
                    />
                  </div>
                </div>

                <div className="setting-section">
                  <h4>Data & Privacy</h4>
                  <button className="danger-btn" onClick={clearAllHistory}>
                    <Trash2 size={14} style={{ marginRight: 8 }} /> Delete All Chat History
                  </button>
                </div>

                <div className="setting-footer">
                  <div className="v-info">Nova Cloud · v2.2.0 · Production Stable</div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      <main className="chat-main" style={{ fontSize: fontSize === 'Small' ? '0.9rem' : fontSize === 'Large' ? '1.1rem' : '1rem' }}>
        <header className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
            <div className="header-title">Nova AI</div>
          </div>
          <div className="header-actions">
            <button className="menu-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <section className="messages-container">
          {(!activeConv || !activeConv.messages?.length) ? (
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
            <AnimatePresence initial={false}>
              {activeConv.messages.map((msg, i) => {
                const isUser = msg.role === 'user' || msg.isAI === false;
                return (
                <motion.div 
                  key={i} 
                  className={`message-wrapper ${isUser ? 'user' : 'ai'}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  layout
                >
                  <div className="message-content">
                    <div className={`avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>
                      {isUser ? (user?.username?.[0]?.toUpperCase() || 'U') : 'N'}
                    </div>
                    <div className="message-box">
                      {msg.mediaUrl && (
                        <div className="chat-media-preview" style={{ marginBottom: '10px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                          {msg.mediaType === 'image' ? (
                            <img src={msg.mediaUrl.startsWith('http') ? msg.mediaUrl : `${API_URL}${msg.mediaUrl}`} alt="media" style={{ maxWidth: '100%', maxHeight: '400px', display: 'block' }} />
                          ) : msg.mediaType === 'video' ? (
                            <video controls src={msg.mediaUrl.startsWith('http') ? msg.mediaUrl : `${API_URL}${msg.mediaUrl}`} style={{ maxWidth: '100%', maxHeight: '400px', display: 'block' }} />
                          ) : (
                            <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span>📄</span>
                              <a href={msg.mediaUrl.startsWith('http') ? msg.mediaUrl : `${API_URL}${msg.mediaUrl}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                Download Attachment
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="message-text">
                        <ReactMarkdown
                          components={{
                            code({node, inline, className, children, ...props}) {
                              const match = /language-(\w+)/.exec(className || '')
                              return !inline && match ? (
                                <div className="code-block-wrapper" style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', margin: '12px 0' }}>
                                  <div className="code-header" style={{ display: 'flex', justifyContent: 'space-between', background: '#1e1e1e', padding: '6px 12px', fontSize: '11px', color: '#9cdcfe', borderBottom: '1px solid #333' }}>
                                    <span>{match[1]}</span>
                                    <button onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '11px' }}>
                                      Copy Code
                                    </button>
                                  </div>
                                  <SyntaxHighlighter
                                    {...props}
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ margin: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                </div>
                              ) : (
                                <code {...props} className={className} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontSize: '0.9em' }}>
                                  {children}
                                </code>
                              )
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      {msg.isAI && (
                        <div className="message-model-badge" style={{ fontSize: '9px', opacity: 0.4, marginTop: '8px', textAlign: 'right', fontStyle: 'italic' }}>
                          {msg.metadata ? (JSON.parse(msg.metadata).model) : (msg.sender?.username === 'Nova AI' ? 'Nova Assistant' : (msg.metadata ? msg.metadata : ''))}
                        </div>
                      )}
                      <div className="msg-actions">
                        {isUser ? (
                          <button className="msg-action-btn" onClick={() => handleEdit(msg.content, i)} title="Edit Message">
                            <Edit2 size={14} /> Edit
                          </button>
                        ) : (
                          <>
                            <button className="msg-action-btn" onClick={() => handleCopy(msg.content, i)} title="Copy">
                              {copiedIndex === i ? <Check size={14} color="#10b981" /> : <Copy size={14} />} {copiedIndex === i ? 'Copied' : 'Copy'}
                            </button>
                            <button className="msg-action-btn" onClick={() => handleRegenerate(i)} title="Regenerate" disabled={isLoading}>
                              <RefreshCw size={14} className={isLoading ? 'spinning' : ''} /> Remake
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          {isLoading && (
            <motion.div 
              className="message-wrapper ai"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="message-content">
                <div className="avatar ai-avatar">N</div>
                <div className="message-box typing-container">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </section>

        <footer className="input-area">
          {filePreview && (
            <div className="file-staging-preview">
              {filePreview === 'file' ? (
                <div className="file-icon-preview">📄 {selectedFile.name}</div>
              ) : (
                <img src={filePreview} alt="upload preview" />
              )}
              <button className="remove-file-btn" onClick={removeSelectedFile}><X size={14} /></button>
            </div>
          )}
          <div className="input-wrapper">
            <button 
              className="upload-plus-btn" 
              onClick={() => fileInputRef.current.click()}
              title="Add files or pictures"
            >
              <Plus size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            />
            <textarea
              ref={textareaRef}
              className="chat-input"
              rows={1}
              style={{ paddingLeft: '48px' }}
              placeholder="Message Nova AI... (or paste a file)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              onPaste={e => {
                if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
                  e.preventDefault();
                  handleFileUpload({ target: { files: [e.clipboardData.files[0]] } });
                }
              }}
            />
            <button 
              className={`send-btn ${isLoading ? 'stop-btn' : ''}`} 
              onClick={isLoading ? handleStop : () => handleSend()} 
              disabled={(!input.trim() && !isLoading && !selectedFile)}
              title={isLoading ? "Stop generating" : "Send message"}
            >
              {isLoading ? <Square size={16} fill="white" /> : <Send size={18} />}
            </button>
          </div>
          <p className="input-footer">Nova AI Powered by <strong>{activeModel}</strong> · Verify accuracy.</p>
        </footer>
      </main>
      </div>
    </div>
  );
}

export default App;
