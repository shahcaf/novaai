const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Get Chat History
router.get('/history', auth, async (req, res) => {
  try {
    const messages = await Message.findAll({
      include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }],
      order: [['createdAt', 'ASC']]
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat with AI
router.post('/', auth, async (req, res) => {
  try {
    const { messages } = req.body;
    
    // Save user message (optional, usually done via socket for real-time, but App.jsx uses axios)
    // For now, let's just get the AI response
    
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are Nova AI, a helpful assistant." },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const aiContent = completion.choices[0].message.content;
    
    // Save to DB if needed
    await Message.create({
      text: aiContent,
      isAI: true,
      senderId: req.user.id
    });

    res.json({ content: aiContent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

module.exports = router;
