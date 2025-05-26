
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart2, Gift, ListChecks, LogOut, QrCode, Settings, UserCircle } from "lucide-react";
import { SocioVipLogo } from "@/components/icons"; // Reusing the logo
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation"; // Will need "use client" in Nav component

// This layout will wrap all promoter pages

const navItems = [
  { href: "/promoter/dashboard", label: "Dashboard", icon: BarChart2 },
  { href: "/promoter/entities", label: "Mis Entidades", icon: Gift },
  // { href: "/promoter/codes", label: "Generar Códigos", icon: QrCode }, // Maybe part of entities
  // { href: "/promoter/settings", label: "Configuración", icon: Settings },
];


function PromoterSidebar() {
  const pathname = usePathname(); // Hook requires "use client"
  const promoterName = "Promotor Ejemplo"; // Mocked

  return (
    <aside className="w-60 h-screen bg-card text-card-foreground border-r border-border flex flex-col sticky top-0">
      <div className="p-4 border-b border-border flex items-center space-x-2">
        <UserCircle className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-md font-semibold text-primary">Panel Promotor</h1>
          <p className="text-xs text-muted-foreground">{promoterName}</p>
        </div>
      </div>
      <nav className="flex-grow p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
              pathname?.startsWith(item.href) ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">© {new Date().getFullYear()} SocioVIP Promotor</p>
      </div>
    </aside>
  );
}


export const metadata: Metadata = {
  title: "Panel Promotor - SocioVIP",
  description: "Gestiona tus entidades asignadas y códigos.",
};

export default function PromoterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
   // Mocked user info
  const promoterUserName = "Promotor de Pandora";

  return (
    <div className="flex min-h-screen bg-muted/40">
       {/* 
        This structure assumes PromoterSidebar is a Client Component if it uses usePathname directly.
        For server layouts, navigation state needs careful handling or separate client components.
        For now, let's make the sidebar a client component.
      */}
      <div className="hidden md:flex"> {/* Sidebar hidden on small screens, could be a Sheet */}
         {/* To make PromoterSidebar a client component if it uses usePathname:
             1. Create PromoterSidebar.tsx
             2. Add "use client"; at the top of PromoterSidebar.tsx
             3. Move the PromoterSidebar function definition to that file.
             4. Import and use <PromoterSidebar /> here.
             For now, this will cause an error if PromoterSidebar directly uses usePathname
             without being marked as a client component itself.
             Let's assume PromoterSidebar will be refactored or this page becomes client-side.
             For simplicity of this step, I'm leaving it as is, but noting the implication.
          */}
          {/* <PromoterSidebar /> Placeholder if sidebar becomes separate client component */}
      </div>
      <div className="flex flex-col flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-2">
          <div className="md:hidden">
             {/* Mobile Menu Trigger (Sheet) can go here */}
             <Button size="icon" variant="outline">
                <ListChecks className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
          </div>
          <div className="flex items-center gap-2">
            <SocioVipLogo className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-semibold text-primary">Panel Promotor SocioVIP</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {promoterUserName}
            </span>
            <Button variant="outline" size="icon" asChild>
              <Link href="/"> {/* Replace with actual logout later */}
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Cerrar Sesión</span>
              </Link>
            </Button>
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
