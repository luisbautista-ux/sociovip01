
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
import { Input } from "@/components/ui/input";

export default function PlatformConfigPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinesses, setSelectedBusinesses] = useState<Set<string>>(new Set());
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
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
        setContactPhone(configData.contactPhone || "");
        setContactEmail(configData.contactEmail || "");
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
        defaultBusinessesForFreeUsers: Array.from(selectedBusinesses),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim()
      };
      await setDoc(configDocRef, dataToSave, { merge: true });
      toast({
        title: "Configuración Guardada",
        description: "Se han actualizado los negocios y la información de contacto correctamente."
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

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Contacto de la Página Principal
          </CardTitle>
          <CardDescription>
            Configura el número de teléfono y el correo electrónico de contacto que se muestran en el encabezado y botón de WhatsApp de la página principal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="contactPhone" className="text-sm font-semibold">Teléfono de Contacto</Label>
              <Input
                id="contactPhone"
                type="text"
                placeholder="+51 942 401 695"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                disabled={isSaving}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Se usará también para el botón flotante de WhatsApp (se extraerán los dígitos automáticamente).
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contactEmail" className="text-sm font-semibold">Correo de Contacto</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="hola@sociovip.pe"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                disabled={isSaving}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Correo oficial que se muestra en el encabezado principal de SocioVIP.
              </p>
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
