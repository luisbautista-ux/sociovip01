
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function BusinessAnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <BarChart3 className="h-8 w-8 mr-2" /> Analíticas del Negocio
      </h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Rendimiento General</CardTitle>
          <CardDescription>Visión general del desempeño de tus actividades.</CardDescription>
        </CardHeader>
        <CardContent className="h-60 flex items-center justify-center">
          <p className="text-muted-foreground">Próximamente: Gráficos y datos sobre tus promociones, eventos y encuestas.</p>
        </CardContent>
      </Card>
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Analíticas por Promoción/Evento</CardTitle>
          <CardDescription>Selecciona una actividad para ver su detalle.</CardDescription>
        </CardHeader>
        <CardContent className="h-40 flex items-center justify-center">
          {/* Placeholder for a selector and chart display */}
          <p className="text-muted-foreground">Selector de actividad y gráfico detallado aquí.</p>
        </CardContent>
      </Card>
    </div>
  );
}
