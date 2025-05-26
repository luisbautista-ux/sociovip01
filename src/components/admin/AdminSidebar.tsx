
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building, Users, BarChart3, ListChecks, Settings } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/businesses", label: "Negocios", icon: Building },
  { href: "/admin/users", label: "Usuarios Plataforma", icon: Users },
  { href: "/admin/clients", label: "Clientes QR", icon: ListChecks },
  { href: "/admin/analytics", label: "Analíticas", icon: BarChart3 },
  // { href: "/admin/settings", label: "Configuración", icon: Settings }, // Example for later
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-card text-card-foreground border-r border-border flex flex-col sticky top-0">
      <div className="p-4 border-b border-border flex items-center space-x-2">
        <SocioVipLogo className="h-8 w-8 text-primary" />
        <h1 className="text-xl font-semibold text-primary">SocioVIP Admin</h1>
      </div>
      <nav className="flex-grow p-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
              pathname === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">© {new Date().getFullYear()} SocioVIP SuperAdmin</p>
      </div>
    </aside>
  );
}
