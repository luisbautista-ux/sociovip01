
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
  CardFooter,
  CardDescription
} from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import type { BusinessManagedEntity, Business } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { Loader2, Building, Tag, CalendarDays, ExternalLink } from "lucide-react";
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
    console.log("HomePage: Fetching public entities and businesses...");
    setIsLoading(true);
    setError(null);
    try {
      const businessesSnapshot = await getDocs(collection(db, "businesses"));
      const businessesMap = new Map<string, Business>();
      businessesSnapshot.forEach(docSnap => {
        const bizData = docSnap.data() as Omit<Business, 'id'>;
        businessesMap.set(docSnap.id, { 
            id: docSnap.id, 
            ...bizData,
            joinDate: bizData.joinDate instanceof Timestamp ? bizData.joinDate.toDate().toISOString() : String(bizData.joinDate || new Date().toISOString()),
            customUrlPath: bizData.customUrlPath || undefined, // Asegurar que customUrlPath esté
         });
      });
      console.log(`HomePage: Fetched ${businessesMap.size} businesses.`);

      const entitiesQuery = query(collection(db, "businessEntities"), where("isActive", "==", true));
      const entitiesSnapshot = await getDocs(entitiesQuery);
      console.log(`HomePage: Fetched ${entitiesSnapshot.docs.length} active business entities initially.`);

      const validEntities: PublicDisplayEntity[] = [];

      for (const docSnap of entitiesSnapshot.docs) {
        const entityData = docSnap.data() as Omit<BusinessManagedEntity, 'id' | 'startDate' | 'endDate' | 'createdAt'> & { startDate: Timestamp | string, endDate: Timestamp | string, createdAt?: Timestamp | string };
        
        let startDateStr: string;
        let endDateStr: string;
        const nowISO = new Date().toISOString();

        if (entityData.startDate instanceof Timestamp) startDateStr = entityData.startDate.toDate().toISOString();
        else if (typeof entityData.startDate === 'string') startDateStr = entityData.startDate;
        else { console.warn(`HomePage: Entity ${docSnap.id} for business ${entityData.businessId} missing or invalid startDate. Using fallback.`); startDateStr = nowISO; }

        if (entityData.endDate instanceof Timestamp) endDateStr = entityData.endDate.toDate().toISOString();
        else if (typeof entityData.endDate === 'string') endDateStr = entityData.endDate;
        else { console.warn(`HomePage: Entity ${docSnap.id} for business ${entityData.businessId} missing or invalid endDate. Using fallback.`); endDateStr = nowISO; }
        
        const entityForCheck: BusinessManagedEntity = {
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
        };

        if (isEntityCurrentlyActivatable(entityForCheck)) {
          const business = businessesMap.get(entityForCheck.businessId);
          if (business) {
            validEntities.push({
              ...entityForCheck,
              businessName: business.name,
              businessLogoUrl: business.logoUrl,
              businessCustomUrlPath: business.customUrlPath,
            });
          } else {
            console.warn(`HomePage: Business not found for entity ${entityForCheck.id} with businessId ${entityForCheck.businessId}. Entity will not be shown.`);
            // validEntities.push(entityForCheck); // Omitir si el negocio no se encuentra para evitar errores de enlace
          }
        }
      }

      console.log(`HomePage: Filtered to ${validEntities.length} currently activatable entities.`);
      setPublicEntities(validEntities.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));

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
      {/* <h1 className="text-3xl text-center font-bold text-orange-500 p-4">VERIFICACIÓN CAMBIO GLOBAL - v3</h1>  */}
      <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" passHref className="flex items-center gap-2 group">
                <SocioVipLogo className="h-10 w-10 text-primary group-hover:animate-pulse" />
                <div>
                  <span className="font-semibold text-2xl text-primary group-hover:text-primary/80">SocioVIP</span>
                  <p className="text-xs text-muted-foreground group-hover:text-primary/70">Conexiones que Premian</p> {/* Slogan Hardcodeado */}
                </div>
            </Link>
            <PublicHeaderAuth />
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
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
            <Tag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">No hay eventos ni promociones disponibles en este momento.</p>
            <p className="text-sm text-muted-foreground">Vuelve más tarde para descubrir nuevas ofertas.</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {events.length > 0 && (
              <section className="mb-12">
                <h2 className="text-3xl font-bold tracking-tight text-primary mb-6 flex items-center">
                  <CalendarDays className="h-8 w-8 mr-3" />
                  Eventos Próximos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map((event) => (
                    <Card key={event.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg">
                      <Link href={event.businessCustomUrlPath ? `/b/${event.businessCustomUrlPath}` : `/business/${event.businessId}/public-fallback`} passHref>
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
                      </Link>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl hover:text-primary transition-colors">
                           <Link href={event.businessCustomUrlPath ? `/b/${event.businessCustomUrlPath}` : `/business/${event.businessId}/public-fallback`} passHref>
                            {event.name}
                          </Link>
                        </CardTitle>
                        {event.businessName && (
                          <Link href={event.businessCustomUrlPath ? `/b/${event.businessCustomUrlPath}` : `/business/${event.businessId}/public-fallback`} passHref>
                            <p className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center mt-1">
                              <Building className="h-4 w-4 mr-1.5" /> {event.businessName}
                            </p>
                          </Link>
                        )}
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-2">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Del {format(parseISO(event.startDate), "dd MMM", { locale: es })} al {format(parseISO(event.endDate), "dd MMM, yyyy", { locale: es })}
                        </p>
                      </CardContent>
                       <CardFooter>
                         <Link href={event.businessCustomUrlPath ? `/b/${event.businessCustomUrlPath}` : `/business/${event.businessId}/public-fallback`} passHref className="w-full">
                          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                            Ver Detalles del Evento <ExternalLink className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {promotions.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold tracking-tight text-primary mb-6 flex items-center">
                  <Tag className="h-8 w-8 mr-3" />
                  Promociones Vigentes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {promotions.map((promo) => (
                    <Card key={promo.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg">
                       <Link href={promo.businessCustomUrlPath ? `/b/${promo.businessCustomUrlPath}` : `/business/${promo.businessId}/public-fallback`} passHref>
                        <div className="relative aspect-[16/9] w-full">
                          <Image
                            src={promo.imageUrl || "https://placehold.co/600x400.png?text=Promo"}
                            alt={promo.name || "Promoción"}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover"
                            data-ai-hint={promo.aiHint || "discount offer"}
                          />
                        </div>
                      </Link>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl hover:text-primary transition-colors">
                          <Link href={promo.businessCustomUrlPath ? `/b/${promo.businessCustomUrlPath}` : `/business/${promo.businessId}/public-fallback`} passHref>
                            {promo.name}
                          </Link>
                        </CardTitle>
                         {promo.businessName && (
                          <Link href={promo.businessCustomUrlPath ? `/b/${promo.businessCustomUrlPath}` : `/business/${promo.businessId}/public-fallback`} passHref>
                            <p className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center mt-1">
                              <Building className="h-4 w-4 mr-1.5" /> {promo.businessName}
                            </p>
                          </Link>
                        )}
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-2">{promo.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Válido hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}
                        </p>
                      </CardContent>
                       <CardFooter>
                         <Link href={promo.businessCustomUrlPath ? `/b/${promo.businessCustomUrlPath}` : `/business/${promo.businessId}/public-fallback`} passHref className="w-full">
                          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                            Ver Detalles de la Promoción <ExternalLink className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="mt-12 py-8 bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground">
          Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociovip.app</Link>
        </p>
      </footer>
    </div>
  );
}

