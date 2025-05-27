
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth, db } from "@/lib/firebase"; // Import db
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  UserCredential
} from "firebase/auth";
import type { AuthError } from "firebase/auth"; 
import { useRouter } from "next/navigation";
import type { PlatformUser } from "@/lib/types"; // Import PlatformUser type
import { doc, getDoc } from "firebase/firestore"; // Import Firestore functions

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: PlatformUser | null; // To store user's profile data from Firestore
  loadingAuth: boolean; // For Firebase Auth state
  loadingProfile: boolean; // For loading profile data from Firestore
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
  const [loadingProfile, setLoadingProfile] = useState(true); // Initialize as true
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
      if (user) {
        setLoadingProfile(true); // Start loading profile
        try {
          const userDocRef = doc(db, "platformUsers", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserProfile({ id: userDocSnap.id, ...userDocSnap.data() } as PlatformUser);
          } else {
            console.warn(`No profile found in Firestore for UID: ${user.uid}`);
            setUserProfile(null); // No profile found
            // Potentially logout user or redirect if profile is mandatory after login
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
        } finally {
          setLoadingProfile(false); // Finish loading profile
        }
      } else {
        setUserProfile(null); // No user, so no profile
        setLoadingProfile(false); // Not loading profile if no user
      }
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    // setLoadingAuth(true); // Auth state change will trigger profile loading via useEffect
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      // currentUser and userProfile will be set by onAuthStateChanged listener
      return userCredential;
    } catch (error) {
      console.error("Login error:", error);
      return error as AuthError;
    } finally {
      // setLoadingAuth(false); // Done by onAuthStateChanged
    }
  };

  const signup = async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    // setLoadingAuth(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      return userCredential;
    } catch (error) {
      console.error("Signup error:", error);
      return error as AuthError;
    } finally {
      // setLoadingAuth(false);
    }
  };

  const logout = async () => {
    // setLoadingAuth(true); // onAuthStateChanged will handle this
    try {
      await signOut(auth);
      // currentUser and userProfile will be set to null by onAuthStateChanged listener
      router.push("/login"); 
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // setLoadingAuth(false);
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

  return <AuthContext.Provider value={value}>{!loadingAuth && children}</AuthContext.Provider>;
}
