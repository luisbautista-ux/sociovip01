
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
import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Star, CheckCircle, CalendarIcon, Info } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, anyToDate } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import type { QrClient } from "@/lib/types";

// Schema for Step 1: DNI Verification
const dniEntrySchema = z.object({
  docType: z.enum(['dni', 'ce'], { required_error: "Debes seleccionar un tipo de documento." }),
  docNumber: z.string().min(8, "El documento debe tener al menos 8 dígitos.").max(15),
});
type DniEntryValues = z.infer<typeof dniEntrySchema>;

// Schema for Step 2: Full Registration Form
const signupFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  surname: z.string().min(2, "El apellido es requerido."),
  dni: z.string().min(8, "El DNI debe tener 8 dígitos.").max(15, "El DNI/CE es inválido."),
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
  const [step, setStep] = useState<'selection' | 'dniEntry' | 'form'>('selection');
  const [selectedPlan, setSelectedPlan] = useState<'gratis' | 'premium' | null>(null);
  const [verifiedDni, setVerifiedDni] = useState<string | null>(null);
  const { toast } = useToast();
  const { signup } = useAuth();
  const router = useRouter();

  const dniForm = useForm<DniEntryValues>({
    resolver: zodResolver(dniEntrySchema),
    defaultValues: { docType: 'dni', docNumber: "" },
  });
  const watchedDocType = dniForm.watch('docType');

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      name: "", surname: "", dni: "", phone: "", email: "", password: "", confirmPassword: "",
    },
  });

  const handleSelectPlan = (plan: 'gratis' | 'premium') => {
    if (plan === 'premium') {
        toast({ title: "Próximamente", description: "La membresía Premium estará disponible muy pronto." });
        return;
    }
    setSelectedPlan(plan);
    signupForm.setValue('plan', plan);
    setStep('dniEntry');
  };

  const handleDniVerification = async (values: DniEntryValues) => {
    setIsSubmitting(true);
    const dniToVerify = values.docNumber.trim();
    setVerifiedDni(dniToVerify);
    signupForm.setValue('dni', dniToVerify);

    try {
        const q = query(collection(db, "qrClients"), where("dni", "==", dniToVerify), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const clientData = querySnapshot.docs[0].data() as QrClient;
            signupForm.setValue('name', clientData.name);
            signupForm.setValue('surname', clientData.surname);
            signupForm.setValue('phone', clientData.phone);
            const dobDate = anyToDate(clientData.dob);
            if (dobDate) signupForm.setValue('dob', dobDate);
            toast({ title: "¡Te encontramos!", description: "Hemos rellenado tus datos. Por favor, confírmalos y completa tu registro." });
        } else {
            toast({ title: "Nuevo Socio", description: "No te encontramos en nuestra base de datos de clientes. Por favor, completa tu registro." });
            signupForm.reset({
                ...signupForm.getValues(),
                name: "", surname: "", phone: "", dob: undefined, email: "", password: "", confirmPassword: ""
            });
        }
        setStep('form');
    } catch (error) {
        toast({ title: "Error de Verificación", description: "No se pudo consultar la base de datos.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSignup = async (values: SignupFormValues) => {
    setIsSubmitting(true);
    const roleToAssign = values.plan === 'gratis' ? 'client_gratis' : 'vip_premium';
    
    try {
      const result = await signup(values.email, values.password, `${values.name} ${values.surname}`, roleToAssign, {
        dni: values.dni,
        phone: values.phone,
        dob: values.dob,
      });

      if ("user" in result) {
        toast({ title: "¡Bienvenido/a a SocioVIP!", description: "Tu cuenta ha sido creada. Ahora serás redirigido a tu panel." });
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

  const renderContent = () => {
    switch (step) {
      case 'selection':
        return (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Card para SocioVIP Estándar */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>SocioVIP Gratis</CardTitle>
                <CardDescription>Acceso a beneficios seleccionados.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-3 text-sm">
                <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5 shrink-0"/> <span>Genera QRs para promociones en restaurantes, salones de belleza, gimnasios y mucho más.</span></p>
                <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5 shrink-0"/> <span>Carnet de socio con QR único para acceso a eventos.</span></p>
                <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5 shrink-0"/> <span>Entérate de los mejores eventos y promociones.</span></p>
                <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5 shrink-0"/> <span>Acumula puntos con tus visitas y canjéalos.</span></p>
              </CardContent>
              <CardFooter>
                <Button onClick={() => handleSelectPlan('gratis')} variant="gradient" className="w-full">Registrarse Gratis</Button>
              </CardFooter>
            </Card>
            {/* Card para SocioVIP Premium */}
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
                <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-primary mt-0.5 shrink-0"/> <span className="font-bold">Acceso VIP y reservas preferenciales a locales.</span></p>
                <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-primary mt-0.5 shrink-0"/> <span className="font-bold">Regalos y descuentos de hasta 70% en consumos de negocios afiliados.</span></p>
                <p className="flex items-start"><CheckCircle className="h-4 w-4 mr-2 text-primary mt-0.5 shrink-0"/> <span>Invitación a eventos privados y exclusivos.</span></p>
              </CardContent>
              <CardFooter>
                <Button onClick={() => handleSelectPlan('premium')} className="w-full" disabled>Próximamente (S/ 9.99/mes)</Button>
              </CardFooter>
            </Card>
          </div>
        );
      case 'dniEntry':
        return (
          <div className="w-full max-w-sm mx-auto">
            <Form {...dniForm}>
              <form onSubmit={dniForm.handleSubmit(handleDniVerification)} className="space-y-4">
                <FormField control={dniForm.control} name="docType" render={({ field }) => (
                  <FormItem className="space-y-2"><FormLabel>Tipo de Documento</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={(value) => { field.onChange(value); dniForm.setValue('docNumber', ''); dniForm.clearErrors('docNumber'); }} defaultValue={field.value} className="grid grid-cols-2 gap-2">
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <Label htmlFor="docType-dni-signup" className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'dni' && "bg-primary text-primary-foreground border-primary")}>
                            <FormControl><RadioGroupItem value="dni" id="docType-dni-signup" className="sr-only" /></FormControl>DNI
                          </Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <Label htmlFor="docType-ce-signup" className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'ce' && "bg-primary text-primary-foreground border-primary")}>
                            <FormControl><RadioGroupItem value="ce" id="docType-ce-signup" className="sr-only" /></FormControl>Carnet Ext.
                          </Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                  <FormMessage /></FormItem>
                )}/>
                <FormField control={dniForm.control} name="docNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Documento</FormLabel>
                    <FormControl><Input placeholder={watchedDocType === 'dni' ? "8 dígitos" : "8-15 dígitos"} {...field} autoFocus maxLength={15} onChange={(e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar DNI"}
                </Button>
                <Button variant="link" size="sm" className="mt-2 text-muted-foreground w-full" onClick={() => setStep('selection')}>&larr; Volver a elegir plan</Button>
              </form>
            </Form>
          </div>
        );
      case 'form':
        return (
          <div className="w-full max-w-md mx-auto">
            <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                {/* DNI is pre-filled and disabled */}
                <FormField control={signupForm.control} name="dni" render={({ field }) => (
                  <FormItem><FormLabel>DNI</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={signupForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre(s)</FormLabel><FormControl><Input placeholder="Tu nombre" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )}/>
                 <FormField control={signupForm.control} name="surname" render={({ field }) => (
                  <FormItem><FormLabel>Apellido(s)</FormLabel><FormControl><Input placeholder="Tu apellido" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={signupForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Celular</FormLabel><FormControl><Input type="tel" placeholder="987654321" {...field} disabled={isSubmitting} maxLength={9} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={signupForm.control} name="dob" render={({ field }) => (
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
                <FormField control={signupForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="tu@email.com" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={signupForm.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={signupForm.control} name="confirmPassword" render={({ field }) => (
                  <FormItem><FormLabel>Confirmar Contraseña</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                )}/>
                <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Crear Mi Cuenta Gratis"}
                </Button>
              </form>
            </Form>
            <Button variant="link" size="sm" className="mt-4 text-muted-foreground w-full" onClick={() => setStep('dniEntry')}>&larr; Usar otro DNI</Button>
          </div>
        );
      default:
        return null;
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
                  {step === 'selection' ? "Elige tu Membresía" : (step === 'dniEntry' ? "Verifica tu Identidad" : "Completa tu Registro")}
              </CardTitle>
              <CardDescription>
                  {step === 'selection' 
                      ? "Únete a SocioVIP, genera tu carnet de socio y accede a beneficios exclusivos."
                      : (step === 'dniEntry' ? "Ingresa tu documento para empezar." : `Estás a un paso de ser SocioVIP ${selectedPlan === 'gratis' ? 'Gratis' : 'Premium'}.`)
                  }
              </CardDescription>
          </CardHeader>
          <CardContent>
              {renderContent()}
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

```