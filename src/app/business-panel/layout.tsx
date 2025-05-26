
import type { Metadata } from "next";
import { BusinessSidebar } from "@/components/business/BusinessSidebar";

export const metadata: Metadata = {
  title: "Panel de Negocio - SocioVIP",
  description: "Administra tus promociones, eventos y más.",
};

export default function BusinessPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Here you would typically have logic to ensure the user is authenticated
  // and is associated with a business.
  return (
    <div className="flex min-h-screen bg-background">
      <BusinessSidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
