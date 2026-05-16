
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
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import type { AuthError, UserCredential } from "firebase/auth";
import { SocioVipLogo, GoogleIcon } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import { ResetPasswordModal } from "@/components/auth/ResetPasswordModal";

const loginFormSchema = z.object({
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  password: z
    .string()
    .min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const { toast } = useToast();
  const { login, currentUser, userProfile, loadingAuth, loadingProfile, loginWithGoogle } = useAuth();
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!loadingAuth && !loadingProfile) {
      if (currentUser && userProfile) {
        router.push("/auth/dispatcher");
      } else if (currentUser && !userProfile) {
        toast({
          title: "Error de Perfil",
          description: "Tu cuenta de autenticación existe pero no se encontró un perfil asociado. Cerrando sesión.",
          variant: "destructive",
          duration: 7000,
        });
      }
    }
  }, [currentUser, userProfile, loadingAuth, loadingProfile, router, toast]);

  const handleLogin = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await login(values.email, values.password);

      if ("code" in result) { // AuthError
        const errorCode = result.code;
        let errorMessage = "Ocurrió un error al iniciar sesión.";
        if (
          errorCode === "auth/user-not-found" ||
          errorCode === "auth/wrong-password" ||
          errorCode === "auth/invalid-credential"
        ) {
          errorMessage = "Email o contraseña incorrectos.";
        } else if (errorCode === "auth/invalid-email") {
          errorMessage = "El formato del email no es válido.";
        } else if (result.message.includes('No se encontró perfil')) {
          errorMessage = result.message;
        }

        toast({ title: "Error de Inicio de Sesión", description: errorMessage, variant: "destructive" });
        setIsSubmitting(false);
      } else {
        toast({ title: "Inicio de Sesión Exitoso", description: "Verificando perfil y redirigiendo..." });
      }
    } catch (err) {
      console.error("Unexpected login error", err);
      toast({
        title: "Error de Inicio de Sesión",
        description: "Ocurrió un error inesperado. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    setIsSubmitting(true);
    try {
      const loginFunction = loginWithGoogle;
      const result = await loginFunction();
      if ("code" in result) {
        toast({
          title: "Error de Inicio de Sesión",
          description: result.message || `No se pudo iniciar sesión con ${provider}.`,
          variant: "destructive"
        });
        setIsSubmitting(false);
      } else {
        toast({ title: `Inicio de Sesión con ${provider.charAt(0).toUpperCase() + provider.slice(1)} Exitoso`, description: "Redirigiendo..." });
      }
    } catch (err) {
      console.error(`${provider} login error`, err);
      toast({ title: "Error", description: "Ocurrió un error inesperado.", variant: "destructive" });
      setIsSubmitting(false);
    }
  };


  if (loadingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-loader">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-6 max-w-[85vw] animate-drop-in animate-float">
            <SocioVipLogo size={180} variant="pill" pillPadding="py-0 px-[1.5%]" className="!aspect-[1.6/1] !h-auto object-fill border-[1px] border-white/95 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.3)] drop-shadow-lg" />
          </div>
          <p className="mt-6 text-xl font-semibold text-white/90">Cargando...</p>
        </div>
      </div>
    );
  }

  if (currentUser && loadingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-loader">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-6 animate-drop-in animate-float">
            <SocioVipLogo size={180} variant="pill" pillPadding="py-0 px-[1.5%]" className="!aspect-[1.6/1] !h-auto object-fill border-[1px] border-white/95 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.3)] drop-shadow-lg" />
          </div>
          <p className="mt-6 text-xl font-semibold text-white/90">Sesión iniciada. Verificando tu perfil...</p>
        </div>
      </div>
    );
  }


  return (
    <>
      <div className="relative min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 flex flex-col items-center justify-center p-4 overflow-hidden">
        <Link href="/" className="group absolute top-6 left-6 z-50">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:opacity-70 transition-opacity">
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </span>
        </Link>

        {/* Elementos decorativos de fondo para un toque premium */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px]" />
        </div>

        <div className="relative z-10 w-full flex flex-col items-center justify-center">
          <div className="w-full max-w-md mx-auto">
            <Card className="w-full bg-white/90 backdrop-blur-sm rounded-xl shadow-md md:shadow-lg">
              <CardHeader className="pt-10 pb-2">
                <div className="w-full flex justify-center mb-4">
                  <SocioVipLogo size={180} variant="pill" pillPadding="py-0 px-[1.5%]" className="!aspect-[1.6/1] !h-auto object-fill drop-shadow-lg" />
                </div>
              </CardHeader>

              <CardContent className="pb-6">
                <div className="space-y-3">
                  <Button onClick={() => handleSocialLogin('google')} variant="outline" className="w-full" disabled={isSubmitting}>
                    <GoogleIcon className="mr-2 h-5 w-5" /> Ingresar con Google
                  </Button>
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">O continúa con</span>
                    </div>
                  </div>
                </div>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-5 mt-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Correo electrónico <span className="text-destructive">*</span>
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
                            Contraseña <span className="text-destructive">*</span>
                          </FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                {...field}
                                disabled={isSubmitting}
                                className="transition duration-300 ease-in-out focus:ring-2 focus:ring-primary focus:outline-none border-2 border-gray-300 rounded-md p-2 w-full pr-10"
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground"
                              onClick={() => setShowPassword(!showPassword)}
                              disabled={isSubmitting}
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                              <span className="sr-only">
                                {showPassword ? "Ocultar" : "Mostrar"} contraseña
                              </span>
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="text-right">
                      <Button
                        type="button"
                        variant="link"
                        className="text-primary h-auto p-0 text-sm font-medium"
                        onClick={() => setShowResetModal(true)}
                      >
                        ¿Olvidaste tu contraseña?
                      </Button>
                    </div>
                    <Button
                      type="submit"
                      className="w-full font-bold py-2 px-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
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
              </CardContent>
              <CardFooter className="flex-col items-center text-sm pt-4">
                <p className="text-muted-foreground">
                  ¿No tienes una cuenta?{" "}
                  <Link href="/signup" className="font-medium text-primary hover:underline">
                    Regístrate aquí
                  </Link>
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
      <ResetPasswordModal open={showResetModal} onOpenChange={setShowResetModal} />
    </>
  );
}
