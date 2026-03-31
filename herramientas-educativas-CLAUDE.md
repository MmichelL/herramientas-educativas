# CLAUDE.md — Herramientas Educativas

> Contexto raíz del monorepo. Claude Code debe leer este archivo antes de trabajar en cualquier herramienta dentro de esta carpeta.

---

## ¿Qué es este repositorio?

Este es un **monorepo de herramientas educativas digitales** desarrolladas para uso dentro del aula, en modalidad virtual y presencial. Cada herramienta es una aplicación independiente con su propia carpeta y su propio `CLAUDE.md`, pero todas comparten el mismo contexto institucional, los mismos principios de diseño y los mismos atributos base.

El objetivo no es construir una plataforma monolítica. Es construir **herramientas pequeñas, específicas y reutilizables** — cada una resuelve un problema concreto de la dinámica del aula — que puedan desplegarse de forma independiente y evolucionar sin afectarse entre sí.

---

## Contexto institucional compartido

Todos los proyectos de este repositorio pertenecen al mismo entorno institucional:

| Atributo | Valor |
|---|---|
| Institución | Universidad Adventista Dominicana (UNAD) |
| Facultad | Facultad de Ingeniería y Tecnología |
| Profesor | Misael Michel |
| Matrícula del profesor | `2008464` |
| Modalidad principal | Virtual (con soporte presencial) |
| Audiencia | Estudiantes universitarios de nivel introductorio |
| País | República Dominicana |
| Moneda | Pesos dominicanos (RD$) |

Estos atributos deben estar presentes en cualquier herramienta nueva que se cree dentro de este monorepo, adaptados al contexto específico de cada asignatura.

---

## Estructura del monorepo

```
herramientas-educativas/
│
├── CLAUDE.md                          ← contexto raíz (este archivo)
│
├── prog2111-sorteo/                   ← Herramienta 1
│   ├── CLAUDE.md                      ← contexto específico
│   └── index.html                     ← app autocontenida
│
└── [nombre-herramienta]/              ← futuras herramientas
    ├── CLAUDE.md
    └── index.html  (o archivos propios)
```

### Reglas de estructura

- Cada herramienta vive en su **propia carpeta** con nombre en `kebab-case`
- El nombre de la carpeta sigue el patrón `[codigo-asignatura]-[nombre-herramienta]`
  - Ejemplo: `prog2111-sorteo`, `mate1010-calculadora`, `ing101-rúbrica`
- Cada herramienta tiene su propio `CLAUDE.md` con el contexto específico
- Las herramientas estáticas son archivos HTML autocontenidos (sin build, sin npm)
- Si una herramienta crece en complejidad, puede tener su propio `package.json`

---

## Principios de diseño compartidos

Todas las herramientas deben seguir estos principios:

### 1. Simplicidad primero
La herramienta resuelve **un solo problema** claramente definido. No intenta ser una plataforma. Si el alcance crece demasiado, se crea una nueva herramienta separada.

### 2. Desplegable de forma independiente
Cada herramienta puede subirse a **Cloudflare Pages** (u otro hosting estático) de forma individual. No depende de las demás herramientas para funcionar.

### 3. Sin backend por defecto
A menos que sea estrictamente necesario, las herramientas son **100% frontend** (HTML + CSS + JS). El estado se persiste en `localStorage` con el prefijo del código de asignatura (ej. `prog2111_`).

### 4. Apta para pantalla compartida
Las herramientas están diseñadas para ser **proyectadas en una videollamada** o en un proyector de aula. Tipografía grande, alto contraste, información visible sin necesidad de hacer zoom.

### 5. Paleta visual consistente
Todas las herramientas usan la misma paleta base para mantener coherencia institucional:

```css
--navy:   #1A2456   /* fondo principal, encabezados */
--blue:   #2D5BE3   /* acción principal, botones */
--mint:   #00D4A0   /* confirmación, éxito */
--amber:  #F59E0B   /* advertencia, reto */
--coral:  #FF5C6A   /* error, alerta */
--gray:   #F3F4F8   /* fondo de secciones */
--white:  #FFFFFF
--black:  #1F2937
```

### 6. Parametrizable desde el código
Cualquier dato que pueda cambiar entre períodos (listas de estudiantes, nombres de asignaturas, cantidades) debe estar en un bloque de configuración claramente comentado al inicio del archivo, para que el profesor pueda editarlo sin tocar la lógica.

---

## Atributos comunes entre herramientas

Cuando Claude Code cree o modifique una herramienta, debe verificar que incluya:

| Atributo | Descripción |
|---|---|
| `PROFESOR_MATRICULA` | Matrícula del profesor para modo prueba (`2008464`) |
| `ASIGNATURA_CODIGO` | Código de la asignatura (ej. `PROG-2111`) |
| `ASIGNATURA_NOMBRE` | Nombre completo de la asignatura |
| `PERIODO` | Período académico actual (ej. `ENE-ABR 2026`) |
| Prefijo localStorage | `[codigo]_` para evitar colisiones entre herramientas |
| Modo prueba | El profesor puede probar sin afectar datos reales |
| Exportación | Toda herramienta que genere datos debe poder exportarlos |

---

## Herramientas existentes

| Carpeta | Asignatura | Herramienta | Estado |
|---|---|---|---|
| `prog2111-sorteo` | PROG-2111 | Ruleta de asignación de proyectos finales | ✅ En desarrollo |

---

## Cómo agregar una nueva herramienta

Cuando se desarrolle una nueva herramienta, seguir este proceso:

**1. Crear la carpeta**
```bash
mkdir [codigo-asignatura]-[nombre]
```

**2. Crear el CLAUDE.md específico**
El `CLAUDE.md` de la herramienta debe incluir:
- Qué problema resuelve en el aula
- Quién la usa (profesor, estudiantes, ambos)
- Cómo se usa durante la clase
- Qué datos configura el profesor antes de usarla
- Instrucciones de despliegue en Cloudflare Pages
- Referencia a este `CLAUDE.md` raíz para los atributos comunes

**3. Registrar la herramienta en este archivo**
Agregar una fila en la tabla de herramientas existentes.

**4. Despliegue independiente**
Cada herramienta se despliega en su propia URL de Cloudflare Pages. Se puede compartir el mismo repositorio de GitHub usando directorios de publicación distintos.

---

## Despliegue del repositorio completo en GitHub

```bash
# Desde la carpeta raíz herramientas-educativas/
git init
git add .
git commit -m "init: monorepo herramientas educativas"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/herramientas-educativas.git
git push -u origin main
```

Cada herramienta se conecta a Cloudflare Pages de forma independiente apuntando a su subcarpeta como directorio raíz de publicación.

---

## Visión a largo plazo

Este monorepo está pensado para crecer con el tiempo. Algunas herramientas posibles para futuras asignaturas:

- **Generador de quizzes** — banco de preguntas por tema, selección aleatoria
- **Temporizador de exposiciones** — con semáforo visual para controlar tiempos
- **Evaluador de rúbricas** — ingreso de criterios y cálculo automático de nota
- **Generador de grupos aleatorios** — formación de equipos con restricciones
- **Panel de participación** — registro de quién ha participado en clase
- **Banco de ejercicios** — ejercicios parametrizables por nivel de dificultad

Cada una seguirá los mismos principios y compartirá los mismos atributos base definidos en este archivo.

---

*Última actualización: marzo 2026 · Prof. Misael Michel · Universidad Adventista Dominicana*
