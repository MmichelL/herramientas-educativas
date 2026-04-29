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
