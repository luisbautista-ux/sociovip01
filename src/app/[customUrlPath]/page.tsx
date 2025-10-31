
import { type Metadata } from 'next';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Business, BusinessManagedEntity } from '@/lib/types';
import { isEntityCurrentlyActivatable, anyToDate } from '@/lib/utils';
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
        title: "La secta edición Sexy Halloween 🎃",
        description: "Dj Velmat || Dj Billy || Dj Yenpi",
        openGraph: {
          title: "La secta edición Sexy Halloween 🎃",
          description: "Dj Velmat || Dj Billy || Dj Yenpi",
          images: [{ url: "https://i.ibb.co/HLwH0pSq/hallo.jpg" }],
        },
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
                images: [{ url: mostRelevantEvent.imageUrl || 'https://i.ibb.co/fVH01x3/Dise-o-sin-t-tulo-1.png' }],
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
        images: [{ url: businessData.logoUrl || businessData.publicCoverImageUrls?.[0] || 'https://i.ibb.co/fVH01x3/Dise-o-sin-t-tulo-1.png' }],
      },
    };

  } catch (error) {
    console.error("Error generating metadata:", error);
    // Fallback in case of any error
    return {
        title: "La secta edición Sexy Halloween 🎃",
        description: "Dj Velmat || Dj Billy || Dj Yenpi",
        openGraph: {
          title: "La secta edición Sexy Halloween 🎃",
          description: "Dj Velmat || Dj Billy || Dj Yenpi",
          images: [{ url: "https://i.ibb.co/HLwH0pSq/hallo.jpg" }],
        },
      };
  }
}

export default function BusinessPage({ params }: PageProps) {
  // This component now only passes the parameter down.
  // The actual page content is handled by a Client Component.
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
