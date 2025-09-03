
"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, UserCircle } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  const { userProfile, currentUser, loadingAuth, loadingProfile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      dni: "",
      email: "",
      phone: "",
      photoURL: "",
    },
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
    }
  }, [userProfile, form]);

  const handleUpdateProfile = async (values: ProfileFormValues) => {
    if (!currentUser) {
      toast({ title: "Error", description: "No estás autenticado.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, "platformUsers", currentUser.uid);
      await updateDoc(userDocRef, {
        name: values.name,
        phone: values.phone || null,
        photoURL: values.photoURL || null,
      });
      toast({
        title: "Perfil Actualizado",
        description: "Tu información ha sido guardada correctamente.",
      });
    } catch (error: any) {
      toast({
        title: "Error al Actualizar",
        description: `No se pudo guardar tu perfil. ${error.message}`,
        variant: "destructive",
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
       <h1 className="text-3xl font-bold text-primary flex items-center">
        <UserCircle className="h-8 w-8 mr-2" /> Mi Perfil de Promotor
      </h1>

      <Card className="shadow-lg max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
          <CardDescription>Actualiza tu nombre y datos de contacto. El DNI y el email no se pueden modificar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateProfile)} className="space-y-6">
              <div className="flex justify-center mb-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={form.watch('photoURL') || userProfile?.photoURL || undefined} alt={userProfile.name} />
                  <AvatarFallback className="text-3xl">{userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'P'}</AvatarFallback>
                </Avatar>
              </div>

              <FormField
                control={form.control}
                name="photoURL"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL de Foto de Perfil</FormLabel>
                    <FormControl>
                      <Input placeholder="https://ejemplo.com/tu-foto.jpg" {...field} value={field.value || ""} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
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
