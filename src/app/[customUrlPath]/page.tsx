
import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';
import type { Metadata, ResolvingMetadata } from 'next';

interface PageProps {
  params: { customUrlPath: string };
}

// Esta metadata es genérica y solo se aplicará a rutas que no sean 'pandoralounge'
export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  
  if (params.customUrlPath === 'pandoralounge') {
    // Devuelve metadatos vacíos para que Next.js no intente renderizar nada aquí.
    // La página estática se encargará de los metadatos de pandoralounge.
    return {};
  }
  
  // Metadatos genéricos para cualquier otro negocio que no tenga una página estática.
  return {
    title: "SocioVIP",
    description: "Descubre las promociones y eventos más exclusivos.",
  };
}


export default function BusinessPage({ params }: PageProps) {
  // Si la ruta es 'pandoralounge', no renderizamos nada aquí para permitir que 
  // la página estática (pandoralounge/page.tsx) tome control total.
  if (params.customUrlPath === 'pandoralounge') {
    return null;
  }
  
  // Para cualquier otra URL, renderiza la página pública del negocio dinámicamente.
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
