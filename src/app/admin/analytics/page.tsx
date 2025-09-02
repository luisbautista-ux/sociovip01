
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, BarChart, Bar } from 'recharts';
import type { PromotionAnalyticsData, RegisteredClient, BusinessManagedEntity, QrClient } from "@/lib/types";
import { BarChart3, Users, Loader2, Info } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { anyToDate } from "@/lib/utils";

export default function AdminAnalyticsPage() {
  const [promotionData, setPromotionData] = useState<PromotionAnalyticsData[]>([]);
  const [clientData, setClientData] = useState<RegisteredClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch data for the last 12 months for promotions
      const twelveMonthsAgo = startOfMonth(subMonths(new Date(), 11));
      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("createdAt", ">=", Timestamp.fromDate(twelveMonthsAgo))
      );
      const entitiesSnap = await getDocs(entitiesQuery);
      const allEntities = entitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessManagedEntity));

      const monthlyStats: { [key: string]: Omit<PromotionAnalyticsData, 'month'> } = {};
      for (let i = 0; i < 12; i++) {
        const monthDate = startOfMonth(subMonths(new Date(), 11 - i));
        const monthKey = format(monthDate, "yyyy-MM");
        monthlyStats[monthKey] = { promotionsCreated: 0, qrCodesGenerated: 0, qrCodesUtilized: 0 };
      }

      allEntities.forEach(entity => {
        const createdAt = anyToDate(entity.createdAt);
        if (!createdAt || createdAt < twelveMonthsAgo) return;

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
      
      const finalPromotionData = Object.keys(monthlyStats).map(key => ({
        month: format(new Date(key + '-02'), "MMM yy", { locale: es }),
        ...monthlyStats[key]
      })).sort((a,b) => new Date(a.month).getTime() - new Date(b.month).getTime());
      setPromotionData(finalPromotionData);

      // Fetch data for the last 30 days for new clients
      const thirtyDaysAgo = startOfDay(subDays(new Date(), 29));
      const clientsQuery = query(
        collection(db, "qrClients"),
        where("registrationDate", ">=", Timestamp.fromDate(thirtyDaysAgo))
      );
      const clientsSnap = await getDocs(clientsQuery);
      const allClients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QrClient));

      const dailyStats: { [key: string]: number } = {};
      for (let i = 0; i < 30; i++) {
        const dayDate = startOfDay(subDays(new Date(), 29 - i));
        const dayKey = format(dayDate, "yyyy-MM-dd");
        dailyStats[dayKey] = 0;
      }
      
      allClients.forEach(client => {
        const regDate = anyToDate(client.registrationDate);
        if(regDate) {
            const dayKey = format(startOfDay(regDate), "yyyy-MM-dd");
            if (dailyStats.hasOwnProperty(dayKey)) {
                dailyStats[dayKey]++;
            }
        }
      });
      
      const finalClientData = Object.keys(dailyStats).map(key => ({
        date: format(new Date(key), "dd MMM", { locale: es }),
        newRegistrations: dailyStats[key],
      }));
      setClientData(finalClientData);

    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando analíticas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gradient flex items-center">
        <BarChart3 className="h-8 w-8 mr-2" /> Analíticas Generales
      </h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Rendimiento de Promociones (Últimos 12 Meses)</CardTitle>
          <CardDescription>Tendencias en creación, generación y utilización de códigos QR.</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] p-2">
          {promotionData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <Info className="h-5 w-5 mr-2" /> No hay suficientes datos para mostrar el gráfico.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={promotionData}>
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
                <Line type="monotone" dataKey="promotionsCreated" stroke="hsl(var(--accent))" name="Promociones Creadas" strokeWidth={2} />
                <Line type="monotone" dataKey="qrCodesGenerated" stroke="hsl(var(--primary))" name="QR Generados" strokeWidth={2} />
                <Line type="monotone" dataKey="qrCodesUtilized" stroke="hsl(var(--secondary-foreground))" name="QR Utilizados" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-6 w-6 mr-2 text-primary" />
             Nuevos Clientes Registrados (Últimos 30 Días)
          </CardTitle>
          <CardDescription>Número de nuevos clientes que generaron su primer QR diariamente.</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] p-2">
          {clientData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Info className="h-5 w-5 mr-2" /> No hay suficientes datos para mostrar el gráfico.
              </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
                <Bar dataKey="newRegistrations" fill="hsl(var(--primary))" name="Nuevos Clientes" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
