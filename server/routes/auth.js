const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const axios = require('axios');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google Login
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    // Fetch user info using the access token
    const googleRes = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const { name, email, picture } = googleRes.data;

    let user = await User.findOne({ where: { email } });
    if (!user) {
      // Create a random password for OAuth users
      const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
      user = await User.create({ 
        username: name.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000), 
        email, 
        password: randomPassword,
        avatar: picture
      });
    }

    const jwtToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token: jwtToken, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar } });
  } catch (err) {
    res.status(500).json({ error: 'Google authentication failed', details: err.message });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    let user = await User.findOne({ where: { email } });
    if (user) return res.status(400).json({ error: 'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    user = await User.create({ username, email, password: hashedPassword });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ error: 'User not found' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Current User
router.get('/me', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Profile
router.put('/profile', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { username, avatar } = req.body;
    let user = await User.findByPk(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (username) user.username = username;
    if (avatar) user.avatar = avatar;
    
    await user.save();
    res.json({ id: user.id, username: user.username, email: user.email, avatar: user.avatar });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
