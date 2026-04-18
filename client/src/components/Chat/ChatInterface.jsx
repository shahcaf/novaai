/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef, useContext } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image, Plus, LogOut, LayoutGrid, Volume2, Square } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API_BASE_URL);

const ChatInterface = () => {
  const { user, logout } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch History
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/api/chat/history`, {
          headers: { 'x-auth-token': token }
        });
        setMessages(res.data);
      } catch (err) {
        console.error('History fetch failed', err);
      }
    };
    fetchHistory();

    // Socket Listeners
    socket.on('message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => socket.off('message');
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const data = {
      senderId: user.id || user._id,
      text: input,
    };
    socket.emit('sendMessage', data);
    setInput('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('media', file);
    formData.append('text', input || 'Shared media');

    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/media/upload`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'x-auth-token': token 
        }
      });
      // Message will be received via socket
      setInput('');
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const speak = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">N</div>
          <span className="sidebar-logo-text">Nova AI</span>
        </div>
        
        <button className="new-chat-btn" onClick={() => navigate('/gallery')}>
          <LayoutGrid size={18} /> Media Gallery
        </button>

        <div className="sidebar-scroll">
          <div className="sidebar-section-title">Account</div>
          <div className="conv-item active">
             <span className="conv-icon">👤</span>
             <span className="conv-title">{user?.username}</span>
          </div>
        </div>

        <button className="new-chat-btn danger" onClick={logout}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* Main Chat */}
      <main className="chat-main">
        <header className="chat-header">
           <button className="menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
           <div className="header-title">Nova Chat</div>
           {isSpeaking && (
              <button className="voice-stop-btn" onClick={stopSpeaking}>
                <Square size={12} fill="currentColor" /> Stop AI
              </button>
           )}
        </header>

        <section className="messages-container">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-logo">N</div>
              <h1 className="empty-title">Welcome, {user?.username}</h1>
              <p className="empty-subtitle">Start a conversation or share some media.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <motion.div 
              key={msg._id || idx}
              className={`message-wrapper ${msg.sender?.username === user?.username ? 'user' : 'ai'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="message-content">
                {msg.sender?.username !== user?.username && (
                  <div className="avatar ai-avatar">N</div>
                )}
                <div className="message-box">
                  {msg.mediaUrl && (
                    <div className="chat-media-preview">
                      {msg.mediaType === 'image' ? (
                        <img src={`${API_BASE_URL}${msg.mediaUrl}`} alt="media" />
                      ) : (
                        <video controls src={`${API_BASE_URL}${msg.mediaUrl}`} />
                      )}
                    </div>
                  )}
                  {msg.text && <ReactMarkdown>{msg.text}</ReactMarkdown>}
                  <div className="message-meta">
                    {msg.sender?.username} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {!msg.mediaUrl && msg.sender?.username !== user?.username && (
                       <button onClick={() => speak(msg.text)} style={{background:'none', border:'none', color:'inherit', marginLeft:8, cursor:'pointer'}}>
                          <Volume2 size={12} />
                       </button>
                    )}
                  </div>
                </div>
                {msg.sender?.username === user?.username && (
                  <div className="avatar user-avatar">U</div>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </section>

        <footer className="input-area">
          <div className="input-wrapper">
            <button className="file-btn" onClick={() => fileInputRef.current.click()} style={{position:'absolute', left: 10, bottom: 10, background:'none', border:'none', color: 'var(--text-secondary)', cursor:'pointer'}}>
               <Plus size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{display:'none'}} 
              onChange={handleFileUpload}
              accept="image/*,video/*"
            />
            <textarea 
              className="chat-input"
              style={{paddingLeft: 45}}
              placeholder="Type a message or @nova for AI..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            />
            <div className="input-actions">
               <button className="send-btn" onClick={handleSend} disabled={!input.trim() && !isLoading}>
                  <Send size={16} />
               </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default ChatInterface;
