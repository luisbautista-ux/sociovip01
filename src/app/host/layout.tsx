
"use client";

import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { SocioVipLogo } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

export default function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, userProfile, loadingAuth, loadingProfile, logout } = useAuth();
  const router = useRouter();
  
  // Get business name from associated business - requires fetching business details
  // For now, using a placeholder or deriving from user profile if possible.
  const businessDisplayName = userProfile?.businessId ? `Negocio ID: ${userProfile.businessId.substring(0,6)}...` : "SocioVIP Anfitrión";
  const hostUserName = userProfile?.name || currentUser?.email || "Anfitrión";

  useEffect(() => {
    if (!loadingAuth && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, loadingAuth, router]);

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Verificando autenticación...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Redirigiendo a inicio de sesión...</p>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando perfil de usuario...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Error de Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              No se encontró un perfil de usuario en la base de datos para tu cuenta (UID: {currentUser.uid}).
              Asegúrate de que este UID esté correctamente vinculado a un perfil en la colección 'platformUsers'.
            </CardDescription>
            <Button onClick={() => { logout(); router.push('/login'); }} className="mt-6">
              Cerrar Sesión e Ir a Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasAccess = userProfile.roles?.includes('host') || userProfile.roles?.includes('business_admin') || userProfile.roles?.includes('staff');

  if (!userProfile.roles || !Array.isArray(userProfile.roles) || !hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Acceso Denegado</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              No tienes los permisos necesarios para acceder a esta página de validación.
              Roles actuales: {userProfile.roles && Array.isArray(userProfile.roles) ? userProfile.roles.join(', ') : 'Roles no definidos o inválidos'}.
            </CardDescription>
            <Button onClick={() => router.push('/')} className="mt-6">
              Ir a la Página Principal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasAccess && !userProfile.businessId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Configuración Incompleta</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Tu perfil requiere estar asociado a un negocio para validar códigos, pero no se encontró un ID de negocio vinculado. Por favor, contacta al administrador.
            </CardDescription>
            <Button onClick={() => { logout(); router.push('/login'); }} className="mt-6">
              Cerrar Sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleBackToPanel = () => {
    if (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff')) {
      router.push('/business-panel/dashboard');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-2">
        <div className="flex items-center gap-2">
          <SocioVipLogo className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-semibold text-primary">{businessDisplayName}</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {hostUserName}
          </span>
           { (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff')) && (
            <Button onClick={handleBackToPanel} variant="outline" size="sm">Volver al Panel</Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" title="Cerrar Sesión">
                    <LogOut className="h-4 w-4" />
                    <span className="sr-only">Cerrar Sesión</span>
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
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        {children}
      </main>
      <footer className="py-4 px-6 border-t text-center text-xs text-muted-foreground bg-background sm:bg-transparent">
        <p>&copy; {new Date().getFullYear()} SocioVIP Validador</p>
      </footer>
    </div>
  );
}
