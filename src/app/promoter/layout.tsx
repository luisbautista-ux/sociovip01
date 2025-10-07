
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart2, Gift, HandCoins, Menu, UserCircle, LogOut } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DialogTitle } from "@/components/ui/dialog";

const navItems = [
  { href: "/promoter/dashboard", label: "Dashboard", icon: BarChart2 },
  { href: "/promoter/entities", label: "Campañas", icon: Gift },
  { href: "/promoter/commissions", label: "Comisiones", icon: HandCoins },
  { href: "/promoter/profile", label: "Mi Perfil", icon: UserCircle },
];

function PromoterSidebarNavContent({ closeSheet, promoterName, promoterEmail, promoterPhotoUrl }: { closeSheet?: () => void; promoterName?: string, promoterEmail?: string, promoterPhotoUrl?: string | null }) {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <>
      <div className="p-4 border-b border-border flex items-center space-x-3">
        <Avatar className="h-10 w-10">
            <AvatarImage src={promoterPhotoUrl || undefined} alt={promoterName || 'Promotor'} />
            <AvatarFallback>{promoterName ? promoterName.charAt(0).toUpperCase() : 'P'}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-md font-semibold text-gradient">{promoterName || 'Panel Promotor'}</h1>
          {promoterEmail && <p className="text-xs text-muted-foreground truncate">{promoterEmail}</p>}
        </div>
      </div>
      <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeSheet}
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
              pathname.startsWith(item.href) ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border mt-auto space-y-2">
        {useAuth().currentUser && (
          <p className="text-xs text-muted-foreground truncate" title={useAuth().currentUser?.email || undefined}>
            Logueado como: {useAuth().currentUser?.email}
          </p>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cerrar Sesión?</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres cerrar tu sesión de Promotor?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { logout(); if(closeSheet) closeSheet(); }} className="bg-destructive hover:bg-destructive/90">
                Sí, Cerrar Sesión
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="text-xs text-muted-foreground text-center">© {new Date().getFullYear()} SocioVIP Promotor</p>
      </div>
    </>
  );
}

function PromoterSidebar({ promoterName, promoterEmail, promoterPhotoUrl }: { promoterName?: string; promoterEmail?: string; promoterPhotoUrl?: string | null }) {
  return (
    <aside className="w-64 h-screen bg-card text-card-foreground border-r border-border flex flex-col sticky top-0">
      <PromoterSidebarNavContent promoterName={promoterName} promoterEmail={promoterEmail} promoterPhotoUrl={promoterPhotoUrl} />
    </aside>
  );
}


function PromoterBottomNav() {
  const pathname = usePathname();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg md:hidden">
  <nav className="flex items-center justify-around h-16 w-full max-w-full overflow-hidden">
    {navItems.map((item) => {
      const isActive = pathname.startsWith(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex flex-col items-center justify-center text-xs font-medium w-full h-full transition-colors",
            isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
          )}
        >
          <item.icon className="h-5 w-5 mb-0.5" />
          <span>{item.label}</span>
        </Link>
      );
    })}
  </nav>
</footer>
  );
}


export default function PromoterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, userProfile, loadingAuth, loadingProfile, logout } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!loadingAuth && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, loadingAuth, router]);

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-loader">
        <Loader2 className="h-12 w-12 animate-spin text-white" />
        <p className="ml-4 text-lg text-white/90">Verificando autenticación...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-loader">
        <p className="text-lg text-white/90">Redirigiendo a inicio de sesión...</p>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-loader">
        <Loader2 className="h-12 w-12 animate-spin text-white" />
        <p className="ml-4 text-lg text-white/90">Cargando perfil de usuario...</p>
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
            </CardDescription>
            <Button onClick={() => { logout(); router.push('/login'); }} className="mt-6">
              Cerrar Sesión e Ir a Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userProfile.roles || !Array.isArray(userProfile.roles) || !userProfile.roles.includes('promoter')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Acceso Denegado</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              No tienes los permisos necesarios para acceder al Panel de Promotor.
            </CardDescription>
            <Button onClick={() => router.push('/')} variant="gradient">
              Ir a la Página Principal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getShortName = (fullName: string | undefined | null) => {
    if (!fullName) return "Promotor";
    const parts = fullName.split(' ');
    if (parts.length > 2) return `${parts[0]} ${parts[2]}`;
    return fullName;
  };

  const promoterDisplayNameDesktop = getShortName(userProfile?.name);
  const promoterDisplayNameMobile = userProfile?.name || "Promotor";
  const promoterDisplayEmail = currentUser?.email || "";
  const promoterPhotoUrl = userProfile?.photoURL;

  return (
    <div className="flex min-h-dvh bg-muted/40">
      {/* Sidebar Desktop */}
      <div className="hidden md:flex md:sticky md:top-0 md:h-screen">
        <PromoterSidebar
          promoterName={promoterDisplayNameDesktop}
          promoterEmail={promoterDisplayEmail}
          promoterPhotoUrl={promoterPhotoUrl}
        />
      </div>

      {/* Contenedor principal que se flexiona */}
      <div className="flex flex-col flex-1 h-dvh">
        
        {/* Header Móvil */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 md:hidden shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={promoterPhotoUrl || undefined} alt={promoterDisplayNameMobile} />
              <AvatarFallback>{promoterDisplayNameMobile ? promoterDisplayNameMobile.charAt(0).toUpperCase() : 'P'}</AvatarFallback>
            </Avatar>
            <h1 className="font-semibold text-lg text-gradient">{promoterDisplayNameMobile}</h1>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" title="Cerrar Sesión">
                <LogOut className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar Sesión?</AlertDialogTitle>
                <AlertDialogDescription>¿Estás seguro de que quieres cerrar tu sesión?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={logout} className="bg-destructive hover:bg-destructive/90">
                  Sí, Cerrar Sesión
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </header>

        {/* Contenido principal con scroll */}
        <main className="flex-1 w-full overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6">
          {children}
        </main>

        {/* Footer Móvil fijo */}
        <PromoterBottomNav />
      </div>
    </div>
  );
}
