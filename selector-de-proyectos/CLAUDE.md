# CLAUDE.md — Selector de Proyectos

> Contexto para Claude Code. Leer completo antes de tocar cualquier archivo.

---

## Nota de origen importante

Esta herramienta fue concebida originalmente como una app específica para el curso **PROG-2111 Fundamentos de Programación** de la Universidad Adventista Dominicana, pensada para asignar aleatoriamente uno de 25 proyectos finales a cada estudiante mediante una ruleta animada.

Durante el desarrollo se identificó que el problema que resuelve — asignar ítems al azar a una lista de participantes controlada — es completamente genérico y reutilizable en cualquier asignatura o contexto educativo.

**Por eso se rediseñó desde cero como una herramienta genérica.** El primer caso de uso (PROG-2111, enero–abril 2026) está incluido como configuración precargada y sirve de referencia para agregar futuros casos. La lógica, la animación y el flujo son idénticos para cualquier configuración.

---

## ¿Qué hace esta herramienta?

Permite al profesor asignar aleatoriamente un ítem (proyecto, tema, caso, rol, ejercicio) a cada participante de una lista controlada, usando una ruleta animada visible para todos durante la clase virtual.

**Entradas requeridas por configuración:**
1. Lista de participantes — matrícula y nombre
2. Lista de ítems a asignar — nombre obligatorio, descripción opcional

**Con eso es suficiente.** La herramienta maneja el resto: validación, animación, historial, exportación y persistencia.

---

## Arquitectura de configuraciones

El corazón de la herramienta es el array `CONFIGURACIONES` en `index.html`. Cada elemento representa un contexto de uso independiente (una asignatura + período). El profesor selecciona la configuración activa desde un selector visible en la pantalla al abrir la app.

