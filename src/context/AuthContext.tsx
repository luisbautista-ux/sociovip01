
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
import Cookies from "js-cookie";
import { toast } from "@/hooks/use-toast";

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

  const fetchUserProfile = useCallback(async (user: FirebaseUser): Promise<PlatformUser | null> => {
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
        return profileData;
      } else {
        console.error(`AuthContext: No profile found in Firestore for UID ${user.uid}. User needs to be logged out.`);
        return null;
      }
    } catch (error) {
      console.error("AuthContext: Error fetching user profile:", error);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      // Clear local state immediately
      setCurrentUser(null);
      setUserProfile(null);
      Cookies.remove('idToken');
      // Redirect to login page
      router.push("/login"); 
    } catch (error) {
      console.error("AuthContext: Logout error:", error);
    }
  }, [router]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoadingAuth(true);
      setLoadingProfile(true); 
      
      if (user) {
        setCurrentUser(user);
        const token = await user.getIdToken();
        Cookies.set('idToken', token, { path: '/', secure: true, sameSite: 'strict' });
        
        const profile = await fetchUserProfile(user);
        if (profile) {
            setUserProfile(profile);
            setLoadingProfile(false);
        } else {
          toast({
            title: "Error de Perfil",
            description: "Tu cuenta existe, pero no se encontró un perfil de datos válido. Se ha cerrado la sesión.",
            variant: "destructive",
            duration: 8000
          });
          await logout();
          setUserProfile(null);
          setLoadingProfile(false);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        Cookies.remove('idToken');
        setLoadingProfile(false);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfile, logout]);

  const login = useCallback(async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;
      
      const profile = await fetchUserProfile(user);
      if (!profile) {
        await logout();
        return {
          code: 'auth/user-profile-not-found',
          message: 'No se encontró perfil para este usuario. Sesión terminada.'
        } as AuthError;
      }
      
      const token = await user.getIdToken();
      Cookies.set('idToken', token, { path: '/', secure: true, sameSite: 'strict' });
      await fetch('/api/user/update-last-login', { 
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
      });
      
      return userCredential;
    } catch (error) {
      return error as AuthError;
    }
  }, [fetchUserProfile, logout]);

  const signup = useCallback(async (email: string, pass: string, name?: string, role: PlatformUserRole = 'promoter'): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        const userDocRef = doc(db, "platformUsers", userCredential.user.uid);
        const newProfile: Omit<PlatformUser, 'id' | 'lastLogin' | 'businessId' | 'businessIds'> = {
          uid: userCredential.user.uid,
          email: userCredential.user.email || "",
          name: name || userCredential.user.email?.split('@')[0] || "Nuevo Usuario",
          roles: [role], 
          dni: "",
        };
        await setDoc(userDocRef, { ...newProfile, lastLogin: serverTimestamp(), businessId: null, businessIds: [] });
      }
      return userCredential;
    } catch (error) {
      return error as AuthError;
    }
  }, []);

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
