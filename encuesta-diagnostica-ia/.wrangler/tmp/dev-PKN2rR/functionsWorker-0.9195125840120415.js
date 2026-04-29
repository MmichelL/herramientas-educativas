var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-hemZ3I/functionsWorker-0.9195125840120415.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var VALID_FASES = ["apertura", "cierre"];
var FILTER_KEYS = ["facultad", "tiempo_docencia", "sexo", "postura"];
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=2"
  };
}
__name(corsHeaders, "corsHeaders");
__name2(corsHeaders, "corsHeaders");
async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
__name(onRequestOptions, "onRequestOptions");
__name2(onRequestOptions, "onRequestOptions");
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
__name(matchesFilters, "matchesFilters");
__name2(matchesFilters, "matchesFilters");
function aggregateByQuestion(items) {
  const by = {};
  for (const item of items) {
    for (const [k, v] of Object.entries(item.demograficas || {})) {
      const code = `dem_${k}`;
      by[code] = by[code] || { type: "count", values: {} };
      by[code].values[v] = (by[code].values[v] || 0) + 1;
    }
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
  for (const code of Object.keys(by)) {
    if (by[code].type === "likert" && by[code].n > 0) {
      by[code].mean = by[code].sum / by[code].n;
    }
  }
  return by;
}
__name(aggregateByQuestion, "aggregateByQuestion");
__name2(aggregateByQuestion, "aggregateByQuestion");
async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const fase = url.searchParams.get("fase");
  if (!VALID_FASES.includes(fase)) {
    return new Response(JSON.stringify({ error: "Invalid fase" }), {
      status: 400,
      headers: corsHeaders()
    });
  }
  const filters = {};
  for (const k of FILTER_KEYS) {
    const v = url.searchParams.get(k);
    if (v) filters[k] = v;
  }
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
  const filtered = Object.keys(filters).length === 0 ? allItems : allItems.filter((item) => matchesFilters(item, filters));
  const byQuestion = aggregateByQuestion(filtered);
  return new Response(
    JSON.stringify({
      n: filtered.length,
      nTotal: allItems.length,
      filters,
      byQuestion,
      lastTs: filtered.length > 0 ? filtered.map((i) => i.ts).sort().pop() : null
    }),
    { status: 200, headers: corsHeaders() }
  );
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
var ADMIN_TOKEN = "2008464";
var PHASES = ["apertura", "cierre", "cerrada"];
function corsHeaders2() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json; charset=utf-8"
  };
}
__name(corsHeaders2, "corsHeaders2");
__name2(corsHeaders2, "corsHeaders");
function isAdmin(request) {
  return request.headers.get("X-Admin-Token") === ADMIN_TOKEN;
}
__name(isAdmin, "isAdmin");
__name2(isAdmin, "isAdmin");
async function onRequestOptions2() {
  return new Response(null, { status: 204, headers: corsHeaders2() });
}
__name(onRequestOptions2, "onRequestOptions2");
__name2(onRequestOptions2, "onRequestOptions");
async function onRequestGet2(context) {
  const phase = await context.env.ENCUESTA_IA_STATE.get("phase") || "apertura";
  return new Response(JSON.stringify({ phase }), {
    status: 200,
    headers: corsHeaders2()
  });
}
__name(onRequestGet2, "onRequestGet2");
__name2(onRequestGet2, "onRequestGet");
async function onRequestPut(context) {
  if (!isAdmin(context.request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders2()
    });
  }
  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: corsHeaders2()
    });
  }
  if (!PHASES.includes(body.phase)) {
    return new Response(JSON.stringify({ error: "Invalid phase" }), {
      status: 400,
      headers: corsHeaders2()
    });
  }
  await context.env.ENCUESTA_IA_STATE.put("phase", body.phase);
  return new Response(JSON.stringify({ ok: true, phase: body.phase }), {
    status: 200,
    headers: corsHeaders2()
  });
}
__name(onRequestPut, "onRequestPut");
__name2(onRequestPut, "onRequestPut");
var ADMIN_TOKEN2 = "2008464";
var VALID_FASES2 = ["apertura", "cierre"];
function corsHeaders3() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json; charset=utf-8"
  };
}
__name(corsHeaders3, "corsHeaders3");
__name2(corsHeaders3, "corsHeaders");
function isAdmin2(request) {
  return request.headers.get("X-Admin-Token") === ADMIN_TOKEN2;
}
__name(isAdmin2, "isAdmin2");
__name2(isAdmin2, "isAdmin");
function isValidUuid(s) {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
__name(isValidUuid, "isValidUuid");
__name2(isValidUuid, "isValidUuid");
async function onRequestOptions3() {
  return new Response(null, { status: 204, headers: corsHeaders3() });
}
__name(onRequestOptions3, "onRequestOptions3");
__name2(onRequestOptions3, "onRequestOptions");
async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: corsHeaders3()
    });
  }
  const { fase, respId, demograficas, respuestas } = body;
  if (!VALID_FASES2.includes(fase)) {
    return new Response(JSON.stringify({ error: "Invalid fase" }), {
      status: 400,
      headers: corsHeaders3()
    });
  }
  if (!isValidUuid(respId)) {
    return new Response(JSON.stringify({ error: "Invalid respId (UUID v4 expected)" }), {
      status: 400,
      headers: corsHeaders3()
    });
  }
  if (!demograficas || typeof demograficas !== "object") {
    return new Response(JSON.stringify({ error: "Missing demograficas" }), {
      status: 400,
      headers: corsHeaders3()
    });
  }
  if (!respuestas || typeof respuestas !== "object") {
    return new Response(JSON.stringify({ error: "Missing respuestas" }), {
      status: 400,
      headers: corsHeaders3()
    });
  }
  const currentPhase = await context.env.ENCUESTA_IA_STATE.get("phase") || "apertura";
  if (currentPhase === "cerrada") {
    return new Response(JSON.stringify({ error: "Encuesta cerrada" }), {
      status: 403,
      headers: corsHeaders3()
    });
  }
  const payload = {
    respId,
    fase,
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    demograficas,
    respuestas
  };
  const key = `resp:${fase}:${respId}`;
  await context.env.ENCUESTA_IA_STATE.put(key, JSON.stringify(payload));
  return new Response(JSON.stringify({ ok: true, respId }), {
    status: 201,
    headers: corsHeaders3()
  });
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
async function onRequestGet3(context) {
  if (!isAdmin2(context.request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders3()
    });
  }
  const url = new URL(context.request.url);
  const fase = url.searchParams.get("fase");
  if (!VALID_FASES2.includes(fase)) {
    return new Response(JSON.stringify({ error: "Invalid fase" }), {
      status: 400,
      headers: corsHeaders3()
    });
  }
  const list = await context.env.ENCUESTA_IA_STATE.list({ prefix: `resp:${fase}:` });
  const items = await Promise.all(
    list.keys.map(async (k) => JSON.parse(await context.env.ENCUESTA_IA_STATE.get(k.name)))
  );
  return new Response(JSON.stringify({ n: items.length, items }), {
    status: 200,
    headers: corsHeaders3()
  });
}
__name(onRequestGet3, "onRequestGet3");
__name2(onRequestGet3, "onRequestGet");
var ADMIN_TOKEN3 = "2008464";
var VALID_FASES3 = ["apertura", "cierre"];
function corsHeaders4() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json; charset=utf-8"
  };
}
__name(corsHeaders4, "corsHeaders4");
__name2(corsHeaders4, "corsHeaders");
function isAdmin3(request) {
  return request.headers.get("X-Admin-Token") === ADMIN_TOKEN3;
}
__name(isAdmin3, "isAdmin3");
__name2(isAdmin3, "isAdmin");
function pickWeighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) {
    r -= w;
    if (r <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}
__name(pickWeighted, "pickWeighted");
__name2(pickWeighted, "pickWeighted");
function sampleLikert(mean, sd) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const v = Math.round(mean + z * sd);
  return Math.max(1, Math.min(5, v));
}
__name(sampleLikert, "sampleLikert");
__name2(sampleLikert, "sampleLikert");
function pickN(arr, minN, maxN) {
  const n = minN + Math.floor(Math.random() * (maxN - minN + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
__name(pickN, "pickN");
__name2(pickN, "pickN");
function uuid() {
  return crypto.randomUUID();
}
__name(uuid, "uuid");
__name2(uuid, "uuid");
function genApertura() {
  return {
    demograficas: {
      facultad: pickWeighted([
        ["ciencias-salud", 35],
        ["humanidades", 18],
        ["ciencias-administrativas", 18],
        ["ingenieria-tecnologia", 18],
        ["teologia", 6],
        ["posgrado", 5]
      ]),
      tiempo_docencia: pickWeighted([["<5", 18], ["5-14", 35], ["15-24", 32], ["25+", 15]]),
      sexo: pickWeighted([["F", 58], ["M", 40], ["prefiero-no-decir", 2]])
    },
    respuestas: {
      postura: pickWeighted([
        ["entusiasmo", 20],
        ["curiosidad-cautelosa", 45],
        ["neutral", 22],
        ["preocupacion", 11],
        ["rechazo", 2]
      ]),
      d1_ensayo: sampleLikert(3.2, 0.9),
      d1_calculo: sampleLikert(2.7, 1),
      d1_examen_disciplina: sampleLikert(2.5, 1.1),
      d1_codigo: sampleLikert(3, 1),
      d1_literatura: sampleLikert(3, 0.9),
      d1_agentic: sampleLikert(1.8, 0.8),
      d2_frecuencia: pickWeighted([
        ["diaria", 8],
        ["varias-semana", 22],
        ["semanal", 30],
        ["mensual", 18],
        ["rara-vez", 16],
        ["nunca", 6]
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
        ["ninguna", 1]
      ]),
      politica_institucional: pickWeighted([
        ["si-conozco", 8],
        ["existe-no-leida", 18],
        ["no-estoy-seguro", 60],
        ["seguro-no-existe", 14]
      ]),
      d3_porcentaje: pickWeighted([
        ["<25", 5],
        ["25-50", 22],
        ["50-75", 38],
        [">75", 25],
        ["casi-todos", 10]
      ]),
      d3_confianza_deteccion: sampleLikert(2.1, 0.9),
      d3_como_detecta: pickN(
        ["software-detector", "cambios-estilo", "defensa-oral", "analisis-citas", "comparacion-trabajos-previos", "sin-metodo"],
        1,
        3
      )
    }
  };
}
__name(genApertura, "genApertura");
__name2(genApertura, "genApertura");
function genCierre() {
  return {
    demograficas: {
      facultad: pickWeighted([
        ["ciencias-salud", 35],
        ["humanidades", 18],
        ["ciencias-administrativas", 18],
        ["ingenieria-tecnologia", 18],
        ["teologia", 6],
        ["posgrado", 5]
      ]),
      tiempo_docencia: pickWeighted([["<5", 18], ["5-14", 35], ["15-24", 32], ["25+", 15]])
    },
    respuestas: {
      // After capacitación, perception shifted UP for capacidad
      c1_agentic: sampleLikert(3.8, 0.8),
      c2_porcentaje: pickWeighted([
        ["<25", 2],
        ["25-50", 10],
        ["50-75", 30],
        [">75", 38],
        ["casi-todos", 20]
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
        ["aun-no-decido", 5]
      ])
    }
  };
}
__name(genCierre, "genCierre");
__name2(genCierre, "genCierre");
async function onRequestOptions4() {
  return new Response(null, { status: 204, headers: corsHeaders4() });
}
__name(onRequestOptions4, "onRequestOptions4");
__name2(onRequestOptions4, "onRequestOptions");
async function onRequestPost2(context) {
  if (!isAdmin3(context.request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders4()
    });
  }
  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: corsHeaders4()
    });
  }
  const { fase, n } = body;
  if (!VALID_FASES3.includes(fase)) {
    return new Response(JSON.stringify({ error: "Invalid fase" }), {
      status: 400,
      headers: corsHeaders4()
    });
  }
  if (!Number.isInteger(n) || n < 1 || n > 200) {
    return new Response(JSON.stringify({ error: "n must be integer 1..200" }), {
      status: 400,
      headers: corsHeaders4()
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
      ts: new Date(Date.now() - Math.floor(Math.random() * 5 * 60 * 1e3)).toISOString(),
      // within last 5 min
      demograficas: gen.demograficas,
      respuestas: gen.respuestas
    };
    await kv.put(`resp:${fase}:${respId}`, JSON.stringify(payload));
  }
  return new Response(JSON.stringify({ ok: true, created: n, fase }), {
    status: 200,
    headers: corsHeaders4()
  });
}
__name(onRequestPost2, "onRequestPost2");
__name2(onRequestPost2, "onRequestPost");
var ADMIN_TOKEN4 = "2008464";
var VALID_SCOPES = ["apertura", "cierre", "all"];
function corsHeaders5() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json; charset=utf-8"
  };
}
__name(corsHeaders5, "corsHeaders5");
__name2(corsHeaders5, "corsHeaders");
function isAdmin4(request) {
  return request.headers.get("X-Admin-Token") === ADMIN_TOKEN4;
}
__name(isAdmin4, "isAdmin4");
__name2(isAdmin4, "isAdmin");
async function onRequestOptions5() {
  return new Response(null, { status: 204, headers: corsHeaders5() });
}
__name(onRequestOptions5, "onRequestOptions5");
__name2(onRequestOptions5, "onRequestOptions");
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
__name(deletePrefix, "deletePrefix");
__name2(deletePrefix, "deletePrefix");
async function onRequestDelete(context) {
  if (!isAdmin4(context.request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders5()
    });
  }
  const url = new URL(context.request.url);
  const scope = url.searchParams.get("scope");
  if (!VALID_SCOPES.includes(scope)) {
    return new Response(JSON.stringify({ error: "Invalid scope" }), {
      status: 400,
      headers: corsHeaders5()
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
    headers: corsHeaders5()
  });
}
__name(onRequestDelete, "onRequestDelete");
__name2(onRequestDelete, "onRequestDelete");
var routes = [
  {
    routePath: "/api/aggregate",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/aggregate",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/phase",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/phase",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/api/phase",
    mountPath: "/api",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/responses",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/responses",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions3]
  },
  {
    routePath: "/api/responses",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/seed",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions4]
  },
  {
    routePath: "/api/seed",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/wipe",
    mountPath: "/api",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/wipe",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions5]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// ../../../../../../Users/misael.michel/AppData/Roaming/fnm/node-versions/v24.14.1/installation/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// ../../../../../../Users/misael.michel/AppData/Roaming/fnm/node-versions/v24.14.1/installation/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-IofWh0/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// ../../../../../../Users/misael.michel/AppData/Roaming/fnm/node-versions/v24.14.1/installation/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-IofWh0/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.9195125840120415.js.map
