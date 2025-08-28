
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// --- INSTRUCCIONES IMPORTANTES ---
// REEMPLAZA los valores de marcador de posición de abajo con los de tu proyecto de Firebase.
// Ve a tu consola de Firebase -> Configuración del proyecto -> Tus apps -> SDK de Firebase -> Configuración.
const firebaseConfig = {
  apiKey: "AIzaSyDtMgj_WySsrpmVdYLxem22UzCG8xCKQ4I",
  authDomain: "cloverpass.firebaseapp.com",
  projectId: "cloverpass",
  storageBucket: "cloverpass.appspot.com",
  messagingSenderId: "564817412003",
  appId: "1:564817412003:web:8938e8372bb360c0bde416"
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
