// ══════════════════════════════════════════════════════════════════
// API de estado compartido — Cloudflare Pages Function + KV
//
// GET  /api/state?id=config-id        → Leer estado de una configuración
// POST /api/state?id=config-id        → Guardar estado completo
// ══════════════════════════════════════════════════════════════════

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// GET /api/state?id=config-id
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const configId = url.searchParams.get("id");

  if (!configId) {
    return new Response(
      JSON.stringify({ error: "Falta el parámetro 'id'" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  const key = `state_${configId}`;
  const data = await context.env.SELECTOR_STATE.get(key, "json");

  if (!data) {
    // Estado vacío por defecto
    return new Response(
      JSON.stringify({ assignments: [], takenNums: [] }),
      { status: 200, headers: corsHeaders() }
    );
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: corsHeaders(),
  });
}

// POST /api/state?id=config-id
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

  // Validar estructura mínima
  if (!Array.isArray(body.assignments) || !Array.isArray(body.takenNums)) {
    return new Response(
      JSON.stringify({ error: "Estructura inválida: se requiere {assignments:[], takenNums:[]}" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  const key = `state_${configId}`;
  await context.env.SELECTOR_STATE.put(key, JSON.stringify(body));

  return new Response(
    JSON.stringify({ ok: true, saved: body.assignments.length }),
    { status: 200, headers: corsHeaders() }
  );
}
