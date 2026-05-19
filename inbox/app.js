/* ─────────────────────────────────────────────────────────────
   Voice Inbox — app.js
   Flow: record → /api/inbox/transcribe → /api/inbox/route → preview
         → /api/inbox/dispatch (Notion)
   Jars are user-configured and persisted in localStorage.
   ───────────────────────────────────────────────────────────── */

// When the inbox is served from the same Express backend, relative URLs work.
// If you ever host the static UI elsewhere, set window.MYHQ_API = 'https://your-backend'.
const API_BASE = (typeof window !== "undefined" && window.MYHQ_API) || "";

const NS = "myhq.inbox.";
const store = {
  get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { localStorage.setItem(NS + k, JSON.stringify(v)); },
};

/* ─────────  DEFAULT JARS  ───────── */
const DEFAULT_JARS = [
  {
    name: "content ideas",
    description: "hooks, captions, reel ideas, post angles, anything for the Skincare Made Simple content calendar",
    type: "database", id: ""
  },
  {
    name: "client tasks",
    description: "anything to do for/about a client — emails to send, follow-ups, deliverables",
    type: "database", id: ""
  },
  {
    name: "brand dump",
    description: "general brand thoughts, philosophy, voice, mission, big-picture musings",
    type: "page", id: ""
  },
  {
    name: "to do",
    description: "personal tasks, errands, life admin",
    type: "database", id: ""
  },
  {
    name: "packing list",
    description: "things to bring on a trip — especially the farm",
    type: "page", id: ""
  },
  {
    name: "ideas",
    description: "business ideas, product ideas, experiments to try later",
    type: "page", id: ""
  },
  {
    name: "inbox",
    description: "fallback — anything that doesn't fit elsewhere",
    type: "page", id: ""
  },
];

function getJars() { return store.get("jars", DEFAULT_JARS); }
function setJars(j) { store.set("jars", j); }

/* ─────────  STATE  ───────── */
let mediaRecorder = null;
let recordedChunks = [];
let recordStart = 0;
let timerInterval = null;
let routedItems = []; // [{ jar, content }]

/* ─────────  STEP NAVIGATION  ───────── */
function showStep(id) {
  ["step-capture","step-transcript","step-preview","step-done"].forEach(s => {
    document.getElementById(s).classList.toggle("hidden", s !== id);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ─────────  RECORDING  ───────── */
const btn = () => document.getElementById("record-btn");
const stateEl = () => document.getElementById("record-state");
const timeEl  = () => document.getElementById("record-time");

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Your browser doesn't support audio recording. Use the text fallback below.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMimeType();
    mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      await handleAudioBlob(blob);
    };

    mediaRecorder.start();
    recordStart = Date.now();
    btn().classList.add("recording");
    stateEl().textContent = "recording…";
    timerInterval = setInterval(tickTimer, 200);
  } catch (err) {
    console.error(err);
    toast("Couldn't access your microphone. Check browser permissions.");
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    clearInterval(timerInterval);
    btn().classList.remove("recording");
    btn().classList.add("processing");
    stateEl().textContent = "transcribing…";
  }
}

