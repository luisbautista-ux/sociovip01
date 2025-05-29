
// src/app/business/[businessId]/public/page.tsx
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc, Timestamp } from "firebase/firestore";
import type { Business, BusinessManagedEntity } from "@/lib/types";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link"; // Added import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CalendarDays, Tag, MapPin, Phone, Mail } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { SocioVipLogo } from "@/components/icons"; // Assuming you might want SocioVipLogo here

async function getBusinessDetails(businessId: string): Promise<Business | null> {
  console.log(`BusinessPublicPage: Fetching details for businessId: ${businessId}`);
  if (!businessId || typeof businessId !== 'string' || businessId.trim() === '') {
    console.error("BusinessPublicPage: Invalid businessId provided to getBusinessDetails:", businessId);
    return null;
  }
  try {
    const businessDocRef = doc(db, "businesses", businessId);
    const businessDocSnap = await getDoc(businessDocRef);
    if (businessDocSnap.exists()) {
      const data = businessDocSnap.data();
      console.log(`BusinessPublicPage: Business data found for ${businessId}:`, data);
      return {
        id: businessDocSnap.id,
        name: data.name || "Negocio sin nombre",
        contactEmail: data.contactEmail || "",
        joinDate: data.joinDate instanceof Timestamp ? data.joinDate.toDate().toISOString() : String(data.joinDate || new Date().toISOString()),
        activePromotions: data.activePromotions || 0,
        ruc: data.ruc,
        razonSocial: data.razonSocial,
        department: data.department,
        province: data.province,
        district: data.district,
        address: data.address,
        managerName: data.managerName,
        managerDni: data.managerDni,
        businessType: data.businessType,
        customUrlPath: data.customUrlPath,
        logoUrl: data.logoUrl,
        publicCoverImageUrl: data.publicCoverImageUrl,
        slogan: data.slogan,
        publicContactEmail: data.publicContactEmail,
        publicPhone: data.publicPhone,
        publicAddress: data.publicAddress,
      } as Business;
    } else {
      console.warn(`BusinessPublicPage: No business found with ID: ${businessId}`);
      return null;
    }
  } catch (error) {
    console.error(`BusinessPublicPage: Error fetching business details for ${businessId}:`, error);
    return null;
  }
}

async function getBusinessEntities(businessId: string): Promise<BusinessManagedEntity[]> {
  console.log(`BusinessPublicPage: Fetching entities for businessId: ${businessId}`);
   if (!businessId || typeof businessId !== 'string' || businessId.trim() === '') {
    console.error("BusinessPublicPage: Invalid businessId provided to getBusinessEntities:", businessId);
    return [];
  }
  try {
    const entitiesQuery = query(
      collection(db, "businessEntities"),
      where("businessId", "==", businessId),
      where("isActive", "==", true)
    );
    const snapshot = await getDocs(entitiesQuery);
    const now = new Date();
    const nowStr = now.toISOString();
    console.log(`BusinessPublicPage: Found ${snapshot.docs.length} active entities for business ${businessId} before date filtering.`);

    const entities = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      
      let startDateStr: string;
      let endDateStr: string;

      if (data.startDate instanceof Timestamp) {
        startDateStr = data.startDate.toDate().toISOString();
      } else if (typeof data.startDate === 'string') {
        startDateStr = data.startDate;
      } else if (data.startDate instanceof Date) {
        startDateStr = data.startDate.toISOString();
      } else {
        console.warn(`BusinessPublicPage: Entity ${docSnap.id} missing or invalid startDate. Using fallback.`);
        startDateStr = nowStr; 
      }

      if (data.endDate instanceof Timestamp) {
        endDateStr = data.endDate.toDate().toISOString();
      } else if (typeof data.endDate === 'string') {
        endDateStr = data.endDate;
      } else if (data.endDate instanceof Date) {
        endDateStr = data.endDate.toISOString();
      } else {
        console.warn(`BusinessPublicPage: Entity ${docSnap.id} missing or invalid endDate. Using fallback.`);
        endDateStr = nowStr;
      }
      
      return {
        id: docSnap.id,
        businessId: data.businessId,
        type: data.type,
        name: data.name,
        description: data.description,
        startDate: startDateStr,
        endDate: endDateStr,
        usageLimit: data.usageLimit,
        maxAttendance: data.maxAttendance,
        isActive: data.isActive,
        imageUrl: data.imageUrl,
        aiHint: data.aiHint,
        termsAndConditions: data.termsAndConditions,
        // For a server component, we don't typically need to pass generatedCodes, ticketTypes etc.
        // unless this page directly allows interaction with them.
        // For now, keeping it simple for display.
      } as BusinessManagedEntity;
    }).filter(entity => isEntityCurrentlyActivatable(entity)); // Filter for current validity
    
    console.log(`BusinessPublicPage: Filtered to ${entities.length} currently activatable entities for business ${businessId}.`);
    return entities;
  } catch (error) {
    console.error(`BusinessPublicPage: Error fetching entities for business ${businessId}:`, error);
    return [];
  }
}


