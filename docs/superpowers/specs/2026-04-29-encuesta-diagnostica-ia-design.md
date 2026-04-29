# Diseño — Encuesta diagnóstica de IA en docencia (UNAD)

**Fecha:** 2026-04-29
**Autor:** Prof. Misael Michel (UNAD) + Claude Code
**Estado:** Aprobado (pendiente revisión final del usuario)
**Carpeta destino:** `encuesta-diagnostica-ia/`

---

## 1. Resumen

Aplicación web de encuesta diagnóstica en tiempo real para abrir y cerrar la capacitación docente *"Inteligencia Artificial en la Educación Superior — Estado del arte abril 2026"* (UNAD, dos sesiones de 90 minutos basadas en la `Guia_Facilitador_UNAD_v4`).

La app se proyecta en pantalla compartida durante la sesión virtual, los docentes responden desde su celular vía QR/URL pública (anónimo, sin login), y el facilitador ve un dashboard que se recalcula automáticamente. Tras cerrar cada fase, el dashboard se contrasta con benchmarks académicos (HEPI 2026, Anthropic Education 2025, MIT Kosmyna 2025, SEP México 2026) para producir el "choque de percepción vs realidad" que abre pedagógicamente las dos sesiones.

**Audiencia:** ~70–80 docentes UNAD, todas las facultades.
**Modalidad:** virtual (Zoom/Meet) con pantalla compartida.
**Persistencia:** Cloudflare KV (append-only, una key por respuesta).
**Despliegue:** Cloudflare Pages independiente del resto del monorepo.

---

## 2. Contexto y motivación

La guía v4 del facilitador define una "app diagnóstica en vivo" como apertura experiencial de la sesión 1 (Bloque 1.1) y cierre comparativo de la sesión 2 (Bloque 2.5). La guía describe la lógica pedagógica y los indicadores deseados, pero no provee la app — tiene que construirse aparte. Esta es esa app.

Razones pedagógicas (extraídas de la guía):

1. **Establecer línea base sin sermón previo.** "Antes de hablarles, quiero ver dónde están ustedes." La encuesta abre la sesión sin currículum ni introducción larga.
2. **Producir contraste objetivo.** El facilitador proyecta los promedios del grupo, luego superpone el dato académico. La gráfica habla por sí sola; el facilitador comenta.
3. **Cerrar el ciclo con comparativo agregado.** Al final de la sesión 2, las preguntas críticas se repiten para que el grupo vea cómo cambió su percepción ("esto es lo que cambió en sus mentes en estas dos sesiones"). El comparativo es a nivel grupo, no individual (la encuesta es anónima — no se pueden parear personas entre apertura y cierre).

El diseño y las preguntas se validaron contra literatura externa reciente (HEPI 2026, SEP México 2026, CSU AI Survey 2025/26, marco ABCE de Ng et al. 2024). Dos preguntas se agregaron como resultado de esta investigación: postura afectiva hacia la IA (eje *Affective* de ABCE) y conocimiento de política institucional (gap de 71.8% reportado por SEP 2026).

---

## 3. Alcance

### En alcance (MVP)

- Form de apertura (18 ítems) y form de cierre (7 ítems) en URLs distintas.
- Dashboard público read-only con polling 3 s y filtros por facultad / tiempo docencia / postura / sexo.
- Vista comparativo apertura↔cierre en preguntas comunes.
- Panel admin protegido por matrícula del profesor: cambiar fase, sembrar 80 respuestas demo, wipear datos, exportar JSON/CSV.
- Persistencia Cloudflare KV append-only (una key por respuesta).
- Anti-duplicado por `respId` en `localStorage` del cliente.
- Branding y paleta del monorepo (`--navy`, `--blue`, `--mint`, etc.).

### Fuera de alcance (explícitamente diferido)

- Login de docentes (encuesta es anónima por diseño).
- Pareo individual de respuestas apertura↔cierre (anonimato lo prohíbe; comparativo es agregado).
- Recolección de comentarios libres / texto largo (todas las preguntas son cerradas).
- Análisis estadístico avanzado (chi-cuadrado, regresión). El dashboard muestra distribuciones simples; análisis profundo se hace post-evento desde el export CSV.
- Multi-tenant configurable por código (esta versión soporta una sola configuración hardcoded; si se reutiliza para otra capacitación, se clona el repo o se extiende a `CONFIGURACIONES[]` como `selector-de-proyectos`).
- Integración con Zoom/Meet/SSO institucional.
- Notificaciones push/email.

