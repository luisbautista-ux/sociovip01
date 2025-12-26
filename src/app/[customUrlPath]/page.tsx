
import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';
import type { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';

interface PageProps {
  params: { customUrlPath: string };
}

// This metadata function now intentionally ignores 'pandoralounge'
// as it's handled by its own static page.
export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  
  if (params.customUrlPath === 'pandoralounge') {
     // This case should not be hit if routing is correct, but as a fallback,
     // we return generic metadata to avoid errors. The static page will be used instead.
    return {
        title: "SocioVIP",
        description: "Descubre las promociones y eventos más exclusivos.",
    };
  }
  
  // For any other business, we can add dynamic logic here in the future
  // For now, it returns generic metadata.
  return {
    title: "SocioVIP",
    description: "Descubre las promociones y eventos más exclusivos.",
  };
}


export default function BusinessPage({ params }: PageProps) {
  // Prevent this dynamic route from handling the static 'pandoralounge' route
  if (params.customUrlPath === 'pandoralounge') {
    notFound();
  }
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
