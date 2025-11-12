
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
  UserCredential,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  linkWithPopup,
  getAdditionalUserInfo,
  reauthenticateWithPopup
} from "firebase/auth";
import type { AuthError } from "firebase/auth"; 
import { useRouter } from "next/navigation";
import type { PlatformUser, PlatformUserRole } from "@/lib/types"; 
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import Cookies from "js-cookie";
import { toast } from "@/hooks/use-toast";

// New type for extra signup data
interface ExtraSignupData {
  dni: string;
  phone: string;
  dob: Date;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: PlatformUser | null; 
  loadingAuth: boolean; 
  loadingProfile: boolean; 
  login: (email: string, pass: string) => Promise<UserCredential | AuthError>;
  signup: (email: string, pass: string, name?: string, role?: PlatformUserRole, extraData?: ExtraSignupData) => Promise<UserCredential | AuthError>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: AuthError }>;
  refreshUserProfile: () => Promise<void>;
  loginWithGoogle: (role?: PlatformUserRole) => Promise<UserCredential | AuthError>; 
  loginWithFacebook: (role?: PlatformUserRole) => Promise<UserCredential | AuthError>; 
  linkGoogleAccount: () => Promise<{ success: boolean; error?: AuthError }>;
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
  const [loadingProfile, setLoadingProfile] = useState(false); // Only true when fetching profile
  
  const router = useRouter(); 

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("AuthContext: Logout error:", error);
    } finally {
      setCurrentUser(null);
      setUserProfile(null);
      Cookies.remove('idToken');
    }
  }, []);

  const fetchUserProfile = useCallback(async (user: FirebaseUser): Promise<PlatformUser | null> => {
    setLoadingProfile(true);
    try {
      const userDocRef = doc(db, "platformUsers", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const profileData = {
          id: userDocSnap.id,
          uid: user.uid,
          ...userDocSnap.data(),
        } as PlatformUser;
        setUserProfile(profileData);
        return profileData;
      } else {
        return null;
      }
    } catch (error) {
      console.error("AuthContext: Error fetching user profile:", error);
      return null;
    } finally {
      setLoadingProfile(false);
    }
  }, []);
  
  const refreshUserProfile = useCallback(async () => {
    if (currentUser) {
        await fetchUserProfile(currentUser);
    }
  }, [currentUser, fetchUserProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user);
      } else {
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
      
      const profile = await fetchUserProfile(user);
      if (!profile) {
          toast({
              title: "Error de Perfil",
              description: "No se encontró un perfil para este usuario. Por favor, contacta al administrador.",
              variant: "destructive",
          });
          await logout();
          return { code: 'auth/user-profile-not-found', message: 'No se encontró perfil para este usuario.' } as AuthError;
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
  }, [logout, fetchUserProfile]);

  const signup = useCallback(async (email: string, pass: string, name?: string, role: PlatformUserRole = 'client_gratis', extraData?: ExtraSignupData): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        const userDocRef = doc(db, "platformUsers", userCredential.user.uid);
        const newProfile: Omit<PlatformUser, 'id' | 'lastLogin' | 'businessId' | 'businessIds'> = {
          uid: userCredential.user.uid,
          email: userCredential.user.email || "",
          name: name || userCredential.user.email?.split('@')[0] || "Nuevo Usuario",
          roles: [role], 
          dni: extraData?.dni || "",
          phone: extraData?.phone || "",
          dob: extraData?.dob ? extraData.dob.toISOString() : undefined,
        };
        await setDoc(userDocRef, { ...newProfile, lastLogin: serverTimestamp(), businessId: null, businessIds: [], assignedBusinessId: null });
        await fetchUserProfile(userCredential.user);
      }
      return userCredential;
    } catch (error) {
      return error as AuthError;
    }
  }, [fetchUserProfile]);

  const handleSocialLogin = async (provider: GoogleAuthProvider | FacebookAuthProvider, role: PlatformUserRole = 'client_gratis'): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      const additionalInfo = getAdditionalUserInfo(userCredential);
      const userDocRef = doc(db, "platformUsers", user.uid);
      
      if (additionalInfo?.isNewUser) {
        const newProfile: Omit<PlatformUser, 'id' | 'lastLogin' | 'businessId' | 'businessIds'> = {
          uid: user.uid,
          email: user.email || "",
          name: user.displayName || user.email?.split('@')[0] || "Nuevo Usuario",
          photoURL: user.photoURL || undefined,
          roles: [role],
          dni: "",
          phone: "",
          dob: undefined,
        };
        await setDoc(userDocRef, { ...newProfile, lastLogin: serverTimestamp(), businessId: null, businessIds: [] });
      }
      
      await fetchUserProfile(user); // Fetch profile for both new and existing users
      
      const token = await user.getIdToken();
      await fetch('/api/user/update-last-login', { 
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
      });
      
      return userCredential;
    } catch (error) {
        return error as AuthError;
    }
  };

  const loginWithGoogle = (role: PlatformUserRole = 'client_gratis') => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return handleSocialLogin(provider, role);
  };
  const loginWithFacebook = (role: PlatformUserRole = 'client_gratis') => handleSocialLogin(new FacebookAuthProvider(), role);

  const linkGoogleAccount = useCallback(async (): Promise<{ success: boolean; error?: AuthError }> => {
    if (!currentUser) return { success: false, error: { code: 'auth/no-current-user', message: 'No hay un usuario activo para vincular.' } as AuthError };
    
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
      hd: undefined 
    });

    try {
        await linkWithPopup(currentUser, provider);
        await refreshUserProfile();
        return { success: true };
    } catch(error) {
        const authError = error as AuthError;
        let userFriendlyError = { ...authError, message: "Ocurrió un error desconocido durante la vinculación." };
        
        if (authError.code === 'auth/credential-already-in-use') {
            userFriendlyError.message = "Esta cuenta de Google ya está vinculada a otro usuario de la plataforma. Intenta iniciar sesión directamente con esa cuenta de Google.";
        } else if(authError.code === 'auth/popup-closed-by-user') {
            userFriendlyError.message = "La ventana de vinculación fue cerrada antes de completarse.";
        }

        console.error("Link Google Account Error:", authError.code, authError.message);
        return { success: false, error: userFriendlyError };
    }
  }, [currentUser, refreshUserProfile]);


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
    loginWithGoogle,
    loginWithFacebook,
    linkGoogleAccount,
  }), [currentUser, userProfile, loadingAuth, loadingProfile, login, signup, logout, sendPasswordReset, refreshUserProfile, linkGoogleAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
