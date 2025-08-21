# App Access URLs and Example Credentials

This file provides the URLs and example credentials to access the different user panels in the application.

**Common Password for all users:** `password123`

---

### 1. Super Admin Panel

-   **URL to access:** `/login`
-   **Example Email:** `superadmin@sociosvip.app`
-   **Password:** `password123`
-   **Description:** Has full access to the entire platform, including managing businesses, all users, and platform-wide analytics. After login, you will be redirected to `/admin/dashboard`.

---

### 2. Business Admin / Staff Panel

-   **URL to access:** `/login`
-   **Example Email:** `admin@pandora.com`
-   **Password:** `password123`
-   **Description:** Manages a specific business. Can create and manage promotions, events, view clients, and configure business settings. After login, you will be redirected to `/business-panel/dashboard`.

---

### 3. Promoter Panel

-   **URL to access:** `/login`
-   **Example Email:** `promoter@sociosvip.app`
-   **Password:** `password123`
-   **Description:** Can view promotions/events they are assigned to and generate unique codes for them. After login, you will be redirected to `/promoter/dashboard`.

---

### 4. Host (Anfitrión) Panel

-   **URL to access:** `/login`
-   **Example Email:** `host@pandora.com`
-   **Password:** `password123`
-   **Description:** Primarily uses the QR code scanner to validate tickets and promotions at the door of an event or business. After login, you will be redirected to `/host/validate`.

---

**Note:** These are example credentials. You will need to create these users in your Firebase Authentication console and set up their corresponding profiles in the Firestore `platformUsers` collection with the correct roles and `businessId` where applicable.