
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Ticket, Calendar, ClipboardList, Users, UserPlus, ScanLine, BarChart3, Settings, Building } from "lucide-react";
import { SocioVipLogo } from "@/components/icons"; // Assuming this logo can be reused or a new Business one created

const navItems = [
  { href: "/business-panel/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/business-panel/promotions", label: "Promociones", icon: Ticket },
  { href: "/business-panel/events", label: "Eventos", icon: Calendar },
  { href: "/business-panel/surveys", label: "Encuestas", icon: ClipboardList },
  { href: "/business-panel/promoters", label: "Mis Promotores", icon: UserPlus },
  { href: "/business-panel/staff", label: "Mi Personal", icon: Users },
  // { href: "/business-panel/codes", label: "Generar Códigos", icon: ScanLine }, // Might be part of promo/event detail
  { href: "/business-panel/analytics", label: "Analíticas", icon: BarChart3 },
  { href: "/business-panel/settings", label: "Configuración", icon: Settings },
];

export function BusinessSidebar() {
  const pathname = usePathname();

  // In a real app, you'd get the business name from session/context
  const businessName = "Mi Negocio"; 

  return (
    <aside className="w-64 h-screen bg-card text-card-foreground border-r border-border flex flex-col sticky top-0">
      <div className="p-4 border-b border-border flex items-center space-x-2">
        <Building className="h-8 w-8 text-primary" /> {/* Or a specific business logo */}
        <div>
          <h1 className="text-lg font-semibold text-primary">Panel Negocio</h1>
          <p className="text-xs text-muted-foreground">{businessName}</p>
        </div>
      </div>
      <nav className="flex-grow p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
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
      <div className="p-4 border-t border-border">
        {/* User info for the logged-in business user can go here */}
        <p className="text-xs text-muted-foreground text-center">© {new Date().getFullYear()} SocioVIP</p>
      </div>
    </aside>
  );
}