```javascript
// ══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN — Editar aquí para agregar o modificar contextos
// Cada entrada es una asignatura + período independiente.
// ══════════════════════════════════════════════════════════════════
const CONFIGURACIONES = [

  {
    // ── Identificador único de esta configuración ──
    id: "prog2111-ene-abr-2026",

    // ── Lo que aparece en el selector de la pantalla de inicio ──
    etiqueta: "Fundamentos de Programación — ENE-ABR 2026",

    // ── Datos de la asignatura (aparecen en encabezado y exportación) ──
    asignatura: {
      codigo:  "PROG-2111",
      nombre:  "Fundamentos de Programación",
      periodo: "Enero – Abril 2026",
    },

    // ── Participantes autorizados ──
    // Solo estas matrículas pueden girar la ruleta.
    // Formato: { matricula: "...", nombre: "..." }
    participantes: [
      // Agregar aquí los estudiantes reales cuando estén disponibles
      // { matricula: "2023-0001", nombre: "Ana García" },
    ],

    // ── Ítems a asignar ──
    // nombre es obligatorio. descripcion es opcional.
    // Formato: { nombre: "...", descripcion: "..." }
    items: [
      { nombre: "Sistema de Notas — Escuela Primaria",              descripcion: "Registrar calificaciones por grado y asignatura." },
      { nombre: "Inventario — Farmacia Comunitaria",                descripcion: "Controlar medicamentos, precios y disponibilidad." },
      { nombre: "Agenda de Citas — Salón de Belleza",              descripcion: "Gestionar citas por estilista y calcular ingresos." },
      { nombre: "Evaluaciones — Academia de Inglés",               descripcion: "Registrar notas por módulo y emitir certificados." },
      { nombre: "Control de Gastos — Hogar Familiar",              descripcion: "Categorizar gastos y controlar pagos pendientes." },
      { nombre: "Inventario — Ferretería y Materiales",            descripcion: "Gestionar productos por categoría y disponibilidad." },
      { nombre: "Registro de Voluntarios — ONG",                   descripcion: "Administrar voluntarios por habilidad y zona." },
      { nombre: "Control de Reservas — Hotel Pequeño",             descripcion: "Gestionar habitaciones y calcular ingresos." },
      { nombre: "Registro de Ingresos — Trabajador Independiente", descripcion: "Controlar proyectos y cobros por tipo de trabajo." },
      { nombre: "Agenda de Citas — Veterinaria",                   descripcion: "Registrar citas por especie y tipo de servicio." },
      { nombre: "Catálogo — Tienda de Ropa",                       descripcion: "Gestionar prendas por talla y temporada." },
      { nombre: "Directorio de Proveedores — Empresa",             descripcion: "Evaluar proveedores activos por categoría." },
      { nombre: "Catálogo Personal — Películas y Series",          descripcion: "Organizar contenido por plataforma y género." },
      { nombre: "Sistema de Turnos — Centro Médico",               descripcion: "Gestionar turnos urgentes por especialidad." },
      { nombre: "Plataforma de Cursos en Línea",                   descripcion: "Registrar cursos por área e instructor." },
      { nombre: "Control de Ventas — Tienda en Línea",             descripcion: "Gestionar pedidos y métodos de pago." },
      { nombre: "Registro de Socios — Gimnasio",                   descripcion: "Controlar membresías activas y calcular nómina." },
      { nombre: "Biblioteca Personal de Libros",                   descripcion: "Organizar libros por estado de lectura." },
      { nombre: "Catálogo — Librería y Papelería",                 descripcion: "Gestionar artículos por categoría y editorial." },
      { nombre: "Registro de Pacientes — Consultorio Dental",      descripcion: "Controlar tratamientos y calcular ingresos." },
      { nombre: "Registro de Donaciones — Fundación",              descripcion: "Gestionar donaciones por campaña y tipo." },
      { nombre: "Catálogo de Videojuegos",                         descripcion: "Organizar juegos por plataforma y calificación." },
      { nombre: "Sistema de Pedidos — Restaurante",                descripcion: "Gestionar pedidos por método de entrega." },
      { nombre: "Registro de Empleados — Pequeña Empresa",         descripcion: "Controlar nómina por departamento." },
      { nombre: "Catálogo de Recetas de Cocina",                   descripcion: "Organizar recetas por tipo de cocina y dificultad." },
    ],
  },

  // ── Plantilla para agregar una nueva configuración ──────────────
  // Copiar este bloque, cambiar los valores y descomentar.
  //
  // {
  //   id: "codigo-asignatura-mes-anio",
  //   etiqueta: "Nombre Asignatura — Período",
  //   asignatura: {
  //     codigo:  "XXX-0000",
  //     nombre:  "Nombre Completo de la Asignatura",
  //     periodo: "Mes – Mes Año",
  //   },
  //   participantes: [
  //     { matricula: "XXXX-XXXX", nombre: "Nombre Completo" },
  //   ],
  //   items: [
  //     { nombre: "Nombre del ítem", descripcion: "Descripción opcional" },
  //   ],
  // },

];

// ── Matrícula del profesor ───────────────────────────────────────
// Compartida entre todas las configuraciones.
// Permite girar en modo prueba sin guardar resultados.
const PROFESOR_MATRICULA = "2008464";

// ── Participaciones por persona (normalmente 1) ──────────────────
// Parametrizable desde aquí, no desde la UI.
const MAX_PARTICIPACIONES = 1;
```

---

## Pantalla de inicio — selector de configuración

Al abrir la app, antes de cualquier otra acción, el profesor ve:

- Un **dropdown** con las etiquetas de todas las configuraciones disponibles
- El nombre de la asignatura y el período del ítem seleccionado
- Un botón **"Iniciar sesión de sorteo"**

Una vez seleccionada la configuración, todo el flujo (participantes, ítems, historial, localStorage) opera con los datos de esa configuración exclusivamente.

El prefijo de localStorage se genera automáticamente desde el `id` de la configuración, por ejemplo: `selector_prog2111-ene-abr-2026_state`. Esto evita colisiones entre distintas configuraciones aunque se usen en el mismo navegador.

---

## Flujo completo de la herramienta