function tickTimer() {
  const sec = Math.floor((Date.now() - recordStart) / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  timeEl().textContent = `${mm}:${ss}`;
}

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
  for (const t of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

/* ─────────  TRANSCRIBE  ───────── */
async function handleAudioBlob(blob) {
  try {
    const fd = new FormData();
    fd.append("audio", blob, "voice-note." + (blob.type.includes("mp4") ? "mp4" : "webm"));

    const res = await fetch(API_BASE + "/api/inbox/transcribe", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `transcribe failed (${res.status})`);
    }
    const { text } = await res.json();

    btn().classList.remove("processing");
    stateEl().textContent = "tap to start";
    timeEl().textContent = "00:00";

    document.getElementById("transcript-text").value = text || "";
    showStep("step-transcript");
  } catch (err) {
    console.error(err);
    btn().classList.remove("processing");
    stateEl().textContent = "tap to start";
    toast("Transcription failed: " + err.message);
  }
}

/* ─────────  ROUTE  ───────── */
async function routeTranscript() {
  const transcript = document.getElementById("transcript-text").value.trim();
  if (!transcript) { toast("Nothing to sort yet."); return; }

  const jars = getJars();
  if (jars.length === 0) { toast("Add some jars first."); openSettings(); return; }

  const sortBtn = document.getElementById("sort-btn");
  sortBtn.disabled = true;
  sortBtn.textContent = "sorting…";

  try {
    const res = await fetch(API_BASE + "/api/inbox/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        jars: jars.map(j => ({ name: j.name, description: j.description })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `route failed (${res.status})`);
    }
    const { items } = await res.json();
    routedItems = items || [];
    if (routedItems.length === 0) {
      toast("Nothing came back from the router. Try editing the transcript.");
      return;
    }
    renderPreview();
    showStep("step-preview");
  } catch (err) {
    console.error(err);
    toast("Routing failed: " + err.message);
  } finally {
    sortBtn.disabled = false;
    sortBtn.innerHTML = 'sort into jars <span class="arrow">→</span>';
  }
}

/* ─────────  PREVIEW  ───────── */
function renderPreview() {
  const wrap = document.getElementById("preview-list");
  wrap.innerHTML = "";
  const jars = getJars();
  const jarByName = Object.fromEntries(jars.map(j => [j.name.toLowerCase(), j]));

  routedItems.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "preview-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.dataset.idx = idx;
    row.appendChild(cb);

    const matched = jarByName[(item.jar || "").toLowerCase()];
    const tag = document.createElement("span");
    tag.className = "preview-jar" + ((matched && matched.id) ? "" : " unmapped");
    tag.textContent = item.jar || "inbox";
    tag.title = matched
      ? (matched.id ? "destination ready" : "no Notion ID set — open jars to configure")
      : "no matching jar — pick one below";
    row.appendChild(tag);

    const content = document.createElement("div");
    content.className = "preview-content";
    content.contentEditable = "true";
    content.spellcheck = false;
    content.textContent = item.content;
    content.addEventListener("blur", () => {
      routedItems[idx].content = content.textContent.trim();
    });
    row.appendChild(content);

    // re-route dropdown (lets the user pick a different jar)
    const sel = document.createElement("select");
    sel.className = "preview-jar-select";
    jars.forEach(j => {
      const opt = document.createElement("option");
      opt.value = j.name;
      opt.textContent = j.name + (j.id ? "" : " (not set)");
      if (j.name.toLowerCase() === (item.jar || "").toLowerCase()) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      routedItems[idx].jar = sel.value;
      renderPreview();
    });
    row.appendChild(sel);

    wrap.appendChild(row);
  });
}

/* ─────────  DISPATCH  ───────── */
async function dispatchToNotion() {
  const jars = getJars();
  const jarByName = Object.fromEntries(jars.map(j => [j.name.toLowerCase(), j]));

  const checkboxes = document.querySelectorAll("#preview-list input[type='checkbox']");
  const payload = [];
  checkboxes.forEach(cb => {
    if (!cb.checked) return;
    const item = routedItems[Number(cb.dataset.idx)];
    if (!item) return;
    const jar = jarByName[(item.jar || "").toLowerCase()];
    payload.push({
      jar: item.jar,
      content: item.content,
      target: jar && jar.id ? { type: jar.type || "page", id: jar.id } : null,
    });
  });

  if (payload.length === 0) { toast("Nothing checked to send."); return; }
  const missing = payload.filter(p => !p.target);
  if (missing.length === payload.length) {
    toast("None of these jars have a Notion ID. Open jars to configure.");
    return;
  }

  const sendBtn = document.getElementById("dispatch-btn");
  sendBtn.disabled = true;
  sendBtn.textContent = "sending…";

  try {
    const res = await fetch(API_BASE + "/api/inbox/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `dispatch failed (${res.status})`);
    }
    const { results } = await res.json();
    renderResults(results);
    showStep("step-done");
  } catch (err) {
    console.error(err);
    toast("Dispatch failed: " + err.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'send to Notion <span class="arrow">↗</span>';
  }
}

function renderResults(results) {
  const ul = document.getElementById("dispatch-results");
  ul.innerHTML = "";
  results.forEach(r => {
    const li = document.createElement("li");
    li.className = r.ok ? "ok" : "fail";
    li.textContent = r.ok
      ? `${r.jar} — added`
      : `${r.jar} — ${r.error || "failed"}`;
    ul.appendChild(li);
  });
}

/* ─────────  SETTINGS / JAR EDITOR  ───────── */
function openSettings() {
  renderJarsEditor();
  document.getElementById("settings-modal").hidden = false;
}
function closeSettings() {
  document.getElementById("settings-modal").hidden = true;
}

function renderJarsEditor() {
  const wrap = document.getElementById("jars-list");
  wrap.innerHTML = "";
  const jars = getJars();

  jars.forEach((j, idx) => {
    const row = document.createElement("div");
    row.className = "jar-row";
    row.innerHTML = `
      <div class="jar-grid">
        <div>
          <p class="field-label">name</p>
          <input data-field="name" data-idx="${idx}" value="${escAttr(j.name)}" placeholder="content ideas" />
        </div>
        <div>
          <p class="field-label">notion id</p>
          <input data-field="id" data-idx="${idx}" value="${escAttr(j.id || "")}" placeholder="32-char hex from the URL" />
        </div>
        <div>
          <p class="field-label">type</p>
          <select data-field="type" data-idx="${idx}">
            <option value="page"     ${j.type === "page" ? "selected" : ""}>page</option>
            <option value="database" ${j.type === "database" ? "selected" : ""}>database</option>
          </select>
        </div>
        <button class="remove-jar" data-remove="${idx}" title="remove jar">✕</button>
        <input class="jar-desc" data-field="description" data-idx="${idx}"
               value="${escAttr(j.description || "")}"
               placeholder="describe what belongs in this jar — the AI uses this to route" />
      </div>
    `;
    wrap.appendChild(row);
  });

  wrap.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", (e) => {
      const idx   = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      const jars2 = getJars();
      jars2[idx][field] = e.target.value.trim();
      setJars(jars2);
    });
  });

  wrap.querySelectorAll("[data-remove]").forEach(b => {
    b.addEventListener("click", () => {
      const i = Number(b.dataset.remove);
      const jars2 = getJars();
      jars2.splice(i, 1);
      setJars(jars2);
      renderJarsEditor();
    });
  });
}

