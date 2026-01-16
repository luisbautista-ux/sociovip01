
import BusinessPublicPageClient from "@/components/business/BusinessPublicPageClient";

// El componente de la página sigue siendo el mismo, solo que ahora los metadatos son dinámicos.
export default function BusinessPage({ params }: { params: { customUrlPath: string } }) {
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
