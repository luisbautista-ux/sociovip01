
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import type { BusinessManagedEntity, Business } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { Loader2, Building, Tag, Search, Calendar, UserCircle, PartyPopper } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SocioVipLogo } from "@/components/icons";
import { HeroCarousel } from "@/components/home/HeroCarousel";

interface EnrichedEntity extends BusinessManagedEntity {
  businessName?: string;
  businessLogoUrl?: string;
  businessCustomUrlPath?: string | null;
}

export default function HomePage() {
  const [promotions, setPromotions] = useState<EnrichedEntity[]>([]);
  const [events, setEvents] = useState<EnrichedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<'all' | 'promotions' | 'events'>('all');
  const { toast } = useToast();

  const fetchEntitiesAndBusinesses = useCallback(async () => {
    setIsLoading(true);
    try {
      const businessesSnap = await getDocs(collection(db, "businesses"));
      const businessesMap = new Map<string, Business>();
      businessesSnap.forEach(doc => {
        businessesMap.set(doc.id, { id: doc.id, ...doc.data() } as Business);
      });

      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("isActive", "==", true)
      );
      const entitiesSnap = await getDocs(entitiesQuery);
      
      const allPromotions: EnrichedEntity[] = [];
      const allEvents: EnrichedEntity[] = [];

      entitiesSnap.forEach(doc => {
        const entityData = doc.data() as Omit<BusinessManagedEntity, 'id'> & { startDate: Timestamp | string, endDate: Timestamp | string };
        const business = businessesMap.get(entityData.businessId);
        
        const toSafeISOString = (dateValue: Timestamp | string | Date | undefined): string => {
          if (!dateValue) return new Date().toISOString(); 
          if (dateValue instanceof Timestamp) return dateValue.toDate().toISOString();
          if (dateValue instanceof Date) return dateValue.toISOString();
          if (typeof dateValue === 'string') return new Date(dateValue).toISOString();
          return new Date().toISOString();
        };

        const entityForCheck: BusinessManagedEntity = {
          id: doc.id,
          ...entityData,
          startDate: toSafeISOString(entityData.startDate),
          endDate: toSafeISOString(entityData.endDate),
        };

        if (isEntityCurrentlyActivatable(entityForCheck) && business) {
          const enrichedEntity: EnrichedEntity = {
            ...entityForCheck,
            businessName: business.name,
            businessLogoUrl: business.logoUrl,
            businessCustomUrlPath: business.customUrlPath,
          };
          if (enrichedEntity.type === 'promotion') {
            allPromotions.push(enrichedEntity);
          } else if (enrichedEntity.type === 'event') {
            allEvents.push(enrichedEntity);
          }
        }
      });
      
      allEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      allPromotions.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
      
      setPromotions(allPromotions);
      setEvents(allEvents);

    } catch (error: any) {
      console.error("Error fetching entities for homepage:", error);
      toast({
        title: "Error al Cargar Contenido",
        description: "No se pudieron obtener las promociones y eventos. " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEntitiesAndBusinesses();
  }, [fetchEntitiesAndBusinesses]);
  
  const filteredPromotions = useMemo(() => {
    if (!searchTerm) return promotions;
    const lowercasedTerm = searchTerm.toLowerCase();
    return promotions.filter(entity => 
      entity.name.toLowerCase().includes(lowercasedTerm) ||
      (entity.description && entity.description.toLowerCase().includes(lowercasedTerm)) ||
      entity.businessName?.toLowerCase().includes(lowercasedTerm)
    );
  }, [promotions, searchTerm]);

  const filteredEvents = useMemo(() => {
    if (!searchTerm) return events;
    const lowercasedTerm = searchTerm.toLowerCase();
    return events.filter(entity => 
      entity.name.toLowerCase().includes(lowercasedTerm) ||
      (entity.description && entity.description.toLowerCase().includes(lowercasedTerm)) ||
      entity.businessName?.toLowerCase().includes(lowercasedTerm)
    );
  }, [events, searchTerm]);

  const EntityCard = ({ entity }: { entity: EnrichedEntity }) => {
    const businessUrl = entity.businessCustomUrlPath
      ? `/${entity.businessCustomUrlPath}`
      : `/`; // Fallback to home if no custom URL
    
    const isEvent = entity.type === 'event';

    return (
      <Card key={entity.id} className="shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out flex flex-col overflow-hidden rounded-lg bg-card group hover:-translate-y-2">
        <Link href={businessUrl} passHref>
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-lg">
            <NextImage
              src={entity.imageUrl || "https://placehold.co/600x400.png"}
              alt={entity.name}
              fill
              className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
              style={{ objectPosition: entity.imageObjectPosition || '50% 50%' }}
              data-ai-hint={entity.aiHint || "discount offer"}
            />
          </div>
        </Link>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">
            <Link href={businessUrl}>
              {entity.name}
            </Link>
          </CardTitle>
          <CardDescription className="text-xs pt-1">
            <Link href={businessUrl} className="flex items-center text-muted-foreground hover:text-primary transition-colors">
              {entity.businessLogoUrl ? (
                <NextImage
                  src={entity.businessLogoUrl}
                  alt={`${entity.businessName} logo`}
                  width={16}
                  height={16}
                  className="h-4 w-4 mr-1.5 rounded-full object-contain"
                  data-ai-hint="logo business"
                />
              ) : (
                <Building className="h-4 w-4 mr-1.5" />
              )}
              <span>{entity.businessName}</span>
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-1">
          <p className="text-sm text-muted-foreground line-clamp-3">{entity.description}</p>
        </CardContent>
        <CardFooter className="flex-col items-start p-4 border-t bg-muted/50">
          <p className="text-xs text-muted-foreground w-full mb-2">
            Válido hasta el {format(parseISO(entity.endDate), "dd MMMM, yyyy", { locale: es })}
          </p>
          <Link href={businessUrl} passHref className="w-full">
            <Button className="w-full text-white hover:opacity-90 transition-opacity bg-header-gradient">
              {isEvent ? <Calendar className="mr-2 h-4 w-4" /> : <Tag className="mr-2 h-4 w-4" />}
               {isEvent ? "Ver Evento" : "Ver Promoción"}
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  };

  const showPromotions = view === 'all' || view === 'promotions';
  const showEvents = view === 'all' || view === 'events';
  
  if (isLoading) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-loader">
            <div className="flex flex-col items-center justify-center text-center">
                <div className="relative p-1 rounded-full shadow-lg bg-white/90 animate-drop-in animate-float">
                    <SocioVipLogo size={70} />
                </div>
                <p className="mt-4 text-lg font-semibold text-white/90">Buscando las mejores experiencias...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 text-foreground flex flex-col">
      <HeroCarousel searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
       
      <div className="bg-header-gradient shadow-md sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-start h-12 gap-6">
                  <button onClick={() => setView('all')} className={cn("text-white font-semibold text-sm transition-colors hover:text-white/80", view === 'all' ? 'border-b-2 border-white' : '')}>Ver Todo</button>
                  <button onClick={() => setView('promotions')} className={cn("text-white font-semibold text-sm transition-colors hover:text-white/80", view === 'promotions' ? 'border-b-2 border-white' : '')}>Promociones</button>
                  <button onClick={() => setView('events')} className={cn("text-white font-semibold text-sm transition-colors hover:text-white/80", view === 'events' ? 'border-b-2 border-white' : '')}>Eventos</button>
              </div>
          </div>
      </div>
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex-grow w-full">
            <div className="space-y-12">
              {showEvents && (
                <section>
                  <h2 className="text-3xl font-bold tracking-tight mb-6 flex items-center">
                    <Calendar className="h-7 w-7 mr-3 text-gradient fill-current" />
                    <span className="text-gradient">Próximos Eventos</span>
                  </h2>
                  {filteredEvents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {filteredEvents.map((entity) => <EntityCard key={entity.id} entity={entity} />)}
                    </div>
                  ) : (
                    <Card className="col-span-full">
                      <CardHeader className="items-center text-center">
                        <PartyPopper className="h-12 w-12 text-primary/70" />
                        <CardTitle className="mt-4">
                          {searchTerm ? "Sin Resultados" : "No Hay Eventos Disponibles"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-center">
                        <CardDescription>
                          {searchTerm
                            ? `No se encontraron eventos que coincidan con "${searchTerm}".`
                            : "Vuelve pronto, siempre estamos añadiendo nuevas experiencias."}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  )}
                </section>
              )}

              {showPromotions && (
                <section>
                  <h2 className="text-3xl font-bold tracking-tight mb-6 flex items-center">
                    <Tag className="h-7 w-7 mr-3 text-gradient fill-current" />
                    <span className="text-gradient">Promociones Vigentes</span>
                  </h2>
                  {filteredPromotions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {filteredPromotions.map((entity) => <EntityCard key={entity.id} entity={entity} />)}
                    </div>
                  ) : (
                     <Card className="col-span-full">
                      <CardHeader className="items-center text-center">
                        <PartyPopper className="h-12 w-12 text-primary/70" />
                        <CardTitle className="mt-4">
                          {searchTerm ? "Sin Resultados" : "No Hay Promociones Disponibles"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-center">
                        <CardDescription>
                          {searchTerm
                            ? `No se encontraron promociones que coincidan con "${searchTerm}".`
                            : "¡Los negocios están preparando sus mejores ofertas! Vuelve pronto."}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  )}
                </section>
              )}
            </div>
          </main>
        
    </div>
  );
}
