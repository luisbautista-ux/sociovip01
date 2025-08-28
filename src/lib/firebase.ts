// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDtMgj_WySsrpmVdYLxem22UzCG8xCKQ4I",
  authDomain: "cloverpass.firebaseapp.com",
  projectId: "cloverpass",
  storageBucket: "cloverpass.appspot.com",
  messagingSenderId: "564817412003",
  appId: "1:564817412003:web:83938e8372bb360c0bde416"
};

// Initialize Firebase for SSR
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
