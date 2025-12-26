
import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { LOGO_IMAGE_URL } from '@/lib/constants';
import type { Metadata } from 'next';
import type { BusinessManagedEntity } from '@/lib/types';

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

    if (businessSnap.empty) {
      // Si no se encuentra el negocio, devolver metadatos genéricos
      return {
        title: "SocioVIP",
        description: "Descubre las promociones y eventos más exclusivos.",
      };
    }

    const businessDoc = businessSnap.docs[0];
    const businessId = businessDoc.id;
    const business = businessDoc.data();
    const businessName = business.name || "Negocio";

    // 2. Buscar el último evento para ese negocio
    const eventsQuery = adminDb
      .collection('businessEntities')
      .where('businessId', '==', businessId)
      .where('type', '==', 'event')
      .orderBy('createdAt', 'desc')
      .limit(1);
    const eventsSnap = await eventsQuery.get();

    const lastEvent = eventsSnap.empty ? null : eventsSnap.docs[0].data();

    // 3. Construir los metadatos
    const imageUrl = lastEvent?.imageUrl || business.logoUrl || LOGO_IMAGE_URL;

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
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        type: 'website',
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
