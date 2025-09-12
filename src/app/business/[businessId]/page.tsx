
import React from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  limit
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Business } from "@/lib/types";
import { LOGO_URL as DEFAULT_LOGO_URL } from "@/components/icons";
import type { Metadata, ResolvingMetadata } from 'next';
import BusinessPublicPageClient from './page-client';

// --- Dynamic Metadata Generation (SERVER) ---
type Props = {
  params: { businessId: string };
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { businessId } = params;

  try {
    const businessDocRef = doc(db, "businesses", businessId);
    const businessSnap = await getDoc(businessDocRef);

    if (!businessSnap.exists()) {
      return {
        title: "Negocio no encontrado | SocioVip",
        description: "La página de este negocio no está disponible.",
      };
    }

    const business = businessSnap.data() as Business;
    const businessIcon = business.logoUrl || DEFAULT_LOGO_URL;
    const resolvedParent = await parent;

    return {
      title: `${business.name} | SocioVip`,
      description: business.slogan || `Descubre las promociones y eventos de ${business.name}.`,
      icons: {
        icon: businessIcon,
        apple: businessIcon,
      },
      openGraph: {
        title: business.name,
        description: business.slogan || `Promociones y eventos exclusivos en ${business.name}.`,
        images: [
          {
            url: business.publicCoverImageUrl || businessIcon,
            width: 1200,
            height: 630,
            alt: `Portada de ${business.name}`,
          },
        ],
        siteName: 'SocioVip',
      },
    };
  } catch (error) {
    console.error("Error generating metadata for business page:", error);
    return {
      title: "SocioVip",
      description: "Tus promociones y eventos en un solo lugar.",
    };
  }
}


// --- Server Component (Default Export) ---
export default function BusinessPublicPage(props: Props) {
  // This is a Server Component that renders the Client Component.
  return <BusinessPublicPageClient />;
}
