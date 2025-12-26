

import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';

interface PageProps {
  params: { customUrlPath: string };
}

export default function BusinessPage({ params }: PageProps) {
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
