const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Upload Media
router.post('/upload', auth, upload.single('media'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mediaUrl = `/uploads/${req.file.filename}`;
    let mediaType = 'file';
    if (req.file.mimetype.startsWith('image')) mediaType = 'image';
    else if (req.file.mimetype.startsWith('video')) mediaType = 'video';

    const convId = (req.body.conversationId && req.body.conversationId.length === 36) ? req.body.conversationId : null;

    // RUN GROQ VISION IMMEDIATELY ON UPLOAD for images
    // This runs while the user is typing, so there's zero extra latency at send time.
    // The description is stored in DB, making it Render-redeploy-proof.
    let visionContent = req.body.content || '';
    if (mediaType === 'image') {
      try {
        const fs = require('fs');
        const path = require('path');
        const Groq = require('groq-sdk');
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        const ext = path.extname(req.file.filename).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        const imageBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
        
        console.log('🔍 NOVA UPLOAD VISION: Analyzing', req.file.filename);
        const visionResult = await groq.chat.completions.create({
          model: 'llama-3.2-11b-vision-preview',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image in complete detail. Include ALL visible text (copy it verbatim), UI elements, code, colors, layout, and any important information. Be thorough and precise.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          }],
          max_tokens: 1024,
          temperature: 0.1
        });
        
        const desc = visionResult.choices[0]?.message?.content || '';
        if (desc.trim()) {
          visionContent = `[NOVA VISION ANALYSIS - IMAGE CONTENT]:\n${desc.trim()}`;
          console.log('✅ NOVA UPLOAD VISION: Analysis complete');
        }
      } catch (visionErr) {
        console.error('Upload Vision Error:', visionErr.message);
        // Non-fatal — proceed without vision description
      }
    }

    const newMessage = await Message.create({
      senderId: req.user.id,
      content: visionContent,
      mediaUrl,
      mediaType,
      conversationId: convId
    });

    const populatedMessage = await Message.findByPk(newMessage.id, {
      include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }]
    });

    // Return vision content so client can pass it to chat
    res.json({ ...populatedMessage.toJSON(), visionContent });
  } catch (err) {
    console.error('Media upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get Media Gallery
router.get('/gallery', async (req, res) => {
  try {
    const { type, search } = req.query;
    let whereClause = {
      mediaType: { [Op.ne]: 'none' }
    };

    if (type && type !== 'all') {
      whereClause.mediaType = type;
    }

    if (search) {
      whereClause.content = { [Op.iLike]: `%${search}%` };
    }

    const media = await Message.findAll({
      where: whereClause,
      include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(media);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
