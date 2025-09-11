
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Palette, Image as ImageIconLucide, Type, QrCode, UploadCloud, Loader2, Link as LinkIcon } from "lucide-react"; 
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect, useCallback } from 'react'; 
import NextImage from "next/image"; 
import { useToast } from "@/hooks/use-toast"; 
import { useAuth } from "@/context/AuthContext"; 
import { db } from "@/lib/firebase"; 
import { doc, getDoc, updateDoc, type DocumentData } from "firebase/firestore";
import type { Business } from "@/lib/types";
import { sanitizeObjectForFirestore } from "@/lib/utils";

export default function BusinessSettingsPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const { toast } = useToast();

  const [isLoadingData, setIsLoadingData] = useState(true);

  // State for business info
  const [businessName, setBusinessName] = useState("");
  const [businessContactEmail, setBusinessContactEmail] = useState("");
  const [businessAddress, setBusinessAddress] = useState(""); 
  const [businessPublicPhone, setBusinessPublicPhone] = useState("");

  // State for branding info
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [slogan, setSlogan] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#B080D0"); 
  const [secondaryColor, setSecondaryColor] = useState("#8E5EA2");
  
  const [isSaving, setIsSaving] = useState(false);

  const fetchBusinessData = useCallback(async () => {
    if (userProfile?.businessId) {
      setIsLoadingData(true);
      try {
        const businessDocRef = doc(db, "businesses", userProfile.businessId);
        const businessSnap = await getDoc(businessDocRef);
        if (businessSnap.exists()) {
          const data = businessSnap.data() as Business;
          
          setBusinessName(data.name || "");
          setBusinessContactEmail(data.contactEmail || "");
          setBusinessAddress(data.publicAddress || data.address || ""); 
          setBusinessPublicPhone(data.publicPhone || "");

          setSlogan(data.slogan || "");
          setPrimaryColor(data.primaryColor || "#B080D0"); 
          setSecondaryColor(data.secondaryColor || "#8E5EA2");
          setLogoUrl(data.logoUrl || "");
          setCoverUrl(data.publicCoverImageUrl || "");
        } else {
          toast({ title: "Error", description: "No se encontraron los datos del negocio.", variant: "destructive" });
        }
      } catch (error) {
        console.error("Error fetching business data for settings:", error);
        toast({ title: "Error", description: "No se pudo cargar la configuración del negocio.", variant: "destructive" });
      } finally {
        setIsLoadingData(false);
      }
    } else if (!loadingAuth && !loadingProfile && !userProfile?.businessId) {
      setIsLoadingData(false);
      toast({ title: "Advertencia", description: "Tu perfil no está asociado a un negocio.", variant: "default" });
    }
  }, [userProfile, toast, loadingAuth, loadingProfile]);

  useEffect(() => {
    fetchBusinessData();
  }, [fetchBusinessData]);
  
  const handleSaveChanges = async () => {
    if (!userProfile?.businessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    const updateData: Partial<Business> = {
        name: businessName,
        contactEmail: businessContactEmail,
        publicAddress: businessAddress, 
        publicPhone: businessPublicPhone,
        slogan,
        primaryColor,
        secondaryColor,
        logoUrl,
        publicCoverImageUrl: coverUrl,
    };

    try {
        const businessDocRef = doc(db, "businesses", userProfile.businessId);
        await updateDoc(businessDocRef, sanitizeObjectForFirestore(updateData as DocumentData));
        toast({ title: "Configuración Guardada", description: "Los datos de tu negocio se han actualizado." });
        fetchBusinessData(); 
    } catch (error: any) {
        console.error("Error saving business settings:", error);
        const description = error?.message 
          ? `No se pudieron guardar los cambios. ${error.message}` 
          : "No se pudieron guardar los cambios. Ocurrió un error desconocido.";
        toast({ title: "Error al Guardar", description, variant: "destructive"});
    } finally {
        setIsSaving(false);
    }
  };
  
  if (isLoadingData || loadingAuth || loadingProfile) { 
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Cargando configuración del negocio...</p>
      </div>
    );
  }

  if (!userProfile?.businessId && !isLoadingData && !loadingAuth && !loadingProfile) { 
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Settings className="h-8 w-8 mr-2" /> Configuración del Negocio
        </h1>
        <Button onClick={handleSaveChanges} className="w-full sm:w-auto bg-primary hover:bg-primary/90" disabled={isSaving || isLoadingData}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Todos los Cambios
        </Button>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Información del Negocio</CardTitle>
          <CardDescription>Actualiza los datos principales de tu negocio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="businessName">Nombre del Negocio</Label>
            <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} disabled={isSaving || isLoadingData} />
          </div>
          <div>
            <Label htmlFor="businessEmail">Email de Contacto</Label>
            <Input id="businessEmail" type="email" value={businessContactEmail} onChange={(e) => setBusinessContactEmail(e.target.value)} disabled={isSaving || isLoadingData} />
          </div>
           <div>
            <Label htmlFor="businessAddress">Dirección Pública</Label>
            <Input id="businessAddress" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} disabled={isSaving || isLoadingData} />
          </div>
           <div>
            <Label htmlFor="businessPhone">Teléfono Público</Label>
            <Input id="businessPhone" type="tel" value={businessPublicPhone} onChange={(e) => setBusinessPublicPhone(e.target.value)} disabled={isSaving || isLoadingData}/>
          </div>
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
                <Label htmlFor="logoUrl" className="flex items-center"><ImageIconLucide className="h-4 w-4 mr-1 text-muted-foreground"/> URL del Logo del Negocio</Label>
                <div className="flex items-center gap-2">
                    <div className="w-16 h-16 flex-shrink-0">
                      {logoUrl ? (
                        <NextImage src={logoUrl} alt="Logo actual" width={64} height={64} className="rounded-md border p-1 object-contain" />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
                            <ImageIconLucide/>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 w-full">
                       <LinkIcon className="h-4 w-4 text-muted-foreground" />
                       <Input id="logoUrl" type="url" placeholder="https://ejemplo.com/logo.png" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} disabled={isSaving || isLoadingData}/>
                    </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coverUrl" className="flex items-center"><ImageIconLucide className="h-4 w-4 mr-1 text-muted-foreground"/> URL de Imagen de Portada</Label>
                 <div className="flex items-center gap-2">
                   <div className="w-24 h-14 flex-shrink-0">
                      {coverUrl ? (
                         <NextImage src={coverUrl} alt="Portada actual" width={100} height={56} className="rounded-md border p-1 object-cover" />
                      ) : (
                         <div className="w-24 h-14 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
                            <ImageIconLucide/>
                        </div>
                      )}
                    </div>
                     <div className="flex items-center gap-2 w-full">
                       <LinkIcon className="h-4 w-4 text-muted-foreground" />
                       <Input id="coverUrl" type="url" placeholder="https://ejemplo.com/portada.jpg" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} disabled={isSaving || isLoadingData}/>
                    </div>
                </div>
              </div>
            </div>
          <div className="space-y-2">
            <Label htmlFor="slogan" className="flex items-center"><Type className="h-4 w-4 mr-1 text-muted-foreground"/> Slogan del Negocio</Label>
            <Input id="slogan" placeholder="Tu frase pegajosa aquí" value={slogan} onChange={(e) => setSlogan(e.target.value)} disabled={isSaving || isLoadingData} />
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="primaryColor">Color Primario</Label>
                  <Input id="primaryColor" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 p-1 w-full" disabled={isSaving || isLoadingData}/>
                </div>
                <div>
                  <Label htmlFor="secondaryColor">Color Secundario</Label>
                  <Input id="secondaryColor" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-10 p-1 w-full" disabled={isSaving || isLoadingData}/>
                </div>
            </div>
          </div>
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

