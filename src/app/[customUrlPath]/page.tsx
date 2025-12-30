import BusinessPublicPageClient from "@/components/business/BusinessPublicPageClient";
import type { Metadata } from "next";

export const revalidate = 60;

// Metadata estática para todas las páginas de negocio, optimizada para redes sociales.
export const metadata: Metadata = {
  title: "Fiesta Año Nuevo 2026",
  description: "DJ FEZZ | DJ CARRILLO | DJ NANDO | DJ LECCA",
  openGraph: {
    title: "Fiesta Año Nuevo 2026",
    description: "DJ FEZZ | DJ CARRILLO | DJ NANDO | DJ LECCA",
    url: "https://sociovip.app", // URL genérica del sitio
    type: "website",
    images: [
      {
        url: "https://i.ibb.co/Y4yGhsyh/a-onuevo.png",
        width: 1200,
        height: 630,
        alt: "Fiesta de Año Nuevo en Pandora Lounge",
      },
    ],
    locale: "es_PE",
    siteName: "SocioVIP",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fiesta Año Nuevo 2026",
    description: "DJ FEZZ | DJ CARRILLO | DJ NANDO | DJ LECCA",
    images: [
      "https://i.ibb.co/Y4yGhsyh/a-onuevo.png",
    ],
  },
};

type Props = {
  params: { customUrlPath: string };
};

export default function BusinessPage({ params }: Props) {
  // La metadata es estática, pero la página sigue renderizando el contenido dinámico del negocio.
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
