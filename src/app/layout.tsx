
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  metadataBase: new URL('https://sociovip.pe'),
  title: "SocioVIP - Experiencias Exclusivas",
  description: "Descubre las mejores promociones y eventos exclusivos en tu ciudad con SocioVIP.",
  openGraph: {
    title: "SocioVIP - Experiencias Exclusivas",
    description: "Descubre las mejores promociones y eventos exclusivos en tu ciudad con SocioVIP.",
    url: "https://sociovip.pe",
    siteName: "SocioVIP",
    images: [
      {
        url: "/og-image.png", // Next.js automatically resolves this against metadataBase
        width: 1200,
        height: 630,
        alt: "SocioVIP Preview",
      },
    ],
    locale: "es_PE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SocioVIP - Experiencias Exclusivas",
    description: "Descubre las mejores promociones y eventos exclusivos en tu ciudad con SocioVIP.",
    images: ["/og-image.png"],
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Inter:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased overflow-x-hidden w-full relative">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
