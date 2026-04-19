# Diseño — Agenda de Evaluaciones

**Fecha:** 2026-04-19
**Autor:** Prof. Misael Michel (UNAD) + Claude Code
**Estado:** Aprobado (pendiente revisión final del usuario)
**Carpeta destino:** `agenda-evaluaciones/`

---

## 1. Resumen

Herramienta web para coordinar evaluaciones de recuperación (u otras sesiones evaluativas) con reservas de horario por estudiante y un flujo completo de evaluación para el profesor. Reutilizable entre materias mediante un array `CONFIGURACIONES` en código.

**Primer caso de uso:** `SIST-3311 Análisis de Sistemas` — evaluación de recuperación abril 2026 (25 estudiantes, 10 competencias, 2 preguntas por estudiante, 15 puntos extra).

**Objetivo:** evitar mensajes WhatsApp manuales para coordinar horarios, automatizar el picking aleatorio de competencias/preguntas, generar prompt para IA externa que analice transcripciones, y exponer resultados al estudiante sin friction.

---

## 2. Contexto y motivación

El profesor actualmente coordina la evaluación por WhatsApp (ver `Mensaje_WhatsApp_Recuperacion_v2_SIST-3311.txt`). Problemas:

1. Agendar 25 estudiantes a mano es tedioso y propenso a colisiones de horario.
2. Elegir 2 competencias + 2 preguntas "al azar" sin sesgo es difícil.
3. Post-call, el análisis de transcripción con IA externa requiere pegar manualmente contexto + rúbrica + transcripción cada vez.
4. Comunicar resultados individualmente vuelve a ser WhatsApp uno-a-uno.

Esta herramienta resuelve los 4 puntos en un único flujo, desplegable en Cloudflare Pages como las demás herramientas del monorepo.

---

## 3. Alcance

### En alcance (MVP)

- Login combinado (estudiante / profesor) con selector de materia/configuración.
- Reserva de slots por estudiante: hasta 1 slot por tipo de actividad.
- Agenda cronológica para el profesor con filtros por estado/tipo/ventana.
- Sesión de evaluación live con ruleta 2-niveles (competencia → pregunta), dedupe de competencia por estudiante, scoring live, checks globales.
- Panel post-sesión: pegar transcripción, copiar prompt para IA, pegar respuesta, ajustar nota.
- Publicar/despublicar individual o en bulk.
- Vista de resultado para el estudiante con detalle por ronda.
- Reportes `.txt` individual y global por sección.
- Persistencia en Cloudflare KV con locking optimista.

### Fuera de alcance (explícitamente diferido)

- Panel de mantenimiento de datos (estudiantes/competencias/preguntas). Se editan por código en `CONFIGURACIONES`.
- Cancelación de reserva por el estudiante.
- Grabación/transcripción automática dentro de la app.
- Notificaciones push o email.
- Análisis IA dentro de la app (se usa IA externa por ahora).
- Integración con Zoom/Meet. El link de videollamada se comparte por medios externos.
- Generación de PDF. Solo `.txt` en MVP.

---

## 4. Glosario

| Término | Definición |
|---|---|
| **Configuración / tarea** | Entrada de `CONFIGURACIONES` que agrupa una materia + período + evaluación. Ej. "SIST-3311 recuperación ENE-ABR 2026". |
| **Ventana** | Rango de disponibilidad publicado por el profesor (ej. domingo 19 abr 9:00–12:00). Una tarea puede tener N ventanas. |
| **Slot** | Sub-división de 5 min dentro de una ventana (duración fija por tarea). Unidad de reserva. |
| **Reserva** | Slot tomado por un estudiante para un tipo de actividad específico. |
| **Tipo de actividad** | Clasificación de la reserva (ej. "evaluación de recuperación", "consulta general"). Definida por configuración. |
| **Ronda** | Una vuelta de ruleta competencia+pregunta durante la sesión de evaluación. La tarea define cuántas rondas por estudiante (2 por defecto). |
| **Competencia** | Tema/habilidad evaluable. Cada una tiene un pool de preguntas. |
| **Pregunta** | Escenario + pregunta guía dentro de una competencia. |
| **Rúbrica** | Esquema de puntuación (rondas × puntos por ronda + checks globales). |
| **Checks globales** | Reglas de cumplimiento durante la llamada (cámara on, sin notas, sin consultas). Si falla y se asocia a una ronda, esa ronda = 0. |

