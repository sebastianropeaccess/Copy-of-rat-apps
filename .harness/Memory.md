# [Memory.md] - Memoria Operativa y Contexto del Ecosistema

> **DIRECTIVA DE SISTEMA PARA AI-COO:** Este archivo es el "cerebro" de la forma en que operamos. Debes leerlo usando `cat` al iniciar cada sesión. Si Bastian te corrige en un workflow o establecen una nueva regla de trabajo, debes usar herramientas de terminal para añadir (append) ese aprendizaje en la sección "5. Ledger de Correcciones".

## 1. Distinción de Fuentes de Verdad (¡CRÍTICO!)
Para proteger la ventana de contexto y evitar la redundancia, la memoria está dividida en dos:
- **Este archivo (`.harness/Memory.md`):** Gobierna el comportamiento de los agentes, reglas de orquestación, gestión de terminal y preferencias personales de Bastian.
- **Memoria del Código (`rat-apps/app/CLAUDE.md`):** Contiene TODA la información técnica del software (Next.js 16, Supabase, Tailwind, Vercel, túneles Cloudflared, esquema de BD). **No dupliques la información técnica aquí.** Si necesitas contexto técnico, lee ese archivo.

## 2. Entorno de Desarrollo y Restricciones Físicas
- **Usuario:** Bastian (Orquestador Humano).
- **Hardware:** MacBook Pro M1 2020 (8GB de RAM Unificada).
- **Restricción Absoluta:** La memoria RAM es un cuello de botella crítico. Está estrictamente prohibido ejecutar scripts locales pesados o mantener múltiples procesos en segundo plano. Toda la carga cognitiva compleja debe delegarse mediante el sistema de archivos (`.harness/tasks/`) a sub-agentes que se ejecutan y luego se cierran.

## 3. Contexto de Negocio: RAT Apps (Rope Access)
- **Operación en Terreno:** Las aplicaciones se usarán en condiciones hostiles (brillo solar intenso, guantes, conectividad intermitente). El diseño "Mobile-First" y tolerante a falta de conexión no es opcional.
- **Regla de Negocio Base:** Estimaciones y cotizaciones en esta industria se basan en el cálculo de **Horas-Hombre (HH)** técnicas.

## 4. Skills y Workflows Disponibles
- **Rebuild App (`claude:skills:rebuild-app`):** Skill registrada para migrar apps legacy de Appsheet a la nueva plataforma de RATs. Úsala como base antes de crear flujos nuevos.
- *(El AI-COO añadirá aquí nuevos skills a medida que el Skill Observer los sugiera y apruebe).*

## 5. Ledger de Correcciones y Aprendizajes Operativos (Append Only)
*Instrucciones de escritura: Al añadir un ítem, usa un formato ultra-corto (Ej: "[YYYY-MM-DD]: Regla XYZ"). No reescribas el archivo completo, usa comandos de terminal como `echo "- [Fecha]: Regla" >> .harness/Memory.md`.*

- [2026-06-21]: Inicialización del sistema base de memoria. Separación de Memory.md (workflow) y CLAUDE.md (código) establecida.
- [2026-06-21]: El token de Vercel se trunca al pasarlo a 'exec' vía env o --token; requiere intervención manual o un método alternativo de autenticación.
