// index.js
require('dotenv').config();
console.log('🔑 LOADED KEY:', process.env.OPENAI_API_KEY);

const express = require('express');
const cors    = require('cors');
const { OpenAI } = require('openai');

const app = express();

// 1) CORS setup: allow only your Netlify site (and localhost for dev)
const allowedOrigins = [
  'https://cool-taffy-c547bb.netlify.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (e.g. mobile tools, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// 2) initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 3) your single /check endpoint
app.post('/check', async (req, res) => {
  try {
    const { ingredients } = req.body;
    if (!ingredients) {
      return res.status(400).json({ error: 'No ingredients provided.' });
    }

    const prompt = `
You are a skincare chemist. Given this comma-separated list of ingredients:
${ingredients}

For each ingredient, return a JSON array of objects with:
- "name"
- "comedogenic_rating" (0–5)
- "sensitivity_risk" ("none","low","moderate","high")
- "function" (e.g. "emollient")
- "notes"

Respond *only* with the JSON array.
    `.trim();
    console.log('🔍 PROMPT:', prompt);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',               // or 'gpt-3.5-turbo'
      messages: [
        { role: 'system', content: 'You are an expert skincare formulator.' },
        { role: 'user',   content: prompt }
      ],
      temperature: 0.2,
    });

    // 4) clean out any ``` fences
    let raw = response.choices[0].message.content;
    raw = raw
      .replace(/^```(?:json)?\s*/, '')
      .replace(/\s*```$/, '');

    console.log('📥 CLEANED MODEL OUTPUT:', raw);

    // 5) parse & send back JSON
    const data = JSON.parse(raw);
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI error' });
  }
});

// 6) start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
});
