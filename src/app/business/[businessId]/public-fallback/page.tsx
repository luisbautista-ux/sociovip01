// src/app/business/[businessId]/public-fallback/page.tsx
// This file is effectively deprecated and will be removed.
// The logic is now in /src/app/business/[businessId]/page.tsx
// For now, it can just redirect to a non-existent page or home to avoid errors if directly accessed.
// Or, better, redirect to /business/[businessId]

import { redirect } from 'next/navigation'

export default async function BusinessPublicFallbackPage({ params }: { params: { businessId: string } }) {
  if (params.businessId) {
    return redirect(`/business/${params.businessId}`);
  }
  return redirect('/'); // Fallback to home if no businessId
}
