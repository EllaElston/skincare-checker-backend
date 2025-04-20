// index.js
require('dotenv').config();
console.log(
  '🔑 LOADED KEY:',
  process.env.OPENAI_API_KEY
    ? process.env.OPENAI_API_KEY.slice(0, 10) + '…'
    : 'no key'
);

const express = require('express');
const cors    = require('cors');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/check', async (req, res) => {
  try {
    const { ingredients } = req.body;
    if (!ingredients) {
      return res.status(400).json({ error: 'No ingredients provided.' });
    }

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

    // Call the API
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',        // universally available on Plus
      messages: [
        { role: 'system', content: 'You are an expert skincare formulator.' },
        { role: 'user',   content: prompt }
      ],
      temperature: 0.2
    });

    // Log exactly what the model sent back
    console.log('📨 RAW MODEL OUTPUT:', response.choices[0].message.content);

    // Parse and return
    const data = JSON.parse(response.choices[0].message.content);
    res.json(data);

  } catch (err) {
    console.error('💥 OPENAI ERROR:', err);
    res.status(500).json({ error: err.message || err.toString() });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));
