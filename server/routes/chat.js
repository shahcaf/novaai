const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const Groq = require('groq-sdk');
const OpenAI = require('openai');

const { GoogleGenerativeAI } = require('@google/generative-ai');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy');

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
    const isVisionModel = activeModel.includes('vision') || activeModel.startsWith('gpt-4o') || activeModel.includes('gemini');
    const isGPT = activeModel.startsWith('gpt-');
    const isGemini = activeModel.includes('gemini');

    // Prepare multi-modal/contextual messages
    const processedMessages = messages.map(msg => {
      if (msg.mediaUrl) {
        const relativePath = msg.mediaUrl.startsWith('/') ? msg.mediaUrl.slice(1) : msg.mediaUrl;
        const filePath = path.join(__dirname, '..', relativePath);
        
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase();
          
          // Case 1: Vision (Images)
          if (isVisionModel && (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp' || ext === '.gif')) {
            const imageBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
            const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            return {
              role: msg.role,
              content: [
                { type: 'text', text: msg.content || "Describe this image." },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
              ]
            };
          }
          
          // Case 2: Code/Text Reading (Context Injection)
          const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.txt', '.py', '.html', '.css', '.md'];
          if (textExtensions.includes(ext)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const truncatedContent = fileContent.length > 5000 ? fileContent.slice(0, 5000) + "...[content truncated]" : fileContent;
            return {
              role: msg.role,
              content: `${msg.content || ""}\n\n[FILE ATTACHMENT: ${path.basename(filePath)}]\n\`\`\`${ext.slice(1)}\n${truncatedContent}\n\`\`\``
            };
          }
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
            messages: [{ role: "system", content: "You are Nova AI." }, ...processedMessages],
            max_tokens: 1024,
          });
          aiContent = completion.choices[0].message.content;
        } catch (gptErr) {
          if (gptErr.status === 404 && activeModel === 'gpt-4o') {
            const mini = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: processedMessages, max_tokens: 1024 });
            aiContent = mini.choices[0].message.content;
            actualModelUsed = 'GPT-4o-mini';
          } else throw gptErr;
        }
      } else if (isGemini) {
        const genModel = genAI.getGenerativeModel({ model: activeModel });
        const contents = processedMessages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: Array.isArray(m.content) ? m.content[0].text : m.content }]
        }));
        const result = await genModel.generateContent({ contents });
        aiContent = result.response.text();
      } else {
        const completion = await groq.chat.completions.create({
          model: activeModel,
          messages: [{ role: "system", content: "You are Nova AI." }, ...processedMessages],
          temperature: 0.7,
          max_tokens: 1024,
        });
        aiContent = completion.choices[0].message.content;
      }
    } catch (apiErr) {
      console.error('Final AI fallback triggered:', apiErr.message);
      const fallbackCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: "You are Nova AI." }, ...processedMessages],
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
