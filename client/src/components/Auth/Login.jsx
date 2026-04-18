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
      className="custom-google-btn-premium"
      onClick={() => {
        onLoading(true);
        loginByGoogle();
      }}
    >
      <div className="google-icon-wrapper">
        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" />
      </div>
      <span>Sign in with Google</span>
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
      <div className="auth-card">
        <div className="auth-card-badge">Nova Cloud v2.1.5</div>
        <h2>Welcome Back</h2>
        <p>Log in to Nova AI to continue</p>
        
        {error && <div className="error-msg" style={{ color: '#ff4d4d', background: 'rgba(255, 77, 77, 0.1)', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.85rem' }}>{error}</div>}

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
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '10px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
              Google login currently unavailable (Missing Client ID)
            </div>
          )}
        </div>

        <div className="divider"><span>or use credentials</span></div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="name@company.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              disabled={isUpdating}
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
              disabled={isUpdating}
            />
          </div>
          <button type="submit" className="auth-btn" disabled={isUpdating}>
            {isUpdating ? 'Authenticating...' : 'Sign In'}
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
