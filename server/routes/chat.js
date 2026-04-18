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
    let { messages, model, userName, aiSpeed, customPersona } = req.body;
    
    // HARDENED INPUT SANITIZATION: Ensure all message content is a string at entry point.
    // This prevents 400 "content must be a string" errors caused by vision-format arrays
    // leaking from client-side state into non-vision API calls.
    messages = (messages || []).map(m => {
      if (Array.isArray(m.content)) {
        const text = m.content.find(c => c.type === 'text')?.text || '';
        return { ...m, content: text };
      }
      if (!m.role) {
        return { ...m, role: m.isAI ? 'assistant' : 'user' };
      }
      return m;
    }).filter(m => m.role && (m.content || m.mediaUrl)); // strip empty/invalid messages

    const activeModel = model || "llama-3.1-8b-instant";
    const isVisionModel = activeModel.includes('vision') || activeModel.startsWith('gpt-4o') || activeModel.includes('gemini');
    const isGPT = activeModel.startsWith('gpt-') || activeModel.startsWith('o1') || activeModel.startsWith('o3');
    const isGemini = activeModel.includes('gemini');

    // Build the dynamic personality matrix based on user preferences
    let basePrompt = `You are Nova AI, a highly advanced, ultra-premium AI assistant created by the Nova Cloud team. You are currently speaking with a user named "${userName || 'User'}". Always be extremely helpful, professional, and display high intelligence.`;
    
    // Inject Custom Persona if provided
    if (customPersona && customPersona.trim().length > 0) {
      basePrompt += `\n\n[USER CUSTOM DIRECTIVE]: ${customPersona}\n\n`;
    }

    if (aiSpeed === 'Precise (Strict)') {
      basePrompt += " You must be extremely concise, logical, and strictly factual. Avoid conversational filler. Prioritize absolute accuracy and deep reasoning over speed.";
    } else if (aiSpeed === 'Creative (Unfiltered)') {
      basePrompt += " You must be highly creative, articulate, and expressive. Feel free to use engaging metaphors, elaborate on complex ideas, and provide outside-the-box hypothetical scenarios. Use an inspiring tone.";
    } else {
      basePrompt += " Balance speed with accuracy. Be friendly, easy to understand, and provide clean, well-formatted markdown responses.";
    }
    
    basePrompt += " Use clear typography, bolded keywords, and properly formatted code blocks. Ensure your tone always feels sophisticated.";

    basePrompt += `\n\n[INTELLIGENCE CONTEXT]: Your current engine is "${activeModel}". 
[MULTIMODAL CAPABILITY]: If you see a message containing "[USER ATTACHMENT]" or "[FILE ATTACHMENT]", this means the Nova platform has successfully parsed the user's file and injected the data for you. Treat these files as if you are looking at them directly. Never apologize for being 'text-only' if the data is present in the prompt.
[IMAGE GENERATION]: If the user asks for an image, provide a brief confirmation. The Nova Vision engine triggers automatically on phrases like 'generate an image', 'make me a', 'design me a', or '/imagine'.`;

    // IMAGE GENERATION HEURISTIC
    const lastUserMessage = messages[messages.length - 1]?.content;
    const isImageRequest = typeof lastUserMessage === 'string' && (
      lastUserMessage.toLowerCase().startsWith('/imagine') || 
      lastUserMessage.toLowerCase().startsWith('/gen') ||
      lastUserMessage.toLowerCase().includes('generate an image') ||
      lastUserMessage.toLowerCase().includes('create an image') ||
      lastUserMessage.toLowerCase().includes('draw me a') ||
      lastUserMessage.toLowerCase().includes('make me a') ||
      lastUserMessage.toLowerCase().includes('design me a') ||
      lastUserMessage.toLowerCase().includes('build me a') ||
      lastUserMessage.toLowerCase().includes('draft a') ||
      lastUserMessage.toLowerCase().includes('paint a') ||
      lastUserMessage.toLowerCase().includes('picture of a') ||
      lastUserMessage.toLowerCase().includes('show me a')
    );

    if (isImageRequest) {
      let prompt = lastUserMessage.replace(/^\/imagine |^generate an image of |^create an image of |^draw me a |^make me a |^design me a |^build me a |^draft a |^paint a |^picture of a |^show me a |^\/gen /i, '');
      prompt = prompt.replace(/^generate an image |^create an image |^draw me |^make me |^design me |^build me |^draft |^paint |^picture of /i, '');
      
      const cleanPrompt = prompt.trim();
      const encodedPrompt = encodeURIComponent(cleanPrompt);
      
      // Guarantee a valid conversationId - auto-create if missing
      let convId = (req.body.conversationId && req.body.conversationId.length === 36) ? req.body.conversationId : null;
      if (!convId) {
        const newConv = await Conversation.create({ title: cleanPrompt.slice(0, 40) || 'Image Generation', creatorId: req.user.id });
        convId = newConv.id;
      } else {
        // Validate it actually exists
        const exists = await Conversation.findOne({ where: { id: convId, creatorId: req.user.id } });
        if (!exists) {
          const newConv = await Conversation.create({ title: cleanPrompt.slice(0, 40) || 'Image Generation', creatorId: req.user.id });
          convId = newConv.id;
        }
      }
      
      let imageUrl = "";
      let generatorModel = "";

      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy') {
        try {
          console.log('🖼️ NOVA IMAGE GEN - OPENAI DALL-E 3:', prompt);
          const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "hd"
          });
          imageUrl = response.data[0].url;
          generatorModel = "DALL-E 3";
        } catch (imgErr) {
          console.error('OpenAI Image Gen Error, falling back:', imgErr.message);
        }
      }

      // FALLBACK: If OpenAI failed or key is missing, use Pollinations (with Model Rotation)
      if (!imageUrl) {
        const cleanPrompt = prompt.trim();
        const encodedPrompt = encodeURIComponent(cleanPrompt);
        console.log('🖼️ NOVA IMAGE GEN - FALLBACK (Pollinations Rotation):', cleanPrompt);
        
        // We add a timestamp to force fresh generation and avoid some cache-based local queues
        const randomSeed = Math.floor(Math.random()*1000000);
        
        // Primary: Flux (Best quality)
        imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${randomSeed}&nologo=true&model=flux`;
        generatorModel = "Nova Neural (Flux)";
        
        // Note: For actual reliability against "Too Many Requests", we'd need multiple IPs.
        // But we add a hint in the AI response about adding the API key for Pro speed.
      }

      const aiResponse = `### 🎨 Nova Vision | Creative Generation\n\nI have generated the image based on your request: **"${prompt}"**\n\n![Generated Image](${imageUrl})\n\n*Note: This image was generated using ${generatorModel}. you can download it directly or ask me to refine the concept.*`;
      
      try {
        await Message.create({ content: lastUserMessage, isAI: false, senderId: req.user.id, conversationId: convId });
        await Message.create({ content: aiResponse, isAI: true, senderId: req.user.id, conversationId: convId, metadata: JSON.stringify({ model: generatorModel }) });
      } catch (saveErr) {
        console.error('Sync Error on image gen save:', saveErr);
      }

      return res.json({ content: aiResponse, model: `Nova Vision (${generatorModel})` });
    }

    const SYSTEM_PROMPT = basePrompt;

    // Prepare multi-modal/contextual messages
    const processedMessages = await Promise.all(messages.map(async (msg) => {
      const role = msg.role || (msg.isAI ? 'assistant' : 'user');
      
      // If the message already has attachment tags in content (from DB), keep them
      // This handles cases where the file no longer exists on disk (e.g. server restarts)
      if (msg.mediaUrl) {
        const relativePath = msg.mediaUrl.startsWith('/') ? msg.mediaUrl.slice(1) : msg.mediaUrl;
        const filePath = path.join(__dirname, '..', relativePath);
        
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase();
          
          // Case 1: Vision (Images)
          if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp' || ext === '.gif') {
            if (isVisionModel) {
              const imageBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
              const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
              return {
                role,
                content: [
                  { type: 'text', text: msg.content || "Describe this image." },
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
                ]
              };
            } else {
              return {
                role,
                content: `${msg.content || ""}\n\n[USER ATTACHMENT: ${path.basename(filePath)}]\n(Note: The user sent an image. Acknowledge it and answer any questions about it based on context.)`
              };
            }
          }
          
          // Case 2: Document Parsing (PDF)
          if (ext === '.pdf') {
            try {
              const dataBuffer = fs.readFileSync(filePath);
              const data = await pdf(dataBuffer);
              return { role, content: `${msg.content || ""}\n\n[DOCUMENT ATTACHMENT: ${path.basename(filePath)}]\n${data.text}` };
            } catch (pdfErr) { console.error('PDF Parse Error:', pdfErr); }
          }

          // Case 3: Document Parsing (DOCX)
          if (ext === '.docx') {
            try {
              const result = await mammoth.extractRawText({ path: filePath });
              return { role, content: `${msg.content || ""}\n\n[DOCUMENT ATTACHMENT: ${path.basename(filePath)}]\n${result.value}` };
            } catch (docxErr) { console.error('DOCX Parse Error:', docxErr); }
          }
          
          // Case 4: Code/Text Reading
          const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.txt', '.py', '.html', '.css', '.md'];
          if (textExtensions.includes(ext)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const truncatedContent = fileContent.length > 10000 ? fileContent.slice(0, 10000) + "...[content truncated]" : fileContent;
            return { role, content: `${msg.content || ""}\n\n[FILE ATTACHMENT: ${path.basename(filePath)}]\n\`\`\`${ext.slice(1) || 'text'}\n${truncatedContent}\n\`\`\`` };
          }
        }
        
        // FILE NOT ON DISK — but content from DB already has the [ATTACHMENT] tag injected
        // Just pass it through as-is so AI can still reference it by name
        return { role, content: msg.content || `[User sent a file: ${msg.mediaUrl}]` };
      }
      
      return { role, content: msg.content || "" };
    }));

    // SAFETY: Normalize all content to strings for non-vision models
    // Vision array format [{ type: 'text' }, { type: 'image_url' }] causes 400 errors on Groq/Llama
    const safeMessages = processedMessages.map(m => {
      if (Array.isArray(m.content)) {
        if (isVisionModel && (isGPT || isGemini)) {
          return m; // Pass arrays through for GPT/Gemini vision models
        }
        // Flatten to string for all other models
        const textContent = m.content.find(c => c.type === 'text')?.text || '';
        const hasImage = m.content.some(c => c.type === 'image_url');
        return { ...m, content: `${textContent}${hasImage ? '\n\n[Image Attached]' : ''}` };
      }
      return m;
    });
          



    let aiContent = "";
    let actualModelUsed = activeModel;
    
    // Set dynamic temperature
    const resolvedTemp = aiSpeed === 'Precise (Strict)' ? 0.2 : (aiSpeed === 'Creative (Unfiltered)' ? 0.9 : 0.7);

    try {
      if (isGPT) {
        // o1/o3 models don't support system roles or temperatures natively
        const isReasoning = activeModel.startsWith('o1') || activeModel.startsWith('o3');
        const finalMessages = isReasoning 
          ? [{ role: "user", content: "System Instruction: " + SYSTEM_PROMPT }, ...safeMessages]
          : [{ role: "system", content: SYSTEM_PROMPT }, ...safeMessages];
        
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
            const mini = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: "system", content: SYSTEM_PROMPT }, ...safeMessages], max_tokens: 1024, temperature: resolvedTemp });
            aiContent = mini.choices[0].message.content;
            actualModelUsed = 'GPT-4o-mini';
          } else throw gptErr;
        }
      } else if (isGemini) {
        const genModel = genAI.getGenerativeModel({ 
          model: activeModel,
          systemInstruction: SYSTEM_PROMPT
        });
        
        const contents = processedMessages.map(m => {  // Gemini handles arrays natively
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
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...safeMessages],
          temperature: resolvedTemp,
          max_tokens: 1024,
        });
        aiContent = completion.choices[0].message.content;
      }
    } catch (apiErr) {
      console.error('Final AI fallback triggered:', apiErr.message);
      const fallbackCompletion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...safeMessages],
        temperature: resolvedTemp,
        max_tokens: 1024,
      });
      aiContent = fallbackCompletion.choices[0].message.content;
      actualModelUsed = "Llama 3.1 (Fast Fallback)";
    }
    
    // Save to DB — guarantee a valid conversationId exists before writing messages
    let convId = (req.body.conversationId && req.body.conversationId.length === 36) ? req.body.conversationId : null;
    if (!convId) {
      const firstUserMsg = messages.find(m => m.role === 'user');
      const autoTitle = (typeof firstUserMsg?.content === 'string' ? firstUserMsg.content : 'New Chat').slice(0, 40);
      const newConv = await Conversation.create({ title: autoTitle, creatorId: req.user.id });
      convId = newConv.id;
    } else {
      const exists = await Conversation.findOne({ where: { id: convId, creatorId: req.user.id } });
      if (!exists) {
        const newConv = await Conversation.create({ title: 'New Chat', creatorId: req.user.id });
        convId = newConv.id;
      }
    }

    try {
      // Save User Message
      const userMsgRaw = messages[messages.length - 1]; 
      const userMsgProcessed = processedMessages[processedMessages.length - 1]; // Use the one with the [ATTACHMENT] tag
      
      if (userMsgRaw && userMsgRaw.role === 'user') {
        let contentToSave = "";
        if (Array.isArray(userMsgProcessed.content)) {
          // Vision model format: extract text and append markers
          const textPart = userMsgProcessed.content.find(c => c.type === 'text')?.text || "";
          const hasImage = userMsgProcessed.content.some(c => c.type === 'image_url');
          contentToSave = `${textPart}${hasImage ? "\n\n[USER ATTACHMENT: Image Processed]" : ""}`;
        } else {
          // Standard text format (includes our injected tags)
          contentToSave = userMsgProcessed.content;
        }
          
        await Message.create({
          content: contentToSave,
          isAI: false,
          senderId: req.user.id,
          conversationId: convId,
          mediaUrl: userMsgRaw.mediaUrl || '',
          mediaType: userMsgRaw.mediaType || 'none'
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
