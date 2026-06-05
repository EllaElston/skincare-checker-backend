# Skincare HQ

A little personal toolkit that runs from one backend:

| App | URL | What it does |
| --- | --- | --- |
| **Personal HQ** | `/personal/` | Your daily dashboard — routines, habits, goals, weekly content planner, calendar + Notion embeds. Everything saves to your browser. |
| **Voice Inbox** | `/inbox/` | Speak (or type) a brain-dump → AI splits it into your "jars" → you review → it files each piece into the right Notion page or database. |
| **Skincare Checker** | `/check` (API) | The original endpoint: send a list of ingredients, get back comedogenic ratings + notes. |

The two web apps share a top nav bar, so you can hop between **dashboard** and **voice inbox**.

---

## 1. Quick start

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
# 1. install dependencies
npm install

# 2. set up your keys (see section 2)
cp .env.example .env
#    …then open .env and paste your keys in

# 3. run it
npm start
```

You'll see:

```
✅ Backend server running on port 3000
   inbox UI:    http://localhost:3000/inbox/
   personal HQ: http://localhost:3000/personal/
```

Open those URLs in your browser. That's it.

> **Tip:** to change the port, set `PORT=8765` in your `.env`.

---

## 2. Your keys (`.env`)

Copy `.env.example` to `.env` and fill in two values. **Never commit `.env`** — it's already in `.gitignore`.

### `OPENAI_API_KEY` (required)
Powers the skincare checker, the voice transcription (Whisper), and the AI that sorts your notes into jars.
Get one at <https://platform.openai.com/api-keys>.

### `NOTION_TOKEN` (only needed for the Voice Inbox → Notion step)
Without it, the inbox still records, transcribes, and sorts — it just can't *send* to Notion.

1. Go to <https://www.notion.so/profile/integrations>
2. **New integration → Internal**, give it a name (e.g. "Voice Inbox"), and copy the **Internal Integration Token** (starts with `secret_` or `ntn_`).
3. Paste it into `.env` as `NOTION_TOKEN=...`.

---

## 3. Wiring up your Notion jars

This is the one fiddly part. A **jar** is a category in the Voice Inbox, and each jar points at **one Notion page or database**. You set these up once in the inbox's settings (the **jars** button, bottom-right).

For every jar you want to use, you need to do two things in Notion:

### a) Connect your integration to the page/database
Open the Notion page or database → top-right **•••** menu → **Connect to** (or **Connections**) → pick the integration you made in step 2.
*If you skip this, Notion will reject the write with a "could not find / no access" error.*

### b) Grab its ID and paste it into the jar
The **ID** is the 32-character chunk of letters/numbers in the page's URL.

```
https://www.notion.so/My-Ideas-1f2e3d4c5b6a7890abcdef1234567890?v=...
                              └──────────────┬──────────────┘
                                   this is the ID
```

In the inbox → **jars**, for each jar set:
- **name** — what you'll call it (the AI uses this + the description to route)
- **notion id** — the 32-char ID from above
- **type** — `page` (appends each note as a bullet) or `database` (adds each note as a new row, using the database's title column)
- **description** — a sentence describing what belongs here; the AI reads this to decide where things go

### Trusted jars (auto-route)
Tick **⚡ trusted** on a jar, then turn on **Auto-send trusted jars** at the top of settings. Notes routed to a trusted jar go straight to Notion and skip the review screen — anything *not* trusted still waits for you to confirm.

---

## 4. Using the Voice Inbox

1. **Capture** — hit record and talk, or type into the text box.
2. **Transcript** — Whisper turns your audio into text; tweak it if needed.
3. **Sort** — the AI splits it into clean, single-line pieces and assigns each to a jar.
4. **Review** — check/uncheck pieces, edit wording, then **send to Notion**.
5. **Done** — you get a per-jar summary of what landed.

(With auto-route on, trusted pieces fly through steps 4–5 automatically.)

---

## 5. Using Personal HQ

Everything on the dashboard saves to **your browser** (localStorage) — no account, no server storage. That also means it's per-device. Cards include morning/evening routines, weekly habits, in-progress goals, a weekly content planner, a brand dump, packing & task lists, plus embeddable Google Calendar and Notion content-calendar frames. Use the **edit** button (bottom-right) to paste your links and embed URLs once.

---

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `🔑 LOADED KEY: MISSING` on startup | Your `.env` isn't being read. Make sure it's in the project root and named exactly `.env`. |
| Health check at `/api/inbox/health` shows `"notion": false` | `NOTION_TOKEN` isn't set — add it to `.env` and restart. |
| Inbox says "no Notion ID set" | Open the **jars** settings and paste the 32-char ID into that jar. |
| Notion write fails with "could not find" / access error | You forgot step 3a — connect your integration to that page/database in Notion. |
| Recording does nothing | The mic needs a secure context. `localhost` is fine; if hosting elsewhere, use HTTPS. |

---

## Project layout

```
index.js          Express server: skincare /check + /api/inbox/* + serves the static apps
personal/         Personal HQ  (index.html, app.js, styles.css)
inbox/            Voice Inbox  (index.html, app.js, styles.css)
frontend/         Skincare checker UI
.env.example      Template for your keys
```

Run with `npm start`.