---

## 4. Glosario

| Término | Definición |
|---|---|
| **Fase** | Estado de la encuesta: `apertura`, `cierre`, o `cerrada`. La controla el admin. Cada form solo acepta envíos cuando su fase está activa. |
| **Respuesta** | Documento JSON que un docente envía. Incluye `respId` (ULID), demográficas, y respuestas a las preguntas de la fase. |
| **respId** | Identificador único generado en cliente con ULID. Sirve para anti-duplicado y como clave de KV. |
| **Demográficas** | 4 campos en apertura (facultad, coordinación, tiempo docencia, sexo) y 2 mínimas en cierre (facultad, tiempo docencia). |
| **Pregunta sustantiva** | Pregunta que mide percepción/uso/práctica. Se agrupan en 3 dimensiones (D1, D2, D3) más 2 transversales (postura, política). |
| **Likert5** | Escala 1–5 (1=muy mal/muy bajo, 5=excelente/muy alto). Usada para D1 y confianza en D3. |
| **single** | Selección única de N opciones. |
| **multi** | Selección múltiple, marca todas las que apliquen. |
| **Benchmark** | Dato académico que se superpone a la respuesta del grupo para producir el contraste pedagógico. |
| **Comparativo agregado** | Gráfica de barras pareadas (apertura vs cierre) en preguntas comunes. No requiere parear individuos. |

---

## 5. Arquitectura

### 5.1 Estructura de archivos

```
encuesta-diagnostica-ia/
├── CLAUDE.md                  ← contexto específico de la herramienta
├── index.html                  ← landing + router (#apertura, #cierre, #dashboard, #admin)
├── functions/
│   └── api/
│       ├── responses.js        ← POST nueva respuesta, GET listado
│       ├── aggregate.js        ← GET agregaciones con filtros
│       ├── phase.js            ← GET/PUT fase activa
│       ├── seed.js             ← POST sembrar N demo (admin)
│       └── wipe.js             ← DELETE wipe (admin)
└── wrangler.toml               ← binding KV ENCUESTA_IA_STATE
```

Una sola SPA en `index.html`, navegación por hash (`#apertura`, `#cierre`, `#dashboard`, `#admin`). Sin build step. Chart.js por CDN.

### 5.2 Modelo de datos en KV

KV namespace: `ENCUESTA_IA_STATE`.

**Keys:**

| Key | Valor | Notas |
|---|---|---|
| `phase` | `"apertura"` \| `"cierre"` \| `"cerrada"` | Fase activa global. Default `"apertura"`. |
| `resp:apertura:{respId}` | JSON de respuesta apertura | Append-only. Una por docente. |
| `resp:cierre:{respId}` | JSON de respuesta cierre | Append-only. Una por docente. |

**Esquema de respuesta apertura:**

```json
{
  "respId": "01J1A8K3B5...",
  "fase": "apertura",
  "ts": "2026-04-29T14:32:11Z",
  "demograficas": {
    "facultad": "ingenieria-tecnologia",
    "coordinacion": "tbd-A",
    "tiempo_docencia": "5-14",
    "sexo": "F"
  },
  "respuestas": {
    "postura": "curiosidad-cautelosa",
    "d1_ensayo": 3,
    "d1_calculo": 2,
    "d1_examen_disciplina": 2,
    "d1_codigo": 4,
    "d1_literatura": 3,
    "d1_agentic": 2,
    "d2_frecuencia": "semanal",
    "d2_usos": ["buscar-info", "generar-ideas", "diseñar-rubricas"],
    "d2_herramienta": "chatgpt",
    "politica_institucional": "no-estoy-seguro",
    "d3_porcentaje": "50-75",
    "d3_confianza_deteccion": 2,
    "d3_como_detecta": ["cambios-estilo", "defensa-oral"]
  }
}
```

**Esquema de respuesta cierre:**

```json
{
  "respId": "01J1B5M9...",
  "fase": "cierre",
  "ts": "2026-05-13T15:01:42Z",
  "demograficas": {
    "facultad": "ciencias-salud",
    "tiempo_docencia": "15-24"
  },
  "respuestas": {
    "c1_agentic": 4,
    "c2_porcentaje": ">75",
    "c3_confianza_deteccion": 3,
    "c4_confianza_redisenar": 4,
    "c5_tecnica": "defensa-oral"
  }
}
```

