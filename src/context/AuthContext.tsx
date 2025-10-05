
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { auth, db } from "@/lib/firebase"; 
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
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
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: AuthError }>;
  refreshUserProfile: () => Promise<void>; // Added this
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

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      Cookies.remove('idToken');
      router.push("/login"); 
    } catch (error) {
      console.error("AuthContext: Logout error:", error);
    }
  }, [router]);

  const fetchUserProfile = useCallback(async (user: FirebaseUser) => {
    if (!user) {
      setUserProfile(null);
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
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
        const profileData: PlatformUser = {
          id: userDocSnap.id,
          uid: user.uid,
          ...profileDataFromDb,
          roles: rolesArray,
        } as PlatformUser;
        setUserProfile(profileData);
      } else {
        console.error(`AuthContext: No profile found for UID ${user.uid}. Logging out.`);
        await logout();
      }
    } catch (error) {
      console.error("AuthContext: Error fetching user profile:", error);
      await logout();
    } finally {
      setLoadingProfile(false);
    }
  }, [logout]);
  
  const refreshUserProfile = useCallback(async () => {
    if (currentUser) {
        await fetchUserProfile(currentUser);
    }
  }, [currentUser, fetchUserProfile]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoadingAuth(true);
      if (user) {
        setCurrentUser(user);
        const token = await user.getIdToken();
        Cookies.set('idToken', token, { path: '/', secure: true, sameSite: 'strict' });
        await fetchUserProfile(user);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        Cookies.remove('idToken');
        setLoadingProfile(false);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfile]);
  
  const login = useCallback(async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;
      
      const userDocRef = doc(db, "platformUsers", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
          console.error(`AuthContext: Login successful but no profile found for UID ${user.uid}. Logging out.`);
          toast({
              title: "Error de Perfil",
              description: "No se encontró un perfil para este usuario. Por favor, contacta al administrador.",
              variant: "destructive",
              duration: 8000
          });
          await logout();
          return {
            code: 'auth/user-profile-not-found',
            message: 'No se encontró perfil para este usuario.'
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
  }, [logout]);

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

  const sendPasswordReset = useCallback(async (email: string): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: error as AuthError };
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
    sendPasswordReset,
    refreshUserProfile,
  }), [currentUser, userProfile, loadingAuth, loadingProfile, login, signup, logout, sendPasswordReset, refreshUserProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
