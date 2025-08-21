# Resumen de Funcionalidades y Desarrollo de la Plataforma SocioVIP

Este documento proporciona un resumen detallado de las funcionalidades actuales de la aplicación, los flujos de trabajo por rol de usuario y un historial de los cambios y correcciones implementados.

---

## 1. Visión General de la Aplicación

La plataforma SocioVIP es un sistema multi-panel diseñado para que negocios (discotecas, bares, restaurantes, etc.) puedan crear y gestionar promociones y eventos. La aplicación soporta varios roles de usuario, cada uno con su propio panel y permisos específicos, y ofrece páginas públicas para que los clientes finales interactúen con las ofertas.

### Roles de Usuario Soportados:

1.  **Público/Cliente Final:** Usuarios no autenticados que visitan las páginas públicas.
2.  **Super Administrador:** Control total sobre toda la plataforma.
3.  **Administrador de Negocio / Staff:** Gestión completa de un negocio específico.
4.  **Promotor:** Genera y distribuye códigos únicos para promociones y eventos.
5.  **Anfitrión (Host):** Valida los códigos QR en el punto de entrada del negocio/evento.

---

## 2. Funcionalidades por Módulo y Rol

### A. Módulo Público (No requiere inicio de sesión)

-   **Página Principal (`/`)**:
    -   **Funcionalidad:** Muestra un listado de todas las promociones activas y vigentes de todos los negocios registrados en la plataforma.
    -   **Flujo:** Los usuarios pueden ver tarjetas de promociones, buscar por nombre o negocio, y hacer clic en una promoción para ser redirigidos a la página pública del negocio correspondiente.
-   **Página Pública del Negocio (`/b/[url-personalizada]` o `/business/[businessId]`)**:
    -   **Funcionalidad:** Es la vitrina de un negocio. Muestra todas sus promociones y eventos activos y vigentes.
    -   **Flujo para Clientes:**
        1.  El cliente ve una lista de promociones/eventos.
        2.  Para obtener un QR, debe ingresar un código alfanumérico de 9 dígitos proporcionado por un promotor.
        3.  Tras ingresar un código válido, se le solicita su DNI/CE.
        4.  Si el DNI ya existe como "Cliente QR", se genera el QR directamente.
        5.  Si el DNI es nuevo, se despliega un formulario para que el cliente ingrese su nombre, apellido, celular y fecha de nacimiento.
        6.  Una vez completado el registro, se muestra en pantalla el código QR personalizado con los detalles de la promoción/evento y los datos del cliente.
        7.  El cliente puede descargar una imagen PNG del QR con todos los detalles.
-   **Inicio de Sesión y Registro (`/login`, `/signup`)**:
    -   Páginas para que los usuarios de la plataforma (admins, staff, etc.) inicien sesión.
    -   El registro (`/signup`) está diseñado específicamente para crear nuevas cuentas de Super Administrador.

### B. Panel de Super Administrador (`/admin/*`)

-   **Dashboard (`/admin/dashboard`)**:
    -   **Funcionalidad:** Muestra tarjetas con estadísticas clave de toda la plataforma: total de negocios, usuarios, socios VIP, promociones activas, códigos creados y clientes QR.
-   **Gestión de Negocios (`/admin/businesses`)**:
    -   **Funcionalidad:** Panel CRUD (Crear, Leer, Actualizar, Eliminar) completo para los negocios afiliados.
    -   **Flujo:** Permite crear nuevos negocios, editar toda su información (datos fiscales, de contacto, branding, URL personalizada) y eliminarlos. La tabla muestra los negocios y permite buscar y exportar los datos a CSV.
-   **Gestión de Usuarios (`/admin/users`)**:
    -   **Funcionalidad:** Panel CRUD para los usuarios de la plataforma (admins, staff, promotores, anfitriones).
    -   **Flujo:** Implementa un flujo "DNI-primero". Se verifica si un DNI ya existe para evitar duplicados. Permite crear nuevos perfiles de usuario (requiere UID de Firebase Auth), asignar roles y vincularlos a un negocio si es necesario.
-   **Gestión de Socios VIP (`/admin/socios-vip`)**:
    -   **Funcionalidad:** Panel CRUD para gestionar los miembros del programa de lealtad "Socio VIP".
    -   **Flujo:** Implementa un flujo "DNI-primero" para verificar si un usuario ya existe. Permite registrar nuevos socios, editar sus datos (puntos, estado de membresía, etc.) y eliminarlos.
-   **Clientes QR (`/admin/clients`)**:
    -   **Funcionalidad:** Muestra un listado de todos los clientes que han generado un código QR en toda la plataforma. Permite buscar y filtrar por mes de cumpleaños o registro.
-   **Analíticas (`/admin/analytics`)**:
    -   **Funcionalidad:** Página con gráficos (actualmente con datos de ejemplo) que muestran tendencias de rendimiento de promociones y registro de nuevos clientes a lo largo del tiempo.

### C. Panel de Negocio (`/business-panel/*`)

-   **Dashboard (`/business-panel/dashboard`)**:
    -   **Funcionalidad:** Muestra estadísticas clave para el negocio específico del usuario logueado (promociones activas, eventos próximos, códigos creados y usados).
-   **Gestión de Promociones (`/business-panel/promotions`)**:
    -   **Funcionalidad:** Panel CRUD completo para las promociones del negocio.
    -   **Flujo:** Permite crear, editar, duplicar y eliminar promociones. Se puede gestionar el estado (activo/inactivo) y ver estadísticas básicas por promoción. También permite crear y gestionar códigos de un solo uso para cada promoción.
