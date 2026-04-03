// ═══════════════════════════════════════════════════════
//  Mango Music — Frontend App
//  Comunicación completa con el backend Flask via REST API
// ═══════════════════════════════════════════════════════

// ─── API CLIENT ─────────────────────────────────────────────
const API = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async patch(url, body) {
    const r = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async delete(url) {
    const r = await fetch(url, { method: "DELETE" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async upload(files) {
    const fd = new FormData();
    [...files].forEach(f => fd.append("files", f));
    const r = await fetch("/api/songs/upload", { method: "POST", body: fd });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};

// ─── STATE ──────────────────────────────────────────────────
let songs = [];
let playlists = [];
let curId = null;
let curView = "all";
let curPl = null;
let playing = false;
let shuffle = false;
let repeat = 0;       // 0=off 1=all 2=one
let ctxId = null;
let lyricsChanged = false;
let searchQuery = "";

const aud = document.getElementById("aud");

// ─── INIT ────────────────────────────────────────────────────
async function init() {
  showToast("🥭 Cargando Mango Music…", "info", 1500);
  await Promise.all([loadSongs(), loadPlaylists()]);
  render();
}

async function loadSongs() {
  songs = await API.get("/api/songs");
}

async function loadPlaylists() {
  playlists = await API.get("/api/playlists");
  renderPls();
}

// ─── FILE UPLOAD ─────────────────────────────────────────────
async function handleFiles(files) {
  if (!files.length) return;
  showToast(`⬆ Subiendo ${files.length} archivo(s)…`, "info", 3000);
  try {
    const res = await API.upload(files);
    songs = [...res.uploaded, ...songs]; // prepend new ones
    await loadSongs();                   // re-fetch for consistency
    render();
    showToast(`✅ ${res.uploaded.length} canción(es) subida(s)`, "ok");
    if (res.errors.length) {
      res.errors.forEach(e => showToast(`⚠ ${e}`, "warn", 4000));
    }
    if (curPl) {
      for (const s of res.uploaded) {
        await API.post(`/api/playlists/${curPl}/songs`, { song_id: s.id });
      }
      await loadPlaylists();
    }
  } catch (e) {
    showToast("❌ Error al subir: " + e.message, "error");
  }
}

// ─── VIEWS ───────────────────────────────────────────────────
function showView(v, plId = null) {
  curView = v;
  curPl = plId;
  searchQuery = "";
  document.getElementById("search-input").value = "";

  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".pl-item").forEach(b => b.classList.remove("active"));

  const titles = {
    all: "Todas las canciones",
    liked: "❤️ Favoritas",
    recent: "Agregadas recientemente",
  };

  if (titles[v]) {
    document.getElementById("view-title").textContent = titles[v];
    document.getElementById("nav-" + v)?.classList.add("active");
  } else if (v === "playlist") {
    const p = playlists.find(p => p.id == plId);
    document.getElementById("view-title").textContent = "🎶 " + (p?.name || "Playlist");
    document.querySelectorAll(".pl-item").forEach(b => {
      if (b.dataset.id == plId) b.classList.add("active");
    });
  }
  render();
}

function visibleSongs() {
  let list;
  if (curView === "all") list = [...songs];
  else if (curView === "liked") list = songs.filter(s => s.liked);
  else if (curView === "recent") list = [...songs].slice(0, 40);
  else if (curView === "playlist") {
    const p = playlists.find(p => p.id == curPl);
    list = p ? p.song_ids.map(id => songs.find(s => s.id == id)).filter(Boolean) : [];
  } else list = [...songs];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(s =>
      [s.title, s.artist, s.album].some(x => x?.toLowerCase().includes(q))
    );
  }
  return list;
}

function onSearch(v) {
  searchQuery = v;
  render();
}

// ─── RENDER ──────────────────────────────────────────────────
function render() {
  const list = visibleSongs();
  const el = document.getElementById("song-list");

  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${searchQuery ? "🔍" : "🥭"}</div>
        <h3>${searchQuery ? "Sin resultados" : "Sin canciones"}</h3>
        <p>${searchQuery
          ? "Prueba con otro término"
          : curView === "liked"
          ? "Aún no tienes favoritas"
          : "Sube tus MP3 usando el botón de arriba"
        }</p>
      </div>`;
    return;
  }

  el.innerHTML = list.map((s, i) => `
    <div class="song-row ${s.id === curId ? "playing" : ""}"
         ondblclick="playSong(${s.id})"
         oncontextmenu="openCtx(event,${s.id})">
      <div class="song-num">
        <span class="song-num-text">${i + 1}</span>
        <div class="playing-bars">
          <div class="bar"></div><div class="bar"></div><div class="bar"></div>
        </div>
      </div>
      <div class="song-info">
        <div class="song-title">${esc(s.title)}</div>
        <div class="song-artist">${esc(s.artist)}</div>
      </div>
      <div class="song-album">${esc(s.album)}</div>
      <div class="song-dur">${fmt(s.duration)}</div>
      <div class="song-actions">
        <button class="act-btn ${s.liked ? "liked" : ""}"
                onclick="toggleLike(${s.id}, event)"
                title="${s.liked ? "Quitar favorita" : "Favorita"}">
          ${s.liked ? "❤️" : "♡"}
        </button>
        <button class="act-btn" onclick="openCtx(event,${s.id})" title="Más">⋮</button>
      </div>
    </div>`).join("");
}

function renderPls() {
  document.getElementById("pl-list").innerHTML = playlists.map(p => `
    <button class="pl-item ${curPl == p.id && curView === "playlist" ? "active" : ""}"
            data-id="${p.id}"
            onclick="showView('playlist', ${p.id})"
            oncontextmenu="confirmDeletePl(event, ${p.id})">
      <div class="pl-thumb">♫</div>
      <span class="pl-name">${esc(p.name)}</span>
      <span class="pl-count">${p.song_ids.length}</span>
    </button>`).join("");
}

// ─── PLAYER ──────────────────────────────────────────────────
function playSong(id) {
  const s = songs.find(s => s.id == id);
  if (!s) return;
  curId = s.id;
  aud.src = s.url;
  aud.play();
  playing = true;
  updatePB(s);
  updateNP(s);
  render();
}

function updatePB(s) {
  document.getElementById("pb-title").textContent = s.title;
  document.getElementById("pb-artist").textContent = s.artist;
  document.getElementById("play-btn").textContent = "⏸";
  updatePBLike(s);
}

function updateNP(s) {
  document.getElementById("np-title").innerHTML = esc(s.title);
  document.getElementById("np-artist").textContent = s.artist;
  document.getElementById("lyrics-ta").value = s.lyrics || "";
  lyricsChanged = false;
}

function togglePlay() {
  if (!curId) return;
  if (playing) { aud.pause(); playing = false; document.getElementById("play-btn").textContent = "▶"; }
  else { aud.play(); playing = true; document.getElementById("play-btn").textContent = "⏸"; }
}

function getQueue() { return visibleSongs(); }

function nextSong() {
  const q = getQueue();
  if (!q.length) return;
  if (shuffle) { playSong(q[Math.floor(Math.random() * q.length)].id); return; }
  const i = q.findIndex(s => s.id == curId);
  playSong(q[(i + 1) % q.length].id);
}

function prevSong() {
  if (aud.currentTime > 3) { aud.currentTime = 0; return; }
  const q = getQueue();
  if (!q.length) return;
  const i = q.findIndex(s => s.id == curId);
  playSong(q[(i - 1 + q.length) % q.length].id);
}

function toggleShuffle() {
  shuffle = !shuffle;
  document.getElementById("btn-shuffle").classList.toggle("active", shuffle);
}

function cycleRepeat() {
  repeat = (repeat + 1) % 3;
  const btn = document.getElementById("btn-repeat");
  btn.classList.toggle("active", repeat > 0);
  btn.textContent = repeat === 2 ? "🔂" : "↩";
  btn.title = ["Repetir", "Repetir todo", "Repetir una"][repeat];
}

aud.addEventListener("ended", () => {
  if (repeat === 2) { aud.currentTime = 0; aud.play(); }
  else nextSong();
});

aud.addEventListener("timeupdate", () => {
  if (!aud.duration) return;
  const p = (aud.currentTime / aud.duration) * 100;
  document.getElementById("prog-fill").style.width = p + "%";
  document.getElementById("prog-thumb").style.left = p + "%";
  document.getElementById("t-cur").textContent = fmt(aud.currentTime);
  document.getElementById("t-tot").textContent = fmt(aud.duration);
});

function seekTo(e) {
  const r = document.getElementById("prog-track").getBoundingClientRect();
  aud.currentTime = ((e.clientX - r.left) / r.width) * aud.duration;
}

function setVol(v) { aud.volume = v / 100; }

function toggleMute() {
  aud.muted = !aud.muted;
  document.getElementById("vol-btn").textContent = aud.muted ? "🔇" : "🔊";
}

// ─── LIKES ───────────────────────────────────────────────────
async function toggleLike(id, e) {
  if (e) e.stopPropagation();
  const s = songs.find(s => s.id == id);
  if (!s) return;
  s.liked = !s.liked;
  render();
  if (s.id === curId) updatePBLike(s);
  try {
    await API.patch(`/api/songs/${id}`, { liked: s.liked });
  } catch { s.liked = !s.liked; render(); }
}

function likeCurrentSong() { if (curId) toggleLike(curId, null); }

function updatePBLike(s) {
  const b = document.getElementById("pb-like");
  b.textContent = s.liked ? "❤️" : "♡";
  b.classList.toggle("liked", s.liked);
}

// ─── LYRICS ──────────────────────────────────────────────────
async function saveLyrics() {
  if (!curId) return;
  const lyrics = document.getElementById("lyrics-ta").value;
  const s = songs.find(s => s.id == curId);
  if (s) s.lyrics = lyrics;
  try {
    await API.patch(`/api/songs/${curId}`, { lyrics });
    lyricsChanged = false;
    const btn = document.getElementById("save-btn");
    btn.classList.add("ok");
    btn.textContent = "✅ Guardado";
    setTimeout(() => { btn.classList.remove("ok"); btn.textContent = "💾 Guardar letra"; }, 2000);
  } catch {
    showToast("❌ Error al guardar la letra", "error");
  }
}

// ─── PLAYLISTS ───────────────────────────────────────────────
function openNewPl() {
  document.getElementById("pl-name-in").value = "";
  openMod("modal-pl");
  setTimeout(() => document.getElementById("pl-name-in").focus(), 100);
}

async function createPl() {
  const name = document.getElementById("pl-name-in").value.trim();
  if (!name) return;
  try {
    await API.post("/api/playlists", { name });
    await loadPlaylists();
    closeMod("modal-pl");
    showToast("✅ Playlist creada", "ok");
  } catch (e) {
    showToast("❌ " + e.message, "error");
  }
}

async function confirmDeletePl(e, id) {
  e.preventDefault();
  e.stopPropagation();
  if (!confirm("¿Eliminar esta playlist?")) return;
  try {
    await API.delete(`/api/playlists/${id}`);
    await loadPlaylists();
    if (curPl == id) showView("all");
    showToast("🗑 Playlist eliminada", "warn");
  } catch (e) {
    showToast("❌ " + e.message, "error");
  }
}

function openAddTo(songId) {
  const el = document.getElementById("addto-list");
  el.innerHTML = playlists.length
    ? playlists.map(p => `
        <button class="addto-item" onclick="addToPl(${songId},${p.id})">
          <div class="pl-thumb" style="width:24px;height:24px;font-size:11px;border-radius:6px;">♫</div>
          ${esc(p.name)}
        </button>`).join("")
    : `<p style="color:var(--text-dim);font-size:13px;padding:8px 0">Aún no tienes playlists. ¡Crea una!</p>`;
  openMod("modal-addto");
}

async function addToPl(songId, plId) {
  try {
    await API.post(`/api/playlists/${plId}/songs`, { song_id: songId });
    await loadPlaylists();
    closeMod("modal-addto");
    showToast("✅ Canción agregada a la playlist", "ok");
  } catch (e) {
    showToast("❌ " + e.message, "error");
  }
}

// ─── CONTEXT MENU ────────────────────────────────────────────
function openCtx(e, id) {
  e.preventDefault();
  e.stopPropagation();
  ctxId = id;
  const s = songs.find(s => s.id == id);
  document.getElementById("ctx-like").textContent = s?.liked ? "❤️ Quitar favorita" : "♡ Favorita";
  document.getElementById("ctx-play").textContent = id === curId && playing ? "⏸ Pausar" : "▶ Reproducir";
  const m = document.getElementById("ctx-menu");
  m.classList.add("show");
  m.style.left = Math.min(e.clientX, innerWidth - 180) + "px";
  m.style.top = Math.min(e.clientY, innerHeight - 210) + "px";
}

async function ctxDo(a) {
  closeCtx();
  if (!ctxId) return;
  if (a === "play") {
    if (ctxId === curId) togglePlay();
    else playSong(ctxId);
  } else if (a === "like") {
    toggleLike(ctxId, null);
  } else if (a === "addto") {
    openAddTo(ctxId);
  } else if (a === "lyrics") {
    const s = songs.find(s => s.id == ctxId);
    if (s) document.getElementById("lyrics-ta").value = s.lyrics || "";
  } else if (a === "del") {
    if (!confirm("¿Eliminar esta canción del servidor?")) return;
    try {
      await API.delete(`/api/songs/${ctxId}`);
      if (curId === ctxId) { aud.pause(); curId = null; playing = false; document.getElementById("play-btn").textContent = "▶"; }
      songs = songs.filter(s => s.id != ctxId);
      await loadPlaylists();
      render();
      showToast("🗑 Canción eliminada", "warn");
    } catch (e) {
      showToast("❌ " + e.message, "error");
    }
  }
}

function closeCtx() { document.getElementById("ctx-menu").classList.remove("show"); }

// ─── MODALS ──────────────────────────────────────────────────
function openMod(id) { document.getElementById(id).classList.add("open"); }
function closeMod(id) { document.getElementById(id).classList.remove("open"); }

document.querySelectorAll(".backdrop").forEach(el =>
  el.addEventListener("click", e => { if (e.target === el) el.classList.remove("open"); })
);

// ─── KEYBOARD ────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.code === "ArrowRight") nextSong();
  if (e.code === "ArrowLeft") prevSong();
  if (e.key === "Escape") { closeCtx(); closeMod("modal-pl"); closeMod("modal-addto"); }
});

document.addEventListener("click", closeCtx);

// ─── TOAST ───────────────────────────────────────────────────
function showToast(msg, type = "ok", duration = 3000) {
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.getElementById("toast-container").appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, duration);
}

// ─── HELPERS ─────────────────────────────────────────────────
function fmt(s) {
  if (!s || isNaN(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── BOOT ────────────────────────────────────────────────────
init();