### 5.3 API de Pages Functions

| Endpoint | Método | Auth | Descripción |
|---|---|---|---|
| `/api/responses` | POST | — | Body: `{ fase, respId, demograficas, respuestas }`. Worker valida fase activa, ULID válido, schema mínimo, escribe `resp:{fase}:{respId}`. Idempotente: re-PUT con mismo `respId` reemplaza (permite corregir si el usuario edita y re-envía). 201. |
| `/api/responses` | GET | admin | Lista respuestas crudas con paginación (cursor de KV.list). 200. |
| `/api/aggregate` | GET | — | Query: `?fase=apertura&filtros[facultad]=...`. Worker hace `KV.list({prefix})`, batch get, agrega en memoria por pregunta y por filtro, devuelve `{ n, byQuestion: {...}, byFiltro: {...} }`. Cache 2 s en worker (CF Cache API) para reducir lecturas con polling. 200. |
| `/api/phase` | GET | — | Lee `phase` y devuelve `{ phase }`. Llamado por los forms al cargar para saber si su fase está activa. 200. |
| `/api/phase` | PUT | admin | Body: `{ phase }`. Cambia la fase. 200. |
| `/api/seed` | POST | admin | Body: `{ fase, n }`. Genera N respuestas demo aleatorias con distribuciones realistas (definidas en sección 7), las escribe a KV. 200 con `{ created: n }`. |
| `/api/wipe` | DELETE | admin | Query: `?scope=apertura\|cierre\|all`. KV.list + batch delete. Doble confirmación se hace en cliente. 200 con `{ deleted: count }`. |

**Auth admin:** header `X-Admin-Token` con valor igual a `PROFESOR_MATRICULA` (constante en `index.html` y validada en cada worker). Es seguridad por oscuridad — aceptable para el alcance (no hay datos sensibles, anonimato preserva privacidad).

**CORS:** abierto (`*`) ya que la app vive en una sola origin pero los workers también responden a OPTIONS preflight por compatibilidad.

### 5.4 Frontend — routing y vistas

```
/             → landing (botones grandes: Responder apertura · Responder cierre · Dashboard)
/#apertura    → form apertura
/#cierre      → form cierre
/#gracias     → pantalla de confirmación tras enviar
/#dashboard   → dashboard público read-only (auto-poll 3 s)
/#admin       → panel admin (input matrícula → desbloquea acciones)
```

QR para apertura → URL pública `/#apertura`. QR para cierre → `/#cierre`. El facilitador imprime/proyecta cada QR cuando corresponde.

### 5.5 Patrón de polling y consistencia

El dashboard hace `GET /api/aggregate?fase=...` cada **3 segundos**. Cada respuesta de `aggregate` lleva el `n` actual y los breakdowns. Si llega una nueva respuesta entre dos polls, en el siguiente poll aparece y la gráfica se anima sutilmente (transición CSS de 400 ms en las barras de Chart.js). No hay websockets ni SSE — el polling es suficiente para N=80 y simplifica enormemente la implementación.

El cache de 2 s en `aggregate` evita martillar KV cuando 5+ pestañas dashboard estén abiertas simultáneamente (caso real: facilitador comparte pantalla + co-facilitador mira en su laptop + asistente mira desde otra ventana).

No hay locking optimista. Cada respuesta tiene un `respId` ULID único, así que las escrituras nunca colisionan. Si dos personas envían exactamente al mismo tiempo, las dos quedan guardadas con keys distintas. ✓

### 5.6 Anti-duplicado

`localStorage["encuesta_ia_resp_{fase}"] = respId` al enviar exitosamente. Al cargar el form, si ya existe ese key, se muestra "Ya enviaste tu respuesta de esta fase. Si necesitas corregir, contacta al facilitador." con botón "Re-enviar de todos modos" (rara vez necesario, deja la decisión al usuario; el worker permite re-PUT con mismo respId).

Esto NO es seguridad — el usuario puede limpiar su localStorage o usar otro browser. Pero en el contexto (capacitación con facilitador supervisando) basta.

---

## 6. Catálogo de preguntas

### 6.1 Apertura (18 ítems)

#### Demográficas (4)

