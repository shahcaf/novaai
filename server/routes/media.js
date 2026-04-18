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
    const mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';

    const newMessage = await Message.create({
      senderId: req.user.id,
      content: req.body.content || '',
      mediaUrl,
      mediaType,
      conversationId: req.body.conversationId // Added to link message to conversation
    });

    const populatedMessage = await Message.findByPk(newMessage.id, {
      include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }]
    });

    res.json(populatedMessage);
  } catch (err) {
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
      whereClause.text = { [Op.iLike]: `%${search}%` };
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
