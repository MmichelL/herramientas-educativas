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