| Code | Pregunta | Tipo | Opciones |
|---|---|---|---|
| `dem_facultad` | Facultad vinculada a tu labor docente | single | `ciencias-salud`, `humanidades`, `ciencias-administrativas`, `ingenieria-tecnologia`, `teologia`, `posgrado` |
| `dem_coordinacion` | Coordinación a la que perteneces | single | TBD (placeholders editables) + `otra` |
| `dem_tiempo_docencia` | Tiempo total impartiendo docencia (cualquier institución) | single | `<5`, `5-14`, `15-24`, `25+` |
| `dem_sexo` | Sexo | single | `F`, `M`, `prefiero-no-decir` |

#### Postura (1)

| Code | Pregunta | Tipo | Opciones |
|---|---|---|---|
| `postura` | ¿Cuál es tu postura general hacia la IA en educación? | single | `entusiasmo`, `curiosidad-cautelosa`, `neutral`, `preocupacion`, `rechazo` |

#### D1 — Capacidad real de la IA actual (6 Likert 1–5)

Stem común: *"¿Qué tan bien crees que la IA actual puede…?"* (1 = muy mal, 5 = excelente)

| Code | Ítem |
|---|---|
| `d1_ensayo` | …generar un ensayo universitario aprobatorio de 300–1500 palabras sobre un tema general |
| `d1_calculo` | …resolver problemas de cálculo / matemática a nivel pregrado |
| `d1_examen_disciplina` | …aprobar un examen estandarizado de tu propia disciplina (ej: NCLEX en enfermería, certificación CompTIA en sistemas, ECOE en medicina) |
| `d1_codigo` | …escribir código funcional que pase tests automatizados |
| `d1_literatura` | …sintetizar literatura académica reciente con citas verificables |
| `d1_agentic` | …realizar tareas multi-paso en un computador sin supervisión humana (descargar archivos, llenar formularios, navegar la web — todo en una sola corrida) |

#### D2 — Tu uso de la IA (3)

| Code | Pregunta | Tipo | Opciones |
|---|---|---|---|
| `d2_frecuencia` | ¿Con qué frecuencia usas IA en tu labor docente? | single | `diaria`, `varias-semana`, `semanal`, `mensual`, `rara-vez`, `nunca` |
| `d2_usos` | ¿Para qué la usas? (marca todas las que apliquen) | multi | `buscar-info`, `generar-ideas`, `redactar-correos`, `crear-ejercicios`, `disenar-rubricas`, `generar-examenes`, `calificar`, `resumir-lecturas`, `traducir`, `investigacion-citas`, `no-la-uso`, `otro` |
| `d2_herramienta` | ¿Cuál es tu herramienta principal de IA? | single | `chatgpt`, `claude`, `gemini`, `copilot`, `deepseek`, `otra`, `ninguna` |

#### Política institucional (1)

| Code | Pregunta | Tipo | Opciones |
|---|---|---|---|
| `politica_institucional` | ¿Conoces la política institucional de UNAD sobre uso de IA? | single | `si-conozco`, `existe-no-leida`, `no-estoy-seguro`, `seguro-no-existe` |

#### D3 — Tus estudiantes (3)

| Code | Pregunta | Tipo | Opciones |
|---|---|---|---|
| `d3_porcentaje` | ¿Qué % de tus estudiantes crees que usa IA semanalmente para sus trabajos? | single | `<25`, `25-50`, `50-75`, `>75`, `casi-todos` |
| `d3_confianza_deteccion` | ¿Qué tan seguro/a te sientes de poder detectar uso indebido de IA? | likert5 | 1–5 |
| `d3_como_detecta` | Cuando sospechas uso indebido, ¿cómo lo evalúas? (multi) | multi | `software-detector`, `cambios-estilo`, `defensa-oral`, `analisis-citas`, `comparacion-trabajos-previos`, `sin-metodo`, `otro` |

### 6.2 Cierre (7 ítems)

#### Demográficas mínimas (2)

`dem_facultad` y `dem_tiempo_docencia` (mismas opciones que apertura). Permiten filtrar el comparativo.

#### Críticas comparables con apertura (3)

