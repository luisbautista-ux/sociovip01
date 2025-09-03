
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Palette, Image as ImageIconLucide, Type, QrCode, UploadCloud, Loader2 } from "lucide-react"; 
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect, useCallback, useRef } from 'react'; 
import NextImage from "next/image"; 
import { useToast } from "@/hooks/use-toast"; 
import { useAuth } from "@/context/AuthContext"; 
import { db, storage } from "@/lib/firebase"; 
import { doc, getDoc, updateDoc, type DocumentData } from "firebase/firestore";
import type { Business } from "@/lib/types";
import { sanitizeObjectForFirestore } from "@/lib/utils";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";


export default function BusinessSettingsPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const { toast } = useToast();

  const [businessData, setBusinessData] = useState<Business | null>(null);
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

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isSavingBrandingText, setIsSavingBrandingText] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  const fetchBusinessData = useCallback(async () => {
    if (userProfile?.businessId) {
      setIsLoadingData(true);
      try {
        const businessDocRef = doc(db, "businesses", userProfile.businessId);
        const businessSnap = await getDoc(businessDocRef);
        if (businessSnap.exists()) {
          const data = businessSnap.data() as Business;
          setBusinessData(data);
          
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

  const handleFileUpload = async (file: File | null, type: 'logo' | 'cover') => {
    if (!file || !userProfile?.businessId) {
        toast({ title: "Error", description: "No se ha seleccionado ningún archivo o falta el ID del negocio.", variant: "destructive" });
        return;
    }

    const uploaderStateSetter = type === 'logo' ? setIsUploadingLogo : setIsUploadingCover;
    uploaderStateSetter(true);
    
    try {
        const filePath = `businesses/${userProfile.businessId}/${type}-${Date.now()}-${file.name}`;
        const storageRef = ref(storage, filePath);
        
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        const fieldToUpdate = type === 'logo' ? { logoUrl: downloadURL } : { publicCoverImageUrl: downloadURL };
        
        const businessDocRef = doc(db, "businesses", userProfile.businessId);
        await updateDoc(businessDocRef, fieldToUpdate);

        toast({ title: `¡Éxito!`, description: `La imagen de ${type === 'logo' ? 'logo' : 'portada'} ha sido actualizada.` });

        if (type === 'logo') {
            setLogoUrl(downloadURL);
            setLogoFile(null);
        } else {
            setCoverUrl(downloadURL);
            setCoverFile(null);
        }

    } catch (error: any) {
        console.error(`Error uploading ${type}:`, error);
        toast({ title: "Error de Subida", description: `No se pudo subir la imagen. ${error.message}`, variant: "destructive" });
    } finally {
        uploaderStateSetter(false);
    }
  };

  
  const handleSaveBrandingText = async () => {
    if (!userProfile?.businessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    
    setIsSavingBrandingText(true);
    
    try {
        const updateData: Partial<Business> = {
            slogan,
            primaryColor,
            secondaryColor,
        };
        const businessDocRef = doc(db, "businesses", userProfile.businessId);
        await updateDoc(businessDocRef, sanitizeObjectForFirestore(updateData as DocumentData));
        toast({ title: "Branding Guardado", description: "El slogan y los colores se han guardado." });
    } catch (error: any) {
        console.error("Error saving text branding:", error);
        toast({ title: "Error al Guardar", description: `No se pudieron guardar los cambios. ${error.message}`, variant: "destructive"});
    } finally {
        setIsSavingBrandingText(false);
    }
  };
  
  const handleSaveChangesInfo = async () => {
    if (!userProfile?.businessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    setIsSavingInfo(true);

    const infoUpdateData: Partial<Business> = {
        name: businessName,
        contactEmail: businessContactEmail,
        publicAddress: businessAddress, 
        publicPhone: businessPublicPhone,
    };

    try {
        const businessDocRef = doc(db, "businesses", userProfile.businessId);
        await updateDoc(businessDocRef, sanitizeObjectForFirestore(infoUpdateData as DocumentData));
        toast({ title: "Información Guardada", description: "Los datos del negocio se han actualizado." });
        fetchBusinessData(); 
    } catch (error: any) {
        console.error("Error saving business info:", error);
        const description = error?.message 
          ? `No se pudieron guardar los cambios. ${error.message}` 
          : "No se pudieron guardar los cambios. Ocurrió un error desconocido.";
        toast({ title: "Error al Guardar Información", description, variant: "destructive"});
    } finally {
        setIsSavingInfo(false);
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
            <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} disabled={isSavingInfo || isLoadingData} />
          </div>
          <div>
            <Label htmlFor="businessEmail">Email de Contacto</Label>
            <Input id="businessEmail" type="email" value={businessContactEmail} onChange={(e) => setBusinessContactEmail(e.target.value)} disabled={isSavingInfo || isLoadingData} />
          </div>
           <div>
            <Label htmlFor="businessAddress">Dirección Pública</Label>
            <Input id="businessAddress" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} disabled={isSavingInfo || isLoadingData} />
          </div>
           <div>
            <Label htmlFor="businessPhone">Teléfono Público</Label>
            <Input id="businessPhone" type="tel" value={businessPublicPhone} onChange={(e) => setBusinessPublicPhone(e.target.value)} disabled={isSavingInfo || isLoadingData}/>
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
                <Label htmlFor="logo" className="flex items-center"><ImageIconLucide className="h-4 w-4 mr-1 text-muted-foreground"/> Logo del Negocio</Label>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 flex-shrink-0">
                      {logoFile ? (
                        <NextImage src={URL.createObjectURL(logoFile)} alt="Previsualización Logo" width={64} height={64} className="rounded-md border p-1 object-contain" />
                      ) : logoUrl ? (
                        <NextImage src={logoUrl} alt="Logo actual" width={64} height={64} className="rounded-md border p-1 object-contain" />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
                            <ImageIconLucide/>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={isUploadingLogo || isUploadingCover}>
                        {logoUrl ? 'Cambiar Logo' : 'Seleccionar Logo'}
                      </Button>
                      <Button size="sm" onClick={() => handleFileUpload(logoFile, 'logo')} disabled={!logoFile || isUploadingLogo || isUploadingCover}>
                          {isUploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                          Subir Logo
                      </Button>
                    </div>
                    <Input ref={logoInputRef} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover" className="flex items-center"><ImageIconLucide className="h-4 w-4 mr-1 text-muted-foreground"/> Imagen de Portada</Label>
                <div className="flex items-center gap-4">
                   <div className="w-24 h-14 flex-shrink-0">
                      {coverFile ? (
                        <NextImage src={URL.createObjectURL(coverFile)} alt="Previsualización Portada" width={100} height={56} className="rounded-md border p-1 object-cover" />
                      ) : coverUrl ? (
                         <NextImage src={coverUrl} alt="Portada actual" width={100} height={56} className="rounded-md border p-1 object-cover" />
                      ) : (
                         <div className="w-24 h-14 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
                            <ImageIconLucide/>
                        </div>
                      )}
                    </div>
                     <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} disabled={isUploadingLogo || isUploadingCover}>
                          {coverUrl ? 'Cambiar Portada' : 'Seleccionar Portada'}
                        </Button>
                        <Button size="sm" onClick={() => handleFileUpload(coverFile, 'cover')} disabled={!coverFile || isUploadingLogo || isUploadingCover}>
                            {isUploadingCover ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                            Subir Portada
                        </Button>
                     </div>
                    <Input ref={coverInputRef} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
                </div>
              </div>
            </div>
          <div>
            <Label htmlFor="slogan" className="flex items-center"><Type className="h-4 w-4 mr-1 text-muted-foreground"/> Slogan del Negocio</Label>
            <Input id="slogan" placeholder="Tu frase pegajosa aquí" value={slogan} onChange={(e) => setSlogan(e.target.value)} disabled={isSavingBrandingText || isLoadingData} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="primaryColor">Color Primario</Label>
              <Input id="primaryColor" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 p-1 w-full" disabled={isSavingBrandingText || isLoadingData}/>
            </div>
            <div>
              <Label htmlFor="secondaryColor">Color Secundario</Label>
              <Input id="secondaryColor" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-10 p-1 w-full" disabled={isSavingBrandingText || isLoadingData}/>
            </div>
          </div>
          <Button onClick={handleSaveBrandingText} className="bg-primary hover:bg-primary/90" disabled={isSavingBrandingText || isLoadingData}>
            {isSavingBrandingText && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Slogan y Colores
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
