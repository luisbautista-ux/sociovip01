import BusinessPublicPageClient from "@/components/business/BusinessPublicPageClient";
import { db } from "@/lib/firebase";
import { Business } from "@/lib/types";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import type { Metadata, ResolvingMetadata } from "next";

export const revalidate = 60; // Revalidate every 60 seconds

type Props = {
  params: { customUrlPath: string };
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  try {
    const { customUrlPath } = params;

    const businessQuery = query(
      collection(db, "businesses"),
      where("customUrlPath", "==", customUrlPath.toLowerCase()),
      limit(1)
    );

    const businessSnapshot = await getDocs(businessQuery);

    if (businessSnapshot.empty) {
      return {
        title: "Negocio no encontrado",
        description: "La página de este negocio no está disponible.",
      };
    }

    const businessData = businessSnapshot.docs[0].data() as Business;
    const businessName = businessData.name || "Negocio en SocioVIP";
    const businessSlogan = businessData.slogan || "Descubre promociones y eventos exclusivos.";
    const businessCover = businessData.publicCoverImageUrls?.[0] || 'https://i.ibb.co/fVH01x3b/Dise-o-sin-t-tulo-1.png';
    const pageUrl = `https://sociovip.app/${customUrlPath}`;

    return {
      title: businessName,
      description: businessSlogan,
      metadataBase: new URL(pageUrl),
      openGraph: {
        title: businessName,
        description: businessSlogan,
        url: pageUrl,
        siteName: 'SocioVIP',
        images: [
          {
            url: businessCover,
            width: 1200,
            height: 630,
            alt: `Portada de ${businessName}`,
          },
        ],
        locale: 'es_PE',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: businessName,
        description: businessSlogan,
        images: [businessCover],
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    // Fallback metadata in case of an error
    return {
      title: "SocioVIP",
      description: "Tus mejores experiencias, en un solo lugar.",
    };
  }
}

export default function BusinessPage({ params }: Props) {
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
