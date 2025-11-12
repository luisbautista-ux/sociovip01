
"use client";

import React, { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, UserCircle, Upload, CheckCircle } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FacebookIcon, GoogleIcon } from "@/components/icons";

const profileFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  dni: z.string().optional(),
  email: z.string().email(),
  phone: z.string().regex(/^9\d{8}$/, "El celular debe empezar con 9 y tener 9 dígitos.").optional().or(z.literal("")),
  photoURL: z.string().url({ message: "Por favor, ingresa una URL válida." }).optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ClientProfilePage() {
  const { userProfile, currentUser, loadingAuth, loadingProfile, refreshUserProfile, linkGoogleAccount } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: "", dni: "", email: "", phone: "", photoURL: "" },
  });
  
  const isGoogleLinked = currentUser?.providerData.some(p => p.providerId === "google.com") ?? false;
  const isFacebookLinked = currentUser?.providerData.some(p => p.providerId === "facebook.com") ?? false;


  useEffect(() => {
    if (userProfile) {
      form.reset({
        name: userProfile.name || "",
        dni: userProfile.dni || "",
        email: userProfile.email || "",
        phone: userProfile.phone || "",
        photoURL: userProfile.photoURL || "",
      });
      if(userProfile.photoURL) {
        setPreviewUrl(userProfile.photoURL);
      }
    }
  }, [userProfile, form]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ title: "Archivo muy grande", description: "Por favor, selecciona una imagen de menos de 2MB.", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleLinkGoogle = async () => {
    setIsLinking(true);
    const result = await linkGoogleAccount();
    if(result.success) {
      toast({ title: "Cuenta de Google Vinculada", description: "Ahora puedes iniciar sesión con Google."});
      await refreshUserProfile();
    } else if (result.error) {
      let message = "No se pudo vincular la cuenta. Inténtalo de nuevo.";
      if(result.error.code === 'auth/credential-already-in-use') {
        message = "Esta cuenta de Google ya está vinculada a otro usuario de la plataforma.";
      }
      toast({ title: "Error al Vincular", description: message, variant: "destructive"});
    }
    setIsLinking(false);
  };


  const handleUpdateProfile = async (values: ProfileFormValues) => {
    if (!currentUser) {
      toast({ title: "Error", description: "No estás autenticado.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    let uploadedPhotoURL = userProfile?.photoURL || "";
    const oldPhotoURL = userProfile?.photoURL; 

    try {
      if (selectedFile) {
        toast({ title: "Subiendo imagen...", description: "Por favor, espera." });
        const storageRef = ref(storage, `client-avatars/${currentUser.uid}/${selectedFile.name}`);
        const uploadResult = await uploadBytes(storageRef, selectedFile);
        uploadedPhotoURL = await getDownloadURL(uploadResult.ref);
      }

      const userDocRef = doc(db, "platformUsers", currentUser.uid);
      await updateDoc(userDocRef, {
        name: values.name,
        phone: values.phone || null,
        photoURL: uploadedPhotoURL || null,
      });
      
      if (selectedFile && oldPhotoURL && oldPhotoURL.includes('firebase')) {
        try {
          const oldPhotoRef = ref(storage, oldPhotoURL);
          await deleteObject(oldPhotoRef);
        } catch (deleteError: any) {
          if (deleteError.code !== 'storage/object-not-found') console.warn("Failed to delete old photo:", deleteError);
        }
      }

      if (refreshUserProfile) await refreshUserProfile();

      toast({ title: "Perfil Actualizado", description: "Tu información ha sido guardada." });
      setSelectedFile(null);

    } catch (error: any) {
      toast({ title: "Error al Actualizar", description: error.message || "No se pudo guardar tu perfil.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loadingAuth || loadingProfile) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3">Cargando...</p></div>;
  }

  if (!userProfile) {
    return <Card><CardHeader><CardTitle>Error</CardTitle></CardHeader><CardContent><p>No se pudo cargar tu perfil.</p></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gradient flex items-center gap-2 mb-6">
        <UserCircle className="h-8 w-8 text-primary !block" /> Mi Perfil
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
              <CardDescription>Actualiza tu nombre y datos de contacto.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpdateProfile)} className="space-y-6">
                  <div className="flex flex-col items-center justify-center mb-6 space-y-3">
                    <Avatar className="h-28 w-28 border-4 border-muted-foreground/20">
                      <AvatarImage src={previewUrl || undefined} alt={userProfile.name} />
                      <AvatarFallback className="text-4xl">{userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'C'}</AvatarFallback>
                    </Avatar>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                      <Upload className="mr-2 h-4 w-4" /> Cambiar Foto
                    </Button>
                  </div>

                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input placeholder="Tu nombre" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="dni" render={({ field }) => (
                      <FormItem><FormLabel>DNI/CE</FormLabel><FormControl><Input {...field} disabled={true} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input type="tel" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                    )}/>
                  </div>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email (Cuenta)</FormLabel><FormControl><Input type="email" {...field} disabled={true} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting} variant="gradient">
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Guardar Cambios"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-lg">
            <CardHeader><CardTitle>Cuentas Vinculadas</CardTitle><CardDescription>Conecta tus redes sociales para un inicio de sesión más rápido.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {isGoogleLinked ? (
                <Button variant="outline" className="w-full border-green-500 bg-green-50 text-green-700 cursor-not-allowed">
                  <CheckCircle className="mr-2 h-5 w-5"/> Cuenta de Google Vinculada
                </Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={handleLinkGoogle} disabled={isLinking}>
                   {isLinking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <GoogleIcon className="mr-2 h-5 w-5" />}
                   Vincular con Google
                </Button>
              )}

              <Button variant="outline" className="w-full" disabled={true}>
                <FacebookIcon className="mr-2 h-5 w-5" /> Vincular con Facebook (Próximamente)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
