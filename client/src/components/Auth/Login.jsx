import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const { login, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  const loginByGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        await googleLogin(tokenResponse.access_token);
        navigate('/');
      } catch (err) {
        console.error('Google Auth Server Error:', err.response?.data);
        setError(err.response?.data?.error || 'Google login failed - server error');
      }
    },
    onError: () => setError('Google login failed'),
  });

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-card-badge">Nova Cloud v2.1.5</div>
        <h2>Welcome Back</h2>
        <p>Log in to Nova AI to continue</p>
        
        {error && <div className="error-msg">{error}</div>}

        <div className="social-login-wrapper">
          <button 
            type="button" 
            className="custom-google-btn-premium"
            onClick={() => {
              setIsUpdating(true);
              loginByGoogle();
            }}
            disabled={isUpdating}
          >
            <div className="google-icon-wrapper">
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" />
            </div>
            <span>{isUpdating ? 'Connecting Pulse...' : 'Sign in with Google'}</span>
          </button>
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
