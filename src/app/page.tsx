
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
import { Loader2, Building, Tag, Search, Calendar, UserCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SocioVipLogo } from "@/components/icons";

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
      
      allPromotions.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
      allEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
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
      ? `/b/${entity.businessCustomUrlPath}`
      : `/business/${entity.businessId}`;
    
    const isEvent = entity.type === 'event';

    return (
      <Card key={entity.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg bg-card">
        <div className="relative aspect-[16/9] w-full">
          <NextImage
            src={entity.imageUrl || "https://placehold.co/600x400.png"}
            alt={entity.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            data-ai-hint={entity.aiHint || "discount offer"}
          />
        </div>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">
            <Link href={businessUrl} className="hover:underline">
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
            <Button className="w-full bg-primary hover:bg-primary/90">
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

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="sticky top-0 z-20 w-full bg-background shadow-sm">
        {/* Barra superior con filtros */}
        <div className="bg-gradient-to-r from-purple-800 to-red-600">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-start h-12 gap-6">
                    <button onClick={() => setView('all')} className={cn("text-white font-semibold text-sm transition-colors hover:text-white/80", view === 'all' ? 'border-b-2 border-white' : '')}>Ver Todo</button>
                    <button onClick={() => setView('promotions')} className={cn("text-white font-semibold text-sm transition-colors hover:text-white/80", view === 'promotions' ? 'border-b-2 border-white' : '')}>Promociones</button>
                    <button onClick={() => setView('events')} className={cn("text-white font-semibold text-sm transition-colors hover:text-white/80", view === 'events' ? 'border-b-2 border-white' : '')}>Eventos</button>
                </div>
            </div>
        </div>
        
        {/* Barra principal con logo, búsqueda y login */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <SocioVipLogo size={50} />
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gradient">SocioVIP</h1>
                </div>
              </div>

              <div className="flex-grow flex justify-center items-center order-3 sm:order-2 w-full sm:w-auto">
                 <div className="relative w-full max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Buscar promociones, eventos o negocios..."
                        className="pl-10 w-full rounded-full h-12 text-base"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
              </div>

              <div className="flex items-center order-2 sm:order-3">
                <Link href="/login" passHref>
                    <Button variant="ghost" className="font-semibold text-base">
                        <UserCircle className="mr-2 h-5 w-5" />
                        Inicia Sesión
                    </Button>
                </Link>
              </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg text-muted-foreground">Cargando...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {showPromotions && (
              <section>
                <h2 className="text-3xl font-bold tracking-tight mb-6 flex items-center text-gradient">
                  <Tag className="h-7 w-7 mr-3" /> Promociones Vigentes
                </h2>
                {filteredPromotions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredPromotions.map((entity) => <EntityCard key={entity.id} entity={entity} />)}
                  </div>
                ) : (
                  <div className="text-center py-10 rounded-lg border-2 border-dashed">
                    <p className="text-lg font-semibold">No se encontraron promociones</p>
                    <p className="text-muted-foreground mt-1">
                      {searchTerm ? "Intenta con otra búsqueda." : "Vuelve más tarde para ver nuevas promociones."}
                    </p>
                  </div>
                )}
              </section>
            )}
            
            {showEvents && (
              <section>
                <h2 className="text-3xl font-bold tracking-tight mb-6 flex items-center text-gradient">
                  <Calendar className="h-7 w-7 mr-3" /> Próximos Eventos
                </h2>
                {filteredEvents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredEvents.map((entity) => <EntityCard key={entity.id} entity={entity} />)}
                  </div>
                ) : (
                  <div className="text-center py-10 rounded-lg border-2 border-dashed">
                    <p className="text-lg font-semibold">No se encontraron eventos</p>
                    <p className="text-muted-foreground mt-1">
                      {searchTerm ? "Intenta con otra búsqueda." : "Vuelve más tarde para ver nuevos eventos."}
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
