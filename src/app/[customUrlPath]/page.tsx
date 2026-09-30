import { Metadata } from 'next';
import BusinessPublicPageClient from "@/components/business/BusinessPublicPageClient";
import { admin } from '@/lib/firebase/firebaseAdmin';

// Metadatos dinámicos para Open Graph (Facebook, WhatsApp, etc.)
export async function generateMetadata({ params }: { params: { customUrlPath: string } }): Promise<Metadata> {
  const customUrlPath = params.customUrlPath.toLowerCase().trim();
  let businessName = "SocioVIP - Negocio";
  let businessDescription = "Descubre las mejores promociones y eventos de este negocio.";
  let logoUrl = "https://sociovip.pe/og-imagen.jpg"; // Default fallback

  try {
    const adminDb = admin.firestore();
    const querySnapshot = await adminDb
      .collection('businesses')
      .where('customUrlPath', '==', customUrlPath)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      const data = querySnapshot.docs[0].data();
      businessName = data.name || businessName;
      businessDescription = data.description || businessDescription;
      // Si el negocio tiene logoUrl lo usamos
      if (data.logoUrl) {
        logoUrl = data.logoUrl;
      }
    }
  } catch (error) {
    console.error("Error fetching business for metadata:", error);
  }

  return {
    title: `${businessName} | SocioVIP`,
    description: businessDescription,
    openGraph: {
      title: `${businessName} | SocioVIP`,
      description: businessDescription,
      url: `https://sociovip.pe/${customUrlPath}`,
      images: [
        {
          url: logoUrl,
          width: 800, // Ajustable, los logos suelen ser cuadrados o anchos
          height: 800,
          alt: `${businessName} Logo`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${businessName} | SocioVIP`,
      description: businessDescription,
      images: [logoUrl],
    },
  };
}

export default function BusinessPage({ params }: { params: { customUrlPath: string } }) {
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
