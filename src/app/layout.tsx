
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import { LOGO_URL } from "@/components/icons";

export const metadata: Metadata = {
  title: "SocioVIP",
  description: "Descubre las promociones y eventos más exclusivos.",
  openGraph: {
    title: "SocioVIP",
    description: "Descubre las promociones y eventos más exclusivos.",
    images: [
      {
        url: LOGO_URL,
        width: 512,
        height: 512,
        alt: "Logo de SocioVIP",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SocioVIP",
    description: "Descubre las promociones y eventos más exclusivos.",
    images: [LOGO_URL],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
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
