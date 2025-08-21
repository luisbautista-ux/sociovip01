# App Access URLs, Roles, and Credentials

This file provides the URLs, user roles, and example credentials to access the different panels in the application.

**Common Password for all users:** `password123`

---

## 1. User Panels & Example Credentials

### Super Admin Panel
-   **URL to access:** `/login`
-   **Example Email:** `superadmin@sociosvip.app`
-   **Password:** `password123`
-   **Description:** Has full access to the entire platform, including managing businesses, all users, and platform-wide analytics. After login, you will be redirected to `/admin/dashboard`.

### Business Admin / Staff Panel
-   **URL to access:** `/login`
-   **Example Email:** `admin@pandora.com`
-   **Password:** `password123`
-   **Description:** Manages a specific business. Can create and manage promotions, events, view clients, and configure business settings. After login, you will be redirected to `/business-panel/dashboard`.

### Promoter Panel
-   **URL to access:** `/login`
-   **Example Email:** `promoter@sociosvip.app`
-   **Password:** `password123`
-   **Description:** Can view promotions/events they are assigned to and generate unique codes for them. After login, you will be redirected to `/promoter/dashboard`.

### Host (Anfitrión) Panel
-   **URL to access:** `/login`
-   **Example Email:** `host@pandora.com`
-   **Password:** `password123`
-   **Description:** Primarily uses the QR code scanner to validate tickets and promotions at the door of an event or business. After login, you will be redirected to `/host/validate`.

---

## 2. Internal URL Access by User Role

This section outlines the application's internal routes and which user roles have access to them.

### Public Routes (No login required)
-   `/`: Main landing page of the application.
-   `/login`: User login page.
-   `/signup`: Super Admin registration page.
-   `/b/[customUrlPath]`: Public page for a business with a custom URL (e.g., `/b/pandora-lounge`).
-   `/business/[businessId]`: Public page for a business without a custom URL.

### Authentication Routes (Internal)
-   `/auth/dispatcher`: A page that redirects logged-in users to their corresponding dashboard based on their role. Users are sent here immediately after a successful login.

### Super Admin Routes (`superadmin` role)
-   **Base Path:** `/admin`
-   `/admin/dashboard`: Main statistics and overview of the entire platform.
-   `/admin/businesses`: Manage (create, edit, delete) all affiliated businesses.
-   `/admin/users`: Manage all platform users (admins, staff, promoters, hosts).
-   `/admin/socios-vip`: Manage the exclusive SocioVIP members.
-   `/admin/clients`: View all QR clients from all businesses.
-   `/admin/analytics`: View platform-wide analytics.

### Business Panel Routes (`business_admin` or `staff` roles)
-   **Base Path:** `/business-panel`
-   `/business-panel/dashboard`: Statistics and overview for the specific business.
-   `/business-panel/promotions`: Manage promotions for the business.
-   `/business-panel/events`: Manage events for the business.
-   `/business-panel/clients`: View clients (QR and VIP) associated with the business.
-   `/business-panel/promoters`: Manage promoters linked to the business.
-   `/business-panel/staff`: Manage staff members for the business.
-   `/business-panel/analytics`: View detailed analytics for the business.
-   `/business-panel/settings`: Configure branding and public information for the business.

### Promoter Routes (`promoter` role)
-   **Base Path:** `/promoter`
-   `/promoter/dashboard`: Overview and statistics for the promoter.
-   `/promoter/entities`: View assigned promotions and events and generate codes.
-   `/promoter/commissions`: View commission reports (functionality pending).

### Host Routes (`host` role)
-   **Base Path:** `/host`
-   `/host/validate`: Main page with QR code scanner for validating promotional codes and event tickets at the door.

---

**Note:** The example credentials are for demonstration purposes. You will need to create these users in your Firebase Authentication console and set up their corresponding profiles in the Firestore `platformUsers` collection with the correct roles and `businessId` where applicable.