---

## 5. Arquitectura

### 5.1 Estructura de archivos

```
agenda-evaluaciones/
├── CLAUDE.md                      ← contexto específico de la herramienta
├── index.html                     ← app monolítica modular (HTML + CSS + JS inline)
├── wrangler.toml                  ← Cloudflare Pages config + KV binding
└── functions/
    └── api/
        └── state.js               ← Worker GET/PUT con locking optimista
```

Se mantiene el patrón de `selector-de-proyectos` (1 HTML + functions), ya validado en producción.

### 5.2 Módulos internos en `index.html`

Organizados por namespace explícito (`App.Xxx`) para permitir trabajar por bloques y habilitar reutilización futura. No hay build step.

| Módulo | Responsabilidad |
|---|---|
| `App.Core` | Config activa, cliente KV, locking optimista, router hash-based, bus de eventos |
| `App.Auth` | Pantalla login (materia → nombre → matrícula → rol), validación |
| `App.Student` | Home estudiante, slot picker, reservar, vista de resultados publicados |
| `App.Teacher` | Agenda global, detalle reserva, publicar/despublicar, filtros |
| `App.Roulette` | Canvas 2-niveles con dedupe por estudiante, animación de inercia |
| `App.Eval` | Panel evaluación live (rondas, scoring, checks, observación) |
| `App.Prompt` | Generador copypaste de prompt para IA externa |
| `App.Reports` | Export `.txt` individual y global |
| `App.UI` | Primitivos visuales (modal, toast, confirm) |

### 5.3 Router (hash-based, sin dependencias)

```
#/                                → login
#/estudiante/agenda
#/estudiante/resultado/:reservaId
#/profe/agenda
#/profe/eval/:reservaId
#/profe/reportes
```

---

## 6. Data model

### 6.1 `CONFIGURACIONES` (fuente de verdad, editable por código)

```javascript
const CONFIGURACIONES = [
  {
    id: "sist3311-recuperacion-ene-abr-2026",
    etiqueta: "Análisis de Sistemas — Recuperación ENE-ABR 2026",
    asignatura: {
      codigo:  "SIST-3311",
      nombre:  "Análisis de Sistemas",
      periodo: "Enero – Abril 2026",
      tarea:   "Evaluación de recuperación",
    },

    estudiantes: [
      { matricula: "2016-0810", nombre: "GIOVANNY BAUTISTA CASTILLO" },
      // ... 25 estudiantes (fuente: Listado estudiantes.pdf)
    ],

    tiposActividad: [
      { id: "eval-recuperacion", etiqueta: "Evaluación de recuperación" },
      { id: "consulta-general",  etiqueta: "Consulta general" },
    ],

    ventanas: [
      {
        id: "dom-19-abr-mañana",
        fecha: "2026-04-19",
        inicio: "09:00",
        fin:    "12:00",
        slotMinutos: 5,
      },
    ],

    rubrica: {
      rondasPorEstudiante: 2,
      puntosPorRonda: 7.5,
      checksGlobales: [
        { id: "camara-on",     etiqueta: "Cámara encendida" },
        { id: "sin-notas",     etiqueta: "Sin notas / pantalla secundaria" },
        { id: "sin-consultas", etiqueta: "Sin consultas externas" },
      ],
    },

    competencias: [
      {
        id: "c1-recopilacion",
        nombre: "C1 — Recopilación de información",
        preguntas: [
          { id: "c1-p1", escenario: "...", preguntaGuia: "..." },
        ],
      },
      // c2 a c10 (fuente: Evaluacion_Recuperacion_Estudiante_SIST-3311.docx)
    ],

    promptTemplate: `Eres evaluador... Competencia: {{competencia}}. Pregunta: {{pregunta}}. Escenario: {{escenario}}. Rúbrica: {{rubrica}}. Transcripción: {{transcripcion}}. Devuelve observación + nota sugerida 0-7.5.`,
  },
];

const PROFESOR_MATRICULA = "2008464"; // usado como "contraseña" (nunca rotulado como matrícula en UI)
```

### 6.2 KV schema

