
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Ticket,
  Calendar,
  ClipboardList,
  Users,
  UserPlus,
  BarChart3,
  Settings,
  Building,
  Contact,
  LogOut, // Import LogOut
} from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { Button } from "@/components/ui/button"; // Import Button
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
} from "@/components/ui/alert-dialog"; // Import AlertDialog components

const navItems = [
  { href: "/business-panel/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/business-panel/promotions", label: "Promociones", icon: Ticket },
  { href: "/business-panel/events", label: "Eventos", icon: Calendar },
  { href: "/business-panel/clients", label: "Mis Clientes", icon: Contact },
  { href: "/business-panel/surveys", label: "Encuestas", icon: ClipboardList },
  { href: "/business-panel/promoters", label: "Mis Promotores", icon: UserPlus },
  { href: "/business-panel/staff", label: "Mi Personal", icon: Users },
  { href: "/business-panel/analytics", label: "Analíticas", icon: BarChart3 },
  { href: "/business-panel/settings", label: "Configuración", icon: Settings },
];

export function BusinessSidebar() {
  const pathname = usePathname();
  const { currentUser, userProfile, logout } = useAuth(); // Get user and logout

  // Display user's name from profile, or email as fallback
  const displayName = userProfile?.name || currentUser?.email || "Usuario";
  // For business name, ideally fetch it based on userProfile.businessId.
  // For now, let's use a placeholder or the user's name if they are business_admin.
  const businessDisplayName = userProfile?.roles.includes('business_admin') ? displayName : "Panel Negocio";


  return (
    <aside className="w-64 h-screen bg-card text-card-foreground border-r border-border flex flex-col sticky top-0">
      <div className="p-4 border-b border-border flex items-center space-x-2">
        <Building className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-primary">Panel Negocio</h1>
          {userProfile?.businessId && <p className="text-xs text-muted-foreground">ID Negocio: {userProfile.businessId.substring(0,6)}...</p>}
        </div>
      </div>
      <nav className="flex-grow p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
              pathname.startsWith(item.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border space-y-2">
        {userProfile && (
          <div className="mb-2">
            <p className="text-xs text-muted-foreground">Usuario:</p>
            <p className="text-sm font-medium text-foreground truncate" title={userProfile.name || currentUser?.email || undefined}>
              {userProfile.name || currentUser?.email}
            </p>
            <p className="text-xs text-muted-foreground">
              Rol: {userProfile.roles.map(r => r.replace('_', ' ')).join(', ')}
            </p>
          </div>
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
              <AlertDialogAction onClick={logout} className="bg-destructive hover:bg-destructive/90">
                Sí, Cerrar Sesión
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="text-xs text-muted-foreground text-center mt-2">
          © {new Date().getFullYear()} SocioVIP
        </p>
      </div>
    </aside>
  );
}
