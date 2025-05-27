
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
import type { PlatformUser } from "@/lib/types"; 
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"; 

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: PlatformUser | null; 
  loadingAuth: boolean; 
  loadingProfile: boolean; 
  login: (email: string, pass: string) => Promise<UserCredential | AuthError>;
  signup: (email: string, pass: string) => Promise<UserCredential | AuthError>;
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
  const [hasMounted, setHasMounted] = useState(false); // State to track client-side mount
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true); // Component has mounted on the client
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoadingAuth(false); 

      if (user) {
        setLoadingProfile(true); 
        setUserProfile(null); 
        try {
          const userDocRef = doc(db, "platformUsers", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          console.log("AuthContext: User UID from Auth:", user.uid); 
          if (userDocSnap.exists()) {
            const profileDataFromDb = userDocSnap.data();
            console.log("AuthContext: Profile data fetched from Firestore:", profileDataFromDb);
            
            let rolesArray: PlatformUser['roles'] = [];
            if (profileDataFromDb.roles && Array.isArray(profileDataFromDb.roles)) {
              rolesArray = profileDataFromDb.roles;
            } else if (profileDataFromDb.role && typeof profileDataFromDb.role === 'string') {
              // Fallback for older data structure if 'role' was a string
              rolesArray = [profileDataFromDb.role as PlatformUser['roles'][0]];
            } else {
              console.warn(`AuthContext: User profile for UID ${user.uid} has missing or invalid 'roles' field. Defaulting to empty roles.`);
            }

            const profileData = { 
                id: userDocSnap.id, 
                uid: user.uid, 
                roles: rolesArray,
                ...profileDataFromDb 
            } as PlatformUser;
            setUserProfile(profileData);
          } else {
            console.warn(`AuthContext: PROFILE NOT FOUND in Firestore for UID: ${user.uid}. This user might need a profile created in 'platformUsers' collection with their UID and roles.`);
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
    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      return userCredential;
    } catch (error) {
      return error as AuthError;
    }
  };

  const signup = async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        const userDocRef = doc(db, "platformUsers", userCredential.user.uid);
        const newProfile: Omit<PlatformUser, 'id' | 'lastLogin'> & { lastLogin: any } = {
          uid: userCredential.user.uid,
          email: userCredential.user.email || "",
          name: userCredential.user.email?.split('@')[0] || "Super Admin",
          roles: ['superadmin'],
          dni: "", 
          businessId: null,
          lastLogin: serverTimestamp(),
        };
        await setDoc(userDocRef, newProfile);
      }
      return userCredential;
    } catch (error) {
      return error as AuthError;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      router.push("/login"); 
    } catch (error) {
      console.error("AuthContext: Logout error:", error);
    }
  };

  const value = {
    currentUser,
    userProfile,
    loadingAuth,
    loadingProfile,
    login,
    signup,
    logout,
  };

  if (!hasMounted) {
    return null; // Or a global loading spinner
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