**Key:** `state:{configId}` (ej. `state:sist3311-recuperacion-ene-abr-2026`).

**Value (JSON):**

```javascript
{
  version: 42,                           // locking optimista
  reservas: {
    "r-abc123": {
      id: "r-abc123",
      estudianteMatricula: "2024-0007",
      tipoActividadId: "eval-recuperacion",
      ventanaId: "dom-19-abr-mañana",
      slotInicio: "09:15",                // hh:mm dentro de ventana
      estado: "publicada",                // reservada | en-sesion | completada | evaluada | publicada
      creadaEn: "2026-04-18T21:30:00Z",
      evaluacion: {
        rondas: [
          {
            n: 1,
            competenciaId: "c3-requerimientos",
            preguntaId: "c3-p2",
            puntosLive: 6.5,
            puntosFinal: 7.0,
            transcripcion: "...",
            observacion: "...",
            checksFallados: [],
          },
        ],
        checksGlobales: { "camara-on": true, "sin-notas": true, "sin-consultas": true },
        observacionGlobal: "...",
        videosURLs: ["https://..."],
        puntosTotales: 14.0,
        publicadaEn: "2026-04-20T18:00:00Z",
      },
    },
  },
}
```

**Índices derivados en memoria** (no persistidos): slots tomados por ventana, reservas por estudiante, estadísticas agregadas.

**IDs de reserva:** el cliente genera el id con `crypto.randomUUID()` antes del PUT. Colisión prácticamente imposible; el locking optimista cubre el resto.

### 6.3 Estados de reserva (state machine)

```
reservada ──► en-sesion ──► completada ──► evaluada ──► publicada
                                                            │
                                                            ▼
                                                       (despublica)
                                                            │
                                                            ▼
                                                        evaluada
```

- **reservada:** estudiante reservó. Profe aún no inicia.
- **en-sesion:** profe abrió evaluación. Videollamada en curso. Datos se van guardando live.
- **completada:** call terminó. Notas live guardadas. Falta análisis IA.
- **evaluada:** profe procesó transcripción + respuesta IA. Nota final. No visible al estudiante aún.
- **publicada:** estudiante puede ver detalle completo.

---

## 7. Flujos de usuario

### 7.1 Login común

```
Cargar app → GET KV → render login
│
├── Dropdown materia (CONFIGURACIONES[].etiqueta)
├── Dropdown nombre (estudiantes de config seleccionada)
├── Input matrícula
├── [Entrar como estudiante]  → valida matrícula ∈ estudiantes de la config
└── [🔒 Soy profesor]          → expande input "contraseña"
                                 ├── == PROFESOR_MATRICULA → modo profe
                                 └── ≠ → error inline
```

### 7.2 Estudiante — reservar

```
Home estudiante
├── Sección "Mis reservas" (estados + [Ver detalle] si publicada)
└── Sección "Reservar"
     → escoger tipo actividad (ocultos los ya reservados por cap)
     → escoger ventana
     → escoger slot libre (grid 5-min color-coded)
     → confirmar
     → PUT KV → estado = reservada
     → toast "✓ Reservado"
```

### 7.3 Estudiante — ver resultado

```
Home estudiante (re-entra días después)
└── Lista reservas con badge estado:
     ├── reservada     → "Pendiente de evaluar"
     ├── en-sesion     → "En evaluación ahora"
     ├── completada    → "Calificando..."
     ├── evaluada      → "Calificando..."   (idéntico al estudiante; no revela publicación)
     └── publicada     → [Ver detalle] → por ronda: competencia, pregunta, nota, observación
                                          + checks globales, observación global, nota total
```

### 7.4 Profe — agenda

```
Home profe
├── Header: materia + período + [Reportes]
├── Tabla cronológica de reservas (una fila por slot tomado)
│    ├── Fecha/hora | Estudiante | Tipo | Estado | Acciones
│    └── Acción según estado: [Iniciar eval] / [Continuar] / [Procesar] / [Publicar] / [Despublicar]
├── Filtros chip: estado / tipo / ventana
└── Stats agregadas arriba
```

### 7.5 Profe — evaluación live

