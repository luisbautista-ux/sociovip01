
"use client";

import { StatCard } from "@/components/admin/StatCard"; 
import { Ticket, Calendar, Users, BarChart3, ScanLine, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import type { BusinessManagedEntity, GeneratedCode } from "@/lib/types";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { isToday, startOfDay, endOfDay, isFuture } from "date-fns";

interface BusinessDashboardStats {
  activePromotions: number;
  upcomingEvents: number;
  totalRedemptionsToday: number;
  newCustomersThisWeek: number; // Will remain mock for now
}

export default function BusinessDashboardPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const [stats, setStats] = useState<BusinessDashboardStats>({
    activePromotions: 0,
    upcomingEvents: 0,
    totalRedemptionsToday: 0,
    newCustomersThisWeek: 10, // Mock initial value
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (loadingAuth || loadingProfile) {
      setIsLoading(true);
      return;
    }
    if (!userProfile || !userProfile.businessId) {
      setIsLoading(false);
      // Potentially show an error or a message "No business associated"
      return;
    }

    const fetchBusinessStats = async () => {
      setIsLoading(true);
      try {
        const businessId = userProfile.businessId;
        if (!businessId) {
          setStats({ activePromotions: 0, upcomingEvents: 0, totalRedemptionsToday: 0, newCustomersThisWeek: 0 });
          setIsLoading(false);
          return;
        }

        const entitiesQuery = query(
          collection(db, "businessEntities"),
          where("businessId", "==", businessId)
        );
        const querySnapshot = await getDocs(entitiesQuery);
        const entities: BusinessManagedEntity[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as BusinessManagedEntity));

        let activePromotionsCount = 0;
        let upcomingEventsCount = 0;
        let redemptionsTodayCount = 0;
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        entities.forEach(entity => {
          if (entity.type === 'promotion' && isEntityCurrentlyActivatable(entity)) {
            activePromotionsCount++;
          }
          if (entity.type === 'event' && entity.isActive && entity.startDate && isFuture(new Date(entity.startDate))) {
            upcomingEventsCount++;
          }

          entity.generatedCodes?.forEach(code => {
            if (code.status === 'redeemed' && code.redemptionDate) {
              const redemptionDateObj = new Date(code.redemptionDate);
              if (redemptionDateObj >= todayStart && redemptionDateObj <= todayEnd) {
                redemptionsTodayCount++;
              }
            }
          });
        });
        
        // newCustomersThisWeek remains mock for now due to complexity
        setStats(prevStats => ({
          ...prevStats,
          activePromotions: activePromotionsCount,
          upcomingEvents: upcomingEventsCount,
          totalRedemptionsToday: redemptionsTodayCount,
          // newCustomersThisWeek: ... // TODO: Implement real calculation
        }));

      } catch (error) {
        console.error("Error fetching business dashboard stats:", error);
        // Keep mock or default stats on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinessStats();
  }, [userProfile, loadingAuth, loadingProfile]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando estadísticas del negocio...</p>
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
          <CardDescription>Visualiza cómo están funcionando tus promociones. (Datos de ejemplo)</CardDescription>
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
