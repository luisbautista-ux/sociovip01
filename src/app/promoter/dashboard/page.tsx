
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, CheckCircle, QrCode, ScanLine, Gift, BarChart2, Info } from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";
import type { BusinessManagedEntity } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PromoterDashboardStats {
  totalBusinessesAssigned: number;
  totalCodesGeneratedByPromoter: number;
  qrGeneratedWithPromoterCodes: number; // Nuevo contador
  totalCodesRedeemedByPromoter: number;
}

export default function PromoterDashboardPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const [assignedEntities, setAssignedEntities] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAssignedEntitiesForPromoter = useCallback(async (promoterName: string) => {
    if (!promoterName) {
      setAssignedEntities([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    console.log("Promoter Dashboard: Fetching entities where promoterName is assigned:", promoterName);
    try {
      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("isActive", "==", true)
        // No podemos filtrar por `assignedPromoters` array directamente de forma eficiente.
        // Se obtiene todo y se filtra en cliente o se necesitaría una estructura de datos diferente.
      );
      const entitiesSnap = await getDocs(entitiesQuery);
      const allActiveEntities: BusinessManagedEntity[] = [];
      entitiesSnap.forEach(docSnap => {
        const data = docSnap.data();
        const entity: BusinessManagedEntity = {
          id: docSnap.id,
          // ... (resto de los campos mapeados como en promoter/entities/page.tsx)
          businessId: data.businessId,
          type: data.type as "promotion" | "event",
          name: data.name,
          description: data.description,
          startDate: data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : String(data.startDate),
          endDate: data.endDate instanceof Timestamp ? data.endDate.toDate().toISOString() : String(data.endDate),
          usageLimit: data.usageLimit,
          maxAttendance: data.maxAttendance,
          isActive: data.isActive,
          imageUrl: data.imageUrl,
          aiHint: data.aiHint,
          termsAndConditions: data.termsAndConditions,
          generatedCodes: Array.isArray(data.generatedCodes) ? data.generatedCodes : [],
          ticketTypes: Array.isArray(data.ticketTypes) ? data.ticketTypes : [],
          eventBoxes: Array.isArray(data.eventBoxes) ? data.eventBoxes : [],
          assignedPromoters: Array.isArray(data.assignedPromoters) ? data.assignedPromoters : [],
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        };
        if (entity.assignedPromoters?.some(ap => ap.promoterName === promoterName) && isEntityCurrentlyActivatable(entity)) {
          allActiveEntities.push(entity);
        }
      });
      setAssignedEntities(allActiveEntities);
      console.log("Promoter Dashboard: Fetched and filtered assigned entities:", allActiveEntities.length);
    } catch (error) {
      console.error("Promoter Dashboard: Error fetching assigned entities:", error);
      setAssignedEntities([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadingAuth && !loadingProfile && userProfile?.name) {
      fetchAssignedEntitiesForPromoter(userProfile.name);
    } else if (!loadingAuth && !loadingProfile) {
      setIsLoading(false); // No user or name, stop loading
    }
  }, [userProfile, loadingAuth, loadingProfile, fetchAssignedEntitiesForPromoter]);

  const promoterStats = useMemo((): PromoterDashboardStats => {
    const uniqueBusinessIds = new Set(assignedEntities.map(entity => entity.businessId));
    let codesGenerated = 0;
    let codesRedeemed = 0;

    assignedEntities.forEach(entity => {
      const promoterCodes = entity.generatedCodes?.filter(c => c.generatedByName === userProfile?.name) || [];
      codesGenerated += promoterCodes.length;
      codesRedeemed += promoterCodes.filter(c => c.status === 'redeemed').length;
    });

    return {
      totalBusinessesAssigned: uniqueBusinessIds.size,
      totalCodesGeneratedByPromoter: codesGenerated,
      qrGeneratedWithPromoterCodes: 0, // Placeholder, se actualizará con lógica de backend
      totalCodesRedeemedByPromoter: codesRedeemed,
    };
  }, [assignedEntities, userProfile?.name]);

  if (loadingAuth || loadingProfile || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando dashboard del promotor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <BarChart2 className="h-8 w-8 mr-2" /> Dashboard del Promotor
      </h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"> {/* Ajustado para 3 tarjetas visibles inicialmente */}
        <StatCard title="Negocios Asignados (Activos)" value={promoterStats.totalBusinessesAssigned} icon={Building} />
        <StatCard title="Códigos Creados por Ti" value={promoterStats.totalCodesGeneratedByPromoter} icon={QrCode} />
        <StatCard title="QRs generados con tus códigos" value={promoterStats.qrGeneratedWithPromoterCodes} icon={ScanLine} />
        <StatCard title="QRs usados por tus clientes" value={promoterStats.totalCodesRedeemedByPromoter} icon={CheckCircle} />
        {/* Comisión Estimada ha sido ocultada */}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Últimas acciones relacionadas con tus códigos y entidades.</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[150px] flex flex-col items-center justify-center text-center">
          <Info className="h-12 w-12 text-primary/60 mb-3" />
          <p className="text-muted-foreground">
            La actividad reciente se mostrará aquí una vez que se integre con el sistema de registro de eventos del backend.
          </p>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Rendimiento por Entidad (Próximamente)</CardTitle>
          <CardDescription>Aquí verás cuántos de tus códigos se han usado por promoción/evento.</CardDescription>
        </CardHeader>
        <CardContent className="h-40 flex items-center justify-center">
          <p className="text-muted-foreground">Gráficos y tablas de rendimiento aquí.</p>
        </CardContent>
      </Card>
    </div>
  );
}
