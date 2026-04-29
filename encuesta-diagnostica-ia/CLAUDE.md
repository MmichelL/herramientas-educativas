# CLAUDE.md — Encuesta Diagnóstica IA (UNAD)

> Contexto para Claude Code. Leer completo antes de tocar cualquier archivo.

---

## Qué hace esta herramienta

App de encuesta diagnóstica en tiempo real para la capacitación docente UNAD *"Inteligencia Artificial en la Educación Superior — Estado del arte abril 2026"* (dos sesiones de 90 min, basadas en `Guia_Facilitador_UNAD_v4`).

Provee:
- Form anónimo de **apertura** (18 ítems, ~5 min) en URL `/#apertura`.
- Form anónimo de **cierre** (7 ítems, ~90 s) en URL `/#cierre`.
- **Dashboard** público read-only en `/#dashboard?fase=apertura|cierre|comparativo` con polling cada 3 s.
- **Modo evidencia** que superpone benchmarks académicos sobre las respuestas del grupo.
- **Modo comparativo** apertura↔cierre con barras pareadas (a nivel grupo, no individual).
- **Panel admin** en `/#admin` (matrícula `2008464`) con: cambiar fase, sembrar 80 respuestas demo, wipe, export JSON/CSV.

---

## Arquitectura

| Archivo | Rol |
|---|---|
| `index.html` | SPA monolítica con hash routing. Inline CSS + JS. Chart.js por CDN. |
| `functions/api/phase.js` | GET/PUT fase activa (`apertura` \| `cierre` \| `cerrada`). |
| `functions/api/responses.js` | POST nueva respuesta (sin auth) · GET admin listado. |
| `functions/api/aggregate.js` | GET agregaciones con filtros (n, byQuestion, lastTs). Cache 2 s. |
| `functions/api/seed.js` | POST sembrar N respuestas demo (admin). |
| `functions/api/wipe.js` | DELETE wipe (admin). |
| `wrangler.toml` | Config Pages + binding KV `ENCUESTA_IA_STATE`. |

**Modelo KV:**

| Key | Valor | Notas |
|---|---|---|
| `phase` | `"apertura"` \| `"cierre"` \| `"cerrada"` | Fase activa global. |
| `resp:apertura:{respId}` | JSON respuesta | Append-only. UUID v4 prevents collisions. |
| `resp:cierre:{respId}` | JSON respuesta | Append-only. |

**Sin locking optimista.** Cada respuesta tiene UUID único; no hay editar/sobrescribir desde múltiples clientes.

**Auth admin:** header `X-Admin-Token` con valor `2008464` (PROFESOR_MATRICULA). Seguridad por oscuridad — aceptable porque el dato es anónimo.

---

## Cómo correr en local

```bash
cd encuesta-diagnostica-ia
wrangler pages dev . --port 8788
# abrir http://localhost:8788/
```

KV efímero local. Datos se pierden al cerrar wrangler (útil para reset rápido durante desarrollo).

---

## Deploy Cloudflare Pages

1. Crear KV namespace:
   ```bash
   wrangler kv namespace create ENCUESTA_IA_STATE
   ```
   Copiar el `id` en `wrangler.toml`.

2. Cloudflare Pages → Add Production Branch `main` → publish directory `encuesta-diagnostica-ia`. Build command vacío.

3. Settings → Functions → KV namespace bindings: asociar `ENCUESTA_IA_STATE` al namespace creado.

4. Push a `main` → redeploy automático.

URL resultante: `encuesta-diagnostica-ia.pages.dev`.

---

## Generar QR

Dos QR distintos:
- Apertura → `https://encuesta-diagnostica-ia.pages.dev/#apertura`
- Cierre → `https://encuesta-diagnostica-ia.pages.dev/#cierre`

Generadores recomendados: `https://qrcode-monkey.com` o `https://api.qrserver.com/v1/create-qr-code/?data=URL`. Imprimir + tener en slide. Probar con celular real antes de la sesión.

---

## Antes de cada taller real

- [ ] `curl -X DELETE 'https://.../api/wipe?scope=all' -H 'X-Admin-Token: 2008464'` o usar el botón en `/#admin`.
- [ ] Verificar fase = `apertura` desde admin.
- [ ] QR escaneado desde un celular físico → llega al form.
- [ ] Submit de prueba → llega al dashboard en <5 s.
- [ ] Wipe la prueba.

---

## Personalización

- Editar `BENCHMARKS` en `index.html` para actualizar referencias académicas.
- Pregunta de coordinación eliminada (no se obtuvo listado oficial). Segmentación demográfica = facultad + tiempo de docencia + sexo.
- Si quieres cambiar la matrícula del admin: editar `PROFESOR_MATRICULA` en `index.html` y `ADMIN_TOKEN` en cada `functions/api/*.js`.

---

## Referencias

- Spec diseño: `../docs/superpowers/specs/2026-04-29-encuesta-diagnostica-ia-design.md`.
- Plan implementación: `../docs/superpowers/plans/2026-04-29-encuesta-diagnostica-ia.md`.
- Guía pedagógica: `Guia_Facilitador_UNAD_v4.docx` (Bloques 1.1, 1.2, 2.5).
- Patrón realtime: `../agenda-evaluaciones/functions/api/state.js`.
- Contexto monorepo: `../herramientas-educativas-CLAUDE.md`.

---

*Status: en desarrollo · Prof. Misael Michel · UNAD ENE-ABR 2026*
