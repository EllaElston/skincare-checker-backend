// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

    // Build your GPT prompt
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

    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert skincare formulator.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    });

    // Raw text from the model
    const raw = response.choices[0].message.content;
    console.log('✉️  RAW MODEL OUTPUT:', raw);

    // Parse and send back JSON
    const data = JSON.parse(raw.trim());
    res.json(data);

  } catch (err) {
    console.error('❌ ERROR:', err);
    res.status(500).json({ error: err.message || 'AI error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Listening on port ${port}`));
