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
import { collection, getDocs, query, where, Timestamp, doc, getDoc } from "firebase/firestore";
import type { BusinessManagedEntity, Business } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { Loader2, Building, Tag, CalendarDays, ExternalLink, PackageOpen, LogOut, UserCircle } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { LoginModal } from "@/components/auth/LoginModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PublicDisplayEntity extends BusinessManagedEntity {
  businessName?: string;
  businessLogoUrl?: string;
  businessCustomUrlPath?: string;
}

export default function HomePage() {
  const [publicEntities, setPublicEntities] = useState<PublicDisplayEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentUser, userProfile, logout, loadingAuth, loadingProfile } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const fetchPublicEntitiesAndBusinesses = useCallback(async () => {
    console.log("HomePage: Fetching public entities and businesses...");
    setIsLoading(true);
    setError(null);
    try {
      const businessesSnapshot = await getDocs(collection(db, "businesses"));
      const businessesMap = new Map<string, Business>();
      businessesSnapshot.forEach(docSnap => {
        businessesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Business);
      });
      console.log("HomePage: Fetched businessesMap size:", businessesMap.size);

      const entitiesQuery = query(collection(db, "businessEntities"), where("isActive", "==", true));
      const entitiesSnapshot = await getDocs(entitiesQuery);
      console.log("HomePage: Fetched active entities snapshot size:", entitiesSnapshot.size);
      
      const allActiveAndCurrentEntities: PublicDisplayEntity[] = [];
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
        
        const entityForCheck: BusinessManagedEntity = {
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
          generatedCodes: [],
          imageUrl: entityData.imageUrl,
          aiHint: entityData.aiHint,
          termsAndConditions: entityData.termsAndConditions,
          createdAt: entityData.createdAt instanceof Timestamp 
            ? entityData.createdAt.toDate().toISOString() 
            : (typeof entityData.createdAt === 'string' ? entityData.createdAt : (entityData.createdAt instanceof Date ? entityData.createdAt.toISOString() : undefined)),
        };

        if (isEntityCurrentlyActivatable(entityForCheck)) {
          const business = businessesMap.get(entityForCheck.businessId);
          if (business) {
            allActiveAndCurrentEntities.push({
              ...entityForCheck,
              businessName: business.name || "Negocio Desconocido",
              businessLogoUrl: business.logoUrl,
              businessCustomUrlPath: business.customUrlPath,
            });
          } else {
            console.warn(`HomePage: No business found for entity ${entityForCheck.id} with businessId ${entityForCheck.businessId}`);
            allActiveAndCurrentEntities.push({ // Still add, but without business details
              ...entityForCheck,
              businessName: "Negocio Desconocido (ID no encontrado)",
            });
          }
        }
      });
      console.log("HomePage: Filtered active and current entities:", allActiveAndCurrentEntities.length);
      
      const sortedEntities = allActiveAndCurrentEntities.sort((a, b) => {
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
       toast({
        title: "Error de Carga",
        description: "No se pudieron cargar los datos públicos. " + err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPublicEntitiesAndBusinesses();
  }, [fetchPublicEntitiesAndBusinesses]);

  const events = publicEntities.filter(entity => entity.type === 'event');
  const promotions = publicEntities.filter(entity => entity.type === 'promotion');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20 w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" passHref className="flex items-center gap-2 group">
            <SocioVipLogo className="h-10 w-10 text-primary group-hover:animate-pulse" />
            <div>
              <span className="font-semibold text-2xl text-primary group-hover:text-primary/80">SocioVIP</span>
              <p className="text-xs text-muted-foreground group-hover:text-primary/70">Conexiones que Premian</p>
            </div>
          </Link>
          {/* Auth elements moved to footer */}
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 flex-grow">
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
                    const businessUrl = event.businessCustomUrlPath && event.businessCustomUrlPath.trim() !== ""
                      ? `/b/${event.businessCustomUrlPath.trim()}`
                      : `/business/${event.businessId}`;
                    const canLinkToBusiness = (event.businessCustomUrlPath && event.businessCustomUrlPath.trim() !== "") || event.businessId;

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
                        {event.businessName && canLinkToBusiness ? (
                          <Link href={businessUrl} className="text-sm text-muted-foreground hover:underline hover:text-primary flex items-center mt-1">
                            <Building className="h-4 w-4 mr-1.5 flex-shrink-0" /> 
                            {event.businessName}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground flex items-center mt-1">
                            <Building className="h-4 w-4 mr-1.5 flex-shrink-0" /> 
                            {event.businessName || "Negocio Desconocido"}
                          </span>
                        )}
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-2">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Del {format(parseISO(event.startDate), "dd MMM", { locale: es })} al {format(parseISO(event.endDate), "dd MMM, yyyy", { locale: es })}
                        </p>
                      </CardContent>
                       <CardFooter>
                        {canLinkToBusiness ? (
                          <Link href={businessUrl} passHref className="w-full">
                            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                              Ver Detalles del Evento
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                          </Link>
                        ) : (
                            <Button className="w-full" disabled>
                              Detalles No Disponibles
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
                     const businessUrl = promo.businessCustomUrlPath && promo.businessCustomUrlPath.trim() !== ""
                     ? `/b/${promo.businessCustomUrlPath.trim()}`
                     : `/business/${promo.businessId}`;
                    const canLinkToBusiness = (promo.businessCustomUrlPath && promo.businessCustomUrlPath.trim() !== "") || promo.businessId;

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
                         {promo.businessName && canLinkToBusiness ? (
                           <Link href={businessUrl} className="text-sm text-muted-foreground hover:underline hover:text-primary flex items-center mt-1">
                             <Building className="h-4 w-4 mr-1.5 flex-shrink-0" /> 
                             {promo.businessName}
                           </Link>
                         ) : (
                            <span className="text-sm text-muted-foreground flex items-center mt-1">
                                <Building className="h-4 w-4 mr-1.5 flex-shrink-0" /> 
                                {promo.businessName || "Negocio Desconocido"}
                            </span>
                         )}
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-2">{promo.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Válido hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}
                        </p>
                      </CardContent>
                       <CardFooter>
                        {canLinkToBusiness ? (
                            <Link href={businessUrl} passHref className="w-full">
                            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                                Ver Detalles de la Promoción
                                <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                            </Link>
                        ) : (
                            <Button className="w-full" disabled>
                                Detalles No Disponibles
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

      <footer className="w-full mt-auto py-6 px-4 sm:px-6 lg:px-8 bg-muted/60 text-sm border-t">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            {!loadingAuth && !loadingProfile && (
              <>
                {currentUser && userProfile ? (
                  <>
                    <span className="text-foreground flex items-center">
                      <UserCircle className="h-4 w-4 mr-1.5 text-muted-foreground" />
                      {userProfile.name || currentUser.email?.split('@')[0]}
                    </span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">Cerrar Sesión</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Cerrar Sesión?</AlertDialogTitle><AlertDialogDescription>¿Estás seguro de que quieres cerrar tu sesión?</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={logout} className="bg-destructive hover:bg-destructive/90">Sí, Cerrar Sesión</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Link href="/auth/dispatcher" passHref>
                       <Button variant="outline" size="sm">Ir a Administración</Button>
                    </Link>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowLoginModal(true)}>
                    Iniciar Sesión
                  </Button>
                )}
              </>
            )}
            {(loadingAuth || loadingProfile) && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
          <div className="text-muted-foreground">
            <Link href="/" className="hover:text-primary hover:underline">
              Plataforma de sociosvip.app
            </Link>
          </div>
        </div>
      </footer>
      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  );
}
