
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
  handleUserProfileUpdateAfterGoogleLogin: (credential: UserCredential) => Promise<void>;
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
  const [loadingProfile, setLoadingProfile] = useState(true); // Start as true
  
  const router = useRouter(); 

  const fetchUserProfile = useCallback(async (user: FirebaseUser | null) => {
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("AuthContext: onAuthStateChanged triggered. User:", user ? user.uid : null);
      setCurrentUser(user);
      setLoadingAuth(false);
      fetchUserProfile(user);
    });

    return () => {
      console.log("AuthContext: Unsubscribing from onAuthStateChanged");
      unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = useCallback(async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
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

  const loginWithGoogle = useCallback(async (): Promise<UserCredential | AuthError> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const userCredential = await signInWithPopup(auth, provider);
      return userCredential;
    } catch (error) {
      console.error("AuthContext (Google): Login/Signup failed.", error);
      return error as AuthError;
    }
  }, []);

  const handleUserProfileUpdateAfterGoogleLogin = useCallback(async (credential: UserCredential): Promise<void> => {
    const user = credential.user;
    const userEmail = user.email;

    if (!userEmail) {
      throw new Error("El proveedor de Google no proporcionó un email.");
    }
    
    const userDocRefByUid = doc(db, "platformUsers", user.uid);
    const usersRef = collection(db, "platformUsers");
    const q = query(usersRef, where("email", "==", userEmail), limit(1));
    
    const [userDocSnapByUid, preCreatedUserSnap] = await Promise.all([
      getDoc(userDocRefByUid),
      getDocs(q)
    ]);

    if (userDocSnapByUid.exists()) {
      await updateDoc(userDocSnapByUid.ref, { lastLogin: serverTimestamp() });
    } else if (!preCreatedUserSnap.empty) {
      const preCreatedDoc = preCreatedUserSnap.docs[0];
      const preCreatedData = preCreatedDoc.data();
      
      if (preCreatedData.uid && preCreatedData.uid !== null) {
        await signOut(auth);
        throw new Error("Este email ya está asociado a otra cuenta de autenticación.");
      }
      
      const batch = writeBatch(db);
      const finalData = { ...preCreatedData, uid: user.uid, lastLogin: serverTimestamp() };

      batch.set(userDocRefByUid, finalData);
      batch.delete(preCreatedDoc.ref);
      await batch.commit();
    } else {
      const newProfile: Omit<PlatformUser, 'id' | 'lastLogin' | 'businessId'> = {
        uid: user.uid,
        email: user.email || "",
        name: user.displayName || user.email?.split('@')[0] || "Nuevo Usuario",
        roles: ["promoter"],
        dni: "",
      };
      await setDoc(userDocRefByUid, { ...newProfile, lastLogin: serverTimestamp(), businessId: null });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
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
    handleUserProfileUpdateAfterGoogleLogin,
  }), [currentUser, userProfile, loadingAuth, loadingProfile, login, signup, logout, loginWithGoogle, handleUserProfileUpdateAfterGoogleLogin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
