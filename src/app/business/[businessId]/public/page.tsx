
// src/app/business/[businessId]/public/page.tsx
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import type { Business, BusinessManagedEntity } from "@/lib/types";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { Building, CalendarDays, Tag, Phone, Mail, MapPin, Globe } from "lucide-react";
import Link from "next/link"; // Para posibles enlaces futuros

async function getBusinessDetails(businessId: string): Promise<Business | null> {
  console.log(`BusinessPublicPage: Fetching details for businessId: ${businessId}`);
  const businessRef = doc(db, "businesses", businessId);
  const businessSnap = await getDoc(businessRef);
  if (businessSnap.exists()) {
    const data = businessSnap.data();
    return { 
      id: businessSnap.id,
      ...data,
      // Asegurar que las fechas (si existen en Business y son Timestamps) se conviertan
      joinDate: data.joinDate instanceof Timestamp ? data.joinDate.toDate().toISOString() : data.joinDate,
    } as Business;
  }
  console.warn(`BusinessPublicPage: Business not found with ID: ${businessId}`);
  return null;
}

async function getBusinessEntities(businessId: string): Promise<BusinessManagedEntity[]> {
  console.log(`BusinessPublicPage: Fetching entities for businessId: ${businessId}`);
  const entitiesQuery = query(
    collection(db, "businessEntities"),
    where("businessId", "==", businessId),
    where("isActive", "==", true)
  );
  const entitiesSnapshot = await getDocs(entitiesQuery);
  const now = new Date();
  const validEntities: BusinessManagedEntity[] = [];

  entitiesSnapshot.forEach(docSnap => {
    const entityData = docSnap.data() as Omit<BusinessManagedEntity, 'id'>;
     const entity: BusinessManagedEntity = {
        id: docSnap.id,
        ...entityData,
        startDate: entityData.startDate instanceof Timestamp ? entityData.startDate.toDate().toISOString() : entityData.startDate,
        endDate: entityData.endDate instanceof Timestamp ? entityData.endDate.toDate().toISOString() : entityData.endDate,
        createdAt: entityData.createdAt instanceof Timestamp ? entityData.createdAt.toDate().toISOString() : entityData.createdAt,
      };
    if (isEntityCurrentlyActivatable(entity)) {
      validEntities.push(entity);
    }
  });
  console.log(`BusinessPublicPage: Found ${validEntities.length} active and current entities for businessId: ${businessId}`);
  return validEntities.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

export default async function BusinessPublicPage({ params }: { params: { businessId: string } }) {
  const businessId = params.businessId;
  const business = await getBusinessDetails(businessId);
  const entities = await getBusinessEntities(businessId);

  const events = entities.filter(entity => entity.type === 'event');
  const promotions = entities.filter(entity => entity.type === 'promotion');

  if (!business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
         <h1 className="text-3xl text-center font-bold text-red-500 p-4">VERIFICACIÓN CAMBIO NEGOCIO - vFINAL</h1>
        <Building className="h-24 w-24 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold text-destructive">Negocio No Encontrado</h1>
        <p className="text-muted-foreground">La página del negocio que buscas no existe o no está disponible.</p>
        <Link href="/" passHref className="mt-6">
          <Button variant="outline">Volver a la Página Principal</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <h1 className="text-3xl text-center font-bold text-blue-500 p-4 fixed top-0 left-0 bg-white/50 z-50 w-full">VERIFICACIÓN CAMBIO NEGOCIO - {business.name} - vFINAL</h1>
      
      {/* Business Header */}
      <header className="relative mt-16"> {/* mt-16 para dejar espacio al marcador */}
        {business.publicCoverImageUrl && (
          <div className="h-48 sm:h-64 md:h-80 w-full relative">
            <Image 
              src={business.publicCoverImageUrl} 
              alt={`${business.name} portada`} 
              fill 
              className="object-cover"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-black/30"></div> {/* Overlay oscuro opcional */}
          </div>
        )}
        <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${business.publicCoverImageUrl ? '-mt-16 sm:-mt-20 md:-mt-24 relative z-10' : 'py-8'}`}>
          <div className={`bg-card p-6 rounded-lg shadow-xl ${business.publicCoverImageUrl ? '' : 'border'}`}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              {business.logoUrl && (
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-md overflow-hidden border-2 border-primary bg-background flex-shrink-0">
                  <Image src={business.logoUrl} alt={`${business.name} logo`} fill className="object-contain p-1" sizes="128px" />
                </div>
              )}
              <div className="text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl font-bold text-primary">{business.name}</h1>
                {business.slogan && <p className="text-lg text-muted-foreground mt-1">{business.slogan}</p>}
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {business.publicAddress && <p className="flex items-center justify-center sm:justify-start"><MapPin className="h-4 w-4 mr-2 shrink-0" /> {business.publicAddress}</p>}
                  {business.publicPhone && <p className="flex items-center justify-center sm:justify-start"><Phone className="h-4 w-4 mr-2 shrink-0" /> {business.publicPhone}</p>}
                  {business.publicContactEmail && <p className="flex items-center justify-center sm:justify-start"><Mail className="h-4 w-4 mr-2 shrink-0" /> {business.publicContactEmail}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {entities.length === 0 && (
          <div className="text-center py-10">
            <Tag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">Este negocio no tiene eventos ni promociones activas en este momento.</p>
          </div>
        )}

        {events.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
              <CalendarDays className="h-7 w-7 mr-2.5" />
              Nuestros Próximos Eventos
            </h2>
            <div className="space-y-6">
              {events.map((event) => (
                <Card key={event.id} className="shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col sm:flex-row overflow-hidden rounded-lg">
                  {event.imageUrl && (
                     <div className="sm:w-1/3 relative aspect-[16/9] sm:aspect-auto">
                      <Image
                        src={event.imageUrl}
                        alt={event.name || "Evento"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 33vw"
                        data-ai-hint={event.aiHint || "event stage"}
                      />
                    </div>
                  )}
                  <div className="sm:w-2/3 flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-xl">{event.name}</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Del {format(parseISO(event.startDate), "dd MMM, yyyy 'a las' HH:mm", { locale: es })} al {format(parseISO(event.endDate), "dd MMM, yyyy 'a las' HH:mm", { locale: es })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
                       {event.termsAndConditions && <p className="mt-2 text-xs text-muted-foreground/80"><strong>T&C:</strong> {event.termsAndConditions}</p>}
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" className="w-full sm:w-auto" disabled> {/* Botón deshabilitado por ahora */}
                        Obtener Código/QR (Próximamente)
                      </Button>
                    </CardFooter>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {promotions.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-primary mb-4 flex items-center">
              <Tag className="h-7 w-7 mr-2.5" />
              Promociones Vigentes
            </h2>
            <div className="space-y-6">
              {promotions.map((promo) => (
                <Card key={promo.id} className="shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col sm:flex-row overflow-hidden rounded-lg">
                  {promo.imageUrl && (
                     <div className="sm:w-1/3 relative aspect-[16/9] sm:aspect-auto">
                      <Image
                        src={promo.imageUrl}
                        alt={promo.name || "Promoción"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 33vw"
                        data-ai-hint={promo.aiHint || "special offer"}
                      />
                    </div>
                  )}
                   <div className="sm:w-2/3 flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-xl">{promo.name}</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Válido hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-sm text-muted-foreground line-clamp-3">{promo.description}</p>
                       {promo.termsAndConditions && <p className="mt-2 text-xs text-muted-foreground/80"><strong>T&C:</strong> {promo.termsAndConditions}</p>}
                    </CardContent>
                    <CardFooter>
                       <Button variant="outline" className="w-full sm:w-auto" disabled> {/* Botón deshabilitado por ahora */}
                        Obtener Código/QR (Próximamente)
                      </Button>
                    </CardFooter>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer className="mt-12 py-8 bg-muted/50 text-center">
        <Link href="/" passHref>
            <Button variant="ghost" className="text-sm text-primary hover:underline">Volver a SocioVIP Principal</Button>
        </Link>
      </footer>
    </div>
  );
}

    