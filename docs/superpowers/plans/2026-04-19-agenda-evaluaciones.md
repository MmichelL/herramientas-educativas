# Agenda de Evaluaciones — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `agenda-evaluaciones/` — herramienta web para reservar horarios de evaluación y correr el flujo completo de evaluación docente (ruleta 2-niveles + scoring + prompt para IA externa + publicación de resultados) sobre Cloudflare Pages + KV.

**Architecture:** HTML monolítico con módulos namespaced (`App.Core`, `App.Auth`, `App.Student`, `App.Teacher`, `App.Roulette`, `App.Eval`, `App.Prompt`, `App.Reports`, `App.UI`). Persistencia en Cloudflare KV con locking optimista (patrón heredado de `selector-de-proyectos`). Sin build step, sin npm.

**Tech Stack:** HTML + CSS + JS vanilla (ES2020 inline) · Canvas API · Cloudflare Pages Functions · Cloudflare KV · Wrangler CLI (dev local).

**Spec fuente:** [docs/superpowers/specs/2026-04-19-agenda-evaluaciones-design.md](../specs/2026-04-19-agenda-evaluaciones-design.md)

**Convenciones del monorepo (importantes):**
- Sin tests automatizados (convención documentada en `herramientas-educativas-CLAUDE.md`). Verificación = checklist manual en browser / curl.
- Paleta CSS root: `--navy #1A2456`, `--blue #2D5BE3`, `--mint #00D4A0`, `--amber #F59E0B`, `--coral #FF5C6A`, `--gray #F3F4F8`.
- Commits estilo Conventional Commits en español: `feat:`, `fix:`, `docs:`, `config:`.

---

## File Structure

```
agenda-evaluaciones/
├── CLAUDE.md                      ← contexto y checklist manual (creado en Task 16)
├── index.html                     ← app monolítica (Tasks 3–15)
├── wrangler.toml                  ← Pages config + KV binding (Task 1)
└── functions/
    └── api/
        └── state.js               ← Worker GET/PUT + locking (Task 2)
```

**Responsabilidades por módulo dentro de `index.html`:**

| Módulo | Qué hace | Task que lo crea |
|---|---|---|
| `App.Core` | `CONFIGURACIONES`, KV client, router hash, bus eventos, indicador guardado | Task 3 |
| `App.Auth` | Login: materia → nombre → matrícula → rol | Task 4 |
| `App.Student` | Home, slot picker, reservar, ver resultado | Tasks 5–7 |
| `App.Teacher` | Agenda, filtros, publicar, reportes | Tasks 8, 12, 13 |
| `App.Roulette` | Canvas 2-niveles con dedupe por estudiante | Task 9 |
| `App.Eval` | Panel eval live + post-sesión | Tasks 10, 11 |
| `App.Prompt` | Template filler + copy-to-clipboard | Task 11 |
| `App.Reports` | Export `.txt` individual + global | Task 14 |
| `App.UI` | Toast, modal, confirm (definidos en Task 3) | Task 3 |

---

## Task 1: Scaffolding de la herramienta

**Files:**
- Create: `agenda-evaluaciones/wrangler.toml`
- Create: `agenda-evaluaciones/functions/api/state.js` (stub temporal)
- Create: `agenda-evaluaciones/index.html` (placeholder)

- [ ] **Step 1: Crear carpeta y `wrangler.toml`**

```bash
mkdir -p agenda-evaluaciones/functions/api
```

Archivo `agenda-evaluaciones/wrangler.toml`:

```toml
name = "agenda-evaluaciones"
compatibility_date = "2024-12-01"
pages_build_output_dir = "."

[[kv_namespaces]]
binding = "AGENDA_EVAL_STATE"
id = "REEMPLAZAR_TRAS_CREAR_NAMESPACE"
```

> Nota: el `id` se reemplaza tras crear el KV namespace en el dashboard (ver Task 16). Durante dev local con `wrangler pages dev` se crea binding efímero.

- [ ] **Step 2: Stub de `state.js`**

Archivo `agenda-evaluaciones/functions/api/state.js`:

```javascript
// Stub — implementación real en Task 2
export async function onRequestGet() {
  return new Response(JSON.stringify({ stub: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 3: Placeholder `index.html`**

Archivo `agenda-evaluaciones/index.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Agenda de Evaluaciones</title>
</head>
<body>
  <main id="app">Cargando…</main>
</body>
</html>
```

- [ ] **Step 4: Smoke local con wrangler**

```bash
cd agenda-evaluaciones
wrangler pages dev . --port 8788
```

En otra terminal:

```bash
curl http://localhost:8788/api/state
```

Esperado: `{"stub":true}` (status 200).

Abrir `http://localhost:8788/` → ver "Cargando…".

Ctrl+C para parar wrangler.

- [ ] **Step 5: Commit**

```bash
git add agenda-evaluaciones/
git commit -m "feat: scaffolding agenda-evaluaciones (wrangler + stubs)"
```

---

## Task 2: Worker KV con locking optimista

**Files:**
- Modify: `agenda-evaluaciones/functions/api/state.js`

Schema KV: `state_{configId}` → `{ version, reservas: {} }`. El worker valida `version` antes de escribir.

- [ ] **Step 1: Reemplazar `state.js` completo**

Archivo `agenda-evaluaciones/functions/api/state.js`:

```javascript
// ══════════════════════════════════════════════════════════════════
// API de estado — Cloudflare Pages Function + KV
// Con locking optimista.
//
// GET  /api/state?id=config-id   → leer estado + versión
// PUT  /api/state?id=config-id   → reemplazar reservas (con check version)
// ══════════════════════════════════════════════════════════════════

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function emptyState() {
  return { version: 0, reservas: {} };
}

function stateKey(configId) {
  return `state_${configId}`;
}

async function readState(kv, configId) {
  const data = await kv.get(stateKey(configId), "json");
  if (!data) return emptyState();
  if (typeof data.version !== "number") data.version = 0;
  if (!data.reservas || typeof data.reservas !== "object") data.reservas = {};
  return data;
}

async function writeState(kv, configId, state) {
  await kv.put(stateKey(configId), JSON.stringify(state));
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// ── GET /api/state?id=config-id ─────────────────────────────────
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const configId = url.searchParams.get("id");
  if (!configId) {
    return new Response(JSON.stringify({ error: "Falta 'id'" }), {
      status: 400, headers: corsHeaders(),
    });
  }
  const state = await readState(context.env.AGENDA_EVAL_STATE, configId);
  return new Response(JSON.stringify(state), { status: 200, headers: corsHeaders() });
}

// ── PUT /api/state?id=config-id ─────────────────────────────────
// Body: { version: N, reservas: {...} }
//
// Comportamiento:
//   - Si version del cliente coincide → persiste reservas, incrementa version
//   - Si no coincide → 409 con state actual
//
// El cliente SIEMPRE envía el mapa completo de reservas que quiere persistir
// (el worker no hace merge). Esto mantiene la lógica del worker simple y el
// cliente responsable de la consistencia sobre el snapshot que trajo.
export async function onRequestPut(context) {
  const url = new URL(context.request.url);
  const configId = url.searchParams.get("id");
  if (!configId) {
    return new Response(JSON.stringify({ error: "Falta 'id'" }), {
      status: 400, headers: corsHeaders(),
    });
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400, headers: corsHeaders(),
    });
  }

  const { version, reservas } = body;
  if (typeof version !== "number" || !reservas || typeof reservas !== "object") {
    return new Response(JSON.stringify({ error: "Campos requeridos: version, reservas" }), {
      status: 400, headers: corsHeaders(),
    });
  }

  const current = await readState(context.env.AGENDA_EVAL_STATE, configId);

  if (version !== current.version) {
    return new Response(JSON.stringify({
      conflict: true,
      reason: "VERSION_MISMATCH",
      message: "El estado cambió. Recargando snapshot más reciente.",
      state: current,
    }), { status: 409, headers: corsHeaders() });
  }

  const next = { version: current.version + 1, reservas };
  await writeState(context.env.AGENDA_EVAL_STATE, configId, next);

  return new Response(JSON.stringify({ ok: true, state: next }), {
    status: 200, headers: corsHeaders(),
  });
}
```

- [ ] **Step 2: Verificar endpoints con curl**

Terminal 1:

```bash
cd agenda-evaluaciones
wrangler pages dev . --port 8788
```

Terminal 2 (verificación GET vacío):

```bash
curl "http://localhost:8788/api/state?id=test"
```

Esperado: `{"version":0,"reservas":{}}`.

Verificación PUT exitoso:

```bash
curl -X PUT "http://localhost:8788/api/state?id=test" \
  -H "Content-Type: application/json" \
  -d '{"version":0,"reservas":{"r-1":{"id":"r-1","estado":"reservada"}}}'
```

Esperado: `{"ok":true,"state":{"version":1,"reservas":{...}}}`.

Verificación PUT con version stale:

```bash
curl -X PUT "http://localhost:8788/api/state?id=test" \
  -H "Content-Type: application/json" \
  -d '{"version":0,"reservas":{}}'
```

Esperado: status 409, body con `conflict:true, reason:"VERSION_MISMATCH"`.

Verificación GET con state poblado:

```bash
curl "http://localhost:8788/api/state?id=test"
```

Esperado: `{"version":1,"reservas":{"r-1":...}}`.

Ctrl+C para parar wrangler.

- [ ] **Step 3: Commit**

```bash
git add agenda-evaluaciones/functions/api/state.js
git commit -m "feat: worker KV con locking optimista para agenda-evaluaciones"
```

---

## Task 3: `App.Core` + CSS base + shell HTML

**Files:**
- Modify: `agenda-evaluaciones/index.html`

Este task establece: paleta CSS, reset, contenedor `#app`, `CONFIGURACIONES` vacía (se llena en Task 15), KV client, router hash, bus eventos, indicador guardado, primitivos `App.UI` (toast + modal + confirm).

- [ ] **Step 1: Reemplazar `index.html` completo con la base**

Archivo `agenda-evaluaciones/index.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Agenda de Evaluaciones — Herramientas Educativas</title>
<style>
  :root {
    --navy: #1A2456;
    --blue: #2D5BE3;
    --mint: #00D4A0;
    --amber: #F59E0B;
    --coral: #FF5C6A;
    --gray: #F3F4F8;
    --dgray: #6B7280;
    --black: #1F2937;
    --white: #FFFFFF;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: linear-gradient(135deg, #0F1A3C 0%, #1A2456 50%, #0F1A3C 100%);
    color: var(--black);
    min-height: 100vh;
  }
  #app { min-height: 100vh; }

  .card {
    background: white;
    border-radius: 24px;
    padding: 32px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.4);
  }
  .btn {
    display: inline-block;
    padding: 14px 22px;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.2s;
  }
  .btn-primary { background: var(--blue); color: white; }
  .btn-primary:hover { box-shadow: 0 6px 20px rgba(45,91,227,0.4); }
  .btn-ghost { background: transparent; color: var(--blue); }
  .btn-danger { background: var(--coral); color: white; }
  .btn-success { background: var(--mint); color: var(--navy); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  input, select, textarea {
    width: 100%;
    padding: 12px 14px;
    border: 2px solid #E5E7EB;
    border-radius: 10px;
    font-size: 15px;
    font-family: inherit;
    outline: none;
  }
  input:focus, select:focus, textarea:focus { border-color: var(--blue); }
  label { font-size: 12px; font-weight: 700; color: var(--dgray);
          text-transform: uppercase; letter-spacing: 1px; display: block;
          margin-bottom: 6px; }

  /* Toast */
  .toast-host { position: fixed; bottom: 24px; right: 24px; z-index: 1000;
                display: flex; flex-direction: column; gap: 8px; }
  .toast { background: var(--navy); color: white; padding: 14px 20px;
           border-radius: 10px; font-size: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
           animation: slideIn 0.25s ease-out; max-width: 360px; }
  .toast.success { background: var(--mint); color: var(--navy); }
  .toast.error { background: var(--coral); }
  .toast.warn { background: var(--amber); color: var(--navy); }
  @keyframes slideIn { from { opacity: 0; transform: translateX(20px); }
                       to { opacity: 1; transform: translateX(0); } }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; background: rgba(15,26,60,0.75);
                   display: flex; align-items: center; justify-content: center;
                   z-index: 999; padding: 20px; }
  .modal { background: white; border-radius: 18px; padding: 28px; max-width: 480px;
           width: 100%; }
  .modal h2 { color: var(--navy); margin-bottom: 12px; font-size: 20px; }
  .modal p { color: var(--dgray); margin-bottom: 20px; line-height: 1.5; }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }

  /* Save indicator */
  .save-indicator { position: fixed; top: 16px; right: 16px; z-index: 500;
                    background: rgba(255,255,255,0.95); padding: 8px 14px;
                    border-radius: 20px; font-size: 13px; color: var(--dgray);
                    display: none; }
  .save-indicator.saving { display: block; color: var(--amber); }
  .save-indicator.saved  { display: block; color: var(--mint); }
  .save-indicator.error  { display: block; color: var(--coral); }
</style>
</head>
<body>

<div id="app">Cargando…</div>
<div id="save-indicator" class="save-indicator"></div>
<div id="toast-host" class="toast-host"></div>
<div id="modal-host"></div>

<script>
// ══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN — Editar aquí para agregar/modificar contextos
// ══════════════════════════════════════════════════════════════════
const CONFIGURACIONES = [
  // Primera entrada se agrega en Task 15 (SIST-3311 recuperación)
];

const PROFESOR_MATRICULA = "2008464"; // usado como contraseña; UI nunca lo rotula como matrícula

// ══════════════════════════════════════════════════════════════════
// App.Core — config activa, KV client, router, bus, save-indicator
// ══════════════════════════════════════════════════════════════════
const App = {};

App.Core = (function () {
  let activeConfigId = null;
  let kvState = { version: 0, reservas: {} };
  let listeners = {};

  const api = {
    get config() {
      return CONFIGURACIONES.find(c => c.id === activeConfigId) || null;
    },
    get configId() { return activeConfigId; },
    setConfig(id) {
      if (!CONFIGURACIONES.some(c => c.id === id)) {
        throw new Error(`Config no existe: ${id}`);
      }
      activeConfigId = id;
      emit("config:changed", id);
    },
    get state() { return kvState; },

    // ── KV client ─────────────────────────────────────────────
    async fetchState() {
      if (!activeConfigId) throw new Error("Config no seleccionada");
      const res = await fetch(`/api/state?id=${encodeURIComponent(activeConfigId)}`);
      if (!res.ok) throw new Error(`GET /api/state falló: ${res.status}`);
      kvState = await res.json();
      emit("state:changed", kvState);
      return kvState;
    },

    // mutator recibe clon de reservas, lo modifica y devuelve el nuevo mapa
    async mutate(mutator) {
      if (!activeConfigId) throw new Error("Config no seleccionada");
      setSaving("saving");
      try {
        const nextReservas = mutator(deepClone(kvState.reservas));
        const res = await fetch(`/api/state?id=${encodeURIComponent(activeConfigId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: kvState.version, reservas: nextReservas }),
        });
        if (res.status === 409) {
          const data = await res.json();
          kvState = data.state;
          emit("state:changed", kvState);
          setSaving("error");
          throw Object.assign(new Error(data.message || "Conflicto de versión"), { conflict: true, state: kvState });
        }
        if (!res.ok) {
          setSaving("error");
          throw new Error(`PUT /api/state falló: ${res.status}`);
        }
        const data = await res.json();
        kvState = data.state;
        emit("state:changed", kvState);
        setSaving("saved");
        return kvState;
      } catch (e) {
        if (!e.conflict) setSaving("error");
        throw e;
      }
    },

    // ── Router hash ───────────────────────────────────────────
    route() {
      return window.location.hash || "#/";
    },
    navigate(hash) {
      window.location.hash = hash;
    },
    onRoute(handler) {
      window.addEventListener("hashchange", () => handler(api.route()));
      window.addEventListener("load", () => handler(api.route()));
    },

    // ── Bus eventos ───────────────────────────────────────────
    on(event, handler) {
      (listeners[event] ||= []).push(handler);
    },

    // ── Helpers ───────────────────────────────────────────────
    findEstudiante(matricula) {
      const cfg = api.config;
      if (!cfg) return null;
      return cfg.estudiantes.find(e => e.matricula === matricula) || null;
    },

    reservasDeEstudiante(matricula) {
      return Object.values(kvState.reservas)
        .filter(r => r.estudianteMatricula === matricula);
    },

    reservasEnVentana(ventanaId) {
      return Object.values(kvState.reservas)
        .filter(r => r.ventanaId === ventanaId);
    },

    slotsOcupados(ventanaId) {
      return new Set(api.reservasEnVentana(ventanaId).map(r => r.slotInicio));
    },
  };

  function emit(event, payload) {
    (listeners[event] || []).forEach(h => {
      try { h(payload); } catch (e) { console.error(e); }
    });
  }

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function setSaving(status) {
    const el = document.getElementById("save-indicator");
    if (!el) return;
    el.className = `save-indicator ${status}`;
    el.textContent = { saving: "● guardando…", saved: "✓ guardado", error: "⚠ error" }[status] || "";
    if (status === "saved") {
      clearTimeout(setSaving._t);
      setSaving._t = setTimeout(() => { el.className = "save-indicator"; el.textContent = ""; }, 1200);
    }
  }

  return api;
})();

