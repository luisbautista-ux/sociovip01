
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, CheckCircle, QrCode, ScanLine, DollarSign, BarChart2, Info, Gift } from "lucide-react"; // Added Gift back for consistency, though not used in stat cards if "Entidades" is removed
import { StatCard } from "@/components/admin/StatCard";
import type { BusinessManagedEntity, Business } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PromoterDashboardStats {
  totalBusinessesAssigned: number;
  totalCodesGeneratedByPromoter: number;
  qrGeneratedWithPromoterCodes: number;
  totalCodesRedeemedByPromoter: number;
  // totalCommissionEarned: number; // Ocultado
}

export default function PromoterDashboardPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const [assignedEntities, setAssignedEntities] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAssignedEntitiesForPromoter = useCallback(async () => {
    if (!userProfile?.businessIds || userProfile.businessIds.length === 0) {
      console.warn("Promoter Dashboard: No assigned businessIds, cannot fetch entities.");
      setAssignedEntities([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    console.log(`Promoter Dashboard: Fetching entities for businesses:`, userProfile.businessIds);
    
    try {
      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("businessId", "in", userProfile.businessIds),
        where("isActive", "==", true)
      );
      const entitiesSnap = await getDocs(entitiesQuery);
      const allActiveEntities: BusinessManagedEntity[] = [];
      
      entitiesSnap.forEach(docSnap => {
        const data = docSnap.data();
        const nowISO = new Date().toISOString();
        let startDateStr: string;
        if (data.startDate instanceof Timestamp) startDateStr = data.startDate.toDate().toISOString();
        else if (typeof data.startDate === 'string') startDateStr = data.startDate;
        else if (data.startDate instanceof Date) startDateStr = data.startDate.toISOString();
        else startDateStr = nowISO;

        let endDateStr: string;
        if (data.endDate instanceof Timestamp) endDateStr = data.endDate.toDate().toISOString();
        else if (typeof data.endDate === 'string') endDateStr = data.endDate;
        else if (data.endDate instanceof Date) endDateStr = data.endDate.toISOString();
        else endDateStr = nowISO;
        
        let createdAtStr: string | undefined;
        if (data.createdAt instanceof Timestamp) createdAtStr = data.createdAt.toDate().toISOString();
        else if (typeof data.createdAt === 'string') createdAtStr = data.createdAt;
        else if (data.createdAt instanceof Date) createdAtStr = data.createdAt.toISOString();
        else createdAtStr = undefined;

        const entity: BusinessManagedEntity = {
          id: docSnap.id,
          businessId: data.businessId || "N/A",
          type: data.type as "promotion" | "event",
          name: data.name || "Entidad sin nombre",
          description: data.description || "",
          startDate: startDateStr,
          endDate: endDateStr,
          usageLimit: data.usageLimit === undefined || data.usageLimit === null ? 0 : Number(data.usageLimit),
          maxAttendance: data.maxAttendance === undefined || data.maxAttendance === null ? 0 : Number(data.maxAttendance),
          isActive: data.isActive === undefined ? true : data.isActive,
          imageUrl: data.imageUrl || "",
          aiHint: data.aiHint || "",
          termsAndConditions: data.termsAndConditions || "",
          generatedCodes: Array.isArray(data.generatedCodes) ? data.generatedCodes : [],
          ticketTypes: Array.isArray(data.ticketTypes) ? data.ticketTypes : [],
          eventBoxes: Array.isArray(data.eventBoxes) ? data.eventBoxes : [],
          assignedPromoters: Array.isArray(data.assignedPromoters) ? data.assignedPromoters : [],
          createdAt: createdAtStr,
        };
        if (isEntityCurrentlyActivatable(entity)) {
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
  }, [userProfile]);

  useEffect(() => {
    if (!loadingAuth && !loadingProfile && userProfile) {
      fetchAssignedEntitiesForPromoter();
    } else if (!loadingAuth && !loadingProfile) {
      setIsLoading(false); 
    }
  }, [userProfile, loadingAuth, loadingProfile, fetchAssignedEntitiesForPromoter]);

  const promoterStats = useMemo((): PromoterDashboardStats => {
    const uniqueBusinessIds = new Set(assignedEntities.map(entity => entity.businessId));
    let codesGeneratedByPromoter = 0;
    let codesRedeemedByPromoter = 0; // "Usados" para el promotor significa que el cliente generó su QR

    assignedEntities.forEach(entity => {
      // El promotor ahora puede generar códigos para cualquier entidad de un negocio asignado.
      // Filtramos los códigos generados por este promotor.
      const promoterCodes = (entity.generatedCodes || []).filter(c => 
        (userProfile?.uid && c.generatedByUid === userProfile.uid) || 
        (!userProfile?.uid && userProfile?.name && c.generatedByName === userProfile.name)
      );
      codesGeneratedByPromoter += promoterCodes.length;
      codesRedeemedByPromoter += promoterCodes.filter(c => c.status === 'redeemed' || c.status === 'used').length;
    });

    return {
      totalBusinessesAssigned: userProfile?.businessIds?.length || 0,
      totalCodesGeneratedByPromoter: codesGeneratedByPromoter,
      qrGeneratedWithPromoterCodes: codesRedeemedByPromoter, // Renombrado para claridad
      totalCodesRedeemedByPromoter: assignedEntities.reduce((acc, entity) => {
        return acc + (entity.generatedCodes || []).filter(c =>
          ((userProfile?.uid && c.generatedByUid === userProfile.uid) || (!userProfile?.uid && userProfile?.name && c.generatedByName === userProfile.name)) && c.status === 'used'
        ).length;
      }, 0),
    };
  }, [assignedEntities, userProfile]);

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Negocios Asignados" value={promoterStats.totalBusinessesAssigned} icon={Building} />
        <StatCard title="Códigos Creados por Ti" value={promoterStats.totalCodesGeneratedByPromoter} icon={QrCode} />
        <StatCard title="QRs generados con tus códigos" value={promoterStats.qrGeneratedWithPromoterCodes} icon={ScanLine} />
        <StatCard title="QRs usados por tus clientes" value={promoterStats.totalCodesRedeemedByPromoter} icon={CheckCircle} />
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Próximamente: Aquí verás las últimas acciones relacionadas con tus códigos y entidades asignadas.</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[150px] flex flex-col items-center justify-center text-center">
          <Info className="h-12 w-12 text-primary/60 mb-3" />
          <p className="text-muted-foreground">
            Pronto podrás ver un registro detallado de las actividades de tus clientes.
          </p>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Rendimiento por Negocio (Próximamente)</CardTitle>
          <CardDescription>Aquí verás cuántos de tus códigos se han usado por promoción/evento para cada negocio.</CardDescription>
        </CardHeader>
        <CardContent className="h-40 flex items-center justify-center">
          <p className="text-muted-foreground">Gráficos y tablas de rendimiento aquí.</p>
        </CardContent>
      </Card>
    </div>
  );
}
