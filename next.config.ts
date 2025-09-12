
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Opcional: evita que el build falle por warnings de TS/ESLint en desarrollo
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ibb.co",               // Logo alojado en imgbb y ahora icono de WhatsApp
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",    // Fondos de Unsplash (si los usas)
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",           // Placeholders, SOLO si los usas
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
