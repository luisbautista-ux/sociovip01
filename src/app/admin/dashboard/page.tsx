
"use client";

import { StatCard } from "@/components/admin/StatCard";
import { Building, Users, Star, ScanLine, BarChart3, Info, Loader2, AlertTriangle, Briefcase, UserPlus, Sparkles, UserCheck, History, LogIn } from "lucide-react";
import type { AdminDashboardStats, BusinessManagedEntity, GeneratedCode, Business, PlatformUser, SocioVipMember, QrClient } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, CartesianGrid } from 'recharts';
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, startOfMonth, formatDistanceToNow } from 'date-fns';
import { es } from "date-fns/locale";
import { db } from "@/lib/firebase";
import { collection, getDocs, Timestamp, query, orderBy, limit } from "firebase/firestore";
import { anyToDate } from "@/lib/utils";

interface MonthlyStat {
  month: string;
  promotionsCreated: number;
  qrCodesGenerated: number;
  qrCodesUtilized: number; 
}

type ActivityType = 'new_business' | 'user_login' | 'new_socio_vip' | 'new_qr_client';

interface ActivityItem {
  id: string;
  type: ActivityType;
  timestamp: Date;
  description: string;
  icon: React.ElementType;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalBusinesses: 0,
    totalPlatformUsers: 0,
    totalSocioVipMembers: 0,
    totalQrCodesGenerated: 0,
  });
  const [chartData, setChartData] = useState<MonthlyStat[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
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
      
      // 3. Fetch recent activities
      const businessesQuery = query(collection(db, "businesses"), orderBy("joinDate", "desc"), limit(5));
      const usersQuery = query(collection(db, "platformUsers"), orderBy("lastLogin", "desc"), limit(5));
      const sociosQuery = query(collection(db, "socioVipMembers"), orderBy("joinDate", "desc"), limit(5));
      const clientsQuery = query(collection(db, "qrClients"), orderBy("registrationDate", "desc"), limit(5));
      
      const [businessesSnap, usersSnap, sociosSnap, clientsSnap] = await Promise.all([
          getDocs(businessesQuery),
          getDocs(usersQuery),
          getDocs(sociosQuery),
          getDocs(clientsQuery)
      ]);

      const activities: ActivityItem[] = [];

      businessesSnap.forEach(doc => {
          const data = doc.data() as Business;
          activities.push({
              id: doc.id, type: 'new_business', timestamp: anyToDate(data.joinDate)!,
              description: `Nuevo negocio registrado: ${data.name}`, icon: Briefcase,
          });
      });
      usersSnap.forEach(doc => {
          const data = doc.data() as PlatformUser;
          // Solo añadir si hay un lastLogin válido
          if (data.lastLogin) {
            activities.push({
                id: doc.id, type: 'user_login', timestamp: anyToDate(data.lastLogin)!,
                description: `Último acceso al sistema: ${data.name} (${(data.roles || []).join(', ')})`, icon: LogIn,
            });
          }
      });
      sociosSnap.forEach(doc => {
          const data = doc.data() as SocioVipMember;
          activities.push({
              id: doc.id, type: 'new_socio_vip', timestamp: anyToDate(data.joinDate)!,
              description: `Nuevo Socio VIP: ${data.name} ${data.surname}`, icon: Sparkles,
          });
      });
      clientsSnap.forEach(doc => {
          const data = doc.data() as QrClient;
           activities.push({
              id: doc.id, type: 'new_qr_client', timestamp: anyToDate(data.registrationDate)!,
              description: `Nuevo cliente QR: ${data.name} ${data.surname}`, icon: UserCheck,
          });
      });
      
      const sortedActivities = activities
          .filter(a => a.timestamp)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 5); // Take the most recent 5 across all types
          
      setRecentActivities(sortedActivities);


    } catch (error: any) {
      console.error("AdminDashboard: Error fetching data:", error);
      setConfigError(`No se pudieron obtener los datos desde el servidor. ${error.message}`);
      setStats({ totalBusinesses: 0, totalPlatformUsers: 0, totalSocioVipMembers: 0, totalQrCodesGenerated: 0 });
      setChartData([]);
      setRecentActivities([]);
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
          <CardTitle className="flex items-center">
            <History className="h-6 w-6 mr-2 text-primary" />
            Actividad Reciente del Sistema
          </CardTitle>
          <CardDescription>Últimos movimientos en la plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map(activity => (
                <div key={activity.id} className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <activity.icon className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-h-[150px] flex flex-col items-center justify-center text-center">
              <Info className="h-12 w-12 text-primary/60 mb-3" />
              <p className="text-muted-foreground">No hay actividad reciente para mostrar.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
