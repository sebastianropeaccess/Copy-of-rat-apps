# Brief para el Agente Arquitecto - App 2: Sistema de Permisos de Trabajo en Altura

## Objetivo:
Diseñar la arquitectura técnica y el esquema de base de datos para la nueva "App 2: Height Safety And Inspections App".

## Contexto de la Aplicación:
Esta aplicación tiene como propósito capturar información de inspección de seguridad en altura en el campo y generar un informe casi completo de inmediato, reduciendo los cuellos de botella en la oficina.

## Documentos de Referencia:
1.  **Product Requirements Document (PRD):** `/Users/bastian/Desktop/Claw:Claud Test/rat-apps/docs/PRD.md`
    *   **Sección Relevante:** "App 2: Height Safety And Inspections App" (Sección 4 del PRD).
2.  **Memoria del Código y Arquitectura Base:** `/Users/bastian/Desktop/Claw:Claud Test/rat-apps/app/CLAUDE.md`
3.  **Benchmark de Aplicación Simple:** `/Users/bastian/Desktop/Claw:Claud Test/rat-apps/claude/skills/rebuild-app/App Benchmark skill.md`
    *   Utiliza este documento como referencia para la filosofía de diseño (Mobile-First, offline-tolerant, PIN-based auth, Supabase backend) y las mejores prácticas de la plataforma.

## Tareas del Arquitecto:
1.  **Análisis de Requisitos:** Leer y comprender a fondo la sección "App 2: Height Safety And Inspections App" del `PRD.md`.
2.  **Diseño del Esquema de Base de Datos:**
    *   Basándose en los requisitos del PRD y la arquitectura existente (Supabase), proponer un esquema de base de datos detallado.
    *   Identificar las tablas necesarias (por ejemplo, `height_safety_inspections`, `inspection_items`, `sites_components`), sus columnas, tipos de datos, relaciones y claves primarias/foráneas.
    *   Considerar cómo integrar o relacionar esta nueva estructura con las tablas existentes si fuera apropiado (ej. `team_members`, `assets` si hay componentes con tags).
    *   Prever campos para `status` de ítems, `photos`, `defects`, `recommendations`, `corrective_actions`, `notes`, `inspection_type`, `mark_as` (no inspeccionado, inaccesible, etc.).
    *   Asegurar que el esquema sea escalable y optimizado para el uso en campo (filtrado eficiente).
3.  **Propuesta de Arquitectura de Alto Nivel (Opcional, si lo considera necesario):**
    *   Si el Arquitecto identifica patrones de interacción o flujos de datos complejos que requieren un diagrama, puede incluir una descripción o un pseudo-diagrama.

## Formato de Entrega:
El entregable del Arquitecto debe ser un archivo Markdown (`.md`) o un archivo SQL (`.sql`) con el esquema propuesto, guardado en:
`/Users/bastian/Desktop/Claw:Claud Test/rat-apps/.harness/tasks/architect_output_app2_height_safety.md`

El contenido debe ser claro, conciso y seguir las mejores prácticas de Supabase.
