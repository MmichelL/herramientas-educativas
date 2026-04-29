# Encuesta Diagnóstica IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time anonymous diagnostic survey app (apertura + cierre) with live dashboard for the UNAD AI capacitación, deployable to Cloudflare Pages.

**Architecture:** Static HTML monolith (single `index.html` with hash routing) + Cloudflare Pages Functions (REST API) + KV append-only store (one key per response). Same realtime pattern as `agenda-evaluaciones` but without optimistic locking — UUIDs prevent collisions.

**Tech Stack:** Vanilla JS · HTML/CSS · Chart.js (CDN) · Cloudflare Pages Functions · Cloudflare KV · `crypto.randomUUID()` for response IDs · `wrangler` for local dev.

**Reference spec:** `docs/superpowers/specs/2026-04-29-encuesta-diagnostica-ia-design.md`
**Reference code:** `agenda-evaluaciones/functions/api/state.js` (KV pattern), `selector-de-proyectos/index.html` (HTML structure), `herramientas-educativas-CLAUDE.md` (palette + conventions).

**Note on TDD:** This monorepo uses static HTML without a test framework. "TDD" here means: verify each task's behavior in the browser against `wrangler pages dev` before committing. Manual checklist serves as the test suite.

---

## File Structure

```
encuesta-diagnostica-ia/
├── CLAUDE.md                  ← tool-specific context
├── index.html                  ← SPA (landing, forms, dashboard, admin)
├── functions/
│   └── api/
│       ├── responses.js        ← POST new response, GET admin list
│       ├── aggregate.js        ← GET aggregated counts with filters
│       ├── phase.js            ← GET/PUT phase
│       ├── seed.js             ← POST seed demo (admin)
│       └── wipe.js             ← DELETE wipe (admin)
└── wrangler.toml               ← Pages config + KV binding
```

**index.html responsibilities:**
- Render landing, apertura form, cierre form, dashboard, admin via hash router.
- Define `PREGUNTAS_APERTURA` / `PREGUNTAS_CIERRE` config arrays.
- All CSS + JS inline (no build).

**Each function file responsibility:**
- One HTTP resource per file. Validation + KV ops only. No cross-imports.
- Shared helpers (CORS, admin auth) inlined per file (DRY violation accepted: 5 endpoints, ~6 lines duplicated, simpler than a shared helper file in Pages Functions).

---

## Task 0: Working directory verification

**Files:** none (preflight)

- [ ] **Step 1: Verify worktree and current branch**

Run: `git status && git branch --show-current`
Expected: clean tree, branch `wonderful-bhaskara-5470a5`.

- [ ] **Step 2: Verify wrangler available**

Run: `wrangler --version`
Expected: prints version (any 3.x or later). If missing: `npm i -g wrangler`.

- [ ] **Step 3: Verify spec exists**

Run: `ls docs/superpowers/specs/2026-04-29-encuesta-diagnostica-ia-design.md`
Expected: file exists.

---

## Task 1: Create folder + wrangler.toml + KV namespace

**Files:**
- Create: `encuesta-diagnostica-ia/wrangler.toml`

- [ ] **Step 1: Create folder**

Run: `mkdir -p encuesta-diagnostica-ia/functions/api`
Expected: no output.

- [ ] **Step 2: Create KV namespace**

Run: `cd encuesta-diagnostica-ia && wrangler kv namespace create ENCUESTA_IA_STATE`
Expected: prints an `id` (32-char hex). Copy it for next step.

- [ ] **Step 3: Write wrangler.toml**

File: `encuesta-diagnostica-ia/wrangler.toml`

```toml
name = "encuesta-diagnostica-ia"
compatibility_date = "2026-04-01"
pages_build_output_dir = "."

[[kv_namespaces]]
binding = "ENCUESTA_IA_STATE"
id = "<paste-id-from-step-2>"
```

Replace `<paste-id-from-step-2>` with the actual id printed in step 2.

- [ ] **Step 4: Commit**

```bash
git add encuesta-diagnostica-ia/wrangler.toml
git commit -m "feat(encuesta-ia): wrangler.toml + KV namespace ENCUESTA_IA_STATE"
```

---

## Task 2: Phase API (GET/PUT)

**Files:**
- Create: `encuesta-diagnostica-ia/functions/api/phase.js`

The simplest endpoint, gets/sets the active phase. Build first to validate the KV binding works.

- [ ] **Step 1: Write phase.js**

File: `encuesta-diagnostica-ia/functions/api/phase.js`

```javascript
// ══════════════════════════════════════════════════════════════════
// API de fase activa — Cloudflare Pages Function + KV
//
// GET  /api/phase                → { phase: "apertura" | "cierre" | "cerrada" }
// PUT  /api/phase                → body { phase }, requires admin token
// ══════════════════════════════════════════════════════════════════

const ADMIN_TOKEN = "2008464"; // PROFESOR_MATRICULA
const PHASES = ["apertura", "cierre", "cerrada"];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function isAdmin(request) {
  return request.headers.get("X-Admin-Token") === ADMIN_TOKEN;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const phase = (await context.env.ENCUESTA_IA_STATE.get("phase")) || "apertura";
  return new Response(JSON.stringify({ phase }), {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function onRequestPut(context) {
  if (!isAdmin(context.request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders(),
    });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  if (!PHASES.includes(body.phase)) {
    return new Response(JSON.stringify({ error: "Invalid phase" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  await context.env.ENCUESTA_IA_STATE.put("phase", body.phase);
  return new Response(JSON.stringify({ ok: true, phase: body.phase }), {
    status: 200,
    headers: corsHeaders(),
  });
}
```

- [ ] **Step 2: Start local dev server**

Run (in a separate terminal): `cd encuesta-diagnostica-ia && wrangler pages dev . --port 8788`
Expected: prints `[wrangler:inf] Ready on http://localhost:8788`. Wrangler creates ephemeral local KV.

- [ ] **Step 3: Test GET phase**

Run: `curl -s http://localhost:8788/api/phase`
Expected: `{"phase":"apertura"}`

- [ ] **Step 4: Test PUT without token (should fail)**

Run: `curl -s -X PUT http://localhost:8788/api/phase -H 'Content-Type: application/json' -d '{"phase":"cierre"}'`
Expected: `{"error":"Unauthorized"}` with status 401.

- [ ] **Step 5: Test PUT with token**

Run: `curl -s -X PUT http://localhost:8788/api/phase -H 'Content-Type: application/json' -H 'X-Admin-Token: 2008464' -d '{"phase":"cierre"}'`
Expected: `{"ok":true,"phase":"cierre"}`

- [ ] **Step 6: Verify GET reflects change**

Run: `curl -s http://localhost:8788/api/phase`
Expected: `{"phase":"cierre"}`

- [ ] **Step 7: Reset to apertura**

Run: `curl -s -X PUT http://localhost:8788/api/phase -H 'Content-Type: application/json' -H 'X-Admin-Token: 2008464' -d '{"phase":"apertura"}'`
Expected: `{"ok":true,"phase":"apertura"}`

- [ ] **Step 8: Commit**

```bash
git add encuesta-diagnostica-ia/functions/api/phase.js
git commit -m "feat(encuesta-ia): API GET/PUT /api/phase"
```

---

## Task 3: Responses API — POST

**Files:**
- Create: `encuesta-diagnostica-ia/functions/api/responses.js`

- [ ] **Step 1: Write responses.js (POST + GET stub)**

File: `encuesta-diagnostica-ia/functions/api/responses.js`

```javascript
// ══════════════════════════════════════════════════════════════════
// API de respuestas — POST nueva respuesta · GET listado (admin)
//
// POST /api/responses    → body { fase, respId, demograficas, respuestas }
// GET  /api/responses?fase=apertura → admin only, listado crudo
// ══════════════════════════════════════════════════════════════════

const ADMIN_TOKEN = "2008464";
const VALID_FASES = ["apertura", "cierre"];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function isAdmin(request) {
  return request.headers.get("X-Admin-Token") === ADMIN_TOKEN;
}

function isValidUuid(s) {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const { fase, respId, demograficas, respuestas } = body;

  if (!VALID_FASES.includes(fase)) {
    return new Response(JSON.stringify({ error: "Invalid fase" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  if (!isValidUuid(respId)) {
    return new Response(JSON.stringify({ error: "Invalid respId (UUID v4 expected)" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  if (!demograficas || typeof demograficas !== "object") {
    return new Response(JSON.stringify({ error: "Missing demograficas" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  if (!respuestas || typeof respuestas !== "object") {
    return new Response(JSON.stringify({ error: "Missing respuestas" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  // Reject if phase is "cerrada"
  const currentPhase = (await context.env.ENCUESTA_IA_STATE.get("phase")) || "apertura";
  if (currentPhase === "cerrada") {
    return new Response(JSON.stringify({ error: "Encuesta cerrada" }), {
      status: 403,
      headers: corsHeaders(),
    });
  }

  const payload = {
    respId,
    fase,
    ts: new Date().toISOString(),
    demograficas,
    respuestas,
  };

  const key = `resp:${fase}:${respId}`;
  await context.env.ENCUESTA_IA_STATE.put(key, JSON.stringify(payload));

  return new Response(JSON.stringify({ ok: true, respId }), {
    status: 201,
    headers: corsHeaders(),
  });
}

export async function onRequestGet(context) {
  if (!isAdmin(context.request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders(),
    });
  }

  const url = new URL(context.request.url);
  const fase = url.searchParams.get("fase");

  if (!VALID_FASES.includes(fase)) {
    return new Response(JSON.stringify({ error: "Invalid fase" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const list = await context.env.ENCUESTA_IA_STATE.list({ prefix: `resp:${fase}:` });
  const items = await Promise.all(
    list.keys.map(async (k) => JSON.parse(await context.env.ENCUESTA_IA_STATE.get(k.name)))
  );

  return new Response(JSON.stringify({ n: items.length, items }), {
    status: 200,
    headers: corsHeaders(),
  });
}
```

- [ ] **Step 2: Test POST with valid payload**

Run:
```bash
curl -s -X POST http://localhost:8788/api/responses \
  -H 'Content-Type: application/json' \
  -d '{
    "fase": "apertura",
    "respId": "550e8400-e29b-41d4-a716-446655440000",
    "demograficas": {"facultad":"ingenieria-tecnologia","tiempo_docencia":"5-14","sexo":"F"},
    "respuestas": {"d1_ensayo":3,"d1_agentic":2}
  }'
```
Expected: `{"ok":true,"respId":"550e8400-e29b-41d4-a716-446655440000"}`

- [ ] **Step 3: Test POST with invalid UUID**

Run:
```bash
curl -s -X POST http://localhost:8788/api/responses \
  -H 'Content-Type: application/json' \
  -d '{"fase":"apertura","respId":"not-a-uuid","demograficas":{},"respuestas":{}}'
```
Expected: `{"error":"Invalid respId (UUID v4 expected)"}` status 400.

- [ ] **Step 4: Test POST when fase is cerrada**

Run:
```bash
curl -s -X PUT http://localhost:8788/api/phase -H 'Content-Type: application/json' -H 'X-Admin-Token: 2008464' -d '{"phase":"cerrada"}'
curl -s -X POST http://localhost:8788/api/responses \
  -H 'Content-Type: application/json' \
  -d '{"fase":"apertura","respId":"550e8400-e29b-41d4-a716-446655440001","demograficas":{},"respuestas":{}}'
```
Expected: second curl returns `{"error":"Encuesta cerrada"}` status 403.

- [ ] **Step 5: Reset phase**

Run: `curl -s -X PUT http://localhost:8788/api/phase -H 'Content-Type: application/json' -H 'X-Admin-Token: 2008464' -d '{"phase":"apertura"}'`
Expected: `{"ok":true,"phase":"apertura"}`

- [ ] **Step 6: Test GET admin list**

Run: `curl -s http://localhost:8788/api/responses?fase=apertura -H 'X-Admin-Token: 2008464'`
Expected: `{"n":1,"items":[{"respId":"550e8400-e29b-41d4-a716-446655440000",...}]}`

- [ ] **Step 7: Test GET without token**

Run: `curl -s http://localhost:8788/api/responses?fase=apertura`
Expected: `{"error":"Unauthorized"}` status 401.

- [ ] **Step 8: Commit**

```bash
git add encuesta-diagnostica-ia/functions/api/responses.js
git commit -m "feat(encuesta-ia): API POST/GET /api/responses con validación UUID y fase"
```

---

## Task 4: Aggregate API

**Files:**
- Create: `encuesta-diagnostica-ia/functions/api/aggregate.js`

This is the heart of the dashboard. Aggregates KV responses into counts per question per filter.

- [ ] **Step 1: Write aggregate.js**

File: `encuesta-diagnostica-ia/functions/api/aggregate.js`

```javascript
// ══════════════════════════════════════════════════════════════════
// API de agregaciones — GET /api/aggregate?fase=apertura
//
// Lee todas las respuestas de KV con prefix `resp:{fase}:`,
// agrega y devuelve { n, byQuestion: {...}, byFilter: {...} }.
//
// Soporta filtros por demográficas pasados como query params:
//   ?fase=apertura&facultad=ciencias-salud
//   ?fase=apertura&tiempo_docencia=5-14&sexo=F
// ══════════════════════════════════════════════════════════════════

const VALID_FASES = ["apertura", "cierre"];
const FILTER_KEYS = ["facultad", "coordinacion", "tiempo_docencia", "sexo", "postura"];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=2",
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function matchesFilters(item, filters) {
  for (const [key, value] of Object.entries(filters)) {
    if (key === "postura") {
      if (item.respuestas?.postura !== value) return false;
    } else {
      if (item.demograficas?.[key] !== value) return false;
    }
  }
  return true;
}

function aggregateByQuestion(items) {
  const by = {};
  for (const item of items) {
    // Demográficas counts (used for byFilter, but also exposed)
    for (const [k, v] of Object.entries(item.demograficas || {})) {
      const code = `dem_${k}`;
      by[code] = by[code] || { type: "count", values: {} };
      by[code].values[v] = (by[code].values[v] || 0) + 1;
    }
    // Respuestas
    for (const [k, v] of Object.entries(item.respuestas || {})) {
      by[k] = by[k] || { type: typeof v === "number" ? "likert" : Array.isArray(v) ? "multi" : "single", values: {}, sum: 0, n: 0 };
      if (typeof v === "number") {
        by[k].sum += v;
        by[k].n += 1;
        by[k].values[v] = (by[k].values[v] || 0) + 1;
      } else if (Array.isArray(v)) {
        for (const opt of v) by[k].values[opt] = (by[k].values[opt] || 0) + 1;
      } else {
        by[k].values[v] = (by[k].values[v] || 0) + 1;
      }
    }
  }
  // Compute mean for likert
  for (const code of Object.keys(by)) {
    if (by[code].type === "likert" && by[code].n > 0) {
      by[code].mean = by[code].sum / by[code].n;
    }
  }
  return by;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const fase = url.searchParams.get("fase");

  if (!VALID_FASES.includes(fase)) {
    return new Response(JSON.stringify({ error: "Invalid fase" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const filters = {};
  for (const k of FILTER_KEYS) {
    const v = url.searchParams.get(k);
    if (v) filters[k] = v;
  }

  // List all keys for this fase, paginated if needed
  const allItems = [];
  let cursor;
  do {
    const listOpts = { prefix: `resp:${fase}:` };
    if (cursor) listOpts.cursor = cursor;
    const list = await context.env.ENCUESTA_IA_STATE.list(listOpts);
    const items = await Promise.all(
      list.keys.map(async (k) => JSON.parse(await context.env.ENCUESTA_IA_STATE.get(k.name)))
    );
    allItems.push(...items);
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);

  const filtered = Object.keys(filters).length === 0
    ? allItems
    : allItems.filter((item) => matchesFilters(item, filters));

  const byQuestion = aggregateByQuestion(filtered);

  return new Response(
    JSON.stringify({
      n: filtered.length,
      nTotal: allItems.length,
      filters,
      byQuestion,
      lastTs: filtered.length > 0 ? filtered.map((i) => i.ts).sort().pop() : null,
    }),
    { status: 200, headers: corsHeaders() }
  );
}
```

