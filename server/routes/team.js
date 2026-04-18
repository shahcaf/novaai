const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Message = require('../models/Message');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

// Create a new conversation
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { title } = req.body;
    const conversation = await Conversation.create({
      title: title || 'New Shared Chat',
      creatorId: req.user.id,
      inviteCode: uuidv4().split('-')[0] // Short invite code
    });

    await ConversationMember.create({
      userId: req.user.id,
      conversationId: conversation.id,
      role: 'owner'
    });

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's conversations
router.get('/my-chats', verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{
        model: Conversation,
        through: { attributes: ['role'] },
        include: [{ model: Message, limit: 10, order: [['createdAt', 'DESC']] }]
      }]
    });
    res.json(user.Conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join a conversation via invite code
router.post('/join/:code', verifyToken, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ where: { inviteCode: req.params.code } });
    if (!conversation) return res.status(404).json({ error: 'Invalid invite code' });

    // Check if already a member
    const existing = await ConversationMember.findOne({
      where: { userId: req.user.id, conversationId: conversation.id }
    });
    if (existing) return res.json({ message: 'Already a member', conversation });

    await ConversationMember.create({
      userId: req.user.id,
      conversationId: conversation.id,
      role: 'member'
    });

    res.json({ message: 'Joined successfully', conversation });
// Update conversation settings (Team Name / Code)
router.put('/update/:id', verifyToken, async (req, res) => {
  try {
    const { title, inviteCode } = req.body;
    const conversation = await Conversation.findByPk(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // Verify ownership
    if (conversation.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only owners can change settings' });
    }

    if (title) conversation.title = title;
    if (inviteCode) {
      // Check for uniqueness
      const existing = await Conversation.findOne({ where: { inviteCode } });
      if (existing && existing.id !== conversation.id) {
        return res.status(400).json({ error: 'Invite code already in use' });
      }
      conversation.inviteCode = inviteCode;
    }

    await conversation.save();
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
// Delete a team chat (Owner only)
router.delete('/delete/:id', verifyToken, async (req, res) => {
  try {
    const conversation = await Conversation.findByPk(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.creatorId !== req.user.id) return res.status(403).json({ error: 'Permission denied' });

    await conversation.destroy();
    res.json({ message: 'Team chat deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave a conversation
router.delete('/leave/:id', verifyToken, async (req, res) => {
  try {
    const membership = await ConversationMember.findOne({
      where: { userId: req.user.id, conversationId: req.params.id }
    });

    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.role === 'owner') {
      return res.status(400).json({ error: 'Owners cannot leave. Please delete the team chat instead.' });
    }

    await membership.destroy();
    res.json({ message: 'Left team successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
// Get all members of a conversation
router.get('/members/:id', verifyToken, async (req, res) => {
  try {
    console.log('Fetching members for conversation:', req.params.id);
    const members = await ConversationMember.findAll({
      where: { conversationId: req.params.id },
      include: [{ 
        model: User, 
        attributes: ['id', 'username', 'avatar', 'email'] 
      }]
    });
    console.log(`Found ${members.length} members.`);
    res.json(members);
  } catch (err) {
    console.error('Error fetching members:', err);
    res.status(500).json({ error: err.message });
  }
});

// Kick a member (Owner only)
router.delete('/kick/:conversationId/:userId', verifyToken, async (req, res) => {
  try {
    const conversation = await Conversation.findByPk(req.params.conversationId);
    if (conversation.creatorId !== req.user.id) return res.status(403).json({ error: 'Permission denied' });

    await ConversationMember.destroy({
      where: { conversationId: req.params.conversationId, userId: req.params.userId }
    });
    res.json({ message: 'User kicked successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update role (Owner only)
router.put('/role/:conversationId/:userId', verifyToken, async (req, res) => {
  try {
    const { role } = req.body;
    const conversation = await Conversation.findByPk(req.params.conversationId);
    if (conversation.creatorId !== req.user.id) return res.status(403).json({ error: 'Permission denied' });

    const membership = await ConversationMember.findOne({
      where: { conversationId: req.params.conversationId, userId: req.params.userId }
    });
    membership.role = role;
    await membership.save();
    res.json(membership);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