| Code | Pregunta | Tipo | Comparable con |
|---|---|---|---|
| `c1_agentic` | (= `d1_agentic`) Capacidad de la IA para tareas multi-paso en un computador | likert5 | `d1_agentic` |
| `c2_porcentaje` | (= `d3_porcentaje`) % estudiantes usando IA semanalmente | single | `d3_porcentaje` |
| `c3_confianza_deteccion` | (= `d3_confianza_deteccion`) Confianza para detectar uso indebido | likert5 | `d3_confianza_deteccion` |

#### Nuevas (2)

| Code | Pregunta | Tipo | Opciones |
|---|---|---|---|
| `c4_confianza_redisenar` | ¿Qué tan seguro/a te sientes de poder rediseñar tus evaluaciones contra simulación de IA? | likert5 | 1–5 |
| `c5_tecnica` | ¿Cuál es la primera técnica que vas a aplicar? | single | `portafolio-procesual`, `defensa-oral`, `demostracion-presencial`, `proyecto-datos-locales`, `evaluacion-inversa`, `aun-no-decido` |

### 6.3 Tiempo estimado

| Tipo | Cantidad | Tiempo unitario | Subtotal |
|---|---:|---:|---:|
| Demográficas single | 4 | 7 s | 28 s |
| Postura single | 1 | 8 s | 8 s |
| D1 Likert | 6 | 8 s | 48 s |
| D2 frecuencia single | 1 | 8 s | 8 s |
| D2 usos multi | 1 | 30 s | 30 s |
| D2 herramienta single | 1 | 8 s | 8 s |
| Política single | 1 | 8 s | 8 s |
| D3 porcentaje single | 1 | 8 s | 8 s |
| D3 confianza Likert | 1 | 8 s | 8 s |
| D3 cómo detecta multi | 1 | 25 s | 25 s |
| **Total apertura** | **18** | | **~3.3 min puro tap** |

Con titubeo, lectura cuidadosa y celular lento → **4–5.5 min real**. Cabe en techo flexible de 5–6 min.

**Cierre:** 5 ítems sustantivos + 2 demográficas. Total ~75–90 s.

---

## 7. Dashboard

### 7.1 Layout

```
┌───────────────────────────────────────────────────────────┐
│  Encuesta diagnóstica IA — UNAD · Capacitación abril 2026 │
│  Fase activa: APERTURA   ·   n=42 docentes  ·  hace 4 s   │
├───────────────────────────────────────────────────────────┤
│ Filtros: [Todos] [Por facultad ▾] [Por tiempo ▾]          │
│          [Por postura ▾] [Por sexo ▾]                     │
├───────────────────────────────────────────────────────────┤
│ D1 — Capacidad de la IA (Likert 1-5)                      │
│   Ensayo universitario       ▓▓▓▓▓▓▓░░ 3.4 ← evidencia 5  │
│   Cálculo pregrado          ▓▓▓▓▓░░░ 2.6 ← evidencia 4.5  │
│   Examen disciplina         ▓▓▓▓░░░░ 2.4 ← evidencia 4.4  │
│   Código + tests            ▓▓▓▓▓▓░░ 3.1 ← evidencia 4.5  │
│   Literatura + citas        ▓▓▓▓▓░░░ 2.8 ← evidencia 4.0  │
│   Uso agentic               ▓▓▓░░░░░ 1.9 ← evidencia 4.5  │ ← brecha mayor
│                                                            │
│ D2 — Tu uso de IA                                         │
│   Frecuencia: [pie chart]   Herramienta: [pie chart]      │
│   Usos: [horizontal bars con % de menciones]              │
│                                                            │
│ Política institucional                                    │
│   [pie con 4 segmentos]                                   │
│                                                            │
│ D3 — Tus estudiantes                                      │
│   % usando IA: [horizontal bars]                          │
│   Confianza detección: [Likert distribution]              │
│   Cómo detectas: [horizontal bars con % menciones]        │
│                                                            │
│ Postura                                                   │
│   [horizontal bars]                                       │
└───────────────────────────────────────────────────────────┘
```

Cada sección puede colapsar/expandir para que el facilitador haga zoom en lo que está discutiendo.

### 7.2 Overlay de evidencia académica

El facilitador presiona **"Mostrar evidencia"** y aparece una línea/punto rojo punteado sobre cada barra Likert, marcando dónde cae el benchmark. Esto produce el contraste pedagógico que pide la guía.

Benchmarks por ítem (codificados en `index.html` como constantes):