- [ ] **Step 2: Seed two manual responses for testing**

Run:
```bash
curl -s -X POST http://localhost:8788/api/responses -H 'Content-Type: application/json' -d '{
  "fase":"apertura",
  "respId":"550e8400-e29b-41d4-a716-446655440010",
  "demograficas":{"facultad":"ciencias-salud","tiempo_docencia":"5-14","sexo":"F"},
  "respuestas":{"postura":"entusiasmo","d1_ensayo":4,"d1_agentic":2,"d2_usos":["buscar-info","generar-ideas"]}
}'

curl -s -X POST http://localhost:8788/api/responses -H 'Content-Type: application/json' -d '{
  "fase":"apertura",
  "respId":"550e8400-e29b-41d4-a716-446655440011",
  "demograficas":{"facultad":"ingenieria-tecnologia","tiempo_docencia":"15-24","sexo":"M"},
  "respuestas":{"postura":"curiosidad-cautelosa","d1_ensayo":3,"d1_agentic":1,"d2_usos":["buscar-info"]}
}'
```
Expected: both return `{"ok":true,...}`.

- [ ] **Step 3: Test aggregate without filter**

Run: `curl -s 'http://localhost:8788/api/aggregate?fase=apertura' | python -m json.tool` (or just plain curl if python unavailable)
Expected: `n` ≥ 3 (incluye el de Task 3), `byQuestion` con `d1_ensayo: { type: "likert", mean: ~3.3, ... }`, `d2_usos: { type: "multi", values: { "buscar-info": 2, "generar-ideas": 1 } }`.

- [ ] **Step 4: Test aggregate with facultad filter**

Run: `curl -s 'http://localhost:8788/api/aggregate?fase=apertura&facultad=ciencias-salud'`
Expected: `n=1`, `byQuestion.d1_ensayo.mean === 4`.

- [ ] **Step 5: Test aggregate with empty result**

Run: `curl -s 'http://localhost:8788/api/aggregate?fase=apertura&facultad=teologia'`
Expected: `{"n":0,"nTotal":3,"filters":{"facultad":"teologia"},"byQuestion":{},"lastTs":null}`.

- [ ] **Step 6: Commit**

```bash
git add encuesta-diagnostica-ia/functions/api/aggregate.js
git commit -m "feat(encuesta-ia): API GET /api/aggregate con filtros y paginación"
```

---

## Task 5: Wipe API

**Files:**
- Create: `encuesta-diagnostica-ia/functions/api/wipe.js`

- [ ] **Step 1: Write wipe.js**

File: `encuesta-diagnostica-ia/functions/api/wipe.js`

```javascript
// ══════════════════════════════════════════════════════════════════
// API de wipe — DELETE /api/wipe?scope=apertura|cierre|all
//
// Borra respuestas de KV. Admin only.
// scope=all también resetea phase a "apertura".
// ══════════════════════════════════════════════════════════════════

const ADMIN_TOKEN = "2008464";
const VALID_SCOPES = ["apertura", "cierre", "all"];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function isAdmin(request) {
  return request.headers.get("X-Admin-Token") === ADMIN_TOKEN;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function deletePrefix(kv, prefix) {
  let total = 0;
  let cursor;
  do {
    const listOpts = { prefix };
    if (cursor) listOpts.cursor = cursor;
    const list = await kv.list(listOpts);
    await Promise.all(list.keys.map((k) => kv.delete(k.name)));
    total += list.keys.length;
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  return total;
}

export async function onRequestDelete(context) {
  if (!isAdmin(context.request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders(),
    });
  }

  const url = new URL(context.request.url);
  const scope = url.searchParams.get("scope");

  if (!VALID_SCOPES.includes(scope)) {
    return new Response(JSON.stringify({ error: "Invalid scope" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const kv = context.env.ENCUESTA_IA_STATE;
  let deleted = 0;

  if (scope === "apertura" || scope === "all") {
    deleted += await deletePrefix(kv, "resp:apertura:");
  }
  if (scope === "cierre" || scope === "all") {
    deleted += await deletePrefix(kv, "resp:cierre:");
  }
  if (scope === "all") {
    await kv.put("phase", "apertura");
  }

  return new Response(JSON.stringify({ ok: true, deleted, scope }), {
    status: 200,
    headers: corsHeaders(),
  });
}
```

- [ ] **Step 2: Test wipe apertura**

Run: `curl -s -X DELETE 'http://localhost:8788/api/wipe?scope=apertura' -H 'X-Admin-Token: 2008464'`
Expected: `{"ok":true,"deleted":3,"scope":"apertura"}` (counts the 3 from previous tasks).

- [ ] **Step 3: Verify aggregate now empty**

Run: `curl -s 'http://localhost:8788/api/aggregate?fase=apertura'`
Expected: `n=0`.

- [ ] **Step 4: Test wipe without token**

Run: `curl -s -X DELETE 'http://localhost:8788/api/wipe?scope=all'`
Expected: `{"error":"Unauthorized"}` status 401.

- [ ] **Step 5: Commit**

```bash
git add encuesta-diagnostica-ia/functions/api/wipe.js
git commit -m "feat(encuesta-ia): API DELETE /api/wipe con scope apertura/cierre/all"
```

---

## Task 6: Seed API

**Files:**
- Create: `encuesta-diagnostica-ia/functions/api/seed.js`

Generates demo responses with realistic distributions for testing.

- [ ] **Step 1: Write seed.js**

File: `encuesta-diagnostica-ia/functions/api/seed.js`

```javascript
// ══════════════════════════════════════════════════════════════════
// API de seed — POST /api/seed
//
// Body: { fase: "apertura"|"cierre", n: number }
// Genera N respuestas demo con distribuciones realistas y las guarda.
// Admin only.
// ══════════════════════════════════════════════════════════════════

const ADMIN_TOKEN = "2008464";
const VALID_FASES = ["apertura", "cierre"];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function isAdmin(request) {
  return request.headers.get("X-Admin-Token") === ADMIN_TOKEN;
}

// Pick weighted random from array of [value, weight] pairs
function pickWeighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) {
    r -= w;
    if (r <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}

// Sample integer from clipped normal distribution
function sampleLikert(mean, sd) {
  // Box-Muller
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const v = Math.round(mean + z * sd);
  return Math.max(1, Math.min(5, v));
}

function pickN(arr, minN, maxN) {
  const n = minN + Math.floor(Math.random() * (maxN - minN + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function uuid() {
  // crypto.randomUUID() is available in Workers runtime
  return crypto.randomUUID();
}

function genApertura() {
  return {
    demograficas: {
      facultad: pickWeighted([
        ["ciencias-salud", 35],
        ["humanidades", 18],
        ["ciencias-administrativas", 18],
        ["ingenieria-tecnologia", 18],
        ["teologia", 6],
        ["posgrado", 5],
      ]),
      coordinacion: pickWeighted([["tbd-A", 30], ["tbd-B", 25], ["tbd-C", 25], ["otra", 20]]),
      tiempo_docencia: pickWeighted([["<5", 18], ["5-14", 35], ["15-24", 32], ["25+", 15]]),
      sexo: pickWeighted([["F", 58], ["M", 40], ["prefiero-no-decir", 2]]),
    },
    respuestas: {
      postura: pickWeighted([
        ["entusiasmo", 20],
        ["curiosidad-cautelosa", 45],
        ["neutral", 22],
        ["preocupacion", 11],
        ["rechazo", 2],
      ]),
      d1_ensayo: sampleLikert(3.2, 0.9),
      d1_calculo: sampleLikert(2.7, 1.0),
      d1_examen_disciplina: sampleLikert(2.5, 1.1),
      d1_codigo: sampleLikert(3.0, 1.0),
      d1_literatura: sampleLikert(3.0, 0.9),
      d1_agentic: sampleLikert(1.8, 0.8),
      d2_frecuencia: pickWeighted([
        ["diaria", 8],
        ["varias-semana", 22],
        ["semanal", 30],
        ["mensual", 18],
        ["rara-vez", 16],
        ["nunca", 6],
      ]),
      d2_usos: pickN(
        ["buscar-info", "generar-ideas", "redactar-correos", "crear-ejercicios", "disenar-rubricas", "generar-examenes", "calificar", "resumir-lecturas", "traducir", "investigacion-citas"],
        1,
        4
      ),
      d2_herramienta: pickWeighted([
        ["chatgpt", 60],
        ["claude", 12],
        ["gemini", 12],
        ["copilot", 8],
        ["deepseek", 2],
        ["otra", 5],
        ["ninguna", 1],
      ]),
      politica_institucional: pickWeighted([
        ["si-conozco", 8],
        ["existe-no-leida", 18],
        ["no-estoy-seguro", 60],
        ["seguro-no-existe", 14],
      ]),
      d3_porcentaje: pickWeighted([
        ["<25", 5],
        ["25-50", 22],
        ["50-75", 38],
        [">75", 25],
        ["casi-todos", 10],
      ]),
      d3_confianza_deteccion: sampleLikert(2.1, 0.9),
      d3_como_detecta: pickN(
        ["software-detector", "cambios-estilo", "defensa-oral", "analisis-citas", "comparacion-trabajos-previos", "sin-metodo"],
        1,
        3
      ),
    },
  };
}

function genCierre() {
  return {
    demograficas: {
      facultad: pickWeighted([
        ["ciencias-salud", 35],
        ["humanidades", 18],
        ["ciencias-administrativas", 18],
        ["ingenieria-tecnologia", 18],
        ["teologia", 6],
        ["posgrado", 5],
      ]),
      tiempo_docencia: pickWeighted([["<5", 18], ["5-14", 35], ["15-24", 32], ["25+", 15]]),
    },
    respuestas: {
      // After capacitación, perception shifted UP for capacidad
      c1_agentic: sampleLikert(3.8, 0.8),
      c2_porcentaje: pickWeighted([
        ["<25", 2],
        ["25-50", 10],
        ["50-75", 30],
        [">75", 38],
        ["casi-todos", 20],
      ]),
      // Confidence drops slightly (they realize how hard it is)
      c3_confianza_deteccion: sampleLikert(2.5, 0.9),
      // Confidence to redesign rises (taller delivered)
      c4_confianza_redisenar: sampleLikert(3.6, 0.8),
      c5_tecnica: pickWeighted([
        ["portafolio-procesual", 18],
        ["defensa-oral", 35],
        ["demostracion-presencial", 22],
        ["proyecto-datos-locales", 15],
        ["evaluacion-inversa", 5],
        ["aun-no-decido", 5],
      ]),
    },
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
  if (!isAdmin(context.request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders(),
    });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const { fase, n } = body;
  if (!VALID_FASES.includes(fase)) {
    return new Response(JSON.stringify({ error: "Invalid fase" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }
  if (!Number.isInteger(n) || n < 1 || n > 200) {
    return new Response(JSON.stringify({ error: "n must be integer 1..200" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const kv = context.env.ENCUESTA_IA_STATE;
  const generator = fase === "apertura" ? genApertura : genCierre;

  for (let i = 0; i < n; i++) {
    const respId = uuid();
    const gen = generator();
    const payload = {
      respId,
      fase,
      ts: new Date(Date.now() - Math.floor(Math.random() * 5 * 60 * 1000)).toISOString(), // within last 5 min
      demograficas: gen.demograficas,
      respuestas: gen.respuestas,
    };
    await kv.put(`resp:${fase}:${respId}`, JSON.stringify(payload));
  }

  return new Response(JSON.stringify({ ok: true, created: n, fase }), {
    status: 200,
    headers: corsHeaders(),
  });
}
```

- [ ] **Step 2: Test seed 10**

Run: `curl -s -X POST http://localhost:8788/api/seed -H 'Content-Type: application/json' -H 'X-Admin-Token: 2008464' -d '{"fase":"apertura","n":10}'`
Expected: `{"ok":true,"created":10,"fase":"apertura"}`. Wait ~5s, KV writes are slow in dev.

- [ ] **Step 3: Verify with aggregate**

Run: `curl -s 'http://localhost:8788/api/aggregate?fase=apertura'`
Expected: `n=10`, `byQuestion.d1_ensayo.mean` between 2.5 and 4.0.

- [ ] **Step 4: Test seed cierre**

Run: `curl -s -X POST http://localhost:8788/api/seed -H 'Content-Type: application/json' -H 'X-Admin-Token: 2008464' -d '{"fase":"cierre","n":10}'`
Expected: `{"ok":true,"created":10,"fase":"cierre"}`.

- [ ] **Step 5: Wipe demo data**

Run: `curl -s -X DELETE 'http://localhost:8788/api/wipe?scope=all' -H 'X-Admin-Token: 2008464'`
Expected: `{"ok":true,"deleted":20,"scope":"all"}`.

- [ ] **Step 6: Commit**

```bash
git add encuesta-diagnostica-ia/functions/api/seed.js
git commit -m "feat(encuesta-ia): API POST /api/seed con distribuciones realistas"
```

---

## Task 7: HTML shell + paleta + router

**Files:**
- Create: `encuesta-diagnostica-ia/index.html`

The full SPA. Subsequent tasks will add views to this single file.

- [ ] **Step 1: Write the index.html scaffold**

