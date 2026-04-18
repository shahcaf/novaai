require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const Groq = require('groq-sdk');

const sequelize = require('./config/database');
const User = require('./models/User');
const Message = require('./models/Message');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const mediaRoutes = require('./routes/media');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check for Render
app.get('/', (req, res) => res.send('Nova AI Server is Running'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/media', mediaRoutes);

// Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Database Sync & Server Start
// Using { alter: true } is generally safer for production migrations on CockroachDB
sequelize.authenticate()
  .then(() => {
    console.log('Database connection authenticated ✓');
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    console.log('CockroachDB synced ✓');
    server.listen(PORT, () => {
      console.log(`Nova AI is running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('SERVER START ERROR:', err);
    process.exit(1); // Explicitly exit so process managers know it failed
  });

// Socket.io
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('sendMessage', async (data) => {
    try {
      const { senderId, text, mediaUrl, mediaType } = data;
      
      const newMessage = await Message.create({
        senderId,
        text: text || '',
        mediaUrl: mediaUrl || '',
        mediaType: mediaType || 'none'
      });
      
      const populatedMessage = await Message.findByPk(newMessage.id, {
        include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }]
      });
      
      if (populatedMessage) {
        io.emit('message', populatedMessage);
      }

      // AI Check
      if (text && (text.toLowerCase().includes('@nova') || text.toLowerCase().includes('nova'))) {
        const response = await getAIResponse(text);
        const aiMessage = await Message.create({
          senderId, // Simplified for now
          text: response,
          isAI: true
        });
        const populatedAI = await Message.findByPk(aiMessage.id, {
          include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }]
        });
        if (populatedAI) {
          io.emit('message', populatedAI);
        }
      }
    } catch (err) {
      console.error('Socket error:', err);
    }
  });

  socket.on('disconnect', () => console.log('Client disconnected'));
});

async function getAIResponse(message) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are Nova AI, a helpful and friendly AI assistant." },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('AI Response Error:', error);
    return "Sorry, I'm having trouble connecting to my brain right now.";
  }
}
