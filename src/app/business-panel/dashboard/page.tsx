
"use client";

import { StatCard } from "@/components/admin/StatCard"; 
import { Ticket, Calendar, Users, BarChart3, ScanLine, Loader2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import type { BusinessManagedEntity } from "@/lib/types";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BusinessDashboardStats {
  activePromotions: number;
  upcomingEvents: number;
  totalRedemptionsToday: number; 
  qrGeneratedWithCodes: number; // Placeholder
}

export default function BusinessDashboardPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [stats, setStats] = useState<BusinessDashboardStats>({
    activePromotions: 0,
    upcomingEvents: 0,
    totalRedemptionsToday: 0,
    qrGeneratedWithCodes: 0, // Placeholder
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
      const fetchedBusinessId = userProfile.businessId;
      if (fetchedBusinessId && typeof fetchedBusinessId === 'string' && fetchedBusinessId.trim() !== '') {
        setCurrentBusinessId(fetchedBusinessId.trim());
      } else {
        console.warn("BusinessDashboardPage: UserProfile does not have a valid businessId. User roles:", userProfile.roles);
        setCurrentBusinessId(null);
        setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, qrGeneratedWithCodes: 0 });
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
      setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, qrGeneratedWithCodes: 0 });
      setIsLoading(false);
    }
  }, [userProfile, loadingAuth, loadingProfile, toast, isLoading]);


  const fetchBusinessStats = useCallback(async (businessIdForQuery: string) => {
    console.log("BusinessDashboardPage: fetchBusinessStats called for businessId:", businessIdForQuery);
    
    if (typeof businessIdForQuery !== 'string' || businessIdForQuery.trim() === '') {
        console.error("BusinessDashboardPage: fetchBusinessStats called with invalid businessIdForQuery:", businessIdForQuery, "UserProfile for context:", userProfile);
        setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, qrGeneratedWithCodes: 0 });
        setIsLoading(false); 
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
        else if (data.startDate instanceof Date) startDateStr = data.startDate.toISOString();
        else { 
          console.warn(`BusinessDashboardPage: Entity ${docSnap.id} for business ${data.businessId} missing or invalid startDate. Using fallback.`);
          startDateStr = nowISO;
        }

        let endDateStr: string;
        if (data.endDate instanceof Timestamp) endDateStr = data.endDate.toDate().toISOString();
        else if (typeof data.endDate === 'string') endDateStr = data.endDate;
        else if (data.endDate instanceof Date) endDateStr = data.endDate.toISOString();
        else { 
          console.warn(`BusinessDashboardPage: Entity ${docSnap.id} for business ${data.businessId} missing or invalid endDate. Using fallback.`);
          endDateStr = nowISO;
        }
        
        entities.push({
          id: docSnap.id,
          businessId: data.businessId,
          type: data.type as "promotion" | "event",
          name: data.name || "Entidad sin nombre",
          description: data.description || "",
          startDate: startDateStr,
          endDate: endDateStr,
          usageLimit: data.usageLimit === undefined || data.usageLimit === null ? 0 : Number(data.usageLimit),
          maxAttendance: data.maxAttendance === undefined || data.maxAttendance === null ? 0 : Number(data.maxAttendance),
          isActive: data.isActive === undefined ? true : data.isActive,
          generatedCodes: Array.isArray(data.generatedCodes) ? data.generatedCodes : [],
          // No necesitamos cargar sub-arrays completos aquí para las stats básicas
          ticketTypes: [], 
          eventBoxes: [],
          assignedPromoters: [], 
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
        qrGeneratedWithCodes: 0, // Mantener como 0, no hay lógica de backend para este contador aún
      }));

    } catch (error: any) {
      console.error("BusinessDashboardPage: Error fetching business dashboard stats:", error.code, error.message, error);
      setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, qrGeneratedWithCodes: 0 });
      toast({
        title: "Error al Cargar las Estadísticas del Negocio",
        description: `Permiso denegado (${error.code || 'desconocido'}). Asegúrate de que tu perfil en Firestore (colección 'platformUsers', documento con tu UID de Auth) tenga un campo 'roles' como un array con 'business_admin' o 'staff', y un campo 'businessId' válido. Revisa las reglas de seguridad de Firestore.`,
        variant: "destructive",
        duration: 15000,
      });
    } finally {
      setIsLoading(false); 
      console.log("BusinessDashboardPage: fetchBusinessStats finished, isLoading set to false.");
    }
  }, [toast, userProfile]);

  useEffect(() => {
    console.log("BusinessDashboardPage: Effect for fetching data. loadingAuth:", loadingAuth, "loadingProfile:", loadingProfile, "currentBusinessId:", currentBusinessId);
    if (loadingAuth || loadingProfile) {
      return;
    }

    if (currentBusinessId) {
      console.log("BusinessDashboardPage: Valid currentBusinessId, calling fetchBusinessStats:", currentBusinessId);
      fetchBusinessStats(currentBusinessId);
    } else {
      console.log("BusinessDashboardPage: No currentBusinessId for fetching stats. Ensuring isLoading is false.");
      if (isLoading) setIsLoading(false);
      setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, qrGeneratedWithCodes: 0 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [currentBusinessId, loadingAuth, loadingProfile]); // fetchBusinessStats se quita de aquí porque está en useCallback con userProfile


  if (isLoading) { 
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
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
        <StatCard title="QRs generados con tus códigos" value={stats.qrGeneratedWithCodes} icon={Users} />
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
          <p className="text-muted-foreground">Aquí iría un gráfico de rendimiento de promociones.</p>
        </CardContent>
      </Card>

       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Actividad Reciente de tu Negocio</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[150px] flex flex-col items-center justify-center text-center">
          <Info className="h-12 w-12 text-primary/60 mb-3" />
           <p className="text-muted-foreground">
            La actividad reciente de tu negocio se mostrará aquí una vez que se integre el sistema de registro de eventos del backend.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