| Ítem | Benchmark | Fuente |
|---|---|---|
| `d1_ensayo` | 5/5 (Yeadon 2022 Durham, GPT-3 obtenía First Class) | Guía v4, sección 1.3 |
| `d1_calculo` | 4.5/5 (GPT-5.5 51.7% FrontierMath nivel 1-3) | Guía v4 |
| `d1_examen_disciplina` | 4.4/5 (ChatGPT-4 88.7% NCLEX-RN) | Guía v4 |
| `d1_codigo` | 4.5/5 (GPT-5.5 82.7% Terminal-Bench 2.0; Claude Opus 4.7 64.3% SWE-bench Pro) | Guía v4 |
| `d1_literatura` | 4.0/5 (Deep Research Gemini 3.1 Pro, Perplexity Pro) | Guía v4 |
| `d1_agentic` | 4.5/5 (GPT-5.5 82.7% Terminal-Bench 2.0) | Guía v4 |
| `d3_porcentaje` | `>75%` o `casi todos` (HEPI 2026: 95% UK estudiantes usan IA, 94% en evaluaciones) | HEPI 2026 |
| `d3_confianza_deteccion` | 2/5 (Coursera: 1 de cada 4 docentes confía en detectar) | Guía v4 |
| `politica_institucional` | 71.8% no sabe (SEP México 2026) | Investigación |

### 7.3 Modo comparativo apertura↔cierre

URL `/#dashboard?modo=comparativo` (o toggle en la UI). Para las 3 preguntas comunes (`agentic`, `porcentaje`, `confianza_deteccion`), muestra dos barras lado a lado: apertura (gris) y cierre (color). Mensaje pedagógico de la guía: *"Esto es lo que cambió en sus mentes en estas dos sesiones."*

Solo se activa el modo si `aggregate` con `fase=cierre` devuelve `n > 0`.

### 7.4 Filtros

Los chips de filtro envían query params al `aggregate` y el worker aplica el filtro server-side antes de agregar. Multi-filtro se combina con AND. Si el filtro deja `n < 5`, la sección filtrada muestra "n insuficiente para mostrar (n=3)" en lugar de la gráfica — protección contra dashboards engañosos por celdas pequeñas.

---

## 8. Panel admin

URL: `/#admin`. Al cargar, pide la matrícula. Si coincide con `PROFESOR_MATRICULA = "2008464"`, desbloquea las acciones. La matrícula se guarda en `sessionStorage` (no `localStorage`) para que se borre al cerrar la pestaña.

Acciones disponibles:

### 8.1 Cambiar fase activa

Selector con tres opciones: `apertura` · `cierre` · `cerrada`. Al cambiar, PUT `/api/phase`. Confirmación inline antes de aplicar.

Cuando la fase está en `cerrada`, ambos forms (`/#apertura` y `/#cierre`) muestran "La encuesta está cerrada. Gracias por participar." y rechazan envíos en el cliente. El worker también valida y responde 403 si alguien intenta POST con `respId` nuevo en fase cerrada (protege contra envíos rezagados que llegan tarde).

### 8.2 Sembrar 80 respuestas demo

Botón "🧪 Sembrar 80 respuestas demo (apertura)". Doble confirmación. POST `/api/seed?fase=apertura&n=80`.

El worker genera 80 respuestas con distribuciones realistas (codificadas):

```
facultad: 35% Salud, 18% Humanidades, 18% Admin, 18% Ing&Tec, 6% Teología, 5% Posgrado
tiempo:   18% <5, 35% 5-14, 32% 15-24, 15% 25+
sexo:     58% F, 40% M, 2% PND
postura:  20% entusiasmo, 45% curiosidad, 22% neutral, 11% preocupación, 2% rechazo

D1 Likerts (sesgo a subestimar capacidad agentica):
  d1_ensayo:           media 3.2, sd 0.9
  d1_calculo:          media 2.7, sd 1.0
  d1_examen_disciplina:media 2.5, sd 1.1
  d1_codigo:           media 3.0, sd 1.0
  d1_literatura:       media 3.0, sd 0.9
  d1_agentic:          media 1.8, sd 0.8 (gap mayor con la realidad)

D2:
  frecuencia: 8% diaria, 22% varias-semana, 30% semanal, 18% mensual, 16% rara-vez, 6% nunca
  usos:       muestreo aleatorio de 1-4 elementos, sesgado a buscar-info y generar-ideas
  herramienta: 60% chatgpt, 12% claude, 12% gemini, 8% copilot, 2% deepseek, 5% otra, 1% ninguna

política: 8% si-conozco, 18% existe-no-leida, 60% no-estoy-seguro, 14% seguro-no-existe

D3:
  porcentaje:           5% <25, 22% 25-50, 38% 50-75, 25% >75, 10% casi-todos
  confianza_deteccion:  media 2.1, sd 0.9
  como_detecta:         multi muestreo 1-3 ítems
```

