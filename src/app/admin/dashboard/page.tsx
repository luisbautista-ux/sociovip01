
"use client";

import { StatCard } from "@/components/admin/StatCard";
import { Building, Users, ScanLine, ListChecks, BarChart3, Ticket, Star, Loader2, Info } from "lucide-react";
import type { AdminDashboardStats, BusinessManagedEntity } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, CartesianGrid } from 'recharts';
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { format, subMonths, parseISO } from 'date-fns'; // Import es if needed for chart
import { es } from "date-fns/locale";


// Mock Data for chart (will remain mock for now)
const mockMonthlyPromotionData = Array.from({ length: 6 }, (_, i) => {
  const monthDate = subMonths(new Date(), 5 - i);
  return {
    month: format(monthDate, "MMM yy", { locale: es }), // Format month for chart
    promotionsCreated: Math.floor(Math.random() * 15) + 5,
    qrCodesGenerated: Math.floor(Math.random() * 200) + 50,
    qrCodesUtilized: Math.floor(Math.random() * 100) + 20,
  };
});


export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalBusinesses: 0,
    totalPlatformUsers: 0,
    totalSocioVipMembers: 0,
    totalPromotionsActive: 0,
    totalQrCodesGenerated: 0,
    totalQrClients: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAdminStats = useCallback(async () => {
    setIsLoading(true);
    console.log("AdminDashboard: Starting fetchAdminStats...");
    try {
      const [
        businessesSnap,
        platformUsersSnap,
        socioVipMembersSnap,
        qrClientsSnap,
        businessEntitiesSnap,
      ] = await Promise.all([
        getDocs(collection(db, "businesses")),
        getDocs(collection(db, "platformUsers")),
        getDocs(collection(db, "socioVipMembers")),
        getDocs(collection(db, "qrClients")),
        getDocs(collection(db, "businessEntities")),
      ]);

      console.log("AdminDashboard: Fetched businesses count:", businessesSnap.size);
      console.log("AdminDashboard: Fetched platformUsers count:", platformUsersSnap.size);
      console.log("AdminDashboard: Fetched socioVipMembers count:", socioVipMembersSnap.size);
      console.log("AdminDashboard: Fetched qrClients count:", qrClientsSnap.size);
      console.log("AdminDashboard: Fetched businessEntities count:", businessEntitiesSnap.size);

      let activePromotionsCount = 0;
      let qrCodesGeneratedCount = 0; // This will count "Códigos Creados"
      
      const allEntities: BusinessManagedEntity[] = [];
      businessEntitiesSnap.forEach((doc) => {
        const data = doc.data();
        // Robust date handling
        let startDateStr: string;
        let endDateStr: string;
        const nowStr = new Date().toISOString();

        if (data.startDate instanceof Timestamp) startDateStr = data.startDate.toDate().toISOString();
        else if (typeof data.startDate === 'string') startDateStr = data.startDate;
        else if (data.startDate instanceof Date) startDateStr = data.startDate.toISOString();
        else { startDateStr = nowStr; }

        if (data.endDate instanceof Timestamp) endDateStr = data.endDate.toDate().toISOString();
        else if (typeof data.endDate === 'string') endDateStr = data.endDate;
        else if (data.endDate instanceof Date) endDateStr = data.endDate.toISOString();
        else { endDateStr = nowStr; }
        
        allEntities.push({ 
            id: doc.id, 
            ...data,
            startDate: startDateStr,
            endDate: endDateStr,
            // Ensure other fields are present or default
            type: data.type as "promotion" | "event" | "survey",
            name: data.name || "Entidad sin nombre",
            isActive: data.isActive === undefined ? true : data.isActive,
            generatedCodes: Array.isArray(data.generatedCodes) ? data.generatedCodes : [],
            ticketTypes: Array.isArray(data.ticketTypes) ? data.ticketTypes : [],
            eventBoxes: Array.isArray(data.eventBoxes) ? data.eventBoxes : [],
            assignedPromoters: Array.isArray(data.assignedPromoters) ? data.assignedPromoters : [],
        } as BusinessManagedEntity);
      });
      console.log("AdminDashboard: Total businessEntities processed for details:", allEntities.length);


      allEntities.forEach(entity => {
        if (entity.type === 'promotion' && isEntityCurrentlyActivatable(entity)) {
          activePromotionsCount++;
        }
        if (entity.generatedCodes && Array.isArray(entity.generatedCodes)) {
          qrCodesGeneratedCount += entity.generatedCodes.length;
        }
      });
      
      console.log("AdminDashboard: Calculated activePromotionsCount:", activePromotionsCount);
      console.log("AdminDashboard: Calculated qrCodesGeneratedCount (Códigos Creados):", qrCodesGeneratedCount);

      const newStats: AdminDashboardStats = {
        totalBusinesses: businessesSnap.size,
        totalPlatformUsers: platformUsersSnap.size,
        totalSocioVipMembers: socioVipMembersSnap.size,
        totalQrClients: qrClientsSnap.size,
        totalPromotionsActive: activePromotionsCount,
        totalQrCodesGenerated: qrCodesGeneratedCount, // This now represents "Códigos Creados"
      };
      setStats(newStats);
      console.log("AdminDashboard: Stats state updated with:", newStats);

    } catch (error: any) {
      console.error("AdminDashboard: Error fetching admin dashboard stats:", error.code, error.message, error);
      toast({
        title: "Error al Cargar Estadísticas",
        description: `No se pudieron obtener las estadísticas. Error: ${error.message}. Revisa la consola y tus reglas de Firestore.`,
        variant: "destructive",
        duration: 10000,
      });
      setStats({ // Reset stats on error
        totalBusinesses: 0,
        totalPlatformUsers: 0,
        totalSocioVipMembers: 0,
        totalPromotionsActive: 0,
        totalQrCodesGenerated: 0,
        totalQrClients: 0,
      });
    } finally {
      setIsLoading(false);
      console.log("AdminDashboard: fetchAdminStats finished, isLoading set to false.");
    }
  }, [toast]);

  useEffect(() => {
    fetchAdminStats();
  }, [fetchAdminStats]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando estadísticas del dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Dashboard de Administración</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        <StatCard title="Negocios Registrados" value={stats.totalBusinesses} icon={Building} />
        <StatCard title="Usuarios de Plataforma" value={stats.totalPlatformUsers} icon={Users} />
        <StatCard title="Socios VIP Activos" value={stats.totalSocioVipMembers} icon={Star} /> 
        <StatCard title="Promociones Activas" value={stats.totalPromotionsActive} icon={Ticket} />
        <StatCard title="Códigos Creados (Total)" value={stats.totalQrCodesGenerated} icon={ScanLine} />
        <StatCard title="Clientes QR Registrados" value={stats.totalQrClients} icon={ListChecks} />
      </div>

      <Card className="shadow-lg col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-primary" />
            Actividad de Promociones (Últimos 6 Meses)
          </CardTitle>
          <CardDescription>Creación de promociones, códigos creados y códigos canjeados. (Datos de ejemplo para el gráfico)</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockMonthlyPromotionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: 'var(--radius)'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="promotionsCreated" fill="hsl(var(--chart-1))" name="Promos Creadas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="qrCodesGenerated" fill="hsl(var(--chart-2))" name="Códigos Creados" radius={[4, 4, 0, 0]} />
              <Bar dataKey="qrCodesUtilized" fill="hsl(var(--chart-3))" name="Códigos Canjeados" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Actividad Reciente del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[150px] flex flex-col items-center justify-center text-center">
           <Info className="h-12 w-12 text-primary/60 mb-3" />
           <p className="text-muted-foreground">
            La actividad reciente del sistema se mostrará aquí una vez que se integre el registro de auditoría.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
