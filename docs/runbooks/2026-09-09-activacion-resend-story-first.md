# Activación Resend de story-first

## Resultado medible

Un administrador autenticado puede enviar una invitación personalizada, una sola vez desde la interfaz, a cada agente activo operativo mediante `notifications@enrollsalud.com`, sin extraer `RESEND_API_KEY` ni incluir datos de clientes.

## Guion ejecutado

1. **Proteger el endpoint.** `POST /api/admin/announce-story-first` exige sesión y un slug de `ADMIN_SLUGS`.
   - Verificación: una sesión ausente responde `401`; un agente no administrador responde `403`.
2. **Seleccionar destinatarios.** Consulta agentes activos con email válido y excluye `simon-dev`, `test-agent` y `pppppppppppp`.
   - Verificación: el resultado informa `attempted` y `sent` por slug.
3. **Personalizar el mensaje.** Cada email contiene el slug del agente y dos enlaces con UTM: `historia-carta-mesa-v1` y `historia-cita-pospuesta-v1`.
   - Verificación: el HTML usa `escapeHtml` para el nombre y el endpoint no recibe datos de consumidores.
4. **Ejecutar desde el panel.** El botón está visible solo en la página administrativa de Equipo y se deshabilita tras éxito.
   - Verificación: el panel muestra cuántos agentes recibieron la activación.
5. **Retirar la acción temporal.** Después del envío se elimina el endpoint y el botón para evitar duplicados.
   - Verificación: producción vuelve a compilar sin la acción de envío.