// ══════════════════════════════════════════════════════════════════
// App.UI — toast, modal, confirm
// ══════════════════════════════════════════════════════════════════
App.UI = (function () {
  function toast(msg, kind = "default", ms = 3000) {
    const host = document.getElementById("toast-host");
    const el = document.createElement("div");
    el.className = `toast ${kind === "default" ? "" : kind}`;
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  function modal({ title, body, actions }) {
    return new Promise((resolve) => {
      const host = document.getElementById("modal-host");
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const m = document.createElement("div");
      m.className = "modal";
      m.innerHTML = `<h2>${esc(title)}</h2><div class="modal-body">${body}</div>`;
      const acts = document.createElement("div");
      acts.className = "modal-actions";
      actions.forEach(a => {
        const b = document.createElement("button");
        b.className = `btn ${a.class || "btn-primary"}`;
        b.textContent = a.label;
        b.onclick = () => {
          overlay.remove();
          resolve(a.value);
        };
        acts.appendChild(b);
      });
      m.appendChild(acts);
      overlay.appendChild(m);
      overlay.onclick = (e) => {
        if (e.target === overlay) { overlay.remove(); resolve(null); }
      };
      host.appendChild(overlay);
    });
  }

  function confirm(msg) {
    return modal({
      title: "Confirmar",
      body: `<p>${esc(msg)}</p>`,
      actions: [
        { label: "Cancelar", class: "btn-ghost", value: false },
        { label: "Aceptar",  class: "btn-primary", value: true },
      ],
    });
  }

  function prompt(title, placeholder = "") {
    return new Promise((resolve) => {
      const id = `input-${Date.now()}`;
      modal({
        title,
        body: `<input id="${id}" type="password" placeholder="${esc(placeholder)}"/>`,
        actions: [
          { label: "Cancelar", class: "btn-ghost", value: null },
          { label: "Aceptar",  class: "btn-primary", value: "__ACCEPT__" },
        ],
      }).then(v => {
        if (v === "__ACCEPT__") {
          const el = document.getElementById(id);
          resolve(el ? el.value : null);
        } else {
          resolve(null);
        }
      });
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.focus();
      }, 0);
    });
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  return { toast, modal, confirm, prompt, esc };
})();

// ══════════════════════════════════════════════════════════════════
// Boot — placeholder hasta que Task 4 monte App.Auth
// ══════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("app").innerHTML =
    "<div style='padding:40px;color:white'>App.Core listo. Modules pendientes.</div>";
  App.Core.onRoute(() => { /* routes registradas por módulos */ });
});
</script>

</body>
</html>
```

- [ ] **Step 2: Verificar en browser**

Iniciar wrangler:

```bash
cd agenda-evaluaciones
wrangler pages dev . --port 8788
```

Abrir `http://localhost:8788/`. Esperado: pantalla oscura azul con texto "App.Core listo. Modules pendientes.".

Abrir DevTools console. Ejecutar:

```javascript
App.UI.toast("Hola mundo", "success");
await App.UI.confirm("¿Probar?");  // aceptar debería devolver true
```

Esperado: toast aparece abajo-derecha; modal muestra y devuelve el valor.

- [ ] **Step 3: Commit**

```bash
git add agenda-evaluaciones/index.html
git commit -m "feat: App.Core + App.UI base (CSS, KV client, router, bus, toast/modal)"
```

---

## Task 4: `App.Auth` — pantalla login

**Files:**
- Modify: `agenda-evaluaciones/index.html` (agregar módulo `App.Auth` + bootstrap)

Flujo login: dropdown materia → dropdown nombre → input matrícula → botón "Entrar como estudiante" **o** link "Soy profesor" que pide contraseña.

- [ ] **Step 1: Agregar módulo `App.Auth` y sesión efímera**

En `index.html`, antes del `document.addEventListener("DOMContentLoaded"...`, insertar:

```javascript
// ══════════════════════════════════════════════════════════════════
// App.Auth — login + sesión efímera
// ══════════════════════════════════════════════════════════════════
App.Auth = (function () {
  const SESSION_KEY = "agenda_eval_session";

  function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
    catch { return null; }
  }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function render() {
    const host = document.getElementById("app");
    const configs = CONFIGURACIONES;

    host.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px">
        <div class="card" style="max-width:480px;width:100%">
          <div style="text-align:center;margin-bottom:24px">
            <div style="width:64px;height:64px;background:var(--blue);border-radius:16px;
                 display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px">📅</div>
            <h1 style="color:var(--navy);font-size:22px">Agenda de Evaluaciones</h1>
            <p style="color:var(--dgray);font-size:14px;margin-top:4px">Herramientas Educativas · UNAD</p>
          </div>

          <label for="auth-materia">Materia</label>
          <select id="auth-materia">
            <option value="">-- seleccionar --</option>
            ${configs.map(c => `<option value="${c.id}">${App.UI.esc(c.etiqueta)}</option>`).join("")}
          </select>

          <div id="auth-after-materia" style="display:none;margin-top:16px">
            <label for="auth-nombre">Nombre</label>
            <select id="auth-nombre">
              <option value="">-- seleccionar --</option>
            </select>

            <div style="margin-top:16px">
              <label for="auth-matricula">Matrícula</label>
              <input id="auth-matricula" type="text" placeholder="2024-XXXX" autocomplete="off"/>
            </div>

            <button id="auth-entrar" class="btn btn-primary" style="width:100%;margin-top:20px">
              Entrar como estudiante
            </button>

            <div style="text-align:center;margin-top:16px">
              <a id="auth-profe" href="#" style="color:var(--dgray);font-size:13px;text-decoration:none">
                🔒 Soy profesor
              </a>
            </div>
          </div>

          <div id="auth-error" style="color:var(--coral);font-size:13px;margin-top:12px;min-height:16px;text-align:center"></div>
        </div>
      </div>
    `;

    wireEvents();
  }

  function wireEvents() {
    const materia = document.getElementById("auth-materia");
    const after = document.getElementById("auth-after-materia");
    const nombre = document.getElementById("auth-nombre");
    const matricula = document.getElementById("auth-matricula");
    const entrar = document.getElementById("auth-entrar");
    const profe = document.getElementById("auth-profe");
    const err = document.getElementById("auth-error");

    materia.onchange = () => {
      const cfg = CONFIGURACIONES.find(c => c.id === materia.value);
      if (!cfg) { after.style.display = "none"; return; }
      after.style.display = "block";
      nombre.innerHTML = `<option value="">-- seleccionar --</option>` +
        cfg.estudiantes.map(e => `<option value="${e.matricula}">${App.UI.esc(e.nombre)}</option>`).join("");
      err.textContent = "";
    };

    entrar.onclick = async () => {
      err.textContent = "";
      const configId = materia.value;
      const matriculaVal = matricula.value.trim();
      const nombreVal = nombre.value;
      if (!configId || !nombreVal || !matriculaVal) {
        err.textContent = "Completa materia, nombre y matrícula."; return;
      }
      if (nombreVal !== matriculaVal) {
        err.textContent = "La matrícula no corresponde al nombre seleccionado."; return;
      }
      // Sesión estudiante
      App.Core.setConfig(configId);
      saveSession({ rol: "estudiante", configId, matricula: matriculaVal });
      try { await App.Core.fetchState(); } catch (e) { err.textContent = "Error cargando datos."; return; }
      App.Core.navigate("#/estudiante/agenda");
    };

    profe.onclick = async (e) => {
      e.preventDefault();
      err.textContent = "";
      const configId = materia.value;
      if (!configId) { err.textContent = "Primero selecciona materia."; return; }
      const pwd = await App.UI.prompt("Contraseña", "••••••");
      if (pwd === null) return;
      if (pwd !== PROFESOR_MATRICULA) {
        err.textContent = "Contraseña incorrecta."; return;
      }
      App.Core.setConfig(configId);
      saveSession({ rol: "profe", configId });
      try { await App.Core.fetchState(); } catch (ex) { err.textContent = "Error cargando datos."; return; }
      App.Core.navigate("#/profe/agenda");
    };
  }

  return { render, loadSession, saveSession, clearSession };
})();
```

- [ ] **Step 2: Cambiar bootstrap para invocar login o reanudar sesión**

Reemplazar el bloque `document.addEventListener("DOMContentLoaded", ...)` por:

```javascript
document.addEventListener("DOMContentLoaded", async () => {
  const session = App.Auth.loadSession();
  if (session && CONFIGURACIONES.some(c => c.id === session.configId)) {
    try {
      App.Core.setConfig(session.configId);
      await App.Core.fetchState();
      const hash = window.location.hash || (session.rol === "profe" ? "#/profe/agenda" : "#/estudiante/agenda");
      if (hash === "#/") App.Core.navigate(session.rol === "profe" ? "#/profe/agenda" : "#/estudiante/agenda");
    } catch (e) {
      App.Auth.clearSession();
      App.Auth.render();
      return;
    }
  }
  App.Core.onRoute(route);
});

function route(hash) {
  if (hash === "#/" || !hash) return App.Auth.render();
  // Rutas de otros módulos se registran después
  document.getElementById("app").innerHTML = `<div style="padding:40px;color:white">Ruta pendiente: ${App.UI.esc(hash)}</div>`;
}
```

> Nota: mover `route` fuera del `DOMContentLoaded` permite que módulos futuros extiendan el switch.

- [ ] **Step 3: Agregar entrada temporal en `CONFIGURACIONES` para probar**

Reemplazar la constante `CONFIGURACIONES = [];` por:

```javascript
const CONFIGURACIONES = [
  {
    id: "demo-test",
    etiqueta: "Demo — test login",
    asignatura: { codigo: "DEMO", nombre: "Demo", periodo: "Test", tarea: "Prueba" },
    estudiantes: [
      { matricula: "2024-0001", nombre: "ANA PRUEBA" },
      { matricula: "2024-0002", nombre: "LUIS PRUEBA" },
    ],
    tiposActividad: [{ id: "eval-recuperacion", etiqueta: "Evaluación" }],
    ventanas: [],
    rubrica: { rondasPorEstudiante: 2, puntosPorRonda: 7.5, checksGlobales: [] },
    competencias: [],
    promptTemplate: "",
  },
];
```

> Esta entrada se borra en Task 15 (reemplazada por la de SIST-3311 real).

- [ ] **Step 4: Verificar en browser**

Refrescar `http://localhost:8788/`.

Checks:
1. Selecciona "Demo — test login" → aparece nombre + matrícula.
2. Selecciona "ANA PRUEBA", matrícula `2024-0001` → click "Entrar" → URL cambia a `#/estudiante/agenda` + aparece "Ruta pendiente".
3. Refrescar página → sesión se restaura; sigue en `#/estudiante/agenda`.
4. `localStorage.clear()` en DevTools, refrescar → vuelve al login.
5. Selecciona materia, click "🔒 Soy profesor" → ingresa `wrong` → error.
6. Repite, ingresa `2008464` → URL cambia a `#/profe/agenda`.

- [ ] **Step 5: Commit**

```bash
git add agenda-evaluaciones/index.html
git commit -m "feat: App.Auth + router base con sesión persistente"
```

---

## Task 5: `App.Student` — home + mis reservas + tipo/ventana pickers

**Files:**
- Modify: `agenda-evaluaciones/index.html`

Home estudiante: tabla "Mis reservas" + botón "Reservar nuevo". Al hacer click, abre flujo tipo → ventana (slot grid se agrega en Task 6).

- [ ] **Step 1: Agregar CSS para tarjetas de reserva y pickers**

Dentro del `<style>` existente, agregar al final antes del cierre `</style>`:

```css
/* Student home */
.stu-shell { min-height: 100vh; padding: 24px 20px; max-width: 720px; margin: 0 auto; color: white; }
.stu-shell h1 { font-size: 22px; margin-bottom: 4px; }
.stu-shell .meta { color: #CBD5E1; font-size: 13px; margin-bottom: 24px; }
.stu-section { background: white; color: var(--black); border-radius: 16px; padding: 20px 22px;
               margin-bottom: 16px; }
.stu-section h2 { font-size: 16px; color: var(--navy); margin-bottom: 12px; }

.res-row { display: flex; justify-content: space-between; align-items: center;
           padding: 12px 0; border-bottom: 1px solid #E5E7EB; }
.res-row:last-child { border-bottom: none; }
.res-title { font-weight: 600; color: var(--navy); }
.res-meta { font-size: 13px; color: var(--dgray); margin-top: 2px; }
.badge { display: inline-block; padding: 3px 10px; border-radius: 999px;
         font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.badge-reservada { background: #E0E7FF; color: #3730A3; }
.badge-en-sesion { background: #FEF3C7; color: #92400E; }
.badge-completada, .badge-evaluada { background: #DBEAFE; color: #1E40AF; }
.badge-publicada { background: #D1FAE5; color: #065F46; }

.logout-btn { float: right; background: transparent; border: 1px solid rgba(255,255,255,0.3);
              color: white; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; }
```

- [ ] **Step 2: Agregar módulo `App.Student`**

Antes de `document.addEventListener("DOMContentLoaded"...`, agregar:

