
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { AuthError } from "firebase/auth";
import { useRouter } from "next/navigation"; // Importar useRouter

const loginFormSchema = z.object({
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();
  const router = useRouter(); // Instanciar el router

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleLogin = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await login(values.email, values.password);
      if ("user" in result) { // UserCredential
        toast({
          title: "Inicio de Sesión Exitoso",
          description: "Bienvenido/a de nuevo. Redirigiendo...",
        });
        onOpenChange(false); // Cierra el modal
        form.reset(); // Limpia el formulario
        router.push("/auth/dispatcher"); // <<<--- CORRECCIÓN: Redirigir al dispatcher
      } else { // AuthError
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
    } catch (error) {
      console.error("Unexpected login error in modal", error);
      toast({
        title: "Error de Inicio de Sesión",
        description: "Ocurrió un error inesperado. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Iniciar Sesión</DialogTitle>
          <DialogDescription className="text-center">
            Accede a tu cuenta SocioVIP.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-6 py-4">
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
        <DialogFooter className="text-center text-sm flex-col items-center">
          <DialogClose asChild>
             <Button type="button" variant="ghost" className="mt-2 text-muted-foreground">Cancelar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
