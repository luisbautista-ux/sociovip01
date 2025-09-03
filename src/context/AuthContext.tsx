
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
        
        const profileData = { 
            id: userDocSnap.id, 
            uid: user.uid, 
            ...profileDataFromDb,
            roles: rolesArray, 
        } as PlatformUser;
        setUserProfile(profileData);
        return profileData;
      } else {
        console.error(`AuthContext: No profile found in Firestore for UID ${user.uid}. User needs to be logged out.`);
        setUserProfile(null);
        return null;
      }
    } catch (error) {
      console.error("AuthContext: Error fetching user profile:", error);
      setUserProfile(null);
      return null;
    } finally {
      setLoadingProfile(false);
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
      setLoadingAuth(true); // Ensure loading is true at the start of a change
      if (user) {
        setCurrentUser(user);
        const token = await user.getIdToken();
        Cookies.set('idToken', token, { path: '/', secure: true, sameSite: 'strict' });
        
        const profile = await fetchUserProfile(user);
        if (!profile) {
          // If no profile exists for an authenticated user, log them out.
          toast({
            title: "Error de Perfil",
            description: "Tu cuenta existe, pero no se encontró un perfil de datos válido. Se ha cerrado la sesión.",
            variant: "destructive",
            duration: 8000
          });
          await logout();
        }
      } else {
        // No user is signed in
        setCurrentUser(null);
        setUserProfile(null);
        Cookies.remove('idToken');
        setLoadingProfile(false); // No profile to load
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfile, logout]);

  const login = useCallback(async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;
      
      // Post-login profile check
      const profile = await fetchUserProfile(user);
      if (!profile) {
        // If profile doesn't exist, sign out the user immediately and return an error
        await logout();
        return {
          code: 'auth/user-profile-not-found',
          message: 'No se encontró perfil para este usuario. Sesión terminada.'
        } as AuthError;
      }
      
      // Update last login timestamp
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
