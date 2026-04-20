# Entrega Trabajo Final — SIST-3311 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `entrega-trabajo-final/` — standalone Cloudflare Pages tool for SIST-3311 students to upload their final project document (Word/PDF) + defense video URL before 2026-04-20T22:00:00-04:00, with live countdown and teacher dashboard.

**Architecture:** Single `index.html` (HTML+CSS+JS vanilla) + `functions/api/submissions.js` (Cloudflare Pages Function with named HTTP-method exports, matching `agenda-evaluaciones` pattern) + Cloudflare KV namespace `FINAL_SUBMISSIONS`. File converted to base64 client-side via FileReader, sent in JSON body, stored in KV. Index key stores metadata without fileData for fast listing.

**Tech Stack:** HTML5/CSS3/Vanilla JS, Cloudflare Pages Functions, Cloudflare KV

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `entrega-trabajo-final/wrangler.toml` | Create | CF Pages project config + KV binding |
| `entrega-trabajo-final/functions/api/submissions.js` | Create | GET list (no fileData) + GET single (with fileData) + POST submit with deadline guard |
| `entrega-trabajo-final/index.html` | Create | Complete UI: countdown, auth, student form, file upload, teacher dashboard |

---

## Task 1: Scaffold

**Files:**
- Create: `entrega-trabajo-final/wrangler.toml`
- Create: `entrega-trabajo-final/functions/api/submissions.js` (stub)
- Create: `entrega-trabajo-final/index.html` (stub)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p "entrega-trabajo-final/functions/api"
```

- [ ] **Step 2: Create `entrega-trabajo-final/wrangler.toml`**

```toml
name = "entrega-trabajo-final"
compatibility_date = "2024-12-01"

[[kv_namespaces]]
binding = "FINAL_SUBMISSIONS"
id = "REPLACE_WITH_KV_ID"
```

> `REPLACE_WITH_KV_ID` will be filled in Task 5 after running `wrangler kv namespace create`.

- [ ] **Step 3: Create `entrega-trabajo-final/functions/api/submissions.js` stub**

```javascript
export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
export async function onRequestGet() {
  return new Response(JSON.stringify({ submissions: [] }), {
    headers: { "Content-Type": "application/json" },
  });
}
export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 4: Create `entrega-trabajo-final/index.html` stub**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Entrega Proyecto Final — SIST-3311</title>
</head>
<body>
  <h1>Entrega Proyecto Final — SIST-3311</h1>
  <p>En construcción.</p>
</body>
</html>
```

- [ ] **Step 5: Commit**

```bash
git add entrega-trabajo-final/
git commit -m "feat: scaffold entrega-trabajo-final SIST-3311"
```

---

## Task 2: Complete API function

**Files:**
- Modify: `entrega-trabajo-final/functions/api/submissions.js`

Replace the stub entirely with the complete function below.

- [ ] **Step 1: Write complete `entrega-trabajo-final/functions/api/submissions.js`**

```javascript
// ══════════════════════════════════════════════════════════════════
// API de entregas — Cloudflare Pages Function + KV
//
// GET  /api/submissions              → índice sin fileData
// GET  /api/submissions?matricula=X  → entrega completa con fileData
// POST /api/submissions              → crear/actualizar entrega (valida deadline)
// ══════════════════════════════════════════════════════════════════

const CONFIG_ID   = "sist3311-pf-ene-abr-2026";
const DEADLINE_MS = new Date("2026-04-20T22:00:00-04:00").getTime();

function cors() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors() });
}

function submissionKey(matricula) {
  return `submission_${CONFIG_ID}_${matricula}`;
}

const INDEX_KEY = `index_${CONFIG_ID}`;

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}

// GET /api/submissions              → lista sin fileData
// GET /api/submissions?matricula=X  → entrega completa con fileData
export async function onRequestGet(context) {
  const url      = new URL(context.request.url);
  const kv       = context.env.FINAL_SUBMISSIONS;
  const matricula = url.searchParams.get("matricula");

  if (matricula) {
    const data = await kv.get(submissionKey(matricula), "json");
    if (!data) return json({ error: "No encontrado" }, 404);
    return json(data);
  }

  const index = await kv.get(INDEX_KEY, "json") ?? [];
  return json({ submissions: index });
}

