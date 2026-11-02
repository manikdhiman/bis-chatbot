require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

(async () => {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  const model = (process.env.GEMINI_MODEL || 'gemini-flash-latest').trim();

  console.log('Key loaded:', key ? `yes (${key.length} chars)` : 'NO - check .env location');
  console.log('Target Model:', model);

  if (!key) {
    console.error('Missing GEMINI_API_KEY in .env');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: key });

  console.log('Sending test request to Gemini (waiting up to 45s)...');

  const timer = setTimeout(() => {
    console.error('FAILED: Request exceeded 45s. Check network/VPN/firewall.');
    process.exit(1);
  }, 45000);

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: 'Reply with the word OK.'
    });
    clearTimeout(timer);
    console.log('\n>>> SUCCESS! Model responded:', response.text.trim());
  } catch (err) {
    clearTimeout(timer);
    console.error('\n>>> FAILED:', err.message);
  }
})();