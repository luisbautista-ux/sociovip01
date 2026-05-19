"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, doc, getDoc } from "firebase/firestore";
import type { BusinessManagedEntity, Business } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { 
  Loader2, 
  Building, 
  Tag, 
  Search, 
  Calendar, 
  UserCircle, 
  PartyPopper,
  Sparkles,
  ArrowLeft,
  MessageSquare
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SocioVipLogo } from "@/components/icons";
import { CleanHero } from "@/components/home/CleanHero";
import { generateItinerary } from "@/ai/flows/generate-itinerary";
import { BusinessConversationLayout } from "@/components/business/BusinessConversationLayout";
import { MainHeader } from "@/components/layout/MainHeader";

interface EnrichedEntity extends BusinessManagedEntity {
  businessName?: string;
  businessLogoUrl?: string;
  businessCustomUrlPath?: string | null;
  businessProvince?: string;
  businessDistrict?: string;
  businessDepartment?: string;
  businessType?: string;
}

export default function HomePage() {
  const [promotions, setPromotions] = useState<EnrichedEntity[]>([]);
  const [events, setEvents] = useState<EnrichedEntity[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [whatsAppPhone, setWhatsAppPhone] = useState("51942401695");
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'all' | 'promotions' | 'events' | 'experiences'>('all');
  const [isConversationView, setIsConversationView] = useState(false);
  const [isGeneratingItinerary, setIsGeneratingItinerary] = useState(false);
  const [initialChatHistory, setInitialChatHistory] = useState<{role: "user" | "assistant", content: string}[]>([]);
  const { toast } = useToast();

  const fetchEntitiesAndBusinesses = useCallback(async () => {
    setIsLoading(true);
    try {
      const configDocRef = doc(db, "platformSettings", "membershipConfig");
      const configSnap = await getDoc(configDocRef);
      if (configSnap.exists()) {
        const configData = configSnap.data();
        if (configData.contactPhone) {
          const cleaned = configData.contactPhone.replace(/\D/g, "");
          if (cleaned) {
            setWhatsAppPhone(cleaned);
          }
        }
      }

      const businessesSnap = await getDocs(collection(db, "businesses"));
      const businessesMap = new Map<string, Business>();
      const allBusinesses: Business[] = [];
      businessesSnap.forEach(doc => {
        const busData = { id: doc.id, ...doc.data() } as Business;
        businessesMap.set(doc.id, busData);
        if (busData.name) {
          allBusinesses.push(busData);
        }
      });
      setBusinesses(allBusinesses);

      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("isActive", "==", true)
      );
      const entitiesSnap = await getDocs(entitiesQuery);
      
      const allPromotions: EnrichedEntity[] = [];
      const allEvents: EnrichedEntity[] = [];

      entitiesSnap.forEach(doc => {
        const entityData = doc.data() as any;
        const business = businessesMap.get(entityData.businessId);
        
        const toSafeISOString = (dateValue: any): string => {
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
            businessPhone: business.publicPhone || business.personalPhone || "",
            businessProvince: business.province || "",
            businessDistrict: business.district || "",
            businessDepartment: business.department || "",
            businessType: business.businessType || "Local",
            businessVideoUrls: business.publicVideoUrls || [],
            businessImageUrls: business.publicCoverImageUrls || [],
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
        description: "No se pudieron obtener las promociones y eventos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEntitiesAndBusinesses();
  }, [fetchEntitiesAndBusinesses]);
  
  const handleGenerateItinerary = async (prompt: string) => {
    setIsGeneratingItinerary(true);
    try {
        const contextData = JSON.stringify({
            events: events.map(e => ({ name: e.name, description: e.description, business: e.businessName, date: e.startDate })),
            promotions: promotions.map(p => ({ name: p.name, description: p.description, business: p.businessName }))
        });

        const result = await generateItinerary({
            userPrompt: prompt,
            contextData: contextData
        });
        setInitialChatHistory([
          { role: "user", content: prompt },
          { role: "assistant", content: result.itineraryText }
        ]);
        setIsConversationView(true);
    } catch (error: any) {
        console.error("Error generating itinerary:", error);
        toast({
            title: "Error del Asistente",
            description: "No pudimos generar el itinerario en este momento.",
            variant: "destructive"
        });
    } finally {
        setIsGeneratingItinerary(false);
    }
  };

  const EntityCard = ({ entity }: { entity: EnrichedEntity }) => {
    const businessUrl = entity.businessCustomUrlPath ? `/${entity.businessCustomUrlPath}` : `/`;
    const isEvent = entity.type === 'event';

    return (
      <Card key={entity.id} className="shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out flex flex-col overflow-hidden rounded-lg bg-card group hover:-translate-y-2 border-none">
        <Link href={businessUrl} passHref>
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-lg">
            <NextImage
              src={entity.imageUrl || "https://placehold.co/600x400.png"}
              alt={entity.name}
              fill
              className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
            />
          </div>
        </Link>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold">
            <Link href={businessUrl} className="hover:text-primary transition-colors">
              {entity.name}
            </Link>
          </CardTitle>
          <CardDescription className="text-xs pt-1">
            <Link href={businessUrl} className="flex items-center text-muted-foreground hover:text-primary transition-colors">
              {entity.businessLogoUrl && (
                <NextImage
                  src={entity.businessLogoUrl}
                  alt={`${entity.businessName} logo`}
                  width={16}
                  height={16}
                  className="h-4 w-4 mr-1.5 rounded-full object-contain"
                />
              )}
              <span className="font-semibold uppercase tracking-wider">{entity.businessName}</span>
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-1">
          <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{entity.description}</p>
        </CardContent>
        <CardFooter className="flex-col items-start p-4 border-t bg-slate-50/50">
          <p className="text-xs text-muted-foreground w-full mb-3">
            Válido hasta el {format(parseISO(entity.endDate), "dd MMMM, yyyy", { locale: es })}
          </p>
          <Link href={businessUrl} passHref className="w-full">
            <Button className="w-full text-white font-bold uppercase tracking-widest text-[10px] bg-[#053264] hover:bg-[#053264]/90 transition-all rounded-md h-10 shadow-md">
              {isEvent ? <Calendar className="mr-2 h-4 w-4" /> : <Tag className="mr-2 h-4 w-4" />}
               {isEvent ? "Ver Evento" : "Ver Promoción"}
            </Button>
          </Link>
        </CardFooter>
      </Card> 
    );
  };

  const BusinessCard = ({ business }: { business: Business }) => {
    const businessUrl = business.customUrlPath ? `/${business.customUrlPath}` : `/`;
    const coverImage = business.publicCoverImageUrls?.[0] || business.logoUrl || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80";

    return (
      <Card key={business.id} className="shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out flex flex-col overflow-hidden rounded-lg bg-card group hover:-translate-y-2 border-none">
        <Link href={businessUrl} passHref>
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-lg bg-slate-100">
            <NextImage
              src={coverImage}
              alt={business.name}
              fill
              className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
            />
            {business.logoUrl && (
              <div className="absolute bottom-4 left-4 h-12 w-12 rounded-full border-2 border-white bg-white overflow-hidden shadow-md flex items-center justify-center">
                <NextImage
                  src={business.logoUrl}
                  alt={`${business.name} logo`}
                  width={48}
                  height={48}
                  className="object-contain w-full h-full"
                />
              </div>
            )}
          </div>
        </Link>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold">
            <Link href={businessUrl} className="hover:text-primary transition-colors">
              {business.name}
            </Link>
          </CardTitle>
          {business.slogan && (
            <CardDescription className="text-xs pt-1 font-semibold text-slate-400 italic">
              "{business.slogan}"
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex-grow space-y-1">
          <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
            {business.description || `${business.name} te ofrece las mejores experiencias exclusivas de la zona.`}
          </p>
        </CardContent>
        <CardFooter className="flex-col items-start p-4 border-t bg-slate-50/50">
          <p className="text-xs text-muted-foreground w-full mb-3 flex items-center gap-1.5">
            <Building size={14} className="text-slate-400" />
            <span>{business.address || `${business.district || ""}, ${business.province || "Perú"}`}</span>
          </p>
          <Link href={businessUrl} passHref className="w-full">
            <Button className="w-full text-white font-bold uppercase tracking-widest text-[10px] bg-[#053264] hover:bg-[#053264]/90 transition-all rounded-md h-10 shadow-md">
              <Sparkles className="mr-2 h-4 w-4" />
              Explorar Marca
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  };

  const showPromotions = view === 'all' || view === 'promotions';
  const showEvents = view === 'all' || view === 'events';
  const showExperiences = view === 'all' || view === 'experiences';
  
  if (isLoading) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-loader">
            <div className="flex flex-col items-center justify-center text-center">
                <div className="mb-6 max-w-[85vw] animate-drop-in animate-float">
                    <SocioVipLogo size={180} variant="pill" pillPadding="py-0 px-[1.5%]" className="!aspect-[1.6/1] !h-auto object-fill border-[1px] border-white/95 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.3)] drop-shadow-lg" />
                </div>
                <p className="mt-4 text-lg font-semibold text-white/90 uppercase tracking-widest">Descubriendo experiencias...</p>
            </div>
        </div>
    );
  }

  if (isConversationView) {
    const featuredBusiness = promotions[0] ? {
      id: promotions[0].businessId,
      name: promotions[0].businessName || "SocioVIP Concierge",
      logoUrl: promotions[0].businessLogoUrl,
      publicVideoUrls: (promotions[0] as any).businessVideoUrls || [],
      publicAddress: promotions[0].locationAddress || "Lima, Perú",
      primaryColor: "#053264",
      secondaryColor: "#ccffbc",
      publicImageUrls: (promotions[0] as any).businessImageUrls || [],
      customUrlPath: (promotions[0] as any).businessCustomUrlPath || null,
    } : {
      id: "concierge",
      name: "SocioVIP Concierge",
      publicVideoUrls: [],
      publicAddress: "Lima, Perú",
      primaryColor: "#053264",
      secondaryColor: "#ccffbc",
      customUrlPath: null
    };

    return (
      <div className="relative h-screen w-full bg-[#050510]">
        <BusinessConversationLayout 
          business={featuredBusiness as any}
          promotions={promotions}
          events={events}
          initialMessages={initialChatHistory}
          onBack={() => { setIsConversationView(false); setInitialChatHistory([]); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#053264] flex flex-col font-sans overflow-x-hidden w-full relative">
      <MainHeader />
      
      <main className="flex-grow">
        <CleanHero 
          onGenerateItinerary={handleGenerateItinerary}
          isGenerating={isGeneratingItinerary}
          businesses={businesses}
        />
        
        {/* Navigation Tabs */}
        <div className="bg-white border-b sticky top-0 z-40 shadow-sm overflow-x-auto no-scrollbar">
            <div className="max-w-7xl mx-auto flex">
                <button 
                  onClick={() => setView('all')} 
                  className={cn(
                    "flex-1 min-w-[120px] py-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-b-4", 
                    view === 'all' ? "border-[#053264] text-[#053264]" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  Ver Todo
                </button>
                <button 
                  onClick={() => setView('promotions')} 
                  className={cn(
                    "flex-1 min-w-[120px] py-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-b-4", 
                    view === 'promotions' ? "border-[#053264] text-[#053264]" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  Promociones
                </button>
                <button 
                  onClick={() => setView('events')} 
                  className={cn(
                    "flex-1 min-w-[120px] py-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-b-4", 
                    view === 'events' ? "border-[#053264] text-[#053264]" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  Eventos
                </button>
                <button 
                  onClick={() => setView('experiences')} 
                  className={cn(
                    "flex-1 min-w-[120px] py-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-b-4", 
                    view === 'experiences' ? "border-[#053264] text-[#053264]" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  Experiencias
                </button>
            </div>
        </div>

        <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8 space-y-20">
          {showExperiences && (
            <section id="experiencias" className="scroll-mt-24">
              <div className="flex flex-col items-center text-center mb-12">
                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Nuestras Experiencias</h2>
                <div className="w-20 h-1 bg-[#053264] rounded-full" />
                <p className="mt-4 text-slate-500 font-medium">Descubre las marcas y locales más exclusivos de SocioVIP.</p>
                <div className="mt-10 animate-bounce relative group">
                  {/* Smoke effect background */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#053264] via-[#0a5cbb] to-[#053264] rounded-full blur-lg opacity-40 group-hover:opacity-70 animate-pulse transition-opacity duration-500" />
                  
                  <Link href="/landing" className="relative inline-flex items-center justify-center px-8 py-4 rounded-full bg-gradient-to-r from-[#053264] to-[#0a5cbb] text-white font-black text-xs sm:text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(5,50,100,0.5)] transition-all overflow-hidden border border-white/10 hover:scale-105 duration-300">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#10b981] to-[#ccffbc] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <span className="relative z-10 flex items-center gap-2 group-hover:text-[#053264] transition-colors duration-300">
                      <Building className="h-4 w-4" />
                      ¿Quieres que tu negocio aparezca aquí?
                      <Sparkles className="h-4 w-4 text-[#ccffbc] group-hover:text-[#053264] transition-colors duration-300" />
                    </span>
                  </Link>
                </div>
              </div>
              {businesses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {businesses.map((business) => <BusinessCard key={business.id} business={business} />)}
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-20 text-center border-2 border-dashed border-slate-200">
                  <Building className="h-12 w-12 text-slate-300 mx-auto mb-4 animate-pulse" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando experiencias...</p>
                </div>
              )}
            </section>
          )}

          {showEvents && (
            <section id="eventos" className="scroll-mt-24">
              <div className="flex flex-col items-center text-center mb-12">
                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Próximos Eventos</h2>
                <div className="w-20 h-1 bg-[#053264] rounded-full" />
                <p className="mt-4 text-slate-500 font-medium">No te pierdas las mejores experiencias de la semana.</p>
              </div>
              {events.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {events.map((entity) => <EntityCard key={entity.id} entity={entity} />)}
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-20 text-center border-2 border-dashed border-slate-200">
                  <PartyPopper className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando eventos...</p>
                </div>
              )}
            </section>
          )}

          {showPromotions && (
            <section id="promociones" className="scroll-mt-24">
              <div className="flex flex-col items-center text-center mb-12">
                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Promociones Vigentes</h2>
                <div className="w-20 h-1 bg-[#053264] rounded-full" />
                <p className="mt-4 text-slate-500 font-medium">Beneficios exclusivos para nuestros miembros.</p>
              </div>
              {promotions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {promotions.map((entity) => <EntityCard key={entity.id} entity={entity} />)}
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-20 text-center border-2 border-dashed border-slate-200">
                  <Tag className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Buscando ofertas...</p>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {/* WhatsApp Button */}
      <a 
        href={`https://wa.me/${whatsAppPhone}?text=${encodeURIComponent("¡Hola, SocioVIP! 👋 Acabo de visitar su sitio web y me gustaría hacer una consulta sobre la plataforma.")}`} 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-10 left-10 z-[60] w-14 h-14 bg-[#25d366] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.767 5.767 0 1.267.405 2.454 1.093 3.417L6.643 18l2.711-.711c.85.503 1.839.791 2.898.791 3.181 0 5.767-2.586 5.767-5.767s-2.586-5.767-5.767-5.767zm0 10.495c-1.125 0-2.18-.344-3.053-.941l-.219-.131-1.61.423.431-1.57-.144-.229a4.67 4.67 0 0 1-.741-2.5c0-2.592 2.108-4.7 4.7-4.7 2.592 0 4.7 2.108 4.7 4.7s-2.108 4.7-4.7 4.7zM14.73 12.82c-.15-.075-.89-.439-1.028-.489-.138-.05-.238-.075-.338.075s-.389.489-.477.589-.175.112-.325.037a4.103 4.103 0 0 1-1.205-.744 4.53 4.53 0 0 1-.832-1.036c-.088-.15-.009-.23.066-.305.067-.067.15-.175.225-.262s.1-.15.15-.25c.05-.1.025-.188-.012-.262s-.338-.814-.463-1.114c-.122-.292-.245-.253-.338-.258-.088-.005-.188-.005-.288-.005s-.262.037-.4.188c-.138.15-.525.513-.525 1.25s.538 1.45.613 1.55c.075.1 1.058 1.615 2.564 2.264.358.154.638.246.856.316.36.114.688.098.947.059.288-.044.89-.363 1.014-.714s.124-.65.088-.714-.138-.113-.288-.188z"/>
        </svg>
      </a>
    </div>
  );
}
