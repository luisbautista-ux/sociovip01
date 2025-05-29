
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import type { Business, BusinessManagedEntity } from "@/lib/types";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { Building, CalendarDays, Tag, Mail, Phone, MapPin, ExternalLink } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { PublicHeaderAuth } from "@/components/layout/PublicHeaderAuth"; // Importar

async function getBusinessData(customUrlPath: string): Promise<Business | null> {
  console.log("BusinessPublicPage: Fetching business with customUrlPath:", customUrlPath);
  if (!customUrlPath || typeof customUrlPath !== 'string' || customUrlPath.trim() === '') {
    console.warn("BusinessPublicPage: Invalid customUrlPath provided.");
    return null;
  }
  const businessQuery = query(collection(db, "businesses"), where("customUrlPath", "==", customUrlPath));
  const businessSnap = await getDocs(businessQuery);

  if (businessSnap.empty) {
    console.warn("BusinessPublicPage: No business found for customUrlPath:", customUrlPath);
    return null;
  }
  const businessDoc = businessSnap.docs[0];
  const businessData = businessDoc.data() as Omit<Business, 'id'>;
  console.log("BusinessPublicPage: Business data found:", businessData.name);
  return { 
    id: businessDoc.id, 
    ...businessData,
    // Ensure date fields are strings if they come as Timestamps for consistency
    joinDate: businessData.joinDate instanceof Timestamp ? businessData.joinDate.toDate().toISOString() : String(businessData.joinDate),
  };
}

async function getBusinessEntities(businessId: string): Promise<BusinessManagedEntity[]> {
  console.log("BusinessPublicPage: Fetching entities for businessId:", businessId);
  const entitiesQuery = query(
    collection(db, "businessEntities"),
    where("businessId", "==", businessId),
    where("isActive", "==", true)
  );
  const entitiesSnap = await getDocs(entitiesQuery);
  console.log(`BusinessPublicPage: Fetched ${entitiesSnap.docs.length} active entities for business ${businessId}.`);

  const now = new Date();
  const validEntities: BusinessManagedEntity[] = [];

  entitiesSnap.forEach(docSnap => {
    const entityData = docSnap.data() as Omit<BusinessManagedEntity, 'id'>;
    
    let startDateStr: string;
    let endDateStr: string;
    const defaultDateStr = now.toISOString();

    if (entityData.startDate instanceof Timestamp) {
      startDateStr = entityData.startDate.toDate().toISOString();
    } else if (typeof entityData.startDate === 'string') {
      startDateStr = entityData.startDate;
    } else if (entityData.startDate instanceof Date) {
      startDateStr = entityData.startDate.toISOString();
    } else {
      console.warn(`BusinessPublicPage: Entity ${docSnap.id} for business ${businessId} missing or invalid startDate. Using fallback.`);
      startDateStr = defaultDateStr; 
    }

    if (entityData.endDate instanceof Timestamp) {
      endDateStr = entityData.endDate.toDate().toISOString();
    } else if (typeof entityData.endDate === 'string') {
      endDateStr = entityData.endDate;
    } else if (entityData.endDate instanceof Date) {
      endDateStr = entityData.endDate.toISOString();
    } else {
      console.warn(`BusinessPublicPage: Entity ${docSnap.id} for business ${businessId} missing or invalid endDate. Using fallback.`);
      endDateStr = defaultDateStr;
    }

    const entity: BusinessManagedEntity = {
      id: docSnap.id,
      businessId: entityData.businessId,
      type: entityData.type,
      name: entityData.name,
      description: entityData.description,
      startDate: startDateStr,
      endDate: endDateStr,
      isActive: entityData.isActive, // isActive is already true from query
      // Fill other required fields with defaults or from entityData
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
    };
    if (isEntityCurrentlyActivatable(entity)) {
      validEntities.push(entity);
    }
  });
  console.log(`BusinessPublicPage: Filtered to ${validEntities.length} currently activatable entities for business ${businessId}.`);
  return validEntities.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}


