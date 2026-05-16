
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building, Users, BarChart3, ListChecks, Star, LogOut, Settings, Cog } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
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
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/businesses", label: "Negocios", icon: Building },
  { href: "/admin/users", label: "Usuarios Plataforma", icon: Users },
  { href: "/admin/socios-vip", label: "Socios VIP", icon: Star },
  { href: "/admin/clients", label: "Clientes QR", icon: ListChecks },
  { href: "/admin/analytics", label: "Analíticas", icon: BarChart3 },
  { href: "/admin/platform-config", label: "Config. Plataforma", icon: Cog },
  { href: "/admin/settings", label: "Mi Perfil", icon: Settings },
];

interface AdminSidebarProps {
  closeSheet?: () => void;
}

export function AdminSidebar({ closeSheet }: AdminSidebarProps) {
  const pathname = usePathname();
  const { logout, currentUser } = useAuth();

  const handleLinkClick = () => {
    if (closeSheet) {
      closeSheet();
    }
  };

  return (
    <aside className="w-full h-full bg-card text-card-foreground flex flex-col">
      <div className="p-5 border-b border-border flex justify-center overflow-hidden bg-white/50">
        <SocioVipLogo size={180} variant="pill" pillPadding="py-0 px-[1.5%]" className="!aspect-[1.6/1] !h-auto object-fill drop-shadow-lg" />
      </div>
      <nav className="flex-grow p-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={handleLinkClick}
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-secondary hover:text-secondary-foreground transition-colors",
              pathname.startsWith(item.href) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border space-y-2 mt-auto">
        {currentUser && (
          <p className="text-xs text-muted-foreground truncate" title={currentUser.email || undefined}>
            Logueado como: {currentUser.email}
          </p>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/5">
              <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cerrar Sesión?</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres cerrar tu sesión de Super Administrador?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { logout(); handleLinkClick(); }} className="bg-destructive hover:bg-destructive/90">
                Sí, Cerrar Sesión
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="text-xs text-muted-foreground text-center mt-2">© {new Date().getFullYear()} SocioVIP <span className="text-primary font-bold">SuperAdmin</span></p>
      </div>
    </aside>
  );
}
