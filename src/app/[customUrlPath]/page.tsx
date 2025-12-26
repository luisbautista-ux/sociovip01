
import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { LOGO_IMAGE_URL } from '@/lib/constants';
import type { Metadata, ResolvingMetadata } from 'next';
import type { BusinessManagedEntity } from '@/lib/types';

interface PageProps {
  params: { customUrlPath: string };
}

// Esta función ahora genera metadatos específicos SOLO para 'pandoralounge'
export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const customUrlPath = params.customUrlPath;

  // Solo actuar si la URL es la de Pandora Lounge
  if (customUrlPath !== 'pandoralounge') {
    // Para cualquier otro negocio, devolver metadatos genéricos para evitar errores.
    return {
      title: "SocioVIP",
      description: "Descubre las promociones y eventos más exclusivos.",
    };
  }

  try {
    // 1. Buscar el ID del negocio "pandora-lounge"
    const businessQuery = adminDb.collection('businesses').where('customUrlPath', '==', 'pandoralounge').limit(1);
    const businessSnap = await businessQuery.get();

    if (businessSnap.empty) {
      // Si no se encuentra el negocio, devolver metadatos de respaldo.
      return {
        title: "Pandora Lounge | SocioVIP",
        description: "Promociones y eventos exclusivos en Pandora Lounge.",
        openGraph: {
          images: [LOGO_IMAGE_URL],
        },
      };
    }

    const businessId = businessSnap.docs[0].id;
    const businessName = businessSnap.docs[0].data().name || "Pandora Lounge";

    // 2. Buscar el último evento para ese negocio
    const eventsQuery = adminDb.collection('businessEntities')
      .where('businessId', '==', businessId)
      .where('type', '==', 'event')
      .orderBy('createdAt', 'desc')
      .limit(1);
      
    const eventsSnap = await eventsQuery.get();

    if (eventsSnap.empty) {
      // Si no hay eventos, devolver metadatos del negocio.
      return {
        title: `${businessName} | SocioVIP`,
        description: `Descubre las promociones y eventos de ${businessName}.`,
        openGraph: {
          images: [businessSnap.docs[0].data().logoUrl || LOGO_IMAGE_URL],
        },
      };
    }

    const lastEvent = eventsSnap.docs[0].data() as BusinessManagedEntity;

    // 3. Construir y devolver los metadatos del evento
    return {
      title: lastEvent.name,
      description: lastEvent.description || `No te pierdas ${lastEvent.name} en ${businessName}.`,
      openGraph: {
        title: lastEvent.name,
        description: lastEvent.description,
        images: [
          {
            url: lastEvent.imageUrl || LOGO_IMAGE_URL,
            width: 1200,
            height: 630,
            alt: lastEvent.name,
          },
        ],
        locale: 'es_PE',
        type: 'website',
      },
       twitter: {
        card: 'summary_large_image',
        title: lastEvent.name,
        description: lastEvent.description,
        images: [lastEvent.imageUrl || LOGO_IMAGE_URL],
      },
    };
  } catch (error) {
    console.error('Error generating metadata for pandoralounge:', error);
    // En caso de CUALQUIER error, devolver metadatos seguros.
    return {
      title: "Pandora Lounge | SocioVIP",
      description: "Promociones y eventos exclusivos en Pandora Lounge.",
    };
  }
}


export default function BusinessPage({ params }: PageProps) {
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}

    