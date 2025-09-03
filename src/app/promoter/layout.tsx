
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart2, Gift, DollarSign, Menu, UserCircle, LogOut } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import React, { useEffect, useState } from "react"; // Added useState
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet"; // Added SheetClose
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

const navItems = [
  { href: "/promoter/dashboard", label: "Dashboard", icon: BarChart2 },
  { href: "/promoter/entities", label: "Promociones y Eventos", icon: Gift },
  { href: "/promoter/commissions", label: "Mis Comisiones", icon: DollarSign },
  { href: "/promoter/profile", label: "Mi Perfil", icon: UserCircle },
];

function PromoterSidebarNavContent({ closeSheet, promoterName }: { closeSheet?: () => void; promoterName?: string }) {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <>
      <div className="p-4 border-b border-border flex items-center space-x-2">
        <UserCircle className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-md font-semibold text-primary">Panel Promotor</h1>
          {promoterName && <p className="text-xs text-muted-foreground">{promoterName}</p>}
        </div>
      </div>
      <nav className="flex-grow p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
              pathname.startsWith(item.href) ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
            onClick={closeSheet}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border mt-auto space-y-2">
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

function PromoterSidebar({ promoterName }: { promoterName?: string }) {
  return (
    <aside className="w-60 h-screen bg-card text-card-foreground border-r border-border flex flex-col sticky top-0">
      <PromoterSidebarNavContent promoterName={promoterName} />
    </aside>
  );
}

export default function PromoterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, userProfile, loadingAuth, loadingProfile, logout } = useAuth();
  const router = useRouter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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
  
  const promoterDisplayName = userProfile?.name || currentUser?.email || "Promotor";

  return (
    <div className="flex min-h-screen bg-muted/40">
      <div className="hidden md:flex">
        <PromoterSidebar promoterName={promoterDisplayName} />
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
              <SheetContent side="left" className="p-0 w-64 bg-card flex flex-col"> {/* Increased width for SheetContent */}
                <PromoterSidebarNavContent promoterName={promoterDisplayName} closeSheet={() => setIsSheetOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex items-center gap-2">
            <SocioVipLogo className="h-7 w-7 text-primary md:hidden" /> {/* Hide on md and up as it's in sidebar */}
            <h1 className="text-xl font-semibold text-primary hidden md:block">Panel Promotor</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {promoterDisplayName}
            </span>
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
                        ¿Estás seguro de que quieres cerrar tu sesión de Promotor?
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
          <p>&copy; {new Date().getFullYear()} SocioVIP Promotor Panel</p>
        </footer>
      </div>
    </div>
  );
}
