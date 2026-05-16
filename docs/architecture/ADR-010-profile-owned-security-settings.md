# ADR-010: Ajustes de seguridad personales bajo el perfil

## Estado

Aceptado

## Contexto

La sección de seguridad para 2FA/MFA, app autenticadora y recovery codes protege la identidad del usuario autenticado. No configura el negocio, la tienda, pagos, inventario ni parámetros generales de operación.

Mantener esta pantalla bajo ajustes generales de la tienda mezcla responsabilidades: los ajustes generales pertenecen al negocio, mientras que MFA pertenece al perfil personal.

## Decisión

La pantalla de seguridad 2FA/MFA vivirá en `/dashboard/profile/security` y será accesible desde “Mi perfil” → “Seguridad del perfil”.

La ruta anterior `/dashboard/settings/security` redirige a `/dashboard/profile/security` para no romper enlaces antiguos, pero ya no presenta la pantalla como parte de configuración general del negocio.

## Opciones consideradas

- Mantener MFA en configuración general: descartado porque comunica que MFA es una configuración del negocio.
- Insertar todo el flujo MFA dentro del modal de perfil: descartado porque el flujo contiene QR, recovery codes y confirmaciones que requieren una pantalla completa.
- Crear una ruta dedicada de perfil: elegido porque separa responsabilidad personal y mantiene el flujo completo y legible.

## Consecuencias

- “Configuración” queda enfocada en ajustes del negocio.
- “Mi perfil” concentra seguridad personal del usuario.
- Los avisos obligatorios de MFA envían al usuario a la ruta de perfil.
- Los enlaces antiguos continúan funcionando mediante redirección.