export default async function BusinessPublicPage({ params }: { params: { customUrlPath: string } }) {
  const businessDetails = await getBusinessData(params.customUrlPath);

  if (!businessDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        <SocioVipLogo className="h-20 w-20 text-destructive mb-4" />
        <h1 className="text-3xl font-bold text-destructive">Negocio No Encontrado</h1>
        <p className="text-muted-foreground mt-2">
          La página del negocio que buscas no existe o la URL es incorrecta.
        </p>
        <Link href="/" passHref className="mt-6">
          <Button variant="outline">Volver a la Página Principal</Button>
        </Link>
      </div>
    );
  }

  const entities = await getBusinessEntities(businessDetails.id);
  const events = entities.filter(e => e.type === 'event');
  const promotions = entities.filter(e => e.type === 'promotion');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="relative">
         {/* Branding and Auth Header */}
        <div className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" passHref className="flex items-center gap-2 group">
                    <SocioVipLogo className="h-8 w-8 text-primary group-hover:animate-pulse" />
                    <span className="font-semibold text-xl text-primary group-hover:text-primary/80">SocioVIP</span>
                </Link>
                <PublicHeaderAuth />
            </div>
        </div>

        {businessDetails.publicCoverImageUrl && (
          <div className="relative h-48 md:h-64 lg:h-80 w-full">
            <Image
              src={businessDetails.publicCoverImageUrl}
              alt={`Portada de ${businessDetails.name}`}
              fill
              className="object-cover"
              data-ai-hint="business cover"
              priority
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
      </header>
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {events.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
              <CalendarDays className="h-7 w-7 mr-3 text-primary" />
              Nuestros Próximos Eventos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Card key={event.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg">
                  {event.imageUrl && (
                    <div className="relative aspect-[16/9] w-full">
                      <Image
                        src={event.imageUrl}
                        alt={event.name || "Evento"}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover"
                        data-ai-hint={event.aiHint || "event party"}
                      />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{event.name}</CardTitle>
                    <CardDescription>
                      Del {format(parseISO(event.startDate), "dd MMM, HH:mm", { locale: es })} al {format(parseISO(event.endDate), "dd MMM, HH:mm 'hrs'", { locale: es })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-4">{event.description}</p>
                    {event.termsAndConditions && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">T&C: {event.termsAndConditions}</p>}
                  </CardContent>
                  <CardFooter>
                    <Button disabled className="w-full bg-primary hover:bg-primary/90 opacity-50 cursor-not-allowed">
                      Obtener Código/QR (Próximamente)
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {promotions.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
              <Tag className="h-7 w-7 mr-3 text-primary" />
              Promociones Vigentes
            </h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((promo) => (
                <Card key={promo.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg">
                  {promo.imageUrl && (
                    <div className="relative aspect-[16/9] w-full">
                      <Image
                        src={promo.imageUrl}
                        alt={promo.name || "Promoción"}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover"
                        data-ai-hint={promo.aiHint || "discount offer"}
                      />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{promo.name}</CardTitle>
                    <CardDescription>
                      Válido hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-4">{promo.description}</p>
                     {promo.termsAndConditions && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">T&C: {promo.termsAndConditions}</p>}
                  </CardContent>
                   <CardFooter>
                    <Button disabled className="w-full bg-primary hover:bg-primary/90 opacity-50 cursor-not-allowed">
                        Obtener Código/QR (Próximamente)
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {!events.length && !promotions.length && (
           <div className="text-center py-10">
            <Tag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">Este negocio no tiene eventos ni promociones activas en este momento.</p>
          </div>
        )}

        <section className="mt-12 pt-8 border-t">
            <h2 className="text-xl font-semibold tracking-tight text-foreground mb-4 flex items-center">
                <MapPin className="h-6 w-6 mr-2 text-primary" />
                Información de Contacto
            </h2>
            <div className="space-y-2 text-sm text-muted-foreground">
                {businessDetails.publicAddress && <p><strong>Dirección:</strong> {businessDetails.publicAddress}</p>}
                {businessDetails.publicPhone && <p><strong>Teléfono:</strong> {businessDetails.publicPhone}</p>}
                {businessDetails.publicContactEmail && <p><strong>Email:</strong> {businessDetails.publicContactEmail}</p>}
            </div>
        </section>
      </main>

      <footer className="mt-12 py-8 bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground">
          Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociovip.app</Link>
        </p>
      </footer>
    </div>
  );
}
