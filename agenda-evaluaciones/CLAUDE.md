# CLAUDE.md — Agenda de Evaluaciones

> Contexto para Claude Code. Leer completo antes de tocar cualquier archivo.

---

## Qué hace esta herramienta

Coordina la reserva de horarios de evaluación por estudiante y provee al profesor:
- Agenda cronológica de reservas con filtros.
- Ruleta 2-niveles (competencia → pregunta) con dedupe por estudiante.
- Panel de evaluación live con scoring y checks globales.
- Panel post-sesión con generador de prompt para IA externa (pegar transcripción → copiar → pegar en ChatGPT/Claude → pegar respuesta).
- Publicación individual o en bulk de resultados.
- Export `.txt` individual y global.

Reutilizable entre materias mediante el array `CONFIGURACIONES` en `index.html`. Cada entrada define una materia + período + ventanas + estudiantes + competencias + rúbrica + prompt template.

---

## Arquitectura

| Archivo | Rol |
|---|---|
| `index.html` | App monolítica con módulos namespaced (`App.Core`, `App.Auth`, `App.Student`, `App.Teacher`, `App.Roulette`, `App.Eval`, `App.Prompt`, `App.Reports`, `App.UI`). Sin build step. |
| `functions/api/state.js` | Cloudflare Pages Function. GET/PUT con locking optimista. |
| `wrangler.toml` | Config Pages + binding KV `AGENDA_EVAL_STATE`. |

El estado persistido es **único por `configId`** bajo la key `state_{configId}`. El cliente envía `{ version, reservas }` y el worker valida la versión antes de escribir (409 si mismatch).

---

## Principio crítico de persistencia

**KV es la única fuente de verdad.** `localStorage` se usa solo para sesión efímera (matrícula, rol). Toda acción significativa pasa por `App.Core.mutate()`, que hace PUT inmediato. El indicador visual arriba a la derecha muestra `● guardando` / `✓ guardado` / `⚠ error`.

Si ves el commit `fix: migrar estado de localStorage a Cloudflare KV`, es del `selector-de-proyectos`: ahí se aprendió la regla después de que algunos cambios se quedaran solo en el browser. No repetir ese bug.

---

## Cómo agregar una nueva materia

Editar `index.html`, al inicio en `CONFIGURACIONES`, agregar un bloque nuevo con:

- `id` único kebab-case
- `etiqueta`
- `asignatura` (código, nombre, período, tarea)
- `estudiantes` (matrícula + nombre)
- `tiposActividad` (id + etiqueta)
- `ventanas` (id, fecha YYYY-MM-DD, inicio/fin HH:MM, slotMinutos)
- `rubrica` (rondasPorEstudiante, puntosPorRonda, checksGlobales)
- `competencias` → cada una con `preguntas` (escenario + preguntaGuia)
- `promptTemplate` con placeholders `{{competencia}}`, `{{pregunta}}`, `{{escenario}}`, `{{rubrica}}`, `{{transcripcion}}`

Commit y push. Cloudflare Pages redespliega en ~60s. Cada `configId` tiene bucket KV independiente, no hay interferencia entre materias.

---

## Cómo correr en local

```bash
cd agenda-evaluaciones
wrangler pages dev . --port 8788
# abrir http://localhost:8788/
```

Wrangler crea un KV efímero local automáticamente. Al cerrar, los datos se pierden (útil para reset rápido).

---

## Deploy Cloudflare Pages

1. Crear namespace KV:
   ```bash
   wrangler kv namespace create AGENDA_EVAL_STATE
   ```
   Copiar el `id` en `wrangler.toml`.

2. Conectar repo en dashboard Pages → Add Production Branch `main` → publish directory `agenda-evaluaciones`. Build command vacío.

3. En Settings → Functions → KV namespace bindings: asociar `AGENDA_EVAL_STATE` al namespace creado.

4. Push a `main` → redeploy automático.

