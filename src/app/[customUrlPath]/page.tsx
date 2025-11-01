
import { type Metadata } from 'next';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Business, BusinessManagedEntity } from '@/lib/types';
import { anyToDate } from '@/lib/utils';
import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';

interface PageProps {
  params: { customUrlPath: string };
}

// --- Dynamic Metadata Generation ---
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const customUrlPath = params.customUrlPath?.toLowerCase().trim();
  if (!customUrlPath) {
    return { title: "Negocio no encontrado", description: "La URL del negocio es inválida." };
  }

  try {
    const businessQuery = query(
      collection(db, "businesses"),
      where("customUrlPath", "==", customUrlPath),
      limit(1)
    );
    const businessSnap = await getDocs(businessQuery);

    if (businessSnap.empty) {
      return { 
        title: "Negocio no encontrado | SocioVIP", 
        description: "Esta página de negocio no existe o la URL es incorrecta." 
      };
    }
    
    const businessData = businessSnap.docs[0].data() as Business;
    
    // Prioritize showing a future or current event
    const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("businessId", "==", businessSnap.docs[0].id),
        where("isActive", "==", true)
    );
    const entitiesSnap = await getDocs(entitiesQuery);
    
    const now = new Date();
    const futureOrCurrentEvents = entitiesSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as BusinessManagedEntity))
        .filter(entity => {
            if (entity.type !== 'event') return false;
            const endDate = anyToDate(entity.endDate);
            return endDate ? endDate >= now : false;
        })
        .sort((a,b) => (anyToDate(a.startDate)?.getTime() || 0) - (anyToDate(b.startDate)?.getTime() || 0));

    const mostRelevantEvent = futureOrCurrentEvents[0];

    if (mostRelevantEvent) {
        return {
            title: mostRelevantEvent.name,
            description: mostRelevantEvent.description,
            openGraph: {
                title: mostRelevantEvent.name,
                description: mostRelevantEvent.description,
                images: [{ url: mostRelevantEvent.imageUrl || businessData.logoUrl || 'https://i.ibb.co/fVH01x3/Dise-o-sin-t-tulo-1.png' }],
            }
        };
    }
    
    // Fallback to business details if no relevant events
    return {
      title: businessData.name || "Detalles del Negocio",
      description: businessData.slogan || `Explora las ofertas de ${businessData.name}`,
      openGraph: {
        title: businessData.name || "Detalles del Negocio",
        description: businessData.slogan || `Explora las ofertas de ${businessData.name}`,
        images: [{ url: businessData.publicCoverImageUrls?.[0] || businessData.logoUrl || 'https://i.ibb.co/fVH01x3/Dise-o-sin-t-tulo-1.png' }],
      },
    };

  } catch (error) {
    console.error("Error generating metadata:", error);
    // Fallback in case of any server error
    return {
        title: "SocioVIP",
        description: "Tu portal a las mejores promociones y eventos.",
    };
  }
}

export default function BusinessPage({ params }: PageProps) {
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