```
Abrir app
    │
    ▼
Seleccionar configuración (asignatura + período)
    │
    ▼
Pantalla principal
    ├── Ruleta (canvas, solo con ítems disponibles)
    ├── Panel de estado (asignadas / total / progreso)
    └── Historial en tiempo real
    │
    ▼
Ingresar matrícula
    ├── No existe en lista        → mensaje de error, no avanza
    ├── Ya tiene asignación       → muestra su ítem asignado, no puede girar
    ├── Es PROFESOR_MATRICULA     → activa modo prueba (no guarda)
    └── Válida y disponible       → habilita el botón de girar
    │
    ▼
Girar ruleta
    ├── Animación con inercia (canvas, sectores activos visibles)
    └── Frena y apunta al ítem ganador
    │
    ▼
Overlay de resultado (pantalla completa con confeti)
    ├── Modo prueba  → no guarda, vuelve al estado anterior
    └── Real         → guarda en localStorage, actualiza historial y grilla
    │
    ▼
Descargar lista (botón disponible desde la primera asignación)
```

---

## Requisitos técnicos del `index.html`

### Ruleta (canvas)
- Construida con **Canvas API** — sin librerías externas
- Sectores distribuidos equitativamente entre los ítems disponibles
- Sectores ya asignados visibles en gris/opaco fuera de la rueda activa, o excluidos del giro
- Animación de inercia: aceleración inicial → velocidad constante → desaceleración con rebote suave al frenar
- Puntero/flecha fija en la parte superior que indica el sector ganador
- Si solo queda un ítem disponible, la rueda gira igual pero el resultado es determinístico

### Validación de matrícula
- Campo de texto con foco automático al cargar
- Validación en tiempo real al escribir (Enter o botón)
- Mensajes de estado claros: encontrado, no encontrado, ya asignado, modo prueba

### Panel de estado
- Contador visible: `X asignadas / Y total`
- Barra de progreso
- Tabla de asignaciones en tiempo real (matrícula → nombre → ítem)
- Todo visible durante la clase compartida en pantalla

### Exportación
- Botón "⬇ Descargar lista oficial" — disponible desde la primera asignación
- Archivo `.txt` con tabla formateada
- Nombre del archivo: `[codigo-asignatura]_Asignaciones_[YYYY-MM-DD].txt`
- Incluye: nombre de la asignatura, período, fecha de generación, tabla completa, totales

### Persistencia
- `localStorage` con prefijo generado desde el `id` de la configuración activa
- Restauración automática al recargar
- Botón "Reiniciar sorteo" con doble confirmación — limpia solo el estado de la configuración activa

---

## Restricciones de Cloudflare Pages

- Sin backend, sin fetch a dominios externos, sin npm, sin build
- Un solo archivo `index.html` autocontenido
- Todo CSS y JS inline dentro del HTML
- Compatible con Chrome, Firefox y Safari modernos
- Tamaño máximo recomendado: 500KB
- El `index.html` debe abrir correctamente desde el sistema de archivos local (sin servidor) antes de hacer deploy

---

## Despliegue

### Repositorio GitHub
```bash
git init
git add index.html CLAUDE.md
git commit -m "feat: selector de proyectos genérico"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/selector-de-proyectos.git
git push -u origin main
```

### Cloudflare Pages
1. https://pages.cloudflare.com → **Create a project** → **Connect to Git**
2. Seleccionar el repositorio
3. Build settings:
   - Framework preset: **None**
   - Build command: *(vacío)*
   - Build output directory: `/`
4. **Save and Deploy**
5. URL resultante: `selector-de-proyectos.pages.dev`

### Actualizar participantes o ítems
```bash
# Editar CONFIGURACIONES en index.html
git add index.html
git commit -m "config: actualizar participantes PROG-2111 ENE-ABR 2026"
git push
# Redespliega en < 60 segundos
```

---

## Notas finales para Claude Code

- El array `CONFIGURACIONES` es la única fuente de verdad — no hay base de datos, no hay archivos externos
- Los comentarios dentro del array deben ser suficientemente claros para que el profesor edite los datos sin ayuda técnica
- La herramienta debe funcionar aunque `participantes` esté vacío (el profesor puede hacer pruebas antes de tener la lista)
- Si el profesor proporciona el listado de estudiantes en este chat, incorporarlo directamente al array `participantes` de la configuración correspondiente
- El diseño visual sigue la paleta del monorepo raíz (`--navy: #1A2456`, `--blue: #2D5BE3`, etc.) definida en el `CLAUDE.md` de `herramientas-educativas/`
- El `index.html` actual (versión anterior específica para PROG-2111) existe como referencia de la animación base y el diseño visual — tomar como punto de partida, no como versión final
