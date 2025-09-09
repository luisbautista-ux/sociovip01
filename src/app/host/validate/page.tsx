// This file is now a redirector. The actual content lives in /lector-qr/validate/page.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HostValidateRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect all traffic from /host/validate to /lector-qr/validate
    router.replace('/lector-qr/validate');
  }, [router]);

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Redirigiendo a la página de validación...</p>
    </div>
  );
}
