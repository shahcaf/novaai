require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Groq Configuration (completely free, no credit card needed)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// In-memory chat history
let chatHistory = [
  {
    role: "system",
    content: "You are Nova AI, a helpful and friendly AI assistant. Format your responses using markdown where appropriate. Be concise and clear."
  }
];

console.log(`Nova AI Server starting...`);
console.log(`GROQ API Key loaded: ${process.env.GROQ_API_KEY ? 'YES ✓' : 'MISSING ✗'}`);

/**
 * POST /chat
 * Accepts full history from client — stateless, supports multiple conversations
 */
app.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY is missing in .env file" });
  }

  try {
    // Build messages: system prompt + full history + new user message
    const messages = [
      {
        role: "system",
        content: "You are Nova AI, a helpful and friendly AI assistant. Format your responses using markdown where appropriate. Be concise and clear."
      },
      ...history,
      { role: 'user', content: message }
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const aiResponse = completion.choices[0].message.content;
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Groq API Error:', error?.message || error);
    res.status(500).json({
      error: "Failed to fetch response from Nova AI",
      details: error?.message || "Unknown error"
    });
  }
});

/**
 * POST /clear
 * Clears the chat history
 */
app.post('/clear', (req, res) => {
  chatHistory = [
    {
      role: "system",
      content: "You are Nova AI, a helpful and friendly AI assistant. Format your responses using markdown where appropriate."
    }
  ];
  res.json({ message: "Chat history cleared" });
});

app.listen(PORT, () => {
  console.log(`Nova AI is running on http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  }
});
