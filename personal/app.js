/* ─────────────────────────────────────────────────────────────
   My HQ — app.js
   Notion-aesthetic personal dashboard
   All state lives in localStorage under the `myhq.*` namespace.
   ───────────────────────────────────────────────────────────── */

const NS = "myhq.";
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(NS + key, JSON.stringify(value)); },
  remove(key)     { localStorage.removeItem(NS + key); }
};

/* ─────────  DEFAULT DATA  ───────── */
const DEFAULT_LISTS = {
  "am-routine": [
    { text: "drink water + lemon", done: false },
    { text: "skincare: cleanse + SPF", done: false },
    { text: "10 min stretch / movement", done: false },
    { text: "journal · 3 lines", done: false },
    { text: "review today's top 3", done: false },
  ],
  "pm-routine": [
    { text: "double cleanse", done: false },
    { text: "evening serum + moisturizer", done: false },
    { text: "10 min wind-down (no screens)", done: false },
    { text: "tomorrow's outfit + bag", done: false },
    { text: "gratitude · 1 thing", done: false },
  ],
  "packing": [
    { text: "boots", done: false },
    { text: "layers · cardigan + jacket", done: false },
    { text: "skincare travel kit", done: false },
    { text: "SPF", done: false },
    { text: "journal + pen", done: false },
    { text: "phone charger", done: false },
    { text: "snacks + water", done: false },
    { text: "camera", done: false },
  ],
  "today-tasks": [],
};

const DEFAULT_HABITS = [
  { name: "reading",   days: [false,false,false,false,false,false,false] },
  { name: "meditate",  days: [false,false,false,false,false,false,false] },
  { name: "journal",   days: [false,false,false,false,false,false,false] },
  { name: "stretch",   days: [false,false,false,false,false,false,false] },
];

const QUICK_LINK_DEFS = [
  { key: "admin",    label: "Month Tracker Admin",   icon: "✦", placeholder: "https://notion.so/your-admin-board" },
  { key: "client",   label: "Client Portal",         icon: "✿", placeholder: "https://your-client-portal" },
  { key: "website",  label: "Website",               icon: "◐", placeholder: "https://yourwebsite.com" },
  { key: "gmail",    label: "Gmail",                 icon: "✉", placeholder: "https://mail.google.com", default: "https://mail.google.com" },
  { key: "gcal",     label: "Google Calendar",       icon: "▢", placeholder: "https://calendar.google.com", default: "https://calendar.google.com" },
  { key: "content",  label: "Content Calendar",      icon: "♡", placeholder: "https://notion.so/your-content-calendar" },
];

const EMBED_DEFS = [
  { key: "calendar-embed",         label: "Google Calendar embed URL",
    hint: "Calendar → Settings → your calendar → \"Integrate calendar\" → copy the public embed URL.",
    placeholder: "https://calendar.google.com/calendar/embed?src=..." },
  { key: "content-calendar-embed", label: "Notion content calendar public URL",
    hint: "Notion → Share → Publish → copy the public URL.",
    placeholder: "https://www.notion.so/..." },
];

/* ─────────  HEADER: date / time / month progress  ───────── */
function renderHeader() {
  const now = new Date();
  const dateFmt = now.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric"
  });
  const timeFmt = now.toLocaleTimeString(undefined, {
    hour: "numeric", minute: "2-digit"
  });
  document.getElementById("today-date").textContent = dateFmt;
  document.getElementById("today-time").textContent = timeFmt;

  const monthName = now.toLocaleDateString(undefined, { month: "long" });
  document.getElementById("month-name").textContent = monthName.toLowerCase();

  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = now.getDate();
  const pct = Math.round((day / daysInMonth) * 100);
  document.getElementById("month-progress-fill").style.width = pct + "%";
  document.getElementById("month-days-left").textContent = daysInMonth - day;
  document.getElementById("month-percent").textContent = pct;
}

