
"use client";

import { StatCard } from "@/components/admin/StatCard";
import { Building, Users, Star, ScanLine, BarChart3, Info, Loader2, AlertTriangle } from "lucide-react";
import type { AdminDashboardStats } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, CartesianGrid } from 'recharts';
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths } from 'date-fns';
import { es } from "date-fns/locale";

// Mock Data for chart (will remain mock for now)
const mockMonthlyPromotionData = Array.from({ length: 6 }, (_, i) => {
  const monthDate = subMonths(new Date(), 5 - i);
  return {
    month: format(monthDate, "MMM yy", { locale: es }),
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
    totalQrCodesGenerated: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAdminStats = useCallback(async () => {
    setIsLoading(true);
    setConfigError(null);
    try {
      // Llama a la nueva API Route para obtener las estadísticas
      const response = await fetch('/api/admin-stats');
      const data = await response.json();

      if (!response.ok) {
        // En lugar de lanzar un error que rompe la página, lo guardamos en el estado.
        setConfigError(data.error || 'Error en el servidor al obtener estadísticas.');
        // Resetear stats a 0 en caso de error
        setStats({
          totalBusinesses: 0,
          totalPlatformUsers: 0,
          totalSocioVipMembers: 0,
          totalQrCodesGenerated: 0,
        });
      } else {
        setStats(data);
      }
      
    } catch (error: any) {
      console.error("AdminDashboard: Error calling API route:", error);
      setConfigError(`No se pudieron obtener las estadísticas desde el servidor. ${error.message}`);
      setStats({
        totalBusinesses: 0,
        totalPlatformUsers: 0,
        totalSocioVipMembers: 0,
        totalQrCodesGenerated: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

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
