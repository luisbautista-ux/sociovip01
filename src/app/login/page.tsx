
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
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, ArrowLeft } from "lucide-react";
import type { AuthError } from "firebase/auth";
import { GoogleIcon, SocioVipLogo } from "@/components/icons";
import { Separator } from "@/components/ui/separator";

const loginFormSchema = z.object({
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  password: z
    .string()
    .min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

// 🔁 NUEVA IMAGEN 4K
const HERO_IMG = "https://i.ibb.co/Df4TYMDn/concierto1.jpg";
const LOGO_IMG = "https://i.ibb.co/ycG8QLZj/Brown-Mascot-Lion-Free-Logo.jpg";

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { login, loginWithGoogle, currentUser, userProfile, loadingAuth, loadingProfile } = useAuth();
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!loadingAuth && !loadingProfile && currentUser && userProfile) {
      router.push("/auth/dispatcher");
    }
  }, [currentUser, userProfile, loadingAuth, loadingProfile, router]);

  const handleLogin = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await login(values.email, values.password);
      if ("user" in result) {
        toast({ title: "Inicio de Sesión Exitoso", description: "Serás redirigido en breve." });
        router.push("/auth/dispatcher");
      } else {
        const errorCode = (result as AuthError).code;
        let errorMessage = "Ocurrió un error al iniciar sesión.";
        if (
          errorCode === "auth/user-not-found" ||
          errorCode === "auth/wrong-password" ||
          errorCode === "auth/invalid-credential"
        ) {
          errorMessage = "Email o contraseña incorrectos.";
        } else if (errorCode === "auth/invalid-email") {
          errorMessage = "El formato del email no es válido.";
        }
        toast({ title: "Error de Inicio de Sesión", description: errorMessage, variant: "destructive" });
      }
    } catch (err) {
      console.error("Unexpected login error", err);
      toast({
        title: "Error de Inicio de Sesión",
        description: "Ocurrió un error inesperado. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      const result = await loginWithGoogle();
      if ("user" in result) {
        toast({ title: "Inicio de Sesión Exitoso", description: "¡Bienvenido/a de nuevo!" });
        router.push("/auth/dispatcher");
      } else {
        const errorCode = (result as AuthError).code;
        let errorMessage = "No se pudo iniciar sesión con Google.";
        if (errorCode === "auth/popup-closed-by-user") {
            errorMessage = "Has cerrado la ventana de inicio de sesión. Inténtalo de nuevo.";
        } else if (errorCode === 'auth/account-exists-with-different-credential') {
            errorMessage = "Ya existe una cuenta con este email pero con un método de inicio de sesión diferente."
        }
        toast({ title: "Error con Google", description: errorMessage, variant: "destructive" });
      }
    } catch (err) {
       console.error("Unexpected Google login error", err);
       toast({ title: "Error con Google", description: "Ocurrió un error inesperado.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingAuth || (currentUser && loadingProfile)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/40">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Verificando sesión...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f4eef7]">
      <Link
        href="/"
        className="z-10 absolute left-4 top-5 md:left-10 md:top-10 inline-flex items-center gap-2 text-[17px] md:text-[20px] font-semibold text-gradient bg-gradient-to-r from-purple-500 to-purple-700 text-transparent bg-clip-text hover:text-primary/80"
      >
        <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
        Volver al inicio
      </Link>

      <div className="relative flex items-center justify-center min-h-screen">
        <div className="w-full max-w-xl mx-auto px-6 md:px-12 pt-20 md:pt-28">
          <Card className="bg-white/90 backdrop-blur-sm rounded-xl shadow-md md:shadow-lg">
            <CardHeader className="py-6">
              <CardTitle className="text-center text-3xl font-extrabold text-gradient bg-gradient-to-r from-purple-500 to-purple-700 text-transparent bg-clip-text">
                Bienvenido a
              </CardTitle>
              <CardTitle className="text-center text-3xl font-extrabold text-gradient bg-gradient-to-r from-purple-500 to-purple-700 text-transparent bg-clip-text">
                SocioVIP
              </CardTitle>
            </CardHeader>

            <CardContent className="pb-2">
              <Card className="bg-white/90 rounded-xl shadow-md">
                <CardHeader className="py-6">
                  <div className="w-full flex justify-center mb-4">
                    <SocioVipLogo size={96} />
                  </div>
                  <CardTitle className="text-center">Iniciar Sesión</CardTitle>
                  <CardDescription className="text-center">
                    Accede a tu panel de SocioVIP.
                  </CardDescription>
                </CardHeader>

                <CardContent className="pb-2">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-5">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Tu correo electrónico <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="tu@email.com"
                                {...field}
                                disabled={isSubmitting}
                                className="transition duration-300 ease-in-out focus:ring-2 focus:ring-primary focus:outline-none border-2 border-gray-300 rounded-md p-2 w-full"
                              />
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
                            <FormLabel>
                              Ingresa 6 caracteres o más <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                {...field}
                                disabled={isSubmitting}
                                className="transition duration-300 ease-in-out focus:ring-2 focus:ring-primary focus:outline-none border-2 border-gray-300 rounded-md p-2 w-full"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-purple-500 to-purple-700 hover:bg-gradient-to-l text-white font-bold py-2 px-4 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          "Ingresar"
                        )}
                      </Button>
                    </form>
                  </Form>
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        O continuar con
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleLogin}
                    disabled={isSubmitting}
                  >
                    <GoogleIcon className="mr-2 h-4 w-4" />
                    Google
                  </Button>

                </CardContent>
              </Card>
            </CardContent>

            <CardFooter className="flex-col items-center text-sm pt-4">
              <p className="text-muted-foreground">
                ¿Aún no eres Promotor?{" "}
                <Link href="/signup" className="font-medium text-primary hover:underline">
                  Regístrate aquí
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
