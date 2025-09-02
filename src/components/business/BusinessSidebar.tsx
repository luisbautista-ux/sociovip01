
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import NextImage from "next/image"; // Import NextImage
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
  LogOut,
  QrCode,
} from "lucide-react";
// SocioVipLogo is not used here, Building icon or Business Logo is used.
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
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Business } from "@/lib/types";

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
  { href: "/host/validate", label: "Validar QR", icon: QrCode }, 
];

export function BusinessSidebar() {
  const pathname = usePathname();
  const { currentUser, userProfile, logout } = useAuth(); 
  
  const [currentBusinessName, setCurrentBusinessName] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchBusinessDetails = async () => {
      if (userProfile?.businessId) {
        try {
          const businessDocRef = doc(db, "businesses", userProfile.businessId);
          const businessSnap = await getDoc(businessDocRef);
          if (businessSnap.exists()) {
            const businessData = businessSnap.data() as Business;
            setCurrentBusinessName(businessData.name);
            setCurrentLogoUrl(businessData.logoUrl || null);
          } else {
            console.warn(`Business details not found for ID: ${userProfile.businessId}`);
            setCurrentBusinessName("Panel Negocio"); // Fallback
            setCurrentLogoUrl(null);
          }
        } catch (error) {
          console.error("Error fetching business details for sidebar:", error);
          setCurrentBusinessName("Panel Negocio"); // Fallback
          setCurrentLogoUrl(null);
        }
      } else {
        setCurrentBusinessName("Panel Negocio"); // Default if no businessId
        setCurrentLogoUrl(null);
      }
    };

    if (userProfile) { // Only fetch if userProfile is available
      fetchBusinessDetails();
    }
  }, [userProfile]);


  const displayName = userProfile?.name || currentUser?.email || "Usuario";
  const businessDisplay = currentBusinessName || (userProfile?.businessId ? `Negocio ID: ${userProfile.businessId.substring(0,6)}...` : "Panel Negocio");


  return (
    <aside className="w-64 h-screen bg-card text-card-foreground border-r border-border flex flex-col sticky top-0">
      <div className="p-4 border-b border-border flex items-center space-x-2">
        {currentLogoUrl ? (
          <NextImage src={currentLogoUrl} alt={`${businessDisplay} Logo`} width={32} height={32} className="h-8 w-8 object-contain rounded-sm" data-ai-hint="logo"/>
        ) : (
          <Building className="h-8 w-8 text-primary" />
        )}
        <div>
          <h1 className="text-lg font-semibold text-primary leading-tight">{businessDisplay}</h1>
          {userProfile?.businessId && !currentBusinessName && <p className="text-xs text-muted-foreground">ID: {userProfile.businessId.substring(0,6)}...</p>}
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
            <p className="text-sm font-medium text-foreground truncate" title={displayName}>
              {displayName}
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
