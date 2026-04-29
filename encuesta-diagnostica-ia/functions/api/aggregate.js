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
