require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { callGemini } = require('./gemini');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS setup
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
app.use(express.static(path.join(__dirname, '../public')));
app.use('/widget', express.static(path.join(__dirname, '../widget')));

// Periodic cleanup rate limiter
const ipRateMap = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipRateMap.entries()) {
    if (now > entry.resetTime) {
      ipRateMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

const rateLimiter = (req, res, next) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
  const now = Date.now();
  const entry = ipRateMap.get(ip) || { count: 0, resetTime: now + 60000 };

  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + 60000;
  } else {
    entry.count += 1;
    if (entry.count > 20) {
      return res.status(429).json({ error: 'Too many messages, please wait a minute and try again.' });
    }
  }
  ipRateMap.set(ip, entry);
  next();
};

// Lead persistence via JSONL
function saveLead(lead) {
  const row = {
    id: Date.now(),
    name: lead.name || 'Anonymous',
    contact: lead.contact || 'N/A',
    requirement: lead.requirement || 'N/A',
    received_at: new Date().toISOString()
  };
  fs.appendFileSync(path.join(__dirname, 'leads.jsonl'), JSON.stringify(row) + '\n');
  console.log('--- NEW LEAD ---', row);
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'BIS Consultancy Services Bot', uptime: process.uptime() });
});

app.post('/api/chat', rateLimiter, async (req, res) => {
  // Input validation
  let { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  messages = messages
    .filter(m => m && typeof m.text === 'string' && ['user', 'model'].includes(m.role))
    .map(m => ({ role: m.role, text: m.text.slice(0, 500) }))
    .slice(-10);

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Last message must be from the user.' });
  }

  try {
    let botReply = await callGemini(messages);
    let captured = false;

    // Lead extraction handling code fences
    const leadMatch = botReply.match(/\{\s*"lead_complete"\s*:\s*true[\s\S]*?\}/);
    if (leadMatch) {
      try {
        const lead = JSON.parse(leadMatch[0]);
        saveLead(lead);
        captured = true;
      } catch (e) {
        console.error('Lead JSON parse error:', e.message);
      }
      botReply = botReply.replace(leadMatch[0], '').replace(/```(?:json)?/g, '').trim();
    }

    res.json({ reply: botReply, leadCaptured: captured });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Unable to communicate with assistant.' });
  }
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/chat.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Standalone Chat: http://localhost:${PORT}/chat`);
  console.log(`Widget Demo:     http://localhost:${PORT}/embed-demo.html`);
});