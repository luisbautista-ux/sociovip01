
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AuthDispatcherPage() {
  const { currentUser, userProfile, loadingAuth, loadingProfile, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (loadingAuth || loadingProfile) {
      // Aún cargando la autenticación o el perfil, esperamos.
      return;
    }

    if (!currentUser) {
      // No hay usuario autenticado, redirigir a login.
      // Esto puede ocurrir si se accede a esta página directamente sin estar logueado.
      console.log("AuthDispatcher: No currentUser, redirecting to /login");
      router.replace("/login");
      return;
    }

    if (!userProfile) {
      // Usuario autenticado pero no se encontró perfil en Firestore.
      console.error("AuthDispatcher: currentUser exists, but no userProfile found. Logging out and redirecting to /login. UID:", currentUser.uid);
      toast({
        title: "Error de Perfil",
        description: "No se encontró un perfil de usuario para tu cuenta. Por favor, contacta al soporte.",
        variant: "destructive",
        duration: 7000,
      });
      logout().finally(() => router.replace("/login")); // Asegurarse de redirigir después del logout
      return;
    }

    // Usuario y perfil cargados, procedemos a la redirección basada en roles.
    console.log("AuthDispatcher: UserProfile loaded, roles:", userProfile.roles);
    if (userProfile.roles && Array.isArray(userProfile.roles)) {
      if (userProfile.roles.includes('superadmin')) {
        console.log("AuthDispatcher: Redirecting superadmin to /admin/dashboard");
        router.replace("/admin/dashboard");
      } else if (userProfile.roles.includes('business_admin')) {
        console.log("AuthDispatcher: Redirecting business_admin to /business-panel/dashboard");
        router.replace("/business-panel/dashboard");
      } else if (userProfile.roles.includes('staff')) {
        console.log("AuthDispatcher: Redirecting staff to /business-panel/dashboard");
        router.replace("/business-panel/dashboard");
      } else if (userProfile.roles.includes('promoter')) {
        console.log("AuthDispatcher: Redirecting promoter to /promoter/dashboard");
        router.replace("/promoter/dashboard");
      } else if (userProfile.roles.includes('host') || userProfile.roles.includes('lector_qr')) {
        // --- CORRECTED LOGIC --- Both host and lector_qr redirect to the same place.
        console.log("AuthDispatcher: Redirecting host/lector_qr to /lector-qr/validate");
        router.replace("/lector-qr/validate");
      } else {
        // Rol no reconocido o sin roles asignados que tengan un dashboard específico.
        console.warn("AuthDispatcher: User has roles but none match a specific dashboard. Roles:", userProfile.roles, "Redirecting to /");
        toast({
          title: "Redirección Fallida",
          description: "No se pudo determinar tu panel de control. Contacta al soporte si esto es un error.",
          variant: "destructive",
        });
        router.replace("/");
      }
    } else {
      // userProfile.roles no es un array o no está definido, lo cual es un error de datos.
      console.error("AuthDispatcher: UserProfile.roles is invalid or missing. Logging out. Profile:", userProfile);
      toast({
        title: "Error de Perfil",
        description: "Tu perfil de usuario no tiene roles asignados correctamente. Contacta al soporte.",
        variant: "destructive",
        duration: 7000,
      });
      logout().finally(() => router.replace("/login"));
    }
  }, [currentUser, userProfile, loadingAuth, loadingProfile, router, toast, logout]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
      <p className="mt-6 text-xl text-muted-foreground">Verificando y redirigiendo...</p>
      <p className="mt-2 text-sm text-muted-foreground">Serás dirigido a tu panel en unos momentos.</p>
    </div>
  );
}
