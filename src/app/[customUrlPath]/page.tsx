import BusinessPublicPageClient from "@/components/business/BusinessPublicPageClient";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Closing Party",
  description: "DJ Nando || DJ Velmat || DJ Marc",
  metadataBase: new URL("https://sociovip.app"),
  openGraph: {
    title: "Closing Party",
    description: "DJ Nando || DJ Velmat || DJ Marc",
    url: "https://sociovip.app/pandoralounge",
    type: "website",
    images: [
      {
        url: "https://firebasestorage.googleapis.com/v0/b/cloverpass.firebasestorage.app/o/event-images%2F9g0IXZfAaoOCvkLJZuYL%2FvPrKtuQZYMYouktFpHbf%2FIMG_1945.jpeg?alt=media&token=1c57b752-7d7d-4732-b283-29ea421b771a",
        width: 1200,
        height: 630,
        alt: "Closing Party",
      },
    ],
    locale: "es_PE",
  },
  twitter: {
    card: "summary_large_image",
    title: "Closing Party",
    description: "DJ Nando || DJ Velmat || DJ Marc",
    images: [
      "https://firebasestorage.googleapis.com/v0/b/cloverpass.firebasestorage.app/o/event-images%2F9g0IXZfAaoOCvkLJZuYL%2FvPrKtuQZYMYouktFpHbf%2FIMG_1945.jpeg?alt=media&token=1c57b752-7d7d-4732-b283-29ea421b771a",
    ],
  },
};

export default function PandoraLoungePage() {
  return <BusinessPublicPageClient customUrlPath="pandoralounge" />;
}
