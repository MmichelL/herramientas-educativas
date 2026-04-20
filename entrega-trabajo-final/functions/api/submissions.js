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
