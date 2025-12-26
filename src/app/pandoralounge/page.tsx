
import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { LOGO_IMAGE_URL } from '@/lib/constants';
import type { Metadata } from 'next';

// Revalidar la página cada 5 minutos (300 segundos) para obtener el último evento.
export const revalidate = 300;

async function getPandoraMetadata() {
  try {
    const businessSnap = await adminDb
      .collection("businesses")
      .where("customUrlPath", "==", "pandoralounge")
      .limit(1)
      .get();

    if (businessSnap.empty) return null;

    const businessId = businessSnap.docs[0].id;
    const business = businessSnap.docs[0].data();

    const eventSnap = await adminDb
      .collection("businessEntities")
      .where("businessId", "==", businessId)
      .where("type", "==", "event")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    const lastEvent = eventSnap.empty ? null : eventSnap.docs[0].data();

    return { business, lastEvent };
  } catch (error) {
    console.error("Error fetching metadata for Pandora Lounge:", error);
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPandoraMetadata();

  const businessName = data?.business?.name || "Pandora Lounge";

  // Fallback metadata si no hay evento
  if (!data || !data.lastEvent) {
    return {
      title: `${businessName} | SocioVIP`,
      description: `Los mejores eventos y promociones en ${businessName}.`,
    };
  }

  const { business, lastEvent } = data;
  const imageUrl = lastEvent.imageUrl || business.logoUrl || LOGO_IMAGE_URL;

  const title = `${lastEvent.name} | ${business.name}`;
  const description = lastEvent.description || `No te pierdas ${lastEvent.name} en ${business.name}`;

  return {
    metadataBase: new URL("https://sociovip.app"),
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/pandoralounge`,
      type: 'website',
      images: [imageUrl], // URL simple para máxima compatibilidad
      locale: 'es_PE',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

// Renderiza el mismo componente cliente que la página dinámica
export default function PandoraLoungePage() {
  return <BusinessPublicPageClient customUrlPath="pandoralounge" />;
}
