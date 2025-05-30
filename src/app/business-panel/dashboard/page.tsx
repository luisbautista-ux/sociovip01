
"use client";

import { StatCard } from "@/components/admin/StatCard"; 
import { Ticket, Calendar, Users, BarChart3, ScanLine, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import type { BusinessManagedEntity } from "@/lib/types";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { isToday, startOfDay, endOfDay, isFuture, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BusinessDashboardStats {
  activePromotions: number;
  upcomingEvents: number;
  totalRedemptionsToday: number;
  newCustomersThisWeek: number; 
}

export default function BusinessDashboardPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [stats, setStats] = useState<BusinessDashboardStats>({
    activePromotions: 0,
    upcomingEvents: 0,
    totalRedemptionsToday: 0,
    newCustomersThisWeek: 0, // Kept as 0, will be placeholder
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchBusinessStats = useCallback(async (businessIdForQuery: string) => {
    console.log("BusinessDashboardPage: Fetching stats for businessId:", businessIdForQuery);
    if (!businessIdForQuery || typeof businessIdForQuery !== 'string' || businessIdForQuery.trim() === '') {
        console.error("BusinessDashboardPage: fetchBusinessStats called with invalid businessIdForQuery:", businessIdForQuery);
        setIsLoading(false);
        setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
        toast({
            title: "Error Interno",
            description: "No se pudo determinar el ID del negocio para cargar las estadísticas.",
            variant: "destructive",
            duration: 7000,
        });
        return;
    }
    setIsLoading(true);
    try {
      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("businessId", "==", businessIdForQuery)
      );
      const querySnapshot = await getDocs(entitiesQuery);
      console.log("BusinessDashboardPage: Fetched businessEntities snapshot size:", querySnapshot.size);

      const entities: BusinessManagedEntity[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const nowISO = new Date().toISOString();
        
        let startDateStr: string;
        if (data.startDate instanceof Timestamp) {
            startDateStr = data.startDate.toDate().toISOString();
        } else if (typeof data.startDate === 'string') {
            startDateStr = data.startDate;
        } else if (data.startDate instanceof Date) { // Should not happen if data is from Firestore directly
            startDateStr = data.startDate.toISOString();
        } else {
            console.warn(`BusinessDashboardPage: Entity ${docSnap.id} for business ${data.businessId} missing or invalid startDate. Using fallback.`);
            startDateStr = nowISO; 
        }

        let endDateStr: string;
        if (data.endDate instanceof Timestamp) {
            endDateStr = data.endDate.toDate().toISOString();
        } else if (typeof data.endDate === 'string') {
            endDateStr = data.endDate;
        } else if (data.endDate instanceof Date) { // Should not happen
            endDateStr = data.endDate.toISOString();
        } else {
            console.warn(`BusinessDashboardPage: Entity ${docSnap.id} for business ${data.businessId} missing or invalid endDate. Using fallback.`);
            endDateStr = nowISO; 
        }
        
        let createdAtStr: string | undefined;
        if (data.createdAt instanceof Timestamp) createdAtStr = data.createdAt.toDate().toISOString();
        else if (typeof data.createdAt === 'string') createdAtStr = data.createdAt;
        else createdAtStr = undefined;

        return {
          id: docSnap.id,
          businessId: data.businessId,
          type: data.type,
          name: data.name || "Entidad sin nombre",
          description: data.description || "",
          startDate: startDateStr,
          endDate: endDateStr,
          usageLimit: data.usageLimit === undefined || data.usageLimit === null ? 0 : Number(data.usageLimit),
          maxAttendance: data.maxAttendance === undefined || data.maxAttendance === null ? 0 : Number(data.maxAttendance),
          isActive: data.isActive === undefined ? true : data.isActive,
          generatedCodes: Array.isArray(data.generatedCodes) ? data.generatedCodes : [],
          ticketTypes: Array.isArray(data.ticketTypes) ? data.ticketTypes : [],
          eventBoxes: Array.isArray(data.eventBoxes) ? data.eventBoxes : [],
          assignedPromoters: Array.isArray(data.assignedPromoters) ? data.assignedPromoters : [],
          imageUrl: data.imageUrl || "",
          aiHint: data.aiHint || "",
          termsAndConditions: data.termsAndConditions || "",
          createdAt: createdAtStr,
        } as BusinessManagedEntity;
      });
      console.log("BusinessDashboardPage: Processed entities for dashboard:", entities.length);

      let activePromotionsCount = 0;
      let upcomingEventsCount = 0;
      let redemptionsTodayCount = 0;
      const todayStartObj = startOfDay(new Date());
      const todayEndObj = endOfDay(new Date());

      entities.forEach(entity => {
        if (entity.type === 'promotion' && isEntityCurrentlyActivatable(entity)) {
          activePromotionsCount++;
        }
        if (entity.type === 'event' && entity.isActive) {
          try {
            if (entity.startDate && isFuture(parseISO(entity.startDate))) {
              upcomingEventsCount++;
            }
          } catch (e) {
            console.warn("BusinessDashboardPage: Invalid startDate format for event:", entity.id, entity.startDate, e);
          }
        }

        entity.generatedCodes?.forEach(code => {
          if (code.status === 'redeemed' && code.redemptionDate) {
            try {
              const redemptionDateObj = parseISO(code.redemptionDate);
              if (redemptionDateObj >= todayStartObj && redemptionDateObj <= todayEndObj) {
                redemptionsTodayCount++;
              }
            } catch (e) {
              console.warn("BusinessDashboardPage: Invalid redemptionDate format for code:", code.id, code.redemptionDate, e);
            }
          }
        });
      });
      
      console.log("BusinessDashboardPage: Calculated activePromotions:", activePromotionsCount);
      console.log("BusinessDashboardPage: Calculated upcomingEvents:", upcomingEventsCount);
      console.log("BusinessDashboardPage: Calculated redemptionsToday:", redemptionsTodayCount);

      setStats(prevStats => ({
        ...prevStats,
        activePromotions: activePromotionsCount,
        upcomingEvents: upcomingEventsCount,
        totalRedemptionsToday: redemptionsTodayCount,
        // newCustomersThisWeek remains placeholder
      }));

    } catch (error: any) {
      console.error("BusinessDashboardPage: Error fetching business dashboard stats:", error.code, error.message, error);
      setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
      toast({
        title: "Error al Cargar Estadísticas del Negocio",
        description: `Permiso denegado (${error.code || 'desconocido'}). Asegúrate de que tu perfil en Firestore (colección 'platformUsers', documento con tu UID de Auth) tenga el campo 'roles' como un array con 'business_admin' o 'staff', y un campo 'businessId' válido. Revisa las reglas de seguridad de Firestore.`,
        variant: "destructive",
        duration: 15000, // Longer duration for more detailed message
      });
    } finally {
      setIsLoading(false);
      console.log("BusinessDashboardPage: fetchBusinessStats finished.");
    }
  }, [toast]);

  useEffect(() => {
    if (loadingAuth || loadingProfile) {
      if (!isLoading) setIsLoading(true); // Ensure loading is true if auth/profile is still loading
      return;
    }

    // Auth and profile loading is complete here
    if (userProfile) {
      console.log("BusinessDashboardPage: UserProfile loaded in useEffect:", JSON.stringify(userProfile, null, 2));
      const bid = userProfile.businessId;
      if (bid && typeof bid === 'string' && bid.trim() !== '') {
        const trimmedBid = bid.trim();
        setCurrentBusinessId(trimmedBid);
        console.log("BusinessDashboardPage: CurrentBusinessId is set from userProfile, calling fetchBusinessStats with:", trimmedBid);
        fetchBusinessStats(trimmedBid);
      } else {
        console.warn("BusinessDashboardPage: UserProfile does not have a valid businessId. User roles:", userProfile.roles);
        setCurrentBusinessId(null);
        setIsLoading(false); // Not loading if no valid businessId
        setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
        // Only toast if user *should* have business access
        if (userProfile.roles?.includes('business_admin') || userProfile.roles?.includes('staff')) {
           toast({
            title: "Error de Configuración del Negocio",
            description: "Tu perfil de usuario no está asociado a un negocio válido para cargar el dashboard. Contacta al superadministrador.",
            variant: "destructive",
            duration: 7000,
          });
        }
      }
    } else { // No userProfile found after auth/profile load
      console.log("BusinessDashboardPage: No userProfile found after auth/profile load. Cannot fetch business stats.");
      setCurrentBusinessId(null);
      setIsLoading(false); // Not loading if no user profile
      setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
      // No toast here, as the BusinessPanelLayout should handle redirection or access denied message
    }
  }, [userProfile, loadingAuth, loadingProfile, fetchBusinessStats, toast, isLoading]); // Added isLoading to deps


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando estadísticas del negocio...</p>
      </div>
    );
  }

  if (!currentBusinessId && !isLoading) { // Check !isLoading as well
    return (
        <div className="flex flex-col items-center justify-center h-64 p-4 border border-dashed rounded-md">
            <CardTitle className="text-xl text-destructive">No se puede cargar el Dashboard</CardTitle>
            <CardDescription className="mt-2 text-center">
                Tu perfil de usuario no está asociado a un negocio específico o no tienes los permisos necesarios.
                Por favor, contacta al superadministrador para que verifique tu configuración en la colección 'platformUsers'.
            </CardDescription>
        </div>
    );
  }


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Dashboard de Mi Negocio</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Promociones Activas" value={stats.activePromotions} icon={Ticket} />
        <StatCard title="Eventos Próximos" value={stats.upcomingEvents} icon={Calendar} />
        <StatCard title="Canjes Hoy" value={stats.totalRedemptionsToday} icon={ScanLine} />
        <StatCard title="Nuevos Clientes (Semana)" value={stats.newCustomersThisWeek} icon={Users} description="Dato de ejemplo" />
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-primary" />
            Rendimiento Reciente de Promociones
          </CardTitle>
          <CardDescription>Visualiza cómo están funcionando tus promociones. (Datos de ejemplo para el gráfico)</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          {/* TODO: Connect this chart to real, aggregated data */}
          <p className="text-muted-foreground">Aquí iría un gráfico de rendimiento de promociones.</p>
        </CardContent>
      </Card>

       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Actividad Reciente (Datos de ejemplo)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><span className="font-semibold text-foreground">Promo "Happy Hour"</span> - 5 nuevos canjes.</li>
            <li><span className="font-semibold text-foreground">Juan Pérez (Promotor)</span> generó 10 nuevos códigos.</li>
            <li>Nuevo evento <span className="font-semibold text-foreground">"Noche de Salsa"</span> publicado.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