```
[Iniciar evaluación] en una reserva
  → confirm
  → PUT estado = en-sesion
  → pantalla evaluación (solo profe la ve, estudiante NO)
     ├── Cabecera: nombre + tipo + countdown 5 min (informativo)
     ├── Panel checks globales (toggles)
     ├── Rondas verticales
     │    ├── Ronda 1 auto-visible
     │    │    ├── [🎰 Girar competencia] (excluye ya giradas)
     │    │    ├── post-giro → muestra nombre competencia
     │    │    ├── [🎰 Girar pregunta] (pool de esa competencia)
     │    │    ├── post-giro → muestra escenario + pregunta guía (profe dicta verbal)
     │    │    ├── Slider nota 0–7.5
     │    │    └── Textarea observación rápida
     │    └── Ronda 2 se activa tras ronda 1 con nota
     ├── Observación global textarea
     └── [Finalizar sesión]
          → PUT estado = completada
```

Auto-save cada cambio con debounce de 500ms. Indicador `● guardando...` / `✓ guardado` visible.

### 7.6 Profe — post-sesión (análisis IA)

```
Reserva completada → [Procesar evaluación]
  → panel análisis (por ronda)
     ├── Contexto (competencia + pregunta + escenario)
     ├── Textarea transcripción (paste manual)
     ├── [📋 Copiar prompt para IA]  → clipboard: template lleno con contexto + rúbrica + transcripción
     ├── Textarea observación final (paste respuesta IA editada por profe)
     └── Input nota final (ajusta desde live)
  ├── [Guardar] → PUT estado = evaluada
  └── [Guardar y publicar] → PUT estado = publicada
```

### 7.7 Profe — publicación

```
Reserva evaluada → [📢 Publicar]     → estado = publicada
Reserva publicada → [🔒 Despublicar] → estado = evaluada

Bulk: [📢 Publicar todas evaluadas] en header agenda → confirm → batch
```

### 7.8 Profe — reportes

```
[Reportes]
├── Export individual: selecciona estudiante → .txt
├── Export global: .txt tabla resumen
└── Nombre archivo: {codigo}_Evaluaciones_{configId}_{YYYYMMDD}.txt
```

---

## 8. Componentes críticos

### 8.1 Ruleta 2-niveles (`App.Roulette`)

- Canvas API, sin librerías. Adapta animación de `selector-de-proyectos`.
- **Nivel 1 — competencias:** sectores = competencias no giradas para este estudiante en esta sesión. Ya giradas visibles en gris fuera del giro.
- **Nivel 2 — preguntas:** pool de preguntas de la competencia ganadora. Sin dedupe cross-student.
- Puntero fijo superior.
- Si queda 1 elemento, gira igual (determinístico).
- Reset por estudiante al abrir nueva sesión.

### 8.2 Slot grid estudiante

- Grid N celdas por ventana. Celda = 5 min.
- Colores: libre (verde) / tomado-otro (gris) / tomado-yo (azul highlight).
- Click libre → confirm → reserva.
- Re-fetch KV antes de mostrar grid fresh cada render.

### 8.3 Prompt generator (`App.Prompt`)

- Template en `CONFIGURACIONES[].promptTemplate` con placeholders `{{competencia}}`, `{{pregunta}}`, `{{escenario}}`, `{{rubrica}}`, `{{transcripcion}}`.
- `App.Prompt.build(ronda) → string` llena y devuelve.
- Botón `[📋 Copiar]` → `navigator.clipboard.writeText(...)`.
- Preview colapsable del prompt final.

### 8.4 Agenda profe

- Tabla cronológica con una fila por slot tomado.
- Columnas: fecha/hora, estudiante, tipo, estado, acciones.
- Filtros chip: estado, tipo, ventana.
- Sort default ascendente por fecha+hora.

### 8.5 Panel evaluación live

- Full-screen, letra grande. Profe lee en otra ventana/pantalla sin que estudiante vea.
- Rondas verticales; siguiente ronda bloqueada hasta que actual tenga nota.
- Countdown 5 min informativo (no bloqueante).
- Auto-save debounce 500ms.

### 8.6 Reporte export

- `.txt` plano coherente con selector.
- **Individual:** cabecera + datos estudiante + rondas (competencia, pregunta, nota, obs) + checks + total.
- **Global:** tabla resumen (matrícula, nombre, tipo, estado, total).

