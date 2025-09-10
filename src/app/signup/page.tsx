

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
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import type { AuthError } from "firebase/auth";
import { SocioVipLogo } from "@/components/icons";
import { Checkbox } from "@/components/ui/checkbox";

const signupFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: "Debes aceptar el tratamiento de tus datos personales.",
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

export default function SignupPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { signup } = useAuth();
  const router = useRouter();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const handleSignup = async (values: SignupFormValues) => {
    setIsSubmitting(true);
    try {
      // Pass 'promoter' role to the signup function
      const result = await signup(values.email, values.password, values.name, 'promoter');
      if ("user" in result) { // UserCredential
        toast({
          title: "Registro de Promotor Exitoso",
          description: "Tu cuenta de Promotor ha sido creada. Por favor, inicia sesión.",
        });
        router.push("/login");
      } else { // AuthError
        const errorCode = (result as AuthError).code;
        let errorMessage = "Ocurrió un error durante el registro.";
        if (errorCode === "auth/email-already-in-use") {
          errorMessage = "Este email ya está registrado.";
        } else if (errorCode === "auth/invalid-email") {
          errorMessage = "El formato del email no es válido.";
        } else if (errorCode === "auth/weak-password") {
          errorMessage = "La contraseña es demasiado débil.";
        }
        toast({
          title: "Error de Registro",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Unexpected signup error", error);
      toast({
        title: "Error de Registro",
        description: "Ocurrió un error inesperado. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#f4eef7]">
      <Link
        href="/"
        className="z-10 absolute left-4 top-5 md:left-10 md:top-10 inline-flex items-center gap-2 text-[17px] md:text-[20px] font-semibold text-gradient bg-gradient-to-r from-purple-500 to-purple-700 text-transparent bg-clip-text hover:text-primary/80"
      >
        Volver al inicio
      </Link>

      <Card className="w-full max-w-md shadow-xl bg-white/90 backdrop-blur-sm rounded-xl">
        <CardHeader className="items-center text-center py-6">
          <div className="w-full flex justify-center mb-4">
            <SocioVipLogo size={96} />
          </div>
          <CardTitle className="text-3xl text-gradient bg-gradient-to-r from-purple-500 to-purple-700 text-transparent bg-clip-text">
            Crear Cuenta de Promotor
          </CardTitle>
          <CardDescription className="text-center">
            Únete a SocioVIP para empezar a promocionar eventos y locales.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignup)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Tu nombre completo"
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
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
                    <FormLabel>Contraseña</FormLabel>
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
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Contraseña</FormLabel>
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
              <FormField
                control={form.control}
                name="acceptTerms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Acepto el tratamiento de mis datos personales
                      </FormLabel>
                      <FormMessage />
                    </div>
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
                  "Registrar con Email"
                )}
              </Button>
            </form>
          </Form>

        </CardContent>
        <CardFooter className="flex-col items-center text-sm">
          <p className="text-muted-foreground">
            ¿Ya tienes una cuenta?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Inicia sesión aquí
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
