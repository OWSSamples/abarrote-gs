# ADR-001: Multi-tenancy por negocio

- **Estado:** Aceptada, despliegue por fases
- **Fecha original:** 2026-04-22
- **Última actualización:** 2026-07-16
- **Contexto técnico:** Next.js 16, Drizzle, PostgreSQL/Neon y AWS Cognito

## Contexto

Opendex opera como SaaS para negocios independientes. Cada negocio debe mantener aislados su catálogo, inventario, ventas, clientes, proveedores, equipo, roles, configuración, archivos e integraciones.

`stores.id` es actualmente la frontera de tenant. El nombre histórico `store_id` se conserva para evitar una migración destructiva. Una sucursal futura requerirá una entidad distinta y no debe modelarse concediendo acceso cruzado entre negocios.

## Decisión

Se usa una base PostgreSQL compartida con aislamiento por fila y autorización derivada en servidor:

- El cliente nunca decide un `store_id` confiable para una operación de negocio.
- `requireStoreScope()` resuelve el tenant activo desde una membresía válida.
- La cookie `__store_id` solo selecciona entre negocios activos a los que la identidad pertenece.
- Una identidad autenticada sin membresía activa falla de forma cerrada.
- Las acciones, caches, folios, archivos, trabajos e integraciones incluyen el tenant explícitamente.

## Identidad y membresías

AWS Cognito es el proveedor global de autenticación. PostgreSQL es la fuente de autorización de negocio.

- `user_identities` contiene el perfil global de la identidad y no concede acceso a ningún tenant.
- `user_roles` es la membresía autoritativa, con unicidad por `cognito_sub + store_id`.
- Una misma identidad puede pertenecer a varios negocios con roles diferentes.
- `is_default` solo define el negocio inicial cuando no existe una selección válida.
- `user_store_access` se conserva temporalmente como proyección de compatibilidad; no participa en la decisión de acceso.
- Los roles de sistema son compartidos. Los roles personalizados solo son válidos dentro de su tenant.
- El rol `Propietario` no se puede asignar desde formularios comunes.

El perfil global puede reflejarse en membresías heredadas para compatibilidad, pero los identificadores globales se generan y aseguran en `user_identities`.

## Registro e invitaciones

El registro de autoservicio crea en una transacción:

1. Un tenant de 32 caracteres hexadecimales.
2. Un nombre de negocio único sin distinguir mayúsculas y minúsculas.
3. Su configuración fiscal y comercial.
4. Una membresía `Propietario` activa para la identidad registrada.
5. Un evento de auditoría dentro del tenant.

Una identidad ya autenticada puede crear otro negocio desde el selector de negocio. Ese flujo reutiliza la identidad global, vuelve a validar la sesión y la capacidad de aprovisionamiento en el servidor, crea una nueva membresía `Propietario` y selecciona el tenant recién creado. No vuelve a registrar al usuario en Cognito ni solicita otra contraseña.

Los colaboradores no se crean con una contraseña elegida por el administrador. El alta usa `tenant_invitations`:

- El token aleatorio solo se entrega por correo; en base se almacena SHA-256.
- La invitación vence, es de un solo uso y está limitada por tenant y correo.
- El destinatario debe autenticarse con el mismo correo antes de aceptarla.
- La aceptación aplica el límite de usuarios bajo bloqueo transaccional.
- Una identidad existente puede aceptar acceso a otro negocio sin duplicarse en Cognito.

## Propiedad y administración de plataforma

- El propietario no puede darse de baja, eliminarse ni perder su rol por el flujo genérico.
- La transferencia de propiedad es una transacción explícita: primero promueve al nuevo propietario y luego asigna un rol no propietario al anterior.
- Un trigger impide dejar un tenant sin al menos un propietario activo.
- `platform_administrators` está separado del RBAC de negocio. No se infiere por correo, dominio o rol de tenant.
- Suspender, reactivar o archivar un negocio requiere administración de plataforma y deja auditoría.
- Un negocio archivado no se reactiva desde el flujo normal.

Las filas de `platform_administrators` deben aprovisionarse mediante un procedimiento operativo auditado. El registro de usuarios nunca crea administradores de plataforma.

## Integridad de datos

