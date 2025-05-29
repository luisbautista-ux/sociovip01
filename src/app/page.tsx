
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"; // Added CardFooter
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, doc } from "firebase/firestore";
import type { BusinessManagedEntity, Business } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { Loader2, Building, Tag, CalendarDays } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";

// Tipos para la entidad pública combinada
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
      // 1. Obtener todos los negocios y mapearlos por ID
      const businessesSnapshot = await getDocs(collection(db, "businesses"));
      const businessesMap = new Map<string, Business>();
      businessesSnapshot.forEach(docSnap => {
        const bizData = docSnap.data() as Business;
        businessesMap.set(docSnap.id, { id: docSnap.id, ...bizData });
      });
      console.log(`HomePage: Fetched ${businessesMap.size} businesses.`);

      // 2. Obtener todas las entidades activas
      const entitiesQuery = query(collection(db, "businessEntities"), where("isActive", "==", true));
      const entitiesSnapshot = await getDocs(entitiesQuery);
      console.log(`HomePage: Fetched ${entitiesSnapshot.docs.length} active business entities initially.`);

      const validEntities: PublicDisplayEntity[] = [];

      entitiesSnapshot.forEach(docSnap => {
        const entityData = docSnap.data() as Omit<BusinessManagedEntity, 'id'>;
        // Ensure dates are strings for isEntityCurrentlyActivatable if they come as Timestamps
        const entity: BusinessManagedEntity = {
          id: docSnap.id,
          ...entityData,
          startDate: entityData.startDate instanceof Timestamp ? entityData.startDate.toDate().toISOString() : String(entityData.startDate),
          endDate: entityData.endDate instanceof Timestamp ? entityData.endDate.toDate().toISOString() : String(entityData.endDate),
          createdAt: entityData.createdAt instanceof Timestamp ? entityData.createdAt.toDate().toISOString() : (entityData.createdAt ? String(entityData.createdAt) : undefined),
        };

        if (isEntityCurrentlyActivatable(entity)) {
          const business = businessesMap.get(entity.businessId);
          if (business) {
            validEntities.push({
              ...entity,
              businessName: business.name,
              businessLogoUrl: business.logoUrl, // Assuming business has logoUrl
              businessCustomUrlPath: business.customUrlPath
            });
          } else {
            console.warn(`HomePage: Business not found for entity ${entity.id} with businessId ${entity.businessId}. Entity will be shown without business details.`);
            validEntities.push(entity); // Show entity even if business details are missing
          }
        }
      });

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
      {/* Marcador Visual Temporal */}
      <h1 className="text-3xl text-center font-bold text-orange-500 p-4 fixed top-0 left-0 bg-white/50 z-50 w-full">VERIFICACIÓN CAMBIO GLOBAL - vFINAL</h1>
      
      <header className="py-6 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground shadow-md mt-16"> {/* mt-16 para dejar espacio al marcador */}
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
          <SocioVipLogo className="h-16 w-16 mb-3" />
          <h1 className="text-4xl font-bold tracking-tight">SocioVIP</h1>
          <p className="mt-2 text-lg text-primary-foreground/90">
            Descubre promociones y eventos exclusivos cerca de ti.
          </p>
          {/* Placeholder para el PublicHeaderAuth que se implementará después */}
          <div className="mt-4 p-2 border border-dashed border-primary-foreground/50 rounded-md">
            <p className="text-xs">[PublicHeaderAuth Placeholder: Login/User Info Here]</p>
          </div>
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
            {/* Sección de Eventos */}
            {events.length > 0 && (
              <section className="mb-12">
                <h2 className="text-3xl font-bold tracking-tight text-primary mb-6 flex items-center">
                  <CalendarDays className="h-8 w-8 mr-3" />
                  Eventos Próximos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map((event) => (
                    <Card key={event.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg">
                      <Link href={event.businessCustomUrlPath ? `/b/${event.businessCustomUrlPath}` : `/business/${event.businessId}/public`} passHref>
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
                           <Link href={event.businessCustomUrlPath ? `/b/${event.businessCustomUrlPath}` : `/business/${event.businessId}/public`} passHref>
                            {event.name}
                          </Link>
                        </CardTitle>
                        {event.businessName && (
                          <Link href={event.businessCustomUrlPath ? `/b/${event.businessCustomUrlPath}` : `/business/${event.businessId}/public`} passHref>
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
                        <Link href={event.businessCustomUrlPath ? `/b/${event.businessCustomUrlPath}` : `/business/${event.businessId}/public`} passHref className="w-full">
                          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                            Ver Detalles del Evento
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Sección de Promociones */}
            {promotions.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold tracking-tight text-primary mb-6 flex items-center">
                  <Tag className="h-8 w-8 mr-3" />
                  Promociones Vigentes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {promotions.map((promo) => (
                    <Card key={promo.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg">
                       <Link href={promo.businessCustomUrlPath ? `/b/${promo.businessCustomUrlPath}` : `/business/${promo.businessId}/public`} passHref>
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
                          <Link href={promo.businessCustomUrlPath ? `/b/${promo.businessCustomUrlPath}` : `/business/${promo.businessId}/public`} passHref>
                            {promo.name}
                          </Link>
                        </CardTitle>
                         {promo.businessName && (
                          <Link href={promo.businessCustomUrlPath ? `/b/${promo.businessCustomUrlPath}` : `/business/${promo.businessId}/public`} passHref>
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
                         <Link href={promo.businessCustomUrlPath ? `/b/${promo.businessCustomUrlPath}` : `/business/${promo.businessId}/public`} passHref className="w-full">
                          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                            Ver Detalles de la Promoción
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
        <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} SocioVIP. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