URL resultante (ejemplo): `agenda-evaluaciones.pages.dev`.

---

## Checklist manual de verificación

Correr antes de cada release:

**Login:**
- [ ] Dropdown materia muestra configuraciones disponibles.
- [ ] Dropdown nombre se llena al escoger materia.
- [ ] Login estudiante requiere matrícula coincidente con el nombre.
- [ ] Link "🔒 Soy profesor" pide contraseña; incorrecta → error; correcta → modo profe.
- [ ] Refrescar la app restaura sesión previa.

**Reserva estudiante:**
- [ ] Home muestra "Mis reservas" (vacía si ninguna).
- [ ] Reservar → tipo → ventana → grid 5-min.
- [ ] Slot libre (verde) al click → confirm → guarda → toast verde.
- [ ] Slot tomado por otro: gris, no clickeable.
- [ ] Mi slot: azul.
- [ ] Cap tipo actividad: cuando ya reservé un tipo, el botón de ese tipo desaparece.
- [ ] Dos tabs intentando misma acción → segunda ve 409, recarga sin crash.

**Resultado estudiante:**
- [ ] Reserva `publicada` tiene botón "Ver detalle".
- [ ] Detalle muestra rondas con nota + observación, checks, observación global, videos.
- [ ] Reserva en otros estados: botón no aparece.

**Agenda profe:**
- [ ] Stats arriba coinciden con conteos por estado.
- [ ] Chips filtran correctamente (estado / tipo / ventana).
- [ ] Acciones por estado son las correctas (ver tabla en spec sección 7.4).
- [ ] Publicar / despublicar actualiza estado e indicador de guardado.
- [ ] Bulk publicar procesa todas las `evaluada`.

**Evaluación live:**
- [ ] Click "Iniciar eval" cambia estado a `en-sesion` y abre panel.
- [ ] Countdown 5 min baja.
- [ ] Ronda 1: girar competencia → aparece ganador → girar pregunta → aparece escenario.
- [ ] Slider nota: auto-save con indicador.
- [ ] Ronda 2 bloqueada hasta nota ronda 1; destrabada muestra ruleta con 1 competencia menos.
- [ ] Refrescar la página mid-sesión restaura ronda y competencia ya elegidas.
- [ ] Checks globales persisten.
- [ ] Finalizar sesión → estado `completada`, puntosTotales suma live.

**Procesar (post-sesión):**
- [ ] Pegar transcripción en ronda → blur → guarda.
- [ ] Copiar prompt → clipboard contiene template lleno con transcripción.
- [ ] Observación final y nota final guardan con blur / change.
- [ ] Guardar → `evaluada`. Guardar y publicar → `publicada`.

**Reportes:**
- [ ] Export individual: `.txt` con rondas, notas, checks, total.
- [ ] Export global: tabla resumen con una fila por reserva.

**Persistencia:**
- [ ] Cerrar browser y reabrir: todos los datos persisten (locking respetado).
- [ ] Simular PUT stale (DevTools): worker devuelve 409, UI maneja con refetch.

---

## Troubleshooting

| Síntoma | Causa probable |
|---|---|
| Todos los PUT devuelven 409 | Dos tabs abiertas con versions desfasadas. Refrescar una. |
| La ruleta no gira | JavaScript bloqueado o canvas no en DOM. Revisar consola. |
| Cambios no persisten | Indicator de guardado en rojo — revisar Network tab, KV binding en Pages dashboard. |
| "Contraseña incorrecta" siempre | `PROFESOR_MATRICULA` en código no coincide. Revisar `index.html` constante. |

---

## Referencias

- Contexto del monorepo: `../herramientas-educativas-CLAUDE.md`.
- Spec diseño: `docs/superpowers/specs/2026-04-19-agenda-evaluaciones-design.md`.
- Plan implementación: `docs/superpowers/plans/2026-04-19-agenda-evaluaciones.md`.
- Tool hermana (patrón base): `../selector-de-proyectos/`.
