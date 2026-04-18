import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(username, email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-card-badge">Nova Cloud v2.1.5</div>
        <h2>Create Account</h2>
        <p>Join Nova AI and start chatting</p>
        
        {error && <div className="error-msg">{error}</div>}

        <div className="social-login-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              Google registration is auto-enabled with valid ID
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '10px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
              Google registration is being synchronized.
            </div>
          )}
          <div className="social-flex-row" style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button" 
              className="social-mini-btn discord-btn"
              onClick={() => {
                const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
                if (!clientId) {
                  setError('Discord social login is currently being configured.');
                  return;
                }
                const redirectUri = encodeURIComponent(`${window.location.origin}/discord-callback`);
                window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=identify%20email`;
              }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: '#5865F2', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '600', cursor: 'pointer' }}
            >
              <img src="https://assets-global.website-files.com/6257ade0c7a694a23318ad7a/6257ade0c7a694383118ad93_Discord-Logo-White.svg" alt="Discord" style={{ width: '20px' }} />
              Discord
            </button>
          </div>
          <div className="divider" style={{ margin: '10px 0' }}><span>or use email</span></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username</label>
            <input 
              type="text" 
              placeholder="Your name"
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="name@company.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="auth-btn">Create Free Account</button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in instead</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
