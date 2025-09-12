
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
            <CardTitle className="text-xl">{entity.name}</CardTitle>
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
      <header className="py-4 px-4 sm:px-6 lg:px-8 bg-background shadow-md sticky top-0 z-20 w-full">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 self-start sm:self-center">
            <NextImage
              src="https://i.ibb.co/ycG8QLZj/Brown-Mascot-Lion-Free-Logo.jpg"
              alt="SocioVIP logo"
              width={50}
              height={50}
              priority
              className="rounded-full ring-2 ring-purple-200/50 object-cover shadow-sm"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gradient bg-gradient-to-r from-purple-500 to-purple-700 text-transparent bg-clip-text">SocioVIP</h1>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Button variant={view === 'promotions' ? 'default' : 'ghost'} onClick={() => setView('promotions')}>Promociones</Button>
              <Button variant={view === 'events' ? 'default' : 'ghost'} onClick={() => setView('events')}>Eventos</Button>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="hidden sm:flex">
             <Link href="/login" passHref>
              <Button variant="outline">
                <UserCircle className="mr-2 h-4 w-4" />
                Inicia Sesión
              </Button>
            </Link>
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
                <h2 className="text-2xl font-bold tracking-tight text-gradient mb-6 flex items-center">
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
                <h2 className="text-2xl font-bold tracking-tight text-gradient mb-6 flex items-center">
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
      
       {/* Botón de Iniciar Sesión visible solo en móvil, al final */}
      <div className="sm:hidden p-4 fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t">
        <Link href="/login" passHref className="w-full">
            <Button className="w-full">
              <UserCircle className="mr-2 h-4 w-4" />
              Inicia Sesión / Acceso a Paneles
            </Button>
        </Link>
      </div>

    </div>
  );
}