// POST /api/submissions
// Body: { matricula, nombre, fileName, fileSize, fileType, fileData, videoUrl }
export async function onRequestPost(context) {
  if (Date.now() > DEADLINE_MS) {
    return json({ error: "Plazo de entrega cerrado" }, 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const { matricula, nombre, fileName, fileSize, fileType, fileData, videoUrl } = body;
  if (!matricula || !nombre || !fileName || !fileData || !videoUrl) {
    return json({ error: "Campos requeridos: matricula, nombre, fileName, fileData, videoUrl" }, 400);
  }

  const kv          = context.env.FINAL_SUBMISSIONS;
  const existing    = await kv.get(submissionKey(matricula), "json");
  const version     = existing ? existing.version + 1 : 1;
  const submittedAt = new Date().toISOString();

  const submission = { matricula, nombre, fileName, fileSize, fileType, fileData, videoUrl, submittedAt, version };
  await kv.put(submissionKey(matricula), JSON.stringify(submission));

  // Update index (metadata only, no fileData)
  const index = await kv.get(INDEX_KEY, "json") ?? [];
  const entry = { matricula, nombre, fileName, fileSize, submittedAt };
  const idx   = index.findIndex(e => e.matricula === matricula);
  if (idx >= 0) index[idx] = entry;
  else index.push(entry);
  await kv.put(INDEX_KEY, JSON.stringify(index));

  return json({ ok: true, submittedAt, version });
}
```

- [ ] **Step 2: Verify locally**

```bash
cd entrega-trabajo-final
wrangler pages dev . --port 8788
```

In a second terminal:

```bash
# List (empty)
curl http://localhost:8788/api/submissions
# Expected: {"submissions":[]}

# POST missing fields
curl -s -X POST http://localhost:8788/api/submissions \
  -H "Content-Type: application/json" \
  -d '{"matricula":"2024-0007"}'
# Expected: {"error":"Campos requeridos: ..."}  status 400

# POST valid
curl -s -X POST http://localhost:8788/api/submissions \
  -H "Content-Type: application/json" \
  -d '{"matricula":"2024-0007","nombre":"CINDY PAOLA ALCANTARA GARCIA","fileName":"test.pdf","fileSize":1024,"fileType":"application/pdf","fileData":"dGVzdA==","videoUrl":"https://youtu.be/abc"}'
# Expected: {"ok":true,"submittedAt":"...","version":1}

# List (one entry, no fileData)
curl http://localhost:8788/api/submissions
# Expected: {"submissions":[{"matricula":"2024-0007",...}]}  — no fileData field

# GET single with fileData
curl "http://localhost:8788/api/submissions?matricula=2024-0007"
# Expected: full object including "fileData":"dGVzdA=="

# POST again (re-submit, version should increment)
curl -s -X POST http://localhost:8788/api/submissions \
  -H "Content-Type: application/json" \
  -d '{"matricula":"2024-0007","nombre":"CINDY PAOLA ALCANTARA GARCIA","fileName":"v2.pdf","fileSize":2048,"fileType":"application/pdf","fileData":"dGVzdDI=","videoUrl":"https://youtu.be/xyz"}'
# Expected: {"ok":true,"submittedAt":"...","version":2}
```

Stop wrangler when done.

- [ ] **Step 3: Commit**

```bash
git add entrega-trabajo-final/functions/api/submissions.js
git commit -m "feat(entrega): API submissions — GET lista/single + POST con deadline guard"
```

---

## Task 3: Complete `index.html`

**Files:**
- Modify: `entrega-trabajo-final/index.html`

Replace the stub entirely with the complete app below.

- [ ] **Step 1: Write complete `entrega-trabajo-final/index.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Entrega Proyecto Final — SIST-3311</title>
  <style>
    :root {
      --navy:  #1A2456;
      --blue:  #2D5BE3;
      --mint:  #00D4A0;
      --amber: #F59E0B;
      --coral: #FF5C6A;
      --bg:    #F0F2F8;
      --card:  #FFFFFF;
      --text:  #1A2456;
      --muted: #6B7280;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }

    header { background: var(--navy); color: white; padding: 1rem 1.5rem; }
    header .sub { font-size: 0.75rem; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.2rem; }
    header h1 { font-size: 1.2rem; font-weight: 700; }

    .main { max-width: 640px; margin: 0 auto; padding: 1.5rem 1rem; }

    /* ── Countdown ── */
    .countdown-box { background: var(--card); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.08); padding: 1.25rem; text-align: center; margin-bottom: 1rem; }
    .cd-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin-bottom: 0.4rem; }
    .cd-value { font-size: 2.75rem; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--mint); transition: color .3s; line-height: 1; }
    .cd-value.amber { color: var(--amber); }
    .cd-value.red   { color: var(--coral); }
    .cd-sub { font-size: 0.8rem; color: var(--muted); margin-top: 0.4rem; }

    .closed-banner { background: var(--coral); color: white; border-radius: 12px; padding: 1rem 1.25rem; font-weight: 700; font-size: 1rem; text-align: center; margin-bottom: 1rem; display: none; }
    .closed-banner.on { display: block; }

    /* ── Cards & Forms ── */
    .card { background: var(--card); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.08); padding: 1.5rem; margin-bottom: 1rem; }
    .card h2 { font-size: 1rem; font-weight: 700; margin-bottom: 1rem; }
    .field { margin-bottom: 1.25rem; }
    label { display: block; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 0.4rem; }
    input[type=text], input[type=url] { width: 100%; padding: .7rem .9rem; border: 2px solid #E5E7EB; border-radius: 8px; font-size: 1rem; outline: none; transition: border-color .2s; }
    input:focus { border-color: var(--blue); }

    .name-badge { background: var(--navy); color: white; border-radius: 8px; padding: .7rem 1rem; margin-bottom: 1rem; }
    .name-badge .lbl { font-size: 0.68rem; opacity: .65; text-transform: uppercase; letter-spacing: .05em; }
    .name-badge .val { font-weight: 700; font-size: 1rem; margin-top: .15rem; }

    /* ── Drop zone ── */
    .drop-zone { border: 2px dashed #CBD5E1; border-radius: 10px; padding: 2rem 1rem; text-align: center; cursor: pointer; transition: border-color .2s, background .2s; }
    .drop-zone:hover, .drop-zone.over { border-color: var(--blue); background: #EEF2FF; }
    .drop-zone.done { border-color: var(--mint); background: #F0FDF9; }
    .dz-icon { font-size: 2rem; margin-bottom: .4rem; }
    .dz-main { font-weight: 600; color: var(--blue); }
    .dz-sub  { font-size: .78rem; color: var(--muted); margin-top: .2rem; }
    .dz-ok   { font-weight: 600; color: var(--mint); }

    /* ── Observation box ── */
    .obs-box { background: #FFFBEB; border: 1px solid var(--amber); border-radius: 8px; padding: 1rem; font-size: .85rem; color: #92400E; margin-bottom: 1.25rem; }
    .obs-box strong { display: block; margin-bottom: .3rem; }

    /* ── Buttons ── */
    .btn { display: block; width: 100%; padding: .85rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity .2s, transform .1s; }
    .btn:hover:not(:disabled) { opacity: .88; transform: translateY(-1px); }
    .btn:active:not(:disabled) { transform: none; }
    .btn:disabled { opacity: .45; cursor: not-allowed; }
    .btn-primary  { background: var(--blue);  color: white; }
    .btn-ghost    { background: #E5E7EB; color: var(--navy); margin-top: .75rem; }
    .btn-mint     { background: var(--mint);  color: var(--navy); }

    .err { color: var(--coral); font-size: .82rem; margin-top: .4rem; display: none; }
    .err.on { display: block; }

    /* ── Spinner ── */
    .spin { display: inline-block; width: 1rem; height: 1rem; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: rot .6s linear infinite; vertical-align: middle; margin-right: .4rem; }
    @keyframes rot { to { transform: rotate(360deg); } }

    /* ── Success screen ── */
    .success-icon { font-size: 3.5rem; text-align: center; margin-bottom: .75rem; }
    .success-ts   { font-size: .82rem; color: var(--muted); text-align: center; margin-bottom: 1rem; }
    .success-info { font-size: .9rem; }
    .success-info p { margin-bottom: .4rem; }

    /* ── Teacher view ── */
    .stats { display: flex; gap: .75rem; margin-bottom: 1rem; }
    .stat  { flex: 1; background: var(--navy); color: white; border-radius: 8px; padding: .75rem; text-align: center; }
    .stat .v { font-size: 1.75rem; font-weight: 800; line-height: 1; }
    .stat .l { font-size: .68rem; opacity: .65; text-transform: uppercase; letter-spacing: .05em; margin-top: .2rem; }
    .tbl-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: .82rem; }
    th { text-align: left; padding: .5rem; border-bottom: 2px solid #E5E7EB; color: var(--muted); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; }
    td { padding: .7rem .5rem; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .lnk { background: none; border: none; color: var(--blue); cursor: pointer; font-size: .8rem; text-decoration: underline; padding: 0; }
    .muted { color: var(--muted); font-size: .73rem; }

    /* ── Toast ── */
    .toast { position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); background: var(--navy); color: white; padding: .7rem 1.4rem; border-radius: 8px; font-size: .88rem; z-index: 999; opacity: 0; transition: opacity .3s; pointer-events: none; white-space: nowrap; }
    .toast.on { opacity: 1; }

    /* ── Screens ── */
    .screen { display: none; }
    .screen.active { display: block; }

    @media (max-width: 480px) {
      .cd-value { font-size: 2.1rem; }
      .stats { flex-direction: column; }
    }
  </style>
</head>
<body>

<header>
  <div class="sub">SIST-3311 · Análisis de Sistemas · Enero – Abril 2026</div>
  <h1>Entrega del Proyecto Final</h1>
</header>

<div class="main">

  <!-- Countdown — always visible -->
  <div class="countdown-box" id="cdBox">
    <div class="cd-label">Tiempo restante para entregar</div>
    <div class="cd-value" id="cdVal">--:--:--</div>
    <div class="cd-sub">Cierra el 20 abr 2026 a las 10:00 PM</div>
  </div>
  <div class="closed-banner" id="closedBanner">⛔ ENTREGA CERRADA — 20 abr 2026, 10:00 PM</div>

  <!-- ── Screen: Auth ── -->
  <div class="screen active" id="scrAuth">
    <div class="card">
      <h2>Identifícate para entregar</h2>
      <div class="field">
        <label for="inMatricula">Número de matrícula</label>
        <input type="text" id="inMatricula" placeholder="Ej. 2024-0007" maxlength="20" autocomplete="off">
        <div class="err" id="authErr">Matrícula no encontrada. Verifica el número.</div>
      </div>
      <button class="btn btn-primary" id="btnAuth">Continuar →</button>
    </div>
  </div>

  <!-- ── Screen: Student form ── -->
  <div class="screen" id="scrForm">
    <div class="name-badge">
      <div class="lbl">Estudiante</div>
      <div class="val" id="stuName">—</div>
    </div>
    <div class="card">
      <div class="field">
        <label>Documento del Proyecto Final</label>
        <div class="drop-zone" id="dropZone">
          <div id="dzContent">
            <div class="dz-icon">📄</div>
            <div class="dz-main">Haz clic o arrastra el archivo aquí</div>
            <div class="dz-sub">PDF, Word (.doc, .docx) · Máx. 20 MB</div>
          </div>
        </div>
        <input type="file" id="fileInput" accept=".pdf,.doc,.docx" style="display:none">
        <div class="err" id="fileErr">Selecciona un archivo PDF o Word válido (máx 20 MB).</div>
      </div>
      <div class="field">
        <label for="inVideoUrl">Enlace al video de defensa</label>
        <input type="url" id="inVideoUrl" placeholder="https://youtu.be/... o cualquier plataforma">
        <div class="err" id="urlErr">Ingresa un enlace válido (https://...).</div>
      </div>
      <div class="obs-box">
        <strong>⚠ Sobre los anexos</strong>
        Todos los materiales —diagramas, presentaciones, capturas de pantalla, encuestas y cualquier otro anexo— deben estar incluidos dentro del documento principal. No se aceptarán archivos separados.
      </div>
      <button class="btn btn-primary" id="btnSubmit">Enviar Entrega</button>
      <div class="err" id="submitErr"></div>
    </div>
    <button class="btn btn-ghost" id="btnBack">← Volver</button>
  </div>

  <!-- ── Screen: Success ── -->
  <div class="screen" id="scrSuccess">
    <div class="card">
      <div class="success-icon">✅</div>
      <h2 style="text-align:center;margin-bottom:.4rem">Entrega registrada</h2>
      <p class="success-ts" id="sucTs"></p>
      <div class="success-info" id="sucInfo"></div>
    </div>
    <button class="btn btn-ghost" id="btnResubmit">Corregir entrega (reenviar antes del cierre)</button>
  </div>

  <!-- ── Screen: Teacher ── -->
  <div class="screen" id="scrTeacher">
    <div class="stats">
      <div class="stat">
        <div class="v" id="tStatRec">—</div>
        <div class="l">Recibidas</div>
      </div>
      <div class="stat" style="background:#374151">
        <div class="v" id="tStatPen">—</div>
        <div class="l">Pendientes</div>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2 style="margin:0">Entregas recibidas</h2>
        <button class="btn btn-mint" id="btnExport" style="width:auto;padding:.45rem .9rem;font-size:.82rem">Exportar .txt</button>
      </div>
      <div class="tbl-wrap" id="tTeacher">Cargando…</div>
    </div>
  </div>

</div><!-- .main -->

<div class="toast" id="toast"></div>

<script>
/* ══════════════════════════════════════════
   CONFIG
══════════════════════════════════════════ */
const CFG = {
  deadline:          new Date("2026-04-20T22:00:00-04:00"),
  profesorMatricula: "2008464",
  totalEstudiantes:  25,
  estudiantes: [
    { matricula: "2016-0810", nombre: "GIOVANNY BAUTISTA CASTILLO" },
    { matricula: "2022-0603", nombre: "DARLIN ARROYO POLANCO" },
    { matricula: "2022-0678", nombre: "ULISES JABRIEL REYES CUEVAS" },
    { matricula: "2023-0178", nombre: "ROMER ENMANUEL ARNO PEREZ" },
    { matricula: "2023-0221", nombre: "DANIEL VALDEZ CUELLO" },
    { matricula: "2023-0239", nombre: "LEURI GALVA DE LA ROSA" },
    { matricula: "2023-0324", nombre: "ANTHONY PICHARDO CASILLA" },
    { matricula: "2024-0007", nombre: "CINDY PAOLA ALCANTARA GARCIA" },
    { matricula: "2024-0023", nombre: "JHAEL ADAMES PEREZ" },
    { matricula: "2024-0026", nombre: "YASMEYRI MARILIN CASTILLO RIVERA" },
    { matricula: "2024-0039", nombre: "JOSE ELIEZER LOPEZ FELIZ" },
    { matricula: "2024-0060", nombre: "HAROLD SMITH BAUTISTA CAPELLAN" },
    { matricula: "2024-0103", nombre: "JUSTIN PAULINO ALBERTO" },
    { matricula: "2024-0280", nombre: "ENMANUEL GUZMAN OSORIA" },
    { matricula: "2024-0282", nombre: "JOSTIN RODRIGUEZ MARTINEZ" },
    { matricula: "2024-0283", nombre: "ISAIAS HERRERA TORIBIO" },
    { matricula: "2024-0284", nombre: "ADAM FRANCISCO GARCIA HERRERA" },
    { matricula: "2024-0286", nombre: "JOHAN ALEXANDER ROJAS TAVAREZ" },
    { matricula: "2024-0305", nombre: "ELIANNI CAROLINA SANTANA BAUTISTA" },
    { matricula: "2024-0306", nombre: "JAASIEL LORENZO TEJADA" },
    { matricula: "2024-0321", nombre: "KAROL ELIZABETH MORA QUEZADA" },
    { matricula: "2024-0325", nombre: "NAYROBIS VALDEZ GARCIA" },
    { matricula: "2024-0333", nombre: "JAEL ENCARNACION MATEO" },
    { matricula: "2024-0357", nombre: "ARLETTE PEREZ HICIANO" },
    { matricula: "2024-0379", nombre: "CAMILO ALBERT LEON PERALTA" },
  ],
};

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
const state = {
  student:      null,   // { matricula, nombre }
  selectedFile: null,   // File object
  hasExisting:  false,  // student already submitted
};

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */
function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("on");
  setTimeout(() => el.classList.remove("on"), 3000);
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" });
}

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function isDeadlinePassed() {
  return Date.now() > CFG.deadline.getTime();
}

/* ══════════════════════════════════════════
   COUNTDOWN
══════════════════════════════════════════ */
function tick() {
  const diff = CFG.deadline.getTime() - Date.now();
  const cdEl = document.getElementById("cdVal");

  if (diff <= 0) {
    cdEl.textContent = "00:00:00";
    cdEl.className = "cd-value red";
    document.getElementById("cdBox").style.display = "none";
    document.getElementById("closedBanner").classList.add("on");
    const btnS = document.getElementById("btnSubmit");
    if (btnS) { btnS.disabled = true; btnS.textContent = "Entrega cerrada"; }
    return;
  }

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  cdEl.textContent = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  cdEl.className = diff < 15 * 60_000 ? "cd-value red" : diff < 60 * 60_000 ? "cd-value amber" : "cd-value";
}

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
function handleAuth() {
  const raw    = document.getElementById("inMatricula").value.trim();
  const errEl  = document.getElementById("authErr");
  errEl.classList.remove("on");

  if (raw === CFG.profesorMatricula) {
    state.student = { matricula: raw, nombre: "Profesor", isProf: true };
    loadTeacher();
    return;
  }

  const found = CFG.estudiantes.find(e => e.matricula === raw);
  if (!found) { errEl.classList.add("on"); return; }

  state.student = found;
  loadForm();
}

/* ══════════════════════════════════════════
   STUDENT FORM
══════════════════════════════════════════ */
async function loadForm() {
  document.getElementById("stuName").textContent = state.student.nombre;
  state.selectedFile = null;
  state.hasExisting  = false;

  // Reset file zone
  resetDropZone();

  // Reset video URL
  document.getElementById("inVideoUrl").value = "";

  // Check if student already submitted (use index — no fileData)
  try {
    const res  = await fetch("/api/submissions");
    const data = await res.json();
    const mine = (data.submissions || []).find(s => s.matricula === state.student.matricula);
    if (mine) {
      state.hasExisting = true;
      document.getElementById("dzContent").innerHTML = `
        <div class="dz-icon">✅</div>
        <div class="dz-ok">${mine.fileName}</div>
        <div class="dz-sub">${fmtSize(mine.fileSize)} · entregado el ${fmtDate(mine.submittedAt)}</div>
        <div class="dz-sub" style="margin-top:.4rem">Haz clic para reemplazar el archivo</div>
      `;
      document.getElementById("dropZone").classList.add("done");
      document.getElementById("btnSubmit").textContent = "Actualizar Entrega";
    } else {
      document.getElementById("btnSubmit").textContent = "Enviar Entrega";
    }
  } catch {
    document.getElementById("btnSubmit").textContent = "Enviar Entrega";
  }

  // Disable submit if deadline passed
  if (isDeadlinePassed()) {
    document.getElementById("btnSubmit").disabled = true;
    document.getElementById("btnSubmit").textContent = "Entrega cerrada";
  }

  show("scrForm");
}

/* ── Drop zone ── */
function resetDropZone() {
  const zone = document.getElementById("dropZone");
  zone.classList.remove("done", "over");
  document.getElementById("dzContent").innerHTML = `
    <div class="dz-icon">📄</div>
    <div class="dz-main">Haz clic o arrastra el archivo aquí</div>
    <div class="dz-sub">PDF, Word (.doc, .docx) · Máx. 20 MB</div>
  `;
}

function initDropZone() {
  const zone  = document.getElementById("dropZone");
  const input = document.getElementById("fileInput");
  zone.addEventListener("click",      () => input.click());
  zone.addEventListener("dragover",   e => { e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave",  () => zone.classList.remove("over"));
  zone.addEventListener("drop",       e => { e.preventDefault(); zone.classList.remove("over"); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); });
  input.addEventListener("change",    () => { if (input.files[0]) onFile(input.files[0]); });
}

function onFile(file) {
  const errEl  = document.getElementById("fileErr");
  const okTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  const okExt  = /\.(pdf|doc|docx)$/i.test(file.name);

  if (!okTypes.includes(file.type) && !okExt) {
    errEl.textContent = "Solo se aceptan archivos PDF o Word (.doc, .docx).";
    errEl.classList.add("on");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    errEl.textContent = "El archivo supera el límite de 20 MB.";
    errEl.classList.add("on");
    return;
  }
  errEl.classList.remove("on");

  state.selectedFile = file;
  const zone = document.getElementById("dropZone");
  zone.classList.add("done");
  document.getElementById("dzContent").innerHTML = `
    <div class="dz-icon">✅</div>
    <div class="dz-ok">${file.name}</div>
    <div class="dz-sub">${fmtSize(file.size)} · clic para cambiar</div>
  `;
}

/* ── Submit ── */
async function handleSubmit() {
  const submitErr = document.getElementById("submitErr");
  submitErr.classList.remove("on");
  document.getElementById("fileErr").classList.remove("on");
  document.getElementById("urlErr").classList.remove("on");

  // Must have file (always required — even on re-submit)
  if (!state.selectedFile) {
    document.getElementById("fileErr").textContent = state.hasExisting
      ? "Selecciona el archivo para actualizar tu entrega."
      : "Selecciona el archivo del Proyecto Final.";
    document.getElementById("fileErr").classList.add("on");
    return;
  }

  const videoUrl = document.getElementById("inVideoUrl").value.trim();
  if (!videoUrl.startsWith("http")) {
    document.getElementById("urlErr").classList.add("on");
    return;
  }

  if (isDeadlinePassed()) {
    submitErr.textContent = "La entrega ya está cerrada.";
    submitErr.classList.add("on");
    return;
  }

  const btn = document.getElementById("btnSubmit");
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Enviando…';

  try {
    const fileData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(state.selectedFile);
    });

    const body = {
      matricula: state.student.matricula,
      nombre:    state.student.nombre,
      fileName:  state.selectedFile.name,
      fileSize:  state.selectedFile.size,
      fileType:  state.selectedFile.type,
      fileData,
      videoUrl,
    };

    const res  = await fetch("/api/submissions", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al enviar");

    showSuccess(state.selectedFile.name, videoUrl, data.submittedAt);

  } catch (err) {
    submitErr.textContent = err.message || "Error de red. Intenta de nuevo.";
    submitErr.classList.add("on");
    btn.disabled = false;
    btn.textContent = state.hasExisting ? "Actualizar Entrega" : "Enviar Entrega";
  }
}

function showSuccess(fileName, videoUrl, submittedAt) {
  document.getElementById("sucTs").textContent = `Entregado el ${fmtDate(submittedAt)}`;
  document.getElementById("sucInfo").innerHTML = `
    <p>📄 <strong>${fileName}</strong></p>
    <p style="margin-top:.4rem">🎬 <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--blue)">${videoUrl}</a></p>
  `;
  // Hide resubmit button if deadline already passed
  document.getElementById("btnResubmit").style.display = isDeadlinePassed() ? "none" : "block";
  show("scrSuccess");
}

/* ══════════════════════════════════════════
   TEACHER VIEW
══════════════════════════════════════════ */
async function loadTeacher() {
  show("scrTeacher");
  try {
    const res  = await fetch("/api/submissions");
    const data = await res.json();
    renderTeacher(data.submissions || []);
  } catch {
    document.getElementById("tTeacher").textContent = "Error al cargar entregas.";
  }
}

function renderTeacher(subs) {
  document.getElementById("tStatRec").textContent = subs.length;
  document.getElementById("tStatPen").textContent = CFG.totalEstudiantes - subs.length;

  if (subs.length === 0) {
    document.getElementById("tTeacher").innerHTML = `<p style="color:var(--muted);text-align:center;padding:1.5rem">Sin entregas aún.</p>`;
    return;
  }

  const sorted = [...subs].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  const rows   = sorted.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>
        <strong>${s.nombre}</strong><br>
        <span class="muted">${s.matricula}</span>
      </td>
      <td>
        <button class="lnk" onclick="downloadFile('${s.matricula}','${escHtml(s.fileName)}')">⬇ ${escHtml(s.fileName)}</button><br>
        <span class="muted">${fmtSize(s.fileSize)}</span>
      </td>
      <td>
        <a href="${escHtml(s.videoUrl)}" target="_blank" rel="noopener noreferrer" class="lnk">▶ Ver video</a>
      </td>
      <td style="white-space:nowrap;color:var(--muted)">${fmtDate(s.submittedAt)}</td>
    </tr>
  `).join("");

  document.getElementById("tTeacher").innerHTML = `
    <table>
      <thead>
        <tr><th>#</th><th>Estudiante</th><th>Documento</th><th>Video</th><th>Fecha</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

async function downloadFile(matricula, fileName) {
  toast("Descargando…");
  try {
    const res  = await fetch(`/api/submissions?matricula=${encodeURIComponent(matricula)}`);
    if (!res.ok) throw new Error("No encontrado");
    const data   = await res.json();
    const binary = atob(data.fileData);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob   = new Blob([bytes], { type: data.fileType || "application/octet-stream" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast("✅ " + fileName);
  } catch {
    toast("❌ Error al descargar.");
  }
}

async function exportSummary() {
  const res  = await fetch("/api/submissions");
  const data = await res.json();
  const subs = data.submissions || [];
  const lines = [
    "SIST-3311 — Entrega Proyecto Final ENE-ABR 2026",
    `Generado: ${new Date().toLocaleString("es-DO")}`,
    `Recibidas: ${subs.length} / ${CFG.totalEstudiantes}`,
    "─".repeat(60),
    "",
  ];
  subs.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.nombre} (${s.matricula})`);
    lines.push(`   Archivo: ${s.fileName}  (${fmtSize(s.fileSize)})`);
    lines.push(`   Video:   ${s.videoUrl}`);
    lines.push(`   Fecha:   ${fmtDate(s.submittedAt)}`);
    lines.push("");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `SIST3311_Entregas_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
function init() {
  tick();
  setInterval(tick, 1000);
  initDropZone();

  document.getElementById("btnAuth").addEventListener("click", handleAuth);
  document.getElementById("inMatricula").addEventListener("keydown", e => { if (e.key === "Enter") handleAuth(); });
  document.getElementById("btnSubmit").addEventListener("click", handleSubmit);
  document.getElementById("btnBack").addEventListener("click", () => show("scrAuth"));
  document.getElementById("btnResubmit").addEventListener("click", loadForm);
  document.getElementById("btnExport").addEventListener("click", exportSummary);

  if (isDeadlinePassed()) {
    document.getElementById("cdBox").style.display = "none";
    document.getElementById("closedBanner").classList.add("on");
  }
}

// Expose for inline onclick in teacher table
window.downloadFile = downloadFile;

document.addEventListener("DOMContentLoaded", init);
</script>

</body>
</html>
```

- [ ] **Step 2: Verify in browser**

```bash
cd entrega-trabajo-final
wrangler pages dev . --port 8788
```

Open `http://localhost:8788/`. Run through this checklist:

**Countdown:**
- [ ] Shows `HH:MM:SS` ticking down in green (or amber/red depending on time left)
- [ ] Deadline text shows "Cierra el 20 abr 2026 a las 10:00 PM"

**Auth — invalid matrícula:**
- [ ] Enter `9999-9999` → click Continuar → red error "Matrícula no encontrada"

**Auth — student:**
- [ ] Enter `2024-0007` → click Continuar → student form appears
- [ ] Name badge shows "CINDY PAOLA ALCANTARA GARCIA"
- [ ] Drop zone shows default state (no existing submission)
- [ ] Submit button says "Enviar Entrega"
- [ ] Clicking "← Volver" goes back to auth

**File selection:**
- [ ] Click drop zone → file picker opens → select a PDF → zone turns green with filename
- [ ] Drag-and-drop a .docx → zone updates
- [ ] Try dragging a .jpg → red error "Solo se aceptan archivos PDF o Word"

**Submit flow:**
- [ ] Enter video URL `https://youtu.be/test` → click "Enviar Entrega"
- [ ] Spinner shows during upload
- [ ] Success screen shows filename and video link
- [ ] "Corregir entrega" button visible (deadline not yet passed)

**Re-submit (existing entry):**
- [ ] Click "Corregir entrega" → back to form
- [ ] Drop zone now shows "✅ [previous filename]" with previous timestamp
- [ ] Submit button says "Actualizar Entrega"
- [ ] Select a new file → submit → success screen with new timestamp

**Auth — teacher:**
- [ ] Go back to auth, enter `2008464` → teacher dashboard appears
- [ ] Stats show "1 Recibidas / 24 Pendientes"
- [ ] Table has one row with student name, filename download button, video link
- [ ] Click "⬇" download → PDF downloads to disk
- [ ] Click "▶ Ver video" → opens `https://youtu.be/test` in new tab
- [ ] Click "Exportar .txt" → downloads `SIST3311_Entregas_2026-04-20.txt`

**Deadline enforcement (simulate):**

Temporarily change `new Date("2026-04-20T22:00:00-04:00")` to `new Date("2020-01-01T00:00:00-04:00")` in the script, reload:
- [ ] Countdown hidden, red "⛔ ENTREGA CERRADA" banner visible
- [ ] Navigate to student form → submit button disabled, text "Entrega cerrada"

Revert the date change.

- [ ] **Step 3: Commit**

```bash
git add entrega-trabajo-final/index.html
git commit -m "feat(entrega): index.html completo — countdown, auth, form, teacher view"
```

---

## Task 4: Fix any bugs found in Task 3

**Files:** `entrega-trabajo-final/index.html` or `functions/api/submissions.js` (only if needed)

- [ ] **Step 1: Address any issues from the Task 3 checklist**

If all checklist items passed, skip this task.

If issues were found:
- Edit the relevant file
- Re-run the affected checks from Task 3 Step 2
- Commit: `git commit -m "fix(entrega): [description of fix]"`

---

## Task 5: Deploy to Cloudflare Pages

- [ ] **Step 1: Create KV namespace**

```bash
cd entrega-trabajo-final
wrangler kv namespace create FINAL_SUBMISSIONS
```

Expected output:
```
✅ Successfully created namespace "FINAL_SUBMISSIONS"
[[kv_namespaces]]
binding = "FINAL_SUBMISSIONS"
id = "abc123..."
```

Copy the `id` value.

- [ ] **Step 2: Update `wrangler.toml`**

Replace `REPLACE_WITH_KV_ID` with the real ID from Step 1:

```toml
name = "entrega-trabajo-final"
compatibility_date = "2024-12-01"

[[kv_namespaces]]
binding = "FINAL_SUBMISSIONS"
id = "abc123..."    # ← real ID here
```

- [ ] **Step 3: Commit and push**

```bash
git add entrega-trabajo-final/wrangler.toml
git commit -m "config(entrega): KV namespace ID producción"
git push
```

Then open a PR from the current branch to `main` and merge it, or push directly to `main`.

- [ ] **Step 4: Create Cloudflare Pages project**

In the Cloudflare Dashboard:
1. Pages → Create a project → Connect to Git → select `herramientas-educativas`
2. Project name: `entrega-trabajo-final`
3. Build settings:
   - Build command: *(leave empty)*
   - Build output directory: `entrega-trabajo-final`
4. Click **Save and Deploy**

- [ ] **Step 5: Bind KV namespace**

In the new Pages project:
- Settings → Functions → KV namespace bindings → Add binding
  - Variable name: `FINAL_SUBMISSIONS`
  - KV namespace: select the namespace created in Step 1
- Save → trigger a redeploy (Settings → Deployments → Retry deployment)

- [ ] **Step 6: Smoke test on production URL**

Open `https://entrega-trabajo-final.pages.dev` (or whatever URL CF assigned):
- [ ] Page loads with countdown
- [ ] Enter `2024-0007` → form appears
- [ ] Submit a test file + URL → success screen
- [ ] Enter `2008464` → teacher view shows the submission
- [ ] Download file works on production

---

*Implementation complete when Task 5 Step 6 passes.*
