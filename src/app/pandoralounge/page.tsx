
import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { LOGO_IMAGE_URL } from '@/lib/constants';
import type { Metadata, ResolvingMetadata } from 'next';
import type { BusinessManagedEntity } from '@/lib/types';

interface PageProps {
  params: { }; // No params needed for static page
}

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const staticCustomUrlPath = 'pandoralounge';

  try {
    // 1. Find the business ID for "pandoralounge"
    const businessQuery = adminDb.collection('businesses').where('customUrlPath', '==', staticCustomUrlPath).limit(1);
    const businessSnap = await businessQuery.get();

    if (businessSnap.empty) {
      return {
        title: "Pandora Lounge | SocioVIP",
        description: "Promociones y eventos exclusivos en Pandora Lounge.",
        openGraph: {
          images: [LOGO_IMAGE_URL],
        },
      };
    }

    const businessId = businessSnap.docs[0].id;
    const businessData = businessSnap.docs[0].data();
    const businessName = businessData.name || "Pandora Lounge";

    // 2. Find the latest event for that business
    const eventsQuery = adminDb.collection('businessEntities')
      .where('businessId', '==', businessId)
      .where('type', '==', 'event')
      .orderBy('createdAt', 'desc')
      .limit(1);
      
    const eventsSnap = await eventsQuery.get();

    if (eventsSnap.empty) {
      return {
        title: `${businessName} | SocioVIP`,
        description: `Descubre las promociones y eventos de ${businessName}.`,
        openGraph: {
          images: [businessData.logoUrl || LOGO_IMAGE_URL],
        },
      };
    }

    const lastEvent = eventsSnap.docs[0].data() as BusinessManagedEntity;

    // 3. Build and return the event metadata
    const eventImageUrl = lastEvent.imageUrl || businessData.logoUrl || LOGO_IMAGE_URL;
    return {
      title: lastEvent.name,
      description: lastEvent.description || `No te pierdas ${lastEvent.name} en ${businessName}.`,
      openGraph: {
        title: lastEvent.name,
        description: lastEvent.description,
        images: [
          {
            url: eventImageUrl,
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
        images: [eventImageUrl],
      },
    };
  } catch (error) {
    console.error('Error generating metadata for pandoralounge (static page):', error);
    return {
      title: "Pandora Lounge | SocioVIP",
      description: "Promociones y eventos exclusivos en Pandora Lounge.",
    };
  }
}

// This page component will render the client component responsible for the business page content.
export default function PandoraLoungePage() {
  return <BusinessPublicPageClient customUrlPath="pandoralounge" />;
}
