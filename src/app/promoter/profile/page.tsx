
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
import { Loader2, UserCircle, Upload } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const profileFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  dni: z.string().optional(),
  email: z.string().email(),
  phone: z.string().regex(/^9\d{8}$/, "El celular debe empezar con 9 y tener 9 dígitos.").optional().or(z.literal("")),
  photoURL: z.string().url({ message: "Por favor, ingresa una URL válida." }).optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function PromoterProfilePage() {
  const { userProfile, currentUser, loadingAuth, loadingProfile, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: "", dni: "", email: "", phone: "", photoURL: "" },
  });

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

  const handleUpdateProfile = async (values: ProfileFormValues) => {
    if (!currentUser) {
      toast({ title: "Error", description: "No estás autenticado.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    let uploadedPhotoURL = userProfile?.photoURL || "";
    const oldPhotoURL = userProfile?.photoURL; // Save old URL for deletion

    try {
      if (selectedFile) {
        toast({ title: "Subiendo imagen...", description: "Por favor, espera." });
        const storageRef = ref(storage, `promoter-avatars/${currentUser.uid}/${selectedFile.name}`);
        const uploadResult = await uploadBytes(storageRef, selectedFile);
        uploadedPhotoURL = await getDownloadURL(uploadResult.ref);
      }

      const userDocRef = doc(db, "platformUsers", currentUser.uid);
      await updateDoc(userDocRef, {
        name: values.name,
        phone: values.phone || null,
        photoURL: uploadedPhotoURL || null,
      });

      // After successful update, delete old photo if a new one was uploaded and there was an old one.
      if (selectedFile && oldPhotoURL) {
        try {
          const oldPhotoRef = ref(storage, oldPhotoURL);
          await deleteObject(oldPhotoRef);
          console.log("Old profile photo deleted successfully.");
        } catch (deleteError: any) {
          // Log deletion error but don't fail the whole operation for the user
          if (deleteError.code !== 'storage/object-not-found') {
            console.error("Failed to delete old profile photo:", deleteError);
          }
        }
      }

      // After successful update, refresh the user profile in context
      if (refreshUserProfile) {
        await refreshUserProfile();
      }

      toast({
        title: "Perfil Actualizado",
        description: "Tu información ha sido guardada correctamente.",
      });

      setSelectedFile(null);

    } catch (error: any) {
      console.error("Error updating profile:", error);
      let errorMessage = "Ocurrió un error inesperado.";
      if (error.code === 'storage/unauthorized') {
        errorMessage = "No tienes permiso para subir esta imagen. Revisa las reglas de Storage.";
      } else if (error.code === 'storage/object-not-found') {
        errorMessage = "No se encontró la ruta de subida en el servidor.";
      } else {
        errorMessage = error.message || "No se pudo guardar tu perfil.";
      }
      toast({
        title: "Error al Actualizar",
        description: errorMessage,
        variant: "destructive",
        duration: 9000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loadingAuth || loadingProfile) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Cargando tu perfil...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error de Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No se pudo cargar la información de tu perfil.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
       <h1 className="text-3xl font-bold text-primary flex items-center gap-2 mb-6">
          <UserCircle className="h-8 w-8 text-primary !block" /> Mi Perfil
        </h1>

      <Card className="shadow-lg max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
          <CardDescription>Actualiza tu nombre y datos de contacto. El DNI y el email no se pueden modificar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateProfile)} className="space-y-6">
              
              <div className="flex flex-col items-center justify-center mb-6 space-y-3">
                <Avatar className="h-28 w-28 border-4 border-muted-foreground/20">
                  <AvatarImage src={previewUrl || undefined} alt={userProfile.name} />
                  <AvatarFallback className="text-4xl">{userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'P'}</AvatarFallback>
                </Avatar>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="text-sm font-bold text-primary focus:outline-none"
                >
                  Editar
                </button>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Tu nombre completo" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNI / Carnet de Extranjería</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={true} className="disabled:bg-muted/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Teléfono</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="987654321" {...field} value={field.value || ""} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Cuenta)</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} disabled={true} className="disabled:bg-muted/50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
  );
}
