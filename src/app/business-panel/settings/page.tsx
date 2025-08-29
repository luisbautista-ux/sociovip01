
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Palette, Image as ImageIconLucide, Type, QrCode, UploadCloud, Loader2 } from "lucide-react"; 
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import React, { useState, useRef, ChangeEvent, useEffect, useCallback } from 'react'; 
import NextImage from "next/image"; 
import { useToast } from "@/hooks/use-toast"; 
import { useAuth } from "@/context/AuthContext"; 
import { db, storage } from "@/lib/firebase"; 
import { doc, getDoc, updateDoc, type DocumentData } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import type { Business } from "@/lib/types";
import { sanitizeObjectForFirestore } from "@/lib/utils";


export default function BusinessSettingsPage() {
  const { userProfile, currentUser, loadingAuth, loadingProfile } = useAuth();
  const { toast } = useToast();

  const [businessData, setBusinessData] = useState<Business | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [businessName, setBusinessName] = useState("");
  const [businessContactEmail, setBusinessContactEmail] = useState("");
  const [businessAddress, setBusinessAddress] = useState(""); 
  const [businessPublicPhone, setBusinessPublicPhone] = useState("");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [slogan, setSlogan] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#B080D0"); 
  const [secondaryColor, setSecondaryColor] = useState("#8E5EA2");
  
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  const uploadFileAndGetURL = (file: File, path: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!currentUser) {
            const authError = new Error("User not authenticated for upload.");
            toast({ title: "Error de Autenticación", description: "Debes estar logueado para subir archivos.", variant: "destructive" });
            reject(authError);
            return;
        }

        const fileRef = storageRef(storage, path);
        const uploadTask = uploadBytesResumable(fileRef, file, {
            customMetadata: { uploaderUid: currentUser.uid }
        });

        uploadTask.on(
            "state_changed",
            (snapshot) => { /* Progress handling can be added here */ },
            (error: any) => {
                console.error("Firebase Storage Upload failed:", error.code, error.message);
                const userFacingError = new Error(`No se pudo subir ${file.name}. Código: ${error.code}. Verifica los permisos de Storage.`);
                toast({ title: "Error de Subida", description: userFacingError.message, variant: "destructive", duration: 10000 });
                reject(userFacingError); // Reject the promise on error
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL); // Resolve the promise on success
                } catch (downloadUrlError: any) {
                    console.error("Failed to get download URL after upload:", downloadUrlError);
                    const finalError = new Error("No se pudo obtener la URL de descarga del archivo.");
                    toast({ title: "Error de Descarga", description: finalError.message, variant: "destructive"});
                    reject(finalError);
                }
            }
        );
    });
};

  const handleSaveChangesBranding = async () => {
    if (!userProfile?.businessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    if (!currentUser?.uid) {
      toast({ title: "Error", description: "Usuario no autenticado o UID no disponible.", variant: "destructive" });
      return;
    }
    
    setIsSavingBranding(true);
    
    const updateData: Partial<Business> = {
      slogan,
      primaryColor,
      secondaryColor,
    };

    try {
      if (logoFile) {
        const storagePathForLogo = `businesses/${userProfile.businessId}/logo/${Date.now()}-${logoFile.name}`;
        const logoUrl = await uploadFileAndGetURL(logoFile, storagePathForLogo);
        updateData.logoUrl = logoUrl;
      }

      if (coverFile) {
        const storagePathForCover = `businesses/${userProfile.businessId}/cover/${Date.now()}-${coverFile.name}`;
        const coverUrl = await uploadFileAndGetURL(coverFile, storagePathForCover);
        updateData.publicCoverImageUrl = coverUrl;
      }

      if (Object.keys(updateData).length > 0) {
        const businessDocRef = doc(db, "businesses", userProfile.businessId);
        await updateDoc(businessDocRef, sanitizeObjectForFirestore(updateData as DocumentData));
      }
      
      toast({
        title: "Branding Guardado",
        description: "Los cambios de branding se han guardado correctamente.",
      });
      setLogoFile(null); 
      setCoverFile(null); 
    } catch (error: any) {
        // Error toasts are now handled inside uploadFileAndGetURL or for Firestore updates
        if (!String(error.message).includes("subir") && !String(error.message).includes("descarga")) {
             toast({ title: "Error al Guardar en Base de Datos", description: error.message || "No se pudieron guardar los cambios.", variant: "destructive"});
        }
    } finally {
      setIsSavingBranding(false);
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
              <Label htmlFor="logoUploadButton" className="flex items-center"><ImageIconLucide className="h-4 w-4 mr-1 text-muted-foreground"/> Logo del Negocio</Label>
              <input type="file" accept="image/png, image/jpeg" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" id="logoUploadInput"/>
              <Button id="logoUploadButton" variant="outline" onClick={() => logoInputRef.current?.click()} className="w-full" disabled={isSavingBranding || isLoadingData}>
                <UploadCloud className="mr-2 h-4 w-4"/> Seleccionar Logo (Max 2MB)
              </Button>
              {logoPreview && (
                <div className="mt-2 p-2 border rounded-md inline-block bg-muted">
                  <NextImage src={logoPreview} alt="Previsualización del Logo" width={150} height={50} className="object-contain max-h-[50px]" data-ai-hint="logo business"/>
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
                    <NextImage src={coverPreview} alt="Previsualización de Portada" width={250} height={100} className="object-cover max-h-[100px]" data-ai-hint="cover image store"/>
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

    
