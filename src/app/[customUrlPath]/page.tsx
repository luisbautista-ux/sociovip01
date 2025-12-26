
import { type Metadata } from 'next';
import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';
import { adminDb } from '@/lib/firebase/firebaseAdmin'; // Usar la instancia centralizada
import type { Business, BusinessManagedEntity } from '@/lib/types';
import { isEntityCurrentlyActivatable, anyToDate } from '@/lib/utils';
import { LOGO_URL } from '@/components/icons';

interface PageProps {
  params: { customUrlPath: string };
}

// --- Dynamic Metadata Generation ---
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { customUrlPath } = params;

  try {
    // 1. Fetch the business data
    const businessQuery = adminDb.collection('businesses').where('customUrlPath', '==', customUrlPath).limit(1);
    const businessSnapshot = await businessQuery.get();

    if (businessSnapshot.empty) {
      return { title: "Negocio no encontrado" };
    }

    const businessDoc = businessSnapshot.docs[0];
    const businessData = { id: businessDoc.id, ...businessDoc.data() } as Business;

    // 2. Fetch the most recent active entity for this business
    const entitiesQuery = adminDb.collection('businessEntities')
      .where('businessId', '==', businessData.id)
      .where('isActive', '==', true)
      .orderBy('startDate', 'desc');
      
    const entitiesSnapshot = await entitiesQuery.get();

    let latestActiveEntity: BusinessManagedEntity | null = null;
    
    for (const doc of entitiesSnapshot.docs) {
        // Directamente crea un objeto plano, no uses la clase aquí.
        const entity = { 
            id: doc.id,
            ...doc.data(),
            startDate: anyToDate(doc.data().startDate)?.toISOString(),
            endDate: anyToDate(doc.data().endDate)?.toISOString(),
        } as BusinessManagedEntity;

        if (isEntityCurrentlyActivatable(entity)) {
            latestActiveEntity = entity;
            break;
        }
    }

    // 3. Build metadata based on what was found
    if (latestActiveEntity) {
      const title = latestActiveEntity.name;
      const description = latestActiveEntity.description || `Descubre más en ${businessData.name}.`;
      const imageUrl = latestActiveEntity.imageUrl;

      return {
        title: title,
        description: description,
        openGraph: {
          title: title,
          description: description,
          images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: title }] : undefined,
        },
        twitter: {
          card: "summary_large_image",
          title: title,
          description: description,
          images: imageUrl ? [imageUrl] : undefined,
        },
      };
    } else {
      // Fallback to business data if no active entities are found
      const title = businessData.name;
      const description = businessData.slogan || `Promociones y eventos exclusivos en ${businessData.name}.`;
      const imageUrl = businessData.logoUrl || businessData.publicCoverImageUrls?.[0];

      return {
        title: title,
        description: description,
        openGraph: {
          title: title,
          description: description,
          images: imageUrl ? [{ url: imageUrl, width: 512, height: 512, alt: `${title} Logo` }] : undefined,
        },
        twitter: {
          card: "summary_large_image",
          title: title,
          description: description,
          images: imageUrl ? [imageUrl] : undefined,
        },
      };
    }

  } catch (error) {
    console.error(`[generateMetadata] Error for ${customUrlPath}:`, error);
    // ¡IMPORTANTE! Devolver siempre un objeto de metadatos válido, incluso en caso de error.
    return {
      title: "SocioVIP",
      description: "Descubre promociones y eventos exclusivos.",
      openGraph: {
        images: [{ url: LOGO_URL, width: 512, height: 512, alt: "SocioVIP Logo" }],
      },
    };
  }
}

export default function BusinessPage({ params }: PageProps) {
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
