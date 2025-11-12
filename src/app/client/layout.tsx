
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart2, QrCode, UserCircle, LogOut, Menu } from "lucide-react";
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
  { href: "/client/dashboard", label: "Mi QR y Negocios", icon: QrCode },
  { href: "/client/profile", label: "Mi Perfil", icon: UserCircle },
];

function ClientSidebarNavContent({ closeSheet, userName, userEmail, userPhotoUrl }: { closeSheet?: () => void; userName?: string, userEmail?: string, userPhotoUrl?: string | null }) {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <>
      <div className="p-4 border-b border-border flex items-center space-x-3">
        <Avatar className="h-10 w-10">
            <AvatarImage src={userPhotoUrl || undefined} alt={userName || 'Usuario'} />
            <AvatarFallback>{userName ? userName.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-md font-semibold text-gradient">{userName || 'Panel Cliente'}</h1>
          {userEmail && <p className="text-xs text-muted-foreground truncate">{userEmail}</p>}
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
                ¿Estás seguro de que quieres cerrar tu sesión?
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
        <p className="text-xs text-muted-foreground text-center">© {new Date().getFullYear()} SocioVIP</p>
      </div>
    </>
  );
}


function ClientSidebar({ userName, userEmail, userPhotoUrl }: { userName?: string; userEmail?: string; userPhotoUrl?: string | null }) {
  return (
    <aside className="w-64 h-screen bg-card text-card-foreground border-r border-border flex flex-col sticky top-0">
      <ClientSidebarNavContent userName={userName} userEmail={userEmail} userPhotoUrl={userPhotoUrl} />
    </aside>
  );
}

function ClientBottomNav() {
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


export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, userProfile, loadingAuth, loadingProfile, logout } = useAuth();
  const router = useRouter();

  // This effect handles redirection based on auth state
  useEffect(() => {
    // Only redirect if authentication is no longer loading and there is no user
    if (!loadingAuth && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, loadingAuth, router]);

  // This displays a loading screen while auth or profile data is being fetched.
  if (loadingAuth || (currentUser && loadingProfile)) {
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

  // If loading is finished and there's still no user, we show a redirection message
  if (!currentUser) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-loader">
            <div className="flex flex-col items-center justify-center text-center">
                <div className="relative p-1 rounded-full shadow-lg bg-white/90">
                    <SocioVipLogo size={80} className="animate-pulse" />
                </div>
                <p className="mt-4 text-lg text-white/90">Redirigiendo a inicio de sesión...</p>
            </div>
        </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle className="text-2xl text-destructive">Error de Perfil</CardTitle></CardHeader>
          <CardContent>
            <CardDescription>No se encontró un perfil de usuario para tu cuenta.</CardDescription>
            <Button onClick={() => { logout(); router.push('/login'); }} className="mt-6">Cerrar Sesión</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!userProfile.roles.includes('client_gratis') && !userProfile.roles.includes('vip_premium')) {
     return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle className="text-2xl text-destructive">Acceso Denegado</CardTitle></CardHeader>
          <CardContent>
            <CardDescription>No tienes los permisos necesarios para acceder a este panel.</CardDescription>
            <Button onClick={() => router.push('/')} variant="gradient">Ir a la Página Principal</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const userName = userProfile?.name || "Cliente";
  const userEmail = currentUser?.email || "";
  const userPhotoUrl = userProfile?.photoURL || null;

  return (
    <div className="flex min-h-dvh bg-muted/40">
      {/* Sidebar Desktop */}
      <div className="hidden md:flex md:sticky md:top-0 md:h-screen">
        <ClientSidebar
          userName={userName}
          userEmail={userEmail}
          userPhotoUrl={userPhotoUrl}
        />
      </div>

      {/* Contenedor principal */}
      <div className="flex flex-col flex-1 h-dvh">
        {/* Header Móvil */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 md:hidden shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={userPhotoUrl || undefined} alt={userName} />
              <AvatarFallback>{userName ? userName.charAt(0).toUpperCase() : 'C'}</AvatarFallback>
            </Avatar>
            <h1 className="font-semibold text-lg text-gradient">{userName}</h1>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" title="Cerrar Sesión"><LogOut className="h-4 w-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>¿Cerrar Sesión?</AlertDialogTitle><AlertDialogDescription>¿Estás seguro de que quieres cerrar tu sesión?</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={logout} className="bg-destructive hover:bg-destructive/90">Sí, Cerrar Sesión</AlertDialogAction>
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
// Renombramos el componente de navegación inferior para evitar conflictos
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
