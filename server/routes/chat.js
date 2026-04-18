const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Groq = require('groq-sdk');
const OpenAI = require('openai');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy');

// Get All User Conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.findAll({
      where: { creatorId: req.user.id },
      order: [['updatedAt', 'DESC']]
    });

    // Auto-cleanup: Purge any unused "New Chat" ghosts
    const validConvs = [];
    for (const conv of conversations) {
      if (conv.title === 'New Chat' || conv.title === 'New Team Chat') {
        const messageCount = await Message.count({ where: { conversationId: conv.id } });
        if (messageCount === 0) {
          await conv.destroy();
          continue;
        }
      }
      validConvs.push(conv);
    }

    res.json(validConvs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create New Conversation
router.post('/conversations', auth, async (req, res) => {
  try {
    const { title } = req.body;
    const conversation = await Conversation.create({
      title: title || 'New Chat',
      creatorId: req.user.id
    });
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename Conversation
router.put('/conversations/:id', auth, async (req, res) => {
  try {
    const { title } = req.body;
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, creatorId: req.user.id }
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    
    conversation.title = title;
    await conversation.save();
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Conversation
router.delete('/conversations/:id', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, creatorId: req.user.id }
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    
    // Delete all messages in this conversation first
    await Message.destroy({ where: { conversationId: req.params.id } });
    await conversation.destroy();
    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Chat History for a Specific Conversation
router.get('/history/:conversationId', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Verify conversation belongs to user if it's not the default one
    if (conversationId !== 'default') {
      const conv = await Conversation.findOne({
        where: { id: conversationId, creatorId: req.user.id }
      });
      if (!conv) return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await Message.findAll({
      where: { conversationId },
      include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }],
      order: [['createdAt', 'ASC']],
      limit: 100 // Prevent massive payload loading times
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat with AI
router.post('/', auth, async (req, res) => {
  try {
    const { messages, model, userName, aiSpeed } = req.body;
    
    const activeModel = model || "llama-3.1-8b-instant";
    const isVisionModel = activeModel.includes('vision') || activeModel.startsWith('gpt-4o') || activeModel.includes('gemini');
    const isGPT = activeModel.startsWith('gpt-') || activeModel.startsWith('o1') || activeModel.startsWith('o3');
    const isGemini = activeModel.includes('gemini');

    // Build the dynamic personality matrix based on user preferences
    let basePrompt = `You are Nova AI, a highly advanced, ultra-premium AI assistant created by the Nova Cloud team. You are currently speaking with a user named "${userName || 'User'}". Always be extremely helpful, professional, and display high intelligence.`;
    
    if (aiSpeed === 'Precise (Strict)') {
      basePrompt += " You must be extremely concise, logical, and strictly factual. Avoid conversational filler. Prioritize absolute accuracy and deep reasoning over speed.";
    } else if (aiSpeed === 'Creative (Unfiltered)') {
      basePrompt += " You must be highly creative, articulate, and expressive. Feel free to use engaging metaphors, elaborate on complex ideas, and provide outside-the-box hypothetical scenarios. Use an inspiring tone.";
    } else {
      basePrompt += " Balance speed with accuracy. Be friendly, easy to understand, and provide clean, well-formatted markdown responses.";
    }
    
    basePrompt += " Use clear typography, bolded keywords, and properly formatted code blocks. Ensure your tone always feels sophisticated.";

    const SYSTEM_PROMPT = basePrompt;

    // Prepare multi-modal/contextual messages
    const processedMessages = await Promise.all(messages.map(async (msg) => {
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
          
          // Case 2: Document Parsing (PDF)
          if (ext === '.pdf') {
            try {
              const dataBuffer = fs.readFileSync(filePath);
              const data = await pdf(dataBuffer);
              return {
                role: msg.role,
                content: `${msg.content || ""}\n\n[DOCUMENT ATTACHMENT: ${path.basename(filePath)}]\n${data.text}`
              };
            } catch (pdfErr) {
              console.error('PDF Parse Error:', pdfErr);
            }
          }

          // Case 3: Document Parsing (DOCX)
          if (ext === '.docx') {
            try {
              const result = await mammoth.extractRawText({ path: filePath });
              return {
                role: msg.role,
                content: `${msg.content || ""}\n\n[DOCUMENT ATTACHMENT: ${path.basename(filePath)}]\n${result.value}`
              };
            } catch (docxErr) {
              console.error('DOCX Parse Error:', docxErr);
            }
          }
          
          // Case 4: Code/Text Reading (Context Injection)
          const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.txt', '.py', '.html', '.css', '.md'];
          if (textExtensions.includes(ext)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const truncatedContent = fileContent.length > 10000 ? fileContent.slice(0, 10000) + "...[content truncated]" : fileContent;
            return {
              role: msg.role,
              content: `${msg.content || ""}\n\n[FILE ATTACHMENT: ${path.basename(filePath)}]\n\`\`\`${ext.slice(1) || 'text'}\n${truncatedContent}\n\`\`\``
            };
          }
        }
      }
      return { role: msg.role, content: msg.content || "" };
    }));

    let aiContent = "";
    let actualModelUsed = activeModel;
    
    // Set dynamic temperature
    const resolvedTemp = aiSpeed === 'Precise (Strict)' ? 0.2 : (aiSpeed === 'Creative (Unfiltered)' ? 0.9 : 0.7);

    try {
      if (isGPT) {
        // o1/o3 models don't support system roles or temperatures natively
        const isReasoning = activeModel.startsWith('o1') || activeModel.startsWith('o3');
        const finalMessages = isReasoning 
          ? [{ role: "user", content: "System Instruction: " + SYSTEM_PROMPT }, ...processedMessages]
          : [{ role: "system", content: SYSTEM_PROMPT }, ...processedMessages];
        
        const config = {
          model: activeModel,
          messages: finalMessages,
        };

        if (isReasoning) {
          config.max_completion_tokens = 1024;
        } else {
          config.max_tokens = 1024;
          config.temperature = resolvedTemp;
        }

        try {
          const completion = await openai.chat.completions.create(config);
          aiContent = completion.choices[0].message.content;
        } catch (gptErr) {
          if (gptErr.status === 404 && activeModel === 'gpt-4o') {
            const mini = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: "system", content: SYSTEM_PROMPT }, ...processedMessages], max_tokens: 1024, temperature: resolvedTemp });
            aiContent = mini.choices[0].message.content;
            actualModelUsed = 'GPT-4o-mini';
          } else throw gptErr;
        }
      } else if (isGemini) {
        const genModel = genAI.getGenerativeModel({ 
          model: activeModel,
          systemInstruction: SYSTEM_PROMPT
        });
        
        const contents = processedMessages.map(m => {
          const role = m.role === 'assistant' ? 'model' : 'user';
          if (Array.isArray(m.content)) {
            const parts = m.content.map(part => {
              if (part.type === 'text') return { text: part.text };
              if (part.type === 'image_url') {
                const base64Data = part.image_url.url.split(',')[1];
                const mimeType = part.image_url.url.split(';')[0].split(':')[1];
                return {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                };
              }
              return null;
            }).filter(p => p !== null);
            return { role, parts };
          }
          return { role, parts: [{ text: m.content }] };
        });

        const result = await genModel.generateContent({ 
          contents, 
          generationConfig: { temperature: resolvedTemp } 
        });
        aiContent = result.response.text();
      } else {
        const completion = await groq.chat.completions.create({
          model: activeModel,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...processedMessages],
          temperature: resolvedTemp,
          max_tokens: 1024,
        });
        aiContent = completion.choices[0].message.content;
      }
    } catch (apiErr) {
      console.error('Final AI fallback triggered:', apiErr.message);
      const fallbackCompletion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...processedMessages],
        temperature: resolvedTemp,
        max_tokens: 1024,
      });
      aiContent = fallbackCompletion.choices[0].message.content;
      actualModelUsed = "Llama 3.1 (Fast Fallback)";
    }
    
    // Save to DB
    const convId = (req.body.conversationId && req.body.conversationId.length === 36) ? req.body.conversationId : null;

    try {
      // Save User Message
      const userMsgContent = messages[messages.length - 1]; // Get the latest user message
      if (userMsgContent && userMsgContent.role === 'user') {
        const contentStr = Array.isArray(userMsgContent.content) 
          ? userMsgContent.content.find(c => c.type === 'text')?.text || "[Media]" 
          : userMsgContent.content;
          
        await Message.create({
          content: contentStr,
          isAI: false,
          senderId: req.user.id,
          conversationId: convId,
          mediaUrl: userMsgContent.mediaUrl || '',
          mediaType: userMsgContent.mediaType || 'none'
        });
      }

      // Save AI Message
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
