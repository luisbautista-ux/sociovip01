
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
import { Loader2, ArrowLeft, Star, CheckCircle, CalendarIcon } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const signupFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  dni: z.string().min(8, { message: "El DNI debe tener 8 dígitos." }).max(8, "El DNI debe tener 8 dígitos."),
  phone: z.string().regex(/^9\d{8}$/, "El celular debe tener 9 dígitos y empezar con 9."),
  dob: z.date({ required_error: "La fecha de nacimiento es requerida."}),
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
  confirmPassword: z.string(),
  plan: z.enum(['gratis', 'premium'], { required_error: "Debes seleccionar un plan." }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

export default function SignupPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'selection' | 'form'>('selection');
  const [selectedPlan, setSelectedPlan] = useState<'gratis' | 'premium' | null>(null);
  const { toast } = useToast();
  const { signup } = useAuth();
  const router = useRouter();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      name: "",
      dni: "",
      phone: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleSelectPlan = (plan: 'gratis' | 'premium') => {
    if (plan === 'premium') {
        toast({
            title: "Próximamente",
            description: "La membresía Premium estará disponible muy pronto. ¡Gracias por tu interés!",
        });
        return;
    }
    setSelectedPlan(plan);
    form.setValue('plan', plan);
    setStep('form');
  };

  const handleSignup = async (values: SignupFormValues) => {
    setIsSubmitting(true);
    const roleToAssign = values.plan === 'gratis' ? 'client_gratis' : 'vip_premium';
    
    try {
      const result = await signup(values.email, values.password, values.name, roleToAssign, {
        dni: values.dni,
        phone: values.phone,
        dob: values.dob,
      });

      if ("user" in result) {
        toast({
          title: "¡Bienvenido/a a SocioVIP!",
          description: "Tu cuenta ha sido creada. Ahora serás redirigido a tu panel.",
        });
        router.push("/auth/dispatcher");
      } else {
        const errorCode = result.code;
        let errorMessage = "Ocurrió un error durante el registro.";
        if (errorCode === "auth/email-already-in-use") {
          errorMessage = "Este email ya está en uso. Por favor, intenta iniciar sesión.";
        }
        toast({ title: "Error de Registro", description: errorMessage, variant: "destructive" });
      }
    } catch (error) {
      console.error("Unexpected signup error", error);
      toast({ title: "Error de Registro", description: "Ocurrió un error inesperado.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="relative min-h-screen bg-[#f4eef7] p-4 flex flex-col items-center justify-center">
        <Link href="/" className="absolute top-4 left-4 z-10 text-sm font-semibold text-purple-800 hover:text-purple-600 transition-colors flex items-center">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver al inicio
        </Link>
      
      <div className="w-full max-w-4xl mx-auto py-12">
        <Card className="w-full shadow-xl bg-white/90 backdrop-blur-sm rounded-xl">
          <CardHeader className="text-center py-6">
              <div className="w-full flex justify-center mb-4"><SocioVipLogo size={96} /></div>
              <CardTitle className="text-3xl text-gradient bg-gradient-to-r from-purple-800 to-red-600 text-transparent bg-clip-text">
                  {step === 'selection' ? "Elige tu Membresía" : "Completa tu Registro"}
              </CardTitle>
              <CardDescription>
                  {step === 'selection' 
                      ? "Únete a la comunidad SocioVIP y accede a beneficios exclusivos."
                      : `Estás a un paso de ser SocioVIP ${selectedPlan === 'gratis' ? 'Gratis' : 'Premium'}.`
                  }
              </CardDescription>
          </CardHeader>
          <CardContent>
              {step === 'selection' ? (
                  <div className="grid md:grid-cols-2 gap-8">
                      <Card className="flex flex-col">
                          <CardHeader>
                              <CardTitle>SocioVIP Gratis</CardTitle>
                              <CardDescription>Acceso a beneficios seleccionados.</CardDescription>
                          </CardHeader>
                          <CardContent className="flex-grow space-y-3 text-sm">
                              <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5 shrink-0"/> <span>Genera QRs para promociones en negocios asignados.</span></p>
                              <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5 shrink-0"/> <span>Tu propio QR Fijo para un acceso rápido.</span></p>
                              <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5 shrink-0"/> <span>Entérate de los mejores eventos y ofertas.</span></p>
                          </CardContent>
                          <CardFooter>
                              <Button onClick={() => handleSelectPlan('gratis')} variant="gradient" className="w-full">Registrarse Gratis</Button>
                          </CardFooter>
                      </Card>
                      <Card className="flex flex-col border-primary border-2 relative">
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-full flex items-center">
                              <Star className="h-3 w-3 mr-1.5"/> MÁS POPULAR
                          </div>
                          <CardHeader>
                              <CardTitle>SocioVIP Premium</CardTitle>
                              <CardDescription>La experiencia completa sin límites.</CardDescription>
                          </CardHeader>
                          <CardContent className="flex-grow space-y-3 text-sm">
                              <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-primary mt-0.5 shrink-0"/> <span>Todos los beneficios del plan gratuito.</span></p>
                              <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-primary mt-0.5 shrink-0"/> <span className="font-bold">Acceso a TODOS los negocios de la red.</span></p>
                              <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-primary mt-0.5 shrink-0"/> <span className="font-bold">Descuentos y promociones exclusivas para miembros.</span></p>
                              <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-primary mt-0.5 shrink-0"/> <span>Acumula puntos con tus visitas y canjéalos.</span></p>
                          </CardContent>
                          <CardFooter>
                              <Button onClick={() => handleSelectPlan('premium')} className="w-full" disabled>Próximamente (S/ 9.99/mes)</Button>
                          </CardFooter>
                      </Card>
                  </div>
              ) : (
                  <div className="w-full max-w-md mx-auto">
                      <Form {...form}>
                          <form onSubmit={form.handleSubmit(handleSignup)} className="space-y-4">
                          <FormField control={form.control} name="name" render={({ field }) => (
                              <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input placeholder="Tu nombre y apellido" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <FormField control={form.control} name="dni" render={({ field }) => (
                              <FormItem><FormLabel>DNI</FormLabel><FormControl><Input placeholder="Tu número de DNI" {...field} disabled={isSubmitting} maxLength={8} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <FormField control={form.control} name="phone" render={({ field }) => (
                              <FormItem><FormLabel>Celular</FormLabel><FormControl><Input type="tel" placeholder="987654321" {...field} disabled={isSubmitting} maxLength={9} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <FormField control={form.control} name="dob" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Fecha de Nacimiento</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>
                                      {field.value ? format(field.value, "d 'de' MMMM, yyyy", { locale: es }) : <span>Selecciona tu fecha</span>}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={1920} toYear={new Date().getFullYear() - 18} disabled={(date) => date > new Date(new Date().setFullYear(new Date().getFullYear() - 18))} locale={es} initialFocus />
                                </PopoverContent>
                              </Popover><FormMessage />
                            </FormItem>
                          )}/>
                          <FormField control={form.control} name="email" render={({ field }) => (
                              <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="tu@email.com" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <FormField control={form.control} name="password" render={({ field }) => (
                              <FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                              <FormItem><FormLabel>Confirmar Contraseña</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
                              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Crear Mi Cuenta Gratis"}
                          </Button>
                          </form>
                      </Form>
                       <Button variant="link" size="sm" className="mt-4 text-muted-foreground" onClick={() => setStep('selection')}>&larr; Volver a elegir plan</Button>
                  </div>
              )}
          </CardContent>
           <CardFooter className="flex-col items-center text-sm pt-6">
              <p className="text-muted-foreground">
                  ¿Ya tienes una cuenta?{" "}
                  <Link href="/login" className="font-medium text-primary hover:underline">
                  Inicia sesión aquí
                  </Link>
              </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
