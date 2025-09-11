
"use client";

import { BusinessSidebar } from "@/components/business/BusinessSidebar";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Menu, Building, Calendar, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Business } from "@/lib/types";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import NextImage from "next/image";
import { DialogTitle } from "@/components/ui/dialog";

// Helper function to convert hex to HSL string
function hexToHsl(hex: string): string | null {
  if (!hex || !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
    return null;
  }
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  return `${h} ${s}% ${l}%`;
}


export default function BusinessPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, userProfile, loadingAuth, loadingProfile, logout } = useAuth();
  const router = useRouter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const [currentBusinessName, setCurrentBusinessName] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const applyBusinessColorsAndName = async () => {
      if (userProfile?.businessId) {
        try {
          const businessDocRef = doc(db, "businesses", userProfile.businessId);
          const businessSnap = await getDoc(businessDocRef);
          if (businessSnap.exists()) {
            const businessData = businessSnap.data() as Business;
            
            // Set name and logo for display
            setCurrentBusinessName(businessData.name || null);
            setCurrentLogoUrl(businessData.logoUrl || null);
            
            // Set colors for theme
            const primaryHsl = hexToHsl(businessData.primaryColor || '#B080D0');
            const accentHsl = hexToHsl(businessData.secondaryColor || '#8E5EA2');
            
            if (primaryHsl) {
              document.documentElement.style.setProperty('--primary', primaryHsl);
            }
            if (accentHsl) {
              document.documentElement.style.setProperty('--accent', accentHsl); 
            }
          }
        } catch (error) {
          console.error("Failed to load and apply business details:", error);
          setCurrentBusinessName("Panel Negocio");
          setCurrentLogoUrl(null);
        }
      } else {
        setCurrentBusinessName("Panel Negocio");
        setCurrentLogoUrl(null);
      }
    };

    if (!loadingProfile && userProfile) {
      applyBusinessColorsAndName();
    }
    
    return () => {
        document.documentElement.style.removeProperty('--primary');
        document.documentElement.style.removeProperty('--accent');
    };
  }, [userProfile, loadingProfile]);


  useEffect(() => {
    if (!loadingAuth && !currentUser) {
      router.push("/login"); 
    }
  }, [currentUser, loadingAuth, router]);

  if (loadingAuth || loadingProfile) {
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
              Este perfil es necesario para acceder al panel de negocio.
            </CardDescription>
            <Button onClick={() => { logout(); router.push('/login'); }} className="mt-6">
              Cerrar Sesión e Ir a Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!userProfile.roles || !Array.isArray(userProfile.roles) || (!userProfile.roles.includes('business_admin') && !userProfile.roles.includes('staff'))) {
     return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Acceso Denegado</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              No tienes los permisos necesarios para acceder al Panel de Negocio (se requiere rol Admin Negocio o Staff). 
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
  
  const requiresBusinessId = userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff');
  if (requiresBusinessId && !userProfile.businessId) {
    return (
       <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Configuración Incompleta</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Tu perfil de usuario ({userProfile.roles.join(', ')}) requiere estar asociado a un negocio, pero no se encontró un ID de negocio vinculado. Por favor, contacta al Super Administrador.
            </CardDescription>
            <Button onClick={() => { logout(); router.push('/login'); }} className="mt-6">
              Cerrar Sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const navLinks = [
    { href: "/business-panel/dashboard", label: "Dashboard" },
    { href: "/business-panel/promotions", label: "Promociones" },
    { href: "/business-panel/events", label: "Eventos" },
    { href: "/business-panel/clients", label: "Mis Clientes" },
    { href: "/business-panel/surveys", label: "Encuestas" },
    { href: "/business-panel/promoters", label: "Mis Promotores" },
    { href: "/business-panel/staff", label: "Mi Personal" },
    { href: "/business-panel/analytics", label: "Analíticas" },
    { href: "/business-panel/settings", label: "Configuración" },
    { href: "/business-panel/validate-qr", label: "Validar QR" },
  ];

  return (
    <div className="flex min-h-screen bg-muted/40">
      <div className="hidden md:flex">
        <BusinessSidebar />
      </div>
      <div className="flex flex-col flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-2">
          <div className="md:hidden">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="outline">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-card flex flex-col">
                <DialogTitle className="sr-only">Menú de Navegación del Panel de Negocio</DialogTitle>
                <div className="p-4 border-b border-border flex items-center space-x-2">
                   {currentLogoUrl ? (
                    <NextImage src={currentLogoUrl} alt={`${currentBusinessName || 'Negocio'} Logo`} width={28} height={28} className="h-7 w-7 object-contain rounded-sm" />
                   ) : (
                    <Building className="h-7 w-7 text-primary" />
                   )}
                  <h1 className="text-lg font-semibold text-primary">{currentBusinessName || 'Panel Negocio'}</h1>
                </div>
                <nav className="flex-grow p-4 space-y-2">
                  {navLinks.map(link => (
                    <Link 
                      key={link.href}
                      href={link.href} 
                      onClick={() => setIsSheetOpen(false)} 
                      className="flex items-center space-x-2 text-muted-foreground hover:text-foreground"
                    >
                      {link.label === 'Promociones' ? <Ticket size={16} /> : link.label === 'Eventos' ? <Calendar size={16} /> : null}
                      <span>{link.label}</span>
                    </Link>
                  ))}
                </nav>
                 <div className="p-4 border-t border-border mt-auto">
                    <Button onClick={() => { logout(); setIsSheetOpen(false); }} variant="outline" className="w-full">Cerrar Sesión</Button>
                 </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex-grow">
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
