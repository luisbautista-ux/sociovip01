
// src/app/b/[customUrlPath]/page.tsx
"use server"; 

import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, limit, doc, getDoc } from "firebase/firestore";
import type { Business, BusinessManagedEntity, QrClient, PromotionDetails, QrCodeData, NewQrClientFormData } from "@/lib/types";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { Building, CalendarDays, Tag, Mail, Phone, MapPin, ExternalLink, AlertTriangle, QrCode as QrCodeIcon, Home } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import Link from "next/link";
import { PublicHeaderAuth } from "@/components/layout/PublicHeaderAuth";
// Client-side components for QR Generation flow will be needed here
import { BusinessPublicPageClientContent } from "./client-page";


export default async function BusinessPublicPageByUrl({ params }: { params: { customUrlPath: string } }) {
  let businessDetails: Business | null = null;
  let activeEntitiesForBusiness: BusinessManagedEntity[] = [];
  let fetchError: string | null = null;

  console.log("BusinessPublicPageByUrl: Fetching business with customUrlPath:", params.customUrlPath);

  try {
    if (!params.customUrlPath || typeof params.customUrlPath !== 'string' || params.customUrlPath.trim() === '') {
        console.warn("BusinessPublicPageByUrl: Invalid customUrlPath provided.");
        fetchError = "URL de negocio inválida.";
    } else {
        const businessQuery = query(
          collection(db, "businesses"),
          where("customUrlPath", "==", params.customUrlPath.toLowerCase().trim()),
          limit(1)
        );
        const businessSnap = await getDocs(businessQuery);

        if (businessSnap.empty) {
          console.warn("BusinessPublicPageByUrl: No business found for customUrlPath:", params.customUrlPath);
          fetchError = "Negocio no encontrado. Verifica que la URL sea correcta.";
        } else {
          const businessDoc = businessSnap.docs[0];
          const bizData = businessDoc.data() as Omit<Business, 'id'>;
          businessDetails = { 
            id: businessDoc.id, 
            ...bizData,
            joinDate: bizData.joinDate instanceof Timestamp ? bizData.joinDate.toDate().toISOString() : String(bizData.joinDate || new Date().toISOString()),
            customUrlPath: bizData.customUrlPath || params.customUrlPath, // Ensure it has the path
            // Ensure all optional public fields are at least undefined if not present
            logoUrl: bizData.logoUrl || undefined,
            publicCoverImageUrl: bizData.publicCoverImageUrl || undefined,
            slogan: bizData.slogan || undefined,
            publicContactEmail: bizData.publicContactEmail || undefined,
            publicPhone: bizData.publicPhone || undefined,
            publicAddress: bizData.publicAddress || undefined,
          };
          console.log("BusinessPublicPageByUrl: Business data found:", businessDetails.name);

          if (businessDetails) {
            const entitiesQuery = query(
              collection(db, "businessEntities"),
              where("businessId", "==", businessDetails.id),
              where("isActive", "==", true)
            );
            const entitiesSnapshot = await getDocs(entitiesQuery);
            console.log(`BusinessPublicPageByUrl: Fetched ${entitiesSnapshot.docs.length} active entities for business ${businessDetails.id}.`);
            
            const allActiveEntities: BusinessManagedEntity[] = [];
            entitiesSnapshot.forEach(docSnap => {
                const entityData = docSnap.data() as Omit<BusinessManagedEntity, 'id'>;
                
                let startDateStr: string;
                let endDateStr: string;
                const nowStr = new Date().toISOString();

                if (entityData.startDate instanceof Timestamp) {
                    startDateStr = entityData.startDate.toDate().toISOString();
                } else if (typeof entityData.startDate === 'string') {
                    startDateStr = entityData.startDate;
                } else if (entityData.startDate instanceof Date) {
                    startDateStr = entityData.startDate.toISOString();
                } else {
                    console.warn(`BusinessPage (Server): Entity ${docSnap.id} missing or invalid startDate. Using fallback.`);
                    startDateStr = nowStr; 
                }

                if (entityData.endDate instanceof Timestamp) {
                    endDateStr = entityData.endDate.toDate().toISOString();
                } else if (typeof entityData.endDate === 'string') {
                    endDateStr = entityData.endDate;
                } else if (entityData.endDate instanceof Date) {
                    endDateStr = entityData.endDate.toISOString();
                } else {
                    console.warn(`BusinessPage (Server): Entity ${docSnap.id} missing or invalid endDate. Using fallback.`);
                    endDateStr = nowStr; 
                }

                allActiveEntities.push({
                  id: docSnap.id,
                  businessId: entityData.businessId,
                  type: entityData.type,
                  name: entityData.name || "Entidad sin nombre",
                  description: entityData.description || "",
                  startDate: startDateStr,
                  endDate: endDateStr,
                  isActive: entityData.isActive,
                  usageLimit: entityData.usageLimit || 0,
                  maxAttendance: entityData.maxAttendance || 0,
                  ticketTypes: entityData.ticketTypes || [],
                  eventBoxes: entityData.eventBoxes || [],
                  assignedPromoters: entityData.assignedPromoters || [],
                  generatedCodes: entityData.generatedCodes || [],
                  imageUrl: entityData.imageUrl,
                  aiHint: entityData.aiHint,
                  termsAndConditions: entityData.termsAndConditions,
                  createdAt: entityData.createdAt instanceof Timestamp ? entityData.createdAt.toDate().toISOString() : (typeof entityData.createdAt === 'string' ? entityData.createdAt : undefined),
                });
            });
            activeEntitiesForBusiness = allActiveEntities.filter(isEntityCurrentlyActivatable).sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
          }
        }
    }
  } catch (err: any) {
    console.error("BusinessPublicPageByUrl: Error fetching business data (server):", err);
    fetchError = "No se pudo cargar la información del negocio. Inténtalo de nuevo más tarde.";
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <p className="text-3xl text-center font-bold text-blue-500 p-4 bg-yellow-200">VERIFICACIÓN CAMBIO NEGOCIO - vLATEST</p>
        <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm fixed top-0 left-0 right-0 z-20">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" passHref className="flex items-center gap-2 group">
                    <SocioVipLogo className="h-10 w-10 text-primary group-hover:animate-pulse" />
                    <div><span className="font-semibold text-2xl text-primary group-hover:text-primary/80">SocioVIP</span><p className="text-xs text-muted-foreground group-hover:text-primary/70">Conexiones que Premian</p></div>
                </Link>
                <PublicHeaderAuth />
            </div>
        </header>
        <div className="pt-24">
            <AlertTriangle className="h-20 w-20 text-destructive mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-destructive">{fetchError}</h1>
            <Link href="/" passHref className="mt-6">
              <Button variant="outline">Volver a la Página Principal</Button>
            </Link>
        </div>
        <footer className="w-full mt-12 py-8 bg-muted/50 text-center fixed bottom-0 left-0 right-0">
            <p className="text-sm text-muted-foreground">Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociosvip.app</Link></p>
        </footer>
      </div>
    );
  }

  if (!businessDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <p className="text-3xl text-center font-bold text-blue-500 p-4 bg-yellow-200">VERIFICACIÓN CAMBIO NEGOCIO - vLATEST (NO ENCONTRADO)</p>
        <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm fixed top-0 left-0 right-0 z-20">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" passHref className="flex items-center gap-2 group">
                    <SocioVipLogo className="h-10 w-10 text-primary group-hover:animate-pulse" />
                    <div><span className="font-semibold text-2xl text-primary group-hover:text-primary/80">SocioVIP</span><p className="text-xs text-muted-foreground group-hover:text-primary/70">Conexiones que Premian</p></div>
                </Link>
                <PublicHeaderAuth />
            </div>
        </header>
        <div className="pt-24">
            <Building className="h-20 w-20 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground">Negocio No Encontrado</h1>
            <p className="text-muted-foreground mt-2">La página del negocio con la URL "/b/{params.customUrlPath}" no existe o la URL es incorrecta.</p>
            <Link href="/" passHref className="mt-6">
              <Button variant="outline">Volver a la Página Principal</Button>
            </Link>
        </div>
        <footer className="w-full mt-12 py-8 bg-muted/50 text-center fixed bottom-0 left-0 right-0">
            <p className="text-sm text-muted-foreground">Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociosvip.app</Link></p>
        </footer>
      </div>
    );
  }

  const events = activeEntitiesForBusiness.filter(e => e.type === 'event');
  const promotions = activeEntitiesForBusiness.filter(e => e.type === 'promotion');

  console.log("BusinessPublicPageByUrl - businessDetails:", businessDetails);
  console.log("BusinessPublicPageByUrl - activeEntitiesForBusiness:", activeEntitiesForBusiness);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <p className="text-3xl text-center font-bold text-blue-500 p-4 bg-yellow-200">VERIFICACIÓN CAMBIO NEGOCIO - vLATEST</p>
      <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" passHref className="flex items-center gap-2 group">
                    <SocioVipLogo className="h-10 w-10 text-primary group-hover:animate-pulse" />
                    <div><span className="font-semibold text-2xl text-primary group-hover:text-primary/80">SocioVIP</span><p className="text-xs text-muted-foreground group-hover:text-primary/70">Conexiones que Premian</p></div>
                </Link>
                <PublicHeaderAuth />
            </div>
        </header>

        {businessDetails.publicCoverImageUrl && (
          <div className="relative h-48 md:h-64 lg:h-80 w-full">
            <Image
              src={businessDetails.publicCoverImageUrl}
              alt={`Portada de ${businessDetails.name}`}
              fill
              priority
              className="object-cover"
              data-ai-hint="business cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/10"></div>
          </div>
        )}
        <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${businessDetails.publicCoverImageUrl ? '-mt-16 md:-mt-20' : 'pt-12 pb-6'} relative z-10`}>
          <Card className="shadow-xl bg-card/90 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6 flex flex-col sm:flex-row items-center gap-4 md:gap-6">
              {businessDetails.logoUrl && (
                <Image
                  src={businessDetails.logoUrl}
                  alt={`Logo de ${businessDetails.name}`}
                  width={100}
                  height={100}
                  className="rounded-md object-contain h-20 w-20 sm:h-24 sm:w-24 border bg-background p-1 shadow-md"
                  data-ai-hint="business logo"
                />
              )}
              <div className="text-center sm:text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-primary">{businessDetails.name}</h1>
                {businessDetails.slogan && <p className="text-md text-muted-foreground mt-1">{businessDetails.slogan}</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <BusinessPublicPageClientContent 
          initialBusinessDetails={businessDetails} 
          initialActiveEntities={activeEntitiesForBusiness} 
        />

        <section className="mt-12 pt-8 border-t">
            <h2 className="text-xl font-semibold tracking-tight text-foreground mb-4 flex items-center">
                <MapPin className="h-6 w-6 mr-2 text-primary" />
                Información de Contacto
            </h2>
            <div className="space-y-2 text-sm text-muted-foreground">
                {businessDetails.publicAddress && <p><strong>Dirección:</strong> {businessDetails.publicAddress}</p>}
                {businessDetails.publicPhone && <p><strong>Teléfono:</strong> {businessDetails.publicPhone}</p>}
                {businessDetails.publicContactEmail && <p><strong>Email:</strong> <a href={`mailto:${businessDetails.publicContactEmail}`} className="text-primary hover:underline">{businessDetails.publicContactEmail}</a></p>}
                 {(!businessDetails.publicAddress && !businessDetails.publicPhone && !businessDetails.publicContactEmail) && (
                    <p>No hay información de contacto pública disponible para este negocio.</p>
                )}
            </div>
        </section>
      </main>

      <footer className="mt-12 py-8 bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground">
          Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociosvip.app</Link>
        </p>
      </footer>
    </div>
  );
}