-   **Gestión de Eventos (`/business-panel/events`)**:
    -   **Funcionalidad:** Panel CRUD avanzado para los eventos del negocio.
    -   **Flujo:** Permite crear y gestionar eventos. El diálogo de gestión está dividido en pestañas:
        -   **Detalles:** Información principal del evento.
        -   **Entradas:** Crear y gestionar diferentes tipos de entradas (ej: General, VIP) con costo y cantidad. El aforo total se calcula automáticamente.
        -   **Boxes:** Crear y gestionar boxes, incluyendo la capacidad de crearlos en lote (ej: "Mesa VIP 1" a "Mesa VIP 10").
        -   **Promotores:** Asignar promotores (previamente vinculados en su sección) a un evento específico y definir reglas de comisión detalladas por tipo de entrada o box.
-   **Gestión de Promotores (`/business-panel/promoters`)**:
    -   **Funcionalidad:** Panel para vincular promotores al negocio.
    -   **Flujo:** Usa un flujo "DNI-primero" para verificar si el promotor ya existe como usuario de la plataforma o cliente. Permite vincularlo y definir una tasa de comisión general.
-   **Configuración (`/business-panel/settings`)**:
    -   **Funcionalidad:** Permite al administrador del negocio personalizar la apariencia y la información pública de su página.
    -   **Flujo:** Se puede subir un logo y una imagen de portada, definir el slogan y los colores de la marca. **Se solucionaron errores de permisos de Firebase Storage para esta funcionalidad.**

### D. Panel de Promotor (`/promoter/*`)

-   **Dashboard (`/promoter/dashboard`)**:
    -   **Funcionalidad:** Muestra estadísticas relevantes para el promotor, como el número de negocios a los que está asignado y los códigos que ha creado y que han sido canjeados.
-   **Promociones y Eventos (`/promoter/entities`)**:
    -   **Funcionalidad:** Es la herramienta principal del promotor. Muestra una lista de todas las promociones y eventos activos a los que ha sido asignado.
    -   **Flujo:** El promotor puede generar lotes de códigos alfanuméricos únicos de 9 dígitos para cualquier entidad asignada. Puede ver los códigos que ha generado, su estado (disponible, canjeado) y eliminarlos si es necesario.
-   **Comisiones (`/promoter/commissions`)**:
    -   **Funcionalidad:** Página preparada para mostrar un reporte detallado de las comisiones ganadas por el promotor. **(Actualmente es un placeholder)**.

### E. Panel de Anfitrión (`/host/validate`)

-   **Funcionalidad:** Es una herramienta simple y directa para validar códigos QR en la puerta.
-   **Flujo:**
    1.  El anfitrión abre la página y puede iniciar el escáner de la cámara.
    2.  Al escanear un QR válido y disponible, se muestra la información de la promoción/evento y del cliente, y se puede marcar el código como "canjeado".
    3.  Si el código ya fue usado, está vencido o es inválido, se muestra un mensaje de error claro.
    4.  También se puede ingresar el código manualmente.

---

## 3. Historial de Cambios y Correcciones Clave

-   **Estructura Multi-Panel:** Se definió y creó la arquitectura de rutas y layouts para los diferentes roles de usuario.
-   **Autenticación y Perfiles:** Se implementó un sistema de autenticación con `AuthContext` que no solo gestiona el login/logout sino que también obtiene el perfil del usuario desde Firestore para la gestión de permisos.
-   **Flujos CRUD con "DNI-Primero":** Se implementó una lógica robusta en los paneles de "Usuarios" y "Socios VIP" para verificar la existencia de un DNI antes de crear un nuevo registro, evitando duplicados y pre-rellenando datos cuando es posible.
-   **Página Principal de Promociones:** Se transformó la página de inicio (`/`) de una herramienta simple a un portal completo que muestra todas las promociones activas de todos los negocios, mejorando la experiencia del usuario final.
-   **Solución de Errores de Permisos (Firebase Rules):**
    -   Se diagnosticó y corrigió un error recurrente de `storage/unauthorized`.
    -   Se proveyeron y refinaron las reglas de seguridad completas tanto para **Firestore (`firestore.rules`)** como para **Firebase Storage (`storage.rules`)** para permitir las operaciones de la aplicación (como la subida de logos) de forma segura, asegurando que las reglas de Storage pudieran leer datos de Firestore para la validación.
-   **Corrección de Bugs de Formulario:** Se solucionó un problema crítico en el panel de gestión de eventos donde los cambios en los detalles del evento no se guardaban en la base de datos al ser una actualización de estado local que no se persistía. Se refactorizó el flujo de guardado para asegurar la consistencia de los datos.
-   **Manejo de Tipos de Datos:** Se corrigieron errores `*.toDate is not a function` al hacer el código más robusto para manejar fechas que pueden ser `Timestamps` de Firebase o `strings` ISO.
-   **Mejora de la Experiencia de Usuario:**
    -   Se añadieron feedbacks visuales (loaders, toasts, mensajes de error detallados).
    -   Se crearon archivos de documentación como `ACCESS_CREDENTIALS.md` y este mismo `SYSTEM_SUMMARY.md` para facilitar el uso y entendimiento de la plataforma.
    -   Se hicieron enlaces de elementos (como el nombre del negocio) para mejorar la navegabilidad.
    -   Se implementó la lógica de redirección a páginas con URL personalizada (`/b/[slug]`) para mejorar el SEO y la experiencia de marca.
