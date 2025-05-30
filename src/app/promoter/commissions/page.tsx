
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Download, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react"; // Required for filter states if they were active

export default function PromoterCommissionsPage() {
  const { toast } = useToast();
  
  // States for filters - kept for future use, but UI is simplified
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [selectedBusiness, setSelectedBusiness] = useState<string>("all");
  const [selectedEntity, setSelectedEntity] = useState<string>("all");

  const handleExport = () => {
    toast({
      title: "Función No Implementada",
      description: "La exportación de comisiones estará disponible próximamente.",
      variant: "default" // Changed from destructive to default
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <DollarSign className="h-8 w-8 mr-2" /> Mis Comisiones
      </h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Resumen de Comisiones</CardTitle>
          <CardDescription>Aquí podrás ver el detalle de tus comisiones ganadas. Esta sección está en desarrollo.</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px] flex flex-col items-center justify-center text-center p-6">
            <Info className="h-16 w-16 text-primary/70 mb-4" />
            <p className="text-xl font-semibold text-foreground">
                Funcionalidad Próximamente
            </p>
            <p className="text-muted-foreground mt-2 max-w-md">
                Estamos trabajando para traerte un detalle completo de tus comisiones. 
                Pronto podrás filtrar por fecha, negocio, promoción/evento y ver tus pagos.
            </p>
        </CardContent>
        <CardFooter className="flex justify-end pt-4 border-t">
             <Button variant="outline" onClick={handleExport} disabled>
                <Download className="mr-2 h-4 w-4" /> Exportar (Próximamente)
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

    