# URLs de Acceso, Roles y Credenciales de la Aplicación

Este archivo proporciona las URLs, roles de usuario y credenciales de ejemplo para acceder a los diferentes paneles de la aplicación.

**Contraseña Común para todos los usuarios:** `password123`

---

## 1. Paneles de Usuario y Credenciales de Ejemplo

### Panel de Super Administrador
-   **URL de acceso:** `/login`
-   **Email de Ejemplo:** `superadmin@sociosvip.app`
-   **Contraseña:** `password123`
-   **Descripción:** Tiene acceso completo a toda la plataforma, incluida la gestión de negocios, todos los usuarios y los análisis de toda la plataforma. Después de iniciar sesión, serás redirigido a `/admin/dashboard`.

### Panel de Administrador de Negocio / Staff
-   **URL de acceso:** `/login`
-   **Email de Ejemplo:** `admin@pandora.com`
-   **Contraseña:** `password123`
-   **ID de Negocio Asociado (`businessId`):** Se debe asignar en el perfil del usuario en Firestore.
-   **Descripción:** Gestiona un negocio específico. Puede crear y gestionar promociones, eventos, ver clientes y configurar los ajustes del negocio. Después de iniciar sesión, serás redirigido a `/business-panel/dashboard`.

### Panel de Promotor
-   **URL de acceso:** `/login`
-   **Email de Ejemplo:** `promoter@sociosvip.app`
-   **Contraseña:** `password123`
-   **Descripción:** Puede ver las promociones/eventos a los que está asignado y generar códigos únicos para ellos. Después de iniciar sesión, serás redirigido a `/promoter/dashboard`.

### Panel de Anfitrión (Host)
-   **URL de acceso:** `/login`
-   **Email de Ejemplo:** `host@pandora.com`
-   **Contraseña:** `password123`
-   **ID de Negocio Asociado (`businessId`):** Se debe asignar en el perfil del usuario en Firestore.
-   **Descripción:** Utiliza principalmente el escáner de códigos QR para validar tickets y promociones en la puerta de un evento o negocio. Después de iniciar sesión, serás redirigido a `/host/validate`.

---

## 2. Acceso a URLs Internas por Rol de Usuario

Esta sección detalla las rutas internas de la aplicación y qué roles de usuario tienen acceso a ellas.

### Rutas Públicas (No requieren inicio de sesión)
-   `/`: Página principal de la aplicación.
-   `/login`: Página de inicio de sesión de usuario.
-   `/signup`: Página de registro de Super Administrador.
-   `/b/[customUrlPath]`: Página pública para un negocio con una URL personalizada (ej., `/b/pandora-lounge`).
-   `/business/[businessId]`: Página pública para un negocio sin una URL personalizada.

### Rutas de Autenticación (Internas)
-   `/auth/dispatcher`: Una página que redirige a los usuarios que han iniciado sesión a su panel de control correspondiente según su rol. Los usuarios son enviados aquí inmediatamente después de un inicio de sesión exitoso.

### Rutas de Super Administrador (rol `superadmin`)
-   **Ruta Base:** `/admin`
-   `/admin/dashboard`: Estadísticas principales y visión general de toda la plataforma.
-   `/admin/businesses`: Gestionar (crear, editar, eliminar) todos los negocios afiliados.
-   `/admin/users`: Gestionar todos los usuarios de la plataforma (admins, staff, promotores, anfitriones).
-   `/admin/socios-vip`: Gestionar los miembros exclusivos de SocioVIP.
-   `/admin/clients`: Ver todos los clientes QR de todos los negocios.
-   `/admin/analytics`: Ver analíticas a nivel de toda la plataforma.

### Rutas del Panel de Negocio (roles `business_admin` o `staff`)
-   **Ruta Base:** `/business-panel`
-   `/business-panel/dashboard`: Estadísticas y visión general del negocio específico.
-   `/business-panel/promotions`: Gestionar promociones para el negocio.
-   `/business-panel/events`: Gestionar eventos para el negocio.
-   `/business-panel/clients`: Ver clientes (QR y VIP) asociados al negocio.
-   `/business-panel/promoters`: Gestionar promotores vinculados al negocio.
-   `/business-panel/staff`: Gestionar miembros del personal del negocio.
-   `/business-panel/analytics`: Ver analíticas detalladas para el negocio.
-   `/business-panel/settings`: Configurar la marca e información pública del negocio.

### Rutas de Promotor (rol `promoter`)
-   **Ruta Base:** `/promoter`
-   `/promoter/dashboard`: Visión general y estadísticas para el promotor.
-   `/promoter/entities`: Ver promociones y eventos asignados y generar códigos.
-   `/promoter/commissions`: Ver informes de comisiones (funcionalidad pendiente).

### Rutas de Anfitrión (rol `host`)
-   **Ruta Base:** `/host`
-   `/host/validate`: Página principal con escáner de códigos QR para validar códigos promocionales y entradas de eventos en la puerta.

---

**Nota:** Las credenciales de ejemplo son para fines de demostración. Necesitarás crear estos usuarios en tu consola de Firebase Authentication y configurar sus perfiles correspondientes en la colección `platformUsers` de Firestore con los roles correctos y el `businessId` cuando sea aplicable.
