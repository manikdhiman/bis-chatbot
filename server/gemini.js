const { GoogleGenerativeAI } = require('@google/generative-ai');
const SYSTEM_PROMPT = require('./systemPrompt');

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const MODEL_NAME = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim().replace(/[\x00-\x1F\x7F]/g, '');

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function callGemini(messages) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing in your .env file.');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_PROMPT
    });

    const latestUserMessage = messages[messages.length - 1].text;
    let rawHistory = messages.slice(0, -1);

    // Ensure history strictly begins with a user turn
    while (rawHistory.length > 0 && rawHistory[0].role !== 'user') {
      rawHistory.shift();
    }

    const formattedHistory = rawHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const chat = model.startChat({
      history: formattedHistory
    });

    const result = await chat.sendMessage(latestUserMessage);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error('--- GEMINI CALL FAILED ---', err.message);
    throw err;
  }
}

module.exports = { callGemini };