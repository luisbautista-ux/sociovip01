
import type { Metadata } from "next";
// Removed Geist imports as per new font instructions
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "SocioVip",
  description: "Descubre las mejores promociones y proximos eventos cerca de tí.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* The Inter font is typically handled by Tailwind's default font stack or can be loaded via Next/Font if needed. 
            For simplicity and alignment with modern Tailwind setups, we'll rely on the tailwind.config.ts definition. */}
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