---

## 9. Persistencia y disciplina de estado

Regla aprendida del incidente en `selector-de-proyectos` (commit `46364f1`): **nada de estado importante queda solo en el browser**.

1. **KV = única fuente de verdad.** Ninguna acción de usuario se queda solo en memoria o `localStorage`.
2. **`localStorage` solo para sesión efímera** (matrícula actual, rol). Se borra al cerrar pestaña.
3. **Escritura inmediata** post-acción:
   - Reservar slot → PUT → ok → renderizar. Fail → revertir UI + error.
   - Puntos live durante ronda → PUT con debounce 500ms.
   - Publicar/despublicar → PUT inmediato.
   - Observación/transcripción → PUT al `blur` del textarea.
4. **Recarga siempre relee KV.** Cero datos heredados contradictorios.
5. **Conflict resolution 409** → toast "otro usuario modificó, recargo" → refetch + reintento.
6. **Indicador visual de guardado.** Cada edit muestra `● guardando...` / `✓ guardado` / `⚠ error, reintentando`.

---

## 10. Error handling y edge cases

| Caso | Comportamiento |
|---|---|
| Dos estudiantes reservan mismo slot simultáneo | Locking 409 → segundo ve error + grid actualiza |
| Profe abre 2 tabs | Cada write refetch antes; second tab ve warnings en conflict |
| Estudiante cancela reserva | No permitido en MVP. Profe elimina manualmente si necesario |
| Profe cierra browser mid-sesión | Estado queda `en-sesion`. Botón [Reanudar] al reabrir |
| Cap tipo actividad excedido | UI oculta tipos reservados. Si race → 409 → toast |
| Matrícula no en lista | Error "no encontrada en esta asignatura" |
| Ventana ya pasó | Slots como "caducado" gris, no reservables |
| Todas competencias giradas | Ruleta nivel 1 mensaje "no quedan", bloquea giro. Protección si `rondasPorEstudiante > competencias.length` |
| KV sin respuesta / network error | Retry × 3 con backoff exponencial. Fail → toast rojo + [Reintentar] |
| Contraseña profe incorrecta | Error inline, no progresa |
| Nota live fuera de 0–7.5 | Clamp automático + validación visual |

---

## 11. Testing y deploy

- **Testing:** manual mediante checklist en `CLAUDE.md` de la herramienta. No automatizado por convención del monorepo (sin build).
- **Dev local:** `wrangler pages dev .` para probar KV antes de deploy.
- **Deploy:** Cloudflare Pages conectado a repo. Subfolder `agenda-evaluaciones/` como publish root.
- **KV namespace nuevo:** `AGENDA_EVAL_STATE`. Crear namespace antes de primer deploy y actualizar `wrangler.toml`.

---

## 12. Coherencia con monorepo

- Sigue paleta visual raíz (`--navy`, `--blue`, `--mint`, `--amber`, `--coral`).
- Incluye atributos comunes: `PROFESOR_MATRICULA`, `ASIGNATURA_CODIGO`, `ASIGNATURA_NOMBRE`, `PERIODO`, exportación.
- Prefijo KV propio (`AGENDA_EVAL_STATE`) evita colisión con `SELECTOR_STATE`.
- CLAUDE.md de la herramienta referencia el CLAUDE.md raíz.

---

## 13. Primer caso cargado (SIST-3311)

Al crear la app, la primera entrada de `CONFIGURACIONES` se precarga con:

- 25 estudiantes del PDF `Listado estudiantes.pdf`.
- 10 competencias extraídas del docx `Evaluacion_Recuperacion_Estudiante_SIST-3311.docx`.
- Ventana inicial: `domingo 2026-04-19, 09:00–12:00`, slot 5 min.
- Tipos actividad: `Evaluación de recuperación` + `Consulta general`.
- Rúbrica: 2 rondas × 7.5 puntos + 3 checks globales.
- Prompt template específico según la dinámica descrita en el docx.

---

## 14. Fases futuras (no en alcance MVP)

- Cancelación de reservas por el estudiante.
- Panel de mantenimiento de configuraciones desde UI.
- Generación de PDF de reportes.
- Integración directa con IA (sin copypaste).
- Notificaciones (email/push).
- Soporte multi-profesor.
