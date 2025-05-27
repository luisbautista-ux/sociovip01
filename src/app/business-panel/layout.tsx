
"use client";

import { BusinessSidebar } from "@/components/business/BusinessSidebar";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BusinessPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, userProfile, loadingAuth, loadingProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loadingAuth && !currentUser) {
      router.push("/login"); // Or a specific business login page
    }
  }, [currentUser, loadingAuth, router]);

  if (loadingAuth || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando panel de negocio...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
         <p className="text-lg text-muted-foreground">Redirigiendo...</p>
      </div>
    );
  }
  
  if (!userProfile || !userProfile.roles || (!userProfile.roles.includes('business_admin') && !userProfile.roles.includes('staff'))) {
     return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Acceso Denegado</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              No tienes los permisos necesarios para acceder al Panel de Negocio (Admin Negocio o Staff).
            </CardDescription>
            <Button onClick={() => router.push('/')} className="mt-6">
              Ir a la Página Principal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // TODO: Pass userProfile.businessId to children or make it available via context for business panel pages
  // For now, pages will continue to use MOCK_BUSINESS_ID for Firestore queries

  return (
    <div className="flex min-h-screen bg-background">
      <BusinessSidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
