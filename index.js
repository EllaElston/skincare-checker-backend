// index.js
require('dotenv').config();                                  // 1️⃣ load .env
console.log('🔑 LOADED KEY:', process.env.OPENAI_API_KEY);   // sanity check

const express = require('express');
const cors    = require('cors');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// our one endpoint
app.post('/check', async (req, res) => {
  try {
    const { ingredients } = req.body;
    if (!ingredients) {
      return res.status(400).json({ error: 'No ingredients provided.' });
    }

    // build your prompt
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

    // call OpenAI
    const response = await openai.chat.completions.create({
      model:       'gpt-4o',     // or 'gpt-3.5-turbo'
      messages: [
        { role: 'system', content: 'You are an expert skincare formulator.' },
        { role: 'user',   content: prompt },
      ],
      temperature: 0.2,
    });

    // log raw text so we can debug in Render’s logs
   // … after you await the OpenAI call …
let raw = response.choices[0].message.content;

// 1) strip any leading ```json or ```
// 2) strip any trailing ```
raw = raw
  .replace(/^```(?:json)?\s*/, '')
  .replace(/\s*```$/, '');

console.log('✉️CLEANED MODEL OUTPUT:', raw);

const data = JSON.parse(raw);
res.json(data);


  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
});
