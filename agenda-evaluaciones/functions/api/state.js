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
