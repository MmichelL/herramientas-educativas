# CLAUDE.md — Test de Tipología Emprendedora (TECN-1411)

> Ver `CLAUDE.md` raíz del monorepo para atributos institucionales comunes.

## Qué problema resuelve

Test interactivo de autodiagnóstico para la asignatura **Emprendurismo (Vida Práctica) — TECN-1411** (UNAD). El estudiante responde 10 preguntas y obtiene su tipología emprendedora dominante, perfil secundario y motor (necesidad vs. oportunidad). El resultado se usa como insumo del **Perfil Emprendedor** (entrega del martes 16 de junio de 2026).

## Quién la usa

- **Estudiantes**: hacen el test desde su celular o laptop, toman captura del resultado.
- **Profesor**: comparte el enlace en clase; no requiere configuración previa.

## Tipologías evaluadas

Comercial, Social, Estilo de vida, Intraemprendedor, Serial, Digital. Puntaje por opción seleccionada (`pts` en `PREGUNTAS`); además se cuenta el motor (`necesidad` / `oportunidad`).

## Características técnicas

- 100% frontend, un solo `index.html` autocontenido (sin backend, sin KV, sin build).
- No persiste datos: el resultado vive en la pantalla; el estudiante toma captura.
- Paleta propia (verde/dorado) acorde a la identidad de la asignatura.

## Despliegue

Cloudflare Pages, proyecto `tecn1411-test-tipologia` por **direct upload** (igual que el resto del monorepo: ningún proyecto está git-connected; el push a GitHub es solo respaldo de código).

- URL producción: https://tecn1411-test-tipologia.pages.dev
- Para publicar cambios (desde una carpeta que contenga SOLO `index.html`, para no subir CLAUDE.md/wrangler.toml):

```bash
npx wrangler pages deploy . --project-name=tecn1411-test-tipologia --branch=main
```

Requiere `wrangler login` o `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
