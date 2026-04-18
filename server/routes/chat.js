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
    let actualModelUsed = activeModel;

    try {
      if (isGPT) {
        try {
          const completion = await openai.chat.completions.create({
            model: activeModel,
            messages: [
              { role: "system", content: "You are Nova AI, powered by GPT-4. Be premium, helpful, and concise." },
              ...processedMessages
            ],
            max_tokens: 1024,
          });
          aiContent = completion.choices[0].message.content;
        } catch (gptErr) {
          // If GPT-4o is missing (Tier 1 key), try GPT-4o-mini automatically
          if (gptErr.status === 404 && activeModel === 'gpt-4o') {
            console.warn('GPT-4o not found, falling back to GPT-4o-mini...');
            const miniCompletion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: "system", content: "You are Nova AI (GPT-4o-mini). Be premium and helpful." },
                ...processedMessages
              ],
              max_tokens: 1024,
            });
            aiContent = miniCompletion.choices[0].message.content;
          } else {
            throw gptErr;
          }
        }
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
      console.error('Final AI fallback triggered:', apiErr.message);
      
      const fallbackCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are Nova AI assisting the user because their primary model is currently restricted or unavailable." },
          ...processedMessages
        ],
        temperature: 0.7,
        max_tokens: 1024,
      });
      aiContent = fallbackCompletion.choices[0].message.content;
      actualModelUsed = "Llama 3.3 (Fallback)";
    }
    
    // Save to DB
    const convId = (req.body.conversationId && req.body.conversationId.length === 36) ? req.body.conversationId : null;

    try {
      await Message.create({
        content: aiContent,
        isAI: true,
        senderId: req.user.id,
        conversationId: convId,
        metadata: JSON.stringify({ model: actualModelUsed })
      });
    } catch (saveErr) {
      console.error('DB Save error:', saveErr);
    }

    res.json({ content: aiContent, model: actualModelUsed });
  } catch (err) {
    console.error('Critical AI Error:', err.response?.data || err);
    res.status(500).json({ error: err.message || 'AI processing failed' });
  }
});

module.exports = router;
