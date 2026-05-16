# ADR-009: Opciones de verificación en dos pasos por disponibilidad

## Estado
Aceptado

## Contexto
El sistema ya puede usar verificación por correo a través de AWS Cognito y también soporta TOTP con app autenticadora. Además, los recovery codes se administran en PostgreSQL como hashes de un solo uso. Otros métodos, como SMS o passkeys, requieren configuración adicional de AWS/Cognito/WebAuthn y no deben mostrarse como funcionales si no están habilitados.

## Decisión
Mostrar en el dashboard un selector explícito de métodos 2FA basado en disponibilidad real:

- Correo electrónico: activo cuando Cognito tiene correo verificado.
- App autenticadora: disponible mediante AWS Cognito TOTP.
- Recovery codes: disponibles desde PostgreSQL después de activar app autenticadora.
- SMS: visible como no disponible hasta que exista teléfono verificado y configuración SMS/IAM en Cognito.
- Passkeys/WebAuthn: visible como próximo/no disponible hasta implementar soporte dedicado.

La verificación por correo verificado cuenta como factor base para no mostrar avisos persistentes de activación MFA durante todo el dashboard.
El correo no aparece como método activable porque se habilita automáticamente al estar verificado en Cognito. El selector permite continuar solo con métodos adicionales soportados actualmente: app autenticadora TOTP y recovery codes cuando TOTP ya existe. SMS y passkeys se muestran deshabilitados con explicación.

## Drivers
- Evitar alertas innecesarias cuando el usuario ya tiene verificación por correo.
- No prometer métodos no configurados.
- Mantener TOTP y recovery codes como fortalecimiento recomendado.
- Separar claramente fuentes: AWS Cognito para identidad/factores y PostgreSQL para recovery codes hasheados.

## Consecuencias
- El banner global de MFA no molesta a usuarios con correo verificado.
- El panel de seguridad muestra capacidades disponibles y próximas sin activar funciones incompletas.
- SMS y passkeys requieren futuras implementaciones/configuración antes de convertirse en métodos activos.
