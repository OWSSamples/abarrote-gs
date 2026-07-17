# ADR-011: Flujo profesional de entrega de correo

## Estado
Aceptado

## Contexto
La plataforma usa correo en dos canales distintos:

1. Recuperacion, verificacion y codigos de autenticacion administrados por Amazon Cognito.
2. Correos transaccionales administrados por la aplicacion, como tickets, reportes y avisos internos.

SpaceMail puede alojar buzones del dominio `opendex.dev`, pero Cognito no envia correos mediante el SMTP de SpaceMail. Cognito debe usar su configuracion de correo propia o una identidad verificada de Amazon SES.

## Decision
Mantener separados los dos canales de entrega:

- Cognito: recuperacion de contrasena, verificacion de cuenta y codigos relacionados con identidad.
- `src/lib/email.ts`: correos transaccionales de la aplicacion mediante SMTP o SES.

Para produccion, Cognito debe conectarse a una identidad SES verificada del dominio, preferentemente `opendex.dev` o `no-reply@opendex.dev`.

## Reglas operativas
- No guardar credenciales SMTP para resolver recuperacion de contrasena de Cognito.
- No revelar al usuario final si un correo existe en Cognito.
- No registrar destinatarios completos en logs.
- Usar hashes y dominios para correlacion tecnica.
- Mantener el remitente de seguridad como `no-reply@opendex.dev`.
- Monitorear rebotes, quejas y supresion desde SES cuando Cognito use SES.

## Variables relacionadas
- `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION`: configuracion de identidad.
- `SES_FROM_EMAIL`: remitente para correos transaccionales administrados por la app cuando se usa SES.
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`: transporte SMTP para correos de la app, no para Cognito.

## Validacion manual
1. Verificar que el dominio o remitente este verificado en SES.
2. Verificar que Cognito User Pool use la identidad SES aprobada para produccion.
3. Solicitar recuperacion de contrasena desde `/auth/forgot-password`.
4. Confirmar que el usuario recibe el codigo y que el codigo permite cambiar la contrasena.
5. Probar `sendTestEmailAction` desde ajustes de correo para validar el canal transaccional de la app.

## Consecuencias
- El flujo de identidad queda aislado del transporte SMTP de tienda.
- Los logs pueden correlacionar errores sin exponer PII.
- Si Cognito no entrega correos, el diagnostico debe revisarse en Cognito/SES, no en `src/lib/email.ts`.
