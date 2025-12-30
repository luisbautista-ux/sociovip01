
require('dotenv').config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Se asegura que la variable de entorno de las credenciales de Firebase Admin
  // esté disponible en el entorno del servidor donde se ejecutan las API Routes.
  env: {
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  },

  // ✅ Activa el modo estricto de React
  reactStrictMode: true,

  // ✅ Evita que el build falle por errores de TypeScript o ESLint
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ✅ Configura dominios externos permitidos para imágenes
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ibb.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ibb.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      }
    ],
  },

  // ✅ Permite que el preview de Firebase Studio se conecte sin bloqueos CORS
  experimental: {
    allowedDevOrigins: [
      "https://*.cloudworkstations.dev", // para entornos de Firebase Studio
      "http://localhost:9002",           // para desarrollo local
    ],
  },
};

module.exports = nextConfig;
