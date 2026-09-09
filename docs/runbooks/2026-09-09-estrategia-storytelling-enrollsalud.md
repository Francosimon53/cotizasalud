# Runbook — estrategia de storytelling medible en EnrollSalud

Fecha: 2026-09-09

## Resultado medible

- El enlace personal muestra una historia antes de solicitar PII o consentimiento.
- Cada historia y canal conserva atribución UTM hasta el lead.
- El agente puede ver y filtrar origen e historia en el CRM.
- La autorización previa muestra identidad real del agente y describe acciones futuras con precisión.
- La suite completa y el build terminan sin errores.

## Guion ejecutable

1. Añadir un catálogo versionado de historias compuestas y una pantalla narrativa previa al consentimiento.
   - Verificación: `/q/[slug]` inicia en la historia; `/cotizar` conserva el flujo directo.
2. Integrar historias en el kit de compartir y generar mensajes humanos por canal.
   - Verificación: cada link contiene `utm_source`, `utm_medium` y un `utm_campaign` de historia.
3. Exponer atribución en la tabla y detalle del lead.
   - Verificación: se puede filtrar por origen e historia sin exportar CSV.
4. Bloquear la autorización hasta cargar el perfil real del agente y corregir el lenguaje temporal del consentimiento.
   - Verificación: nunca aparece el slug como nombre ni NPN/teléfono en blanco.
5. Reducir las recomendaciones financieras específicas del asesor de IA.
   - Verificación: el prompt no ordena elegir un plan ni depositar una cantidad para recuperar subsidios.
6. Ejecutar pruebas y build.
   - Verificación: 100% de pruebas aprobadas y build exitoso.

## Límites

- Las historias son compuestas y se identifican como tales; no se inventan testimonios.
- No se infiere estatus migratorio desde ubicación, idioma o comportamiento.
- No se amplía fuera de Florida hasta confirmar licencias, términos y operación por estado.
- No se despliega a producción en este runbook.
