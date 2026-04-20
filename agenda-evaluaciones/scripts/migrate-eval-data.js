#!/usr/bin/env node
/**
 * migrate-eval-data.js
 * Inyecta datos del Reporte Final de Evaluación de Recuperación SIST-3311
 * directamente en Cloudflare KV.
 *
 * Uso desde /agenda-evaluaciones/:
 *   node scripts/migrate-eval-data.js            # dry-run (muestra JSON, no escribe)
 *   node scripts/migrate-eval-data.js --apply    # escribe a KV
 *   node scripts/migrate-eval-data.js --publicar # escribe a KV y publica a estudiantes
 */

const { execSync } = require("child_process");
const crypto = require("crypto");

const CONFIG_ID       = "sist3311-recuperacion-ene-abr-2026";
const STATE_KEY       = `state_${CONFIG_ID}`;
const KV_NAMESPACE_ID = "79692a43270042d5baf881c90bdceaf8";
const TIPO_ACTIVIDAD  = "eval-recuperacion";
const NOW             = new Date().toISOString();

const APPLY   = process.argv.includes("--apply") || process.argv.includes("--publicar");
const PUBLICAR = process.argv.includes("--publicar");

// ─── Slots de mañana (dom-19-abr-mañana) para estudiantes sin reserva ─────────
const VENTANA_DEFAULT = "dom-19-abr-mañana";
const SLOTS_DISPONIBLES = [
  "09:50","10:00","10:10","10:20","10:30","10:40",
  "10:50","11:00","11:10","11:20","11:30",
];

