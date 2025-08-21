// src/lib/firebase/firebaseAdmin.ts

// La lógica de inicialización de Firebase Admin se ha movido a /src/lib/firebase/functions.ts
// para asegurar que solo se inicialice cuando sea estrictamente necesario y con las
// variables de entorno cargadas correctamente.

// Este archivo se mantiene para evitar errores de importación en el futuro, pero
// no debe contener lógica de inicialización. Las funciones que necesiten el SDK de Admin
// deben manejar su propia inicialización segura.
export {};
