
"use client";

import { StatCard } from "@/components/admin/StatCard";
import { Ticket, Calendar, ScanLine, Loader2, Info, QrCode as QrCodeLucide, CheckCircle, TicketCheck, ScanSearch, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import type { BusinessManagedEntity } from "@/lib/types";
import { isEntityCurrentlyActivatable, anyToDate } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface RecentActivity {
  id: string;
  type: 'redeemed' | 'used';
  date: string; // ISO string
  entityName: string;
  clientName: string;
  codeValue: string;
}

interface BusinessDashboardStats {
  activeEntities: number;
  totalCodesCreated: number;
  totalCodesRedeemed: number; 
  totalCodesUsed: number;
  recentActivities: RecentActivity[];
}

export default function BusinessDashboardPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const [stats, setStats] = useState<BusinessDashboardStats>({
    activeEntities: 0,
    totalCodesCreated: 0,
    totalCodesRedeemed: 0,
    totalCodesUsed: 0,
    recentActivities: [],
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
        else startDateStr = nowISO;

        let endDateStr: string;
        if (data.endDate instanceof Timestamp) endDateStr = data.endDate.toDate().toISOString();
        else if (typeof data.endDate === 'string') endDateStr = data.endDate;
        else if (data.endDate instanceof Date) endDateStr = data.endDate.toISOString();
        else endDateStr = nowISO;
        
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
      let totalCodesRedeemedCount = 0;
      let totalCodesUsedCount = 0;
      const allActivities: RecentActivity[] = [];
      
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

              // Collect recent activities
              if (code.status === 'redeemed' && code.redemptionDate && code.redeemedByInfo) {
                const redemptionDate = anyToDate(code.redemptionDate);
                if (redemptionDate) {
                  allActivities.push({
                    id: `${code.id}-redeemed`,
                    type: 'redeemed',
                    date: redemptionDate.toISOString(),
                    entityName: entity.name,
                    clientName: code.redeemedByInfo.name,
                    codeValue: code.value
                  });
                }
              }
              if (code.status === 'used' && code.usedDate && code.redeemedByInfo) {
                const usedDate = anyToDate(code.usedDate);
                 if (usedDate) {
                    allActivities.push({
                      id: `${code.id}-used`,
                      type: 'used',
                      date: usedDate.toISOString(),
                      entityName: entity.name,
                      clientName: code.redeemedByInfo.name,
                      codeValue: code.value
                    });
                 }
              }
            });
        }
      });
      
      const sortedActivities = allActivities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5); // Get latest 5

      setStats({
        activeEntities: activeEntitiesCount,
        totalCodesCreated: totalCodesCreatedCount,
        totalCodesRedeemed: totalCodesRedeemedCount,
        totalCodesUsed: totalCodesUsedCount,
        recentActivities: sortedActivities,
      });

    } catch (error: any) {
      setStats({ activeEntities: 0, totalCodesCreated: 0, totalCodesRedeemed: 0, totalCodesUsed: 0, recentActivities: [] });
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
      setStats({ activeEntities: 0, totalCodesCreated: 0, totalCodesRedeemed: 0, totalCodesUsed: 0, recentActivities: [] });
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
        <StatCard title="Promociones Activas" value={stats.activeEntities} icon={Ticket} />
        <StatCard title="Códigos Creados" value={stats.totalCodesCreated} icon={QrCodeLucide} />
        <StatCard title="Códigos Canjeados (QR Generados)" value={stats.totalCodesRedeemed} icon={TicketCheck} />
        <StatCard title="QR Validados (Asistencia)" value={stats.totalCodesUsed} icon={ScanSearch} />
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><History className="h-6 w-6 mr-2 text-primary" />Actividad Reciente de tu Negocio</CardTitle>
          <CardDescription>Las últimas 5 interacciones de clientes con tus promociones y eventos.</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentActivities.length > 0 ? (
            <div className="space-y-4">
              {stats.recentActivities.map(activity => (
                <div key={activity.id} className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {activity.type === 'redeemed' ? (
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <QrCodeLucide className="h-5 w-5 text-blue-600" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm font-medium">
                      <span className="font-semibold">{activity.clientName}</span>{' '}
                      {activity.type === 'redeemed' ? 'generó un QR para' : 'utilizó su QR para'}
                      <span className="font-semibold text-primary"> "{activity.entityName}"</span>.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.date), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-h-[150px] flex flex-col items-center justify-center text-center">
                <Info className="h-12 w-12 text-primary/60 mb-3" />
                <p className="text-muted-foreground">
                    Aún no hay actividad reciente para mostrar.
                </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
