
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { auth, db } from "@/lib/firebase"; 
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  UserCredential
} from "firebase/auth";
import type { AuthError } from "firebase/auth"; 
import { useRouter } from "next/navigation";
import type { PlatformUser, PlatformUserRole } from "@/lib/types"; 
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit, writeBatch } from "firebase/firestore";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: PlatformUser | null; 
  loadingAuth: boolean; 
  loadingProfile: boolean; 
  login: (email: string, pass: string) => Promise<UserCredential | AuthError>;
  signup: (email: string, pass: string, name?: string, role?: PlatformUserRole) => Promise<UserCredential | AuthError>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<UserCredential | AuthError>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<PlatformUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true); 
  const [loadingProfile, setLoadingProfile] = useState(false); 
  
  const router = useRouter(); 

  useEffect(() => {
    if (!auth) { 
      console.error("AuthContext: Firebase Auth service is not available. Cannot set up auth listener.");
      setLoadingAuth(false);
      setLoadingProfile(false);
      setCurrentUser(null);
      setUserProfile(null);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("AuthContext: onAuthStateChanged triggered. User:", user ? user.uid : null);
      setCurrentUser(user);
      setLoadingAuth(false); 

      if (user) {
        if (!db) { 
            console.error("AuthContext: Firestore DB service is not available. Cannot fetch profile.");
            setLoadingProfile(false);
            setUserProfile(null);
            return;
        }
        setLoadingProfile(true);
        setUserProfile(null); 
        
        // Add a small delay to allow for Firestore propagation after a new Google sign-in/profile update
        setTimeout(async () => {
          try {
            const userDocRef = doc(db, "platformUsers", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            console.log("AuthContext: Attempting to fetch profile for UID:", user.uid);
            if (userDocSnap.exists()) {
              const profileDataFromDb = userDocSnap.data();
              console.log("AuthContext: Profile data fetched from Firestore:", profileDataFromDb);
              
              let rolesArray: PlatformUser['roles'] = [];
              if (profileDataFromDb.roles && Array.isArray(profileDataFromDb.roles)) {
                rolesArray = profileDataFromDb.roles;
              } else if (profileDataFromDb.role && typeof profileDataFromDb.role === 'string') { 
                rolesArray = [profileDataFromDb.role as PlatformUserRole];
              } else {
                console.warn(`AuthContext: User profile for UID ${user.uid} has missing or invalid 'roles' field. Defaulting to empty roles array.`);
              }

              const profileData = { 
                  id: userDocSnap.id, 
                  uid: user.uid, 
                  ...profileDataFromDb,
                  roles: rolesArray, 
              } as PlatformUser;
              setUserProfile(profileData);
            } else {
              console.warn(`AuthContext: PROFILE NOT FOUND in Firestore for UID: ${user.uid}.`);
              setUserProfile(null); 
            }
          } catch (error) {
            console.error("AuthContext: Error fetching user profile:", error);
            setUserProfile(null);
          } finally {
            setLoadingProfile(false);
          }
        }, 500); // 500ms delay

      } else { 
        setUserProfile(null); 
        setLoadingProfile(false); 
      }
    });

    return () => {
      console.log("AuthContext: Unsubscribing from onAuthStateChanged");
      unsubscribe();
    };
  }, []); 

  const login = useCallback(async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    if (!auth) return { code: "auth/internal-error", message: "Firebase Auth not initialized" } as AuthError;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      return userCredential;
    } catch (error) {
      return error as AuthError;
    }
  }, []);

  const signup = useCallback(async (email: string, pass: string, name?: string, role: PlatformUserRole = 'promoter'): Promise<UserCredential | AuthError> => {
    if (!auth || !db) return { code: "auth/internal-error", message: "Firebase Auth/DB not initialized" } as AuthError;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        const userDocRef = doc(db, "platformUsers", userCredential.user.uid);
        const newProfile: Omit<PlatformUser, 'id' | 'lastLogin' | 'businessId'> = {
          uid: userCredential.user.uid,
          email: userCredential.user.email || "",
          name: name || userCredential.user.email?.split('@')[0] || "Nuevo Usuario",
          roles: [role], 
          dni: "", // DNI should be added later by an admin if needed
        };
        await setDoc(userDocRef, { ...newProfile, lastLogin: serverTimestamp(), businessId: null });
        console.log(`AuthContext: Profile with role '${role}' created in Firestore for UID:`, userCredential.user.uid);
      }
      return userCredential;
    } catch (error) {
      return error as AuthError;
    }
  }, []);

 const loginWithGoogle = useCallback(async (): Promise<UserCredential | AuthError> => {
    if (!auth || !db) return { code: "auth/internal-error", message: "Firebase Auth/DB not initialized" } as AuthError;
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      const userEmail = user.email;

      if (!userEmail) {
        throw new Error("El proveedor de Google no proporcionó un email.");
      }

      // Buscar si ya existe un documento para este UID
      const userDocRefByUid = doc(db, "platformUsers", user.uid);
      const userDocSnapByUid = await getDoc(userDocRefByUid);

      if (userDocSnapByUid.exists()) {
        console.log("AuthContext (Google): Profile found by UID. Updating lastLogin.");
        await updateDoc(userDocSnapByUid.ref, { lastLogin: serverTimestamp() });
        return userCredential; // User exists and is linked, process finished.
      }

      // Si no se encontró por UID, buscar por email
      console.log("AuthContext (Google): Profile not found by UID, searching by email:", userEmail);
      const usersRef = collection(db, "platformUsers");
      const q = query(usersRef, where("email", "==", userEmail), limit(1));
      const preCreatedUserSnap = await getDocs(q);

      if (!preCreatedUserSnap.empty) {
        const preCreatedDoc = preCreatedUserSnap.docs[0];
        const preCreatedData = preCreatedDoc.data();
        console.log("AuthContext (Google): Found profile by email. ID:", preCreatedDoc.id);

        if (preCreatedData.uid && preCreatedData.uid !== user.uid) {
          console.error("AuthContext (Google): Security conflict. Email is already linked to a different UID.");
          throw new Error("Este email ya está asociado a otra cuenta de autenticación.");
        }

        if (!preCreatedData.uid) { // This is a pre-created profile
          console.log("AuthContext (Google): Profile is pre-created (no UID). Linking now.");
          // This profile was created by an admin. We need to move it to the correct UID document.
          const batch = writeBatch(db);

          // 1. Create the new document with the correct UID from Google Auth
          batch.set(userDocRefByUid, {
            ...preCreatedData,
            uid: user.uid,
            lastLogin: serverTimestamp(),
          });

          // 2. Delete the old document which had an auto-generated ID
          batch.delete(preCreatedDoc.ref);

          await batch.commit();
          console.log("AuthContext (Google): Successfully linked pre-created profile to Google Auth UID.");
        } else {
          // This case is unlikely if the UID check above passed, but as a safeguard...
          console.log("AuthContext (Google): Profile found by email has a matching UID. Updating lastLogin.");
          await updateDoc(preCreatedDoc.ref, { lastLogin: serverTimestamp() });
        }
      } else {
        // No profile found by UID or email, create a new one (e.g., for a new promoter signing up)
        console.log("AuthContext (Google): No existing profile. Creating a new one for a new user.");
        const newProfile: Omit<PlatformUser, 'id' | 'lastLogin' | 'businessId'> = {
          uid: user.uid,
          email: user.email || "",
          name: user.displayName || user.email?.split('@')[0] || "Nuevo Usuario",
          roles: ["promoter"], // Default role for new Google signups
          dni: "",
        };
        await setDoc(userDocRefByUid, { ...newProfile, lastLogin: serverTimestamp(), businessId: null });
        console.log("AuthContext (Google): New promoter profile created for UID:", user.uid);
      }
      
      return userCredential;
    } catch (error) {
      console.error("AuthContext (Google): Login/Signup failed.", error);
      return error as AuthError;
    }
  }, []);

  const logout = useCallback(async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      router.push("/login"); 
    } catch (error) {
      console.error("AuthContext: Logout error:", error);
    }
  }, [router]);

  const value = useMemo(() => ({
    currentUser,
    userProfile,
    loadingAuth,
    loadingProfile,
    login,
    signup,
    logout,
    loginWithGoogle,
  }), [currentUser, userProfile, loadingAuth, loadingProfile, login, signup, logout, loginWithGoogle]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
