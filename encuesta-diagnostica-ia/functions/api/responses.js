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