Análogamente para sembrar cierre con `c1_agentic`, etc., con distribuciones que reflejen un shift post-capacitación (medias D1 más altas, confianza_deteccion más alta).

Esto permite verificar visualmente el dashboard antes del taller real con un click.

### 8.3 Wipe data

Tres botones:
- 🗑️ Wipe apertura (doble confirm + escribir "BORRAR" en input)
- 🗑️ Wipe cierre (doble confirm + escribir "BORRAR")
- ⚠️ Wipe TODO (apertura + cierre + reset fase a "apertura") — triple confirm

DELETE `/api/wipe?scope=...`. El worker hace `KV.list({prefix: "resp:..."})` + batch `KV.delete`. Devuelve `{ deleted: count }`.

### 8.4 Export

- ⬇ JSON crudo (todas las respuestas, una fase a la vez)
- ⬇ CSV agregado (filas: respId; columnas: una por pregunta)

Generado en cliente desde el `/api/responses?fase=...&limit=200` paginado. Para N=80 cabe en una sola página sin paginación adicional.

---

## 9. Manejo de errores

| Escenario | Respuesta |
|---|---|
| POST `/api/responses` con fase inactiva | 403 + mensaje "La fase X no está abierta" |
| POST con respId malformado | 400 |
| GET `/api/aggregate` cuando no hay respuestas | 200 con `{ n: 0, byQuestion: {}, byFiltro: {} }`. El dashboard muestra "Esperando respuestas…" |
| KV.list cuando excede 1000 keys (no pasará con N=80, pero por seguridad) | Worker pagina con cursor, agrega en múltiples vueltas |
| Network timeout en cliente al enviar form | Toast "Error de red. Reintentando…" + 1 reintento automático con el mismo respId. Si falla 2x, toast rojo "No pudimos enviar. Verifica tu conexión." con botón Reintentar. |
| Cliente sin localStorage (ej. modo incógnito + restricciones) | El anti-duplicado pierde efecto pero la app funciona. Aceptable. |
| Admin token incorrecto | 401 |

---

## 10. Validación / pruebas manuales

Lista de checks antes de cada release (similar a las otras herramientas del monorepo):

**Form apertura:**
- [ ] QR/URL `/#apertura` carga el form en celular sin scroll horizontal
- [ ] Demográficas validan obligatoriedad antes de pasar a la siguiente sección
- [ ] Likerts permiten elegir 1–5 con tap grande (≥44 px)
- [ ] Multi-select permite deseleccionar
- [ ] Submit muestra spinner + bloquea doble-click
- [ ] localStorage marca `respId` enviado; al recargar muestra "Ya enviaste"
- [ ] Botón "Re-enviar de todos modos" funciona

**Form cierre:** ídem con sus 7 ítems.

**Dashboard:**
- [ ] Carga con `n=0` muestra mensaje educado
- [ ] Polling cada 3 s actualiza n y barras
- [ ] Filtros chip combinan en AND
- [ ] Filtro que deja n<5 muestra mensaje protector
- [ ] Botón "Mostrar evidencia" muestra/oculta línea roja
- [ ] Modo comparativo solo aparece si cierre tiene n>0

**Admin:**
- [ ] Matrícula incorrecta no desbloquea
- [ ] Cambiar fase aplica y los forms reaccionan al toque (refrescar form en celular)
- [ ] Seed 80 demo crea 80 respuestas y el dashboard las muestra
- [ ] Wipe apertura no toca cierre y viceversa
- [ ] Wipe TODO resetea fase a apertura
- [ ] Export CSV abre limpio en Excel
- [ ] Export JSON es válido JSON

**Locking / concurrencia:**
- [ ] 80 envíos simultáneos (script local con fetch) no pierden ninguno
- [ ] Dos pestañas dashboard abiertas no causan double-fetch problemático