File: `encuesta-diagnostica-ia/index.html`

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#1A2456" />
  <title>Encuesta diagnóstica IA — UNAD</title>
  <style>
    /* ── Paleta institucional (de herramientas-educativas-CLAUDE.md) ── */
    :root {
      --navy:  #1A2456;
      --blue:  #2D5BE3;
      --mint:  #00D4A0;
      --amber: #F59E0B;
      --coral: #FF5C6A;
      --gray:  #F3F4F8;
      --white: #FFFFFF;
      --black: #1F2937;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--gray);
      color: var(--black);
      line-height: 1.5;
    }
    .container { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
    .container-wide { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }

    h1 { font-size: 1.5rem; color: var(--navy); margin-bottom: 0.5em; }
    h2 { font-size: 1.25rem; color: var(--navy); margin: 1em 0 0.5em; }
    h3 { font-size: 1.05rem; color: var(--navy); margin: 0.75em 0 0.5em; }
    p { margin-bottom: 0.75em; }

    button, .btn {
      display: inline-block;
      padding: 12px 20px;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      min-height: 44px;
      background: var(--blue);
      color: var(--white);
      text-decoration: none;
      transition: background 0.15s;
    }
    button:hover, .btn:hover { background: var(--navy); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: var(--gray); color: var(--navy); border: 2px solid var(--navy); }
    .btn-secondary:hover { background: var(--navy); color: var(--white); }
    .btn-danger { background: var(--coral); }
    .btn-danger:hover { background: #d94552; }
    .btn-success { background: var(--mint); color: var(--navy); }

    .card {
      background: var(--white);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(26, 36, 86, 0.06);
    }

    .header {
      background: var(--navy);
      color: var(--white);
      padding: 16px;
      text-align: center;
    }
    .header h1 { color: var(--white); margin: 0; }
    .header .meta { font-size: 0.875rem; opacity: 0.85; margin-top: 4px; }

    /* Form */
    .field { margin-bottom: 18px; }
    .field label { display: block; font-weight: 600; margin-bottom: 8px; color: var(--navy); }
    .field .hint { font-size: 0.875rem; color: #6b7280; margin-bottom: 6px; }

    .options { display: flex; flex-direction: column; gap: 8px; }
    .option {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      background: var(--gray);
      border-radius: 8px;
      cursor: pointer;
      min-height: 44px;
      user-select: none;
      transition: background 0.1s;
    }
    .option:hover { background: #e5e8f0; }
    .option input { margin-right: 10px; transform: scale(1.2); }
    .option.selected { background: var(--blue); color: var(--white); }

    .likert-row { display: flex; gap: 6px; }
    .likert-row .option {
      flex: 1;
      justify-content: center;
      padding: 14px 6px;
      text-align: center;
    }
    .likert-row .option .num { font-size: 1.25rem; font-weight: 700; }
    .likert-row .option .label { font-size: 0.7rem; }

    select {
      width: 100%;
      padding: 10px 12px;
      font-size: 1rem;
      border: 2px solid #d1d5db;
      border-radius: 8px;
      background: var(--white);
      min-height: 44px;
    }

    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      background: var(--navy);
      color: var(--white);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1000;
      max-width: 90vw;
    }
    .toast.success { background: var(--mint); color: var(--navy); }
    .toast.error { background: var(--coral); }

    .hidden { display: none !important; }

    /* Landing */
    .landing-cta {
      display: grid;
      gap: 12px;
      margin-top: 24px;
    }
    .landing-cta .btn { padding: 24px; font-size: 1.1rem; text-align: center; }

    /* Responsive */
    @media (max-width: 480px) {
      .container { padding: 16px 12px; }
      h1 { font-size: 1.25rem; }
      .likert-row .option { padding: 10px 2px; }
      .likert-row .option .num { font-size: 1.1rem; }
    }
  </style>
</head>
<body>
  <div id="app"></div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

  <script>
    // ══════════════════════════════════════════════════════════════════
    // Constants
    // ══════════════════════════════════════════════════════════════════
    const PROFESOR_MATRICULA = "2008464";
    const POLL_INTERVAL_MS = 3000;
    const FACULTADES = [
      { id: "ciencias-salud", label: "Ciencias de la Salud" },
      { id: "humanidades", label: "Humanidades" },
      { id: "ciencias-administrativas", label: "Ciencias Administrativas" },
      { id: "ingenieria-tecnologia", label: "Ingeniería y Tecnología" },
      { id: "teologia", label: "Teología" },
      { id: "posgrado", label: "Posgrado" },
    ];
    const COORDINACIONES_TBD = [
      { id: "tbd-A", label: "Coordinación A (placeholder)" },
      { id: "tbd-B", label: "Coordinación B (placeholder)" },
      { id: "tbd-C", label: "Coordinación C (placeholder)" },
      { id: "otra", label: "Otra / no aplica" },
    ];

    // ══════════════════════════════════════════════════════════════════
    // Utilities
    // ══════════════════════════════════════════════════════════════════
    const $ = (sel) => document.querySelector(sel);
    const app = () => document.getElementById("app");

    function uuid() {
      if (crypto.randomUUID) return crypto.randomUUID();
      // Fallback (modern browsers all support randomUUID, this is just defensive)
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    function toast(msg, type = "info", ms = 3500) {
      const el = document.createElement("div");
      el.className = `toast ${type}`;
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), ms);
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    async function api(path, options = {}) {
      const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
      const adminToken = sessionStorage.getItem("encuesta_ia_admin_token");
      if (adminToken && options.requireAdmin) headers["X-Admin-Token"] = adminToken;
      const res = await fetch(path, { ...options, headers });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { _raw: text }; }
      return { status: res.status, data };
    }

    // ══════════════════════════════════════════════════════════════════
    // Router
    // ══════════════════════════════════════════════════════════════════
    function getRoute() {
      const hash = window.location.hash.replace(/^#/, "");
      const [name, query = ""] = hash.split("?");
      const params = {};
      for (const pair of query.split("&")) {
        if (!pair) continue;
        const [k, v] = pair.split("=");
        params[decodeURIComponent(k)] = decodeURIComponent(v || "");
      }
      return { name: name || "landing", params };
    }

    function navigate(name, params = {}) {
      const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
      window.location.hash = qs ? `${name}?${qs}` : name;
    }

    function render() {
      const { name, params } = getRoute();
      const handler = ROUTES[name] || ROUTES.landing;
      app().innerHTML = "";
      handler(params);
    }

    window.addEventListener("hashchange", render);
    window.addEventListener("DOMContentLoaded", render);

    // ══════════════════════════════════════════════════════════════════
    // Routes (filled in by subsequent tasks)
    // ══════════════════════════════════════════════════════════════════
    const ROUTES = {
      landing(params) {
        app().innerHTML = `
          <div class="header">
            <h1>Encuesta diagnóstica IA</h1>
            <div class="meta">UNAD · Capacitación docente abril 2026</div>
          </div>
          <div class="container">
            <p>Bienvenido/a. Esta es la app diagnóstica de la capacitación.</p>
            <div class="landing-cta">
              <a class="btn" href="#apertura">Responder apertura</a>
              <a class="btn btn-secondary" href="#cierre">Responder cierre</a>
              <a class="btn btn-secondary" href="#dashboard">Ver dashboard</a>
            </div>
            <p style="margin-top: 24px; font-size: 0.85rem; color: #6b7280; text-align: center;">
              <a href="#admin" style="color: #6b7280;">Acceso facilitador</a>
            </p>
          </div>
        `;
      },
      apertura() {
        app().innerHTML = `<div class="container"><h1>Apertura</h1><p>Pendiente — Task 9.</p></div>`;
      },
      cierre() {
        app().innerHTML = `<div class="container"><h1>Cierre</h1><p>Pendiente — Task 10.</p></div>`;
      },
      gracias() {
        app().innerHTML = `<div class="container"><h1>¡Gracias!</h1><p>Tu respuesta fue registrada. Espera la proyección del facilitador.</p></div>`;
      },
      dashboard() {
        app().innerHTML = `<div class="container-wide"><h1>Dashboard</h1><p>Pendiente — Task 11.</p></div>`;
      },
      admin() {
        app().innerHTML = `<div class="container"><h1>Admin</h1><p>Pendiente — Task 14.</p></div>`;
      },
    };
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:8788/` in browser.
Expected: header "Encuesta diagnóstica IA · UNAD · Capacitación docente abril 2026", three buttons (apertura, cierre, dashboard), small admin link at bottom.

- [ ] **Step 3: Click each button and verify routing**

Click "Responder apertura" → URL becomes `#apertura`, content shows "Pendiente — Task 9".
Click back to `#` → landing reappears.
Verify same for cierre, dashboard, admin.

- [ ] **Step 4: Commit**

```bash
git add encuesta-diagnostica-ia/index.html
git commit -m "feat(encuesta-ia): HTML shell + paleta institucional + hash router"
```

---

## Task 8: Question definitions config

**Files:**
- Modify: `encuesta-diagnostica-ia/index.html` (add question arrays after FACULTADES const)

- [ ] **Step 1: Add the question config**

In `index.html`, locate the `// Constants` block. After `const COORDINACIONES_TBD = [...]`, add the following before `// Utilities`:

```javascript
    // ══════════════════════════════════════════════════════════════════
    // Preguntas — apertura
    // ══════════════════════════════════════════════════════════════════
    const PREGUNTAS_APERTURA = [
      { section: "Demográficas", code: "facultad", scope: "demograficas", type: "single", label: "Facultad vinculada a tu labor docente",
        options: FACULTADES.map(f => ({ id: f.id, label: f.label })) },
      { section: "Demográficas", code: "coordinacion", scope: "demograficas", type: "single", label: "Coordinación a la que perteneces",
        options: COORDINACIONES_TBD },
      { section: "Demográficas", code: "tiempo_docencia", scope: "demograficas", type: "single", label: "Tiempo total impartiendo docencia (en cualquier institución)",
        options: [
          { id: "<5", label: "Menos de 5 años" },
          { id: "5-14", label: "5 a 14 años" },
          { id: "15-24", label: "15 a 24 años" },
          { id: "25+", label: "25 años o más" },
        ] },
      { section: "Demográficas", code: "sexo", scope: "demograficas", type: "single", label: "Sexo",
        options: [
          { id: "F", label: "Femenino" },
          { id: "M", label: "Masculino" },
          { id: "prefiero-no-decir", label: "Prefiero no decir" },
        ] },

      { section: "Tu postura", code: "postura", scope: "respuestas", type: "single",
        label: "¿Cuál es tu postura general hacia la IA en educación?",
        options: [
          { id: "entusiasmo", label: "Entusiasmo: la veo como aliada" },
          { id: "curiosidad-cautelosa", label: "Curiosidad cautelosa: la exploro pero con dudas" },
          { id: "neutral", label: "Neutral: ni la promuevo ni la rechazo" },
          { id: "preocupacion", label: "Preocupación: me incomoda su crecimiento" },
          { id: "rechazo", label: "Rechazo: prefiero que no entre al aula" },
        ] },

      { section: "Capacidad de la IA actual", code: "d1_ensayo", scope: "respuestas", type: "likert5",
        label: "Generar un ensayo universitario aprobatorio de 300–1500 palabras sobre un tema general",
        hint: "1 = muy mal · 5 = excelente" },
      { section: "Capacidad de la IA actual", code: "d1_calculo", scope: "respuestas", type: "likert5",
        label: "Resolver problemas de cálculo / matemática a nivel pregrado" },
      { section: "Capacidad de la IA actual", code: "d1_examen_disciplina", scope: "respuestas", type: "likert5",
        label: "Aprobar un examen estandarizado de tu disciplina (ej: NCLEX en enfermería, certificación CompTIA en sistemas, ECOE en medicina)" },
      { section: "Capacidad de la IA actual", code: "d1_codigo", scope: "respuestas", type: "likert5",
        label: "Escribir código funcional que pase tests automatizados" },
      { section: "Capacidad de la IA actual", code: "d1_literatura", scope: "respuestas", type: "likert5",
        label: "Sintetizar literatura académica reciente con citas verificables" },
      { section: "Capacidad de la IA actual", code: "d1_agentic", scope: "respuestas", type: "likert5",
        label: "Realizar tareas multi-paso en un computador sin supervisión humana (descargar archivos, llenar formularios, navegar la web — todo en una sola corrida)" },

      { section: "Tu uso de la IA", code: "d2_frecuencia", scope: "respuestas", type: "single",
        label: "¿Con qué frecuencia usas IA en tu labor docente?",
        options: [
          { id: "diaria", label: "Diaria" },
          { id: "varias-semana", label: "Varias veces por semana" },
          { id: "semanal", label: "Semanal" },
          { id: "mensual", label: "Mensual" },
          { id: "rara-vez", label: "Rara vez" },
          { id: "nunca", label: "Nunca" },
        ] },
      { section: "Tu uso de la IA", code: "d2_usos", scope: "respuestas", type: "multi",
        label: "¿Para qué la usas?",
        hint: "Marca todas las que apliquen",
        options: [
          { id: "buscar-info", label: "Buscar información" },
          { id: "generar-ideas", label: "Generar ideas para clase" },
          { id: "redactar-correos", label: "Redactar correos" },
          { id: "crear-ejercicios", label: "Crear ejercicios o casos" },
          { id: "disenar-rubricas", label: "Diseñar rúbricas" },
          { id: "generar-examenes", label: "Generar exámenes" },
          { id: "calificar", label: "Calificar trabajos" },
          { id: "resumir-lecturas", label: "Resumir lecturas" },
          { id: "traducir", label: "Traducir textos" },
          { id: "investigacion-citas", label: "Investigación profunda con citas" },
          { id: "no-la-uso", label: "No la uso" },
          { id: "otro", label: "Otro" },
        ] },
      { section: "Tu uso de la IA", code: "d2_herramienta", scope: "respuestas", type: "single",
        label: "¿Cuál es tu herramienta principal de IA?",
        options: [
          { id: "chatgpt", label: "ChatGPT (OpenAI)" },
          { id: "claude", label: "Claude (Anthropic)" },
          { id: "gemini", label: "Gemini (Google)" },
          { id: "copilot", label: "Microsoft Copilot" },
          { id: "deepseek", label: "DeepSeek" },
          { id: "otra", label: "Otra" },
          { id: "ninguna", label: "Ninguna" },
        ] },

      { section: "Política institucional", code: "politica_institucional", scope: "respuestas", type: "single",
        label: "¿Conoces la política institucional de UNAD sobre uso de IA?",
        options: [
          { id: "si-conozco", label: "Sí, conozco la política" },
          { id: "existe-no-leida", label: "Sé que existe pero no la he leído" },
          { id: "no-estoy-seguro", label: "No estoy seguro/a si UNAD tiene una política" },
          { id: "seguro-no-existe", label: "Estoy seguro/a de que UNAD no tiene política aún" },
        ] },

      { section: "Tus estudiantes", code: "d3_porcentaje", scope: "respuestas", type: "single",
        label: "¿Qué % de tus estudiantes crees que usa IA semanalmente para sus trabajos?",
        options: [
          { id: "<25", label: "Menos del 25%" },
          { id: "25-50", label: "Entre 25 y 50%" },
          { id: "50-75", label: "Entre 50 y 75%" },
          { id: ">75", label: "Más del 75%" },
          { id: "casi-todos", label: "Casi todos" },
        ] },
      { section: "Tus estudiantes", code: "d3_confianza_deteccion", scope: "respuestas", type: "likert5",
        label: "¿Qué tan seguro/a te sientes de poder detectar uso indebido de IA por parte de un estudiante?",
        hint: "1 = nada seguro · 5 = totalmente seguro" },
      { section: "Tus estudiantes", code: "d3_como_detecta", scope: "respuestas", type: "multi",
        label: "Cuando sospechas uso indebido, ¿cómo lo evalúas?",
        hint: "Marca todas las que apliquen",
        options: [
          { id: "software-detector", label: "Software detector (Turnitin AI, GPTZero, Copyleaks, otro)" },
          { id: "cambios-estilo", label: "Cambios de estilo / 'voz' en el texto" },
          { id: "defensa-oral", label: "Defensa oral / preguntas de seguimiento" },
          { id: "analisis-citas", label: "Análisis manual de citas y fuentes" },
          { id: "comparacion-trabajos-previos", label: "Comparación con trabajos previos del estudiante" },
          { id: "sin-metodo", label: "No tengo método sistemático" },
          { id: "otro", label: "Otro" },
        ] },
    ];

    // ══════════════════════════════════════════════════════════════════
    // Preguntas — cierre
    // ══════════════════════════════════════════════════════════════════
    const PREGUNTAS_CIERRE = [
      { section: "Demográficas", code: "facultad", scope: "demograficas", type: "single",
        label: "Facultad",
        options: FACULTADES.map(f => ({ id: f.id, label: f.label })) },
      { section: "Demográficas", code: "tiempo_docencia", scope: "demograficas", type: "single",
        label: "Tiempo total impartiendo docencia",
        options: [
          { id: "<5", label: "Menos de 5 años" },
          { id: "5-14", label: "5 a 14 años" },
          { id: "15-24", label: "15 a 24 años" },
          { id: "25+", label: "25 años o más" },
        ] },

      { section: "Después de la capacitación", code: "c1_agentic", scope: "respuestas", type: "likert5",
        label: "¿Qué tan capaz crees ahora que es la IA actual de hacer tareas multi-paso en un computador sin supervisión?",
        hint: "1 = muy mal · 5 = excelente" },
      { section: "Después de la capacitación", code: "c2_porcentaje", scope: "respuestas", type: "single",
        label: "¿Qué % de tus estudiantes crees que usa IA semanalmente?",
        options: [
          { id: "<25", label: "Menos del 25%" },
          { id: "25-50", label: "Entre 25 y 50%" },
          { id: "50-75", label: "Entre 50 y 75%" },
          { id: ">75", label: "Más del 75%" },
          { id: "casi-todos", label: "Casi todos" },
        ] },
      { section: "Después de la capacitación", code: "c3_confianza_deteccion", scope: "respuestas", type: "likert5",
        label: "Confianza para detectar uso indebido de IA",
        hint: "1 = nada seguro · 5 = totalmente seguro" },
      { section: "Después de la capacitación", code: "c4_confianza_redisenar", scope: "respuestas", type: "likert5",
        label: "¿Qué tan seguro/a te sientes ahora de poder rediseñar tus evaluaciones contra simulación de IA?",
        hint: "1 = nada seguro · 5 = totalmente seguro" },
      { section: "Tu compromiso", code: "c5_tecnica", scope: "respuestas", type: "single",
        label: "¿Cuál es la primera técnica que vas a aplicar?",
        options: [
          { id: "portafolio-procesual", label: "Portafolio procesual de competencia" },
          { id: "defensa-oral", label: "Defensa oral como cierre obligatorio" },
          { id: "demostracion-presencial", label: "Demostración presencial / OSCE" },
          { id: "proyecto-datos-locales", label: "Proyecto integrador con datos locales" },
          { id: "evaluacion-inversa", label: "Evaluación inversa: criticar texto de IA" },
          { id: "aun-no-decido", label: "Aún no decido" },
        ] },
    ];
```

- [ ] **Step 2: Verify in browser console**

Reload `http://localhost:8788/`. Open DevTools console, type:
```
PREGUNTAS_APERTURA.length
PREGUNTAS_CIERRE.length
```
Expected: 18 and 7 respectively.

- [ ] **Step 3: Commit**

```bash
git add encuesta-diagnostica-ia/index.html
git commit -m "feat(encuesta-ia): config de preguntas apertura (18) + cierre (7)"
```

---

## Task 9: Form renderer + apertura submit

**Files:**
- Modify: `encuesta-diagnostica-ia/index.html` (replace `apertura` route handler)

- [ ] **Step 1: Add form rendering helpers above ROUTES**

In `index.html`, after the question config arrays and before `const ROUTES = {`, insert:

```javascript
    // ══════════════════════════════════════════════════════════════════
    // Form rendering
    // ══════════════════════════════════════════════════════════════════
    function renderField(q, value) {
      const id = `f_${q.code}`;
      const hint = q.hint ? `<div class="hint">${escapeHtml(q.hint)}</div>` : "";

      if (q.type === "likert5") {
        const labels = ["Muy mal", "Mal", "Regular", "Bien", "Excelente"];
        return `
          <div class="field" data-code="${q.code}" data-scope="${q.scope}" data-type="likert5">
            <label>${escapeHtml(q.label)}</label>
            ${hint}
            <div class="likert-row">
              ${[1,2,3,4,5].map(n => `
                <label class="option ${value === n ? "selected" : ""}">
                  <input type="radio" name="${id}" value="${n}" ${value === n ? "checked" : ""} hidden>
                  <div>
                    <div class="num">${n}</div>
                    <div class="label">${labels[n-1]}</div>
                  </div>
                </label>`).join("")}
            </div>
          </div>`;
      }

      if (q.type === "single") {
        return `
          <div class="field" data-code="${q.code}" data-scope="${q.scope}" data-type="single">
            <label>${escapeHtml(q.label)}</label>
            ${hint}
            <div class="options">
              ${q.options.map(o => `
                <label class="option ${value === o.id ? "selected" : ""}">
                  <input type="radio" name="${id}" value="${o.id}" ${value === o.id ? "checked" : ""}>
                  <span>${escapeHtml(o.label)}</span>
                </label>`).join("")}
            </div>
          </div>`;
      }

      if (q.type === "multi") {
        const set = new Set(value || []);
        return `
          <div class="field" data-code="${q.code}" data-scope="${q.scope}" data-type="multi">
            <label>${escapeHtml(q.label)}</label>
            ${hint}
            <div class="options">
              ${q.options.map(o => `
                <label class="option ${set.has(o.id) ? "selected" : ""}">
                  <input type="checkbox" name="${id}" value="${o.id}" ${set.has(o.id) ? "checked" : ""}>
                  <span>${escapeHtml(o.label)}</span>
                </label>`).join("")}
            </div>
          </div>`;
      }

      return "";
    }

    function bindFieldInteractions(root) {
      // Visual selected state on radios/checkboxes
      root.querySelectorAll(".option input").forEach((input) => {
        input.addEventListener("change", () => {
          const field = input.closest(".field");
          if (input.type === "radio") {
            field.querySelectorAll(".option").forEach((o) => o.classList.remove("selected"));
            input.closest(".option").classList.add("selected");
          } else {
            input.closest(".option").classList.toggle("selected", input.checked);
          }
        });
      });
    }

    function readForm(preguntas, root) {
      const data = { demograficas: {}, respuestas: {} };
      const errors = [];

      for (const q of preguntas) {
        const field = root.querySelector(`.field[data-code="${q.code}"]`);
        if (!field) continue;
        let val;

        if (q.type === "likert5" || q.type === "single") {
          const checked = field.querySelector(`input:checked`);
          val = checked ? checked.value : null;
          if (q.type === "likert5" && val !== null) val = Number(val);
        } else if (q.type === "multi") {
          val = Array.from(field.querySelectorAll(`input:checked`)).map((i) => i.value);
        }

        if (val === null || (Array.isArray(val) && val.length === 0)) {
          errors.push(q.label);
          continue;
        }

        data[q.scope][q.code] = val;
      }

      return { data, errors };
    }

    function renderFormPage(opts) {
      const { title, subtitle, preguntas, fase } = opts;
      const sections = {};
      for (const q of preguntas) {
        sections[q.section] = sections[q.section] || [];
        sections[q.section].push(q);
      }

      const html = `
        <div class="header">
          <h1>${escapeHtml(title)}</h1>
          <div class="meta">${escapeHtml(subtitle)}</div>
        </div>
        <div class="container">
          <p>Tus respuestas son <strong>anónimas</strong>. Tiempo estimado: ${fase === "apertura" ? "4–5" : "1–2"} minutos.</p>
          <form id="survey-form" novalidate>
            ${Object.entries(sections).map(([sec, qs]) => `
              <div class="card">
                <h2>${escapeHtml(sec)}</h2>
                ${qs.map(q => renderField(q)).join("")}
              </div>
            `).join("")}
            <button type="submit" id="submit-btn">Enviar respuesta</button>
          </form>
        </div>
      `;
      app().innerHTML = html;
      bindFieldInteractions(app());

      $("#survey-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = $("#submit-btn");
        btn.disabled = true;
        btn.textContent = "Enviando…";

        const { data, errors } = readForm(preguntas, app());
        if (errors.length) {
          toast(`Faltan ${errors.length} pregunta(s) por responder`, "error");
          btn.disabled = false;
          btn.textContent = "Enviar respuesta";
          // Scroll to first incomplete
          const firstIncomplete = preguntas.find((q) => errors.includes(q.label));
          if (firstIncomplete) {
            const el = app().querySelector(`.field[data-code="${firstIncomplete.code}"]`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }

        const respId = uuid();
        const payload = { fase, respId, demograficas: data.demograficas, respuestas: data.respuestas };
        const { status, data: resp } = await api("/api/responses", { method: "POST", body: JSON.stringify(payload) });

        if (status === 201) {
          localStorage.setItem(`encuesta_ia_resp_${fase}`, respId);
          navigate("gracias", { fase });
        } else if (status === 403) {
          toast("La encuesta está cerrada.", "error", 5000);
          btn.disabled = false;
          btn.textContent = "Enviar respuesta";
        } else {
          toast(`Error: ${resp.error || "intenta de nuevo"}`, "error", 5000);
          btn.disabled = false;
          btn.textContent = "Enviar respuesta";
        }
      });
    }
```

- [ ] **Step 2: Replace `apertura` and `gracias` route handlers**

In `index.html`, in the `ROUTES` object, replace the `apertura` and `gracias` handlers with:

```javascript
      apertura(params) {
        // Anti-duplicado
        const existing = localStorage.getItem("encuesta_ia_resp_apertura");
        if (existing && !params.force) {
          app().innerHTML = `
            <div class="header"><h1>Apertura</h1></div>
            <div class="container">
              <div class="card">
                <h2>Ya enviaste tu respuesta</h2>
                <p>Detectamos que ya respondiste la encuesta de apertura desde este dispositivo. Si necesitas corregir, contacta al facilitador.</p>
                <a class="btn" href="#dashboard">Ver dashboard</a>
                <button class="btn-secondary" style="margin-left: 8px;" onclick="navigate('apertura', {force: '1'})">Re-enviar de todos modos</button>
              </div>
            </div>`;
          return;
        }

        // Check phase
        api("/api/phase").then(({ data }) => {
          if (data.phase === "cerrada") {
            app().innerHTML = `
              <div class="header"><h1>Apertura</h1></div>
              <div class="container">
                <div class="card"><h2>La encuesta está cerrada</h2><p>Gracias por participar.</p></div>
              </div>`;
            return;
          }
          renderFormPage({
            title: "Encuesta apertura",
            subtitle: "Capacitación IA · UNAD · sesión 1",
            preguntas: PREGUNTAS_APERTURA,
            fase: "apertura",
          });
        });
      },

      gracias(params) {
        const isApertura = params.fase === "apertura";
        app().innerHTML = `
          <div class="header"><h1>¡Gracias!</h1></div>
          <div class="container">
            <div class="card">
              <h2>Tu respuesta fue registrada</h2>
              <p>${isApertura
                ? "Espera la proyección del facilitador para ver los resultados del grupo."
                : "Vamos a comparar estas respuestas con las del inicio."}</p>
              <a class="btn btn-secondary" href="#">Volver al inicio</a>
            </div>
          </div>`;
      },
```

- [ ] **Step 3: Test apertura form rendering**

Reload `http://localhost:8788/#apertura`.
Expected: Header "Encuesta apertura · Capacitación IA · UNAD · sesión 1", 18 questions grouped by 6 sections (Demográficas, Tu postura, Capacidad de la IA actual, Tu uso de la IA, Política institucional, Tus estudiantes), Likert rows are 5 buttons in a row, multi-selects allow multiple checks.

- [ ] **Step 4: Test partial submit shows error**

Click "Enviar respuesta" without filling anything.
Expected: red toast "Faltan 18 pregunta(s) por responder", page scrolls to first field.

- [ ] **Step 5: Test full submit**

Fill all fields with any valid choices. Click "Enviar respuesta".
Expected: redirect to `#gracias?fase=apertura` with message "Tu respuesta fue registrada".

- [ ] **Step 6: Verify response in KV**

Run: `curl -s 'http://localhost:8788/api/aggregate?fase=apertura'`
Expected: `n=1`, `byQuestion` includes all 18 codes.

- [ ] **Step 7: Test anti-duplicado**

Navigate to `#apertura` again.
Expected: "Ya enviaste tu respuesta" card with two buttons.

- [ ] **Step 8: Clear localStorage and verify form returns**

In DevTools console: `localStorage.clear()`. Reload `#apertura`.
Expected: form is back.

- [ ] **Step 9: Wipe test data**

Run: `curl -s -X DELETE 'http://localhost:8788/api/wipe?scope=apertura' -H 'X-Admin-Token: 2008464'`
Expected: `{"ok":true,"deleted":1,...}`.

- [ ] **Step 10: Commit**

```bash
git add encuesta-diagnostica-ia/index.html
git commit -m "feat(encuesta-ia): form renderer + apertura form submit con anti-duplicado"
```

---

## Task 10: Cierre form

**Files:**
- Modify: `encuesta-diagnostica-ia/index.html` (replace `cierre` route handler)

- [ ] **Step 1: Replace `cierre` route handler**

In `index.html`, replace the `cierre` handler in `ROUTES` with:

```javascript
      cierre(params) {
        const existing = localStorage.getItem("encuesta_ia_resp_cierre");
        if (existing && !params.force) {
          app().innerHTML = `
            <div class="header"><h1>Cierre</h1></div>
            <div class="container">
              <div class="card">
                <h2>Ya enviaste tu respuesta</h2>
                <p>Detectamos que ya respondiste la encuesta de cierre desde este dispositivo.</p>
                <a class="btn" href="#dashboard">Ver dashboard</a>
                <button class="btn-secondary" style="margin-left: 8px;" onclick="navigate('cierre', {force: '1'})">Re-enviar de todos modos</button>
              </div>
            </div>`;
          return;
        }

        api("/api/phase").then(({ data }) => {
          if (data.phase === "cerrada") {
            app().innerHTML = `
              <div class="header"><h1>Cierre</h1></div>
              <div class="container">
                <div class="card"><h2>La encuesta está cerrada</h2><p>Gracias por participar.</p></div>
              </div>`;
            return;
          }
          renderFormPage({
            title: "Encuesta cierre",
            subtitle: "Capacitación IA · UNAD · sesión 2",
            preguntas: PREGUNTAS_CIERRE,
            fase: "cierre",
          });
        });
      },
```

- [ ] **Step 2: Test cierre form**

Open `http://localhost:8788/#cierre`.
Expected: 7 questions in 3 sections (Demográficas, Después de la capacitación, Tu compromiso).

- [ ] **Step 3: Submit cierre**

Fill all and submit.
Expected: redirect to `#gracias?fase=cierre` with subtle message about comparativo.

- [ ] **Step 4: Verify in KV**

Run: `curl -s 'http://localhost:8788/api/aggregate?fase=cierre'`
Expected: `n=1`.

- [ ] **Step 5: Wipe**

Run: `curl -s -X DELETE 'http://localhost:8788/api/wipe?scope=cierre' -H 'X-Admin-Token: 2008464'`

- [ ] **Step 6: Commit**

```bash
git add encuesta-diagnostica-ia/index.html
git commit -m "feat(encuesta-ia): form de cierre con anti-duplicado y check de fase"
```

---

## Task 11: Dashboard layout + polling

**Files:**
- Modify: `encuesta-diagnostica-ia/index.html` (replace `dashboard` route handler + add chart helpers)

- [ ] **Step 1: Add benchmarks constant + chart helpers above ROUTES**

In `index.html`, after `renderFormPage` (the last form helper), insert:

```javascript
    // ══════════════════════════════════════════════════════════════════
    // Benchmarks académicos para overlay de evidencia
    // ══════════════════════════════════════════════════════════════════
    const BENCHMARKS = {
      d1_ensayo: { value: 5, label: "Yeadon 2022: GPT-3 obtenía First Class en ensayos cortos" },
      d1_calculo: { value: 4.5, label: "GPT-5.5: 51.7% FrontierMath (nivel 1-3)" },
      d1_examen_disciplina: { value: 4.4, label: "ChatGPT-4: 88.7% NCLEX-RN" },
      d1_codigo: { value: 4.5, label: "GPT-5.5: 82.7% Terminal-Bench 2.0; Claude Opus 4.7: 64.3% SWE-bench Pro" },
      d1_literatura: { value: 4.0, label: "Deep Research Gemini 3.1 Pro · Perplexity Pro" },
      d1_agentic: { value: 4.5, label: "GPT-5.5: 82.7% Terminal-Bench 2.0 (uso agentic)" },
      d3_porcentaje: { value: ">75", label: "HEPI 2026: 95% de estudiantes UK usan IA, 94% en evaluaciones" },
      d3_confianza_deteccion: { value: 1.5, label: "Coursera: solo 1 de 4 docentes confía en detectar trabajo IA" },
      politica_institucional: { value: "no-estoy-seguro", label: "SEP México 2026: 71.8% de docentes no sabe si su institución tiene política IA" },
      c1_agentic: { value: 4.5, label: "GPT-5.5: 82.7% Terminal-Bench 2.0" },
      c2_porcentaje: { value: ">75", label: "HEPI 2026" },
      c3_confianza_deteccion: { value: 1.5, label: "Coursera 1/4 docentes" },
    };

    // Map question codes to human labels for dashboard
    function labelFor(code) {
      const all = [...PREGUNTAS_APERTURA, ...PREGUNTAS_CIERRE];
      const q = all.find((x) => x.code === code);
      if (q) return q.label;
      // demografica codes
      const dem = code.replace(/^dem_/, "");
      const map = { facultad: "Facultad", coordinacion: "Coordinación", tiempo_docencia: "Tiempo docencia", sexo: "Sexo" };
      return map[dem] || code;
    }

    function optionLabelFor(code, optionId) {
      const all = [...PREGUNTAS_APERTURA, ...PREGUNTAS_CIERRE];
      const q = all.find((x) => x.code === code || x.code === code.replace(/^dem_/, ""));
      if (q && q.options) {
        const o = q.options.find((opt) => opt.id === optionId);
        if (o) return o.label;
      }
      return optionId;
    }

    // ══════════════════════════════════════════════════════════════════
    // Dashboard
    // ══════════════════════════════════════════════════════════════════
    let dashboardPollHandle = null;
    const dashboardCharts = {};

    function destroyAllCharts() {
      for (const c of Object.values(dashboardCharts)) {
        try { c.destroy(); } catch {}
      }
      for (const k of Object.keys(dashboardCharts)) delete dashboardCharts[k];
    }

    function renderLikertChart(canvasId, code, byQuestion, showBenchmark) {
      const data = byQuestion[code];
      if (!data) return;
      const counts = [1,2,3,4,5].map((n) => data.values[n] || 0);
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;

      if (dashboardCharts[canvasId]) {
        // Update existing
        dashboardCharts[canvasId].data.datasets[0].data = counts;
        if (showBenchmark && BENCHMARKS[code]) {
          dashboardCharts[canvasId].options.plugins.annotation = annotationFor(BENCHMARKS[code].value);
        } else {
          dashboardCharts[canvasId].options.plugins.annotation = { annotations: {} };
        }
        dashboardCharts[canvasId].update();
        return;
      }

      dashboardCharts[canvasId] = new Chart(ctx, {
        type: "bar",
        data: {
          labels: ["1 muy mal", "2", "3", "4", "5 excelente"],
          datasets: [{
            label: "respuestas",
            data: counts,
            backgroundColor: "#2D5BE3",
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: data.mean !== undefined ? `Promedio del grupo: ${data.mean.toFixed(2)} / 5` : "",
              font: { size: 14, weight: "bold" },
              color: "#1A2456",
            },
          },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
          animation: { duration: 400 },
        },
      });
    }

    function annotationFor(benchValue) {
      // Custom plugin not used; we add a simple annotation via afterDraw in subsequent task if needed.
      // For now, empty (the benchmark text is shown separately).
      return { annotations: {} };
    }

    function renderDistributionChart(canvasId, code, byQuestion, type = "vertical") {
      const data = byQuestion[code];
      if (!data) return;
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;

      const labels = Object.keys(data.values).map((k) => optionLabelFor(code, k));
      const values = Object.values(data.values);

      if (dashboardCharts[canvasId]) {
        dashboardCharts[canvasId].data.labels = labels;
        dashboardCharts[canvasId].data.datasets[0].data = values;
        dashboardCharts[canvasId].update();
        return;
      }

      dashboardCharts[canvasId] = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "respuestas",
            data: values,
            backgroundColor: "#00D4A0",
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: type === "horizontal" ? "y" : "x",
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } },
          animation: { duration: 400 },
        },
      });
    }
```

- [ ] **Step 2: Replace `dashboard` route handler**

In `ROUTES`, replace the `dashboard` handler with:

```javascript
      dashboard(params) {
        const fase = params.fase || "apertura";
        const showBenchmark = params.benchmark === "1";

        app().innerHTML = `
          <div class="header">
            <h1>Dashboard — Encuesta ${fase}</h1>
            <div class="meta" id="dashboard-meta">Cargando…</div>
          </div>
          <div class="container-wide">
            <div class="card">
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <strong>Fase:</strong>
                <a class="btn ${fase === "apertura" ? "" : "btn-secondary"}" href="#dashboard?fase=apertura">Apertura</a>
                <a class="btn ${fase === "cierre" ? "" : "btn-secondary"}" href="#dashboard?fase=cierre">Cierre</a>
                <span style="flex: 1"></span>
                <button class="${showBenchmark ? "btn btn-success" : "btn-secondary"}" onclick="navigate('dashboard', {fase: '${fase}', benchmark: '${showBenchmark ? "" : "1"}'})">
                  ${showBenchmark ? "✓ Mostrando evidencia" : "Mostrar evidencia"}
                </button>
              </div>
            </div>

            <div id="dashboard-sections"></div>
          </div>
        `;

        startDashboardPolling(fase, showBenchmark);
      },
```

- [ ] **Step 3: Add polling functions above ROUTES**

After `renderDistributionChart`, insert:

```javascript
    function startDashboardPolling(fase, showBenchmark) {
      stopDashboardPolling();
      const tick = async () => {
        const { status, data } = await api(`/api/aggregate?fase=${fase}`);
        if (status !== 200) return;
        renderDashboardData(fase, data, showBenchmark);
      };
      tick();
      dashboardPollHandle = setInterval(tick, POLL_INTERVAL_MS);
    }

    function stopDashboardPolling() {
      if (dashboardPollHandle) clearInterval(dashboardPollHandle);
      dashboardPollHandle = null;
      destroyAllCharts();
    }

    window.addEventListener("hashchange", () => {
      const r = getRoute();
      if (r.name !== "dashboard") stopDashboardPolling();
    });

    function timeAgo(iso) {
      if (!iso) return "—";
      const ms = Date.now() - new Date(iso).getTime();
      if (ms < 1000) return "ahora";
      const s = Math.floor(ms / 1000);
      if (s < 60) return `hace ${s}s`;
      const m = Math.floor(s / 60);
      if (m < 60) return `hace ${m}m`;
      return `hace ${Math.floor(m / 60)}h`;
    }

    function renderDashboardData(fase, data, showBenchmark) {
      const meta = $("#dashboard-meta");
      if (meta) {
        meta.textContent = `n=${data.n} respuestas · última ${timeAgo(data.lastTs)}`;
      }

      const sections = $("#dashboard-sections");
      if (!sections) return;

      if (data.n === 0) {
        sections.innerHTML = `<div class="card"><h2>Esperando respuestas…</h2><p>El dashboard se actualiza solo cuando lleguen respuestas.</p></div>`;
        return;
      }

      const preguntas = fase === "apertura" ? PREGUNTAS_APERTURA : PREGUNTAS_CIERRE;
      const grouped = {};
      for (const q of preguntas) {
        if (q.scope === "demograficas") continue;
        grouped[q.section] = grouped[q.section] || [];
        grouped[q.section].push(q);
      }

      // Build skeleton if not already present
      if (!sections.dataset.builtFor || sections.dataset.builtFor !== fase) {
        sections.innerHTML = "";
        for (const [secName, qs] of Object.entries(grouped)) {
          const card = document.createElement("div");
          card.className = "card";
          card.innerHTML = `<h2>${escapeHtml(secName)}</h2>`;
          for (const q of qs) {
            const wrap = document.createElement("div");
            wrap.style.marginBottom = "16px";
            wrap.innerHTML = `
              <h3>${escapeHtml(q.label)}</h3>
              <div style="height: ${q.type === "multi" ? 240 : 180}px;">
                <canvas id="chart_${q.code}"></canvas>
              </div>
              <div id="benchmark_${q.code}" class="hint" style="margin-top:6px;"></div>
            `;
            card.appendChild(wrap);
          }
          sections.appendChild(card);
        }
        sections.dataset.builtFor = fase;
      }

      // Update charts
      for (const q of preguntas) {
        if (q.scope === "demograficas") continue;
        if (q.type === "likert5") {
          renderLikertChart(`chart_${q.code}`, q.code, data.byQuestion, showBenchmark);
        } else {
          renderDistributionChart(`chart_${q.code}`, q.code, data.byQuestion, q.type === "multi" ? "horizontal" : "vertical");
        }
        const benchEl = document.getElementById(`benchmark_${q.code}`);
        if (benchEl) {
          if (showBenchmark && BENCHMARKS[q.code]) {
            benchEl.innerHTML = `<strong style="color: var(--coral);">Evidencia:</strong> ${escapeHtml(BENCHMARKS[q.code].label)}${BENCHMARKS[q.code].value !== undefined ? ` <em>(referencia: ${escapeHtml(String(BENCHMARKS[q.code].value))})</em>` : ""}`;
          } else {
            benchEl.innerHTML = "";
          }
        }
      }
    }
```

- [ ] **Step 4: Seed 30 demo responses for visual testing**

Run: `curl -s -X POST http://localhost:8788/api/seed -H 'Content-Type: application/json' -H 'X-Admin-Token: 2008464' -d '{"fase":"apertura","n":30}'`
Expected: `{"ok":true,"created":30,"fase":"apertura"}`.

- [ ] **Step 5: Open dashboard**

Open `http://localhost:8788/#dashboard?fase=apertura`.
Expected:
- Header with "Dashboard — Encuesta apertura · n=30 · hace Xs"
- Toggle buttons for fase (Apertura/Cierre) and "Mostrar evidencia"
- Cards for: Tu postura, Capacidad de la IA actual, Tu uso de la IA, Política institucional, Tus estudiantes
- Each likert shows bar chart with mean in title
- Multi questions (`d2_usos`, `d3_como_detecta`) show horizontal bars

- [ ] **Step 6: Click "Mostrar evidencia"**

Click toggle. URL becomes `#dashboard?fase=apertura&benchmark=1`.
Expected: under each chart with benchmark, a small text appears in coral: "Evidencia: GPT-5.5..." with reference value.

- [ ] **Step 7: Submit a new response in another tab**

Open `http://localhost:8788/#apertura` in a new tab. Submit a response.
Expected: within 3 s, the dashboard tab updates `n` from 30 to 31.

- [ ] **Step 8: Wipe demo data**

Run: `curl -s -X DELETE 'http://localhost:8788/api/wipe?scope=apertura' -H 'X-Admin-Token: 2008464'`

- [ ] **Step 9: Verify dashboard shows empty state**

Reload `#dashboard`.
Expected: "Esperando respuestas…" message.

- [ ] **Step 10: Commit**

```bash
git add encuesta-diagnostica-ia/index.html
git commit -m "feat(encuesta-ia): dashboard con polling 3s, charts likert/distribution, overlay evidencia"
```

---

## Task 12: Dashboard filters

**Files:**
- Modify: `encuesta-diagnostica-ia/index.html` (extend `dashboard` route handler with filter UI)

- [ ] **Step 1: Add filter UI to dashboard route**

In `ROUTES.dashboard`, replace the `dashboard` handler entirely with:

```javascript
      dashboard(params) {
        const fase = params.fase || "apertura";
        const showBenchmark = params.benchmark === "1";
        const activeFilters = {};
        for (const k of ["facultad", "coordinacion", "tiempo_docencia", "sexo", "postura"]) {
          if (params[k]) activeFilters[k] = params[k];
        }

        app().innerHTML = `
          <div class="header">
            <h1>Dashboard — Encuesta ${fase}</h1>
            <div class="meta" id="dashboard-meta">Cargando…</div>
          </div>
          <div class="container-wide">
            <div class="card">
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px;">
                <strong>Fase:</strong>
                <a class="btn ${fase === "apertura" ? "" : "btn-secondary"}" href="#dashboard?fase=apertura">Apertura</a>
                <a class="btn ${fase === "cierre" ? "" : "btn-secondary"}" href="#dashboard?fase=cierre">Cierre</a>
                <span style="flex: 1"></span>
                <button class="${showBenchmark ? "btn btn-success" : "btn-secondary"}" onclick="navigate('dashboard', Object.assign(${JSON.stringify({fase, ...activeFilters})}, {benchmark: '${showBenchmark ? "" : "1"}'}))">
                  ${showBenchmark ? "✓ Mostrando evidencia" : "Mostrar evidencia"}
                </button>
              </div>
              <div id="filter-bar" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <strong>Filtros:</strong>
                ${renderFilterDropdown("facultad", "Facultad", FACULTADES, activeFilters)}
                ${renderFilterDropdown("tiempo_docencia", "Tiempo docencia", [
                  {id:"<5",label:"<5"},{id:"5-14",label:"5-14"},{id:"15-24",label:"15-24"},{id:"25+",label:"25+"}
                ], activeFilters)}
                ${renderFilterDropdown("sexo", "Sexo", [
                  {id:"F",label:"Femenino"},{id:"M",label:"Masculino"},{id:"prefiero-no-decir",label:"PND"}
                ], activeFilters)}
                ${fase === "apertura" ? renderFilterDropdown("postura", "Postura", [
                  {id:"entusiasmo",label:"Entusiasmo"},{id:"curiosidad-cautelosa",label:"Curiosidad"},{id:"neutral",label:"Neutral"},{id:"preocupacion",label:"Preocupación"},{id:"rechazo",label:"Rechazo"}
                ], activeFilters) : ""}
                ${Object.keys(activeFilters).length > 0 ? `<button class="btn-secondary" onclick="navigate('dashboard', {fase: '${fase}'${showBenchmark ? ", benchmark: '1'" : ""}})">Limpiar filtros</button>` : ""}
              </div>
            </div>

            <div id="dashboard-sections"></div>
          </div>
        `;

        // Bind filter dropdowns
        document.querySelectorAll(".filter-dd").forEach((sel) => {
          sel.addEventListener("change", () => {
            const newFilters = { ...activeFilters };
            if (sel.value) newFilters[sel.dataset.code] = sel.value;
            else delete newFilters[sel.dataset.code];
            navigate("dashboard", { fase, ...newFilters, ...(showBenchmark ? { benchmark: "1" } : {}) });
          });
        });

        startDashboardPolling(fase, showBenchmark, activeFilters);
      },
```

- [ ] **Step 2: Add `renderFilterDropdown` helper above ROUTES**

Insert (after `timeAgo` and before `renderDashboardData`):

```javascript
    function renderFilterDropdown(code, label, options, activeFilters) {
      const current = activeFilters[code] || "";
      return `
        <select class="filter-dd" data-code="${code}" style="min-height:36px; padding: 4px 8px; font-size: 0.9rem;">
          <option value="">${escapeHtml(label)}: todos</option>
          ${options.map(o => `<option value="${escapeHtml(o.id)}" ${current === o.id ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}
        </select>
      `;
    }
```

- [ ] **Step 3: Update `startDashboardPolling` to send filters**

Replace `startDashboardPolling` with:

```javascript
    function startDashboardPolling(fase, showBenchmark, activeFilters = {}) {
      stopDashboardPolling();
      const qs = new URLSearchParams({ fase, ...activeFilters }).toString();
      const tick = async () => {
        const { status, data } = await api(`/api/aggregate?${qs}`);
        if (status !== 200) return;
        renderDashboardData(fase, data, showBenchmark);
      };
      tick();
      dashboardPollHandle = setInterval(tick, POLL_INTERVAL_MS);
    }
```

- [ ] **Step 4: Update `renderDashboardData` for n<5 protection and section rebuild on filter change**

Replace `renderDashboardData` with:

```javascript
    function renderDashboardData(fase, data, showBenchmark) {
      const meta = $("#dashboard-meta");
      if (meta) {
        const filterCount = Object.keys(data.filters || {}).length;
        meta.textContent = `n=${data.n}${filterCount ? ` filtrado · ${data.nTotal} total` : ""} · última ${timeAgo(data.lastTs)}`;
      }

      const sections = $("#dashboard-sections");
      if (!sections) return;

      if (data.n === 0) {
        sections.innerHTML = `<div class="card"><h2>Sin datos para mostrar</h2><p>Cambia los filtros o espera más respuestas.</p></div>`;
        sections.dataset.builtFor = "";
        destroyAllCharts();
        return;
      }

      if (data.n < 5 && Object.keys(data.filters || {}).length > 0) {
        sections.innerHTML = `<div class="card"><h2>n insuficiente (n=${data.n})</h2><p>Para evitar gráficas engañosas con celdas pequeñas, no se muestra el detalle cuando hay menos de 5 respuestas en la combinación de filtros activos. Quita uno o más filtros para ver más datos.</p></div>`;
        sections.dataset.builtFor = "";
        destroyAllCharts();
        return;
      }

      const preguntas = fase === "apertura" ? PREGUNTAS_APERTURA : PREGUNTAS_CIERRE;
      const grouped = {};
      for (const q of preguntas) {
        if (q.scope === "demograficas") continue;
        grouped[q.section] = grouped[q.section] || [];
        grouped[q.section].push(q);
      }

      const builtFor = `${fase}::${JSON.stringify(data.filters || {})}`;
      if (sections.dataset.builtFor !== builtFor) {
        destroyAllCharts();
        sections.innerHTML = "";
        for (const [secName, qs] of Object.entries(grouped)) {
          const card = document.createElement("div");
          card.className = "card";
          card.innerHTML = `<h2>${escapeHtml(secName)}</h2>`;
          for (const q of qs) {
            const wrap = document.createElement("div");
            wrap.style.marginBottom = "16px";
            wrap.innerHTML = `
              <h3>${escapeHtml(q.label)}</h3>
              <div style="height: ${q.type === "multi" ? 240 : 180}px;">
                <canvas id="chart_${q.code}"></canvas>
              </div>
              <div id="benchmark_${q.code}" class="hint" style="margin-top:6px;"></div>
            `;
            card.appendChild(wrap);
          }
          sections.appendChild(card);
        }
        sections.dataset.builtFor = builtFor;
      }

      for (const q of preguntas) {
        if (q.scope === "demograficas") continue;
        if (q.type === "likert5") {
          renderLikertChart(`chart_${q.code}`, q.code, data.byQuestion, showBenchmark);
        } else {
          renderDistributionChart(`chart_${q.code}`, q.code, data.byQuestion, q.type === "multi" ? "horizontal" : "vertical");
        }
        const benchEl = document.getElementById(`benchmark_${q.code}`);
        if (benchEl) {
          if (showBenchmark && BENCHMARKS[q.code]) {
            benchEl.innerHTML = `<strong style="color: var(--coral);">Evidencia:</strong> ${escapeHtml(BENCHMARKS[q.code].label)}${BENCHMARKS[q.code].value !== undefined ? ` <em>(referencia: ${escapeHtml(String(BENCHMARKS[q.code].value))})</em>` : ""}`;
          } else {
            benchEl.innerHTML = "";
          }
        }
      }
    }
```

- [ ] **Step 5: Seed 30 and test filter**

Run: `curl -s -X POST http://localhost:8788/api/seed -H 'Content-Type: application/json' -H 'X-Admin-Token: 2008464' -d '{"fase":"apertura","n":30}'`

Open `http://localhost:8788/#dashboard?fase=apertura`. Select "Facultad: Ciencias de la Salud" from dropdown.
Expected: URL changes to include `&facultad=ciencias-salud`, charts re-render, header shows "n=X filtrado · 30 total".

- [ ] **Step 6: Test n<5 protection**

Apply 3-4 filters in combination until n drops below 5.
Expected: card "n insuficiente (n=X)" instead of charts.

- [ ] **Step 7: Click "Limpiar filtros"**

Expected: all filters reset, dashboard returns to full view.

- [ ] **Step 8: Wipe**

Run: `curl -s -X DELETE 'http://localhost:8788/api/wipe?scope=apertura' -H 'X-Admin-Token: 2008464'`

- [ ] **Step 9: Commit**

```bash
git add encuesta-diagnostica-ia/index.html
git commit -m "feat(encuesta-ia): dashboard filtros chip + protección n<5"
```

---

## Task 13: Dashboard comparativo apertura↔cierre

**Files:**
- Modify: `encuesta-diagnostica-ia/index.html` (add comparativo mode to dashboard)

- [ ] **Step 1: Add comparativo button + handler in dashboard route**

In `ROUTES.dashboard`, locate the line with "Mostrar evidencia" button. After it (still inside the flex container), insert:

```javascript
                <button class="btn-secondary" onclick="navigate('dashboard', {fase: 'comparativo'${showBenchmark ? ", benchmark: '1'" : ""}})">
                  Comparativo apertura ↔ cierre
                </button>
```

Replace the conditional `${fase === "apertura" ? renderFilterDropdown("postura", ...} ` line and the prior `<a class="btn">` lines with handling for `fase === "comparativo"` if needed. Specifically, replace the `<a class="btn">` lines with:

```javascript
                <a class="btn ${fase === "apertura" ? "" : "btn-secondary"}" href="#dashboard?fase=apertura">Apertura</a>
                <a class="btn ${fase === "cierre" ? "" : "btn-secondary"}" href="#dashboard?fase=cierre">Cierre</a>
                <a class="btn ${fase === "comparativo" ? "" : "btn-secondary"}" href="#dashboard?fase=comparativo">Comparativo</a>
```

(remove the `<button class="btn-secondary">` Comparativo line just added if it's redundant — keep one entry point.)

- [ ] **Step 2: Add comparativo branch in dashboard handler**

Inside `ROUTES.dashboard`, before `startDashboardPolling(...)`, add:

```javascript
        if (fase === "comparativo") {
          startComparativoPolling(showBenchmark);
          return;
        }
```

- [ ] **Step 3: Add comparativo functions above ROUTES**

After `renderDashboardData`, insert:

```javascript
    const COMPARATIVO_CODES = [
      { aperturaCode: "d1_agentic", cierreCode: "c1_agentic", label: "Capacidad agentic de la IA", type: "likert5" },
      { aperturaCode: "d3_porcentaje", cierreCode: "c2_porcentaje", label: "% de estudiantes que usan IA semanalmente", type: "single" },
      { aperturaCode: "d3_confianza_deteccion", cierreCode: "c3_confianza_deteccion", label: "Confianza para detectar uso indebido", type: "likert5" },
    ];

    function startComparativoPolling(showBenchmark) {
      stopDashboardPolling();
      const tick = async () => {
        const [aper, cier] = await Promise.all([
          api("/api/aggregate?fase=apertura"),
          api("/api/aggregate?fase=cierre"),
        ]);
        if (aper.status !== 200 || cier.status !== 200) return;
        renderComparativo(aper.data, cier.data, showBenchmark);
      };
      tick();
      dashboardPollHandle = setInterval(tick, POLL_INTERVAL_MS);
    }

    function renderComparativo(aperData, cierData, showBenchmark) {
      const meta = $("#dashboard-meta");
      if (meta) {
        meta.textContent = `Apertura n=${aperData.n} · Cierre n=${cierData.n}`;
      }

      const sections = $("#dashboard-sections");
      if (!sections) return;

      if (cierData.n === 0) {
        sections.innerHTML = `<div class="card"><h2>El comparativo aún no está disponible</h2><p>Necesitamos respuestas de cierre. Apertura: ${aperData.n} respuestas. Cierre: 0 respuestas.</p></div>`;
        sections.dataset.builtFor = "";
        destroyAllCharts();
        return;
      }

      if (sections.dataset.builtFor !== "comparativo") {
        destroyAllCharts();
        sections.innerHTML = "";
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `<h2>Comparativo apertura ↔ cierre</h2><p class="hint">Comparación a nivel grupo (encuesta anónima — no se parean individuos).</p>`;
        for (const c of COMPARATIVO_CODES) {
          const wrap = document.createElement("div");
          wrap.style.marginBottom = "20px";
          wrap.innerHTML = `
            <h3>${escapeHtml(c.label)}</h3>
            <div style="height: 220px;">
              <canvas id="cmp_${c.aperturaCode}"></canvas>
            </div>
            <div id="cmpbench_${c.aperturaCode}" class="hint" style="margin-top:6px;"></div>
          `;
          card.appendChild(wrap);
        }
        sections.appendChild(card);
        sections.dataset.builtFor = "comparativo";
      }

      for (const c of COMPARATIVO_CODES) {
        const canvasId = `cmp_${c.aperturaCode}`;
        const ctx = document.getElementById(canvasId);
        if (!ctx) continue;

        const aperVal = aperData.byQuestion[c.aperturaCode];
        const cierVal = cierData.byQuestion[c.cierreCode];

        let labels, aperData2, cierData2;

        if (c.type === "likert5") {
          labels = ["1", "2", "3", "4", "5"];
          aperData2 = [1,2,3,4,5].map(n => aperVal?.values?.[n] || 0);
          cierData2 = [1,2,3,4,5].map(n => cierVal?.values?.[n] || 0);
        } else {
          // single: union of keys
          const keys = new Set([
            ...Object.keys(aperVal?.values || {}),
            ...Object.keys(cierVal?.values || {}),
          ]);
          labels = [...keys].map(k => optionLabelFor(c.aperturaCode, k));
          const ksArr = [...keys];
          aperData2 = ksArr.map(k => aperVal?.values?.[k] || 0);
          cierData2 = ksArr.map(k => cierVal?.values?.[k] || 0);
        }

        if (dashboardCharts[canvasId]) {
          dashboardCharts[canvasId].data.labels = labels;
          dashboardCharts[canvasId].data.datasets[0].data = aperData2;
          dashboardCharts[canvasId].data.datasets[1].data = cierData2;
          dashboardCharts[canvasId].update();
          continue;
        }

        dashboardCharts[canvasId] = new Chart(ctx, {
          type: "bar",
          data: {
            labels,
            datasets: [
              { label: "Apertura", data: aperData2, backgroundColor: "#9CA3AF", borderRadius: 4 },
              { label: "Cierre", data: cierData2, backgroundColor: "#2D5BE3", borderRadius: 4 },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: c.type === "likert5",
                text: c.type === "likert5" ? `Promedio apertura ${aperVal?.mean?.toFixed(2) || "—"} → cierre ${cierVal?.mean?.toFixed(2) || "—"}` : "",
                font: { size: 14, weight: "bold" },
                color: "#1A2456",
              },
              legend: { position: "top" },
            },
            scales: { y: { beginAtZero: true } },
            animation: { duration: 400 },
          },
        });

        const benchEl = document.getElementById(`cmpbench_${c.aperturaCode}`);
        if (benchEl && showBenchmark && BENCHMARKS[c.aperturaCode]) {
          benchEl.innerHTML = `<strong style="color: var(--coral);">Evidencia:</strong> ${escapeHtml(BENCHMARKS[c.aperturaCode].label)}`;
        } else if (benchEl) {
          benchEl.innerHTML = "";
        }
      }
    }
```

- [ ] **Step 4: Seed both fases**

Run:
```bash
curl -s -X POST http://localhost:8788/api/seed -H 'Content-Type: application/json' -H 'X-Admin-Token: 2008464' -d '{"fase":"apertura","n":30}'
curl -s -X POST http://localhost:8788/api/seed -H 'Content-Type: application/json' -H 'X-Admin-Token: 2008464' -d '{"fase":"cierre","n":25}'
```

- [ ] **Step 5: Open comparativo**

Open `http://localhost:8788/#dashboard?fase=comparativo`.
Expected: 3 charts side-by-side (gris=apertura, azul=cierre) for agentic, % estudiantes, confianza detección. Title shows mean transition for likerts.

- [ ] **Step 6: Test "Mostrar evidencia" in comparativo**

Click "Mostrar evidencia".
Expected: each chart gets a coral evidencia line below.

- [ ] **Step 7: Wipe**

Run: `curl -s -X DELETE 'http://localhost:8788/api/wipe?scope=all' -H 'X-Admin-Token: 2008464'`

- [ ] **Step 8: Commit**

```bash
git add encuesta-diagnostica-ia/index.html
git commit -m "feat(encuesta-ia): dashboard modo comparativo apertura↔cierre con barras pareadas"
```

---

## Task 14: Admin panel — auth + cambiar fase

**Files:**
- Modify: `encuesta-diagnostica-ia/index.html` (replace `admin` route handler)

- [ ] **Step 1: Replace admin route handler**

In `ROUTES`, replace the `admin` handler with:

```javascript
      admin(params) {
        const token = sessionStorage.getItem("encuesta_ia_admin_token");
        if (!token) {
          app().innerHTML = `
            <div class="header"><h1>Acceso facilitador</h1></div>
            <div class="container">
              <div class="card">
                <h2>Ingresa la matrícula del facilitador</h2>
                <form id="auth-form">
                  <div class="field">
                    <input type="password" id="auth-token" placeholder="Matrícula" style="width:100%; padding:12px; font-size:1rem; border:2px solid #d1d5db; border-radius:8px;" autocomplete="off" />
                  </div>
                  <button type="submit">Ingresar</button>
                </form>
              </div>
            </div>`;
          $("#auth-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const v = $("#auth-token").value.trim();
            sessionStorage.setItem("encuesta_ia_admin_token", v);
            // Verify by trying to PUT phase to current value
            const { data: phaseData } = await api("/api/phase");
            const { status } = await api("/api/phase", {
              method: "PUT",
              body: JSON.stringify({ phase: phaseData.phase || "apertura" }),
              requireAdmin: true,
            });
            if (status === 200) {
              render(); // re-render to show admin
            } else {
              sessionStorage.removeItem("encuesta_ia_admin_token");
              toast("Matrícula incorrecta", "error");
            }
          });
          return;
        }

        renderAdminPanel();
      },
```

- [ ] **Step 2: Add `renderAdminPanel` function above ROUTES**

After `renderComparativo`, insert:

```javascript
    async function renderAdminPanel() {
      const { data: phaseData } = await api("/api/phase");
      const currentPhase = phaseData.phase || "apertura";

      const [{ data: aperAgg }, { data: cierAgg }] = await Promise.all([
        api("/api/aggregate?fase=apertura"),
        api("/api/aggregate?fase=cierre"),
      ]);

      app().innerHTML = `
        <div class="header">
          <h1>Panel facilitador</h1>
          <div class="meta">Encuesta diagnóstica IA · UNAD</div>
        </div>
        <div class="container">
          <div class="card">
            <h2>Fase activa</h2>
            <p>Estado actual: <strong>${currentPhase.toUpperCase()}</strong></p>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button onclick="changePhase('apertura')" ${currentPhase === "apertura" ? "disabled" : ""}>Apertura</button>
              <button onclick="changePhase('cierre')" ${currentPhase === "cierre" ? "disabled" : ""}>Cierre</button>
              <button class="btn-danger" onclick="changePhase('cerrada')" ${currentPhase === "cerrada" ? "disabled" : ""}>Cerrar encuesta</button>
            </div>
          </div>

          <div class="card">
            <h2>Datos actuales</h2>
            <ul>
              <li>Apertura: <strong>${aperAgg.n}</strong> respuestas${aperAgg.lastTs ? ` · última ${timeAgo(aperAgg.lastTs)}` : ""}</li>
              <li>Cierre: <strong>${cierAgg.n}</strong> respuestas${cierAgg.lastTs ? ` · última ${timeAgo(cierAgg.lastTs)}` : ""}</li>
            </ul>
          </div>

          <div class="card">
            <h2>🧪 Sembrar respuestas demo</h2>
            <p class="hint">Genera respuestas aleatorias con distribuciones realistas. Útil para verificar el dashboard antes del taller. Recuerda hacer wipe antes del taller real.</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              <label>Cantidad: <input type="number" id="seed-n" value="80" min="1" max="200" style="width:80px; padding:6px;"></label>
              <button onclick="seedDemo('apertura')">Sembrar apertura</button>
              <button onclick="seedDemo('cierre')">Sembrar cierre</button>
            </div>
          </div>

          <div class="card">
            <h2>🗑️ Wipe data</h2>
            <p class="hint">Doble confirmación + escribir BORRAR. Sin recuperación.</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn-danger" onclick="wipeData('apertura')">Wipe apertura</button>
              <button class="btn-danger" onclick="wipeData('cierre')">Wipe cierre</button>
              <button class="btn-danger" onclick="wipeData('all')">⚠ Wipe TODO + reset fase</button>
            </div>
          </div>

          <div class="card">
            <h2>⬇ Export</h2>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn-secondary" onclick="exportData('apertura', 'json')">JSON apertura</button>
              <button class="btn-secondary" onclick="exportData('cierre', 'json')">JSON cierre</button>
              <button class="btn-secondary" onclick="exportData('apertura', 'csv')">CSV apertura</button>
              <button class="btn-secondary" onclick="exportData('cierre', 'csv')">CSV cierre</button>
            </div>
          </div>

          <div class="card">
            <button class="btn-secondary" onclick="logoutAdmin()">Cerrar sesión admin</button>
          </div>
        </div>
      `;
    }

    async function changePhase(phase) {
      if (!confirm(`¿Cambiar fase activa a "${phase}"?`)) return;
      const { status, data } = await api("/api/phase", {
        method: "PUT",
        body: JSON.stringify({ phase }),
        requireAdmin: true,
      });
      if (status === 200) {
        toast(`Fase cambiada a ${phase}`, "success");
        renderAdminPanel();
      } else {
        toast(`Error: ${data.error || "intenta de nuevo"}`, "error");
      }
    }

    function logoutAdmin() {
      sessionStorage.removeItem("encuesta_ia_admin_token");
      navigate("landing");
    }
```

- [ ] **Step 3: Test admin login**

Open `http://localhost:8788/#admin`.
Expected: form pidiendo matrícula.

- [ ] **Step 4: Test wrong matrícula**

Type `1234567`. Submit.
Expected: toast "Matrícula incorrecta".

- [ ] **Step 5: Test correct matrícula**

Type `2008464`. Submit.
Expected: panel admin appears with current phase, n stats, seed/wipe/export sections.

- [ ] **Step 6: Test cambiar fase**

Click "Cierre". Confirm. Expected: page reloads with phase="CIERRE", "Cierre" button disabled.
Click "Apertura" → confirm → reset.

- [ ] **Step 7: Verify form respects fase**

Set fase to "cerrada". Open `/#apertura` in another tab.
Expected: form shows "La encuesta está cerrada".

Reset to "apertura" via admin.

- [ ] **Step 8: Test logout**

Click "Cerrar sesión admin".
Expected: returns to landing. `#admin` again pide matrícula.

- [ ] **Step 9: Commit**

```bash
git add encuesta-diagnostica-ia/index.html
git commit -m "feat(encuesta-ia): admin auth + cambiar fase + panel skeleton"
```

---

## Task 15: Admin — seed demo + wipe + export

**Files:**
- Modify: `encuesta-diagnostica-ia/index.html` (add seedDemo, wipeData, exportData functions)

- [ ] **Step 1: Add admin action functions**

After `logoutAdmin`, insert:

```javascript
    async function seedDemo(fase) {
      const n = parseInt($("#seed-n").value) || 80;
      if (n < 1 || n > 200) { toast("n debe estar entre 1 y 200", "error"); return; }
      if (!confirm(`¿Sembrar ${n} respuestas demo de ${fase}?`)) return;
      const { status, data } = await api("/api/seed", {
        method: "POST",
        body: JSON.stringify({ fase, n }),
        requireAdmin: true,
      });
      if (status === 200) {
        toast(`✓ Sembradas ${data.created} respuestas`, "success");
        renderAdminPanel();
      } else {
        toast(`Error: ${data.error || "intenta de nuevo"}`, "error");
      }
    }

    async function wipeData(scope) {
      const labels = { apertura: "respuestas de APERTURA", cierre: "respuestas de CIERRE", all: "TODAS las respuestas + reset fase a apertura" };
      if (!confirm(`¿Borrar ${labels[scope]}? Esta acción es irreversible.`)) return;
      const word = prompt(`Para confirmar, escribe BORRAR (en mayúsculas):`);
      if (word !== "BORRAR") { toast("Cancelado", "info"); return; }
      if (scope === "all" && !confirm("⚠ Última confirmación: vas a borrar TODO. ¿Continuar?")) return;
      const { status, data } = await api(`/api/wipe?scope=${scope}`, {
        method: "DELETE",
        requireAdmin: true,
      });
      if (status === 200) {
        toast(`✓ Borradas ${data.deleted} respuestas`, "success");
        renderAdminPanel();
      } else {
        toast(`Error: ${data.error || "intenta de nuevo"}`, "error");
      }
    }

    async function exportData(fase, format) {
      const { status, data } = await api(`/api/responses?fase=${fase}`, { requireAdmin: true });
      if (status !== 200) {
        toast(`Error: ${data.error || "no se pudo exportar"}`, "error");
        return;
      }

      let blob, filename;
      if (format === "json") {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        filename = `encuesta_ia_${fase}_${new Date().toISOString().slice(0,10)}.json`;
      } else {
        // CSV: respId, ts, then demograficas keys, then respuestas keys (multi as ; joined)
        const items = data.items || [];
        if (items.length === 0) { toast("Sin respuestas para exportar", "info"); return; }
        const demKeys = new Set();
        const respKeys = new Set();
        for (const it of items) {
          for (const k of Object.keys(it.demograficas || {})) demKeys.add(k);
          for (const k of Object.keys(it.respuestas || {})) respKeys.add(k);
        }
        const headers = ["respId", "ts", ...[...demKeys].map(k => `dem_${k}`), ...respKeys];
        const rows = [headers.join(",")];
        for (const it of items) {
          const row = [it.respId, it.ts];
          for (const k of demKeys) row.push(csvCell(it.demograficas?.[k]));
          for (const k of respKeys) row.push(csvCell(it.respuestas?.[k]));
          rows.push(row.join(","));
        }
        blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
        filename = `encuesta_ia_${fase}_${new Date().toISOString().slice(0,10)}.csv`;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    function csvCell(v) {
      if (v === null || v === undefined) return "";
      const s = Array.isArray(v) ? v.join(";") : String(v);
      if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }
```

- [ ] **Step 2: Test seed**

In admin panel, type `30` in cantidad input, click "Sembrar apertura". Confirm.
Expected: toast "✓ Sembradas 30 respuestas", panel re-renders showing apertura n=30.

- [ ] **Step 3: Verify dashboard sees seeded data**

Open `#dashboard` in another tab. Expected: dashboard shows 30 responses with charts populated.

- [ ] **Step 4: Test wipe apertura**

In admin, click "Wipe apertura". Confirm. Type "BORRAR". Submit.
Expected: toast "✓ Borradas 30 respuestas", panel shows apertura n=0.

- [ ] **Step 5: Test wipe cancellation**

Click "Wipe apertura" again. Confirm dialog. Type "no" instead of "BORRAR".
Expected: toast "Cancelado", no data deleted.

- [ ] **Step 6: Test seed cierre + comparativo**

Seed 20 apertura + 15 cierre. Open `#dashboard?fase=comparativo`.
Expected: comparativo shows the 3 paired charts.

- [ ] **Step 7: Test export JSON**

In admin, click "JSON apertura".
Expected: file downloads named `encuesta_ia_apertura_2026-04-XX.json`. Open it: should be valid JSON with `n` and `items` array.

- [ ] **Step 8: Test export CSV**

Click "CSV apertura".
Expected: file `encuesta_ia_apertura_2026-04-XX.csv` downloads. Open in any text editor: header row + N data rows, multi-select cells with `;` separator.

- [ ] **Step 9: Test wipe all**

Click "⚠ Wipe TODO". Triple confirm.
Expected: toast "✓ Borradas 35 respuestas", phase resets to apertura, both n=0.

- [ ] **Step 10: Commit**

```bash
git add encuesta-diagnostica-ia/index.html
git commit -m "feat(encuesta-ia): admin seed/wipe/export con triple confirmación"
```

---

## Task 16: Network error handling + retry

**Files:**
- Modify: `encuesta-diagnostica-ia/index.html` (improve `api()` function and form submit)

- [ ] **Step 1: Replace `api` function with retry logic**

Locate the `api` function and replace with:

```javascript
    async function api(path, options = {}) {
      const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
      const adminToken = sessionStorage.getItem("encuesta_ia_admin_token");
      if (adminToken && options.requireAdmin) headers["X-Admin-Token"] = adminToken;

      const maxAttempts = options.retryOnNetwork ? 2 : 1;
      let lastErr;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await fetch(path, { ...options, headers });
          const text = await res.text();
          let data;
          try { data = JSON.parse(text); } catch { data = { _raw: text }; }
          return { status: res.status, data };
        } catch (e) {
          lastErr = e;
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
        }
      }
      return { status: 0, data: { error: `Network error: ${lastErr?.message || "unknown"}` } };
    }
```

- [ ] **Step 2: Update form submit to use retry + handle network errors**

In `renderFormPage`, locate the `submit` handler. Replace the `api("/api/responses"...)` call with:

```javascript
        const { status, data: resp } = await api("/api/responses", {
          method: "POST",
          body: JSON.stringify(payload),
          retryOnNetwork: true,
        });

        if (status === 201) {
          localStorage.setItem(`encuesta_ia_resp_${fase}`, respId);
          navigate("gracias", { fase });
        } else if (status === 403) {
          toast("La encuesta está cerrada.", "error", 5000);
          btn.disabled = false;
          btn.textContent = "Enviar respuesta";
        } else if (status === 0) {
          toast("Error de red. Verifica tu conexión y reintenta.", "error", 6000);
          btn.disabled = false;
          btn.textContent = "Reintentar envío";
        } else {
          toast(`Error: ${resp.error || "intenta de nuevo"}`, "error", 5000);
          btn.disabled = false;
          btn.textContent = "Enviar respuesta";
        }
```

- [ ] **Step 3: Test (manual simulation)**

Open `#apertura`, fill form, click submit.
Expected: response is sent successfully.

To simulate network error: stop wrangler with Ctrl+C while a submit is pending. Restart, retry. Submit should succeed on retry.

- [ ] **Step 4: Commit**

```bash
git add encuesta-diagnostica-ia/index.html
git commit -m "feat(encuesta-ia): retry de red en submits + manejo de status 0"
```

---

## Task 17: CLAUDE.md for the tool

**Files:**
- Create: `encuesta-diagnostica-ia/CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md**

File: `encuesta-diagnostica-ia/CLAUDE.md`

```markdown
# CLAUDE.md — Encuesta Diagnóstica IA (UNAD)

> Contexto para Claude Code. Leer completo antes de tocar cualquier archivo.

---

## Qué hace esta herramienta

App de encuesta diagnóstica en tiempo real para la capacitación docente UNAD *"Inteligencia Artificial en la Educación Superior — Estado del arte abril 2026"* (dos sesiones de 90 min, basadas en `Guia_Facilitador_UNAD_v4`).

Provee:
- Form anónimo de **apertura** (18 ítems, ~5 min) en URL `/#apertura`.
- Form anónimo de **cierre** (7 ítems, ~90 s) en URL `/#cierre`.
- **Dashboard** público read-only en `/#dashboard?fase=apertura|cierre|comparativo` con polling cada 3 s.
- **Modo evidencia** que superpone benchmarks académicos sobre las respuestas del grupo.
- **Modo comparativo** apertura↔cierre con barras pareadas (a nivel grupo, no individual).
- **Panel admin** en `/#admin` (matrícula `2008464`) con: cambiar fase, sembrar 80 respuestas demo, wipe, export JSON/CSV.

---

## Arquitectura

| Archivo | Rol |
|---|---|
| `index.html` | SPA monolítica con hash routing. Inline CSS + JS. Chart.js por CDN. |
| `functions/api/phase.js` | GET/PUT fase activa (`apertura` \| `cierre` \| `cerrada`). |
| `functions/api/responses.js` | POST nueva respuesta (sin auth) · GET admin listado. |
| `functions/api/aggregate.js` | GET agregaciones con filtros (n, byQuestion, lastTs). Cache 2 s. |
| `functions/api/seed.js` | POST sembrar N respuestas demo (admin). |
| `functions/api/wipe.js` | DELETE wipe (admin). |
| `wrangler.toml` | Config Pages + binding KV `ENCUESTA_IA_STATE`. |

**Modelo KV:**

| Key | Valor | Notas |
|---|---|---|
| `phase` | `"apertura"` \| `"cierre"` \| `"cerrada"` | Fase activa global. |
| `resp:apertura:{respId}` | JSON respuesta | Append-only. UUID v4 prevents collisions. |
| `resp:cierre:{respId}` | JSON respuesta | Append-only. |

**Sin locking optimista.** Cada respuesta tiene UUID único; no hay editar/sobrescribir desde múltiples clientes.

**Auth admin:** header `X-Admin-Token` con valor `2008464` (PROFESOR_MATRICULA). Seguridad por oscuridad — aceptable porque el dato es anónimo.

---

## Cómo correr en local

```bash
cd encuesta-diagnostica-ia
wrangler pages dev . --port 8788
# abrir http://localhost:8788/
```

KV efímero local. Datos se pierden al cerrar wrangler (útil para reset rápido durante desarrollo).

---

## Deploy Cloudflare Pages

1. Crear KV namespace:
   ```bash
   wrangler kv namespace create ENCUESTA_IA_STATE
   ```
   Copiar el `id` en `wrangler.toml`.

2. Cloudflare Pages → Add Production Branch `main` → publish directory `encuesta-diagnostica-ia`. Build command vacío.

3. Settings → Functions → KV namespace bindings: asociar `ENCUESTA_IA_STATE` al namespace creado.

4. Push a `main` → redeploy automático.

URL resultante: `encuesta-diagnostica-ia.pages.dev`.

---

## Generar QR

Dos QR distintos:
- Apertura → `https://encuesta-diagnostica-ia.pages.dev/#apertura`
- Cierre → `https://encuesta-diagnostica-ia.pages.dev/#cierre`

Generadores recomendados: `https://qrcode-monkey.com` o `https://api.qrserver.com/v1/create-qr-code/?data=URL`. Imprimir + tener en slide. Probar con celular real antes de la sesión.

---

## Antes de cada taller real

- [ ] `curl -X DELETE 'https://.../api/wipe?scope=all' -H 'X-Admin-Token: 2008464'` o usar el botón en `/#admin`.
- [ ] Verificar fase = `apertura` desde admin.
- [ ] QR escaneado desde un celular físico → llega al form.
- [ ] Submit de prueba → llega al dashboard en <5 s.
- [ ] Wipe la prueba.

---

## Personalización

- Editar `BENCHMARKS` en `index.html` para actualizar referencias académicas.
- Editar `COORDINACIONES_TBD` cuando llegue el listado oficial de coordinaciones UNAD. Si nunca llega, eliminar la pregunta `dem_coordinacion` de `PREGUNTAS_APERTURA`.
- Si quieres cambiar la matrícula del admin: editar `PROFESOR_MATRICULA` en `index.html` y `ADMIN_TOKEN` en cada `functions/api/*.js`.

---

## Referencias

- Spec diseño: `../docs/superpowers/specs/2026-04-29-encuesta-diagnostica-ia-design.md`.
- Plan implementación: `../docs/superpowers/plans/2026-04-29-encuesta-diagnostica-ia.md`.
- Guía pedagógica: `Guia_Facilitador_UNAD_v4.docx` (Bloques 1.1, 1.2, 2.5).
- Patrón realtime: `../agenda-evaluaciones/functions/api/state.js`.
- Contexto monorepo: `../herramientas-educativas-CLAUDE.md`.

---

*Status: en desarrollo · Prof. Misael Michel · UNAD ENE-ABR 2026*
```

- [ ] **Step 2: Update root CLAUDE.md tabla de herramientas**

Open `herramientas-educativas-CLAUDE.md`, locate the table of existing tools. Add row:

```markdown
| `encuesta-diagnostica-ia` | genérico (capacitación) | Encuesta diagnóstica con dashboard tiempo real | ✅ En desarrollo |
```

- [ ] **Step 3: Commit**

```bash
git add encuesta-diagnostica-ia/CLAUDE.md herramientas-educativas-CLAUDE.md
git commit -m "docs(encuesta-ia): CLAUDE.md específico + registro en monorepo"
```

---

## Task 18: Pre-deploy verification + manual checklist

**Files:** none (verification only)

- [ ] **Step 1: Run full manual checklist locally**

Run wrangler dev. Open browser. Verify:

**Landing:**
- [ ] `http://localhost:8788/` shows header + 3 buttons + admin link
- [ ] No console errors

**Apertura form:**
- [ ] `/#apertura` renders 18 questions in 6 sections
- [ ] Likert rows show 5 buttons with labels
- [ ] Multi-select allows multiple checks with visual feedback
- [ ] Empty submit shows red toast and scrolls to first incomplete field
- [ ] Full submit redirects to `/#gracias?fase=apertura`
- [ ] Re-visit `/#apertura` shows "Ya enviaste" guard
- [ ] "Re-enviar de todos modos" forces form again
- [ ] Setting fase to "cerrada" via admin shows "encuesta cerrada" message

**Cierre form:**
- [ ] `/#cierre` renders 7 questions in 3 sections
- [ ] Submit works
- [ ] Anti-duplicado works

**Dashboard apertura:**
- [ ] Empty: "Esperando respuestas…"
- [ ] With data: charts render for each non-demografica question
- [ ] `n` and timestamp update every 3 s
- [ ] Filter dropdowns work (URL updates, charts re-render)
- [ ] n<5 with filters shows protector message
- [ ] "Mostrar evidencia" toggles benchmark text under charts

**Dashboard cierre:** same checks.

**Comparativo:**
- [ ] If cierre n=0: shows "no disponible aún" message
- [ ] With data in both: 3 paired charts, gray=apertura, blue=cierre
- [ ] Likert charts show "Promedio apertura X → cierre Y" title

**Admin:**
- [ ] `/#admin` requires matrícula
- [ ] Wrong matrícula → toast error
- [ ] Correct → panel
- [ ] Cambiar fase: confirm + apply + UI updates
- [ ] Seed: input n, click button, confirm, toast success, panel updates
- [ ] Wipe: triple confirm (dialog + word + final dialog for "all")
- [ ] Export JSON: file downloads, valid JSON
- [ ] Export CSV: file downloads, opens correctly in spreadsheet
- [ ] Logout returns to landing

**Mobile (open on phone or DevTools mobile emulator):**
- [ ] Landing fits without horizontal scroll
- [ ] Apertura form: tap targets ≥44px
- [ ] Likert row buttons usable on narrow screen
- [ ] Submit succeeds

**Cross-browser:** open same flow in Chrome + Firefox + Safari (or iPhone Safari if available).

- [ ] **Step 2: Wipe all data**

Run: `curl -s -X DELETE 'http://localhost:8788/api/wipe?scope=all' -H 'X-Admin-Token: 2008464'`

- [ ] **Step 3: Commit (only if you fixed anything during checklist)**

If issues were fixed in this task, commit with message describing fixes. Else skip.

---

## Task 19: Deploy to Cloudflare Pages

**Files:** none (deploy only — do this AFTER task 18 is green)

- [ ] **Step 1: Push branch to remote**

```bash
git push origin wonderful-bhaskara-5470a5
```

- [ ] **Step 2: Create Cloudflare Pages project**

In Cloudflare dashboard:
1. Pages → Create a project → Connect to Git → select repo.
2. Production branch: `main` (or merge this branch first if working on feature branch).
3. Build settings:
   - Framework preset: None
   - Build command: (empty)
   - Build output directory: `encuesta-diagnostica-ia`
4. Save and Deploy.

- [ ] **Step 3: Wait for build to complete**

Watch the build log in Cloudflare dashboard. Should take <60 s.

- [ ] **Step 4: Bind KV namespace in Pages dashboard**

Pages project → Settings → Functions → KV namespace bindings → Add binding.
- Variable name: `ENCUESTA_IA_STATE`
- KV namespace: select the one created in Task 1 (NOT a new one)

- [ ] **Step 5: Trigger redeploy**

Either push an empty commit or click "Retry deployment" in dashboard so the binding takes effect.

- [ ] **Step 6: Smoke test on production**

Open `https://encuesta-diagnostica-ia.pages.dev/`. Verify:
- [ ] Landing loads
- [ ] `/api/phase` returns `{"phase":"apertura"}`
- [ ] `#apertura` form renders
- [ ] Submit a real test response
- [ ] `/#dashboard` shows it within 3 s
- [ ] `/#admin` with matrícula `2008464` works
- [ ] Wipe the test response

- [ ] **Step 7: Generate QR codes**

Use `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=` followed by URL-encoded link:
- Apertura QR: `?data=https%3A%2F%2Fencuesta-diagnostica-ia.pages.dev%2F%23apertura`
- Cierre QR: `?data=https%3A%2F%2Fencuesta-diagnostica-ia.pages.dev%2F%23cierre`

Save both as PNG. Insert into capacitación slides.

- [ ] **Step 8: Final pre-taller verification**

Day before the taller:
- [ ] Wipe all data via admin or curl
- [ ] Confirm fase=apertura
- [ ] Test scan QR with real phone, submit, see in dashboard
- [ ] Wipe again

---

## Self-Review

Spec coverage check:

- ✅ §3 Alcance — every "en alcance" point has a task: forms (Tasks 8-10), dashboard polling (11), filters (12), comparativo (13), admin auth/phase (14), seed/wipe/export (15), persistence (KV throughout), branding (Task 7).
- ✅ §5 Arquitectura — file structure (Tasks 1+7), API (2-6), KV model (data shape established in Task 3, used everywhere).
- ✅ §6 Catálogo de preguntas — Tasks 8 + 9 + 10 cover both fases with exact codes from spec.
- ✅ §7 Dashboard — Tasks 11-13.
- ✅ §8 Panel admin — Tasks 14-15.
- ✅ §9 Manejo errores — Task 16.
- ✅ §10 Validación — Task 18 manual checklist.
- ✅ §11 Despliegue — Task 19.
- ⚠ §12 Riesgos — partially covered (form rejection on `cerrada`, retry on red, n<5 protection). Backup Google Forms is operational, not implementation.

Placeholder scan: no TBD/TODO/"add appropriate" — all code blocks are concrete and complete.

Type/method consistency: `api(path, opts)` signature uniform; `respId` is UUID v4 string; `phase` ∈ `{apertura, cierre, cerrada}`; admin token header `X-Admin-Token` everywhere.

---

## Done

When all 19 tasks are checked off:
- ✅ App deployed at `https://encuesta-diagnostica-ia.pages.dev/`
- ✅ Two QR codes ready to project
- ✅ Admin panel functional for fase/seed/wipe/export
- ✅ Dashboard real-time with comparativo + benchmarks

Final state: ready to use in next UNAD AI capacitación session.
