

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
  signInWithPopup,
  linkWithPopup,
  getAdditionalUserInfo,
  FacebookAuthProvider
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
  overrideName?: string;
  businessId?: string | null; // AÑADIDO para staff/promotor/etc
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: PlatformUser | null; 
  loadingAuth: boolean; 
  loadingProfile: boolean; 
  login: (email: string, pass: string) => Promise<UserCredential | AuthError>;
  signupWithGoogle: (role: PlatformUserRole, extraData: ExtraSignupData) => Promise<UserCredential | AuthError>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: AuthError }>;
  refreshUserProfile: () => Promise<void>;
  loginWithGoogle: (role?: PlatformUserRole) => Promise<UserCredential | AuthError>; 
  linkGoogleAccount: () => Promise<{ success: boolean; error?: AuthError }>;
  linkFacebookAccount: () => Promise<{ success: boolean; error?: AuthError }>;
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
    } catch (error) {
      console.error("AuthContext: Logout error:", error);
    } finally {
      // States will be cleared by onAuthStateChanged
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
  
  const refreshUserProfile = useCallback(async () => {
    if (auth.currentUser) {
        await fetchUserProfile(auth.currentUser);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (isMounted) {
        if (user) {
          setCurrentUser(user);
          await fetchUserProfile(user);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
          Cookies.remove('idToken');
        }
        setLoadingAuth(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
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

  const handleSocialLogin = async (provider: GoogleAuthProvider | FacebookAuthProvider, role: PlatformUserRole = 'client_gratis'): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      const additionalInfo = getAdditionalUserInfo(userCredential);
      const userDocRef = doc(db, "platformUsers", user.uid);
      
      if (additionalInfo?.isNewUser) {
        const newProfile: Omit<PlatformUser, 'id' | 'lastLogin'> = {
          uid: user.uid,
          email: user.email || "",
          name: user.displayName || user.email?.split('@')[0] || "Nuevo Usuario",
          photoURL: user.photoURL || undefined,
          roles: [role],
          dni: "",
          phone: "",
          dob: undefined,
          businessId: null,
          businessIds: [], 
        };
        await setDoc(userDocRef, { ...newProfile, lastLogin: serverTimestamp() });
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
      provider.setCustomParameters({ hd: undefined });
      return handleSocialLogin(provider, role);
  };
  
  const signupWithGoogle = async (role: PlatformUserRole = 'client_gratis', extraData: ExtraSignupData): Promise<UserCredential | AuthError> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account', hd: undefined });
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const additionalInfo = getAdditionalUserInfo(result);
        const userDocRef = doc(db, "platformUsers", user.uid);
        
        if (additionalInfo?.isNewUser) {
            const newProfile: Omit<PlatformUser, 'id' | 'lastLogin'> = {
              uid: user.uid,
              email: user.email || "",
              name: extraData.overrideName || user.displayName || "Nuevo Usuario",
              photoURL: user.photoURL || undefined,
              roles: [role],
              dni: extraData.dni || "",
              phone: extraData.phone || "",
              dob: extraData.dob ? extraData.dob.toISOString() : undefined,
              businessId: extraData.businessId || null, // CORREGIDO: Usar el businessId de extraData
              businessIds: [], // Inicia vacío, se llenará con la interacción
            };
            await setDoc(userDocRef, { ...newProfile, lastLogin: serverTimestamp() });
            await fetchUserProfile(user);
        } else {
            const existingProfile = await getDoc(userDocRef);
            if (!existingProfile.exists()) {
               const newProfile: Omit<PlatformUser, 'id' | 'lastLogin'> = {
                uid: user.uid,
                email: user.email || "",
                name: extraData.overrideName || user.displayName || "Usuario Existente",
                photoURL: user.photoURL || undefined,
                roles: [role],
                dni: extraData.dni || "",
                phone: extraData.phone || "",
                dob: extraData.dob ? extraData.dob.toISOString() : undefined,
                businessId: extraData.businessId || null, // CORREGIDO: Usar el businessId de extraData
                businessIds: [],
               };
               await setDoc(userDocRef, { ...newProfile, lastLogin: serverTimestamp() });
            } else {
                 return { code: 'auth/credential-already-in-use', message: 'Este usuario ya existe.' } as AuthError;
            }
             await fetchUserProfile(user);
        }

        return result;
    } catch(error) {
        return error as AuthError;
    }
  };
  
  const sendPasswordReset = useCallback(async (email: string): Promise<{ success: boolean; error?: AuthError }> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: error as AuthError };
    }
  }, []);

  const linkAccount = useCallback(async (provider: GoogleAuthProvider | FacebookAuthProvider): Promise<{ success: boolean; error?: AuthError }> => {
    if (!currentUser) return { success: false, error: { code: 'auth/no-current-user', message: 'No hay un usuario activo para vincular.' } as AuthError };

    try {
        await linkWithPopup(currentUser, provider);
        await refreshUserProfile();
        return { success: true };
    } catch(error) {
        const authError = error as AuthError;
        let userFriendlyError = { ...authError, message: "Ocurrió un error desconocido durante la vinculación." };
        
        if (authError.code === 'auth/credential-already-in-use') {
            userFriendlyError.message = "Esta cuenta ya está vinculada a otro usuario de la plataforma.";
        } else if(authError.code === 'auth/popup-closed-by-user') {
            userFriendlyError.message = "La ventana de vinculación fue cerrada antes de completarse.";
        }

        console.error("Error linking account:", authError.code, authError.message);
        return { success: false, error: userFriendlyError };
    }
  }, [currentUser, refreshUserProfile]);
  
  const linkGoogleAccount = () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account', hd: undefined });
    return linkAccount(provider);
  };
  
  const linkFacebookAccount = () => {
    const provider = new FacebookAuthProvider();
    return linkAccount(provider);
  };
  
  const value = useMemo(() => ({
    currentUser,
    userProfile,
    loadingAuth,
    loadingProfile,
    login,
    signupWithGoogle,
    logout,
    sendPasswordReset,
    refreshUserProfile,
    loginWithGoogle,
    linkGoogleAccount,
    linkFacebookAccount,
  }), [currentUser, userProfile, loadingAuth, loadingProfile, login, signupWithGoogle, logout, sendPasswordReset, refreshUserProfile, loginWithGoogle, linkGoogleAccount, linkFacebookAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
