"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SocioVipLogo } from "@/components/icons";
import { Loader2 } from "lucide-react";
import type { AuthError } from "firebase/auth";

const loginFormSchema = z.object({
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { login, currentUser, userProfile, loadingAuth, loadingProfile } = useAuth(); // Añadir currentUser, userProfile, loadingAuth, loadingProfile
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Redireccionar si ya hay un usuario logueado y con perfil
  useEffect(() => {
    if (!loadingAuth && !loadingProfile && currentUser && userProfile) {
      // Si ya estamos logueados y el perfil está cargado, intentamos ir al dispatcher
      // Esto es para el caso en que un usuario logueado visite /login directamente
      router.push("/auth/dispatcher");
    }
  }, [currentUser, userProfile, loadingAuth, loadingProfile, router]);


  const handleLogin = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await login(values.email, values.password);
      if ("user" in result) { // Check if it's UserCredential (successful login)
        toast({
          title: "Inicio de Sesión Exitoso",
          description: "Serás redirigido en breve.",
        });
        // No necesitamos esperar userProfile aquí, el dispatcher se encargará
        router.push("/auth/dispatcher"); 
      } else { // It's AuthError
        const errorCode = (result as AuthError).code;
        let errorMessage = "Ocurrió un error al iniciar sesión.";
        if (errorCode === "auth/user-not-found" || errorCode === "auth/wrong-password" || errorCode === "auth/invalid-credential") {
          errorMessage = "Email o contraseña incorrectos.";
        } else if (errorCode === "auth/invalid-email") {
          errorMessage = "El formato del email no es válido.";
        }
        toast({
          title: "Error de Inicio de Sesión",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) { // Catch any unexpected errors
      console.error("Unexpected login error", error);
      toast({
        title: "Error de Inicio de Sesión",
        description: "Ocurrió un error inesperado. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mostrar un loader si se está verificando la sesión inicial y el usuario ya está logueado
  // para evitar un flash de la página de login.
  if (loadingAuth || (currentUser && loadingProfile)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/40">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Verificando sesión...</p>
      </div>
    );
  }


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="items-center text-center">
          <SocioVipLogo className="h-14 w-14 text-primary mb-3" />
          <CardTitle className="text-3xl">Iniciar Sesión</CardTitle>
          <CardDescription>Accede a tu panel de SocioVIP.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="tu@email.com" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Ingresar"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col items-center text-sm">
           <p className="text-muted-foreground">
            ¿No tienes una cuenta de Super Admin?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Regístrate aquí
            </Link>
          </p>
          <p className="mt-4 text-muted-foreground">
            <Link href="/" className="font-medium text-primary hover:underline">
              Ir a la página principal
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
