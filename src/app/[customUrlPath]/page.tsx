
import BusinessPublicPageClient from "@/components/business/BusinessPublicPageClient";
import type { Metadata, ResolvingMetadata } from "next";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import type { Business, BusinessManagedEntity } from "@/lib/types";

export const revalidate = 60; // Revalidate every 60 seconds

type Props = {
  params: { customUrlPath: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const customUrlPath = params.customUrlPath;
  const entityId = searchParams?.entity as string;

  // URL del logo por defecto en caso de que no haya una imagen.
  const defaultImage = "https://i.ibb.co/fVH01x3b/Dise-o-sin-t-tulo-1.png";

  try {
    // 1. Obtener datos del negocio desde Firestore
    const businessQuery = adminDb.collection("businesses").where("customUrlPath", "==", customUrlPath).limit(1);
    const businessSnap = await businessQuery.get();

    if (businessSnap.empty) {
      return {
        title: "Negocio no encontrado",
        description: "La página que buscas no existe o la URL es incorrecta.",
      };
    }

    const businessData = businessSnap.docs[0].data() as Business;
    const businessId = businessSnap.docs[0].id;
    
    // --- Metadatos Base (del negocio) ---
    let title = businessData.name || "Negocio en SocioVIP";
    let description = businessData.slogan || `Descubre las mejores promociones y eventos de ${title}.`;
    let imageUrl = businessData.logoUrl || defaultImage;

    // 2. Si se especifica una entidad (evento/promoción), obtener sus datos y sobreescribir los metadatos
    if (entityId) {
      const entityDocRef = adminDb.collection("businessEntities").doc(entityId);
      const entitySnap = await entityDocRef.get();

      if (entitySnap.exists()) {
        const entityData = entitySnap.data() as BusinessManagedEntity;
        // Solo sobreescribir si la entidad pertenece al negocio correcto (por seguridad y consistencia)
        if (entityData.businessId === businessId) {
            title = entityData.name;
            description = entityData.description;
            imageUrl = entityData.imageUrl || imageUrl; // Si la entidad no tiene imagen, usa la del negocio
        }
      }
    }

    // 3. Construir y retornar los metadatos finales para SEO y redes sociales
    return {
      title: `${title} | SocioVIP`,
      description: description,
      openGraph: {
        title: title,
        description: description,
        url: `https://sociovip.app/${customUrlPath}${entityId ? `?entity=${entityId}` : ''}`,
        siteName: "SocioVIP",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        locale: "es_PE",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: title,
        description: description,
        images: [imageUrl],
      },
    };

  } catch (error) {
    console.error(`Error generando metadatos para /${customUrlPath}:`, error);
    // Retornar metadatos genéricos en caso de error
    return {
      title: "SocioVIP",
      description: "Descubre promociones y eventos exclusivos cerca de ti.",
    };
  }
}

// El componente de la página sigue siendo el mismo, solo que ahora los metadatos son dinámicos.
export default function BusinessPage({ params }: { params: { customUrlPath: string } }) {
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
