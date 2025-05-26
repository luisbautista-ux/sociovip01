
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, PlusCircle } from "lucide-react";

export default function BusinessSurveysPage() {
  // Placeholder for surveys data and logic
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <ClipboardList className="h-8 w-8 mr-2" /> Gestión de Encuestas
        </h1>
        <Button className="bg-primary hover:bg-primary/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Encuesta
        </Button>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Mis Encuestas</CardTitle>
          <CardDescription>Crea y administra encuestas para tus clientes.</CardDescription>
        </CardHeader>
        <CardContent className="h-60 flex items-center justify-center">
          <p className="text-muted-foreground">Próximamente: Aquí podrás ver y gestionar tus encuestas.</p>
        </CardContent>
      </Card>
    </div>
  );
}
