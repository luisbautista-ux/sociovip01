
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// --- INSTRUCCIONES IMPORTANTES ---
// REEMPLAZA los valores de marcador de posición de abajo con los de tu proyecto de Firebase.
// Ve a tu consola de Firebase -> Configuración del proyecto -> Tus apps -> SDK de Firebase -> Configuración.
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_ID_DE_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TUS_NUMEROS",
  appId: "1:TUS_NUMEROS:web:XXXXXXXXXXXXXXXXXXXXXX"
};

// Comprobación para asegurar que los valores han sido cambiados
if (firebaseConfig.apiKey.startsWith("AIzaSyXXX")) {
  throw new Error("La configuración de Firebase en src/lib/firebase.ts no ha sido actualizada. Por favor, reemplaza los valores de marcador de posición con los de tu proyecto.");
}

// Initialize Firebase for SSR
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
