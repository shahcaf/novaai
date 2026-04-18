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
