import React, { useEffect, useContext, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

const DiscordCallback = () => {
  const { discordLogin } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('Verifying Discord credentials...');

  useEffect(() => {
    const handleCallback = async () => {
      // Discord implicit grant returns the token in the URL hash
      const hash = location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');

      if (!accessToken) {
        setStatus('Authentication failed: No access token found.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      try {
        await discordLogin(accessToken);
        setStatus('Success! Opening Nova AI...');
        navigate('/');
      } catch (err) {
        console.error('Discord Auth Error:', err);
        setStatus(`Error: ${err.response?.data?.error || 'Server rejected Discord handshake'}`);
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [location, discordLogin, navigate]);

  return (
    <div className="nova-boot-screen">
      <div className="nova-boot-logo">D</div>
      <div className="nova-boot-text">{status}</div>
      <div className="nova-boot-pulse"></div>
    </div>
  );
};

export default DiscordCallback;