```javascript
// ══════════════════════════════════════════════════════════════════
// App.Student — home, reservar, ver resultado
// ══════════════════════════════════════════════════════════════════
App.Student = (function () {
  function renderHome() {
    const cfg = App.Core.config;
    const session = App.Auth.loadSession();
    const estudiante = App.Core.findEstudiante(session.matricula);
    if (!estudiante) { App.Auth.clearSession(); App.Core.navigate("#/"); return; }

    const reservas = App.Core.reservasDeEstudiante(session.matricula)
      .sort((a, b) => (a.slotInicio || "").localeCompare(b.slotInicio || ""));

    document.getElementById("app").innerHTML = `
      <div class="stu-shell">
        <button class="logout-btn" id="stu-logout">Salir</button>
        <h1>Hola, ${App.UI.esc(estudiante.nombre.split(" ")[0])}</h1>
        <p class="meta">${App.UI.esc(cfg.asignatura.nombre)} · ${App.UI.esc(cfg.asignatura.periodo)}</p>

        <div class="stu-section">
          <h2>Mis reservas</h2>
          ${reservas.length === 0 ? `<p style="color:var(--dgray);font-size:14px">Aún no tienes reservas.</p>` :
            reservas.map(r => renderReservaRow(r, cfg)).join("")}
        </div>

        <div class="stu-section">
          <h2>Reservar nuevo slot</h2>
          <p style="color:var(--dgray);font-size:14px;margin-bottom:12px">Puedes reservar hasta 1 slot por tipo de actividad.</p>
          ${renderTiposDisponibles(cfg, reservas)}
        </div>
      </div>
    `;

    document.getElementById("stu-logout").onclick = () => {
      App.Auth.clearSession(); App.Core.navigate("#/"); location.reload();
    };
    wireTipoButtons();
    wireResultLinks();
  }

  function renderReservaRow(r, cfg) {
    const tipo = cfg.tiposActividad.find(t => t.id === r.tipoActividadId);
    const ventana = cfg.ventanas.find(v => v.id === r.ventanaId);
    const label = {
      reservada: "Pendiente de evaluar",
      "en-sesion": "En evaluación ahora",
      completada: "Calificando…",
      evaluada: "Calificando…",
      publicada: "Publicada",
    }[r.estado] || r.estado;
    const puedeVer = r.estado === "publicada";
    return `
      <div class="res-row">
        <div>
          <div class="res-title">${App.UI.esc(tipo ? tipo.etiqueta : r.tipoActividadId)}</div>
          <div class="res-meta">${App.UI.esc(ventana ? ventana.fecha : "")} · ${App.UI.esc(r.slotInicio)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="badge badge-${r.estado}">${label}</span>
          ${puedeVer ? `<button class="btn btn-ghost res-ver" data-id="${r.id}" style="padding:6px 12px;font-size:13px">Ver detalle</button>` : ""}
        </div>
      </div>
    `;
  }

  function renderTiposDisponibles(cfg, reservas) {
    const yaReservados = new Set(reservas.map(r => r.tipoActividadId));
    const libres = cfg.tiposActividad.filter(t => !yaReservados.has(t.id));
    if (libres.length === 0) return `<p style="color:var(--dgray)">Ya reservaste todos los tipos disponibles.</p>`;
    return libres.map(t => `
      <button class="btn btn-primary stu-tipo" data-id="${t.id}" style="margin:4px 6px 0 0">
        ${App.UI.esc(t.etiqueta)}
      </button>
    `).join("");
  }

  function wireTipoButtons() {
    document.querySelectorAll(".stu-tipo").forEach(b => {
      b.onclick = () => renderVentanas(b.dataset.id);
    });
  }

  function wireResultLinks() {
    document.querySelectorAll(".res-ver").forEach(b => {
      b.onclick = () => App.Core.navigate(`#/estudiante/resultado/${b.dataset.id}`);
    });
  }

  function renderVentanas(tipoId) {
    const cfg = App.Core.config;
    document.getElementById("app").innerHTML = `
      <div class="stu-shell">
        <button class="logout-btn" id="stu-back">← Volver</button>
        <h1>Escoger ventana</h1>
        <p class="meta">Tipo: ${App.UI.esc(cfg.tiposActividad.find(t => t.id === tipoId).etiqueta)}</p>

        <div class="stu-section">
          ${cfg.ventanas.length === 0
            ? `<p style="color:var(--dgray)">El profesor aún no publicó ventanas para esta tarea.</p>`
            : cfg.ventanas.map(v => `
                <div class="res-row" style="cursor:pointer" data-vid="${v.id}">
                  <div>
                    <div class="res-title">${App.UI.esc(v.fecha)} · ${App.UI.esc(v.inicio)}–${App.UI.esc(v.fin)}</div>
                    <div class="res-meta">Slots de ${v.slotMinutos} min</div>
                  </div>
                  <div style="color:var(--blue);font-weight:700">→</div>
                </div>
              `).join("")}
        </div>
      </div>
    `;
    document.getElementById("stu-back").onclick = () => App.Core.navigate("#/estudiante/agenda");
    document.querySelectorAll("[data-vid]").forEach(row => {
      row.onclick = () => App.Core.navigate(`#/estudiante/reservar/${tipoId}/${row.dataset.vid}`);
    });
  }

  return { renderHome, renderVentanas };
})();
```

- [ ] **Step 3: Extender `route` para rutas estudiante**

Reemplazar la función `route(hash)` por:

```javascript
function route(hash) {
  const session = App.Auth.loadSession();
  if (!session) {
    App.Auth.render();
    return;
  }
  if (hash === "#/" || !hash) {
    App.Core.navigate(session.rol === "profe" ? "#/profe/agenda" : "#/estudiante/agenda");
    return;
  }
  if (session.rol === "estudiante") {
    if (hash === "#/estudiante/agenda") return App.Student.renderHome();
    const vm = hash.match(/^#\/estudiante\/reservar\/([^/]+)\/([^/]+)$/);
    if (vm) return document.getElementById("app").innerHTML =
      `<div style="padding:40px;color:white">Reservar slot (Task 6): tipo ${App.UI.esc(vm[1])} en ventana ${App.UI.esc(vm[2])}</div>`;
    const rm = hash.match(/^#\/estudiante\/resultado\/([^/]+)$/);
    if (rm) return document.getElementById("app").innerHTML =
      `<div style="padding:40px;color:white">Detalle reserva (Task 7): ${App.UI.esc(rm[1])}</div>`;
  }
  if (session.rol === "profe") {
    if (hash === "#/profe/agenda") return document.getElementById("app").innerHTML =
      `<div style="padding:40px;color:white">Profe agenda (Task 8)</div>`;
  }
  document.getElementById("app").innerHTML =
    `<div style="padding:40px;color:white">Ruta pendiente: ${App.UI.esc(hash)}</div>`;
}
```

- [ ] **Step 4: Verificar en browser**

Refrescar.

Login con `2024-0001 ANA PRUEBA`:
1. Home muestra "Hola, ANA" + secciones "Mis reservas" vacía + "Reservar nuevo slot" con botón "Evaluación".
2. Click "Evaluación" → pantalla ventanas dice "El profesor aún no publicó ventanas" (esperado: CONFIGURACIONES demo tiene ventanas vacías).
3. Click "← Volver" → regresa al home.
4. Click "Salir" → vuelve al login.

- [ ] **Step 5: Commit**

```bash
git add agenda-evaluaciones/index.html
git commit -m "feat: App.Student home + tipo/ventana picker"
```

---

## Task 6: `App.Student` — slot grid + confirmación de reserva

**Files:**
- Modify: `agenda-evaluaciones/index.html`

Grid 5-min por ventana. Verde=libre, gris=tomado-otro, azul=tomado-yo. Click libre → confirm modal → PUT KV con nueva reserva.

- [ ] **Step 1: Agregar CSS para slot grid**

En el `<style>`, agregar:

```css
.slot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(68px,1fr));
             gap: 6px; margin-top: 12px; }
