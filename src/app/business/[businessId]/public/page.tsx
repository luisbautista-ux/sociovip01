
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import type { BusinessManagedEntity, Business } from "@/lib/types";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Tag, Info, Building, Phone, Mail, Globe } from "lucide-react";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
// Placeholder for PublicHeaderAuth - To be implemented later
// import PublicHeaderAuth from "@/components/layout/PublicHeaderAuth";

async function getBusinessDetails(businessId: string): Promise<Business | null> {
  try {
    const businessRef = doc(db, "businesses", businessId);
    const businessSnap = await getDoc(businessRef);
    if (businessSnap.exists()) {
      const data = businessSnap.data();
      return {
        id: businessSnap.id,
        name: data.name || "Negocio Desconocido",
        contactEmail: data.contactEmail, // Internal contact
        joinDate: data.joinDate, // Keep as is, might not be public
        activePromotions: 0, // Not relevant for public display
        // Public fields
        logoUrl: data.logoUrl,
        publicCoverImageUrl: data.publicCoverImageUrl,
        slogan: data.slogan,
        publicContactEmail: data.publicContactEmail,
        publicPhone: data.publicPhone,
        publicAddress: data.publicAddress,
        customUrlPath: data.customUrlPath,
        // Other business fields if needed publicly
      } as Business;
    }
    return null;
  } catch (error) {
    console.error("Error fetching business details:", error);
    return null;
  }
}

async function getBusinessEntities(businessId: string): Promise<BusinessManagedEntity[]> {
  try {
    const entitiesQuery = query(
      collection(db, "businessEntities"),
      where("businessId", "==", businessId),
      where("isActive", "==", true)
    );
    const entitiesSnapshot = await getDocs(entitiesQuery);
    const nowStr = new Date().toISOString(); // Fallback for missing dates

    const entities: BusinessManagedEntity[] = [];
    entitiesSnapshot.forEach(docSnap => {
      const entityData = docSnap.data() as Omit<BusinessManagedEntity, 'id'>;
      
      let startDateStr: string;
      let endDateStr: string;

      if (entityData.startDate instanceof Timestamp) {
        startDateStr = entityData.startDate.toDate().toISOString();
      } else if (typeof entityData.startDate === 'string') {
        startDateStr = entityData.startDate;
      } else if (entityData.startDate instanceof Date) {
        startDateStr = entityData.startDate.toISOString();
      } else {
        console.warn(`BusinessPage: Entity ${docSnap.id} missing or invalid startDate. Using fallback.`);
        startDateStr = nowStr; 
      }

      if (entityData.endDate instanceof Timestamp) {
        endDateStr = entityData.endDate.toDate().toISOString();
      } else if (typeof entityData.endDate === 'string') {
        endDateStr = entityData.endDate;
      } else if (entityData.endDate instanceof Date) {
        endDateStr = entityData.endDate.toISOString();
      } else {
        console.warn(`BusinessPage: Entity ${docSnap.id} missing or invalid endDate. Using fallback.`);
        endDateStr = nowStr;
      }

      const entity: BusinessManagedEntity = {
        id: docSnap.id,
        businessId: entityData.businessId,
        type: entityData.type,
        name: entityData.name,
        description: entityData.description,
        startDate: startDateStr,
        endDate: endDateStr,
        usageLimit: entityData.usageLimit,
        maxAttendance: entityData.maxAttendance,
        isActive: entityData.isActive, // Should be true due to query
        imageUrl: entityData.imageUrl,
        aiHint: entityData.aiHint,
        termsAndConditions: entityData.termsAndConditions,
        // No need for generatedCodes, ticketTypes, etc. on this public summary
      };
      if (isEntityCurrentlyActivatable(entity)) {
        entities.push(entity);
      }
    });
    return entities.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  } catch (error) {
    console.error(`Error fetching entities for business ${businessId}:`, error);
    return [];
  }
}


