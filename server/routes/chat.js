const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const Groq = require('groq-sdk');
const OpenAI = require('openai');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

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
    const isVisionModel = activeModel.includes('vision') || activeModel.startsWith('gpt-4o');
    const isGPT = activeModel.startsWith('gpt-');

    if (isGPT && (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === '')) {
      return res.status(400).json({ error: "OpenAI API Key is missing. Please add it to your .env file." });
    }
    
    // Prepare multi-modal messages
    const processedMessages = messages.map(msg => {
      if (isVisionModel && msg.mediaUrl) {
        const relativePath = msg.mediaUrl.startsWith('/') ? msg.mediaUrl.slice(1) : msg.mediaUrl;
        const filePath = path.join(__dirname, '..', relativePath);
        
        if (fs.existsSync(filePath)) {
          console.log('Resolving Vision File:', filePath);
          const imageBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
          const ext = path.extname(filePath).toLowerCase();
          const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          return {
            role: msg.role,
            content: [
              { type: 'text', text: msg.content || "Describe this image." },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          };
        }
      }
      return { role: msg.role, content: msg.content || "" };
    });

    let aiContent = "";

    try {
      if (isGPT) {
        const completion = await openai.chat.completions.create({
          model: activeModel,
          messages: [
            { role: "system", content: "You are Nova AI, powered by GPT-4. Be premium, helpful, and concise." },
            ...processedMessages
          ],
          max_tokens: 1024,
        });
        aiContent = completion.choices[0].message.content;
      } else {
        const completion = await groq.chat.completions.create({
          model: activeModel,
          messages: [
            { role: "system", content: "You are Nova AI, a helpful and friendly assistant." },
            ...processedMessages
          ],
          temperature: 0.7,
          max_tokens: 1024,
        });
        aiContent = completion.choices[0].message.content;
      }
    } catch (apiErr) {
      console.error('Initial AI call failed, attempting fallback:', apiErr.message);
      
      // If it's a decommissioned error or any 400, try a guaranteed stable model
      const fallbackCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are Nova AI. (Note: The user's primary model was unavailable, so I am assisting them now)." },
          ...processedMessages
        ],
        temperature: 0.7,
        max_tokens: 1024,
      });
      aiContent = fallbackCompletion.choices[0].message.content;
    }
    
    // Save to DB
    const convId = (req.body.conversationId && req.body.conversationId.length === 36) ? req.body.conversationId : null;

    try {
      await Message.create({
        content: aiContent,
        isAI: true,
        senderId: req.user.id,
        conversationId: convId
      });
    } catch (saveErr) {
      console.error('DB Save error:', saveErr);
    }

    res.json({ content: aiContent });
  } catch (err) {
    console.error('Critical AI Error:', err.response?.data || err);
    res.status(500).json({ error: err.message || 'AI processing failed' });
  }
});

module.exports = router;
