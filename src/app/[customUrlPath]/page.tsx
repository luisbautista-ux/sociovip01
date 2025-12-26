
"use client";

import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';

// Esta página ahora solo renderiza el componente de cliente.
// Toda la lógica de metadatos se ha movido al servidor de forma segura.

interface PageProps {
  params: { customUrlPath: string };
}

export default function BusinessPage({ params }: PageProps) {
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
