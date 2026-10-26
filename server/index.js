require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { callGemini } = require('./gemini');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/widget', express.static(path.join(__dirname, '../widget')));

// Basic IP rate limiting (20 requests per minute)
const ipRateMap = new Map();
const rateLimiter = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const entry = ipRateMap.get(ip) || { count: 0, resetTime: now + 60000 };

  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + 60000;
  } else {
    entry.count += 1;
    if (entry.count > 20) {
      return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    }
  }
  ipRateMap.set(ip, entry);
  next();
};

const leadsDatabase = [];

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'BIS Consultancy Services Bot', uptime: process.uptime() });
});

app.post('/api/chat', rateLimiter, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    const latest = messages[messages.length - 1];
    if (latest.text && latest.text.length > 500) {
      return res.status(400).json({ error: 'Message exceeds 500 characters limit.' });
    }

    let botReply = await callGemini(messages);

    // Extract lead JSON if provided
    const leadMatch = botReply.match(/\{"lead_complete":\s*true[\s\S]*?\}/);
    let captured = false;

    if (leadMatch) {
      try {
        const leadObj = JSON.parse(leadMatch[0]);
        leadsDatabase.push({
          id: leadsDatabase.length + 1,
          name: leadObj.name,
          contact: leadObj.contact,
          requirement: leadObj.requirement,
          received_at: new Date().toISOString()
        });
        console.log('--- NEW LEAD CAPTURED ---', leadObj);
        botReply = botReply.replace(leadMatch[0], '').trim();
        captured = true;
      } catch (e) {
        console.error('Error parsing lead JSON:', e);
      }
    }

    res.json({ reply: botReply, leadCaptured: captured });
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Unable to communicate with assistant.' });
  }
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/chat.html'));
});

app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Standalone Chat: http://localhost:${PORT}/chat`);
  console.log(`Widget Demo:     http://localhost:${PORT}/embed-demo.html`);
  console.log(`===========================================\n`);
});