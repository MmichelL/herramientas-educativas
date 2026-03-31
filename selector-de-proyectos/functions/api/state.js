// ══════════════════════════════════════════════════════════════════
// API de estado compartido — Cloudflare Pages Function + KV
// Con LOCKING OPTIMISTA para evitar colisiones entre clientes.
//
// GET  /api/state?id=config-id        → Leer estado + versión
// POST /api/state?id=config-id        → Asignar un ítem (atómico)
// DELETE /api/state?id=config-id      → Eliminar asignación(es)
// ══════════════════════════════════════════════════════════════════

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function emptyState() {
  return { version: 0, assignments: [], takenNums: [] };
}

async function readState(kv, configId) {
  const key = `state_${configId}`;
  const data = await kv.get(key, "json");
  if (!data) return emptyState();
  // Migrar datos antiguos sin versión
  if (typeof data.version !== "number") {
    data.version = 0;
  }
  return data;
}

async function writeState(kv, configId, state) {
  const key = `state_${configId}`;
  await kv.put(key, JSON.stringify(state));
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// ── GET /api/state?id=config-id ─────────────────────────────────
// Devuelve el estado actual con su versión.
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const configId = url.searchParams.get("id");

  if (!configId) {
    return new Response(
      JSON.stringify({ error: "Falta el parámetro 'id'" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  const state = await readState(context.env.SELECTOR_STATE, configId);

  return new Response(JSON.stringify(state), {
    status: 200,
    headers: corsHeaders(),
  });
}

// ── POST /api/state?id=config-id ────────────────────────────────
// Agrega UNA asignación de forma atómica.
// El cliente envía:
//   { version: N, matricula, nombre, num, item, descripcion }
//
// El servidor:
//   1. Lee el estado actual
//   2. Verifica que la versión del cliente coincida (locking optimista)
//   3. Verifica que el número no esté tomado
//   4. Verifica que la matrícula no tenga ya una asignación
//   5. Agrega la asignación, incrementa versión, guarda
//
// Respuestas:
//   200 → { ok: true, state: {...} }           — Éxito
//   409 → { conflict: true, reason, state }     — Conflicto (re-fetch + re-spin)
//
export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const configId = url.searchParams.get("id");

  if (!configId) {
    return new Response(
      JSON.stringify({ error: "Falta el parámetro 'id'" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "JSON inválido" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  const { version, matricula, nombre, num, item, descripcion } = body;

  // Validar campos requeridos
  if (typeof version !== "number" || !matricula || !nombre || typeof num !== "number" || !item) {
    return new Response(
      JSON.stringify({ error: "Campos requeridos: version, matricula, nombre, num, item" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  // ── Leer estado actual del servidor ──
  const state = await readState(context.env.SELECTOR_STATE, configId);

  // ── 1. Verificar versión (locking optimista) ──
  if (version !== state.version) {
    return new Response(
      JSON.stringify({
        conflict: true,
        reason: "VERSION_MISMATCH",
        message: "El estado cambió desde tu última sincronización. Recargando...",
        state,
      }),
      { status: 409, headers: corsHeaders() }
    );
  }

  // ── 2. Verificar que el número no esté tomado ──
  if (state.takenNums.includes(num)) {
    return new Response(
      JSON.stringify({
        conflict: true,
        reason: "NUM_TAKEN",
        message: `La tarjeta #${String(num).padStart(2, "0")} ya fue asignada por otro estudiante.`,
        state,
      }),
      { status: 409, headers: corsHeaders() }
    );
  }

  // ── 3. Verificar que la matrícula no tenga asignación ──
  const existing = state.assignments.find(a => a.matricula === matricula);
  if (existing) {
    return new Response(
      JSON.stringify({
        conflict: true,
        reason: "ALREADY_ASSIGNED",
        message: `${nombre} ya tiene la tarjeta #${String(existing.num).padStart(2, "0")} asignada.`,
        state,
      }),
      { status: 409, headers: corsHeaders() }
    );
  }

  // ── 4. Todo ok — agregar asignación ──
  state.assignments.push({
    matricula,
    nombre,
    num,
    item,
    descripcion: descripcion || "",
    timestamp: new Date().toISOString(),
  });
  state.takenNums.push(num);
  state.version += 1;

  await writeState(context.env.SELECTOR_STATE, configId, state);

  return new Response(
    JSON.stringify({ ok: true, state }),
    { status: 200, headers: corsHeaders() }
  );
}

// ── DELETE /api/state?id=config-id ──────────────────────────────
// Elimina asignación(es). El cliente envía:
//   { version: N, action: "deleteOne", index: 0 }
//   { version: N, action: "deleteAll" }
//   { version: N, action: "undoLast" }
//
export async function onRequestDelete(context) {
  const url = new URL(context.request.url);
  const configId = url.searchParams.get("id");

  if (!configId) {
    return new Response(
      JSON.stringify({ error: "Falta el parámetro 'id'" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "JSON inválido" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  const { version, action, index } = body;

  if (typeof version !== "number" || !action) {
    return new Response(
      JSON.stringify({ error: "Campos requeridos: version, action" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  const state = await readState(context.env.SELECTOR_STATE, configId);

  // Verificar versión
  if (version !== state.version) {
    return new Response(
      JSON.stringify({
        conflict: true,
        reason: "VERSION_MISMATCH",
        message: "El estado cambió. Recargando...",
        state,
      }),
      { status: 409, headers: corsHeaders() }
    );
  }

  if (action === "deleteAll") {
    state.assignments = [];
    state.takenNums = [];
  } else if (action === "undoLast") {
    if (state.assignments.length > 0) {
      const last = state.assignments.pop();
      state.takenNums = state.takenNums.filter(n => n !== last.num);
    }
  } else if (action === "deleteOne") {
    if (typeof index === "number" && index >= 0 && index < state.assignments.length) {
      const removed = state.assignments.splice(index, 1)[0];
      state.takenNums = state.takenNums.filter(n => n !== removed.num);
    }
  } else {
    return new Response(
      JSON.stringify({ error: "Acción no válida: deleteAll, undoLast, deleteOne" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  state.version += 1;
  await writeState(context.env.SELECTOR_STATE, configId, state);

  return new Response(
    JSON.stringify({ ok: true, state }),
    { status: 200, headers: corsHeaders() }
  );
}
