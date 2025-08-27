
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { auth, db } from "@/lib/firebase"; 
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  UserCredential
} from "firebase/auth";
import type { AuthError } from "firebase/auth"; 
import { useRouter } from "next/navigation";
import type { PlatformUser, PlatformUserRole } from "@/lib/types"; 
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"; 

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: PlatformUser | null; 
  loadingAuth: boolean; 
  loadingProfile: boolean; 
  login: (email: string, pass: string) => Promise<UserCredential | AuthError>;
  signup: (email: string, pass: string, name?: string, role?: PlatformUserRole) => Promise<UserCredential | AuthError>;
  logout: () => Promise<void>;
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
      setLoadingAuth(false); // Auth state known, primary loading done.

      if (user) {
        if (!db) { 
            console.error("AuthContext: Firestore DB service is not available. Cannot fetch profile.");
            setLoadingProfile(false);
            setUserProfile(null);
            return;
        }
        setLoadingProfile(true);
        setUserProfile(null); 
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

  const signup = useCallback(async (email: string, pass: string, name?: string, role: PlatformUserRole = 'superadmin'): Promise<UserCredential | AuthError> => {
    if (!auth || !db) return { code: "auth/internal-error", message: "Firebase Auth/DB not initialized" } as AuthError;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        const userDocRef = doc(db, "platformUsers", userCredential.user.uid);
        const newProfile: Omit<PlatformUser, 'id' | 'lastLogin' | 'businessId' | 'dni'> & { lastLogin: any; businessId: string | null; dni: string; } = {
          uid: userCredential.user.uid,
          email: userCredential.user.email || "",
          name: name || userCredential.user.email?.split('@')[0] || "Nuevo Usuario",
          roles: [role], 
          dni: "",
          businessId: null,
          lastLogin: serverTimestamp(),
        };
        await setDoc(userDocRef, newProfile);
        console.log(`AuthContext: Profile with role '${role}' created in Firestore for UID:`, userCredential.user.uid);
      }
      return userCredential;
    } catch (error) {
      return error as AuthError;
    }
  }, [router]);

  const logout = useCallback(async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      router.push("/login"); 
    } catch (error) {
      console.error("AuthContext: Logout error:", error);
    }
  }, [router]); // router is a stable dependency

  const value = useMemo(() => ({
    currentUser,
    userProfile,
    loadingAuth,
    loadingProfile,
    login,
    signup,
    logout,
  }), [currentUser, userProfile, loadingAuth, loadingProfile, login, signup, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
