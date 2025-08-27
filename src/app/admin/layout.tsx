
"use client"; 

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, userProfile, loadingAuth, loadingProfile, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // This useEffect is primarily for redirecting if currentUser is not available after auth check.
    // Further role-based protection is handled in the return statement.
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
    // This state is briefly shown if the useEffect redirect hasn't kicked in yet.
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
         <p className="text-lg text-muted-foreground">Redirigiendo a inicio de sesión...</p>
      </div>
    );
  }

  // At this point, currentUser exists. Now check for profile loading.
  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando perfil de usuario...</p>
      </div>
    );
  }

  // Profile loading is complete. Check if userProfile exists.
  if (!userProfile) {
    // Profile not found in Firestore for this authenticated user.
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
  
  // At this point, userProfile exists. Now check for specific roles.
  if (!userProfile.roles || !Array.isArray(userProfile.roles) || !userProfile.roles.includes('superadmin')) {
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

  // All checks passed, render the admin layout.
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