export default async function BusinessPublicPage({ params }: { params: { businessId: string } }) {
  const businessDetails = await getBusinessDetails(params.businessId);
  const entities = await getBusinessEntities(params.businessId);

  // const [showLoginModal, setShowLoginModal] = useState(false); // State for modal in client component

  if (!businessDetails) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        {/* <h1 className="text-3xl text-center font-bold text-blue-500 p-4">VERIFICACIÓN CAMBIO NEGOCIO - v3</h1> */}
        <SocioVipLogo className="h-20 w-20 text-primary mb-6" />
        <h1 className="text-3xl font-bold text-destructive mb-4">Negocio No Encontrado</h1>
        <p className="text-muted-foreground mb-6">
          No pudimos encontrar la información para el negocio solicitado.
        </p>
        <Link href="/" passHref>
          <Button>Volver a la Página Principal</Button>
        </Link>
      </div>
    );
  }

  const businessPromotions = entities.filter(e => e.type === 'promotion');
  const businessEvents = entities.filter(e => e.type === 'event');

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* <h1 className="text-3xl text-center font-bold text-blue-500 p-4">VERIFICACIÓN CAMBIO NEGOCIO - v3</h1> */}
      {/* Placeholder for PublicHeaderAuth - to be implemented with a Client Component wrapper */}
      <header className="py-6 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center text-center md:text-left">
          {businessDetails.logoUrl ? (
            <Image
              src={businessDetails.logoUrl}
              alt={`${businessDetails.name} logo`}
              width={100}
              height={100}
              className="object-contain rounded-md mb-4 md:mb-0 md:mr-6"
              data-ai-hint={`${businessDetails.name || 'business'} logo`}
            />
          ) : (
            <div className="h-24 w-24 bg-muted rounded-md flex items-center justify-center text-muted-foreground text-sm mb-4 md:mb-0 md:mr-6">
              Sin Logo
            </div>
          )}
          <div>
            <h1 className="text-4xl font-bold tracking-tight">{businessDetails.name}</h1>
            {businessDetails.slogan && (
              <p className="mt-1 text-lg text-primary-foreground/90">
                {businessDetails.slogan}
              </p>
            )}
          </div>
          {/* <div className="mt-4 md:ml-auto p-2 border border-dashed border-primary-foreground/50 rounded-md">
            <p className="text-xs">[PublicHeaderAuth Placeholder]</p>
          </div> */}
        </div>
        {businessDetails.publicCoverImageUrl && (
          <div className="mt-6 max-w-5xl mx-auto h-48 md:h-64 relative overflow-hidden rounded-lg">
            <Image
              src={businessDetails.publicCoverImageUrl}
              alt={`${businessDetails.name} cover image`}
              fill
              className="object-cover"
              data-ai-hint={`${businessDetails.name || 'business'} exterior`}
            />
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Business Contact Info - Could be a separate section or card */}
        <Card className="mb-10 shadow-lg">
          <CardHeader>
            <CardTitle>Información de Contacto</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {businessDetails.publicAddress && (
              <div className="flex items-start">
                <MapPin className="h-5 w-5 mr-2 mt-0.5 text-primary flex-shrink-0" />
                <div>
                  <h3 className="font-semibold">Dirección</h3>
                  <p className="text-muted-foreground">{businessDetails.publicAddress}</p>
                  {businessDetails.district && businessDetails.province && businessDetails.department && (
                     <p className="text-xs text-muted-foreground/80">{businessDetails.district}, {businessDetails.province}, {businessDetails.department}</p>
                  )}
                </div>
              </div>
            )}
            {businessDetails.publicPhone && (
              <div className="flex items-start">
                <Phone className="h-5 w-5 mr-2 mt-0.5 text-primary flex-shrink-0" />
                 <div>
                  <h3 className="font-semibold">Teléfono</h3>
                  <p className="text-muted-foreground">{businessDetails.publicPhone}</p>
                </div>
              </div>
            )}
            {businessDetails.publicContactEmail && (
              <div className="flex items-start">
                <Mail className="h-5 w-5 mr-2 mt-0.5 text-primary flex-shrink-0" />
                <div>
                  <h3 className="font-semibold">Email</h3>
                  <p className="text-muted-foreground">{businessDetails.publicContactEmail}</p>
                </div>
              </div>
            )}
             {businessDetails.businessType && (
              <div className="flex items-start">
                <Tag className="h-5 w-5 mr-2 mt-0.5 text-primary flex-shrink-0" />
                 <div>
                  <h3 className="font-semibold">Giro de Negocio</h3>
                  <p className="text-muted-foreground">{businessDetails.businessType}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>


        {businessEvents.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-primary mb-6 flex items-center">
              <CalendarDays className="h-8 w-8 mr-3" />
              Nuestros Próximos Eventos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {businessEvents.map((event) => (
                <Card key={event.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg">
                  {event.imageUrl && (
                    <div className="relative aspect-[16/9] w-full">
                      <Image
                        src={event.imageUrl}
                        alt={event.name || "Evento"}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover"
                        data-ai-hint={event.aiHint || "event party"}
                      />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{event.name}</CardTitle>
                    <CardDescription>
                      Del {format(parseISO(event.startDate), "dd MMM, yyyy", { locale: es })}
                      {event.endDate !== event.startDate && ` al ${format(parseISO(event.endDate), "dd MMM, yyyy", { locale: es })}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-4 mb-2">{event.description}</p>
                    {event.termsAndConditions && (
                       <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-2"><strong>Términos:</strong> {event.termsAndConditions}</p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled> {/* Placeholder - to be implemented */}
                      Obtener Código/QR
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {businessPromotions.length > 0 && (
          <section>
            <h2 className="text-3xl font-bold tracking-tight text-primary mb-6 flex items-center">
              <Tag className="h-8 w-8 mr-3" />
              Promociones Vigentes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {businessPromotions.map((promo) => (
                <Card key={promo.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg">
                  {promo.imageUrl && (
                    <div className="relative aspect-[16/9] w-full">
                      <Image
                        src={promo.imageUrl}
                        alt={promo.name || "Promoción"}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
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
                    <p className="text-sm text-muted-foreground line-clamp-4 mb-2">{promo.description}</p>
                    {promo.termsAndConditions && (
                       <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-2"><strong>Términos:</strong> {promo.termsAndConditions}</p>
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

        {!businessEvents.length && !businessPromotions.length && (
           <div className="text-center py-10">
            <Tag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">Este negocio no tiene eventos ni promociones activas en este momento.</p>
          </div>
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
