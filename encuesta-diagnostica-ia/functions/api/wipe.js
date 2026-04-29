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
