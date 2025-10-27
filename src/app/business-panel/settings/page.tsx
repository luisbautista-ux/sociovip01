

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Palette, Image as ImageIconLucide, Type, UploadCloud, Loader2, Link as LinkIcon, Smartphone, Upload } from "lucide-react"; 
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect, useCallback, useRef } from 'react'; 
import NextImage from "next/image"; 
import { useToast } from "@/hooks/use-toast"; 
import { useAuth } from "@/context/AuthContext"; 
import { db, storage } from "@/lib/firebase"; 
import { doc, getDoc, updateDoc, type DocumentData } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
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
  const [personalPhone, setPersonalPhone] = useState("");

  // State for branding info
  const [slogan, setSlogan] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#B080D0"); 
  const [secondaryColor, setSecondaryColor] = useState("#8E5EA2");
  
  // State for images
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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
          setPersonalPhone(data.personalPhone || "");

          setSlogan(data.slogan || "");
          setPrimaryColor(data.primaryColor || "#B080D0"); 
          setSecondaryColor(data.secondaryColor || "#8E5EA2");
          setLogoUrl(data.logoUrl || "");
          setCoverUrl(data.publicCoverImageUrl || "");
          setLogoPreview(data.logoUrl || null);
          setCoverPreview(data.publicCoverImageUrl || null);

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
  
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveChanges = async () => {
    if (!userProfile?.businessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    
    const personalPhoneRegex = /^9\d{8}$/;
    if (personalPhone && !personalPhoneRegex.test(personalPhone)) {
        toast({ title: "Teléfono Personal Inválido", description: "El teléfono personal debe empezar con 9 y tener exactamente 9 dígitos.", variant: "destructive" });
        return;
    }
    
    setIsSaving(true);
    let finalLogoUrl = logoUrl;
    let finalCoverUrl = coverUrl;

    try {
      // Handle Logo Upload
      if (logoFile) {
        toast({ description: "Subiendo nuevo logo..." });
        if (logoUrl && logoUrl.includes("firebase")) {
          try { await deleteObject(ref(storage, logoUrl)); } catch (e: any) { if (e.code !== 'storage/object-not-found') console.warn("Old logo not deleted:", e); }
        }
        const logoStorageRef = ref(storage, `business-assets/${userProfile.businessId}/logo-${Date.now()}-${logoFile.name}`);
        const logoUploadResult = await uploadBytes(logoStorageRef, logoFile);
        finalLogoUrl = await getDownloadURL(logoUploadResult.ref);
      }
      
      // Handle Cover Upload
      if (coverFile) {
        toast({ description: "Subiendo nueva portada..." });
        if (coverUrl && coverUrl.includes("firebase")) {
          try { await deleteObject(ref(storage, coverUrl)); } catch (e: any) { if (e.code !== 'storage/object-not-found') console.warn("Old cover not deleted:", e); }
        }
        const coverStorageRef = ref(storage, `business-assets/${userProfile.businessId}/cover-${Date.now()}-${coverFile.name}`);
        const coverUploadResult = await uploadBytes(coverStorageRef, coverFile);
        finalCoverUrl = await getDownloadURL(coverUploadResult.ref);
      }

      const updateData: Partial<Business> = {
          name: businessName,
          contactEmail: businessContactEmail,
          publicAddress: businessAddress, 
          publicPhone: businessPublicPhone,
          personalPhone: personalPhone,
          slogan,
          primaryColor,
          secondaryColor,
          logoUrl: finalLogoUrl,
          publicCoverImageUrl: finalCoverUrl,
      };

      const businessDocRef = doc(db, "businesses", userProfile.businessId);
      await updateDoc(businessDocRef, sanitizeObjectForFirestore(updateData as DocumentData));
      
      toast({ title: "Configuración Guardada", description: "Los datos de tu negocio se han actualizado." });
      setLogoFile(null);
      setCoverFile(null);
      await fetchBusinessData();

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-primary flex items-center self-start">
          <Settings className="h-8 w-8 mr-2" /> Configuración
        </h1>
        <div className="self-end sm:self-center">
          <Button onClick={handleSaveChanges} variant="gradient" disabled={isSaving || isLoadingData}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Todos los Cambios
          </Button>
        </div>
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
          <div>
            <Label htmlFor="personalPhone" className="flex items-center mb-2">
                <Smartphone className="h-4 w-4 mr-2 text-muted-foreground"/> Teléfono Personal
                <span className="text-destructive ml-1">*</span>
            </Label>
            <Input 
                id="personalPhone" 
                type="tel" 
                value={personalPhone} 
                onChange={(e) => setPersonalPhone(e.target.value)} 
                disabled={isSaving || isLoadingData}
                placeholder="987654321"
                maxLength={9}
            />
            <p className="text-xs text-muted-foreground mt-2">
                Se usará para compartir códigos por WhatsApp.
            </p>
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
                <Label htmlFor="logoUrl" className="flex items-center"><ImageIconLucide className="h-4 w-4 mr-1 text-muted-foreground"/> Logo del Negocio</Label>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 flex-shrink-0 border p-1 rounded-md flex items-center justify-center bg-muted">
                      {logoPreview ? (
                        <NextImage src={logoPreview} alt="Vista previa del logo" width={64} height={64} className="object-contain" />
                      ) : (
                        <ImageIconLucide className="text-muted-foreground"/>
                      )}
                    </div>
                    <div className="w-full">
                       <input type="file" ref={logoInputRef} onChange={handleLogoFileChange} className="hidden" accept="image/png, image/jpeg, image/gif, image/webp" />
                       <Button type="button" variant="outline" className="w-full" onClick={() => logoInputRef.current?.click()} disabled={isSaving}>
                         <Upload className="mr-2 h-4 w-4" /> Subir Logo
                       </Button>
                    </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coverUrl" className="flex items-center"><ImageIconLucide className="h-4 w-4 mr-1 text-muted-foreground"/> Imagen de Portada</Label>
                 <div className="flex items-center gap-4">
                   <div className="w-24 h-14 flex-shrink-0 border p-1 rounded-md flex items-center justify-center bg-muted">
                      {coverPreview ? (
                         <NextImage src={coverPreview} alt="Vista previa de portada" width={96} height={56} className="object-cover" />
                      ) : (
                         <ImageIconLucide className="text-muted-foreground"/>
                      )}
                    </div>
                     <div className="w-full">
                       <input type="file" ref={coverInputRef} onChange={handleCoverFileChange} className="hidden" accept="image/png, image/jpeg, image/gif, image/webp" />
                       <Button type="button" variant="outline" className="w-full" onClick={() => coverInputRef.current?.click()} disabled={isSaving}>
                         <Upload className="mr-2 h-4 w-4" /> Subir Portada
                       </Button>
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
    </div>
  );
}
