
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, BarChart, Bar } from 'recharts';
import type { PromotionAnalyticsData, RegisteredClient } from "@/lib/types";
import { BarChart3, Users } from "lucide-react";
import { format, subMonths, subDays } from "date-fns";
import { es } from "date-fns/locale";

// Mock Data
const mockPromotionAnalytics: PromotionAnalyticsData[] = Array.from({ length: 12 }, (_, i) => {
  const monthDate = subMonths(new Date(), 11 - i);
  return {
    month: format(monthDate, "MMM yy", { locale: es }),
    promotionsCreated: Math.floor(Math.random() * 30) + 10, // 10-39
    qrCodesGenerated: Math.floor(Math.random() * 500) + 200, // 200-699
    qrCodesUtilized: Math.floor(Math.random() * 300) + 100, // 100-399
  };
});

const mockClientRegistrations = Array.from({ length: 30 }, (_, i) => {
  const dayDate = subDays(new Date(), 29 - i);
  return {
    date: format(dayDate, "dd MMM", { locale: es }),
    newRegistrations: Math.floor(Math.random() * 20) + 5, // 5-24
  };
});

export default function AdminAnalyticsPage() {
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
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockPromotionAnalytics}>
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
              <Line type="monotone" dataKey="promotionsCreated" stroke="hsl(var(--chart-1))" name="Promociones Creadas" strokeWidth={2} />
              <Line type="monotone" dataKey="qrCodesGenerated" stroke="hsl(var(--chart-2))" name="QR Generados" strokeWidth={2} />
              <Line type="monotone" dataKey="qrCodesUtilized" stroke="hsl(var(--chart-3))" name="QR Utilizados" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
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
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockClientRegistrations}>
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
              <Bar dataKey="newRegistrations" fill="hsl(var(--chart-4))" name="Nuevos Clientes" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Consider adding more charts:
          - Top performing promotions
          - Business activity overview
          - User engagement metrics
       */}
    </div>
  );
}
