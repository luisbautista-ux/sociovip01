
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { LoginModal } from "@/components/auth/LoginModal";
import { LogOut, UserCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function PublicHeaderAuth() {
  const { currentUser, userProfile, logout, loadingAuth, loadingProfile } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  if (loadingAuth || loadingProfile) {
    return (
      <div className="flex items-center justify-end h-10">
        <div className="h-6 w-24 bg-muted/50 animate-pulse rounded-md"></div>
      </div>
    ); // Placeholder for loading state
  }

  return (
    <div className="flex items-center justify-end space-x-3">
      {currentUser && userProfile ? (
        <>
          <span className="text-sm text-foreground hidden sm:inline-flex items-center">
            <UserCircle className="h-4 w-4 mr-1.5 text-muted-foreground" />
            Hola, {userProfile.name || currentUser.email?.split('@')[0]}
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-0 sm:mr-2" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar Sesión?</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Estás seguro de que quieres cerrar tu sesión?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={logout} className="bg-destructive hover:bg-destructive/90">
                  Sí, Cerrar Sesión
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <>
          <Button variant="outline" size="sm" onClick={() => setShowLoginModal(true)}>
            Iniciar Sesión
          </Button>
          {/* Consider adding a separate "Register" button if needed, or link from modal */}
        </>
      )}
      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  );
}
