
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
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import Cookies from "js-cookie";

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
  const [loadingProfile, setLoadingProfile] = useState(true);
  
  const router = useRouter(); 

  const fetchUserProfile = useCallback(async (user: FirebaseUser | null) => {
    setLoadingProfile(true);
    if (!user) {
      setUserProfile(null);
      setLoadingProfile(false);
      return;
    }
    
    try {
      const userDocRef = doc(db, "platformUsers", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const profileDataFromDb = userDocSnap.data();
        let rolesArray: PlatformUser['roles'] = [];
        if (profileDataFromDb.roles && Array.isArray(profileDataFromDb.roles)) {
          rolesArray = profileDataFromDb.roles;
        } else if (profileDataFromDb.role && typeof profileDataFromDb.role === 'string') {
          rolesArray = [profileDataFromDb.role as PlatformUserRole];
        }
        
        const profileData = { 
            id: userDocSnap.id, 
            uid: user.uid, 
            ...profileDataFromDb,
            roles: rolesArray, 
        } as PlatformUser;
        setUserProfile(profileData);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error("AuthContext: Error fetching user profile:", error);
      setUserProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const token = await user.getIdToken();
        Cookies.set('idToken', token, { path: '/', secure: true, sameSite: 'strict' });
        await fetchUserProfile(user);
      } else {
        Cookies.remove('idToken');
        setUserProfile(null);
        setLoadingProfile(false);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfile]);

  const login = useCallback(async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      
      if (userCredential.user) {
        // Llamar a la API para actualizar lastLogin en el backend
        await fetch('/api/user/update-last-login', { method: 'POST' });
      }
      
      return userCredential;
    } catch (error) {
      return error as AuthError;
    }
  }, []);

  const signup = useCallback(async (email: string, pass: string, name?: string, role: PlatformUserRole = 'promoter'): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        const userDocRef = doc(db, "platformUsers", userCredential.user.uid);
        const newProfile: Omit<PlatformUser, 'id' | 'lastLogin' | 'businessId'> = {
          uid: userCredential.user.uid,
          email: userCredential.user.email || "",
          name: name || userCredential.user.email?.split('@')[0] || "Nuevo Usuario",
          roles: [role], 
          dni: "",
        };
        await setDoc(userDocRef, { ...newProfile, lastLogin: serverTimestamp(), businessId: null });
      }
      return userCredential;
    } catch (error) {
      return error as AuthError;
    }
  }, []);

  const logout = useCallback(async () => {
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
  }), [currentUser, userProfile, loadingAuth, loadingProfile, login, signup, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
