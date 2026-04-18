import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';

// Separate component to isolate useGoogleLogin hook
const GoogleLoginButton = ({ onLoading, onError, googleLogin, navigate }) => {
  const loginByGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        await googleLogin(tokenResponse.access_token);
        navigate('/');
      } catch (err) {
        console.error('Google Auth Server Error:', err.response?.data);
        onError(err.response?.data?.error || 'Google login failed - server error');
        onLoading(false);
      }
    },
    onError: () => {
      onError('Google login failed');
      onLoading(false);
    },
  });

  return (
    <button
      type="button"
      className="social-auth-btn google-auth-btn"
      onClick={() => { onLoading(true); loginByGoogle(); }}
    >
      {/* Google G logo — inline SVG, no broken external URLs */}
      <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      <span>Continue with Google</span>
    </button>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const { login, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed - check credentials');
      setIsUpdating(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ position: 'relative' }}>
        <div className="auth-card-badge">Nova Cloud v2.1.5</div>

        <div className="auth-logo-mark"><span>N</span></div>

        <h2>Welcome Back</h2>
        <p>Log in to Nova AI to continue</p>

        {error && <div className="auth-error-msg">{error}</div>}
        {isUpdating && <div className="loading-bar-container"><div className="loading-bar"></div></div>}

        <div className="social-login-wrapper">
          {GOOGLE_CLIENT_ID ? (
            <GoogleLoginButton
              onLoading={setIsUpdating}
              onError={setError}
              googleLogin={googleLogin}
              navigate={navigate}
            />
          ) : (
            <div className="social-auth-btn" style={{ opacity: 0.4, cursor: 'not-allowed', justifyContent: 'center' }}>
              Google login unavailable
            </div>
          )}

          <button
            type="button"
            className="social-auth-btn discord-auth-btn"
            onClick={() => {
              const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
              if (!clientId) { setError('Discord login is being configured.'); return; }
              const redirectUri = encodeURIComponent(`${window.location.origin}/discord-callback`);
              window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=identify%20email`;
            }}
          >
            {/* Discord logo — inline SVG, no broken external URLs */}
            <svg width="22" height="16" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M60.104 4.576A58.87 58.87 0 0 0 45.418.445a.22.22 0 0 0-.233.11c-.637 1.134-1.342 2.614-1.836 3.779a54.324 54.324 0 0 0-16.297 0c-.494-1.18-1.212-2.645-1.852-3.779a.229.229 0 0 0-.233-.11A58.706 58.706 0 0 0 10.28 4.576a.207.207 0 0 0-.096.082C1.578 17.42-.946 29.895.294 42.207a.245.245 0 0 0 .092.167c6.106 4.484 12.02 7.207 17.826 9.004a.231.231 0 0 0 .25-.082c1.374-1.874 2.598-3.853 3.648-5.93a.225.225 0 0 0-.123-.314 39.12 39.12 0 0 1-5.582-2.66.228.228 0 0 1-.022-.378 30.7 30.7 0 0 0 1.11-.87.22.22 0 0 1 .23-.031c11.71 5.345 24.396 5.345 35.97 0a.219.219 0 0 1 .232.028c.356.298.73.595 1.112.873a.228.228 0 0 1-.02.378 36.639 36.639 0 0 1-5.583 2.658.226.226 0 0 0-.121.316c1.066 2.074 2.29 4.053 3.645 5.927a.228.228 0 0 0 .25.083c5.83-1.797 11.743-4.52 17.85-9.004a.228.228 0 0 0 .091-.165c1.487-15.39-2.49-28.753-10.543-40.637a.18.18 0 0 0-.094-.084zM23.734 34.687c-3.514 0-6.41-3.227-6.41-7.193s2.842-7.194 6.41-7.194c3.595 0 6.463 3.254 6.41 7.194 0 3.966-2.843 7.193-6.41 7.193zm23.695 0c-3.514 0-6.409-3.227-6.409-7.193s2.841-7.194 6.41-7.194c3.594 0 6.462 3.254 6.409 7.194 0 3.966-2.841 7.193-6.41 7.193z" fill="white"/>
            </svg>
            <span>Continue with Discord</span>
          </button>
        </div>

        <div className="divider"><span>or use credentials</span></div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email Address</label>
            <input type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isUpdating} />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isUpdating} />
          </div>
          <button type="submit" className="auth-btn" disabled={isUpdating}>
            {isUpdating ? 'Authenticating...' : 'Sign In →'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Create one for free</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
