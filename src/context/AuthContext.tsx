
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

        const userDocRef = doc(db, "platformUsers", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            console.log("AuthContext (Google): Profile not found by UID, checking by email for pre-created profile.");
            const usersRef = collection(db, "platformUsers");
            const q = query(usersRef, where("email", "==", user.email), where("uid", "==", null), limit(1));
            const preCreatedUserSnap = await getDocs(q);

            if (!preCreatedUserSnap.empty) {
                console.log("AuthContext (Google): Found pre-created profile by email. Linking UID.");
                const preCreatedDoc = preCreatedUserSnap.docs[0];
                const preCreatedData = preCreatedDoc.data();
                
                const batch = writeBatch(db);

                // Create a new document with the correct UID
                batch.set(userDocRef, {
                    ...preCreatedData,
                    uid: user.uid,
                    lastLogin: serverTimestamp(),
                });

                // Delete the old document that had a null UID (or autogenerated ID)
                batch.delete(preCreatedDoc.ref);

                await batch.commit();
                console.log("AuthContext (Google): Successfully linked pre-created profile to new Google Auth UID.");

            } else {
                console.log("AuthContext (Google): No pre-created profile found. Creating a new one.");
                const newProfile: Omit<PlatformUser, 'id' | 'lastLogin' | 'businessId'> = {
                    uid: user.uid,
                    email: user.email || "",
                    name: user.displayName || user.email?.split('@')[0] || "Nuevo Usuario",
                    roles: ["promoter"], 
                    dni: "",
                };
                await setDoc(userDocRef, { ...newProfile, lastLogin: serverTimestamp(), businessId: null });
            }
        } else {
            console.log("AuthContext (Google): Existing Google login. Profile found for UID:", user.uid);
            await updateDoc(userDocRef, { lastLogin: serverTimestamp() });
        }
        
        return userCredential;
    } catch (error) {
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
