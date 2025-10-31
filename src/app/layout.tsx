
import type { Metadata } from "next";
// Removed Geist imports as per new font instructions
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "La secta edición Sexy Halloween 🎃",
  description: "Dj Velmat || Dj Billy || Dj Yenpi",
  openGraph: {
    title: "La secta edición Sexy Halloween 🎃",
    description: "Dj Velmat || Dj Billy || Dj Yenpi",
    images: [
      {
        url: "https://i.ibb.co/HLwH0pSq/hallo.jpg",
        width: 1200,
        height: 630,
        alt: "La secta edición Sexy Halloween 🎃",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "La secta edición Sexy Halloween 🎃",
    description: "Dj Velmat || Dj Billy || Dj Yenpi",
    images: ["https://i.ibb.co/HLwH0pSq/hallo.jpg"],
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