Las relaciones críticas usan claves compuestas `store_id + id` además de los IDs históricos. Esto impide que una fila hija apunte a un padre de otro tenant aunque exista un error en la capa de aplicación.

Se cubren, entre otras:

- Categorías, productos y movimientos de inventario.
- Ventas, partidas, devoluciones y CFDI.
- Pedidos, partidas de pedido y auditorías de inventario.
- Clientes, fiado, lealtad y movimientos de caja.
- Registros asociados a pagos externos.

Los folios de ventas y servicios usan `tenant_sequences`, con reserva atómica e independiente por negocio. Los índices únicos de folio también incluyen `store_id`.

## Archivos

`tenant_assets` es el catálogo autoritativo de objetos subidos:

- El servidor genera la clave `tenants/{storeId}/{kind}/{assetId}`.
- El cliente no puede elegir claves de S3 ni borrar objetos arbitrarios.
- La eliminación busca el activo por ID o URL dentro del tenant activo.
- Se valida firma binaria, tamaño, categoría y permiso antes de subir.
- Los avatares solo los elimina su propietario o un administrador autorizado.
- Los SVG de entrada no confiable se rechazan.

## Procesos en segundo plano

Los trabajos reciben o enumeran un tenant explícito. Antes de enviar notificaciones, consultar proveedores o procesar expiraciones, verifican que el negocio siga activo. Los caches y locks de dominio incluyen `storeId`.

## Row-Level Security

La migración `0033_platform_admin_and_tenant_rls_policies.sql` instala funciones de contexto y políticas RLS, pero no activa RLS automáticamente.

La activación requiere primero:

1. Un rol de conexión de aplicación que no sea propietario de las tablas ni tenga `BYPASSRLS`.
2. Ejecutar cada operación tenant dentro de una transacción.
3. Establecer `app.current_tenant_id` y `app.current_user_id` con `set_config(..., true)`.
4. Resolver el tenant inicial mediante un mecanismo seguro que no dependa de consultar tablas ya bloqueadas sin contexto.
5. Adaptar y probar trabajos, webhooks y operaciones globales de plataforma.
6. Validar dos tenants reales en una copia de producción antes de usar `ENABLE ROW LEVEL SECURITY` o `FORCE ROW LEVEL SECURITY`.

`src/db/tenant-context.ts` es la única utilidad autorizada para preparar ese contexto en conexiones agrupadas. El valor es local a la transacción para impedir fugas entre solicitudes.

## Despliegue y migración

Las migraciones `0032` y `0033` no deben ejecutarse automáticamente desde una sesión de desarrollo.

Antes de producción:

- Ejecutar contra una copia reciente de la base.
- Resolver cualquier error de referencias cruzadas u accesos huérfanos; la migración aborta en vez de corregirlos silenciosamente.
- Confirmar que todas las membresías tienen una identidad global.
- Revisar que cada tenant conserve propietario y configuración.
- Validar los índices compuestos y el backfill de `tenant_sequences`.
- Verificar que folios de fiado, cargos y reembolsos existentes correspondan a ventas o pagos del mismo tenant.
- Desplegar primero el esquema y después el código que lo consume.

## Limitaciones vigentes

- Las políticas RLS están preparadas, no activadas. El aislamiento efectivo actual combina scope de aplicación, constraints y autorización del servidor.
- `store_id` representa un negocio, no una sucursal.
- `user_store_access` sigue presente por compatibilidad y se retirará después de una ventana de migración.
- Falta ejecutar una suite automatizada completa de aislamiento, concurrencia e integración sobre una base de prueba migrada.
- Las credenciales globales de plataforma y las credenciales configuradas por negocio requieren procedimientos operativos separados.

## Criterios de aceptación

- Un usuario solo puede consultar y modificar filas del tenant activo.
- Cambiar la cookie no concede acceso a otro negocio.
- Una identidad puede tener roles distintos en varios tenants sin efectos globales inesperados.
- Ningún flujo común puede dejar un tenant sin propietario.
- Una baja de un tenant no desactiva la identidad si conserva otra membresía activa.
- Los trabajos, caches, webhooks, folios y archivos no comparten estado entre tenants.
- Las referencias cruzadas entre padres e hijos de tenants distintos son rechazadas por PostgreSQL.
