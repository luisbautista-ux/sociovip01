
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth } from "@/lib/firebase";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  UserCredential
} from "firebase/auth";
import type { AuthProvider as FirebaseAuthProvider, AuthError } from "firebase/auth"; // For type safety
import { useRouter } from "next/navigation";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loadingAuth: boolean;
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
  const [loadingAuth, setLoadingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
    });
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const login = async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    setLoadingAuth(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      setCurrentUser(userCredential.user);
      return userCredential;
    } catch (error) {
      console.error("Login error:", error);
      return error as AuthError;
    } finally {
      setLoadingAuth(false);
    }
  };

  const signup = async (email: string, pass: string): Promise<UserCredential | AuthError> => {
    setLoadingAuth(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      // Optionally set currentUser here if you want to auto-login after signup
      // setCurrentUser(userCredential.user); 
      return userCredential;
    } catch (error) {
      console.error("Signup error:", error);
      return error as AuthError;
    } finally {
      setLoadingAuth(false);
    }
  };

  const logout = async () => {
    setLoadingAuth(true);
    try {
      await signOut(auth);
      setCurrentUser(null);
      router.push("/login"); // Redirect to login after logout
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoadingAuth(false);
    }
  };

  const value = {
    currentUser,
    loadingAuth,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
