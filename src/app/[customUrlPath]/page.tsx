
import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { LOGO_IMAGE_URL } from '@/lib/constants';
import type { Metadata } from 'next';
import type { BusinessManagedEntity } from '@/lib/types';

// ✅ AJUSTE CRÍTICO #2: Revalidación para asegurar que se obtenga el último evento.
export const revalidate = 60; // Revalida la página y sus metadatos cada 60 segundos.

interface PageProps {
  params: { customUrlPath: string };
}

export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {

  const { customUrlPath } = params;

  try {
    // 1. Buscar el negocio por su customUrlPath
    const businessQuery = adminDb
      .collection('businesses')
      .where('customUrlPath', '==', customUrlPath)
      .limit(1);
    const businessSnap = await businessQuery.get();

    // Si no se encuentra el negocio, devolver metadatos genéricos de SocioVIP
    if (businessSnap.empty) {
      return {
        title: "SocioVIP",
        description: "Descubre las promociones y eventos más exclusivos.",
      };
    }

    const businessDoc = businessSnap.docs[0];
    const businessId = businessDoc.id;
    const business = businessDoc.data();
    const businessName = business.name || "Negocio";

    // 2. Buscar el último evento activo para ese negocio, ordenado por fecha de creación descendente
    const eventsQuery = adminDb
      .collection('businessEntities')
      .where('businessId', '==', businessId)
      .where('type', '==', 'event')
      .orderBy('createdAt', 'desc')
      .limit(1);
    const eventsSnap = await eventsQuery.get();

    const lastEvent = eventsSnap.empty ? null : eventsSnap.docs[0].data();

    // ✅ AJUSTE CRÍTICO #1: La imagen debe ser una URL ABSOLUTA
    const BASE_URL = "https://sociovip.app";
    
    const rawImage =
      lastEvent?.imageUrl ||
      business.logoUrl ||
      LOGO_IMAGE_URL;

    // Asegurarse de que la URL sea absoluta
    const imageUrl = rawImage.startsWith("http")
      ? rawImage
      : `${BASE_URL}${rawImage}`;
      
    // 3. Construir los metadatos con la información obtenida
    const title = lastEvent
      ? `${lastEvent.name} | ${businessName}`
      : `${businessName} | SocioVIP`;

    const description = lastEvent?.description
      || `Descubre los eventos y promociones de ${businessName}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://sociovip.app/${customUrlPath}`, // 🔴 CLAVE
        type: 'website',                              // 🔴 CLAVE
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        locale: 'es_PE',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
    };

  } catch (error) {
    console.error(`Error generating metadata for /${customUrlPath}:`, error);
    // Fallback en caso de error en la consulta
    return {
      title: "SocioVIP",
      description: "Descubre las promociones y eventos más exclusivos.",
    };
  }
}

// El componente de la página siempre renderiza el cliente.
export default function BusinessPage({ params }: PageProps) {
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
