
import { type Metadata } from 'next';
import BusinessPublicPageClient from '@/components/business/BusinessPublicPageClient';

interface PageProps {
  params: { customUrlPath: string };
}

// --- Static Metadata Generation ---
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // As per your request, we will always return the same static metadata
  // for any business URL.
  return {
    title: "La secta edición Sexy Halloween 🎃",
    description: "Dj Velmat || Dj Billy || Dj Yenpi",
    openGraph: {
      title: "La secta edición Sexy Halloween 🎃",
      description: "Dj Velmat || Dj Billy || Dj Yenpi",
      images: [
        {
          url: "https://i.ibb.co/HLwH0pSq/hallo.jpg",
          width: 1200,
          height: 630,
          alt: "La secta edición Sexy Halloween 🎃",
        },
      ],
    },
    twitter: {
        card: "summary_large_image",
        title: "La secta edición Sexy Halloween 🎃",
        description: "Dj Velmat || Dj Billy || Dj Yenpi",
        images: ["https://i.ibb.co/HLwH0pSq/hallo.jpg"],
    },
  };
}

export default function BusinessPage({ params }: PageProps) {
  return <BusinessPublicPageClient customUrlPath={params.customUrlPath} />;
}
