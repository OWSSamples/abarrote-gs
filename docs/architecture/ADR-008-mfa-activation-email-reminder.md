# ADR-008: Recordatorio por correo al activar MFA

## Estado
Aceptado

## Contexto
La activación de autenticación de doble factor cambia el perfil de seguridad del usuario. El usuario debe recibir una confirmación en el correo registrado en su perfil para recordar que debe guardar sus recovery codes y detectar activaciones no reconocidas.

## Decisión
Enviar un correo transaccional al correo del perfil (`user_roles.email`) después de activar TOTP MFA y generar recovery codes. El correo confirma la activación y recuerda guardar los códigos, pero nunca incluye recovery codes ni secretos TOTP.

## Drivers
- Notificar cambios sensibles de seguridad al usuario afectado.
- Usar el correo del perfil como canal de contacto autorizado.
- Evitar exposición de recovery codes por correo.
- Respetar la configuración existente de correo y alertas de seguridad.

## Opciones consideradas
1. Enviar recovery codes por correo: rechazado por riesgo de exposición.
2. Enviar aviso a administradores: útil para auditoría, pero no cumple el recordatorio directo al usuario.
3. Enviar confirmación al usuario sin códigos: elegido.

## Consecuencias
- Si el envío de correos de seguridad está deshabilitado o mal configurado, MFA se activa de todos modos y el UI muestra advertencia no bloqueante.
- La notificación usa la infraestructura SMTP/SES existente.
- Los códigos siguen siendo de visualización única dentro del dashboard.