function addJar() {
  const jars = getJars();
  jars.push({ name: "new jar", description: "", type: "page", id: "" });
  setJars(jars);
  renderJarsEditor();
}

function resetJars() {
  if (!confirm("Reset jars to the starter set? Your current jars will be replaced.")) return;
  setJars(DEFAULT_JARS);
  renderJarsEditor();
}

function saveJars() {
  // already persisted on input — just close & confirm
  toast("jars saved ♡");
  closeSettings();
}

/* ─────────  UTIL  ───────── */
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 3200);
}
function escAttr(s) {
  return String(s).replace(/[&"<>]/g, c => ({ "&":"&amp;","\"":"&quot;","<":"&lt;",">":"&gt;" })[c]);
}

/* ─────────  WIRE UP  ───────── */
document.addEventListener("DOMContentLoaded", () => {
  // record button toggles between record / stop
  btn().addEventListener("click", () => {
    if (btn().classList.contains("processing")) return;
    if (btn().classList.contains("recording")) stopRecording();
    else startRecording();
  });

  // text fallback
  document.getElementById("text-submit").addEventListener("click", () => {
    const v = document.getElementById("text-input").value.trim();
    if (!v) { toast("Nothing typed yet."); return; }
    document.getElementById("transcript-text").value = v;
    showStep("step-transcript");
  });

  // step navigation
  document.getElementById("back-to-capture").addEventListener("click", () => showStep("step-capture"));
  document.getElementById("back-to-transcript").addEventListener("click", () => showStep("step-transcript"));
  document.getElementById("sort-btn").addEventListener("click", routeTranscript);
  document.getElementById("dispatch-btn").addEventListener("click", dispatchToNotion);
  document.getElementById("reset-btn").addEventListener("click", () => {
    document.getElementById("text-input").value = "";
    document.getElementById("transcript-text").value = "";
    routedItems = [];
    showStep("step-capture");
  });

  // settings
  document.getElementById("settings-fab").addEventListener("click", openSettings);
  document.getElementById("close-settings").addEventListener("click", closeSettings);
  document.getElementById("save-jars").addEventListener("click", saveJars);
  document.getElementById("reset-jars").addEventListener("click", resetJars);
  document.getElementById("add-jar").addEventListener("click", addJar);

  document.getElementById("settings-modal").addEventListener("click", (e) => {
    if (e.target.id === "settings-modal") closeSettings();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("settings-modal").hidden) closeSettings();
  });

  // health-check & first-run nudge
  fetch(API_BASE + "/api/inbox/health").then(r => r.json()).then(h => {
    if (!h.notion) toast("Heads up: server doesn't have NOTION_TOKEN set yet — see jars → how to set up.");
  }).catch(() => {/* offline; no problem */});

  if (getJars() === DEFAULT_JARS && !localStorage.getItem(NS + "jars")) {
    setJars(DEFAULT_JARS);
  }
});
