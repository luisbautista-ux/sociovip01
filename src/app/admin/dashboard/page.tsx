
"use client";

import { StatCard } from "@/components/admin/StatCard";
import { Building, Users, Star, ScanLine, BarChart3, Info, Loader2, AlertTriangle } from "lucide-react";
import type { AdminDashboardStats, BusinessManagedEntity, GeneratedCode } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, CartesianGrid } from 'recharts';
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, startOfMonth, endOfMonth, getMonth, getYear } from 'date-fns';
import { es } from "date-fns/locale";
import { db } from "@/lib/firebase";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { anyToDate } from "@/lib/utils";

interface MonthlyStat {
  month: string;
  promotionsCreated: number;
  qrCodesGenerated: number;
  qrCodesUtilized: number; // Clientes que generaron QR
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalBusinesses: 0,
    totalPlatformUsers: 0,
    totalSocioVipMembers: 0,
    totalQrCodesGenerated: 0,
  });
  const [chartData, setChartData] = useState<MonthlyStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAdminData = useCallback(async () => {
    setIsLoading(true);
    setConfigError(null);
    try {
      // 1. Fetch aggregate stats from the API route
      const statsResponse = await fetch('/api/admin-stats');
      const statsData = await statsResponse.json();

      if (!statsResponse.ok) {
        setConfigError(statsData.error || 'Error en el servidor al obtener estadísticas.');
        setStats({ totalBusinesses: 0, totalPlatformUsers: 0, totalSocioVipMembers: 0, totalQrCodesGenerated: 0 });
      } else {
        setStats(statsData);
      }

      // 2. Fetch all entities for chart calculation
      const entitiesSnap = await getDocs(collection(db, "businessEntities"));
      const allEntities = entitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessManagedEntity));
      
      const monthlyStats: { [key: string]: Omit<MonthlyStat, 'month'> } = {};
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));

      // Initialize last 6 months
      for (let i = 0; i < 6; i++) {
        const monthDate = startOfMonth(subMonths(new Date(), 5 - i));
        const monthKey = format(monthDate, "yyyy-MM");
        monthlyStats[monthKey] = { promotionsCreated: 0, qrCodesGenerated: 0, qrCodesUtilized: 0 };
      }

      allEntities.forEach(entity => {
        const createdAt = anyToDate(entity.createdAt);
        if (!createdAt || createdAt < sixMonthsAgo) return;

        const monthKey = format(createdAt, "yyyy-MM");

        if (monthlyStats[monthKey]) {
          if (entity.type === 'promotion' || entity.type === 'event') {
            monthlyStats[monthKey].promotionsCreated += 1;
          }
          if (entity.generatedCodes && Array.isArray(entity.generatedCodes)) {
            monthlyStats[monthKey].qrCodesGenerated += entity.generatedCodes.length;
            monthlyStats[monthKey].qrCodesUtilized += entity.generatedCodes.filter(c => c.status === 'redeemed' || c.status === 'used').length;
          }
        }
      });
      
      const finalChartData = Object.keys(monthlyStats).map(key => ({
        month: format(new Date(key + '-02'), "MMM yy", { locale: es }), // Use day 02 to avoid timezone issues
        ...monthlyStats[key]
      })).sort((a,b) => new Date(a.month).getTime() - new Date(b.month).getTime());

      setChartData(finalChartData);

    } catch (error: any) {
      console.error("AdminDashboard: Error fetching data:", error);
      setConfigError(`No se pudieron obtener los datos desde el servidor. ${error.message}`);
      setStats({ totalBusinesses: 0, totalPlatformUsers: 0, totalSocioVipMembers: 0, totalQrCodesGenerated: 0 });
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

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
      <h1 className="text-3xl font-bold text-gradient">Dashboard de Administración</h1>
      
      {configError && (
        <Card className="shadow-lg border-destructive">
          <CardHeader className="flex flex-row items-center space-x-3 space-y-0">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <CardTitle className="text-destructive">Error de Configuración del Servidor</CardTitle>
              <CardDescription className="text-destructive/80">
                No se pueden cargar las estadísticas.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">Mensaje de Error:</p>
            <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md font-mono">{configError}</p>
            <p className="text-sm mt-3">
              <strong>Solución:</strong> Revisa que la variable de entorno `FIREBASE_SERVICE_ACCOUNT_JSON` en tu archivo `.env` contenga el JSON de credenciales de tu cuenta de servicio de Firebase completo y válido.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Negocios Registrados" value={stats.totalBusinesses} icon={Building} />
        <StatCard title="Usuarios de Plataforma" value={stats.totalPlatformUsers} icon={Users} />
        <StatCard title="Socios VIP Activos" value={stats.totalSocioVipMembers} icon={Star} /> 
        <StatCard title="Códigos Creados (Total)" value={stats.totalQrCodesGenerated} icon={ScanLine} />
      </div>

      <Card className="shadow-lg col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-primary" />
            Actividad de Promociones (Últimos 6 Meses)
          </CardTitle>
          <CardDescription>Creación de promociones, códigos creados y códigos canjeados por clientes.</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
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
              <Bar dataKey="promotionsCreated" fill="hsl(var(--secondary-foreground))" name="Promos Creadas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="qrCodesGenerated" fill="hsl(var(--primary))" name="Códigos Creados" radius={[4, 4, 0, 0]} />
              <Bar dataKey="qrCodesUtilized" fill="hsl(var(--accent))" name="Códigos Canjeados" radius={[4, 4, 0, 0]} />
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