/* ─────────  CONTENT-EDITABLE PERSISTENCE  ───────── */
function wireContentEditables() {
  document.querySelectorAll("[data-store]").forEach(el => {
    const key = el.dataset.store;
    const saved = store.get("text." + key, null);

    if (el.tagName === "TEXTAREA") {
      if (saved != null) el.value = saved;
      let timer;
      el.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          store.set("text." + key, el.value);
          flashSaved();
        }, 250);
      });
    } else {
      if (saved != null) el.textContent = saved;
      el.addEventListener("blur", () => store.set("text." + key, el.textContent.trim()));
    }
  });
}

function flashSaved() {
  const tag = document.getElementById("brand-saved");
  if (!tag) return;
  tag.classList.add("show");
  clearTimeout(tag._t);
  tag._t = setTimeout(() => tag.classList.remove("show"), 1200);
}

/* ─────────  CHECKLISTS  ───────── */
function getList(name) {
  return store.get("list." + name, DEFAULT_LISTS[name] || []);
}
function setList(name, items) {
  store.set("list." + name, items);
}

function renderList(name) {
  const ul = document.querySelector(`[data-list="${name}"]`);
  if (!ul) return;
  const items = getList(name);
  ul.innerHTML = "";

  items.forEach((item, idx) => {
    const li = document.createElement("li");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!item.done;
    cb.addEventListener("change", () => {
      const list = getList(name);
      list[idx].done = cb.checked;
      setList(name, list);
      updateListProgress(name);
    });

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = item.text;
    label.contentEditable = "true";
    label.spellcheck = false;
    label.addEventListener("blur", () => {
      const list = getList(name);
      const t = label.textContent.trim();
      if (!t) { list.splice(idx, 1); }
      else    { list[idx].text = t; }
      setList(name, list);
      renderList(name);
    });
    label.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); label.blur(); }
    });

    const rm = document.createElement("button");
    rm.className = "remove";
    rm.type = "button";
    rm.innerHTML = "✕";
    rm.title = "remove";
    rm.addEventListener("click", () => {
      const list = getList(name);
      list.splice(idx, 1);
      setList(name, list);
      renderList(name);
    });

    li.appendChild(cb);
    li.appendChild(label);
    li.appendChild(rm);
    ul.appendChild(li);
  });

  updateListProgress(name);
}

function updateListProgress(name) {
  const items = getList(name);
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const map = { "am-routine": "am-progress", "pm-routine": "pm-progress", "today-tasks": "tasks-progress" };
  const el = document.getElementById(map[name]);
  if (el) el.textContent = pct + "%";
}

function wireListAddRows() {
  document.querySelectorAll("[data-add-to]").forEach(form => {
    const name = form.dataset.addTo;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      if (name === "habits") {
        const habits = getHabits();
        habits.push({ name: text, days: [false,false,false,false,false,false,false] });
        setHabits(habits);
        renderHabits();
      } else {
        const list = getList(name);
        list.push({ text, done: false });
        setList(name, list);
        renderList(name);
      }
      input.value = "";
    });
  });
}

/* ─────────  HABITS  ───────── */
function getHabits() { return store.get("habits", DEFAULT_HABITS); }
function setHabits(h) { store.set("habits", h); }

