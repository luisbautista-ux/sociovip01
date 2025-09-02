"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, BarChart, Bar } from 'recharts';
import type { BusinessManagedEntity } from "@/lib/types";
import { BarChart3, Users, Loader2, Info, Ticket, Calendar } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { anyToDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/admin/StatCard";

interface MonthlyStat {
  month: string;
  entitiesCreated: number;
  qrCodesGenerated: number;
  qrCodesUtilized: number;
}

interface SelectedEntityStats {
    id: string;
    name: string;
    codesGenerated: number;
    codesUsed: number;
}

export default function BusinessAnalyticsPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [allEntities, setAllEntities] = useState<BusinessManagedEntity[]>([]);
  const [generalStats, setGeneralStats] = useState<MonthlyStat[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  const businessId = userProfile?.businessId;

  const fetchAnalyticsData = useCallback(async () => {
    if (!businessId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const entitiesQuery = query(collection(db, "businessEntities"), where("businessId", "==", businessId));
      const entitiesSnap = await getDocs(entitiesQuery);
      
      const fetchedEntities = entitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessManagedEntity));
      setAllEntities(fetchedEntities);

      // --- Process General Stats (last 6 months) ---
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
      const monthlyStats: { [key: string]: Omit<MonthlyStat, 'month'> } = {};

      for (let i = 0; i < 6; i++) {
        const monthDate = startOfMonth(subMonths(new Date(), 5 - i));
        const monthKey = format(monthDate, "yyyy-MM");
        monthlyStats[monthKey] = { entitiesCreated: 0, qrCodesGenerated: 0, qrCodesUtilized: 0 };
      }

      fetchedEntities.forEach(entity => {
        const createdAt = anyToDate(entity.createdAt);
        if (!createdAt || createdAt < sixMonthsAgo) return;

        const monthKey = format(createdAt, "yyyy-MM");
        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].entitiesCreated += 1;
          if (entity.generatedCodes && Array.isArray(entity.generatedCodes)) {
            monthlyStats[monthKey].qrCodesGenerated += entity.generatedCodes.length;
            monthlyStats[monthKey].qrCodesUtilized += entity.generatedCodes.filter(c => c.status === 'redeemed' || c.status === 'used').length;
          }
        }
      });
      
      const finalGeneralData = Object.keys(monthlyStats).map(key => ({
        month: format(new Date(key + '-02'), "MMM yy", { locale: es }),
        ...monthlyStats[key]
      })).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

      setGeneralStats(finalGeneralData);

    } catch (error: any) {
      console.error("Error fetching business analytics:", error);
      toast({ title: "Error", description: `No se pudieron cargar las analíticas: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, toast]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const selectedEntityStats = useMemo((): SelectedEntityStats | null => {
    if (!selectedEntityId) return null;
    const entity = allEntities.find(e => e.id === selectedEntityId);
    if (!entity) return null;

    const codesGenerated = entity.generatedCodes?.length || 0;
    const codesUsed = entity.generatedCodes?.filter(c => c.status === 'used').length || 0;
    
    return { id: entity.id, name: entity.name, codesGenerated, codesUsed };
  }, [selectedEntityId, allEntities]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando analíticas...</p>
      </div>
    );
  }
  
  if (!businessId) {
      return (
        <div className="flex flex-col items-center justify-center h-64 p-4 border border-dashed rounded-md">
            <CardTitle className="text-xl text-destructive">Configuración Incompleta</CardTitle>
            <CardDescription className="mt-2 text-center text-muted-foreground">
                Tu perfil de usuario no está asociado a un negocio válido. Contacta al superadministrador.
            </CardDescription>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gradient flex items-center">
        <BarChart3 className="h-8 w-8 mr-2" /> Analíticas del Negocio
      </h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Rendimiento General (Últimos 6 Meses)</CardTitle>
          <CardDescription>Tendencias en creación de campañas, y generación/uso de códigos QR.</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] p-2">
           {generalStats.length > 0 && generalStats.some(s => s.entitiesCreated > 0 || s.qrCodesGenerated > 0) ? (
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={generalStats}>
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
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="entitiesCreated" stroke="hsl(var(--secondary-foreground))" name="Campañas Creadas" strokeWidth={2} />
                <Line type="monotone" dataKey="qrCodesGenerated" stroke="hsl(var(--primary))" name="QR Generados" strokeWidth={2} />
                <Line type="monotone" dataKey="qrCodesUtilized" stroke="hsl(var(--accent))" name="QR Canjeados" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
           ) : (
             <div className="flex items-center justify-center h-full text-muted-foreground">
                <Info className="h-5 w-5 mr-2" /> No hay suficientes datos en los últimos 6 meses para mostrar el gráfico.
            </div>
           )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Analíticas por Promoción/Evento</CardTitle>
          <CardDescription>Selecciona una actividad para ver su detalle de rendimiento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Select onValueChange={setSelectedEntityId} disabled={allEntities.length === 0}>
                <SelectTrigger>
                    <SelectValue placeholder={allEntities.length === 0 ? "No hay promociones o eventos para analizar" : "Selecciona una promoción o evento"} />
                </SelectTrigger>
                <SelectContent>
                    {allEntities.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).map(entity => (
                        <SelectItem key={entity.id} value={entity.id}>
                          <span className="flex items-center">{entity.type === 'event' ? <Calendar className="h-4 w-4 mr-2"/> : <Ticket className="h-4 w-4 mr-2"/>}{entity.name}</span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {selectedEntityStats ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    <div className="md:col-span-2 h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={[selectedEntityStats]} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="name" hide />
                            <Tooltip
                               contentStyle={{ 
                                  backgroundColor: 'hsl(var(--background))', 
                                  borderColor: 'hsl(var(--border))',
                                  borderRadius: 'var(--radius)'
                              }}
                            />
                            <Legend />
                            <Bar dataKey="codesGenerated" fill="hsl(var(--primary))" name="Códigos Generados" radius={[0, 4, 4, 0]} barSize={35} />
                            <Bar dataKey="codesUsed" fill="hsl(var(--accent))" name="Códigos Usados (en puerta)" radius={[0, 4, 4, 0]} barSize={35} />
                         </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="md:col-span-1 space-y-4">
                      <StatCard 
                          title="Códigos Generados (Total)" 
                          value={selectedEntityStats.codesGenerated} 
                          icon={Ticket} 
                          description="Total de códigos únicos creados para esta campaña."
                       />
                       <StatCard 
                          title="Códigos Usados (Asistencia)" 
                          value={selectedEntityStats.codesUsed} 
                          icon={Users}
                          description="Códigos escaneados y validados en la puerta."
                        />
                       <StatCard 
                          title="Tasa de Canje" 
                          value={`${selectedEntityStats.codesGenerated > 0 ? ((selectedEntityStats.codesUsed / selectedEntityStats.codesGenerated) * 100).toFixed(1) : 0}%`} 
                          icon={BarChart3} 
                          description="% de códigos generados que fueron usados."
                        />
                    </div>
                </div>
            ) : (
                 <div className="flex items-center justify-center h-40 text-muted-foreground">
                    <p>Selecciona una campaña para ver sus estadísticas detalladas.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

