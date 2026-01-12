/** @type {import('next').NextConfig} */
const nextConfig = {
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
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  }
};

module.exports = nextConfig;