function renderHabits() {
  const wrap = document.getElementById("habit-table");
  wrap.innerHTML = "";

  // header row
  const header = document.createElement("div");
  header.className = "habit-row header";
  header.innerHTML = `
    <span></span>
    <span class="day-h">M</span><span class="day-h">T</span><span class="day-h">W</span>
    <span class="day-h">T</span><span class="day-h">F</span><span class="day-h">S</span><span class="day-h">S</span>
    <span class="habit-percent">%</span>
    <span></span>
  `;
  wrap.appendChild(header);

  const habits = getHabits();
  habits.forEach((habit, hIdx) => {
    const row = document.createElement("div");
    row.className = "habit-row";

    const nameEl = document.createElement("span");
    nameEl.className = "habit-name";
    nameEl.textContent = habit.name;
    nameEl.contentEditable = "true";
    nameEl.spellcheck = false;
    nameEl.addEventListener("blur", () => {
      const list = getHabits();
      const t = nameEl.textContent.trim();
      if (!t) list.splice(hIdx, 1);
      else    list[hIdx].name = t;
      setHabits(list);
      renderHabits();
    });
    nameEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); }
    });
    row.appendChild(nameEl);

    habit.days.forEach((checked, dIdx) => {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "habit-day";
      cb.checked = checked;
      cb.addEventListener("change", () => {
        const list = getHabits();
        list[hIdx].days[dIdx] = cb.checked;
        setHabits(list);
        updateHabitPercent(row, list[hIdx]);
      });
      row.appendChild(cb);
    });

    const pct = document.createElement("span");
    pct.className = "habit-percent";
    row.appendChild(pct);
    updateHabitPercent(row, habit);

    const rm = document.createElement("button");
    rm.className = "remove";
    rm.type = "button";
    rm.innerHTML = "✕";
    rm.title = "remove";
    rm.addEventListener("click", () => {
      const list = getHabits();
      list.splice(hIdx, 1);
      setHabits(list);
      renderHabits();
    });
    row.appendChild(rm);

    wrap.appendChild(row);
  });
}

function updateHabitPercent(row, habit) {
  const done = habit.days.filter(Boolean).length;
  const pct = Math.round((done / 7) * 100);
  row.querySelector(".habit-percent").textContent = pct + "%";
}

/* ─────────  QUICK LINKS  ───────── */
function getLinks() { return store.get("links", {}); }
function setLinks(l) { store.set("links", l); }

function renderQuickLinks() {
  const nav = document.getElementById("quick-links");
  const links = getLinks();
  nav.innerHTML = "";

  QUICK_LINK_DEFS.forEach(def => {
    const url = links[def.key] || def.default || "";
    const a = document.createElement("a");
    a.className = "quick-link" + (url ? "" : " disabled");
    a.innerHTML = `<span class="ql-icon">${def.icon}</span><span>${def.label}</span>`;
    if (url) {
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.title = "Add a URL in settings";
      a.addEventListener("click", (e) => { e.preventDefault(); openSettings(); });
    }
    nav.appendChild(a);
  });

  // also wire the "open in notion" content calendar button
  const contentOpen = document.getElementById("content-calendar-open");
  if (contentOpen) {
    const u = links.content;
    if (u) { contentOpen.href = u; contentOpen.style.display = ""; }
    else   { contentOpen.style.display = "none"; }
  }
}

/* ─────────  EMBEDS  ───────── */
function getEmbed(key) { return store.get("embed." + key, ""); }
function setEmbed(key, url) { store.set("embed." + key, url); }

function renderEmbeds() {
  EMBED_DEFS.forEach(def => {
    applyEmbed(def.key);
  });
}

function applyEmbed(key) {
  const url = getEmbed(key);
  const iframe = document.getElementById(key);
  if (!iframe) return;
  const empty = document.getElementById(key.replace("-embed", "-empty"));
  if (url) {
    iframe.src = url;
    iframe.style.display = "block";
    if (empty) empty.style.display = "none";
  } else {
    iframe.removeAttribute("src");
    iframe.style.display = "none";
    if (empty) empty.style.display = "flex";
  }
}

// "edit embed" buttons jump straight to settings
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-edit-embed]");
  if (btn) openSettings(btn.dataset.editEmbed);
});

/* ─────────  SETTINGS MODAL  ───────── */
const modal = () => document.getElementById("settings-modal");

function openSettings(focusKey) {
  buildSettingsForm();
  modal().hidden = false;
  if (focusKey) {
    const input = document.querySelector(`[data-settings-key="${focusKey}"]`);
    if (input) input.focus();
  }
}
function closeSettings() { modal().hidden = true; }

