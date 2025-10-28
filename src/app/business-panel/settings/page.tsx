

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Palette, ImageIcon as ImageIconLucide, Type, UploadCloud, Loader2, Link as LinkIcon, Smartphone, Upload, Trash2, Image as ImageIcon } from "lucide-react"; 
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

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [slogan, setSlogan] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#B080D0"); 
  const [secondaryColor, setSecondaryColor] = useState("#8E5EA2");
  
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const [coverUrls, setCoverUrls] = useState<string[]>([]);
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  const [coverPreviews, setCoverPreviews] = useState<string[]>([]);
  
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
          setSlogan(data.slogan || "");
          setPrimaryColor(data.primaryColor || "#B080D0"); 
          setSecondaryColor(data.secondaryColor || "#8E5EA2");
          
          setLogoUrl(data.logoUrl || "");
          setLogoPreview(data.logoUrl || null);
          
          const urls = data.publicCoverImageUrls || [];
          setCoverUrls(urls);
          setCoverPreviews(urls);

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
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ title: "Archivo de logo muy grande", description: "Por favor, selecciona una imagen de menos de 2MB.", variant: "destructive" });
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleCoverFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    let error = false;

    files.forEach(file => {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({ title: `Archivo '${file.name}' muy grande`, description: "Las imágenes de portada no deben superar los 5MB.", variant: "destructive" });
            error = true;
        } else if ((coverFiles.length + newFiles.length + coverUrls.length) < 5) {
            newFiles.push(file);
            newPreviews.push(URL.createObjectURL(file));
        } else {
            toast({ title: "Límite de imágenes alcanzado", description: "Puedes tener un máximo de 5 imágenes de portada.", variant: "destructive" });
            error = true;
        }
    });

    if (!error) {
        setCoverFiles(prev => [...prev, ...newFiles]);
        setCoverPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeCoverImage = (indexToRemove: number) => {
    const previewToRemove = coverPreviews[indexToRemove];
    
    // If it's a new file (blob URL)
    if (previewToRemove.startsWith('blob:')) {
        const fileIndex = coverFiles.findIndex(file => URL.createObjectURL(file) === previewToRemove);
        if (fileIndex > -1) {
            setCoverFiles(prev => prev.filter((_, i) => i !== fileIndex));
        }
    } else {
        // It's an existing URL from Firebase
        setCoverUrls(prev => prev.filter(url => url !== previewToRemove));
    }
    
    // Always remove from previews
    setCoverPreviews(prev => prev.filter((_, i) => i !== indexToRemove));
  };


  const handleSaveChanges = async () => {
    if (!userProfile?.businessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    
    setIsSaving(true);
    let finalLogoUrl = logoUrl;
    let finalCoverUrls = [...coverUrls];

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
      
      // Handle Cover Uploads
      if (coverFiles.length > 0) {
        toast({ description: `Subiendo ${coverFiles.length} nueva(s) imágen(es) de portada...` });
        const uploadedUrls = await Promise.all(
          coverFiles.map(async (file) => {
            const coverStorageRef = ref(storage, `business-assets/${userProfile.businessId}/covers/${Date.now()}-${file.name}`);
            const uploadResult = await uploadBytes(coverStorageRef, file);
            return getDownloadURL(uploadResult.ref);
          })
        );
        finalCoverUrls.push(...uploadedUrls);
      }

      // Identify deleted URLs
      const initialUrls = (await getDoc(doc(db, "businesses", userProfile.businessId))).data()?.publicCoverImageUrls || [];
      const deletedUrls = initialUrls.filter((url: string) => !finalCoverUrls.includes(url));
      
      // Delete from Storage
      if (deletedUrls.length > 0) {
        toast({ description: `Eliminando ${deletedUrls.length} imágen(es) antiguas...` });
        await Promise.all(deletedUrls.map(async (url: string) => {
          if (url.includes("firebase")) {
            try { await deleteObject(ref(storage, url)); } catch (e: any) { if (e.code !== 'storage/object-not-found') console.warn("Old cover not deleted:", e); }
          }
        }));
      }

      const updateData: Partial<Business> = {
          name: businessName,
          slogan,
          primaryColor,
          secondaryColor,
          logoUrl: finalLogoUrl,
          publicCoverImageUrls: finalCoverUrls,
      };

      const businessDocRef = doc(db, "businesses", userProfile.businessId);
      await updateDoc(businessDocRef, sanitizeObjectForFirestore(updateData as DocumentData));
      
      toast({ title: "Configuración Guardada", description: "Los datos de tu negocio se han actualizado." });
      
      setLogoFile(null);
      setCoverFiles([]);
      await fetchBusinessData();

    } catch (error: any) {
        console.error("Error saving business settings:", error);
        const description = error?.code === 'storage/unauthorized'
            ? "Permiso denegado. Verifica las reglas de Firebase Storage."
            : error.message || "No se pudieron guardar los cambios.";
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
          <CardTitle>Información Pública</CardTitle>
          <CardDescription>Esta información será visible en la página pública de tu negocio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="space-y-2">
            <Label>Logo del Negocio</Label>
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
                     <Upload className="mr-2 h-4 w-4" /> Cambiar Logo
                   </Button>
                </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Imágenes de Portada (hasta 5)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {coverPreviews.map((preview, index) => (
                <div key={index} className="relative group aspect-video">
                  <NextImage src={preview} alt={`Portada ${index + 1}`} fill className="object-cover rounded-md" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeCoverImage(index)}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {coverPreviews.length < 5 && (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={isSaving}
                  className="aspect-video border-2 border-dashed rounded-md flex flex-col items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                >
                  <UploadCloud className="h-8 w-8" />
                  <span className="text-xs mt-1">Añadir imagen</span>
                </button>
              )}
            </div>
            <input type="file" ref={coverInputRef} onChange={handleCoverFilesChange} className="hidden" accept="image/png, image/jpeg, image/webp" multiple />
            <p className="text-xs text-muted-foreground mt-2">Puedes arrastrar para reordenar las imágenes.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessName">Nombre del Negocio</Label>
            <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} disabled={isSaving || isLoadingData} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slogan" className="flex items-center"><Type className="h-4 w-4 mr-1 text-muted-foreground"/> Slogan del Negocio</Label>
            <Input id="slogan" placeholder="Tu frase pegajosa aquí" value={slogan} onChange={(e) => setSlogan(e.target.value)} disabled={isSaving || isLoadingData} />
          </div>

        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><Palette className="h-6 w-6 mr-2 text-primary"/> Tema de Marca</CardTitle>
          <CardDescription>Personaliza los colores de tu página pública y componentes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Color Primario</Label>
              <Input id="primaryColor" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 p-1 w-full" disabled={isSaving || isLoadingData}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Color Secundario (Acento)</Label>
              <Input id="secondaryColor" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-10 p-1 w-full" disabled={isSaving || isLoadingData}/>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
