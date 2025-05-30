
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

  // Effect to set currentBusinessId based on userProfile
  useEffect(() => {
    console.log("BusinessDashboardPage: Auth/Profile loading state. loadingAuth:", loadingAuth, "loadingProfile:", loadingProfile);
    if (loadingAuth || loadingProfile) {
      if (!isLoading) setIsLoading(true); // Keep loading indicator if auth/profile is still processing
      return;
    }

    // Auth and profile loading is complete here
    if (userProfile) {
      console.log("BusinessDashboardPage: UserProfile loaded in useEffect:", userProfile);
      const bid = userProfile.businessId;
      if (bid && typeof bid === 'string' && bid.trim() !== '') {
        const trimmedBid = bid.trim();
        setCurrentBusinessId(trimmedBid);
        // setIsLoading(true); // Fetch will handle its own loading state
      } else {
        console.warn("BusinessDashboardPage: UserProfile does not have a valid businessId. User roles:", userProfile.roles);
        setCurrentBusinessId(null);
        setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
        setIsLoading(false); // Not loading if no valid businessId
        if (userProfile.roles?.includes('business_admin') || userProfile.roles?.includes('staff')) {
           toast({
            title: "Error de Configuración del Negocio",
            description: "Tu perfil de usuario no está asociado a un negocio válido para cargar el dashboard. Contacta al superadministrador.",
            variant: "destructive",
            duration: 10000,
          });
        }
      }
    } else { // No userProfile found after auth/profile load
      console.log("BusinessDashboardPage: No userProfile found after auth/profile load. Cannot fetch business stats.");
      setCurrentBusinessId(null);
      setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
      setIsLoading(false); // Not loading if no user profile
    }
  }, [userProfile, loadingAuth, loadingProfile, toast, isLoading]);


  const fetchBusinessStats = useCallback(async (businessIdForQuery: string) => {
    console.log("BusinessDashboardPage: fetchBusinessStats called for businessId:", businessIdForQuery);
    
    if (!businessIdForQuery || typeof businessIdForQuery !== 'string' || businessIdForQuery.trim() === '') {
        console.error("BusinessDashboardPage: fetchBusinessStats called with invalid businessIdForQuery:", businessIdForQuery, "UserProfile:", userProfile);
        setIsLoading(false); 
        setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
        // No toast here, the other useEffect handles missing businessId for the profile
        return;
    }

    setIsLoading(true);
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
          // Omitting other fields not directly used in this dashboard calculation for brevity
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
      }));

    } catch (error: any) {
      console.error("BusinessDashboardPage: Error fetching business dashboard stats:", error.code, error.message, error);
      setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
      toast({
        title: "Error al Cargar las Estadísticas del Negocio",
        description: `Permiso denegado (${error.code || 'desconocido'}). Asegúrate de que tu perfil en Firestore (colección 'platformUsers', documento con tu UID de Auth) tenga el campo 'roles' como un array con 'business_admin' o 'staff', y un campo 'businessId' válido. Revisa las reglas de seguridad de Firestore.`,
        variant: "destructive",
        duration: 15000,
      });
    } finally {
      setIsLoading(false);
      console.log("BusinessDashboardPage: fetchBusinessStats finished, isLoading set to false.");
    }
  }, [toast, userProfile]); // userProfile is needed here for the console.error if businessIdForQuery is invalid.

  // useEffect to trigger data fetching when currentBusinessId is ready and auth is complete
   useEffect(() => {
    console.log("BusinessDashboardPage: Effect for fetching data. loadingAuth:", loadingAuth, "loadingProfile:", loadingProfile, "currentBusinessId:", currentBusinessId);
    if (loadingAuth || loadingProfile) {
      if (!isLoading) setIsLoading(true);
      return;
    }

    if (currentBusinessId) { // currentBusinessId is now guaranteed to be a non-empty string if not null
      console.log("BusinessDashboardPage: Valid currentBusinessId, calling fetchBusinessStats:", currentBusinessId);
      fetchBusinessStats(currentBusinessId);
    } else {
      // This case (no currentBusinessId after auth/profile loaded) should be handled by the first useEffect.
      // If it's reached, it means no valid businessId was found for the user.
      console.log("BusinessDashboardPage: No currentBusinessId for fetching stats. Ensuring isLoading is false.");
      if (isLoading) setIsLoading(false); // Ensure loading is off if we are not fetching.
      setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
    }
  }, [currentBusinessId, fetchBusinessStats, loadingAuth, loadingProfile, isLoading]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando estadísticas del negocio...</p>
      </div>
    );
  }

  if (!currentBusinessId && !isLoading && userProfile && (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff'))) {
    // This case is specifically for when auth/profile is loaded, user *should* have a businessId, but it's missing/invalid.
    // The toast for this is handled in the first useEffect. This is a fallback display.
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

    