.slot {
  background: var(--mint); color: var(--navy); padding: 10px 0; text-align: center;
  border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 13px;
  border: 2px solid transparent; transition: transform 0.1s;
}
.slot:hover { transform: translateY(-1px); }
.slot-taken { background: #E5E7EB; color: var(--dgray); cursor: not-allowed; }
.slot-mine  { background: var(--blue); color: white; cursor: not-allowed; }
```

- [ ] **Step 2: Agregar helpers de slots y función `renderReservar`**

Dentro del IIFE `App.Student = (function(){ ... })()`, antes del `return`, agregar:

```javascript
function slotsEntre(inicio, fin, minutos) {
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fin.split(":").map(Number);
  const inicioMin = h1 * 60 + m1;
  const finMin = h2 * 60 + m2;
  const out = [];
  for (let t = inicioMin; t + minutos <= finMin; t += minutos) {
    const h = String(Math.floor(t / 60)).padStart(2, "0");
    const m = String(t % 60).padStart(2, "0");
    out.push(`${h}:${m}`);
  }
  return out;
}

async function renderReservar(tipoId, ventanaId) {
  const cfg = App.Core.config;
  const ventana = cfg.ventanas.find(v => v.id === ventanaId);
  const tipo = cfg.tiposActividad.find(t => t.id === tipoId);
  if (!ventana || !tipo) { App.Core.navigate("#/estudiante/agenda"); return; }
  const session = App.Auth.loadSession();

  await App.Core.fetchState();  // refresca antes de mostrar grid
  const ocupados = App.Core.slotsOcupados(ventanaId);
  const misReservas = App.Core.reservasDeEstudiante(session.matricula);
  const mios = new Set(misReservas.filter(r => r.ventanaId === ventanaId).map(r => r.slotInicio));

  document.getElementById("app").innerHTML = `
    <div class="stu-shell">
      <button class="logout-btn" id="stu-back">← Volver</button>
      <h1>Escoger slot</h1>
      <p class="meta">${App.UI.esc(tipo.etiqueta)} · ${App.UI.esc(ventana.fecha)} · ${App.UI.esc(ventana.inicio)}–${App.UI.esc(ventana.fin)}</p>

      <div class="stu-section">
        <div class="slot-grid" id="slot-grid"></div>
      </div>
    </div>
  `;
  const grid = document.getElementById("slot-grid");
  const slots = slotsEntre(ventana.inicio, ventana.fin, ventana.slotMinutos);
  slots.forEach(s => {
    const div = document.createElement("div");
    div.textContent = s;
    if (mios.has(s)) { div.className = "slot slot-mine"; }
    else if (ocupados.has(s)) { div.className = "slot slot-taken"; }
    else {
      div.className = "slot";
      div.onclick = () => confirmReserva(tipoId, ventanaId, s);
    }
    grid.appendChild(div);
  });

  document.getElementById("stu-back").onclick = () =>
    App.Core.navigate(`#/estudiante/agenda`);
}

async function confirmReserva(tipoId, ventanaId, slotInicio) {
  const cfg = App.Core.config;
  const tipo = cfg.tiposActividad.find(t => t.id === tipoId);
  const ventana = cfg.ventanas.find(v => v.id === ventanaId);
  const ok = await App.UI.confirm(
    `Reservar ${tipo.etiqueta} el ${ventana.fecha} a las ${slotInicio}?`
  );
  if (!ok) return;

  const session = App.Auth.loadSession();
  const id = `r-${crypto.randomUUID()}`;
  const nueva = {
    id,
    estudianteMatricula: session.matricula,
    tipoActividadId: tipoId,
    ventanaId,
    slotInicio,
    estado: "reservada",
    creadaEn: new Date().toISOString(),
  };

  try {
    await App.Core.mutate(reservas => {
      // Revalidar localmente: slot libre + cap tipo
      const ocupado = Object.values(reservas).some(r =>
        r.ventanaId === ventanaId && r.slotInicio === slotInicio);
      if (ocupado) throw new Error("Slot ya tomado");
      const yaTipo = Object.values(reservas).some(r =>
        r.estudianteMatricula === session.matricula && r.tipoActividadId === tipoId);
      if (yaTipo) throw new Error("Ya reservaste este tipo");
      reservas[id] = nueva;
      return reservas;
    });
    App.UI.toast("✓ Reservado", "success");
    App.Core.navigate("#/estudiante/agenda");
  } catch (e) {
    App.UI.toast(e.conflict ? "Otro usuario actualizó. Recargando." : (e.message || "Error"), "error");
    renderReservar(tipoId, ventanaId); // refresca grid
  }
}
```

Extender el `return` del IIFE a:

```javascript
return { renderHome, renderVentanas, renderReservar };
```

- [ ] **Step 3: Conectar la ruta en `route`**

Reemplazar, dentro de `route`, el bloque `const vm = hash.match(...);` correspondiente a `reservar`:

```javascript
    const vm = hash.match(/^#\/estudiante\/reservar\/([^/]+)\/([^/]+)$/);
    if (vm) return App.Student.renderReservar(vm[1], vm[2]);
```

- [ ] **Step 4: Agregar ventana de prueba en la config demo**

En la entrada `demo-test` de `CONFIGURACIONES`, reemplazar `ventanas: [],` por:

```javascript
    ventanas: [
      { id: "test-win", fecha: "2026-04-19", inicio: "09:00", fin: "10:00", slotMinutos: 5 },
    ],
```

- [ ] **Step 5: Verificar en browser**

Refrescar.

1. Login `ANA PRUEBA / 2024-0001` → home → Reservar → "Evaluación" → ventana → grid con 12 slots (09:00 a 09:55 cada 5 min).
2. Click `09:15` → confirm → accept → toast verde → home muestra reserva con estado "Pendiente de evaluar".
3. Intentar reservar otra vez "Evaluación" → botón oculto (cap cumplido).
4. Logout → login con `LUIS PRUEBA / 2024-0002` → Reservar → Evaluación → ventana → slot 09:15 gris "tomado-otro".
5. Verificar KV en consola del worker:

```bash
curl "http://localhost:8788/api/state?id=demo-test"
```

Esperado: `reservas` con 1 entrada tipo `reservada`.

- [ ] **Step 6: Commit**

```bash
git add agenda-evaluaciones/index.html
git commit -m "feat: App.Student slot grid + reserva con locking optimista"
```

---

## Task 7: `App.Student` — vista de resultado publicado

**Files:**
- Modify: `agenda-evaluaciones/index.html`

Detalle por ronda (competencia, pregunta, nota, observación) + checks globales + observación global + videos + nota total. Solo si `estado === "publicada"`.

- [ ] **Step 1: Agregar CSS para panel detalle**

En `<style>`:

```css
.detail-ronda { border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
.detail-ronda h3 { font-size: 14px; color: var(--navy); margin-bottom: 4px; }
.detail-nota { font-size: 22px; font-weight: 800; color: var(--blue); float: right; }
.detail-global { background: var(--gray); padding: 12px 14px; border-radius: 10px; margin-top: 8px; font-size: 13px; }
```

- [ ] **Step 2: Agregar función `renderResultado` en `App.Student`**

Dentro del IIFE `App.Student`:

```javascript
function renderResultado(reservaId) {
  const cfg = App.Core.config;
  const reserva = App.Core.state.reservas[reservaId];
  const session = App.Auth.loadSession();
  if (!reserva || reserva.estudianteMatricula !== session.matricula) {
    App.UI.toast("Reserva no encontrada", "error");
    App.Core.navigate("#/estudiante/agenda");
    return;
  }
  if (reserva.estado !== "publicada") {
    App.UI.toast("Resultado aún no publicado", "warn");
    App.Core.navigate("#/estudiante/agenda");
    return;
  }

  const tipo = cfg.tiposActividad.find(t => t.id === reserva.tipoActividadId);
  const ev = reserva.evaluacion || {};
  const rondas = ev.rondas || [];
  const checks = ev.checksGlobales || {};
  const checksDefs = cfg.rubrica.checksGlobales;

  document.getElementById("app").innerHTML = `
    <div class="stu-shell">
      <button class="logout-btn" id="stu-back">← Volver</button>
      <h1>Detalle de evaluación</h1>
      <p class="meta">${App.UI.esc(tipo.etiqueta)} · Nota total: ${ev.puntosTotales ?? "—"} / ${cfg.rubrica.rondasPorEstudiante * cfg.rubrica.puntosPorRonda}</p>

      <div class="stu-section">
        ${rondas.map((r, i) => renderRondaDetalle(r, i, cfg)).join("")}

        <div class="detail-global">
          <strong>Cumplimiento:</strong><br>
          ${checksDefs.map(c => `${checks[c.id] ? "✓" : "✗"} ${App.UI.esc(c.etiqueta)}`).join(" · ")}
        </div>

        ${ev.observacionGlobal ? `
          <div class="detail-global">
            <strong>Observación general:</strong><br>${App.UI.esc(ev.observacionGlobal)}
          </div>` : ""}

        ${(ev.videosURLs || []).length ? `
          <div class="detail-global">
            <strong>Videos:</strong><br>
            ${ev.videosURLs.map(u => `<a href="${App.UI.esc(u)}" target="_blank" rel="noopener">${App.UI.esc(u)}</a>`).join("<br>")}
          </div>` : ""}
      </div>
    </div>
  `;

  document.getElementById("stu-back").onclick = () =>
    App.Core.navigate("#/estudiante/agenda");
}

function renderRondaDetalle(r, i, cfg) {
  const comp = cfg.competencias.find(c => c.id === r.competenciaId);
  const preg = comp ? comp.preguntas.find(p => p.id === r.preguntaId) : null;
  return `
    <div class="detail-ronda">
      <span class="detail-nota">${r.puntosFinal ?? r.puntosLive ?? "—"}</span>
      <h3>Ronda ${i + 1} · ${App.UI.esc(comp ? comp.nombre : r.competenciaId)}</h3>
      <p style="font-size:13px;color:var(--dgray);margin-bottom:6px">
        ${App.UI.esc(preg ? preg.escenario : "")}
      </p>
      ${r.observacion ? `<div class="detail-global" style="margin-top:6px">${App.UI.esc(r.observacion)}</div>` : ""}
    </div>
  `;
}
```

Actualizar el `return` del IIFE:

```javascript
return { renderHome, renderVentanas, renderReservar, renderResultado };
```

- [ ] **Step 3: Conectar la ruta**

En `route`, reemplazar el bloque de resultado:

```javascript
    const rm = hash.match(/^#\/estudiante\/resultado\/([^/]+)$/);
    if (rm) return App.Student.renderResultado(rm[1]);
```

- [ ] **Step 4: Verificar en browser con datos seed**

Inyectar seed manualmente en la config KV para probar. Terminal:

```bash
curl -X PUT "http://localhost:8788/api/state?id=demo-test" \
  -H "Content-Type: application/json" \
  -d '{"version":<VERSION_ACTUAL>,"reservas":{"r-seed":{"id":"r-seed","estudianteMatricula":"2024-0001","tipoActividadId":"eval-recuperacion","ventanaId":"test-win","slotInicio":"09:20","estado":"publicada","creadaEn":"2026-04-18T10:00:00Z","evaluacion":{"rondas":[{"n":1,"competenciaId":"c1","preguntaId":"c1p1","puntosLive":6,"puntosFinal":7,"observacion":"Buen manejo"}],"checksGlobales":{},"observacionGlobal":"Correcto","videosURLs":[],"puntosTotales":7}}}}'
```

> Reemplazar `<VERSION_ACTUAL>` por el número devuelto en el último PUT (`curl GET` para consultarlo).

Refrescar browser como `ANA` → home muestra reserva publicada con botón "Ver detalle" → click → muestra nota 7 + observación "Buen manejo".

- [ ] **Step 5: Commit**

```bash
git add agenda-evaluaciones/index.html
git commit -m "feat: App.Student vista de resultado publicado"
```

---

## Task 8: `App.Teacher` — agenda cronológica + filtros

**Files:**
- Modify: `agenda-evaluaciones/index.html`

Tabla con todas las reservas ordenadas por fecha+hora. Filtros chip (estado / tipo / ventana). Acciones por fila según estado.

- [ ] **Step 1: Agregar CSS para agenda profe**

En `<style>`:

```css
.tch-shell { min-height: 100vh; padding: 24px 20px; max-width: 1100px; margin: 0 auto; color: white; }
.tch-shell h1 { font-size: 22px; margin-bottom: 4px; }
.tch-section { background: white; color: var(--black); border-radius: 16px; padding: 20px 22px; margin-bottom: 16px; }

.tch-stats { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
.tch-stat { background: rgba(255,255,255,0.1); padding: 10px 16px; border-radius: 12px; color: white; }
.tch-stat strong { font-size: 18px; display: block; }

.tch-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.chip { padding: 6px 12px; border-radius: 999px; font-size: 12px; background: #E5E7EB;
        color: var(--navy); cursor: pointer; font-weight: 600; border: 2px solid transparent; }
.chip.active { background: var(--blue); color: white; }

.tch-table { width: 100%; border-collapse: collapse; }
.tch-table th, .tch-table td { padding: 10px 8px; text-align: left; font-size: 13px;
                               border-bottom: 1px solid #E5E7EB; }
.tch-table th { color: var(--dgray); font-weight: 700; text-transform: uppercase;
                letter-spacing: 0.5px; font-size: 11px; }
.tch-action-btn { padding: 6px 10px; font-size: 12px; }
```

- [ ] **Step 2: Agregar módulo `App.Teacher`**

Antes de `document.addEventListener`:

```javascript
// ══════════════════════════════════════════════════════════════════
// App.Teacher — agenda, acciones, reportes wrapper
// ══════════════════════════════════════════════════════════════════
App.Teacher = (function () {
  const filterState = { estado: "todos", tipo: "todos", ventana: "todas" };

  async function renderAgenda() {
    await App.Core.fetchState();
    const cfg = App.Core.config;
    const reservas = Object.values(App.Core.state.reservas);
    const filtradas = applyFilters(reservas);
    const ordenadas = filtradas.sort(comparaCronologico);

    const byEstado = agruparPor(reservas, r => r.estado);
    const stats = {
      total: reservas.length,
      reservada: (byEstado.reservada || []).length,
      "en-sesion": (byEstado["en-sesion"] || []).length,
      completada: (byEstado.completada || []).length,
      evaluada: (byEstado.evaluada || []).length,
      publicada: (byEstado.publicada || []).length,
    };

    document.getElementById("app").innerHTML = `
      <div class="tch-shell">
        <button class="logout-btn" id="tch-logout">Salir</button>
        <h1>Agenda del docente</h1>
        <p style="color:#CBD5E1;font-size:13px;margin-bottom:16px">
          ${App.UI.esc(cfg.asignatura.nombre)} · ${App.UI.esc(cfg.asignatura.periodo)}
        </p>

        <div class="tch-stats">
          ${["total","reservada","en-sesion","completada","evaluada","publicada"].map(k => `
            <div class="tch-stat"><strong>${stats[k]}</strong>${k}</div>
          `).join("")}
        </div>

        <div style="display:flex;gap:10px;margin-bottom:12px">
          <button class="btn btn-primary" id="tch-publicar-bulk">📢 Publicar todas evaluadas</button>
          <button class="btn btn-ghost" id="tch-reportes">Reportes</button>
        </div>

        <div class="tch-section">
          ${renderFilters(cfg)}
          <table class="tch-table">
            <thead>
              <tr><th>Fecha/Hora</th><th>Estudiante</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody id="tch-tbody">
              ${ordenadas.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:var(--dgray);padding:24px">Sin reservas con estos filtros.</td></tr>` :
                ordenadas.map(r => renderRow(r, cfg)).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    wireFilters();
    wireRowActions();
    document.getElementById("tch-logout").onclick = () => {
      App.Auth.clearSession(); App.Core.navigate("#/"); location.reload();
    };
    document.getElementById("tch-publicar-bulk").onclick = () => publicarBulk();
    document.getElementById("tch-reportes").onclick = () => App.Core.navigate("#/profe/reportes");
  }

  function renderFilters(cfg) {
    const chip = (group, value, label) =>
      `<span class="chip ${filterState[group] === value ? "active" : ""}" data-group="${group}" data-value="${value}">${App.UI.esc(label)}</span>`;
    return `
      <div class="tch-filters">
        <strong style="font-size:12px;color:var(--dgray);align-self:center">Estado:</strong>
        ${chip("estado","todos","todos")}
        ${["reservada","en-sesion","completada","evaluada","publicada"].map(s => chip("estado",s,s)).join("")}
      </div>
      <div class="tch-filters">
        <strong style="font-size:12px;color:var(--dgray);align-self:center">Tipo:</strong>
        ${chip("tipo","todos","todos")}
        ${cfg.tiposActividad.map(t => chip("tipo",t.id,t.etiqueta)).join("")}
      </div>
      <div class="tch-filters">
        <strong style="font-size:12px;color:var(--dgray);align-self:center">Ventana:</strong>
        ${chip("ventana","todas","todas")}
        ${cfg.ventanas.map(v => chip("ventana",v.id,`${v.fecha} ${v.inicio}`)).join("")}
      </div>
    `;
  }

  function wireFilters() {
    document.querySelectorAll(".chip").forEach(c => {
      c.onclick = () => {
        filterState[c.dataset.group] = c.dataset.value;
        renderAgenda();
      };
    });
  }

  function renderRow(r, cfg) {
    const est = cfg.estudiantes.find(e => e.matricula === r.estudianteMatricula);
    const tipo = cfg.tiposActividad.find(t => t.id === r.tipoActividadId);
    const ventana = cfg.ventanas.find(v => v.id === r.ventanaId);
    return `
      <tr>
        <td>${App.UI.esc(ventana ? ventana.fecha : "")} ${App.UI.esc(r.slotInicio)}</td>
        <td>${App.UI.esc(est ? est.nombre : r.estudianteMatricula)}</td>
        <td>${App.UI.esc(tipo ? tipo.etiqueta : r.tipoActividadId)}</td>
        <td><span class="badge badge-${r.estado}">${r.estado}</span></td>
        <td>${renderActions(r)}</td>
      </tr>
    `;
  }

  function renderActions(r) {
    const btn = (label, action, cls = "btn-primary") =>
      `<button class="btn ${cls} tch-action-btn" data-action="${action}" data-id="${r.id}">${label}</button>`;
    switch (r.estado) {
      case "reservada":  return btn("Iniciar eval", "start");
      case "en-sesion":  return btn("Continuar", "start");
      case "completada": return btn("Procesar", "process");
      case "evaluada":
        return btn("Procesar", "process", "btn-ghost") + " " + btn("📢 Publicar", "publish", "btn-success");
      case "publicada":
        return btn("Ver", "process", "btn-ghost") + " " + btn("🔒 Despublicar", "unpublish", "btn-danger");
      default: return "";
    }
  }

  function wireRowActions() {
    document.querySelectorAll(".tch-action-btn").forEach(b => {
      b.onclick = () => handleAction(b.dataset.action, b.dataset.id);
    });
  }

  async function handleAction(action, id) {
    if (action === "start") { App.Core.navigate(`#/profe/eval/${id}`); return; }
    if (action === "process") { App.Core.navigate(`#/profe/proceso/${id}`); return; }
    if (action === "publish") { await setEstado(id, "publicada", { publicadaEn: new Date().toISOString() }); return; }
    if (action === "unpublish") { await setEstado(id, "evaluada", { publicadaEn: null }); return; }
  }

  async function setEstado(id, nuevo, extraEval = {}) {
    try {
      await App.Core.mutate(reservas => {
        const r = reservas[id];
        if (!r) return reservas;
        r.estado = nuevo;
        if (Object.keys(extraEval).length) {
          r.evaluacion = { ...(r.evaluacion || {}), ...extraEval };
        }
        return reservas;
      });
      App.UI.toast("Estado actualizado", "success");
      renderAgenda();
    } catch (e) {
      App.UI.toast(e.message || "Error", "error");
    }
  }

  async function publicarBulk() {
    const ok = await App.UI.confirm("Publicar TODAS las reservas en estado 'evaluada'?");
    if (!ok) return;
    try {
      await App.Core.mutate(reservas => {
        const when = new Date().toISOString();
        for (const r of Object.values(reservas)) {
          if (r.estado === "evaluada") {
            r.estado = "publicada";
            r.evaluacion = { ...(r.evaluacion || {}), publicadaEn: when };
          }
        }
        return reservas;
      });
      App.UI.toast("Publicación masiva completada", "success");
      renderAgenda();
    } catch (e) {
      App.UI.toast(e.message || "Error", "error");
    }
  }

  function applyFilters(rs) {
    return rs.filter(r =>
      (filterState.estado === "todos" || r.estado === filterState.estado) &&
      (filterState.tipo === "todos"   || r.tipoActividadId === filterState.tipo) &&
      (filterState.ventana === "todas"|| r.ventanaId === filterState.ventana)
    );
  }

  function comparaCronologico(a, b) {
    const cfg = App.Core.config;
    const va = cfg.ventanas.find(v => v.id === a.ventanaId);
    const vb = cfg.ventanas.find(v => v.id === b.ventanaId);
    const fa = (va ? va.fecha : "") + " " + (a.slotInicio || "");
    const fb = (vb ? vb.fecha : "") + " " + (b.slotInicio || "");
    return fa.localeCompare(fb);
  }

  function agruparPor(arr, keyFn) {
    return arr.reduce((acc, x) => { const k = keyFn(x); (acc[k] ||= []).push(x); return acc; }, {});
  }

  return { renderAgenda, setEstado };
})();
```

- [ ] **Step 3: Conectar ruta `#/profe/agenda`**

En `route`, reemplazar el placeholder:

```javascript
    if (hash === "#/profe/agenda") return App.Teacher.renderAgenda();
```

- [ ] **Step 4: Verificar**

Refrescar. Login como profe (cualquier materia + contraseña `2008464`).

1. Agenda muestra reserva seed (`ANA` a las 09:20, tipo Evaluación, estado `publicada`).
2. Chips filtran al click (estado `publicada` → 1 fila; `reservada` → 0 si solo está el seed).
3. Click "🔒 Despublicar" en la fila publicada → confirm → badge cambia a `evaluada` → botón se convierte en "📢 Publicar".
4. Click "📢 Publicar" → vuelve a `publicada`.
5. Click "📢 Publicar todas evaluadas" sin filas `evaluada` → sale del confirm → sin cambios.
6. Botón "Salir" → vuelve al login.

- [ ] **Step 5: Commit**

```bash
git add agenda-evaluaciones/index.html
git commit -m "feat: App.Teacher agenda cronológica + filtros + publicar toggle"
```

---

## Task 9: `App.Roulette` — canvas 2-niveles

**Files:**
- Modify: `agenda-evaluaciones/index.html`

Componente reutilizable: `App.Roulette.spin({ canvas, items, onWinner })`. Animación inercia suave. Se usa dos veces en la eval (competencia, luego pregunta).

- [ ] **Step 1: Agregar módulo `App.Roulette`**

Antes de `document.addEventListener`:

```javascript
// ══════════════════════════════════════════════════════════════════
// App.Roulette — rueda canvas genérica
// items: [{ id, label, color? }]
// onWinner(item) se llama al parar
// ══════════════════════════════════════════════════════════════════
App.Roulette = (function () {
  const PALETTE = ["#2D5BE3","#00D4A0","#F59E0B","#FF5C6A","#8B5CF6","#14B8A6","#EC4899","#3B82F6","#10B981","#F97316"];

  function draw(canvas, items, angle) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 10;
    ctx.clearRect(0, 0, w, h);
    if (items.length === 0) return;
    const slice = (2 * Math.PI) / items.length;
    items.forEach((it, i) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle + i * slice, angle + (i + 1) * slice);
      ctx.closePath();
      ctx.fillStyle = it.color || PALETTE[i % PALETTE.length];
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();

      // label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle + i * slice + slice / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "white";
      ctx.font = "bold 13px system-ui";
      const label = (it.label || "").slice(0, 22);
      ctx.fillText(label, r - 14, 4);
      ctx.restore();
    });
    // pointer
    ctx.beginPath();
    ctx.moveTo(cx, cy - r - 6);
    ctx.lineTo(cx - 10, cy - r + 10);
    ctx.lineTo(cx + 10, cy - r + 10);
    ctx.closePath();
    ctx.fillStyle = "#1F2937";
    ctx.fill();
  }

  function spin({ canvas, items, onWinner }) {
    if (items.length === 0) { onWinner(null); return; }
    const slice = (2 * Math.PI) / items.length;
    const winnerIdx = Math.floor(Math.random() * items.length);
    // ángulo final: pointer arriba (=-PI/2). queremos que centro de winner quede debajo del pointer
    const totalSpins = 5 + Math.random() * 2; // 5-7 vueltas
    const targetAngle = (-Math.PI / 2) - (winnerIdx * slice + slice / 2) - totalSpins * 2 * Math.PI;
    const durationMs = 3500;
    const start = performance.now();
    const startAngle = 0;

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function frame(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const angle = startAngle + (targetAngle - startAngle) * easeOut(t);
      draw(canvas, items, angle);
      if (t < 1) requestAnimationFrame(frame);
      else onWinner(items[winnerIdx]);
    }
    requestAnimationFrame(frame);
  }

  return { draw, spin };
})();
```

- [ ] **Step 2: Mini test harness (temporal)**

Agregar ruta temporal para probar aislado. En `route`, justo antes del fallback final:

```javascript
  if (hash === "#/test-roulette") {
    document.getElementById("app").innerHTML = `
      <div style="padding:24px;color:white">
        <canvas id="rt" width="360" height="360" style="background:white;border-radius:50%"></canvas>
        <br><button class="btn btn-primary" id="rt-spin">Girar</button>
        <div id="rt-out" style="margin-top:12px"></div>
      </div>`;
    const items = [
      { id: "a", label: "Alpha" }, { id: "b", label: "Beta" },
      { id: "c", label: "Gamma" }, { id: "d", label: "Delta" },
      { id: "e", label: "Epsilon" },
    ];
    const canvas = document.getElementById("rt");
    App.Roulette.draw(canvas, items, 0);
    document.getElementById("rt-spin").onclick = () => {
      App.Roulette.spin({
        canvas, items,
        onWinner: (w) => document.getElementById("rt-out").textContent = "Ganó: " + (w ? w.label : "—"),
      });
    };
    return;
  }
```

- [ ] **Step 3: Verificar animación**

Login como profe, navegar manualmente a `http://localhost:8788/#/test-roulette`. Esperado: rueda dibujada con 5 sectores. Click "Girar" → anima 3.5s → para en sector aleatorio → texto "Ganó: Alpha" (o similar).

Reload y re-girar varias veces → distribución aleatoria.

- [ ] **Step 4: Eliminar el test harness**

Quitar el bloque `if (hash === "#/test-roulette") { ... }` de `route`.

- [ ] **Step 5: Commit**

```bash
git add agenda-evaluaciones/index.html
git commit -m "feat: App.Roulette canvas genérico con animación de inercia"
```

---

## Task 10: `App.Eval` — panel evaluación live

**Files:**
- Modify: `agenda-evaluaciones/index.html`

Panel full-screen para el profesor durante la videollamada. Rondas verticales con ruleta integrada + nota slider + observación + checks globales. Estado pasa de `reservada`/`en-sesion` a `completada` al cerrar.

- [ ] **Step 1: Agregar CSS eval panel**

En `<style>`:

```css
.eval-shell { min-height: 100vh; padding: 20px; max-width: 960px; margin: 0 auto; color: white; }
.eval-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.eval-countdown { font-size: 20px; font-weight: 800; color: var(--amber); }
.eval-checks { background: white; color: var(--black); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; display: flex; gap: 16px; flex-wrap: wrap; }
.eval-checks label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
                     color: var(--navy); font-size: 13px; font-weight: 600; text-transform: none;
                     letter-spacing: normal; }
.eval-ronda { background: white; color: var(--black); border-radius: 14px; padding: 18px; margin-bottom: 12px; }
.eval-ronda h3 { font-size: 16px; color: var(--navy); margin-bottom: 8px; }
.eval-canvas { display: block; margin: 12px auto; background: white; border-radius: 50%; }
.eval-ronda-locked { opacity: 0.45; pointer-events: none; }
.eval-nota-display { font-size: 28px; font-weight: 800; color: var(--blue); text-align: center; margin: 10px 0; }
.eval-obs { width: 100%; min-height: 60px; resize: vertical; }
.eval-winner { font-size: 14px; color: var(--navy); background: var(--gray); padding: 8px 12px; border-radius: 8px; margin: 6px 0; }
```

- [ ] **Step 2: Agregar módulo `App.Eval`**

Antes de `document.addEventListener`:

```javascript
// ══════════════════════════════════════════════════════════════════
// App.Eval — evaluación live (en-sesion) + post-sesión (procesar)
// ══════════════════════════════════════════════════════════════════
App.Eval = (function () {
  let debounceSaveTimer = null;

  async function renderLive(reservaId) {
    await App.Core.fetchState();
    const cfg = App.Core.config;
    const reserva = App.Core.state.reservas[reservaId];
    if (!reserva) { App.UI.toast("Reserva no existe", "error"); App.Core.navigate("#/profe/agenda"); return; }

    // Inicializar evaluación si no existe
    if (!reserva.evaluacion) {
      reserva.evaluacion = {
        rondas: [],
        checksGlobales: {},
        observacionGlobal: "",
        videosURLs: [],
        puntosTotales: 0,
      };
    }
    if (reserva.estado === "reservada") {
      await App.Teacher.setEstado(reservaId, "en-sesion");
      return renderLive(reservaId);
    }

    const est = cfg.estudiantes.find(e => e.matricula === reserva.estudianteMatricula);
    const tipo = cfg.tiposActividad.find(t => t.id === reserva.tipoActividadId);
    const rondasTotales = cfg.rubrica.rondasPorEstudiante;
    const ev = reserva.evaluacion;

    document.getElementById("app").innerHTML = `
      <div class="eval-shell">
        <div class="eval-header">
          <div>
            <h1 style="font-size:22px">${App.UI.esc(est ? est.nombre : "")}</h1>
            <p style="color:#CBD5E1;font-size:13px">${App.UI.esc(tipo ? tipo.etiqueta : "")}</p>
          </div>
          <div>
            <span class="eval-countdown" id="eval-countdown">05:00</span>
            <button class="btn btn-ghost" id="eval-back" style="margin-left:8px">← Volver</button>
          </div>
        </div>

        <div class="eval-checks">
          <strong style="color:var(--navy)">Cumplimiento:</strong>
          ${cfg.rubrica.checksGlobales.map(c => `
            <label>
              <input type="checkbox" data-check="${c.id}" ${ev.checksGlobales[c.id] ? "checked" : ""}/>
              ${App.UI.esc(c.etiqueta)}
            </label>
          `).join("")}
        </div>

        <div id="eval-rondas"></div>

        <div style="background:white;color:var(--black);border-radius:14px;padding:18px">
          <label>Observación global (opcional)</label>
          <textarea id="eval-obs-global" class="eval-obs">${App.UI.esc(ev.observacionGlobal || "")}</textarea>
        </div>

        <div style="margin-top:16px">
          <button class="btn btn-success" id="eval-finalizar">Finalizar sesión</button>
        </div>
      </div>
    `;

    renderRondasArea(reserva, cfg);
    wireChecks(reserva);
    wireObsGlobal(reserva);
    startCountdown();

    document.getElementById("eval-back").onclick = () => App.Core.navigate("#/profe/agenda");
    document.getElementById("eval-finalizar").onclick = () => finalizarSesion(reservaId);
  }

  function renderRondasArea(reserva, cfg) {
    const host = document.getElementById("eval-rondas");
    const total = cfg.rubrica.rondasPorEstudiante;
    const rondas = reserva.evaluacion.rondas;

    let html = "";
    for (let i = 0; i < total; i++) {
      const prev = rondas[i - 1];
      const locked = i > 0 && (!prev || prev.puntosLive == null);
      const cur = rondas[i];
      html += `<div class="eval-ronda ${locked ? "eval-ronda-locked" : ""}" data-idx="${i}">
        <h3>Ronda ${i + 1} / ${total}</h3>
        ${renderRondaInner(i, cur, reserva, cfg)}
      </div>`;
    }
    host.innerHTML = html;
    wireRondas(reserva, cfg);
  }

  function renderRondaInner(idx, cur, reserva, cfg) {
    if (!cur || !cur.competenciaId) {
      return `
        <p style="color:var(--dgray);font-size:13px">Gira para elegir competencia (sin repetir dentro del estudiante).</p>
        <canvas class="eval-canvas" width="300" height="300" id="eval-canvas-c-${idx}"></canvas>
        <div style="text-align:center"><button class="btn btn-primary eval-gira-comp" data-idx="${idx}">🎰 Girar competencia</button></div>
      `;
    }
    const comp = cfg.competencias.find(c => c.id === cur.competenciaId);
    if (!cur.preguntaId) {
      return `
        <div class="eval-winner"><strong>Competencia:</strong> ${App.UI.esc(comp ? comp.nombre : cur.competenciaId)}</div>
        <canvas class="eval-canvas" width="300" height="300" id="eval-canvas-p-${idx}"></canvas>
        <div style="text-align:center"><button class="btn btn-primary eval-gira-preg" data-idx="${idx}">🎰 Girar pregunta</button></div>
      `;
    }
    const preg = comp ? comp.preguntas.find(p => p.id === cur.preguntaId) : null;
    const max = cfg.rubrica.puntosPorRonda;
    return `
      <div class="eval-winner"><strong>Competencia:</strong> ${App.UI.esc(comp.nombre)}</div>
      <div class="eval-winner"><strong>Pregunta:</strong> ${App.UI.esc(preg ? preg.preguntaGuia : "")}<br>
        <small>${App.UI.esc(preg ? preg.escenario : "")}</small></div>
      <div class="eval-nota-display" id="eval-nota-display-${idx}">${(cur.puntosLive ?? 0).toFixed(1)} / ${max}</div>
      <input type="range" min="0" max="${max}" step="0.5" value="${cur.puntosLive ?? 0}" data-idx="${idx}" class="eval-slider"/>
      <label style="margin-top:10px">Observación rápida</label>
      <textarea class="eval-obs eval-obs-ronda" data-idx="${idx}">${App.UI.esc(cur.observacion || "")}</textarea>
    `;
  }

  function wireRondas(reserva, cfg) {
    // Girar competencia
    document.querySelectorAll(".eval-gira-comp").forEach(b => {
      b.onclick = () => {
        const idx = Number(b.dataset.idx);
        const yaGiradas = new Set(reserva.evaluacion.rondas.map(r => r.competenciaId).filter(Boolean));
        const disponibles = cfg.competencias.filter(c => !yaGiradas.has(c.id));
        if (disponibles.length === 0) { App.UI.toast("No quedan competencias", "warn"); return; }
        const items = disponibles.map(c => ({ id: c.id, label: c.nombre }));
        const canvas = document.getElementById(`eval-canvas-c-${idx}`);
        App.Roulette.spin({
          canvas, items,
          onWinner: async (w) => {
            if (!w) return;
            await App.Core.mutate(reservas => {
              const r = reservas[reserva.id];
              r.evaluacion.rondas[idx] = { n: idx + 1, competenciaId: w.id, preguntaId: null, puntosLive: null, observacion: "" };
              return reservas;
            });
            reserva = App.Core.state.reservas[reserva.id];
            renderRondasArea(reserva, cfg);
          },
        });
      };
    });

    // Girar pregunta
    document.querySelectorAll(".eval-gira-preg").forEach(b => {
      b.onclick = () => {
        const idx = Number(b.dataset.idx);
        const ronda = reserva.evaluacion.rondas[idx];
        const comp = cfg.competencias.find(c => c.id === ronda.competenciaId);
        const items = comp.preguntas.map(p => ({ id: p.id, label: p.preguntaGuia.slice(0, 30) }));
        const canvas = document.getElementById(`eval-canvas-p-${idx}`);
        App.Roulette.spin({
          canvas, items,
          onWinner: async (w) => {
            if (!w) return;
            await App.Core.mutate(reservas => {
              const r = reservas[reserva.id];
              r.evaluacion.rondas[idx].preguntaId = w.id;
              return reservas;
            });
            reserva = App.Core.state.reservas[reserva.id];
            renderRondasArea(reserva, cfg);
          },
        });
      };
    });

    // Slider de nota — auto-save debounce
    document.querySelectorAll(".eval-slider").forEach(sl => {
      sl.oninput = () => {
        const idx = Number(sl.dataset.idx);
        const v = Number(sl.value);
        document.getElementById(`eval-nota-display-${idx}`).textContent = `${v.toFixed(1)} / ${cfg.rubrica.puntosPorRonda}`;
        debounce(async () => {
          await App.Core.mutate(reservas => {
            reservas[reserva.id].evaluacion.rondas[idx].puntosLive = v;
            return reservas;
          });
          reserva = App.Core.state.reservas[reserva.id];
          // re-render si destraba la siguiente ronda y aún no está visible
          if (idx + 1 < cfg.rubrica.rondasPorEstudiante &&
              !reserva.evaluacion.rondas[idx + 1]) {
            renderRondasArea(reserva, cfg);
          }
        }, 400);
      };
    });

    // Observación ronda
    document.querySelectorAll(".eval-obs-ronda").forEach(ta => {
      ta.onblur = async () => {
        const idx = Number(ta.dataset.idx);
        await App.Core.mutate(reservas => {
          reservas[reserva.id].evaluacion.rondas[idx].observacion = ta.value;
          return reservas;
        });
      };
    });
  }

  function wireChecks(reserva) {
    document.querySelectorAll("[data-check]").forEach(cb => {
      cb.onchange = async () => {
        await App.Core.mutate(reservas => {
          reservas[reserva.id].evaluacion.checksGlobales[cb.dataset.check] = cb.checked;
          return reservas;
        });
      };
    });
  }

  function wireObsGlobal(reserva) {
    const ta = document.getElementById("eval-obs-global");
    ta.onblur = async () => {
      await App.Core.mutate(reservas => {
        reservas[reserva.id].evaluacion.observacionGlobal = ta.value;
        return reservas;
      });
    };
  }

  function startCountdown() {
    let remain = 5 * 60;
    const el = document.getElementById("eval-countdown");
    if (!el) return;
    clearInterval(startCountdown._iv);
    startCountdown._iv = setInterval(() => {
      remain = Math.max(0, remain - 1);
      const m = String(Math.floor(remain / 60)).padStart(2, "0");
      const s = String(remain % 60).padStart(2, "0");
      const node = document.getElementById("eval-countdown");
      if (!node) { clearInterval(startCountdown._iv); return; }
      node.textContent = `${m}:${s}`;
    }, 1000);
  }

  async function finalizarSesion(reservaId) {
    const ok = await App.UI.confirm("Finalizar sesión? (queda como completada, se puede procesar después)");
    if (!ok) return;
    const cfg = App.Core.config;
    await App.Core.mutate(reservas => {
      const r = reservas[reservaId];
      const totalMax = cfg.rubrica.rondasPorEstudiante * cfg.rubrica.puntosPorRonda;
      r.evaluacion.puntosTotales = (r.evaluacion.rondas || [])
        .reduce((acc, ro) => acc + (ro.puntosLive || 0), 0);
      r.evaluacion.puntosTotales = Math.min(r.evaluacion.puntosTotales, totalMax);
      r.estado = "completada";
      return reservas;
    });
    App.UI.toast("Sesión finalizada", "success");
    App.Core.navigate("#/profe/agenda");
  }

  function debounce(fn, ms) {
    clearTimeout(debounceSaveTimer);
    debounceSaveTimer = setTimeout(fn, ms);
  }

  return { renderLive };
})();
```

- [ ] **Step 3: Conectar ruta `#/profe/eval/:id`**

En `route`, reemplazar el placeholder de profe agregando tras `#/profe/agenda`:

```javascript
    const em = hash.match(/^#\/profe\/eval\/([^/]+)$/);
    if (em) return App.Eval.renderLive(em[1]);
```

- [ ] **Step 4: Agregar competencias y preguntas de prueba en config demo**

En la entrada `demo-test`, reemplazar `competencias: [],` por:

```javascript
    competencias: [
      { id: "c1", nombre: "C1 Demo", preguntas: [
        { id: "c1p1", escenario: "Escenario X", preguntaGuia: "Explica X" },
        { id: "c1p2", escenario: "Escenario Y", preguntaGuia: "Aplica Y" },
      ]},
      { id: "c2", nombre: "C2 Demo", preguntas: [
        { id: "c2p1", escenario: "Escenario A", preguntaGuia: "Explica A" },
      ]},
      { id: "c3", nombre: "C3 Demo", preguntas: [
        { id: "c3p1", escenario: "Escenario B", preguntaGuia: "Aplica B" },
      ]},
    ],
```

Y `rubrica.checksGlobales: []` por:

```javascript
    rubrica: {
      rondasPorEstudiante: 2,
      puntosPorRonda: 7.5,
      checksGlobales: [
        { id: "camara-on", etiqueta: "Cámara" },
        { id: "sin-consultas", etiqueta: "Sin consultas" },
      ],
    },
```

- [ ] **Step 5: Verificar**

Refrescar.

1. Como estudiante `LUIS` (si no lo hizo antes), reservar tipo Evaluación en un slot libre (ej. 09:25). Logout.
2. Como profe, agenda muestra la reserva de LUIS en `reservada`. Click "Iniciar eval" → estado cambia → pantalla eval aparece con countdown 5 min + checks + 2 rondas.
3. Girar competencia ronda 1 → animación → queda una competencia elegida. Click Girar pregunta → elige.
4. Slider nota → 6 → nota auto-save. Ronda 2 se desbloquea.
5. Girar competencia ronda 2 → **verifica** que la C elegida en ronda 1 NO aparece en el sector (sectores reducidos).
6. Girar pregunta ronda 2 → slider → 5.
7. Check "Cámara" → refrescar página → check persiste.
8. Click "Finalizar sesión" → confirm → volver a agenda. Estado de LUIS = `completada`, puntosTotales = 11.0.

- [ ] **Step 6: Commit**

```bash
git add agenda-evaluaciones/index.html
git commit -m "feat: App.Eval panel live con ruleta 2 niveles y auto-save"
```

---

## Task 11: `App.Prompt` + panel post-sesión (procesar)

**Files:**
- Modify: `agenda-evaluaciones/index.html`

Panel `#/profe/proceso/:id`: por cada ronda de `reserva.evaluacion.rondas`, muestra contexto + textarea transcripción + botón Copiar Prompt + textarea observación final + input nota final. Al guardar, estado pasa a `evaluada`.

- [ ] **Step 1: Agregar módulo `App.Prompt`**

Antes de `App.Eval`:

```javascript
// ══════════════════════════════════════════════════════════════════
// App.Prompt — genera prompt con template filler
// ══════════════════════════════════════════════════════════════════
App.Prompt = (function () {
  function build(ronda, reserva, cfg) {
    const comp = cfg.competencias.find(c => c.id === ronda.competenciaId);
    const preg = comp ? comp.preguntas.find(p => p.id === ronda.preguntaId) : null;
    const tpl = cfg.promptTemplate || defaultTemplate();
    return fillTemplate(tpl, {
      competencia: comp ? comp.nombre : "",
      pregunta: preg ? preg.preguntaGuia : "",
      escenario: preg ? preg.escenario : "",
      rubrica: `Máximo ${cfg.rubrica.puntosPorRonda} pts. Criterios: camara encendida, fluidez, comprensión, aplicación al escenario.`,
      transcripcion: ronda.transcripcion || "[PEGAR TRANSCRIPCIÓN AQUÍ]",
    });
  }

  function fillTemplate(tpl, vars) {
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
  }

  function defaultTemplate() {
    return `Eres evaluador de la materia. Analiza esta respuesta contra la rúbrica.

Competencia: {{competencia}}
Pregunta: {{pregunta}}
Escenario: {{escenario}}
Rúbrica: {{rubrica}}

Transcripción de la respuesta del estudiante:
{{transcripcion}}

Devuelve:
1. Observación crítica (qué estuvo bien / qué faltó) en 3-4 oraciones.
2. Nota sugerida entre 0 y 7.5.`;
  }

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { return false; }
  }

  return { build, copyToClipboard };
})();
```

- [ ] **Step 2: Agregar `App.Eval.renderProceso`**

Dentro del IIFE `App.Eval`, antes del `return`:

```javascript
async function renderProceso(reservaId) {
  await App.Core.fetchState();
  const cfg = App.Core.config;
  const reserva = App.Core.state.reservas[reservaId];
  if (!reserva || !reserva.evaluacion) {
    App.UI.toast("Reserva sin evaluación previa", "error");
    App.Core.navigate("#/profe/agenda");
    return;
  }
  const est = cfg.estudiantes.find(e => e.matricula === reserva.estudianteMatricula);
  const ev = reserva.evaluacion;
  const totalMax = cfg.rubrica.rondasPorEstudiante * cfg.rubrica.puntosPorRonda;

  document.getElementById("app").innerHTML = `
    <div class="eval-shell">
      <div class="eval-header">
        <div>
          <h1 style="font-size:22px">Procesar evaluación</h1>
          <p style="color:#CBD5E1;font-size:13px">${App.UI.esc(est ? est.nombre : "")}</p>
        </div>
        <button class="btn btn-ghost" id="proc-back">← Volver</button>
      </div>

      <div id="proc-rondas"></div>

      <div style="background:white;color:var(--black);border-radius:14px;padding:18px;margin-bottom:12px">
        <label>Videos (URLs, 1 por línea)</label>
        <textarea id="proc-videos" class="eval-obs" style="min-height:50px">${App.UI.esc((ev.videosURLs || []).join("\n"))}</textarea>

        <label style="margin-top:10px">Observación global</label>
        <textarea id="proc-obs-global" class="eval-obs">${App.UI.esc(ev.observacionGlobal || "")}</textarea>

        <p style="margin-top:12px"><strong>Nota total:</strong> <span id="proc-total">${(ev.puntosTotales || 0).toFixed(1)}</span> / ${totalMax}</p>
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" id="proc-guardar">Guardar (evaluada)</button>
        <button class="btn btn-success" id="proc-publicar">Guardar y publicar</button>
      </div>
    </div>
  `;

  renderProcesoRondas(reserva, cfg);

  document.getElementById("proc-back").onclick = () => App.Core.navigate("#/profe/agenda");
  document.getElementById("proc-guardar").onclick = () => guardarProceso(reservaId, "evaluada");
  document.getElementById("proc-publicar").onclick = () => guardarProceso(reservaId, "publicada");

  document.getElementById("proc-videos").onblur = async () => {
    const urls = document.getElementById("proc-videos").value
      .split("\n").map(s => s.trim()).filter(Boolean);
    await App.Core.mutate(r => { r[reservaId].evaluacion.videosURLs = urls; return r; });
  };
  document.getElementById("proc-obs-global").onblur = async () => {
    const v = document.getElementById("proc-obs-global").value;
    await App.Core.mutate(r => { r[reservaId].evaluacion.observacionGlobal = v; return r; });
  };
}

function renderProcesoRondas(reserva, cfg) {
  const host = document.getElementById("proc-rondas");
  host.innerHTML = reserva.evaluacion.rondas.map((r, i) => {
    const comp = cfg.competencias.find(c => c.id === r.competenciaId);
    const preg = comp ? comp.preguntas.find(p => p.id === r.preguntaId) : null;
    const max = cfg.rubrica.puntosPorRonda;
    return `
      <div class="eval-ronda">
        <h3>Ronda ${i + 1} · ${App.UI.esc(comp ? comp.nombre : r.competenciaId)}</h3>
        <p style="font-size:13px;color:var(--dgray);margin-bottom:6px">${App.UI.esc(preg ? preg.preguntaGuia : "")}</p>

        <label>Transcripción (pegar)</label>
        <textarea class="eval-obs proc-transcripcion" data-idx="${i}" style="min-height:90px">${App.UI.esc(r.transcripcion || "")}</textarea>

        <div style="margin-top:8px"><button class="btn btn-ghost proc-copy" data-idx="${i}" style="padding:8px 14px;font-size:13px">📋 Copiar prompt para IA</button></div>

        <label style="margin-top:12px">Observación final (pegar respuesta IA editada)</label>
        <textarea class="eval-obs proc-obs" data-idx="${i}" style="min-height:70px">${App.UI.esc(r.observacion || "")}</textarea>

        <label style="margin-top:10px">Nota final</label>
        <input type="number" min="0" max="${max}" step="0.5" value="${r.puntosFinal ?? r.puntosLive ?? 0}" class="proc-nota" data-idx="${i}"/>
      </div>
    `;
  }).join("");

  host.querySelectorAll(".proc-transcripcion").forEach(ta => {
    ta.onblur = async () => {
      const idx = Number(ta.dataset.idx);
      await App.Core.mutate(res => {
        res[reserva.id].evaluacion.rondas[idx].transcripcion = ta.value;
        return res;
      });
    };
  });

  host.querySelectorAll(".proc-obs").forEach(ta => {
    ta.onblur = async () => {
      const idx = Number(ta.dataset.idx);
      await App.Core.mutate(res => {
        res[reserva.id].evaluacion.rondas[idx].observacion = ta.value;
        return res;
      });
    };
  });

  host.querySelectorAll(".proc-nota").forEach(inp => {
    inp.onchange = async () => {
      const idx = Number(inp.dataset.idx);
      const v = Number(inp.value);
      const max = cfg.rubrica.puntosPorRonda;
      const clamped = Math.max(0, Math.min(max, v));
      inp.value = clamped;
      await App.Core.mutate(res => {
        res[reserva.id].evaluacion.rondas[idx].puntosFinal = clamped;
        return res;
      });
      actualizarTotal(reserva.id, cfg);
    };
  });

  host.querySelectorAll(".proc-copy").forEach(b => {
    b.onclick = async () => {
      const idx = Number(b.dataset.idx);
      const prompt = App.Prompt.build(reserva.evaluacion.rondas[idx], reserva, cfg);
      const ok = await App.Prompt.copyToClipboard(prompt);
      App.UI.toast(ok ? "Prompt copiado. Pegar en ChatGPT/Claude" : "No se pudo copiar — selecciona y copia manual", ok ? "success" : "warn");
    };
  });
}

async function actualizarTotal(id, cfg) {
  await App.Core.mutate(r => {
    const rondas = r[id].evaluacion.rondas || [];
    r[id].evaluacion.puntosTotales = rondas
      .reduce((acc, ro) => acc + (ro.puntosFinal ?? ro.puntosLive ?? 0), 0);
    return r;
  });
  const disp = document.getElementById("proc-total");
  if (disp) disp.textContent = (App.Core.state.reservas[id].evaluacion.puntosTotales || 0).toFixed(1);
}

async function guardarProceso(id, destino) {
  await App.Core.mutate(r => {
    r[id].estado = destino;
    if (destino === "publicada") r[id].evaluacion.publicadaEn = new Date().toISOString();
    return r;
  });
  App.UI.toast(destino === "publicada" ? "Publicado" : "Guardado", "success");
  App.Core.navigate("#/profe/agenda");
}
```

Actualizar `return` del IIFE a:

```javascript
return { renderLive, renderProceso };
```

- [ ] **Step 3: Conectar ruta `#/profe/proceso/:id`**

En `route`, después del match de `eval`:

```javascript
    const pm = hash.match(/^#\/profe\/proceso\/([^/]+)$/);
    if (pm) return App.Eval.renderProceso(pm[1]);
```

- [ ] **Step 4: Verificar**

Refrescar.

1. Profe agenda → reserva `completada` de LUIS → click "Procesar".
2. Ver 2 rondas con campos.
3. Click "📋 Copiar prompt" en ronda 1 → toast "Prompt copiado". Pegar en editor → verificar que tiene competencia + pregunta + escenario + rúbrica + `[PEGAR TRANSCRIPCIÓN AQUÍ]`.
4. Pegar texto en textarea Transcripción ronda 1, tab fuera → ver ● guardando / ✓ guardado.
5. Click Copiar otra vez → ahora el prompt contiene esa transcripción.
6. Pegar observación ronda 1, ajustar nota final a 7, tab fuera → nota total se actualiza.
7. Click "Guardar (evaluada)" → agenda muestra estado `evaluada`.
8. Click "Procesar" otra vez → datos persisten.
9. Click "Guardar y publicar" → estado `publicada`.

- [ ] **Step 5: Commit**

```bash
git add agenda-evaluaciones/index.html
git commit -m "feat: App.Prompt + App.Eval.renderProceso (panel post-sesion)"
```

---

## Task 12: Publish/unpublish individual + bulk (ya integrado, verificación final)

**Files:** ninguno modificado directamente — ya expuesto en Task 8 y Task 11.

- [ ] **Step 1: Escenario de verificación**

Ya se verificó parcialmente. Ejercicio completo:

1. Profe agenda: una reserva en `evaluada` (de Task 11 Step 4).
2. Click "📢 Publicar" → estado = `publicada`. Badge verde.
3. Click "🔒 Despublicar" → estado = `evaluada`.
4. Click "📢 Publicar todas evaluadas" → confirm → todas las `evaluada` pasan a `publicada`.
5. Como estudiante LUIS → ver reserva con estado "Publicada" + botón "Ver detalle" funcionando.

- [ ] **Step 2: Verificar persistencia end-to-end**

Cerrar browser, reabrir:

1. Login como LUIS → reserva conservada, botón "Ver detalle" visible, detalle muestra rondas con notas finales.
2. Login como profe → agenda conservada con filtros y stats correctos.

- [ ] **Step 3: Commit si hay cambios pendientes**

Si no hay cambios, salta este step. Si algún retoque salió:

```bash
git add -A
git commit -m "fix: ajustes menores publicar/despublicar"
```

---

## Task 13: `App.Reports` — export `.txt` individual + global

**Files:**
- Modify: `agenda-evaluaciones/index.html`

Pantalla `#/profe/reportes`: dropdown estudiante → botón Export individual; botón Export global.

- [ ] **Step 1: Agregar módulo `App.Reports`**

Antes de `App.Eval`:

```javascript
// ══════════════════════════════════════════════════════════════════
// App.Reports — export .txt individual y global
// ══════════════════════════════════════════════════════════════════
App.Reports = (function () {
  function renderPanel() {
    const cfg = App.Core.config;
    document.getElementById("app").innerHTML = `
      <div class="tch-shell">
        <button class="logout-btn" id="rep-back">← Volver</button>
        <h1>Reportes</h1>
        <div class="tch-section">
          <h2 style="color:var(--navy);font-size:16px">Exportar individual</h2>
          <label>Estudiante</label>
          <select id="rep-estudiante">
            <option value="">-- seleccionar --</option>
            ${cfg.estudiantes.map(e => `<option value="${e.matricula}">${App.UI.esc(e.nombre)}</option>`).join("")}
          </select>
          <button class="btn btn-primary" id="rep-individual" style="margin-top:10px">⬇ Descargar</button>
        </div>

        <div class="tch-section">
          <h2 style="color:var(--navy);font-size:16px">Exportar global de la sección</h2>
          <button class="btn btn-primary" id="rep-global">⬇ Descargar resumen</button>
        </div>
      </div>
    `;
    document.getElementById("rep-back").onclick = () => App.Core.navigate("#/profe/agenda");
    document.getElementById("rep-individual").onclick = () => {
      const m = document.getElementById("rep-estudiante").value;
      if (!m) { App.UI.toast("Selecciona estudiante", "warn"); return; }
      exportIndividual(m);
    };
    document.getElementById("rep-global").onclick = () => exportGlobal();
  }

  function exportIndividual(matricula) {
    const cfg = App.Core.config;
    const est = cfg.estudiantes.find(e => e.matricula === matricula);
    const reservas = App.Core.reservasDeEstudiante(matricula);
    const lines = [];
    lines.push(`== ${cfg.asignatura.nombre.toUpperCase()} — ${cfg.asignatura.periodo} ==`);
    lines.push(`Tarea: ${cfg.asignatura.tarea}`);
    lines.push(`Estudiante: ${est.nombre} (${est.matricula})`);
    lines.push(`Fecha reporte: ${new Date().toLocaleString("es-DO")}`);
    lines.push(``);
    if (reservas.length === 0) lines.push("(sin reservas)");
    reservas.forEach(r => appendReservaDetalle(lines, r, cfg));
    download(`${cfg.asignatura.codigo}_Evaluacion_${matricula}_${stamp()}.txt`, lines.join("\n"));
  }

  function exportGlobal() {
    const cfg = App.Core.config;
    const lines = [];
    lines.push(`== ${cfg.asignatura.nombre.toUpperCase()} — ${cfg.asignatura.periodo} ==`);
    lines.push(`Tarea: ${cfg.asignatura.tarea}`);
    lines.push(`Fecha reporte: ${new Date().toLocaleString("es-DO")}`);
    lines.push(``);
    lines.push(`MATRICULA   | ESTUDIANTE                         | TIPO                      | ESTADO      | TOTAL`);
    lines.push(`------------|------------------------------------|---------------------------|-------------|------`);
    cfg.estudiantes.forEach(est => {
      const rs = App.Core.reservasDeEstudiante(est.matricula);
      if (rs.length === 0) {
        lines.push(pad(est.matricula, 12) + "| " + pad(est.nombre, 35) + "| " + pad("-", 26) + "| " + pad("sin reserva", 12) + "| -");
      } else {
        rs.forEach(r => {
          const tipo = cfg.tiposActividad.find(t => t.id === r.tipoActividadId);
          const total = r.evaluacion && typeof r.evaluacion.puntosTotales === "number" ? r.evaluacion.puntosTotales.toFixed(1) : "-";
          lines.push(
            pad(est.matricula, 12) + "| " +
            pad(est.nombre, 35) + "| " +
            pad(tipo ? tipo.etiqueta : r.tipoActividadId, 26) + "| " +
            pad(r.estado, 12) + "| " + total
          );
        });
      }
    });
    download(`${cfg.asignatura.codigo}_Resumen_${stamp()}.txt`, lines.join("\n"));
  }

  function appendReservaDetalle(lines, r, cfg) {
    const ventana = cfg.ventanas.find(v => v.id === r.ventanaId);
    const tipo = cfg.tiposActividad.find(t => t.id === r.tipoActividadId);
    lines.push(`--- ${tipo ? tipo.etiqueta : r.tipoActividadId} ---`);
    lines.push(`Horario: ${ventana ? ventana.fecha : "?"} ${r.slotInicio}`);
    lines.push(`Estado: ${r.estado}`);
    const ev = r.evaluacion || {};
    const rondas = ev.rondas || [];
    rondas.forEach((ro, i) => {
      const comp = cfg.competencias.find(c => c.id === ro.competenciaId);
      const preg = comp ? comp.preguntas.find(p => p.id === ro.preguntaId) : null;
      lines.push(``);
      lines.push(`  Ronda ${i + 1}`);
      lines.push(`    Competencia: ${comp ? comp.nombre : ro.competenciaId}`);
      lines.push(`    Pregunta:    ${preg ? preg.preguntaGuia : ro.preguntaId}`);
      lines.push(`    Nota:        ${ro.puntosFinal ?? ro.puntosLive ?? "-"} / ${cfg.rubrica.puntosPorRonda}`);
      if (ro.observacion) lines.push(`    Observación: ${ro.observacion}`);
    });
    if (ev.checksGlobales) {
      const checks = cfg.rubrica.checksGlobales
        .map(c => `${ev.checksGlobales[c.id] ? "[x]" : "[ ]"} ${c.etiqueta}`).join("  ");
      lines.push(``);
      lines.push(`  Cumplimiento: ${checks}`);
    }
    if (ev.observacionGlobal) {
      lines.push(`  Observación general: ${ev.observacionGlobal}`);
    }
    if ((ev.videosURLs || []).length) {
      lines.push(`  Videos:`);
      ev.videosURLs.forEach(u => lines.push(`    - ${u}`));
    }
    lines.push(``);
    lines.push(`  TOTAL: ${ev.puntosTotales ?? 0} / ${cfg.rubrica.rondasPorEstudiante * cfg.rubrica.puntosPorRonda}`);
    lines.push(``);
  }

  function download(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function pad(s, n) {
    s = String(s ?? "");
    if (s.length >= n) return s.slice(0, n);
    return s + " ".repeat(n - s.length);
  }

  function stamp() {
    const d = new Date();
    const pad2 = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}`;
  }

  return { renderPanel };
})();
```

- [ ] **Step 2: Conectar ruta `#/profe/reportes`**

En `route`, tras `#/profe/proceso`:

```javascript
    if (hash === "#/profe/reportes") return App.Reports.renderPanel();
```

- [ ] **Step 3: Verificar**

Profe agenda → click "Reportes" → seleccionar `LUIS` → Descargar → archivo `DEMO_Evaluacion_2024-0002_{YYYYMMDD}.txt` se descarga. Abrir: muestra cabecera, ronda 1 y 2 con notas, total.

Click "Descargar resumen" → archivo `DEMO_Resumen_{YYYYMMDD}.txt`. Tabla con `ANA` (sin reserva o publicada) y `LUIS`.

- [ ] **Step 4: Commit**

```bash
git add agenda-evaluaciones/index.html
git commit -m "feat: App.Reports export .txt individual + global"
```

---

## Task 14: Precargar CONFIGURACIONES real de SIST-3311

**Files:**
- Modify: `agenda-evaluaciones/index.html`

Reemplaza la entrada `demo-test` por la entrada real SIST-3311 con 25 estudiantes, 10 competencias, ventana de domingo 19 abril, rúbrica y prompt template.

- [ ] **Step 1: Eliminar `demo-test` y agregar `sist3311-recuperacion-ene-abr-2026`**

Reemplazar todo el array `const CONFIGURACIONES = [ ... ];` por:

```javascript
const CONFIGURACIONES = [
  {
    id: "sist3311-recuperacion-ene-abr-2026",
    etiqueta: "Análisis de Sistemas — Recuperación ENE-ABR 2026",
    asignatura: {
      codigo:  "SIST-3311",
      nombre:  "Análisis de Sistemas",
      periodo: "Enero – Abril 2026",
      tarea:   "Evaluación de recuperación",
    },

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

    tiposActividad: [
      { id: "eval-recuperacion", etiqueta: "Evaluación de recuperación" },
      { id: "consulta-general",  etiqueta: "Consulta general" },
    ],

    ventanas: [
      { id: "dom-19-abr-mañana", fecha: "2026-04-19", inicio: "09:00", fin: "12:00", slotMinutos: 5 },
    ],

    rubrica: {
      rondasPorEstudiante: 2,
      puntosPorRonda: 7.5,
      checksGlobales: [
        { id: "camara-on",     etiqueta: "Cámara encendida" },
        { id: "sin-notas",     etiqueta: "Sin notas / pantalla secundaria" },
        { id: "sin-consultas", etiqueta: "Sin consultas externas" },
      ],
    },

    competencias: [
      {
        id: "c1-recopilacion",
        nombre: "C1 — Recopilación de información",
        preguntas: [
          { id: "c1-p1",
            escenario: "Un hospital pequeño quiere digitalizar su proceso de admisión de pacientes. Actualmente la recepcionista registra datos en un cuaderno.",
            preguntaGuia: "Explica qué técnicas usarías para levantar información y aplica tu respuesta a este escenario." },
          { id: "c1-p2",
            escenario: "Una escuela de 300 estudiantes quiere entender por qué los reportes de calificaciones salen siempre tarde.",
            preguntaGuia: "Explica las 4 técnicas de recopilación y cómo las combinarías aquí." },
        ],
      },
      {
        id: "c2-validacion",
        nombre: "C2 — Validación de hallazgos (triangulación)",
        preguntas: [
          { id: "c2-p1",
            escenario: "En una entrevista con el gerente de ventas, él dice que el sistema actual 'pierde pedidos'. La observación directa no confirmó eso.",
            preguntaGuia: "Explica triangulación y qué harías antes de documentarlo como requerimiento." },
          { id: "c2-p2",
            escenario: "Tres fuentes distintas (entrevista, cuestionario, documento) apuntan a un mismo problema de inventario.",
            preguntaGuia: "Explica cómo codificarías los hallazgos y qué valor agrega la triangulación." },
        ],
      },
      {
        id: "c3-requerimientos",
        nombre: "C3 — Definición de requerimientos",
        preguntas: [
          { id: "c3-p1",
            escenario: "El usuario dice: 'quiero que el sistema sea rápido'.",
            preguntaGuia: "Convierte esto en un RF y un RNF bien formados con criterios verificables." },
          { id: "c3-p2",
            escenario: "Una farmacia necesita descontar stock al vender un producto.",
            preguntaGuia: "Escribe el RF con Dado/Cuando/Entonces y un RNF con métrica." },
        ],
      },
      {
        id: "c4-prototipado",
        nombre: "C4 — Prototipado y validación con usuario",
        preguntas: [
          { id: "c4-p1",
            escenario: "Tienes requerimientos para un módulo de agendamiento, pero aún no programas.",
            preguntaGuia: "Explica qué prototipo harías y cómo lo validarías con usuarios reales." },
          { id: "c4-p2",
            escenario: "El prototipo salió 'bonito' pero el usuario dice 'esto no funciona así'.",
            preguntaGuia: "Explica el valor real del prototipo y cómo documentas el feedback." },
        ],
      },
      {
        id: "c5-dfd",
        nombre: "C5 — Modelado con DFD",
        preguntas: [
          { id: "c5-p1",
            escenario: "Sistema de préstamos de biblioteca: estudiantes, bibliotecario, catálogo, registro de préstamos.",
            preguntaGuia: "Explica los 4 símbolos del DFD y dibuja mentalmente el diagrama de contexto." },
          { id: "c5-p2",
            escenario: "Un analista te muestra un DFD donde dos entidades externas se comunican directamente con flecha.",
            preguntaGuia: "Explica qué está mal y cómo corregirlo según las reglas del DFD." },
        ],
      },
      {
        id: "c6-diccionario",
        nombre: "C6 — Diccionario de datos y consistencia",
        preguntas: [
          { id: "c6-p1",
            escenario: "En el DFD aparece un flujo 'SolicitudPrestamo'. En la especificación dice 'PedidoLibro'.",
            preguntaGuia: "Explica por qué es un error y cómo se usa el diccionario para evitarlo." },
          { id: "c6-p2",
            escenario: "Un almacén 'Ejemplares' tiene un atributo de estado.",
            preguntaGuia: "Escribe su definición en notación de diccionario (=, +, [|])." },
        ],
      },
      {
        id: "c7-balanceo",
        nombre: "C7 — Refinamiento y balanceo de DFD",
        preguntas: [
          { id: "c7-p1",
            escenario: "Descompones 'Registrar Préstamo' (nivel 0) en 3 subprocesos nivel 1. En el nivel 1 aparece una nueva entidad externa 'Auditor'.",
            preguntaGuia: "Explica si esto rompe el balanceo y qué haces para corregirlo." },
          { id: "c7-p2",
            escenario: "El proceso padre recibe 2 flujos externos; el hijo tiene 3 subprocesos con flujos internos entre ellos.",
            preguntaGuia: "Explica qué validarías para que el balanceo sea correcto." },
        ],
      },
      {
        id: "c8-especificaciones",
        nombre: "C8 — Especificaciones de proceso",
        preguntas: [
          { id: "c8-p1",
            escenario: "Proceso 'Calcular multa' depende de 3 condiciones (días de retraso, tipo de usuario, valor del libro) con múltiples combinaciones simultáneas.",
            preguntaGuia: "Explica cuál técnica (Structured English / Tabla / Árbol) usarías y por qué." },
          { id: "c8-p2",
            escenario: "Un proceso tiene una lógica secuencial simple: verificar saldo, si suficiente cobrar, si no rechazar.",
            preguntaGuia: "Escribe la especificación en Structured English." },
        ],
      },
      {
        id: "c9-trazabilidad",
        nombre: "C9 — Trazabilidad",
        preguntas: [
          { id: "c9-p1",
            escenario: "En tu matriz de trazabilidad hay un proceso del DFD que no corresponde a ningún RF.",
            preguntaGuia: "Explica qué significa eso y qué acción tomas." },
          { id: "c9-p2",
            escenario: "Un RF aparece en la matriz sin columna de especificación marcada.",
            preguntaGuia: "Explica el riesgo y cómo cierras ese hueco." },
        ],
      },
      {
        id: "c10-propuesta",
        nombre: "C10 — Propuesta del sistema",
        preguntas: [
          { id: "c10-p1",
            escenario: "Debes recomendar entre desarrollo a medida vs software existente para un consultorio dental pequeño.",
            preguntaGuia: "Explica cómo estructuras las alternativas (costos, beneficios, riesgos) y cómo recomiendas." },
          { id: "c10-p2",
            escenario: "Tu recomendación depende más del presupuesto del cliente que del análisis técnico.",
            preguntaGuia: "Explica cómo reflejas la restricción de presupuesto en la propuesta final." },
        ],
      },
    ],

    promptTemplate: `Eres evaluador de la materia Análisis de Sistemas. Analiza esta respuesta contra la rúbrica y devuelve observación + nota sugerida.

Competencia: {{competencia}}
Pregunta: {{pregunta}}
Escenario: {{escenario}}
Rúbrica: {{rubrica}}

Transcripción de la respuesta del estudiante:
{{transcripcion}}

Responde en español, devuelve:
1. Observación crítica en 3-4 oraciones (qué demostró y qué faltó).
2. Nota sugerida entre 0 y 7.5 (sin superar 7.5).`,
  },
];
```

- [ ] **Step 2: Verificar que la app carga con la config real**

Refrescar `http://localhost:8788/`.

1. Dropdown materia muestra "Análisis de Sistemas — Recuperación ENE-ABR 2026".
2. Selecciona materia → dropdown nombre muestra 25 estudiantes del PDF.
3. Login como `GIOVANNY BAUTISTA CASTILLO / 2016-0810` → home.
4. Reservar → "Evaluación de recuperación" → ventana domingo 19 abril → grid con 36 slots (09:00–11:55).
5. Tomar 09:30 → reservado.
6. Logout → login como profe → agenda muestra GIOVANNY en `reservada` el 2026-04-19 a las 09:30.
7. Iniciar eval → girar competencia → ver que aparecen las 10 competencias.
8. Ronda 2 al girar: 9 competencias (sin la ya elegida).

- [ ] **Step 3: Reset del KV para limpiar datos demo**

Los datos previos bajo `state_demo-test` quedaron huérfanos. Limpieza opcional:

```bash
curl -X PUT "http://localhost:8788/api/state?id=demo-test" \
  -H "Content-Type: application/json" \
  -d '{"version":<VERSION_ACTUAL_DE_demo-test>,"reservas":{}}'
```

> No es obligatorio: el nuevo `configId` tiene su propio bucket.

- [ ] **Step 4: Commit**

```bash
git add agenda-evaluaciones/index.html
git commit -m "config: cargar SIST-3311 recuperación ENE-ABR 2026 (25 estudiantes + 10 competencias)"
```

---

## Task 15: `CLAUDE.md` de la herramienta

**Files:**
- Create: `agenda-evaluaciones/CLAUDE.md`

Documentación técnica + operativa para el profesor y para Claude Code en sesiones futuras.

- [ ] **Step 1: Crear `agenda-evaluaciones/CLAUDE.md`**

```markdown
# CLAUDE.md — Agenda de Evaluaciones

> Contexto para Claude Code. Leer completo antes de tocar cualquier archivo.

---

## Qué hace esta herramienta

Coordina la reserva de horarios de evaluación por estudiante y provee al profesor:
- Agenda cronológica de reservas con filtros.
- Ruleta 2-niveles (competencia → pregunta) con dedupe por estudiante.
- Panel de evaluación live con scoring y checks globales.
- Panel post-sesión con generador de prompt para IA externa (pegar transcripción → copiar → pegar en ChatGPT/Claude → pegar respuesta).
- Publicación individual o en bulk de resultados.
- Export `.txt` individual y global.

Reutilizable entre materias mediante el array `CONFIGURACIONES` en `index.html`. Cada entrada define una materia + período + ventanas + estudiantes + competencias + rúbrica + prompt template.

---

## Arquitectura

| Archivo | Rol |
|---|---|
| `index.html` | App monolítica con módulos namespaced (`App.Core`, `App.Auth`, `App.Student`, `App.Teacher`, `App.Roulette`, `App.Eval`, `App.Prompt`, `App.Reports`, `App.UI`). Sin build step. |
| `functions/api/state.js` | Cloudflare Pages Function. GET/PUT con locking optimista. |
| `wrangler.toml` | Config Pages + binding KV `AGENDA_EVAL_STATE`. |

El estado persistido es **único por `configId`** bajo la key `state_{configId}`. El cliente envía `{ version, reservas }` y el worker valida la versión antes de escribir (409 si mismatch).

---

## Principio crítico de persistencia

**KV es la única fuente de verdad.** `localStorage` se usa solo para sesión efímera (matrícula, rol). Toda acción significativa pasa por `App.Core.mutate()`, que hace PUT inmediato. El indicador visual arriba a la derecha muestra `● guardando` / `✓ guardado` / `⚠ error`.

Si ves el commit `fix: migrar estado de localStorage a Cloudflare KV`, es del `selector-de-proyectos`: ahí se aprendió la regla después de que algunos cambios se quedaran solo en el browser. No repetir ese bug.

---

## Cómo agregar una nueva materia

Editar `index.html`, al inicio en `CONFIGURACIONES`, agregar un bloque nuevo con:

- `id` único kebab-case
- `etiqueta`
- `asignatura` (código, nombre, período, tarea)
- `estudiantes` (matrícula + nombre)
- `tiposActividad` (id + etiqueta)
- `ventanas` (id, fecha YYYY-MM-DD, inicio/fin HH:MM, slotMinutos)
- `rubrica` (rondasPorEstudiante, puntosPorRonda, checksGlobales)
- `competencias` → cada una con `preguntas` (escenario + preguntaGuia)
- `promptTemplate` con placeholders `{{competencia}}`, `{{pregunta}}`, `{{escenario}}`, `{{rubrica}}`, `{{transcripcion}}`

Commit y push. Cloudflare Pages redespliega en ~60s. Cada `configId` tiene bucket KV independiente, no hay interferencia entre materias.

---

## Cómo correr en local

```bash
cd agenda-evaluaciones
wrangler pages dev . --port 8788
# abrir http://localhost:8788/
```

Wrangler crea un KV efímero local automáticamente. Al cerrar, los datos se pierden (útil para reset rápido).

---

## Deploy Cloudflare Pages

1. Crear namespace KV:
   ```bash
   wrangler kv namespace create AGENDA_EVAL_STATE
   ```
   Copiar el `id` en `wrangler.toml`.

2. Conectar repo en dashboard Pages → Add Production Branch `main` → publish directory `agenda-evaluaciones`. Build command vacío.

3. En Settings → Functions → KV namespace bindings: asociar `AGENDA_EVAL_STATE` al namespace creado.

4. Push a `main` → redeploy automático.

URL resultante (ejemplo): `agenda-evaluaciones.pages.dev`.

---

## Checklist manual de verificación

Correr antes de cada release:

**Login:**
- [ ] Dropdown materia muestra configuraciones disponibles.
- [ ] Dropdown nombre se llena al escoger materia.
- [ ] Login estudiante requiere matrícula coincidente con el nombre.
- [ ] Link "🔒 Soy profesor" pide contraseña; incorrecta → error; correcta → modo profe.
- [ ] Refrescar la app restaura sesión previa.

**Reserva estudiante:**
- [ ] Home muestra "Mis reservas" (vacía si ninguna).
- [ ] Reservar → tipo → ventana → grid 5-min.
- [ ] Slot libre (verde) al click → confirm → guarda → toast verde.
- [ ] Slot tomado por otro: gris, no clickeable.
- [ ] Mi slot: azul.
- [ ] Cap tipo actividad: cuando ya reservé un tipo, el botón de ese tipo desaparece.
- [ ] Dos tabs intentando misma acción → segunda ve 409, recarga sin crash.

**Resultado estudiante:**
- [ ] Reserva `publicada` tiene botón "Ver detalle".
- [ ] Detalle muestra rondas con nota + observación, checks, observación global, videos.
- [ ] Reserva en otros estados: botón no aparece.

**Agenda profe:**
- [ ] Stats arriba coinciden con conteos por estado.
- [ ] Chips filtran correctamente (estado / tipo / ventana).
- [ ] Acciones por estado son las correctas (ver tabla en spec sección 7.4).
- [ ] Publicar / despublicar actualiza estado e indicador de guardado.
- [ ] Bulk publicar procesa todas las `evaluada`.

**Evaluación live:**
- [ ] Click "Iniciar eval" cambia estado a `en-sesion` y abre panel.
- [ ] Countdown 5 min baja.
- [ ] Ronda 1: girar competencia → aparece ganador → girar pregunta → aparece escenario.
- [ ] Slider nota: auto-save con indicador.
- [ ] Ronda 2 bloqueada hasta nota ronda 1; destrabada muestra ruleta con 1 competencia menos.
- [ ] Refrescar la página mid-sesión restaura ronda y competencia ya elegidas.
- [ ] Checks globales persisten.
- [ ] Finalizar sesión → estado `completada`, puntosTotales suma live.

**Procesar (post-sesión):**
- [ ] Pegar transcripción en ronda → blur → guarda.
- [ ] Copiar prompt → clipboard contiene template lleno con transcripción.
- [ ] Observación final y nota final guardan con blur / change.
- [ ] Guardar → `evaluada`. Guardar y publicar → `publicada`.

**Reportes:**
- [ ] Export individual: `.txt` con rondas, notas, checks, total.
- [ ] Export global: tabla resumen con una fila por reserva.

**Persistencia:**
- [ ] Cerrar browser y reabrir: todos los datos persisten (locking respetado).
- [ ] Simular PUT stale (DevTools): worker devuelve 409, UI maneja con refetch.

---

## Troubleshooting

| Síntoma | Causa probable |
|---|---|
| Todos los PUT devuelven 409 | Dos tabs abiertas con versions desfasadas. Refrescar una. |
| La ruleta no gira | JavaScript bloqueado o canvas no en DOM. Revisar consola. |
| Cambios no persisten | Indicator de guardado en rojo — revisar Network tab, KV binding en Pages dashboard. |
| "Contraseña incorrecta" siempre | `PROFESOR_MATRICULA` en código no coincide. Revisar `index.html` constante. |

---

## Referencias

- Contexto del monorepo: `../herramientas-educativas-CLAUDE.md`.
- Spec diseño: `docs/superpowers/specs/2026-04-19-agenda-evaluaciones-design.md`.
- Plan implementación: `docs/superpowers/plans/2026-04-19-agenda-evaluaciones.md`.
- Tool hermana (patrón base): `../selector-de-proyectos/`.
```

- [ ] **Step 2: Actualizar `herramientas-educativas-CLAUDE.md` del root con la nueva herramienta**

Modificar `herramientas-educativas-CLAUDE.md` (root del repo), en la sección "Herramientas existentes", agregar fila:

```markdown
| `agenda-evaluaciones` | genérico | Reserva horarios + evaluación docente con ruleta 2-niveles | ✅ En desarrollo |
```

- [ ] **Step 3: Commit**

```bash
git add agenda-evaluaciones/CLAUDE.md herramientas-educativas-CLAUDE.md
git commit -m "docs: CLAUDE.md de agenda-evaluaciones + actualización monorepo"
```

---

## Task 16: Smoke test end-to-end + deploy notes

**Files:**
- Modify: `agenda-evaluaciones/wrangler.toml` (id del KV namespace real)

Verificación completa del flujo real con la config SIST-3311. No introduce código nuevo.

- [ ] **Step 1: Smoke test end-to-end**

Terminal:

```bash
cd agenda-evaluaciones
wrangler pages dev . --port 8788
```

Browser `http://localhost:8788/`. Seguir este flujo sin errores:

1. Login `GIOVANNY BAUTISTA CASTILLO / 2016-0810` → reservar "Evaluación de recuperación" en domingo 19 abril 09:30.
2. Logout.
3. Login `DARLIN ARROYO POLANCO / 2022-0603` → reservar en 09:35.
4. Logout.
5. Login profe con contraseña `2008464` → agenda muestra 2 filas, orden cronológico.
6. Iniciar eval en GIOVANNY → girar ambas rondas → notas 6.5 y 7.0 → checks 3 marcados → finalizar.
7. Procesar GIOVANNY → pegar transcripción fake en ronda 1 → copiar prompt (verificar clipboard en consola: `document.execCommand('paste')` no disponible; verificar al pegar en editor externo) → pegar observación → ajustar nota final 7.0 → guardar y publicar.
8. Iniciar eval en DARLIN → girar → notas → finalizar.
9. Procesar DARLIN → guardar (evaluada) → click "📢 Publicar todas evaluadas" → DARLIN queda `publicada`.
10. Reportes → export individual GIOVANNY → archivo generado con rondas y notas.
11. Reportes → export global → archivo con 25 filas (GIOVANNY con nota total, DARLIN con total, otros 23 "sin reserva").
12. Logout profe.
13. Login como GIOVANNY → home muestra reserva `Publicada` con botón "Ver detalle" → click → ve competencias, preguntas, notas, observaciones, checks, total.

Si algún paso falla, corregir antes de deploy.

- [ ] **Step 2: Crear KV namespace de producción**

Requiere cuenta Cloudflare + wrangler autenticado.

```bash
wrangler kv namespace create AGENDA_EVAL_STATE
```

Output similar a:

```
🌀 Creating namespace with title "agenda-evaluaciones-AGENDA_EVAL_STATE"
✨ Success!
[[kv_namespaces]]
binding = "AGENDA_EVAL_STATE"
id = "abc123def456..."
```

Copiar el `id` al `wrangler.toml`:

```toml
name = "agenda-evaluaciones"
compatibility_date = "2024-12-01"
pages_build_output_dir = "."

[[kv_namespaces]]
binding = "AGENDA_EVAL_STATE"
id = "abc123def456..."
```

- [ ] **Step 3: Commit del namespace id**

```bash
git add agenda-evaluaciones/wrangler.toml
git commit -m "config: KV namespace id de producción para agenda-evaluaciones"
```

- [ ] **Step 4: Push + deploy**

```bash
git push origin HEAD
```

En dashboard Cloudflare Pages:

1. Connect Git → seleccionar este repo.
2. Production branch: `main`.
3. Build command: vacío.
4. Build output directory: `agenda-evaluaciones`.
5. Settings → Functions → KV namespace bindings → bind `AGENDA_EVAL_STATE` al id creado.
6. Deploy.

Verificar URL pública (ej. `agenda-evaluaciones.pages.dev`):
- Login funciona.
- `/api/state?id=sist3311-recuperacion-ene-abr-2026` devuelve `{version:0, reservas:{}}` (o el estado actual).
- Reservar desde URL pública persiste en KV de producción.

- [ ] **Step 5: Marcar el plan como completado**

Agregar al final del `CLAUDE.md` de la herramienta una línea de status:

```markdown
---

*Status: desplegado · Prof. Misael Michel · UNAD ENE-ABR 2026*
```

Commit:

```bash
git add agenda-evaluaciones/CLAUDE.md
git commit -m "docs: marcar agenda-evaluaciones como desplegada"
```

---

## Self-review

**Spec coverage check:**

| Spec section | Task | Notas |
|---|---|---|
| 3. Alcance MVP — login combinado | Task 4 | ✓ |
| 3. Reserva 1 slot/tipo | Tasks 5–6 | ✓ cap enforcement en `confirmReserva` |
| 3. Agenda cronológica + filtros | Task 8 | ✓ |
| 3. Ruleta 2 niveles + dedupe | Tasks 9–10 | ✓ dedupe en `wireRondas` |
| 3. Panel eval live + checks | Task 10 | ✓ |
| 3. Panel post-sesión + prompt | Task 11 | ✓ |
| 3. Publicar/despublicar + bulk | Task 8 + Task 12 verif | ✓ |
| 3. Vista resultado estudiante | Task 7 | ✓ |
| 3. Reportes .txt | Task 13 | ✓ |
| 3. KV + locking optimista | Task 2 | ✓ |
| 6. CONFIGURACIONES shape | Tasks 3, 14 | ✓ |
| 6.2 KV schema | Task 2 | ✓ |
| 6.3 State machine | Tasks 8, 10, 11 | ✓ |
| 9. Disciplina persistencia | Task 3 (save indicator, mutate), 10, 11 | ✓ |
| 10. Error handling | Tasks 6 (slot colisión), 10 (concurrencia), 11 (clamp nota) | ✓ |
| 13. Primer caso precargado | Task 14 | ✓ |

**Placeholders:** ninguno. Todos los bloques de código son concretos.

**Type consistency:** nombres de funciones y propiedades consistentes (`App.Core.mutate`, `reservas` mapa, `evaluacion.rondas` array, `puntosLive` / `puntosFinal`). Los `reserva.id` se generan con `crypto.randomUUID()`.

**Notas adicionales:**

- El plan asume Node moderno con `crypto.randomUUID()` disponible (Chromium/Firefox/Safari >= 2022). Ningún navegador soportado por el monorepo lo pierde.
- El countdown de 5 min es informativo — no interrumpe la sesión al llegar a 0.
- El debounce de auto-save (400–500ms) equilibra UX con tráfico al KV.
- La ruleta usa palette rotativa; para 10 competencias, las primeras 10 colores del `PALETTE` cubren todo sin repetir visualmente.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-19-agenda-evaluaciones.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

**Which approach?**
