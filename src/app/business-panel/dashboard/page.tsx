
"use client";

import { StatCard } from "@/components/admin/StatCard";
import { Ticket, Calendar, ScanLine, Loader2, Info, QrCode as QrCodeLucide, CheckCircle, TicketCheck, ScanSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import type { BusinessManagedEntity } from "@/lib/types";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { parseISO, isFuture } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BusinessDashboardStats {
  activeEntities: number;
  totalCodesCreated: number;
  totalCodesRedeemed: number; // Claimed by customer (redeemed or used)
  totalCodesUsed: number; // Scanned at the door (used)
}

export default function BusinessDashboardPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const [stats, setStats] = useState<BusinessDashboardStats>({
    activeEntities: 0,
    totalCodesCreated: 0,
    totalCodesRedeemed: 0,
    totalCodesUsed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const businessId = userProfile?.businessId;

  const fetchBusinessStats = useCallback(async (businessIdForQuery: string) => {
    try {
      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("businessId", "==", businessIdForQuery)
      );
      const querySnapshot = await getDocs(entitiesQuery);
      
      const entities: BusinessManagedEntity[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const nowISO = new Date().toISOString();
        
        let startDateStr: string;
        if (data.startDate instanceof Timestamp) startDateStr = data.startDate.toDate().toISOString();
        else if (typeof data.startDate === 'string') startDateStr = data.startDate;
        else if (data.startDate instanceof Date) startDateStr = data.startDate.toISOString();
        else { 
          startDateStr = nowISO;
        }

        let endDateStr: string;
        if (data.endDate instanceof Timestamp) endDateStr = data.endDate.toDate().toISOString();
        else if (typeof data.endDate === 'string') endDateStr = data.endDate;
        else if (data.endDate instanceof Date) endDateStr = data.endDate.toISOString();
        else { 
          endDateStr = nowISO;
        }
        
        entities.push({
          id: docSnap.id,
          businessId: data.businessId,
          type: data.type as "promotion" | "event",
          name: data.name || "Entidad sin nombre",
          generatedCodes: Array.isArray(data.generatedCodes) ? data.generatedCodes : [],
          startDate: startDateStr,
          endDate: endDateStr,
          isActive: data.isActive === undefined ? true : data.isActive,
        } as BusinessManagedEntity);
      });

      let activeEntitiesCount = 0;
      let totalCodesCreatedCount = 0; 
      let totalCodesRedeemedCount = 0; // status 'redeemed' or 'used'
      let totalCodesUsedCount = 0; // status 'used'
      
      entities.forEach(entity => {
        if (isEntityCurrentlyActivatable(entity)) {
          activeEntitiesCount++;
        }

        if (entity.generatedCodes && Array.isArray(entity.generatedCodes)) {
            totalCodesCreatedCount += entity.generatedCodes.length;
            entity.generatedCodes.forEach(code => {
              if (code.status === 'redeemed' || code.status === 'used') {
                totalCodesRedeemedCount++;
              }
              if (code.status === 'used') {
                totalCodesUsedCount++;
              }
            });
        }
      });
      
      setStats({
        activeEntities: activeEntitiesCount,
        totalCodesCreated: totalCodesCreatedCount,
        totalCodesRedeemed: totalCodesRedeemedCount,
        totalCodesUsed: totalCodesUsedCount,
      });

    } catch (error: any) {
      setStats({ activeEntities: 0, totalCodesCreated: 0, totalCodesRedeemed: 0, totalCodesUsed: 0 });
      toast({
        title: "Error al Cargar Estadísticas del Negocio",
        description: `No se pudieron obtener las estadísticas. Error: ${error.message}. Asegúrate de que tu perfil de Firestore ('platformUsers') tenga 'businessId' y roles correctos ('business_admin', 'staff') y que las reglas de Firestore permitan el acceso.`,
        variant: "destructive",
        duration: 15000,
      });
    } finally {
      setIsLoading(false); 
    }
  }, [toast]);

  useEffect(() => {
    if (loadingAuth || loadingProfile) {
      setIsLoading(true);
      return;
    }

    if (businessId) {
      setIsLoading(true);
      fetchBusinessStats(businessId);
    } else {
      setStats({ activeEntities: 0, totalCodesCreated: 0, totalCodesRedeemed: 0, totalCodesUsed: 0 });
      setIsLoading(false); 
      if (userProfile && (userProfile.roles?.includes('business_admin') || userProfile.roles?.includes('staff'))) {
        toast({
          title: "Error de Configuración del Negocio",
          description: "Tu perfil de usuario no está asociado a un negocio válido para cargar el dashboard. Contacta al superadministrador.",
          variant: "destructive",
          duration: 10000,
        });
      }
    }
  }, [businessId, loadingAuth, loadingProfile, fetchBusinessStats, toast, userProfile]);


  if (isLoading) { 
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando estadísticas del negocio...</p>
      </div>
    );
  }
  
  if (!businessId && userProfile && (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff'))) {
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
        <StatCard title="Promociones/Eventos Activos" value={stats.activeEntities} icon={Ticket} />
        <StatCard title="Códigos Creados" value={stats.totalCodesCreated} icon={QrCodeLucide} />
        <StatCard title="Códigos Canjeados (QR Generados)" value={stats.totalCodesRedeemed} icon={TicketCheck} />
        <StatCard title="QR Validados (Asistencia)" value={stats.totalCodesUsed} icon={ScanSearch} />
      </div>

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
