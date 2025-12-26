
import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { LOGO_IMAGE_URL } from '@/lib/constants';
import type { Metadata } from 'next';

export const revalidate = 60;

interface PageProps {
  params: { customUrlPath: string };
}

export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {

  const { customUrlPath } = params;

  // Si la ruta es 'pandoralounge', esta página no debe manejarla.
  // La página estática dedicada en /app/pandoralounge/page.tsx se encargará.
  if (customUrlPath === 'pandoralounge') {
    return {
      title: "Pandora Lounge | SocioVIP",
      description: "Eventos y promociones en Pandora Lounge.",
    };
  }

  try {
    const businessQuery = adminDb
      .collection('businesses')
      .where('customUrlPath', '==', customUrlPath)
      .limit(1);
    const businessSnap = await businessQuery.get();

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

    const eventsQuery = adminDb
      .collection('businessEntities')
      .where('businessId', '==', businessId)
      .where('type', '==', 'event')
      .orderBy('createdAt', 'desc')
      .limit(1);
    const eventsSnap = await eventsQuery.get();

    const lastEvent = eventsSnap.empty ? null : eventsSnap.docs[0].data();

    const BASE_URL = "https://sociovip.app";
    
    const rawImage =
      lastEvent?.imageUrl ||
      business.logoUrl ||
      LOGO_IMAGE_URL;

    const imageUrl = rawImage.startsWith("http")
      ? rawImage
      : `${BASE_URL}${rawImage}`;
      
    const title = lastEvent
      ? `${lastEvent.name} | ${businessName}`
      : `${businessName} | SocioVIP`;

    const description = lastEvent?.description
      || `Descubre los eventos y promociones de ${businessName}.`;

    return {
      metadataBase: new URL(BASE_URL),
      title,
      description,
      openGraph: {
        title,
        description,
        url: `/${customUrlPath}`,
        type: 'website',
        images: [imageUrl],
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
    return {
      title: "SocioVIP",
      description: "Descubre las promociones y eventos más exclusivos.",
    };
  }
}

export default function BusinessPage({ params }: PageProps) {
  if (params.customUrlPath === 'pandoralounge') {
    // Renderiza el cliente, pero la metadata será manejada por la página estática.
    return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
  }
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
