
"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Business } from "@/lib/types";

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


export default function LectorQrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, userProfile, loadingAuth, loadingProfile, logout } = useAuth();
  const router = useRouter();
  const [businessDisplayName, setBusinessDisplayName] = useState("SocioVIP Lector QR");

  useEffect(() => {
    const applyBusinessColorsAndName = async () => {
      if (userProfile?.businessId) {
        try {
          const businessDocRef = doc(db, "businesses", userProfile.businessId);
          const businessSnap = await getDoc(businessDocRef);
          if (businessSnap.exists()) {
            const businessData = businessSnap.data() as Business;
            setBusinessDisplayName(businessData.name || `Negocio ID: ...`);
            const primaryHsl = hexToHsl(businessData.primaryColor || '#B080D0');
            const secondaryHsl = hexToHsl(businessData.secondaryColor || '#8E5EA2');
            if (primaryHsl) document.documentElement.style.setProperty('--primary', primaryHsl);
            if (secondaryHsl) document.documentElement.style.setProperty('--accent', secondaryHsl);
          }
        } catch (error) {
          console.error("Failed to load and apply business style:", error);
        }
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
        <p className="ml-4 text-lg text-muted-foreground">Verificando...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle className="text-2xl text-destructive">Error de Perfil</CardTitle></CardHeader>
          <CardContent>
            <CardDescription>No se encontró un perfil para tu cuenta. Contacta al soporte.</CardDescription>
            <Button onClick={() => { logout(); router.push('/login'); }} className="mt-6">Cerrar Sesión</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasAccess = userProfile.roles?.includes('lector_qr') || userProfile.roles?.includes('host') || userProfile.roles?.includes('business_admin') || userProfile.roles?.includes('staff');

  if (!hasAccess || !userProfile.businessId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle className="text-2xl text-destructive">Acceso Denegado</CardTitle></CardHeader>
          <CardContent>
            <CardDescription>
              No tienes los permisos necesarios o tu cuenta no está asociada a un negocio.
            </CardDescription>
            <Button onClick={() => router.push('/')} className="mt-6">Ir a la Página Principal</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-2">
        <div className="flex items-center gap-2">
          <SocioVipLogo className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-semibold text-primary">{businessDisplayName}</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {userProfile?.name || currentUser?.email || "Lector"}
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" title="Cerrar Sesión"><LogOut className="h-4 w-4" /><span className="sr-only">Cerrar Sesión</span></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>¿Cerrar Sesión?</AlertDialogTitle><AlertDialogDescription>¿Estás seguro de que quieres cerrar tu sesión?</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={logout} className="bg-destructive hover:bg-destructive/90">Sí, Cerrar Sesión</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
      <footer className="py-4 px-6 border-t text-center text-xs text-muted-foreground bg-background sm:bg-transparent"><p>&copy; {new Date().getFullYear()} SocioVIP Validador</p></footer>
    </div>
  );
}
