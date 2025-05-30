
"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, doc } from "firebase/firestore";
import type { BusinessManagedEntity, Business } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { Loader2, Building, Tag, CalendarDays, ExternalLink, PackageOpen } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { PublicHeaderAuth } from "@/components/layout/PublicHeaderAuth";

interface PublicDisplayEntity extends BusinessManagedEntity {
  businessName?: string;
  businessLogoUrl?: string;
  businessCustomUrlPath?: string;
}

export default function HomePage() {
  const [publicEntities, setPublicEntities] = useState<PublicDisplayEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPublicEntitiesAndBusinesses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log("HomePage: Fetching public entities and businesses...");
    try {
      const businessesSnapshot = await getDocs(collection(db, "businesses"));
      const businessesMap = new Map<string, Business>();
      businessesSnapshot.forEach(docSnap => {
        const bizData = docSnap.data() as Business;
        businessesMap.set(docSnap.id, { id: docSnap.id, ...bizData });
      });
      console.log(`HomePage: Fetched ${businessesMap.size} businesses.`);

      const entitiesQuery = query(collection(db, "businessEntities"), where("isActive", "==", true));
      const entitiesSnapshot = await getDocs(entitiesQuery);
      console.log(`HomePage: Fetched ${entitiesSnapshot.docs.length} active business entities initially.`);

      const allActiveEntities: PublicDisplayEntity[] = [];
      entitiesSnapshot.forEach(docSnap => {
        const entityData = docSnap.data();
        
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
          console.warn(`HomePage: Entity ${docSnap.id} for business ${entityData.businessId} missing or invalid startDate. Using fallback.`);
          startDateStr = nowStr;
        }

        if (entityData.endDate instanceof Timestamp) {
          endDateStr = entityData.endDate.toDate().toISOString();
        } else if (typeof entityData.endDate === 'string') {
          endDateStr = entityData.endDate;
        } else if (entityData.endDate instanceof Date) {
          endDateStr = entityData.endDate.toISOString();
        } else {
          console.warn(`HomePage: Entity ${docSnap.id} for business ${entityData.businessId} missing or invalid endDate. Using fallback.`);
          endDateStr = nowStr;
        }
        
        const entity: BusinessManagedEntity = {
          id: docSnap.id,
          businessId: entityData.businessId,
          type: entityData.type,
          name: entityData.name || "Entidad sin nombre",
          description: entityData.description || "",
          startDate: startDateStr,
          endDate: endDateStr,
          isActive: entityData.isActive === undefined ? true : entityData.isActive,
          usageLimit: entityData.usageLimit || 0,
          maxAttendance: entityData.maxAttendance || 0,
          ticketTypes: entityData.ticketTypes || [],
          eventBoxes: entityData.eventBoxes || [],
          assignedPromoters: entityData.assignedPromoters || [],
          generatedCodes: entityData.generatedCodes || [],
          imageUrl: entityData.imageUrl,
          aiHint: entityData.aiHint,
          termsAndConditions: entityData.termsAndConditions,
          createdAt: entityData.createdAt instanceof Timestamp
            ? entityData.createdAt.toDate().toISOString()
            : (typeof entityData.createdAt === 'string' ? entityData.createdAt : (entityData.createdAt instanceof Date ? entityData.createdAt.toISOString() : undefined)),
        };

        if (isEntityCurrentlyActivatable(entity)) {
          const business = businessesMap.get(entity.businessId);
          if (business) {
            allActiveEntities.push({
              ...entity,
              businessName: business.name,
              businessLogoUrl: business.logoUrl,
              businessCustomUrlPath: business.customUrlPath,
            });
          } else {
            console.warn(`HomePage: Business not found for entity ${entity.id} with businessId ${entity.businessId}.`);
            allActiveEntities.push(entity); // Show entity even if business details are missing for now
          }
        }
      });
      
      console.log(`HomePage: Filtered to ${allActiveEntities.length} currently activatable entities with business info.`);
      const sortedEntities = allActiveEntities.sort((a, b) => {
        if (a.type === 'event' && b.type !== 'event') return -1;
        if (a.type !== 'event' && b.type === 'event') return 1;
        const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
        return bDate - aDate;
      });
      setPublicEntities(sortedEntities);

    } catch (err: any) {
      console.error("HomePage: Error fetching public data:", err);
      setError("No se pudieron cargar las promociones y eventos. Inténtalo de nuevo más tarde.");
      setPublicEntities([]);
    } finally {
      setIsLoading(false);
      console.log("HomePage: Fetching complete. isLoading set to false.");
    }
  }, []);

  useEffect(() => {
    fetchPublicEntitiesAndBusinesses();
  }, [fetchPublicEntitiesAndBusinesses]);

  const events = publicEntities.filter(entity => entity.type === 'event');
  const promotions = publicEntities.filter(entity => entity.type === 'promotion');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" passHref className="flex items-center gap-2 group">
                <SocioVipLogo className="h-10 w-10 text-primary group-hover:animate-pulse" />
                <div>
                  <span className="font-semibold text-2xl text-primary group-hover:text-primary/80">SocioVIP</span>
                  <p className="text-xs text-muted-foreground group-hover:text-primary/70">Conexiones que Premian</p>
                </div>
            </Link>
            <PublicHeaderAuth />
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
       
        {isLoading && (
          <div className="flex justify-center items-center min-h-[300px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-3 text-lg text-muted-foreground">Cargando contenido...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-10">
            <p className="text-xl text-destructive">{error}</p>
            <Button onClick={fetchPublicEntitiesAndBusinesses} className="mt-4">Reintentar</Button>
          </div>
        )}

        {!isLoading && !error && publicEntities.length === 0 && (
          <div className="text-center py-10">
            <PackageOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">No hay eventos ni promociones disponibles en este momento.</p>
            <p className="text-sm text-muted-foreground">Vuelve más tarde para descubrir nuevas ofertas.</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {events.length > 0 && (
              <section className="mb-12">
                <h2 className="text-3xl font-bold tracking-tight text-primary mb-8 flex items-center">
                  <CalendarDays className="h-8 w-8 mr-3" />
                  Eventos Próximos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map((event) => {
                    const businessPageUrl = event.businessCustomUrlPath 
                      ? `/b/${event.businessCustomUrlPath}` 
                      : (event.businessId ? `/business/${event.businessId}/public-fallback` : null); // Fallback, o no link si no hay businessId
                    return (
                    <Card key={event.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg bg-card">
                      <div className="relative aspect-[16/9] w-full">
                        <Image
                          src={event.imageUrl || "https://placehold.co/600x400.png?text=Evento"}
                          alt={event.name || "Evento"}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover"
                          data-ai-hint={event.aiHint || "event party"}
                        />
                      </div>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl hover:text-primary transition-colors">
                          {event.name}
                        </CardTitle>
                        {event.businessName ? (
                           businessPageUrl ? (
                            <Link href={businessPageUrl} className="text-sm text-muted-foreground hover:underline hover:text-primary flex items-center mt-1">
                              <Building className="h-4 w-4 mr-1.5 flex-shrink-0" /> 
                              {event.businessName}
                            </Link>
                          ) : (
                            <p className="text-sm text-muted-foreground flex items-center mt-1">
                               <Building className="h-4 w-4 mr-1.5 flex-shrink-0" /> {event.businessName}
                            </p>
                          )
                        ) : (
                            <p className="text-sm text-muted-foreground flex items-center mt-1">
                               <Building className="h-4 w-4 mr-1.5 flex-shrink-0" /> Negocio no especificado
                            </p>
                        )}
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-2">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Del {format(parseISO(event.startDate), "dd MMM", { locale: es })} al {format(parseISO(event.endDate), "dd MMM, yyyy", { locale: es })}
                        </p>
                      </CardContent>
                       <CardFooter>
                         {businessPageUrl ? (
                            <Link href={businessPageUrl} passHref className="w-full">
                              <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                                Ver Detalles del Evento <ExternalLink className="ml-2 h-4 w-4" />
                              </Button>
                            </Link>
                         ) : (
                            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled>
                                Ver Detalles del Evento
                            </Button>
                         )}
                      </CardFooter>
                    </Card>
                  )})}
                </div>
              </section>
            )}

            {promotions.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold tracking-tight text-primary mb-8 flex items-center">
                  <Tag className="h-8 w-8 mr-3" />
                  Promociones Vigentes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {promotions.map((promo) => {
                     const businessPageUrl = promo.businessCustomUrlPath 
                      ? `/b/${promo.businessCustomUrlPath}` 
                      : (promo.businessId ? `/business/${promo.businessId}/public-fallback` : null);
                    return (
                    <Card key={promo.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg bg-card">
                       <div className="relative aspect-[16/9] w-full">
                          <Image
                            src={promo.imageUrl || "https://placehold.co/600x400.png?text=Promoción"}
                            alt={promo.name || "Promoción"}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover"
                            data-ai-hint={promo.aiHint || "discount offer"}
                          />
                        </div>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl hover:text-primary transition-colors">
                           {promo.name}
                        </CardTitle>
                         {promo.businessName ? (
                           businessPageUrl ? (
                            <Link href={businessPageUrl} className="text-sm text-muted-foreground hover:underline hover:text-primary flex items-center mt-1">
                              <Building className="h-4 w-4 mr-1.5 flex-shrink-0" /> 
                              {promo.businessName}
                            </Link>
                          ) : (
                             <p className="text-sm text-muted-foreground flex items-center mt-1">
                               <Building className="h-4 w-4 mr-1.5 flex-shrink-0" /> {promo.businessName}
                            </p>
                          )
                         ) : (
                             <p className="text-sm text-muted-foreground flex items-center mt-1">
                               <Building className="h-4 w-4 mr-1.5 flex-shrink-0" /> Negocio no especificado
                            </p>
                         )}
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-2">{promo.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Válido hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}
                        </p>
                      </CardContent>
                       <CardFooter>
                         {businessPageUrl ? (
                           <Link href={businessPageUrl} passHref className="w-full">
                            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                              Ver Detalles de la Promoción <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                          </Link>
                         ) : (
                            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled>
                                Ver Detalles de la Promoción
                            </Button>
                         )}
                      </CardFooter>
                    </Card>
                  )})}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="mt-12 py-8 bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground">
          Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociosvip.app</Link>
        </p>
      </footer>
    </div>
  );
}

    