// index.js

// 1) Load .env
require('dotenv').config();

// 2) Quick sanity‑check that your key is present
console.log(
  '🔑 LOADED KEY:',
  process.env.OPENAI_API_KEY
    ? process.env.OPENAI_API_KEY.slice(0, 10) + '…'
    : 'no key'
);

// 3) Pull in your dependencies
const express = require('express');
const cors    = require('cors');
const { OpenAI } = require('openai');

// 4) Initialize Express + middleware
const app = express();
app.use(cors());
app.use(express.json());

// 5) Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 6) POST /check endpoint
app.post('/check', async (req, res) => {
  try {
    // a) Extract ingredients from the JSON body
    const { ingredients } = req.body;
    console.log('✅ got ingredients:', ingredients);

    if (!ingredients) {
      return res.status(400).json({ error: 'No ingredients provided.' });
    }

    // b) Build our GPT prompt
    const prompt = `
You are a skincare chemist. Given this comma‑separated list of ingredients:
${ingredients}

For each ingredient, return a JSON array of objects with:
- "name"
- "comedogenic_rating" (0–5)
- "sensitivity_risk" ("none","low","moderate","high")
- "function" (e.g. "emollient")
- "notes"

Respond *only* with the JSON array.
    `.trim();
    console.log('✏️  built prompt:', prompt);

    // c) Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert skincare formulator.' },
        { role: 'user',   content: prompt }
      ],
      temperature: 0.2,
    });

    // d) Parse the JSON the model returned
    const raw = response.choices[0].message.content;
    console.log('📨 RAW MODEL OUTPUT:', raw);

    const data = JSON.parse(raw);
    return res.json(data);

  } catch (err) {
    console.error('🔥 AI error:', err);
    return res.status(500).json({ error: 'AI error' });
  }
});

// 7) Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Listening on port ${port}`);
});
