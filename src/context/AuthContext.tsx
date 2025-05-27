
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
  signup: (email: string, pass: string) => Promise<UserCredential | AuthError>; // For Super Admin initial setup
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoadingAuth(false); 

      if (user) {
        setLoadingProfile(true); 
        setUserProfile(null); // Clear previous profile while fetching new one
        try {
          const userDocRef = doc(db, "platformUsers", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const profileData = { id: userDocSnap.id, uid: user.uid, ...userDocSnap.data() } as PlatformUser;
            setUserProfile(profileData);
          } else {
            console.warn(`PROFILE NOT FOUND in Firestore for UID: ${user.uid}. This user might need a profile created in 'platformUsers' collection with their UID and role.`);
            setUserProfile(null); 
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
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
      // Automatically create a profile in Firestore for the new superadmin
      if (userCredential.user) {
        const userDocRef = doc(db, "platformUsers", userCredential.user.uid);
        const newProfile: Omit<PlatformUser, 'id' | 'lastLogin'> & { lastLogin: any } = {
          uid: userCredential.user.uid,
          email: userCredential.user.email || "",
          name: userCredential.user.email?.split('@')[0] || "Super Admin", // Default name
          roles: ['superadmin'],
          dni: "", // DNI is not asked during superadmin signup, can be updated later
          lastLogin: serverTimestamp(),
          // businessId is not applicable for superadmin
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
      // currentUser and userProfile will be set to null by onAuthStateChanged listener
      router.push("/login"); 
    } catch (error) {
      console.error("Logout error:", error);
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

  // Render children only when initial auth check is done.
  // Loading of profile can be handled within specific layouts.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
