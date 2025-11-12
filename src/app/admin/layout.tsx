
"use client"; 

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Loader2, Menu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DialogTitle } from "@/components/ui/dialog";
import { SocioVipLogo } from "@/components/icons";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, userProfile, loadingAuth, logout } = useAuth();
  const router = useRouter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    if (!loadingAuth && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, loadingAuth, router]);

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-loader">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative p-1 rounded-full shadow-lg bg-white/90">
              <SocioVipLogo size={80} className="animate-pulse" />
          </div>
          <p className="mt-4 text-lg text-white/90">Verificando y cargando...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null; // The useEffect above is handling the redirect
  }
  
  if (!userProfile && !loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Error de Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              No se encontró un perfil de usuario en la base de datos para tu cuenta de autenticación (UID: {currentUser.uid}).
              Asegúrate de que este UID esté correctamente vinculado a un perfil en la colección 'platformUsers' y que dicho perfil tenga un campo 'roles' (array de strings).
            </CardDescription>
            <Button onClick={() => { logout(); router.push('/login'); }} variant="gradient" className="mt-6">
              Cerrar Sesión e Ir a Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (userProfile && (!userProfile.roles || !Array.isArray(userProfile.roles) || !userProfile.roles.includes('superadmin'))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Acceso Denegado</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              No tienes los permisos necesarios (Super Administrador) para acceder a esta sección. 
              Roles actuales: {userProfile.roles && Array.isArray(userProfile.roles) ? userProfile.roles.join(', ') : 'Roles no definidos o inválidos'}.
              Si crees que esto es un error, por favor contacta al soporte.
            </CardDescription>
            <Button onClick={() => router.push('/')} variant="gradient" className="mt-6">
              Ir a la Página Principal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <div className="hidden md:flex md:sticky md:top-0 md:h-screen">
        <AdminSidebar />
      </div>
      <div className="flex flex-col flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-2 md:hidden">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="outline">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Abrir menú</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-card flex flex-col">
                 <DialogTitle className="sr-only">Menú de Navegación del Panel de Super Administrador</DialogTitle>
                 <AdminSidebar closeSheet={() => setIsSheetOpen(false)} />
              </SheetContent>
            </Sheet>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
