
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
import { Loader2, Building, Tag, Search } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface EnrichedPromotion extends BusinessManagedEntity {
  businessName?: string;
  businessLogoUrl?: string;
  businessCustomUrlPath?: string | null;
}

export default function HomePage() {
  const [allPromotions, setAllPromotions] = useState<EnrichedPromotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const fetchPromotionsAndBusinesses = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all businesses and create a map
      const businessesSnap = await getDocs(collection(db, "businesses"));
      const businessesMap = new Map<string, Business>();
      businessesSnap.forEach(doc => {
        businessesMap.set(doc.id, { id: doc.id, ...doc.data() } as Business);
      });

      // 2. Fetch all active promotions
      const promotionsQuery = query(
        collection(db, "businessEntities"),
        where("type", "==", "promotion"),
        where("isActive", "==", true)
      );
      const promotionsSnap = await getDocs(promotionsQuery);
      
      const enrichedPromotions: EnrichedPromotion[] = [];
      promotionsSnap.forEach(doc => {
        const promoData = doc.data() as Omit<BusinessManagedEntity, 'id'> & { startDate: Timestamp | string, endDate: Timestamp | string };
        const business = businessesMap.get(promoData.businessId);
        
        // Helper to safely convert a Firestore Timestamp or a date string to an ISO string
        const toSafeISOString = (dateValue: Timestamp | string | Date | undefined): string => {
            if (!dateValue) return new Date().toISOString(); // Fallback to now
            if (dateValue instanceof Timestamp) {
                return dateValue.toDate().toISOString();
            }
            if (dateValue instanceof Date) {
              return dateValue.toISOString();
            }
            // If it's a string, assume it's a valid date string
            if (typeof dateValue === 'string') {
                return new Date(dateValue).toISOString();
            }
            return new Date().toISOString(); // Final fallback
        };

        const entityForCheck: BusinessManagedEntity = {
            id: doc.id,
            ...promoData,
            startDate: toSafeISOString(promoData.startDate),
            endDate: toSafeISOString(promoData.endDate),
        };

        // 3. Filter for currently valid promotions
        if (isEntityCurrentlyActivatable(entityForCheck) && business) {
          enrichedPromotions.push({
            ...entityForCheck,
            businessName: business.name,
            businessLogoUrl: business.logoUrl,
            businessCustomUrlPath: business.customUrlPath,
          });
        }
      });
      
      // 4. Sort promotions, e.g., by end date (soonest to expire first)
      enrichedPromotions.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
      
      setAllPromotions(enrichedPromotions);

    } catch (error: any) {
      console.error("Error fetching promotions for homepage:", error);
      toast({
        title: "Error al Cargar Promociones",
        description: "No se pudieron obtener las promociones. " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPromotionsAndBusinesses();
  }, [fetchPromotionsAndBusinesses]);

  const filteredPromotions = useMemo(() => {
    if (!searchTerm) return allPromotions;
    const lowercasedTerm = searchTerm.toLowerCase();
    return allPromotions.filter(promo => 
      promo.name.toLowerCase().includes(lowercasedTerm) ||
      (promo.description && promo.description.toLowerCase().includes(lowercasedTerm)) ||
      promo.businessName?.toLowerCase().includes(lowercasedTerm)
    );
  }, [allPromotions, searchTerm]);

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="py-6 px-4 sm:px-6 lg:px-8 bg-background shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SocioVipLogo className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-primary">SocioVIP</h1>
              <p className="text-sm text-muted-foreground">Descubre las mejores promociones cerca de ti</p>
            </div>
          </div>
          <div className="relative w-full sm:w-auto sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar promoción o negocio..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg text-muted-foreground">Cargando promociones...</p>
          </div>
        ) : filteredPromotions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPromotions.map((promo) => {
              const businessUrl = promo.businessCustomUrlPath
                ? `/b/${promo.businessCustomUrlPath}`
                : `/business/${promo.businessId}`;
              
              return (
                <Card key={promo.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg bg-card">
                  <div className="relative aspect-[16/9] w-full">
                    <NextImage src={promo.imageUrl || "https://placehold.co/600x400.png"} alt={promo.name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover" data-ai-hint={promo.aiHint || "discount offer"}/>
                  </div>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{promo.name}</CardTitle>
                    <CardDescription className="text-xs pt-1">
                      <Link href={businessUrl} className="flex items-center text-muted-foreground hover:text-primary transition-colors">
                        {promo.businessLogoUrl ? (
                           <NextImage src={promo.businessLogoUrl} alt={`${promo.businessName} logo`} width={16} height={16} className="h-4 w-4 mr-1.5 rounded-full object-contain" data-ai-hint="logo business"/>
                        ) : (
                          <Building className="h-4 w-4 mr-1.5" />
                        )}
                        <span>{promo.businessName}</span>
                      </Link>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-1">
                    <p className="text-sm text-muted-foreground line-clamp-3">{promo.description}</p>
                  </CardContent>
                  <CardFooter className="flex-col items-start p-4 border-t bg-muted/50">
                     <p className="text-xs text-muted-foreground w-full mb-2">Válido hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}</p>
                    <Link href={businessUrl} passHref className="w-full">
                      <Button className="w-full bg-primary hover:bg-primary/90">
                        <Tag className="mr-2 h-4 w-4"/> Ver Promoción
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-xl font-semibold">No se encontraron promociones</p>
            <p className="text-muted-foreground mt-2">
              {searchTerm ? "Intenta con otra búsqueda." : "Vuelve más tarde para ver nuevas ofertas."}
            </p>
          </div>
        )}
      </main>

       <footer className="w-full mt-auto py-6 px-4 sm:px-6 lg:px-8 bg-background text-sm border-t">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-muted-foreground">&copy; {new Date().getFullYear()} SocioVIP. Todos los derechos reservados.</p>
           <Link href="/login" passHref>
             <Button variant="ghost" size="sm">Acceso a Paneles</Button>
           </Link>
        </div>
      </footer>
    </div>
  );
}