**Cross-browser:**
- [ ] Chrome Android, Safari iOS, Firefox desktop

---

## 11. Despliegue

### 11.1 Crear KV namespace

```bash
cd encuesta-diagnostica-ia
wrangler kv namespace create ENCUESTA_IA_STATE
```

Copiar el `id` retornado en `wrangler.toml`.

### 11.2 wrangler.toml

```toml
name = "encuesta-diagnostica-ia"
compatibility_date = "2026-04-01"
pages_build_output_dir = "."

[[kv_namespaces]]
binding = "ENCUESTA_IA_STATE"
id = "<id-real-aqui>"
```

### 11.3 Pages

1. Cloudflare Pages → Add Production Branch `main` → publish directory `encuesta-diagnostica-ia` → build command vacío.
2. Settings → Functions → KV namespace bindings: asociar `ENCUESTA_IA_STATE` al namespace creado.
3. Push a `main` → redeploy automático.
4. URL: `encuesta-diagnostica-ia.pages.dev`.

### 11.4 QR

Generar 2 QR distintos (recomendado: `qrcode-monkey` o `chart.googleapis.com`):
- Apertura → `https://encuesta-diagnostica-ia.pages.dev/#apertura`
- Cierre → `https://encuesta-diagnostica-ia.pages.dev/#cierre`

Imprimir + tener en slide listo. Probar con un celular real antes de la sesión.

### 11.5 Local dev

```bash
cd encuesta-diagnostica-ia
wrangler pages dev . --port 8788
# abrir http://localhost:8788/#apertura
```

KV efímero local. Wipe automático al cerrar wrangler.

---

## 12. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Internet débil en sala virtual | Media | Alto (encuesta no se carga) | Form muy ligero (~50 KB total). Toast claro al fallar. Backup manual: QR a Google Forms previamente preparado. |
| Confusión de QR (alguien escanea apertura cuando está cerrada) | Alta | Bajo | Form rechaza y muestra "Apertura ya cerró. Gracias." con link al cierre si aplica. |
| Datos demo no wipeados antes del taller real | Media | Medio | Checklist pre-taller obligatorio incluye wipe. Indicador en dashboard: si hay datos, mostrar timestamp del más reciente para que el facilitador note inmediatamente. |
| Ráfaga de envíos satura KV | Baja | Bajo | KV soporta >1000 writes/seg. N=80 en 5 min = 0.27 writes/seg. Sin problema. |
| Dashboard no se actualiza por bug de polling | Baja | Alto | Botón "↻ Refrescar manual" siempre visible como fallback. Tests manuales pre-taller. |
| Coordinaciones nunca llegan | Alta | Bajo | Campo se elimina del form vía toggle config. Se preserva resto. |
| Facilitador olvida cambiar fase | Media | Medio | El form de cierre puede aceptar envíos aunque la fase esté en apertura, configurable por flag. Default: estricto (rechaza). El admin puede aflojar si conviene. |

---

## 13. Calendario tentativo

- **Día 1** (hoy): aprobar spec, escribir plan de implementación.
- **Día 2-3**: implementar HTML monolítico + workers de API.
- **Día 4**: probar con seed 80, ajustar dashboard y benchmarks.
- **Día 5**: deploy a Pages, generar QR, pruebas con 2-3 celulares reales.
- **Antes del taller**: wipe data demo, validar checklist completo.

---

## 14. Referencias

- Guía del facilitador UNAD v4 (`Guia_Facilitador_UNAD_v4.docx`) — Bloques 1.1, 1.2, 1.3, 1.4 y 2.5.
- Patrón realtime: `agenda-evaluaciones/functions/api/state.js` (Cloudflare Pages Function + KV).
- HEPI Report 199 — *Student Generative AI Survey 2026*.
- SEP México 2026 — encuesta nacional de IA en educación superior (1.07M docentes).
- CSU AI Survey 2025/26 — California State University.
- Ng D.T.K. et al. (2024) — *Design and validation of the AI literacy questionnaire (ABCE)*, BJET.
- Anthropic Education Report 2025.
- Kosmyna N. et al. (2025) — preprint MIT Media Lab sobre EEG y deuda cognitiva con ChatGPT.

---

*Estado: aprobado en chat por Prof. Misael Michel · pendiente revisión final del documento escrito antes de pasar a writing-plans.*
