# Entrega Trabajo Final — SIST-3311

**Fecha:** 2026-04-20  
**Clase:** SIST-3311 Análisis de Sistemas — ENE-ABR 2026  
**Deadline:** 2026-04-20T22:00:00-04:00 (10 PM hora RD)  
**Herramienta hermana:** `agenda-evaluaciones/`

---

## 1. Propósito

Herramienta de entrega del Proyecto Final para SIST-3311, creada como respaldo ante fallo de la plataforma institucional. Permite a cada estudiante subir:
1. **Documento** del trabajo final (Word o PDF, máx ~20 MB)
2. **URL del video de defensa** (YouTube, Google Drive, Vimeo, o cualquier plataforma reproducible)

El profesor visualiza todas las entregas en tiempo real y puede descargar cada archivo directamente.

---

## 2. Arquitectura

```
entrega-trabajo-final/
├── index.html                   # App completa — sin build step
├── functions/
│   └── api/
│       └── submissions.js       # Cloudflare Pages Function: GET + POST
└── wrangler.toml                # CF Pages + KV binding
```

**Stack:** HTML/CSS/JS vanilla + Cloudflare Pages Functions + Cloudflare KV  
**Sin dependencias externas.** Misma convención que `agenda-evaluaciones`.

---

## 3. Almacenamiento KV

**Namespace:** `FINAL_SUBMISSIONS`  
**Config ID:** `sist3311-pf-ene-abr-2026`

| Clave KV | Valor |
|---|---|
| `submission_sist3311-pf-ene-abr-2026_{matricula}` | Objeto de entrega (ver §3.1) |
| `index_sist3311-pf-ene-abr-2026` | Array de resumen (ver §3.2) |

### 3.1 Objeto de entrega (por estudiante)

```json
{
  "matricula": "2024-0007",
  "nombre": "CINDY PAOLA ALCANTARA GARCIA",
  "fileName": "ProyectoFinal_CindyAlcantara.pdf",
  "fileSize": 4821032,
  "fileType": "application/pdf",
  "fileData": "<base64>",
  "videoUrl": "https://youtu.be/...",
  "submittedAt": "2026-04-20T21:43:11-04:00",
  "version": 2
}
```

`fileData` se transmite como base64; almacenamiento KV acepta hasta 25 MB. Base64 de un archivo de 15 MB ≈ 20 MB — dentro del límite.

### 3.2 Índice rápido

```json
[
  { "matricula": "2024-0007", "nombre": "CINDY PAOLA ALCANTARA GARCIA", "fileName": "ProyectoFinal.pdf", "fileSize": 4821032, "submittedAt": "2026-04-20T21:43:11-04:00" },
  ...
]
```

El índice no contiene `fileData`; sirve para que el profesor liste entregas sin descargar archivos.

---

## 4. API — `functions/api/submissions.js`

### GET `/api/submissions?configId=&action=list`
- Retorna el índice de entregas (sin fileData).
- Sin restricción de deadline ni autenticación (solo lectura).

### GET `/api/submissions?configId=&matricula=`
- Retorna la entrega completa de un estudiante (incluye fileData).
- Usado por el profesor para descargar.

### POST `/api/submissions`
```json
{ "configId": "...", "matricula": "...", "nombre": "...", "fileName": "...", "fileSize": 0, "fileType": "...", "fileData": "...", "videoUrl": "..." }
```
- **Valida deadline en servidor:** si `Date.now() > 2026-04-20T22:00:00-04:00` → `403 Deadline passed`.
- Sobrescribe entrega previa si existe (reenvío permitido antes del cierre).
- Actualiza índice atómicamente.
- Retorna `{ ok: true, submittedAt }`.

---

## 5. Lista de estudiantes

| Matrícula | Nombre |
|---|---|
| 2016-0810 | GIOVANNY BAUTISTA CASTILLO |
| 2022-0603 | DARLIN ARROYO POLANCO |
| 2022-0678 | ULISES JABRIEL REYES CUEVAS |
| 2023-0178 | ROMER ENMANUEL ARNO PEREZ |
| 2023-0221 | DANIEL VALDEZ CUELLO |
| 2023-0239 | LEURI GALVA DE LA ROSA |
| 2023-0324 | ANTHONY PICHARDO CASILLA |
| 2024-0007 | CINDY PAOLA ALCANTARA GARCIA |
| 2024-0023 | JHAEL ADAMES PEREZ |
| 2024-0026 | YASMEYRI MARILIN CASTILLO RIVERA |
| 2024-0039 | JOSE ELIEZER LOPEZ FELIZ |
| 2024-0060 | HAROLD SMITH BAUTISTA CAPELLAN |
| 2024-0103 | JUSTIN PAULINO ALBERTO |
| 2024-0280 | ENMANUEL GUZMAN OSORIA |
| 2024-0282 | JOSTIN RODRIGUEZ MARTINEZ |
| 2024-0283 | ISAIAS HERRERA TORIBIO |
| 2024-0284 | ADAM FRANCISCO GARCIA HERRERA |
| 2024-0286 | JOHAN ALEXANDER ROJAS TAVAREZ |
| 2024-0305 | ELIANNI CAROLINA SANTANA BAUTISTA |
| 2024-0306 | JAASIEL LORENZO TEJADA |
| 2024-0321 | KAROL ELIZABETH MORA QUEZADA |
| 2024-0325 | NAYROBIS VALDEZ GARCIA |
| 2024-0333 | JAEL ENCARNACION MATEO |
| 2024-0357 | ARLETTE PEREZ HICIANO |
| 2024-0379 | CAMILO ALBERT LEON PERALTA |

