
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Palette, Image as ImageIconLucide, Type, QrCode, UploadCloud, Loader2 } from "lucide-react"; // Added UploadCloud, Loader2
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
// Textarea no se usa en la sección de branding de este archivo.
import React, { useState, useRef, ChangeEvent, useEffect } from 'react'; // Added React, useState, useRef, ChangeEvent
import Image from "next/image"; // For image previews
import { useToast } from "@/hooks/use-toast"; // For feedback
import { useAuth } from "@/context/AuthContext"; // To get businessId
import { db } from "@/lib/firebase"; // For Firestore
import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { Business } from "@/lib/types";

// Initial mock, will be replaced by fetched data
const initialBusinessDetails = {
  name: "Cargando...",
  contactEmail: "",
  address: "",
  phone: "",
  logoUrl: "",
  coverImageUrl: "",
  slogan: "",
  primaryColor: "#B080D0", 
  secondaryColor: "#8E5EA2",
};


export default function BusinessSettingsPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();

  // State for fetched business data
  const [businessData, setBusinessData] = useState<Business | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // State for branding form fields
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [slogan, setSlogan] = useState(initialBusinessDetails.slogan);
  const [primaryColor, setPrimaryColor] = useState(initialBusinessDetails.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(initialBusinessDetails.secondaryColor);
  
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Fetch business data on mount
  useEffect(() => {
    const fetchBusinessData = async () => {
      if (userProfile?.businessId) {
        setIsLoadingData(true);
        try {
          const businessDocRef = doc(db, "businesses", userProfile.businessId);
          const businessSnap = await getDoc(businessDocRef);
          if (businessSnap.exists()) {
            const data = businessSnap.data() as Business;
            setBusinessData(data);
            // Initialize form states with fetched data
            setSlogan(data.slogan || "");
            setPrimaryColor(data.primaryColor || initialBusinessDetails.primaryColor); // Use initial color if not set
            setSecondaryColor(data.secondaryColor || initialBusinessDetails.secondaryColor); // Use initial color if not set
            setLogoPreview(data.logoUrl || null);
            setCoverPreview(data.publicCoverImageUrl || null);

            // Also update the 'Info del Negocio' section's controlled inputs
            // Assuming you'll make those controlled too. For now, they are defaultValue.
            // Example: setBusinessName(data.name || "");
          } else {
            toast({ title: "Error", description: "No se encontraron los datos del negocio.", variant: "destructive" });
          }
        } catch (error) {
          console.error("Error fetching business data for settings:", error);
          toast({ title: "Error", description: "No se pudo cargar la configuración del negocio.", variant: "destructive" });
        } finally {
          setIsLoadingData(false);
        }
      } else if (userProfile === null) { // User profile is loaded but no businessId
        setIsLoadingData(false);
         toast({ title: "Advertencia", description: "Tu perfil no está asociado a un negocio.", variant: "default" });
      }
    };

    if (userProfile) {
      fetchBusinessData();
    } else if (userProfile === null) { // Explicitly handle case where userProfile is loaded and null (no user)
      setIsLoadingData(false);
    }
    // Only re-run if userProfile reference changes (e.g., on login/logout or initial load)
  }, [userProfile, toast]);


  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ title: "Archivo muy grande", description: "El logo no debe exceder 2MB.", variant: "destructive" });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
       if (file.size > 5 * 1024 * 1024) { // 5MB limit for cover
        toast({ title: "Archivo muy grande", description: "La imagen de portada no debe exceder 5MB.", variant: "destructive" });
        return;
      }
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChangesBranding = async () => {
    if (!userProfile?.businessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    setIsSavingBranding(true);
    
    // Simulate saving branding data
    console.log("Guardando cambios de branding (simulado):", {
      slogan,
      primaryColor,
      secondaryColor,
      logoFile: logoFile?.name,
      coverFile: coverFile?.name,
    });

    // TODO: Implement actual image upload to Firebase Storage
    // TODO: Get downloadURLs for logo and cover
    // TODO: Update Firestore document for the business with new URLs and other branding info

    // For now, just showing a toast
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

    toast({
      title: "Branding Guardado (Simulado)",
      description: "Los cambios de branding se han procesado (simulación).",
    });
    setIsSavingBranding(false);
  };
  
  const handleSaveChangesInfo = () => {
    setIsSavingInfo(true);
    console.log("Guardando cambios de información (simulado)");
    // Here you would collect data from the info form and save to Firestore
    // For example:
    // const businessName = (document.getElementById('businessName') as HTMLInputElement).value;
    // ... other fields
    setTimeout(() => {
        toast({ title: "Información Guardada (Simulado)", description: "Los datos del negocio se han procesado (simulación)." });
        setIsSavingInfo(false);
    }, 1500);
  };
  
  if (isLoadingData && userProfile) { // Only show main loader if userProfile exists and we are fetching
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Cargando configuración del negocio...</p>
      </div>
    );
  }

  if (!userProfile?.businessId && !isLoadingData) { // If loading is done and still no businessId
     return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Settings className="h-8 w-8 mr-2" /> Configuración del Negocio
        </h1>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-destructive">Error: Negocio No Asociado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Tu perfil de usuario no está actualmente asociado a ningún negocio.
              Por favor, contacta al administrador para que te asigne a uno.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }


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
            <Input id="businessName" defaultValue={businessData?.name || initialBusinessDetails.name} disabled={isSavingInfo || isLoadingData} />
          </div>
          <div>
            <Label htmlFor="businessEmail">Email de Contacto</Label>
            <Input id="businessEmail" type="email" defaultValue={businessData?.contactEmail || initialBusinessDetails.contactEmail} disabled={isSavingInfo || isLoadingData} />
          </div>
           <div>
            <Label htmlFor="businessAddress">Dirección</Label>
            <Input id="businessAddress" defaultValue={businessData?.address || initialBusinessDetails.address} disabled={isSavingInfo || isLoadingData} />
          </div>
           <div>
            <Label htmlFor="businessPhone">Teléfono</Label>
            <Input id="businessPhone" type="tel" defaultValue={businessData?.publicPhone || initialBusinessDetails.phone} disabled={isSavingInfo || isLoadingData}/>
          </div>
          <Button onClick={handleSaveChangesInfo} className="bg-primary hover:bg-primary/90" disabled={isSavingInfo || isLoadingData}>
            {isSavingInfo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios de Información
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><Palette className="h-6 w-6 mr-2 text-primary"/> Branding y Personalización</CardTitle>
          <CardDescription>Define la identidad visual de tu negocio en la plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-2">
              <Label htmlFor="logoUploadButton" className="flex items-center"><ImageIconLucide className="h-4 w-4 mr-1 text-muted-foreground"/> Logo del Negocio</Label>
              <input type="file" accept="image/png, image/jpeg" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" id="logoUploadInput"/>
              <Button id="logoUploadButton" variant="outline" onClick={() => logoInputRef.current?.click()} className="w-full" disabled={isSavingBranding || isLoadingData}>
                <UploadCloud className="mr-2 h-4 w-4"/> Seleccionar Logo (Max 2MB)
              </Button>
              {logoPreview && (
                <div className="mt-2 p-2 border rounded-md inline-block bg-muted">
                  <Image src={logoPreview} alt="Previsualización del Logo" width={150} height={50} className="object-contain max-h-[50px]" data-ai-hint="logo business"/>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Preferiblemente PNG con fondo transparente.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coverUploadButton" className="flex items-center"><ImageIconLucide className="h-4 w-4 mr-1 text-muted-foreground"/> Imagen de Portada</Label>
               <input type="file" accept="image/png, image/jpeg, image/webp" ref={coverInputRef} onChange={handleCoverImageUpload} className="hidden" id="coverUploadInput"/>
              <Button id="coverUploadButton" variant="outline" onClick={() => coverInputRef.current?.click()} className="w-full" disabled={isSavingBranding || isLoadingData}>
                <UploadCloud className="mr-2 h-4 w-4"/> Seleccionar Portada (Max 5MB)
              </Button>
              {coverPreview && (
                 <div className="mt-2 p-2 border rounded-md inline-block bg-muted">
                    <Image src={coverPreview} alt="Previsualización de Portada" width={250} height={100} className="object-cover max-h-[100px]" data-ai-hint="cover image store"/>
                 </div>
              )}
              <p className="text-xs text-muted-foreground">Imagen para la página pública de tu negocio.</p>
            </div>
          </div>
          <div>
            <Label htmlFor="slogan" className="flex items-center"><Type className="h-4 w-4 mr-1 text-muted-foreground"/> Slogan del Negocio</Label>
            <Input id="slogan" placeholder="Tu frase pegajosa aquí" value={slogan} onChange={(e) => setSlogan(e.target.value)} disabled={isSavingBranding || isLoadingData} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="primaryColor">Color Primario</Label>
              <Input id="primaryColor" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 p-1 w-full" disabled={isSavingBranding || isLoadingData}/>
            </div>
            <div>
              <Label htmlFor="secondaryColor">Color Secundario</Label>
              <Input id="secondaryColor" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-10 p-1 w-full" disabled={isSavingBranding || isLoadingData}/>
            </div>
          </div>
          <Button onClick={handleSaveChangesBranding} className="bg-primary hover:bg-primary/90" disabled={isSavingBranding || isLoadingData}>
            {isSavingBranding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios de Branding
          </Button>
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
