
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
import { startOfDay, endOfDay, parseISO } from "date-fns"; // Removed isToday, isFuture as we use isEntityCurrentlyActivatable or direct date comparisons
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

  useEffect(() => {
    console.log("BusinessDashboardPage: Auth/Profile loading state. loadingAuth:", loadingAuth, "loadingProfile:", loadingProfile);
    if (loadingAuth || loadingProfile) {
      if (!isLoading) setIsLoading(true);
      return;
    }

    if (userProfile) {
      console.log("BusinessDashboardPage: UserProfile loaded in useEffect:", userProfile);
      if (userProfile.businessId && typeof userProfile.businessId === 'string' && userProfile.businessId.trim() !== '') {
        const trimmedBid = userProfile.businessId.trim();
        setCurrentBusinessId(trimmedBid);
        // setIsLoading will be handled by the fetchBusinessStats call or if no businessId
      } else {
        console.warn("BusinessDashboardPage: UserProfile does not have a valid businessId. User roles:", userProfile.roles);
        setCurrentBusinessId(null);
        setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
        setIsLoading(false);
        if (userProfile.roles?.includes('business_admin') || userProfile.roles?.includes('staff')) {
           toast({
            title: "Error de Configuración del Negocio",
            description: "Tu perfil de usuario no está asociado a un negocio válido para cargar el dashboard. Contacta al superadministrador.",
            variant: "destructive",
            duration: 10000,
          });
        }
      }
    } else { 
      console.log("BusinessDashboardPage: No userProfile found after auth/profile load. Cannot fetch business stats.");
      setCurrentBusinessId(null);
      setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
      setIsLoading(false);
    }
  }, [userProfile, loadingAuth, loadingProfile, toast, isLoading]); // isLoading added to dependencies though might not be strictly necessary if logic is correct.


  const fetchBusinessStats = useCallback(async (businessIdForQuery: string) => {
    console.log("BusinessDashboardPage: fetchBusinessStats called for businessId:", businessIdForQuery);
    
    if (typeof businessIdForQuery !== 'string' || businessIdForQuery.trim() === '') {
        console.error("BusinessDashboardPage: fetchBusinessStats called with invalid businessIdForQuery:", businessIdForQuery, "UserProfile for context:", userProfile);
        setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
        setIsLoading(false); 
        return;
    }

    setIsLoading(true); // Set loading true at the beginning of fetch
    try {
      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("businessId", "==", businessIdForQuery)
      );
      const querySnapshot = await getDocs(entitiesQuery);
      console.log("BusinessDashboardPage: Fetched businessEntities snapshot size for businessId", businessIdForQuery, ":", querySnapshot.size);

      const entities: BusinessManagedEntity[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const nowISO = new Date().toISOString();
        
        let startDateStr: string;
        if (data.startDate instanceof Timestamp) startDateStr = data.startDate.toDate().toISOString();
        else if (typeof data.startDate === 'string') startDateStr = data.startDate;
        else {
            console.warn(`BusinessDashboardPage: Entity ${docSnap.id} for business ${data.businessId} missing or invalid startDate. Using fallback.`);
            startDateStr = nowISO;
        }

        let endDateStr: string;
        if (data.endDate instanceof Timestamp) endDateStr = data.endDate.toDate().toISOString();
        else if (typeof data.endDate === 'string') endDateStr = data.endDate;
        else {
            console.warn(`BusinessDashboardPage: Entity ${docSnap.id} for business ${data.businessId} missing or invalid endDate. Using fallback.`);
            endDateStr = nowISO;
        }
        
        entities.push({
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
          ticketTypes: [], // Not strictly needed for these dashboard stats
          eventBoxes: [], // Not strictly needed
          assignedPromoters: [], // Not strictly needed
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : undefined),
        } as BusinessManagedEntity);
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
            // Check if start date is in the future relative to the start of today
            if (entity.startDate && parseISO(entity.startDate) > todayEndObj) {
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
      }));

    } catch (error: any) {
      console.error("BusinessDashboardPage: Error fetching business dashboard stats:", error.code, error.message, error);
      setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
      toast({
        title: "Error al Cargar las Estadísticas del Negocio",
        description: `Permiso denegado (${error.code || 'desconocido'}). Asegúrate de que tu perfil en Firestore (colección 'platformUsers', documento con tu UID de Auth) tenga un campo 'roles' como un array con 'business_admin' o 'staff', y un campo 'businessId' válido. Revisa las reglas de seguridad de Firestore.`,
        variant: "destructive",
        duration: 15000,
      });
    } finally {
      setIsLoading(false); // Ensure isLoading is set to false in finally
      console.log("BusinessDashboardPage: fetchBusinessStats finished, isLoading set to false.");
    }
  }, [toast, userProfile]); // userProfile included for console.error context

  useEffect(() => {
    console.log("BusinessDashboardPage: Effect for fetching data. loadingAuth:", loadingAuth, "loadingProfile:", loadingProfile, "currentBusinessId:", currentBusinessId);
    if (loadingAuth || loadingProfile) {
      // Still loading auth or profile, do nothing until that's complete.
      // isLoading should ideally be true from initial state or set by the other effect.
      if (!isLoading) setIsLoading(true); // Ensure loading spinner shows if somehow missed
      return;
    }

    if (currentBusinessId) {
      console.log("BusinessDashboardPage: Valid currentBusinessId, calling fetchBusinessStats:", currentBusinessId);
      fetchBusinessStats(currentBusinessId);
    } else {
      // This case means no valid businessId was found for the user after auth/profile loaded.
      // The first useEffect should have handled setting isLoading to false.
      console.log("BusinessDashboardPage: No currentBusinessId for fetching stats. Ensuring isLoading is false.");
      if (isLoading) setIsLoading(false);
      setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [currentBusinessId, fetchBusinessStats, loadingAuth, loadingProfile]); // Removed isLoading from here to prevent re-triggering fetchBusinessStats when it sets isLoading itself.


  if (isLoading) { // This covers initial auth loading and data fetching loading
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando estadísticas del negocio...</p>
      </div>
    );
  }

  if (!currentBusinessId && !isLoading && userProfile && (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff'))) {
    return (
        <div className="flex flex-col items-center justify-center h-64 p-4 border border-dashed rounded-md">
            <CardTitle className="text-xl text-destructive">Configuración de Negocio Incompleta</CardTitle>
            <CardDescription className="mt-2 text-center text-muted-foreground">
                Tu perfil de usuario está asignado a un rol de negocio, pero no tiene un ID de negocio válido asociado.
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
    
