import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
        console.error(err);
        setError('Google login failed');
      }
    },
    onError: () => setError('Google login failed'),
  });

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Welcome Back</h2>
        <p>Log in to Nova AI to continue</p>
        
        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email Address</label>
            <input type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="auth-btn">Login to Account</button>
        </form>

        <div className="divider"><span>OR CONTINUE WITH</span></div>

        <div className="social-login-wrapper">
          <button 
            type="button" 
            className="custom-google-btn"
            onClick={() => loginByGoogle()}
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" />
            Continue with Google
          </button>
        </div>

        <p className="auth-footer">
          New to Nova? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
