
"use client"; 

import { StatCard } from "@/components/admin/StatCard";
import { Building, Users, ScanLine, ListChecks, BarChart3, Ticket, Star, Loader2 } from "lucide-react";
import type { AdminDashboardStats, PromotionAnalyticsData, BusinessManagedEntity } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, CartesianGrid } from 'recharts';
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { isEntityCurrentlyActivatable } from "@/lib/utils"; // Import the utility

// Mock Data for chart (will remain mock for now)
const mockMonthlyPromotionData: PromotionAnalyticsData[] = [
  { month: "Ene 25", promotionsCreated: 20, qrCodesGenerated: 800, qrCodesUtilized: 450 },
  { month: "Feb 25", promotionsCreated: 25, qrCodesGenerated: 950, qrCodesUtilized: 550 },
  { month: "Mar 25", promotionsCreated: 30, qrCodesGenerated: 1200, qrCodesUtilized: 700 },
  { month: "Abr 25", promotionsCreated: 22, qrCodesGenerated: 1100, qrCodesUtilized: 650 },
  { month: "May 25", promotionsCreated: 35, qrCodesGenerated: 1500, qrCodesUtilized: 800 },
  { month: "Jun 25", promotionsCreated: 28, qrCodesGenerated: 1320, qrCodesUtilized: 720 },
];


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
      let qrCodesGeneratedCount = 0;
      const allEntities: BusinessManagedEntity[] = [];

      businessEntitiesSnap.forEach((doc) => {
        allEntities.push({ id: doc.id, ...doc.data() } as BusinessManagedEntity);
      });
      console.log("AdminDashboard: Total businessEntities processed for details:", allEntities.length);


      allEntities.forEach(entity => {
        // console.log(`AdminDashboard: Checking entity ${entity.id} - Type: ${entity.type}, Active: ${entity.isActive}, Start: ${entity.startDate}, End: ${entity.endDate}`);
        if (entity.type === 'promotion' && isEntityCurrentlyActivatable(entity)) {
          activePromotionsCount++;
        }
        if (entity.generatedCodes && Array.isArray(entity.generatedCodes)) {
          qrCodesGeneratedCount += entity.generatedCodes.length;
        }
      });
      
      console.log("AdminDashboard: Calculated activePromotionsCount:", activePromotionsCount);
      console.log("AdminDashboard: Calculated qrCodesGeneratedCount:", qrCodesGeneratedCount);

      const newStats = {
        totalBusinesses: businessesSnap.size,
        totalPlatformUsers: platformUsersSnap.size,
        totalSocioVipMembers: socioVipMembersSnap.size,
        totalQrClients: qrClientsSnap.size,
        totalPromotionsActive: activePromotionsCount,
        totalQrCodesGenerated: qrCodesGeneratedCount,
      };
      setStats(newStats);
      console.log("AdminDashboard: Stats state updated with:", newStats);

    } catch (error: any) {
      console.error("AdminDashboard: Error fetching admin dashboard stats:", error.message, error.code, error.stack);
      toast({
        title: "Error al Cargar Estadísticas",
        description: `No se pudieron obtener las estadísticas. Error: ${error.message}. Revisa la consola para más detalles y tus reglas de Firestore.`,
        variant: "destructive",
        duration: 10000,
      });
      setStats({
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
      <div className="flex min-h-screen items-center justify-center bg-background">
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
        <StatCard title="QR Generados (Total)" value={stats.totalQrCodesGenerated} icon={ScanLine} />
        <StatCard title="Clientes QR Registrados" value={stats.totalQrClients} icon={ListChecks} />
      </div>

      <Card className="shadow-lg col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-primary" />
            Actividad de Promociones (Últimos 6 Meses)
          </CardTitle>
          <CardDescription>Creación, generación y utilización de QR. (Datos de ejemplo para el gráfico)</CardDescription>
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
              <Bar dataKey="qrCodesGenerated" fill="hsl(var(--chart-2))" name="QR Generados" radius={[4, 4, 0, 0]} />
              <Bar dataKey="qrCodesUtilized" fill="hsl(var(--chart-3))" name="QR Utilizados" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