---

## 6. Flujo UI

### Pantalla 1 — Landing
- Header: `SIST-3311 · Análisis de Sistemas · ENE-ABR 2026`
- Título: `Entrega del Proyecto Final`
- Countdown `HH:MM:SS` en grande, color verde → ámbar (< 1h) → rojo (< 15 min)
- Banner **ENTREGA CERRADA** si deadline pasó

### Pantalla 2 — Auth
- Campo: `Número de matrícula`
- Valida contra la lista de 25 estudiantes
- Si coincide → muestra nombre → botón **Continuar**
- Matrícula `2008464` → modo Profesor (sin campo de nombre, sin validación de deadline)
- Error si matrícula no encontrada

### Pantalla 3 — Formulario de entrega (estudiante)
- Nombre del estudiante (solo lectura, tarjeta destacada)
- **Zona de carga de archivo** (drag-and-drop + click)
  - Formatos: `.pdf`, `.doc`, `.docx`
  - Límite visual: 20 MB
  - Muestra nombre del archivo y tamaño al seleccionar
- **Campo URL** — *Enlace al video de defensa* (YouTube, Drive, Vimeo, etc.)
- **Caja de observación** (fondo ámbar, ícono ⚠):
  > "Todos los materiales utilizados —diagramas, presentaciones, capturas de pantalla, encuestas y cualquier otro anexo— deben estar incluidos dentro del documento principal. No se aceptarán archivos separados."
- Botón **Enviar Entrega** (azul)
  - Si ya entregó: botón cambia a **Actualizar Entrega**, muestra timestamp de entrega anterior
  - Deshabilitado si deadline pasó

### Pantalla 4 — Confirmación (estudiante)
- Mensaje de éxito con timestamp
- Resumen: nombre del archivo, URL del video
- Botón **Corregir entrega** (vuelve al formulario con datos prellenados) — visible solo si deadline no pasó

### Pantalla 5 — Vista Profesor (matrícula `2008464`)
- Estadística en la parte superior: `X / 25 entregas recibidas`
- Tabla:
  | # | Nombre | Matrícula | Documento | Video | Fecha entrega |
  |---|--------|-----------|-----------|-------|---------------|
  | con botón de descarga | con botón de abrir URL |
- Botón **Exportar resumen** → descarga `.txt` con tabla de entregas
- Sin restricción de deadline para el profesor

---

## 7. Countdown y cierre

```javascript
const DEADLINE = new Date('2026-04-20T22:00:00-04:00');
```

- Actualiza cada segundo
- Formato: `HH:MM:SS` restantes
- Al llegar a `00:00:00`:
  - Banner rojo en el header: `ENTREGA CERRADA — 20 abr 2026, 10:00 PM`
  - Formulario oculto / botón de envío removido
  - Mensaje: "El plazo de entrega ha cerrado. Contacta al profesor si necesitas asistencia."
- El servidor también valida: `POST /api/submissions` devuelve 403 si `Date.now() > DEADLINE`

---

## 8. Paleta visual

Consistente con el monorepo:
- Navy `#1A2456` — headers, fondo principal
- Blue `#2D5BE3` — botones primarios, estados activos
- Mint `#00D4A0` — indicadores de éxito
- Amber `#F59E0B` — observación / advertencias / countdown < 1h
- Coral `#FF5C6A` — deadline cerrado / errores / countdown < 15 min

---

## 9. Deploy

1. Crear namespace KV:
   ```bash
   wrangler kv namespace create FINAL_SUBMISSIONS
   ```
2. Pegar el `id` en `wrangler.toml`.
3. Conectar directorio `entrega-trabajo-final` en Cloudflare Pages como nuevo proyecto.
4. En Settings → Functions → KV namespace bindings: asociar `FINAL_SUBMISSIONS`.
5. Push → redeploy automático.

URL resultante (ejemplo): `entrega-trabajo-final.pages.dev`
