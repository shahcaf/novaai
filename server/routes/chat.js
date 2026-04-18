const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
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
    const { messages, model } = req.body;
    
    const activeModel = model || "llama-3.3-70b-versatile";
    const isVisionModel = activeModel.includes('vision');
    
    // Prepare multi-modal messages if it's a vision model
    const processedMessages = messages.map(msg => {
      if (isVisionModel && msg.mediaUrl) {
        const filePath = path.join(__dirname, '..', msg.mediaUrl);
        if (fs.existsSync(filePath)) {
          const imageBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
          const mimeType = path.extname(filePath).slice(1) === 'png' ? 'image/png' : 'image/jpeg';
          return {
            role: msg.role,
            content: [
              { type: 'text', text: msg.content || "Analyze this image." },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          };
        }
      }
      return { role: msg.role, content: msg.content };
    });

    const completion = await groq.chat.completions.create({
      model: activeModel,
      messages: [
        { role: "system", content: "You are Nova AI, a helpful, friendly, and easy-to-understand AI assistant. Use clear, simple language. If analyzing an image, be descriptive and helpful. Avoid overly technical jargon." },
        ...processedMessages
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const aiContent = completion.choices[0].message.content;
    
    // Save to DB if needed
    const convId = (req.body.conversationId && req.body.conversationId.length === 36) ? req.body.conversationId : null;

    await Message.create({
      content: aiContent,
      isAI: true,
      senderId: req.user.id,
      conversationId: convId
    });

    res.json({ content: aiContent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

module.exports = router;