function buildSettingsForm() {
  const grid = document.getElementById("settings-grid");
  grid.innerHTML = "";

  // quick links
  const linksTitle = document.createElement("p");
  linksTitle.className = "card-sub";
  linksTitle.innerHTML = `<strong style="color:var(--ink)">Quick links</strong> — these power the pill buttons at the top.`;
  grid.appendChild(linksTitle);

  const currentLinks = getLinks();
  QUICK_LINK_DEFS.forEach(def => {
    const row = document.createElement("div");
    row.className = "settings-row";
    row.innerHTML = `
      <label>${def.label}</label>
      <input type="url" data-settings-key="link.${def.key}"
             value="${escapeAttr(currentLinks[def.key] || "")}"
             placeholder="${def.placeholder}">
    `;
    grid.appendChild(row);
  });

  // embeds
  const embedTitle = document.createElement("p");
  embedTitle.className = "card-sub";
  embedTitle.style.marginTop = "10px";
  embedTitle.innerHTML = `<strong style="color:var(--ink)">Embeds</strong> — paste the iframe src or public URL.`;
  grid.appendChild(embedTitle);

  EMBED_DEFS.forEach(def => {
    const row = document.createElement("div");
    row.className = "settings-row";
    row.innerHTML = `
      <label>${def.label}</label>
      <input type="url" data-settings-key="${def.key}"
             value="${escapeAttr(getEmbed(def.key))}"
             placeholder="${def.placeholder}">
      <p class="hint">${def.hint}</p>
    `;
    grid.appendChild(row);
  });
}

function saveSettings() {
  const links = getLinks();
  QUICK_LINK_DEFS.forEach(def => {
    const input = document.querySelector(`[data-settings-key="link.${def.key}"]`);
    if (!input) return;
    const v = input.value.trim();
    if (v) links[def.key] = v;
    else   delete links[def.key];
  });
  setLinks(links);

  EMBED_DEFS.forEach(def => {
    const input = document.querySelector(`[data-settings-key="${def.key}"]`);
    if (!input) return;
    setEmbed(def.key, input.value.trim());
  });

  renderQuickLinks();
  renderEmbeds();
  closeSettings();
}

function resetEverything() {
  if (!confirm("Wipe ALL personal HQ data on this device? This cannot be undone.")) return;
  Object.keys(localStorage)
    .filter(k => k.startsWith(NS))
    .forEach(k => localStorage.removeItem(k));
  location.reload();
}

function escapeAttr(s) {
  return String(s).replace(/[&"<>]/g, c => ({ "&": "&amp;", "\"": "&quot;", "<": "&lt;", ">": "&gt;" })[c]);
}

/* ─────────  WIRE UP  ───────── */
document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  setInterval(renderHeader, 60_000);

  wireContentEditables();

  ["am-routine", "pm-routine", "packing", "today-tasks"].forEach(renderList);
  renderHabits();
  wireListAddRows();
  renderQuickLinks();
  renderEmbeds();

  document.getElementById("settings-fab").addEventListener("click", () => openSettings());
  document.getElementById("close-settings").addEventListener("click", closeSettings);
  document.getElementById("save-settings").addEventListener("click", saveSettings);
  document.getElementById("reset-everything").addEventListener("click", resetEverything);

  modal().addEventListener("click", (e) => {
    if (e.target.id === "settings-modal") closeSettings();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal().hidden) closeSettings();
  });

  document.getElementById("reset-habits").addEventListener("click", () => {
    const habits = getHabits().map(h => ({ ...h, days: [false,false,false,false,false,false,false] }));
    setHabits(habits);
    renderHabits();
  });
  document.getElementById("uncheck-packing").addEventListener("click", () => {
    const list = getList("packing").map(i => ({ ...i, done: false }));
    setList("packing", list);
    renderList("packing");
  });
});
