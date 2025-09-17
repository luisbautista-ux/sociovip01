
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, PlusCircle } from "lucide-react";

export default function BusinessSurveysPage() {
  // Placeholder for surveys data and logic
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <ClipboardList className="h-8 w-8 mr-2" /> Mis Encuestas
        </h1>
        <div className="self-end sm:self-center">
            <Button variant="gradient">
              <PlusCircle className="mr-2 h-4 w-4" /> Crear Encuesta
            </Button>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Gestión de Encuestas</CardTitle>
          <CardDescription>Crea y administra encuestas para tus clientes.</CardDescription>
        </CardHeader>
        <CardContent className="h-60 flex items-center justify-center">
          <p className="text-muted-foreground">Próximamente: Aquí podrás ver y gestionar tus encuestas.</p>
        </CardContent>
      </Card>
    </div>
  );
}
