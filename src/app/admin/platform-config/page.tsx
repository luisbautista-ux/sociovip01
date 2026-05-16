
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Cog, Building, Save, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import type { Business, PlatformSettings } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function PlatformConfigPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinesses, setSelectedBusinesses] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchConfigAndBusinesses = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all businesses
      const businessesSnap = await getDocs(collection(db, "businesses"));
      const fetchedBusinesses = businessesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Business));
      setBusinesses(fetchedBusinesses);

      // Fetch current configuration
      const configDocRef = doc(db, "platformSettings", "membershipConfig");
      const configSnap = await getDoc(configDocRef);
      if (configSnap.exists()) {
        const configData = configSnap.data() as PlatformSettings;
        setSelectedBusinesses(new Set(configData.defaultBusinessesForFreeUsers || []));
      }
    } catch (error: any) {
      console.error("Error fetching configuration:", error);
      toast({
        title: "Error al Cargar",
        description: `No se pudo cargar la configuración. ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfigAndBusinesses();
  }, [fetchConfigAndBusinesses]);

  const handleToggleBusiness = (businessId: string) => {
    setSelectedBusinesses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(businessId)) {
        newSet.delete(businessId);
      } else {
        newSet.add(businessId);
      }
      return newSet;
    });
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const configDocRef = doc(db, "platformSettings", "membershipConfig");
      const dataToSave: PlatformSettings = {
        defaultBusinessesForFreeUsers: Array.from(selectedBusinesses)
      };
      await setDoc(configDocRef, dataToSave, { merge: true });
      toast({
        title: "Configuración Guardada",
        description: "Se han actualizado los negocios para los usuarios gratuitos."
      });
    } catch (error: any) {
      console.error("Error saving configuration:", error);
      toast({
        title: "Error al Guardar",
        description: `No se pudo guardar la configuración. ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center gap-3 mb-6">
        <Cog className="h-8 w-8 text-primary" />
        Configuración de la Plataforma
      </h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Red Gratuita SocioVIP</CardTitle>
          <CardDescription>
            Selecciona los negocios que estarán disponibles para todos los usuarios con la membresía "SocioVIP Gratis".
            Estos cambios se aplicarán de inmediato para todos los usuarios gratuitos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>¿Cómo funciona?</AlertTitle>
            <AlertDescription>
              Los usuarios gratuitos podrán usar su QR Fijo en cualquiera de los negocios que marques a continuación.
              Verán esta lista en su panel de cliente.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Lista de Negocios Disponibles</h3>
            <div className="max-h-96 overflow-y-auto space-y-3 rounded-md border p-4">
              {businesses.length > 0 ? businesses.map(biz => (
                <div key={biz.id} className="flex items-center space-x-3 hover:bg-muted/50 p-2 rounded-md transition-colors">
                  <Checkbox
                    id={`biz-${biz.id}`}
                    checked={selectedBusinesses.has(biz.id)}
                    onCheckedChange={() => handleToggleBusiness(biz.id)}
                    disabled={isSaving}
                  />
                  <Label htmlFor={`biz-${biz.id}`} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    {biz.name}
                  </Label>
                </div>
              )) : (
                <p className="text-center text-muted-foreground">No hay negocios registrados para configurar.</p>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Seleccionados: {selectedBusinesses.size} de {businesses.length} negocios.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSaveChanges} 
          disabled={isSaving || isLoading} 
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all"
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
}
