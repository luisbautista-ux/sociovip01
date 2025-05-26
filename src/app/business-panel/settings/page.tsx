
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Palette, Image as ImageIcon, Type, QrCode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function BusinessSettingsPage() {
  // Mock business details for form
  const businessDetails = {
    name: "Mi Negocio Ejemplo",
    contactEmail: "contacto@minegocio.com",
    address: "Av. Siempre Viva 123",
    phone: "+51 1 2345678",
    logoUrl: "https://placehold.co/150x50.png?text=Mi+Logo",
    coverImageUrl: "https://placehold.co/800x300.png?text=Portada",
    slogan: "La mejor experiencia, siempre.",
    primaryColor: "#A050BE", // Default to SocioVIP primary
    secondaryColor: "#77B7A8", // Default to SocioVIP accent
  };

  const handleSaveChanges = () => {
    // Mock save action
    console.log("Cambios guardados (simulado)");
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
          <Button onClick={handleSaveChanges} className="bg-primary hover:bg-primary/90">Guardar Cambios de Información</Button>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><Palette className="h-6 w-6 mr-2 text-primary"/> Branding y Personalización</CardTitle>
          <CardDescription>Define la identidad visual de tu negocio en la plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="logoUrl" className="flex items-center"><ImageIcon className="h-4 w-4 mr-1 text-muted-foreground"/> URL del Logo</Label>
              <Input id="logoUrl" placeholder="https://ejemplo.com/logo.png" defaultValue={businessDetails.logoUrl} />
              <p className="text-xs text-muted-foreground mt-1">Preferiblemente formato PNG con fondo transparente.</p>
            </div>
            <div>
              <Label htmlFor="coverImageUrl" className="flex items-center"><ImageIcon className="h-4 w-4 mr-1 text-muted-foreground"/> URL Imagen de Portada</Label>
              <Input id="coverImageUrl" placeholder="https://ejemplo.com/portada.jpg" defaultValue={businessDetails.coverImageUrl} />
              <p className="text-xs text-muted-foreground mt-1">Imagen que se mostrará en perfiles o listados.</p>
            </div>
          </div>
          <div>
            <Label htmlFor="slogan" className="flex items-center"><Type className="h-4 w-4 mr-1 text-muted-foreground"/> Slogan del Negocio</Label>
            <Input id="slogan" placeholder="Tu frase pegajosa aquí" defaultValue={businessDetails.slogan} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="primaryColor">Color Primario</Label>
              <Input id="primaryColor" type="color" defaultValue={businessDetails.primaryColor} className="h-10 p-1"/>
            </div>
            <div>
              <Label htmlFor="secondaryColor">Color Secundario</Label>
              <Input id="secondaryColor" type="color" defaultValue={businessDetails.secondaryColor} className="h-10 p-1"/>
            </div>
          </div>
          <Button onClick={handleSaveChanges} className="bg-primary hover:bg-primary/90">Guardar Cambios de Branding</Button>
        </CardContent>
      </Card>

       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><QrCode className="h-6 w-6 mr-2 text-primary"/> Personalización de QR (Próximamente)</CardTitle>
          <CardDescription>Define cómo se verán los códigos QR generados para tu negocio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground font-semibold">En futuras versiones, podrás personalizar:</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-4">
            <li>Añadir tu logo al centro del código QR (subiendo una imagen pequeña).</li>
            <li>Elegir el color principal de los puntos del QR.</li>
            <li>Seleccionar el color de fondo del QR (asegurando contraste).</li>
            <li>Cambiar la forma de los puntos (ej: cuadrados, redondos, fluidos).</li>
            <li>Modificar el estilo de los "ojos" (las formas cuadradas en las esquinas).</li>
          </ul>
          <p className="text-sm text-primary font-medium pt-2">¡Esta funcionalidad está en desarrollo para ayudarte a reforzar tu marca!</p>
        </CardContent>
      </Card>
    </div>
  );
}
