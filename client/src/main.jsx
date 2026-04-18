/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useContext } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import { AuthProvider, AuthContext } from './context/AuthContext'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import DiscordCallback from './components/Auth/DiscordCallback'

const PremiumLoader = () => (
  <div className="nova-boot-screen">
    <div className="nova-boot-logo">N</div>
    <div className="nova-boot-text">Nova AI</div>
    <div className="nova-boot-pulse"></div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const token = localStorage.getItem('token');
  
  if (loading) return <PremiumLoader />;
  if (!token && !user) return <Navigate to="/login" />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const token = localStorage.getItem('token');
  
  if (loading) return <PremiumLoader />;
  if (token || user) return <Navigate to="/" />;
  return children;
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || ""}>
        <Router>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/discord-callback" element={<DiscordCallback />} />
            <Route path="/" element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </GoogleOAuthProvider>
    </AuthProvider>
  </StrictMode>,
)
