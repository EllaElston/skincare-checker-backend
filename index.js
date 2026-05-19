// index.js
require('dotenv').config();
console.log('🔑 LOADED KEY:', process.env.OPENAI_API_KEY ? 'yes' : 'MISSING');
console.log('🗒  NOTION TOKEN:', process.env.NOTION_TOKEN ? 'yes' : 'MISSING');

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const multer  = require('multer');
const { OpenAI } = require('openai');
const { Client: NotionClient } = require('@notionhq/client');

const app = express();

// 1) CORS setup: allow only your Netlify site (and localhost for dev)
const allowedOrigins = [
  'https://cool-taffy-c547bb.netlify.app',
  'http://localhost:3000',
  'http://localhost:8765',
  'http://127.0.0.1:8765',
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

app.use(express.json({ limit: '2mb' }));

// serve the inbox and personal HQ as static apps from the same backend
app.use('/inbox',    express.static(path.join(__dirname, 'inbox')));
app.use('/personal', express.static(path.join(__dirname, 'personal')));
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));

// 2) initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 2b) Notion client — only if a token is configured
const notion = process.env.NOTION_TOKEN
  ? new NotionClient({ auth: process.env.NOTION_TOKEN })
  : null;

// multer for audio uploads (in-memory, max ~25 MB which is Whisper's limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

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

/* ═══════════════════════════════════════════════════════════════════
   VOICE INBOX → NOTION ROUTER
   Endpoints:
     GET  /api/inbox/health      — is the server happy + which keys are set
     POST /api/inbox/transcribe  — audio blob → text (Whisper)
     POST /api/inbox/route       — text + jar list → AI split into jars
     POST /api/inbox/dispatch    — confirmed splits → write to Notion
   ═══════════════════════════════════════════════════════════════════ */

app.get('/api/inbox/health', (_req, res) => {
  res.json({
    ok: true,
    openai: !!process.env.OPENAI_API_KEY,
    notion: !!process.env.NOTION_TOKEN,
  });
});

// --- transcribe audio with Whisper -------------------------------------
app.post('/api/inbox/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided.' });

    // OpenAI SDK accepts a File-like object; build one from the buffer.
    const ext = (req.file.mimetype || '').includes('mp4') ? 'mp4'
              : (req.file.mimetype || '').includes('wav') ? 'wav'
              : 'webm';
    const file = await OpenAI.toFile(req.file.buffer, `voice-note.${ext}`, {
      type: req.file.mimetype || 'audio/webm',
    });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    res.json({ text: transcription.text || '' });
  } catch (err) {
    console.error('transcribe error:', err);
    res.status(500).json({ error: err.message || 'Transcription failed.' });
  }
});

// --- route a transcript across jars ------------------------------------
app.post('/api/inbox/route', async (req, res) => {
  try {
    const { transcript, jars } = req.body || {};
    if (!transcript || !Array.isArray(jars) || jars.length === 0) {
      return res.status(400).json({ error: 'transcript and jars[] are required.' });
    }

    const jarDescriptions = jars
      .map(j => `- "${j.name}": ${j.description || '(no description)'}`)
      .join('\n');

    const systemPrompt = `You are a personal-assistant routing engine.
You receive a free-flowing voice transcript and a list of named "jars" (categories).
Split the transcript into discrete actionable pieces and assign each piece to the best jar.
Rewrite each piece into a short, clean line — fix grammar, drop filler ("um", "like"), keep the user's voice.
If something doesn't clearly fit any jar, put it in a jar named "inbox".
Return STRICT JSON only, no prose, no markdown fences.`;

    const userPrompt = `JARS:
${jarDescriptions}
- "inbox": fallback for anything that doesn't fit elsewhere

TRANSCRIPT:
"""${transcript}"""

Return JSON of the shape:
{
  "items": [
    { "jar": "<one of the jar names>", "content": "<cleaned single line or short paragraph>" }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    });

    const raw = completion.choices[0].message.content || '{"items":[]}';
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { parsed = { items: [] }; }

    res.json({ items: parsed.items || [] });
  } catch (err) {
    console.error('route error:', err);
    res.status(500).json({ error: err.message || 'Routing failed.' });
  }
});

// --- dispatch confirmed items to Notion --------------------------------
// items: [{ jar: "<name>", content: "...", target: { type: "page"|"database", id: "<notion id>" } }]
app.post('/api/inbox/dispatch', async (req, res) => {
  try {
    if (!notion) {
      return res.status(400).json({ error: 'NOTION_TOKEN is not set on the server.' });
    }
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items[] is required.' });
    }

    const results = [];

    for (const item of items) {
      const target = item.target;
      if (!target || !target.id) {
        results.push({ jar: item.jar, ok: false, error: 'no target configured for this jar' });
        continue;
      }

      try {
        if (target.type === 'database') {
          // Find the title property of the database, add a row.
          const db = await notion.databases.retrieve({ database_id: target.id });
          const titleProp = Object.entries(db.properties).find(([, v]) => v.type === 'title');
          if (!titleProp) throw new Error('database has no title property');

          await notion.pages.create({
            parent: { database_id: target.id },
            properties: {
              [titleProp[0]]: {
                title: [{ type: 'text', text: { content: item.content.slice(0, 2000) } }],
              },
            },
          });
        } else {
          // page → append a bullet block
          await notion.blocks.children.append({
            block_id: target.id,
            children: [
              {
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: {
                  rich_text: [{ type: 'text', text: { content: item.content.slice(0, 2000) } }],
                },
              },
            ],
          });
        }
        results.push({ jar: item.jar, ok: true });
      } catch (err) {
        console.error('dispatch item failed:', item.jar, err.message);
        results.push({ jar: item.jar, ok: false, error: err.message });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error('dispatch error:', err);
    res.status(500).json({ error: err.message || 'Dispatch failed.' });
  }
});

// 6) start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`   inbox UI:    http://localhost:${PORT}/inbox/`);
  console.log(`   personal HQ: http://localhost:${PORT}/personal/`);
});