// ─── Datos del Reporte Final (TXT adjunto) ────────────────────────────────────
const EVALUACIONES = [
  {
    matricula: "2024-0357",
    puntosTotales: 14.5,
    rondas: [
      {
        competenciaId: "c1-recopilacion",
        preguntaId: "c1-p1",
        puntosFinal: 7.5,
        transcripcion:
          "La primera técnica que utilizaría sería la entrevista para hablar con la persona que agenda las citas y entender cómo lo hace y qué problema persiste, porque quizá muchos mensajes a la vez, algunos quizás no son para precisamente agendar citas. Luego la observación para ver el proceso real y detectar el error como citas que no se registran correctamente. El análisis documental para revisar la libreta y ver la organización y cuáles son las inconsistencias. Y para los pacientes, un cuestionario para conocer su experiencia del otro lado.",
        observacion:
          "Excelente. Nombró las 4 técnicas con aplicación concreta y perspicaz. Destacable: aplicó el cuestionario a los pacientes (no al personal) y observó que la entrevista descubre matices. Demuestra criterio analítico real. [Teoría: 3.5/3.5 · Aplicación: 4.0/4.0]",
      },
      {
        competenciaId: "c5-dfd",
        preguntaId: "c5-p1",
        puntosFinal: 7.0,
        transcripcion:
          "La entidad externa, en este caso los estudiantes y el bibliotecario. Los flujos de datos serían la solicitud del préstamo y la confirmación que devuelve el sistema. La entidad externa representa los actores fuera del sistema. El proceso es el que va a gestionar el préstamo. El flujo de datos es la solicitud del préstamo. Y el almacén de datos donde se va a guardar la información.",
        observacion:
          "Nombró y definió los 4 símbolos correctamente. Aplicó al caso con acierto. Pidió permiso para dibujar, demostrando pensamiento visual. Ligera falta: no nombró almacenes específicos en la aplicación. [Teoría: 3.5/3.5 · Aplicación: 3.5/4.0]",
      },
    ],
    checksGlobales: { "camara-encendida": true, "mirada-estable": true, "sin-clics": true, "sin-pausas": true, "lenguaje-natural": true, "fluidez": true },
    observacionGlobal: "Mejor desempeño de toda la evaluación. Evidentemente estudió el material. Cámara OK. Sin consultas. Lenguaje estructurado. Nerviosismo declarado pero no reflejado.",
  },
  {
    matricula: "2024-0284",
    puntosTotales: 11.5,
    rondas: [
      {
        competenciaId: "c2-validacion",
        preguntaId: "c2-p1",
        puntosFinal: 5.5,
        transcripcion:
          "La triangulación sería como cruzar los resultados de las tres herramientas para tener hallazgos identificados por dos fuentes o más. Es importante para que no sean hallazgos débiles. [Sobre contradicción:] El hallazgo se podría tomar en cuenta ya que se encuentra sustentado por 2 fuentes, a pesar de que la observación demuestra un resultado contrario.",
        observacion:
          "Definió triangulación correctamente. Ante la contradicción, eligió la mayoría sin proponer investigar por qué la observación contradice. Le faltó el matiz de que ninguna fuente se descarta sin análisis. [Teoría: 3.0/3.5 · Aplicación: 2.5/4.0]",
      },
      {
        competenciaId: "c4-prototipado",
        preguntaId: "c4-p1",
        puntosFinal: 6.0,
        transcripcion:
          "Sirve para diseñar la interfaz de manera visual. Sin feedback es un dibujo sin más. Con feedback se encuentra sustentado por el usuario, se puede actualizar y cambiar.",
        observacion:
          "Correcta en esencia. Le faltó que el propósito principal es VALIDAR REQUERIMIENTOS y no detalló cómo documentar el feedback (tabla con rol, pantalla, comentario, decisión). [Teoría: 3.0/3.5 · Aplicación: 3.0/4.0]",
      },
    ],
    checksGlobales: { "camara-encendida": true, "mirada-estable": true, "sin-clics": true, "sin-pausas": true, "lenguaje-natural": true, "fluidez": true },
    observacionGlobal: "Comprensión sólida. Debilidad en profundidad analítica ante situaciones complejas. Cámara OK. Mirada estable. Lenguaje natural y fluido.",
  },
  {
    matricula: "2023-0239",
    puntosTotales: 10.0,
    rondas: [
      {
        competenciaId: "c8-especificaciones",
        preguntaId: "c8-p2",
        puntosFinal: 5.5,
        transcripcion:
          "Estamos hablando de reglas de negocio, son cosas que si se están cumpliendo o no. Básicamente una decisión, si pasa esto va a suceder esto. Tenemos que hacer un diagrama de la regla de negocio. Dependiendo las reglas que se cumple o se deje de cumplir, el resultado va a ser uno o va a ser otro. [Sobre cuándo conviene:] Una tabla de decisión es importante usarla cuando hay cosas que se tienen que decidir. Tenemos varias determinantes y varios resultados. Tenemos que poner sobre la mesa la determinante, la regla de negocio, para poder decidir algo concreto. Como tenemos variables y resultados dependiendo la combinación, puedes utilizar la tabla de decisión.",
        observacion:
          "No usó el nombre formal 'tabla de decisión' inicialmente (dijo 'diagrama de la regla de negocio') pero su descripción funcional es correcta. La segunda parte fue más precisa: conectó tabla de decisión con 'varias determinantes y resultados dependiendo la combinación'. Demuestra comprensión conceptual aunque con terminología informal. [Teoría: 2.5/3.5 · Aplicación: 3.0/4.0]",
      },
      {
        competenciaId: "c10-propuesta",
        preguntaId: "c10-p2",
        puntosFinal: 4.5,
        transcripcion:
          "Primero tenemos que hacer una investigación. De eso se trata toda la materia, investigación. A partir de esa investigación vamos a definir ciertos puntos. Te puedo entregar un sistema que registre las reparaciones, notifique al cliente y controle inventario. Para llegar a resultados que el cliente espera tenemos que ver si está omitiendo información, si hay algún vacío. Podríamos ir en persona al negocio, verificar, hacer un cuestionario a los empleados y verificar que lo que él me está pidiendo es todo. [Sobre costos:] Evidentemente desarrollar el programa no va a ser gratis. Detrás de eso también hay un mantenimiento. Le puedo decir lo que le entrego y lo que pido.",
        observacion:
          "Demostró buena comprensión del proceso general de análisis: investigar antes de proponer, verificar que no hay vacíos, evitar construir la solución incorrecta. Mencionó costos de desarrollo y mantenimiento. Solo presentó UNA alternativa (no dos como se requiere), no desglosó categorías formales de costos, y los beneficios fueron implícitos. [Teoría: 2.0/3.5 · Aplicación: 2.5/4.0]",
      },
    ],
    checksGlobales: { "camara-encendida": true, "mirada-estable": true, "sin-clics": true, "sin-pausas": true, "lenguaje-natural": true, "fluidez": true },
    observacionGlobal: "Comprensión buena del proceso de análisis como un todo. Conecta los conceptos con la lógica general de la materia ('de eso se trata toda la materia, investigación'). Terminología informal pero razonamiento correcto. Debilidad en estructura formal de entregables. Cámara OK. Problemas de conexión/audio (tuvo que cambiar de red). Sin consultas.",
  },
  {
    matricula: "2024-0306",
    puntosTotales: 8.5,
    rondas: [
      {
        competenciaId: "c3-requerimientos",
        preguntaId: "c3-p2",
        puntosFinal: 3.5,
        transcripcion:
          "Los requerimientos funcionales son acciones que hace el sistema, mientras que uno no funcional son cualidades. [Intentó RF:] Que el sistema detectara a tiempo las medicinas que vencen para sacarla del inventario. [No logró dar criterio de aceptación ni RNF. Sobre calidad:] Que se cumpla lo que se está pidiendo, que sea eficaz.",
        observacion:
          "Diferencia RF de RNF correctamente pero de forma básica. No logró formular con estructura formal ni dar criterio de aceptación. No mencionó criterios de calidad formales (claro, específico, verificable, trazable, atómico). [Teoría: 2.0/3.5 · Aplicación: 1.5/4.0]",
      },
      {
        competenciaId: "c8-especificaciones",
        preguntaId: "c8-p2",
        puntosFinal: 5.0,
        transcripcion:
          "Se utilizaría un DFD. El DFD es una tabla que muestra las diferentes opciones o resultados dependiendo de la combinación de los elementos. [Sobre cuándo conviene:] Cuando hay varias opciones de las cuales depende la combinación de acciones.",
        observacion:
          "Confundió el nombre (dijo 'DFD' describiendo una tabla de decisión) pero la descripción funcional es correcta. Respondió bien cuándo conviene tabla de decisión sobre Structured English. [Teoría: 2.5/3.5 · Aplicación: 2.5/4.0]",
      },
    ],
    checksGlobales: { "camara-encendida": true, "mirada-estable": true, "sin-clics": true, "sin-pausas": true, "lenguaje-natural": true, "fluidez": true },
    observacionGlobal: "Comprensión intermedia. Intuición correcta pero terminología imprecisa. Cámara OK. Pidió repetición varias veces (legítimo). Lenguaje natural.",
  },
  {
    matricula: "2022-0678",
    puntosTotales: 7.5,
    rondas: [
      {
        competenciaId: "c1-recopilacion",
        preguntaId: "c1-p2",
        puntosFinal: 6.5,
        transcripcion:
          "Las cuatro técnicas: entrevista, cuestionarios, análisis de documento y observación. Con la entrevista podemos hacerle preguntas al encargado. El cuestionario porque quizás en la entrevista el empleado no nos comparta cierta información que en el cuestionario se sienta con la confianza. Con la observación podemos ver cuáles son las cosas que distraen. Y con el análisis documental, si el empleado dice alguna necesidad pero ya está documentada, puedo ver que es real.",
        observacion:
          "Excelente. Nombró las 4 técnicas con razonamiento propio. La observación sobre confianza del cuestionario vs. entrevista demuestra comprensión real de la complementariedad. [Teoría: 3.0/3.5 · Aplicación: 3.5/4.0]",
      },
      {
        competenciaId: "c6-diccionario",
        preguntaId: "c6-p2",
        puntosFinal: 1.0,
        transcripcion:
          "Un almacén de factura, uno de los datos podría ser la información o los productos. [Reconoció:] Ahí estoy un poquito quedado con el diccionario.",
        observacion:
          "No pudo dar campos concretos ni usar notación de diccionario. Los campos mencionados son categorías genéricas, no campos de datos. [Teoría: 0.5/3.5 · Aplicación: 0.5/4.0]",
      },
    ],
    checksGlobales: { "camara-encendida": true, "mirada-estable": true, "sin-clics": true, "sin-pausas": true, "lenguaje-natural": true, "fluidez": true },
    observacionGlobal: "Perfil desbalanceado. Fuerte en levantamiento, muy débil en diccionario. Cámara OK. Nerviosismo inicial recuperado. Honesto cuando no sabía.",
  },
  {
    matricula: "2024-0321",
    puntosTotales: 7.5,
    rondas: [
      {
        competenciaId: "c2-validacion",
        preguntaId: "c2-p2",
        puntosFinal: 4.0,
        transcripcion:
          "Tendría que ver los documentos del dueño, interrogaría más al dueño y a los empleados ya que esto puede ser falta de comunicación. [Sobre triangulación:] Es cuando medimos la información que nos da una parte y la otra y nos quedamos con la verdadera respuesta.",
        observacion:
          "Aplicación parcialmente buena: propuso investigar más (documentos, empleados) en lugar de elegir un lado. Definición de triangulación imprecisa: no mencionó cruzar fuentes independientes ni confirmar con 2+ fuentes. [Teoría: 1.5/3.5 · Aplicación: 2.5/4.0]",
      },
      {
        competenciaId: "c10-propuesta",
        preguntaId: "c10-p2",
        puntosFinal: 3.5,
        transcripcion:
          "[Alt. 1:] Sistema desde cero con pantallas para feedback, notificación y clientes frecuentes. [Alt. 2:] Algo más simple de una o dos páginas. [Costos:] Dependiendo de lo que vea cómo se ve el negocio y de lo que gasté en páginas. [Beneficios:] La primera es mayor rendimiento. La otra tiene beneficios a corto plazo.",
        observacion:
          "Presentó dos alternativas (bien) pero las describió como variaciones de prototipo. No mencionó categorías formales de costo (desarrollo, infraestructura, capacitación). Beneficios genéricos sin conexión con requerimientos. [Teoría: 1.5/3.5 · Aplicación: 2.0/4.0]",
      },
    ],
    checksGlobales: { "camara-encendida": true, "mirada-estable": true, "sin-clics": true, "sin-pausas": true, "lenguaje-natural": true, "fluidez": true },
    observacionGlobal: "Mejor en aplicación que en teoría. Intuición correcta pero sin terminología formal. Cámara OK. No pudo compartir pantalla (problema técnico). Sin consultas. Lenguaje natural.",
  },
  {
    matricula: "2024-0282",
    puntosTotales: 6.0,
    rondas: [
      {
        competenciaId: "c2-validacion",
        preguntaId: "c2-p1",
        puntosFinal: 3.5,
        transcripcion:
          "La triangulación es el método de buscar uno o más hallazgos para que la investigación sea reputable y no haiga divariado en el asunto. [Sobre contradicción:] Faltaría usar el análisis de documentos para terminar de validar y descartar la observación que no coincide.",
        observacion:
          "Esencia presente pero formulación muy imprecisa y coloquial. Propuso buscar más evidencia (bueno) pero concluyó que hay que 'descartar' la observación (incorrecto). [Teoría: 2.0/3.5 · Aplicación: 1.5/4.0]",
      },
      {
        competenciaId: "c9-trazabilidad",
        preguntaId: "c9-p1",
        puntosFinal: 2.5,
        transcripcion:
          "Ahí le voy a ser sincero, ahí me quemé. [Sobre el problema:] El analista pasó por alto el punto de agregar el proceso. La solución sería retroceder los pasos para verificar dónde estuvo el error.",
        observacion:
          "No definió trazabilidad (lo reconoció). Identificó parcialmente el problema y propuso 'retroceder' (intuición correcta). Honesto. [Teoría: 0.5/3.5 · Aplicación: 2.0/4.0]",
      },
    ],
    checksGlobales: { "camara-encendida": true, "mirada-estable": true, "sin-clics": true, "sin-pausas": true, "lenguaje-natural": false, "fluidez": true },
    observacionGlobal: "Intuición práctica sin vocabulario técnico. Fue honesto cuando no sabía. Cámara desde celular. Sin consultas. Lenguaje muy coloquial.",
  },
  {
    matricula: "2024-0283",
    puntosTotales: 3.5,
    rondas: [
      {
        competenciaId: "c7-balanceo",
        preguntaId: "c7-p2",
        puntosFinal: 2.0,
        transcripcion:
          "¿Que no está recibiendo igual que de nivel cero? [pausa] No le está entrando los datos como al nivel cero, ya eso era.",
        observacion:
          "Intuyó vagamente que hay un problema de correspondencia entre niveles, pero no articuló. No mencionó 'balanceo', ni 'agujero negro', ni explicó qué implica que 3 subprocesos no reciban datos. Respuesta extremadamente breve. [Teoría: 1.0/3.5 · Aplicación: 1.0/4.0]",
      },
      {
        competenciaId: "c3-requerimientos",
        preguntaId: "c3-p2",
        puntosFinal: 1.5,
        transcripcion:
          "[RF:] Una gestión de productos con nombres, códigos, venta, fecha de vencimiento, cantidad de stock. [RNF:] Que el sistema debe ser fácil, con una interfaz amigable, debe ser rápido, la búsqueda debe ser accesible.",
        observacion:
          "Lo que describió como RF es una lista de campos, no un requerimiento (falta 'El sistema debe [verbo]...'). El RNF es el error clásico: 'fácil', 'rápido', 'amigable' sin métrica. No dio criterio de aceptación. [Teoría: 1.0/3.5 · Aplicación: 0.5/4.0]",
      },
    ],
    checksGlobales: { "camara-encendida": true, "mirada-estable": true, "sin-clics": true, "sin-pausas": true, "lenguaje-natural": true, "fluidez": true },
    observacionGlobal: "Comprensión muy básica. Confundió campos con RF. RNF sin métrica. Problemas técnicos. Evaluación breve. Sin consultas.",
  },
  {
    matricula: "2023-0178",
    puntosTotales: 2.0,
    rondas: [
      {
        competenciaId: "c2-validacion",
        preguntaId: "c2-p1",
        puntosFinal: 1.5,
        transcripcion:
          "Son las ideas claras que se obtienen de la información. [Sobre contradicción, después de múltiples repeticiones:] Yo haría lo que haría es recolectar la nueva información para determinar una idea clara.",
        observacion:
          "No entiende triangulación. La definió como 'ideas claras de la información', que es genérico y no corresponde al concepto. Ante la contradicción, propuso 'recolectar nueva información', que es vago y no aborda el problema de fuentes contradictorias. Tuvo dificultad para articular y necesitó múltiples repeticiones. [Teoría: 0.5/3.5 · Aplicación: 1.0/4.0]",
      },
      {
        competenciaId: "c5-dfd",
        preguntaId: "c5-p1",
        puntosFinal: 0.5,
        transcripcion:
          "[Después de que el profesor aclaró que el diagrama de contexto es el DFD de nivel cero:] Yo sé que pondría el ID estudiante. A saber quién cogió. Ya no me llega más.",
        observacion:
          "No pudo identificar los elementos del DFD (entidad externa, proceso, flujo, almacén). Lo que mencionó ('ID estudiante') es un campo de datos, no un elemento del diagrama. Reconoció no poder responder más. El profesor le dio múltiples pistas y tiempo adicional sin resultado. [Teoría: 0.0/3.5 · Aplicación: 0.5/4.0]",
      },
    ],
    checksGlobales: { "camara-encendida": true, "mirada-estable": false, "sin-clics": true, "sin-pausas": false, "lenguaje-natural": false, "fluidez": false },
    observacionGlobal: "Comprensión muy limitada. No domina los conceptos fundamentales del curso. Reconoció no haberse preparado suficientemente. Tiene dificultades reales con el material. Cámara OK. Sin consultas. Muy nervioso. Dificultad evidente para articular.",
  },
  {
    matricula: "2022-0603",
    puntosTotales: 1.5,
    rondas: [
      {
        competenciaId: "c9-trazabilidad",
        preguntaId: "c9-p1",
        puntosFinal: 1.5,
        transcripcion:
          "La trazabilidad es donde se puede verificar la información que ya uno obtiene. [Solución:] Hacer una encuesta con delivery para ver cuánto tiempo toma. Un cuestionario de preguntas cerradas.",
        observacion:
          "No entiende trazabilidad. Confundió el problema (RF sin proceso en DFD) con necesidad de levantamiento. Propuso cuestionarios cuando se necesita agregar un proceso al DFD. [Teoría: 1.0/3.5 · Aplicación: 0.5/4.0]",
      },
      {
        competenciaId: "c8-especificaciones",
        preguntaId: "c8-p1",
        puntosFinal: 0.0,
        transcripcion:
          "[Describió los pasos del proceso pero no identificó ninguna técnica de documentación.] No me acuerdo, profesor.",
        observacion:
          "Narró qué ocurre pero no identificó Structured English ni tabla de decisión. Reconoció no saber. [Teoría: 0.0/3.5 · Aplicación: 0.0/4.0]",
      },
    ],
    checksGlobales: { "camara-encendida": true, "mirada-estable": true, "sin-clics": true, "sin-pausas": false, "lenguaje-natural": true, "fluidez": false },
    observacionGlobal: "Comprensión muy limitada. Confundió conceptos entre sí. Falta de estudio evidente. Cámara OK. Pausas largas por desconocimiento genuino. Sin consultas.",
  },
  {
    matricula: "2024-0379",
    puntosTotales: 1.5,
    rondas: [
      {
        competenciaId: "c5-dfd",
        preguntaId: "c5-p1",
        puntosFinal: 0.5,
        transcripcion:
          "De ese tema yo no me lo sé muy bien. Yo me centré más en lo que era el feedback.",
        observacion:
          "No pudo definir diagrama de contexto ni nombrar sus elementos, aun con pista del profesor. [Teoría: 0.5/3.5 · Aplicación: 0.0/4.0]",
      },
      {
        competenciaId: "c2-validacion",
        preguntaId: "c2-p2",
        puntosFinal: 1.0,
        transcripcion:
          "Sería primero preguntarle al entrevistador, después investigar, y por último preguntarle a las mismas personas. [Sobre contradicción:] Irme por parte de los clientes, ya que si los clientes recibieron la información, el que estaría mal sería el dueño.",
        observacion:
          "No entiende triangulación (describió repetir la misma técnica). Eligió un lado sin investigar. [Teoría: 0.5/3.5 · Aplicación: 0.5/4.0]",
      },
    ],
    checksGlobales: { "camara-encendida": true, "mirada-estable": true, "sin-clics": true, "sin-pausas": true, "lenguaje-natural": true, "fluidez": true },
    observacionGlobal: "Comprensión muy limitada. Condiciones no ideales pero respuestas reflejan falta de estudio. Cámara limitada (calle). No compartió pantalla. Sin consultas.",
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
function uuid() {
  return `r-${crypto.randomUUID()}`;
}

function getState() {
  try {
    const out = execSync(
      `wrangler kv key get --namespace-id ${KV_NAMESPACE_ID} "${STATE_KEY}"`,
      { cwd: __dirname + "/..", encoding: "utf8", stdio: ["pipe","pipe","pipe"] }
    ).trim();
    if (!out || out === "null" || out === "undefined") return null;
    return JSON.parse(out);
  } catch (e) {
    // Key may not exist yet
    return null;
  }
}

function putState(state) {
  const tmp = require("path").join(require("os").tmpdir(), "kv-state-migration.json");
  require("fs").writeFileSync(tmp, JSON.stringify(state));
  execSync(
    `wrangler kv key put --namespace-id ${KV_NAMESPACE_ID} "${STATE_KEY}" --path "${tmp}"`,
    { cwd: __dirname + "/..", encoding: "utf8", stdio: "inherit" }
  );
  require("fs").unlinkSync(tmp);
}

function buildEvaluacion(ev, estado) {
  return {
    rondas: ev.rondas.map((r, i) => ({
      n: i + 1,
      competenciaId: r.competenciaId,
      preguntaId: r.preguntaId,
      puntosLive: r.puntosFinal,
      puntosFinal: r.puntosFinal,
      transcripcion: r.transcripcion,
      observacion: r.observacion,
    })),
    checksGlobales: ev.checksGlobales,
    observacionGlobal: ev.observacionGlobal,
    videosURLs: [],
    puntosTotales: ev.puntosTotales,
    ...(estado === "publicada" ? { publicadaEn: NOW } : {}),
  };
}

function main() {
  console.log(`\n🎯 Migración de datos SIST-3311 Recuperación ENE-ABR 2026`);
  console.log(`   Modo: ${APPLY ? (PUBLICAR ? "PUBLICAR" : "APLICAR") : "DRY-RUN (solo muestra cambios)"}\n`);

  let currentState = getState();
  if (!currentState) {
    console.log("⚠️  No se encontró estado en KV. Creando estado nuevo.");
    currentState = { version: 0, reservas: {} };
  } else {
    console.log(`✓ Estado KV leído (versión ${currentState.version}, ${Object.keys(currentState.reservas).length} reservas existentes)`);
  }

  const reservas = { ...currentState.reservas };
  const estadoDestino = PUBLICAR ? "publicada" : "evaluada";
  let slotIdx = 0;

  for (const ev of EVALUACIONES) {
    // Buscar reserva existente por matricula + tipo
    const existente = Object.values(reservas).find(
      r => r.estudianteMatricula === ev.matricula && r.tipoActividadId === TIPO_ACTIVIDAD
    );

    const evaluacion = buildEvaluacion(ev, estadoDestino);

    if (existente) {
      console.log(`  ✎ UPDATE  ${ev.matricula}  →  ${existente.id}  (${estadoDestino})`);
      reservas[existente.id] = {
        ...existente,
        estado: estadoDestino,
        evaluacion,
      };
    } else {
      const id = uuid();
      const slot = SLOTS_DISPONIBLES[slotIdx++] || "10:00";
      console.log(`  + CREATE  ${ev.matricula}  →  ${id}  slot=${slot}  (${estadoDestino})`);
      reservas[id] = {
        id,
        estudianteMatricula: ev.matricula,
        tipoActividadId: TIPO_ACTIVIDAD,
        ventanaId: VENTANA_DEFAULT,
        slotInicio: slot,
        estado: estadoDestino,
        creadaEn: NOW,
        evaluacion,
      };
    }
  }

  const newState = {
    version: currentState.version + 1,
    reservas,
  };

  if (!APPLY) {
    console.log("\n📋 Estado resultante (dry-run, no se escribe):");
    console.log(JSON.stringify(newState, null, 2));
    console.log("\n▶  Para aplicar: node scripts/migrate-eval-data.js --apply");
    console.log("▶  Para aplicar y publicar: node scripts/migrate-eval-data.js --publicar");
    return;
  }

  console.log("\n⬆  Escribiendo estado a KV...");
  putState(newState);
  console.log(`\n✅ Migración completada. ${EVALUACIONES.length} estudiantes procesados.`);
  if (PUBLICAR) {
    console.log("📢 Resultados publicados — los estudiantes ya pueden ver sus notas.");
  } else {
    console.log("🔒 Estado: evaluada. Para publicar, usa --publicar o el botón en la app.");
  }
}

main();
