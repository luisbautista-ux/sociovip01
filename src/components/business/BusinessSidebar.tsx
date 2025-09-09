
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NextImage from "next/image";
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
  PanelLeft,
} from "lucide-react";
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
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


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
  { href: "/business-panel/validate-qr", label: "Validar QR", icon: QrCode },
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
            setCurrentBusinessName("Panel Negocio");
            setCurrentLogoUrl(null);
          }
        } catch (error) {
          setCurrentBusinessName("Panel Negocio");
          setCurrentLogoUrl(null);
        }
      } else {
        setCurrentBusinessName("Panel Negocio");
        setCurrentLogoUrl(null);
      }
    };

    if (userProfile) {
      fetchBusinessDetails();
    }
  }, [userProfile]);

  const displayName = userProfile?.name || currentUser?.email || "Usuario";
  const businessDisplay = currentBusinessName || "Panel Negocio";

  return (
    <>
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            {currentLogoUrl ? (
              <NextImage src={currentLogoUrl} alt={`${businessDisplay} Logo`} width={32} height={32} className="size-8 object-contain rounded-sm" data-ai-hint="logo"/>
            ) : (
              <Building className="size-8 text-primary" />
            )}
            <h1 className="text-lg font-semibold text-primary leading-tight truncate">{businessDisplay}</h1>
          </div>
          <SidebarTrigger>
            <PanelLeft className="h-5 w-5"/>
          </SidebarTrigger>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <SidebarMenuButton isActive={pathname.startsWith(item.href)}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" align="center" className="group-data-[state=expanded]/sidebar-wrapper:hidden">
                    {item.label}
                </TooltipContent>
              </Tooltip>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="mb-2">
            <p className="text-xs text-muted-foreground">Usuario:</p>
            <p className="text-sm font-medium text-foreground truncate" title={displayName}>
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground">
              Rol: {userProfile?.roles.map(r => r.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}
            </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left">
              <LogOut className="mr-2 h-4 w-4" /> 
              <span className="truncate group-data-[collapsible=icon]:group-hover:opacity-100 group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200">Cerrar Sesión</span>
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
        <p className="text-xs text-muted-foreground text-center mt-2 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:group-hover:opacity-100 transition-opacity duration-200">
          © {new Date().getFullYear()} SocioVIP
        </p>
      </SidebarFooter>
    </>
  );
}