export default async function BusinessPublicPage({ params }: { params: { businessId: string } }) {
  const businessId = params.businessId;
  const businessDetails = await getBusinessDetails(businessId);
  const entities = await getBusinessEntities(businessId);

  console.log(`BusinessPage: Fetched business ${businessId} details:`, businessDetails ? businessDetails.name : "Not Found");
  console.log(`BusinessPage: Fetched ${entities.length} active & current entities for business ${businessId}.`);

  if (!businessDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        {/* <h1 className="text-3xl text-center font-bold text-blue-500 p-4">VERIFICACIÓN CAMBIO NEGOCIO - vFINAL</h1> */}
        <Building className="w-24 h-24 text-muted-foreground mb-4" />
        <h1 className="text-4xl font-bold mb-2">Negocio no Encontrado</h1>
        <p className="text-lg text-muted-foreground">
          No pudimos encontrar la página del negocio que estás buscando.
        </p>
        <Link href="/" passHref className="mt-6">
          <Button>Volver a la Página Principal</Button>
        </Link>
      </div>
    );
  }

  const events = entities.filter(e => e.type === 'event');
  const promotions = entities.filter(e => e.type === 'promotion');

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* <h1 className="text-3xl text-center font-bold text-blue-500 p-4">VERIFICACIÓN CAMBIO NEGOCIO - vFINAL</h1> */}

      {/* Placeholder for PublicHeaderAuth - To be implemented later */}
      {/* <div className="p-4 border-b border-dashed">
        <p className="text-xs text-center">[PublicHeaderAuth Placeholder: Login/User Info Here]</p>
      </div> */}
      
      {/* Business Header */}
      <header className="relative">
        {businessDetails.publicCoverImageUrl && (
          <div className="relative h-48 md:h-64 lg:h-80 w-full">
            <Image
              src={businessDetails.publicCoverImageUrl}
              alt={`Portada de ${businessDetails.name}`}
              fill
              className="object-cover"
              data-ai-hint="storefront cover"
              priority
            />
            <div className="absolute inset-0 bg-black/30"></div> {/* Overlay */}
          </div>
        )}
        <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${businessDetails.publicCoverImageUrl ? 'relative -mt-16 md:-mt-20 pb-8' : 'py-8'}`}>
          <div className="flex flex-col items-center text-center bg-card p-6 rounded-lg shadow-xl">
            {businessDetails.logoUrl && (
              <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-background mb-4 shadow-md">
                <Image
                  src={businessDetails.logoUrl}
                  alt={`Logo de ${businessDetails.name}`}
                  fill
                  className="object-contain"
                  data-ai-hint="business logo"
                />
              </div>
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-primary">{businessDetails.name}</h1>
            {businessDetails.slogan && <p className="mt-2 text-lg text-muted-foreground">{businessDetails.slogan}</p>}
            
            <div className="mt-4 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {businessDetails.publicAddress && (
                <span className="flex items-center"><Building className="h-4 w-4 mr-1.5" /> {businessDetails.publicAddress}</span>
              )}
              {businessDetails.publicPhone && (
                <span className="flex items-center"><Phone className="h-4 w-4 mr-1.5" /> {businessDetails.publicPhone}</span>
              )}
              {businessDetails.publicContactEmail && (
                <span className="flex items-center"><Mail className="h-4 w-4 mr-1.5" /> {businessDetails.publicContactEmail}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {events.length === 0 && promotions.length === 0 && (
           <div className="text-center py-10">
            <Tag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">Este negocio no tiene eventos ni promociones activos en este momento.</p>
          </div>
        )}

        {events.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-primary mb-6 flex items-center">
              <CalendarDays className="h-8 w-8 mr-3" /> Eventos en {businessDetails.name}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map(event => (
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
                    <CardDescription>Del {format(parseISO(event.startDate), "dd MMM, HH:mm", { locale: es })} al {format(parseISO(event.endDate), "dd MMM, HH:mm yyyy", { locale: es })}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-2">
                    <p className="text-sm text-muted-foreground line-clamp-4">{event.description}</p>
                    {event.termsAndConditions && (
                        <p className="text-xs text-muted-foreground/80 italic line-clamp-2">T&C: {event.termsAndConditions}</p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled> {/* Placeholder */}
                        Obtener Código/QR
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {promotions.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-primary mb-6 flex items-center">
              <Tag className="h-8 w-8 mr-3" /> Promociones en {businessDetails.name}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map(promo => (
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
                    <CardDescription>Válido hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-2">
                    <p className="text-sm text-muted-foreground line-clamp-4">{promo.description}</p>
                     {promo.termsAndConditions && (
                        <p className="text-xs text-muted-foreground/80 italic line-clamp-2">T&C: {promo.termsAndConditions}</p>
                    )}
                  </CardContent>
                   <CardFooter>
                    <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled> {/* Placeholder */}
                        Obtener Código/QR
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="mt-12 py-8 bg-muted/50 text-center">
        <Link href="/" passHref>
            <Button variant="link" className="text-sm text-primary">Volver a Todas las Promociones y Eventos</Button>
        </Link>
        <p className="text-sm text-muted-foreground mt-2">&copy; {new Date().getFullYear()} {businessDetails.name}</p>
      </footer>
    </div>
  );
}

    