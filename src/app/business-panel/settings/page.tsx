
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function BusinessSettingsPage() {
  // Mock business details for form
  const businessDetails = {
    name: "Mi Negocio Ejemplo",
    contactEmail: "contacto@minegocio.com",
    address: "Av. Siempre Viva 123",
    phone: "+51 1 2345678"
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <Settings className="h-8 w-8 mr-2" /> Configuración del Negocio
      </h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Información del Negocio</CardTitle>
          <CardDescription>Actualiza los datos principales de tu negocio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="businessName">Nombre del Negocio</Label>
            <Input id="businessName" defaultValue={businessDetails.name} />
          </div>
          <div>
            <Label htmlFor="businessEmail">Email de Contacto</Label>
            <Input id="businessEmail" type="email" defaultValue={businessDetails.contactEmail} />
          </div>
           <div>
            <Label htmlFor="businessAddress">Dirección</Label>
            <Input id="businessAddress" defaultValue={businessDetails.address} />
          </div>
           <div>
            <Label htmlFor="businessPhone">Teléfono</Label>
            <Input id="businessPhone" type="tel" defaultValue={businessDetails.phone} />
          </div>
          <Button className="bg-primary hover:bg-primary/90">Guardar Cambios</Button>
        </CardContent>
      </Card>

       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Personalización de QR</CardTitle>
          <CardDescription>Configura la apariencia de tus códigos QR (Próximamente).</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Opciones para añadir logo, cambiar colores, etc.</p>
        </CardContent>
      </Card>
    </div>
  );
}
