const { GoogleGenAI } = require('@google/genai');
const SYSTEM_PROMPT = require('./systemPrompt');

let ai;

async function callGemini(messages) {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  const MODEL = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();

  if (!key) {
    throw new Error('GEMINI_API_KEY is missing. Put it in .env in the project root.');
  }
  
  ai = ai || new GoogleGenAI({ apiKey: key });

  // Gemini requires conversation history to begin strictly with a user turn
  let turns = [...messages];
  while (turns.length && turns[0].role !== 'user') {
    turns.shift();
  }

  const contents = turns.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }]
  }));

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: 600
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty response (possibly blocked by safety filters).');
    }
    return text;
  } catch (err) {
    console.error('--- GEMINI CALL FAILED ---');
    console.error('Model:', MODEL);
    console.error('Message:', err.message);
    throw err;
  }
}

module.exports = { callGemini };