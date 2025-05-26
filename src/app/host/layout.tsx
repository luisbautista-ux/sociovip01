
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { LogOut, ScanEye } from "lucide-react";
import Link from "next/link";
import { SocioVipLogo } from "@/components/icons";

export const metadata: Metadata = {
  title: "Anfitrión - SocioVIP",
  description: "Panel de validación para anfitriones de SocioVIP.",
};

export default function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // In a real app, businessName and user info would come from session/auth
  const businessName = "Pandora Lounge Bar (Anfitrión)"; 
  const hostUserName = "Host de Pandora";

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-2">
        <div className="flex items-center gap-2">
          <SocioVipLogo className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-semibold text-primary">{businessName}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {hostUserName}
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
      <footer className="py-4 px-6 border-t text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} SocioVIP Anfitrión</p>
      </footer>
    </div>
  );
}
