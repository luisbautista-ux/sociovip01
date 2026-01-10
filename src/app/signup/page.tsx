

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
import { Loader2, ArrowLeft, Star, CheckCircle, CalendarIcon, Info, AlertTriangle } from "lucide-react";
import { SocioVipLogo, GoogleIcon } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const dniEntrySchema = z.object({
  docType: z.enum(['dni', 'ce'], { required_error: "Debes seleccionar un tipo de documento." }),
  docNumber: z.string().min(8, "El documento debe tener al menos 8 dígitos.").max(15),
});
type DniEntryValues = z.infer<typeof dniEntrySchema>;

const signupFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  surname: z.string().min(2, { message: "El apellido es requerido." }),
  dni: z.string().min(8, "El DNI debe tener 8 dígitos.").max(15, "El DNI/CE es inválido."),
  phone: z.string().regex(/^9\d{8}$/, "El celular debe tener 9 dígitos y empezar con 9.").optional().or(z.literal("")),
  dob: z.date({ required_error: "La fecha de nacimiento es requerida."}),
});
type SignupFormValues = z.infer<typeof signupFormSchema>;

export default function SignupPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'selection' | 'dniEntry' | 'form'>('selection');
  const [selectedPlan, setSelectedPlan] = useState<'gratis' | 'premium' | null>(null);
  const [showUserExistsAlert, setShowUserExistsAlert] = useState(false);
  const { toast } = useToast();
  const { signupWithGoogle } = useAuth();
  const router = useRouter();

  const dniForm = useForm<DniEntryValues>({
    resolver: zodResolver(dniEntrySchema),
    defaultValues: { docType: 'dni', docNumber: "" },
  });
  const watchedDocType = dniForm.watch('docType');

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      name: "", surname: "", dni: "", phone: "",
    },
  });

  const handleSelectPlan = (plan: 'gratis' | 'premium') => {
    if (plan === 'premium') {
        toast({ title: "Próximamente", description: "La membresía Premium estará disponible muy pronto." });
        return;
    }
    setSelectedPlan(plan);
    setStep('dniEntry');
  };

  const handleDniVerification = async (values: DniEntryValues) => {
    setIsSubmitting(true);
    const docNumber = values.docNumber.trim();
    signupForm.setValue('dni', docNumber);

    try {
        const response = await fetch('/api/public/consult-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni: docNumber, docType: values.docType }),
        });
        const data = await response.json();

        if (response.ok) {
            if (data.isPlatformUser) {
                setShowUserExistsAlert(true);
                return;
            }

            let toastTitle = "Nuevo Socio";
            let toastDescription = "Por favor, completa tu registro.";

            if (data.source !== 'not_found') {
                toastTitle = data.source === 'internal' ? "¡Te encontramos!" : "Datos Encontrados";
                toastDescription = "Hemos rellenado tus datos. Por favor, confírmalos y completa tu registro.";

                const fullName = data.nombreCompleto || "";
                const nameParts = fullName.split(' ');
                const surname = nameParts.length > 2 ? nameParts.slice(-2).join(' ') : nameParts.slice(1).join(' ');
                const name = nameParts.length > 2 ? nameParts.slice(0, -2).join(' ') : nameParts[0] || '';

                signupForm.setValue('name', name);
                signupForm.setValue('surname', surname);
                if (data.phone) signupForm.setValue('phone', data.phone);
                
                if (data.fechaNacimiento) {
                    const parsedDate = parse(data.fechaNacimiento, 'dd/MM/yyyy', new Date());
                    if (!isNaN(parsedDate.getTime())) {
                        signupForm.setValue('dob', parsedDate);
                    }
                }
            } else {
                 signupForm.reset({
                    ...signupForm.getValues(),
                    dni: docNumber,
                    name: "", surname: "", phone: "", dob: undefined
                });
            }
            toast({ title: toastTitle, description: toastDescription });
            setStep('form');
        } else {
            throw new Error(data.error || "No se pudo verificar el documento.");
        }
    } catch (error: any) {
        toast({ title: "Error de Verificación", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleSignupWithGoogle = async () => {
    const isValid = await signupForm.trigger();
    if (!isValid) {
      toast({
        title: "Campos incompletos",
        description: "Por favor, revisa y completa todos los campos requeridos.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const values = signupForm.getValues();
    
    try {
      const result = await signupWithGoogle('client_gratis', {
        dni: values.dni,
        phone: values.phone || "",
        dob: values.dob,
        overrideName: `${values.name} ${values.surname}`.trim()
      });

      if ("user" in result) {
        toast({ title: "¡Bienvenido/a a SocioVIP!", description: "Tu cuenta ha sido creada. Ahora serás redirigido a tu panel." });
        router.push("/auth/dispatcher");
      } else {
        const errorCode = result.code;
        let errorMessage = "Ocurrió un error durante el registro.";
        if (errorCode === "auth/email-already-in-use" || errorCode === 'auth/credential-already-in-use') {
          errorMessage = "Este email ya está en uso por otro usuario. Por favor, intenta iniciar sesión.";
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
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>SocioVIP Gratis</CardTitle>
                <CardDescription>Genera tu carnet de socio y accede a beneficios exclusivos en toda nuestra red de locales afiliados.</CardDescription>
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
            <Card className="flex flex-col border-primary border-2 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-full flex items-center">
                <Star className="h-3 w-3 mr-1.5"/> MÁS POPULAR
              </div>
              <CardHeader>
                <CardTitle>SocioVIP Premium</CardTitle>
                <CardDescription>Acceso ilimitado a toda la red de locales afiliados, beneficios y descuentos exclusivos para socios premium.</CardDescription>
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
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar Documento"}
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
              <form onSubmit={signupForm.handleSubmit(handleSignupWithGoogle)} className="space-y-4">
                <FormField control={signupForm.control} name="dni" render={({ field }) => (
                  <FormItem><FormLabel>DNI/CE</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                )}/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={signupForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre(s)</FormLabel><FormControl><Input placeholder="Tu nombre" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={signupForm.control} name="surname" render={({ field }) => (
                    <FormItem><FormLabel>Apellido(s)</FormLabel><FormControl><Input placeholder="Tu apellido" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                  )}/>
                </div>
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
                
                <Button type="button" onClick={handleSignupWithGoogle} variant="gradient" className="w-full flex items-center" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon className="mr-2 h-5 w-5" />}
                  Continuar y Registrarse con Google
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
    <>
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
    <AlertDialog open={showUserExistsAlert} onOpenChange={setShowUserExistsAlert}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center"><AlertTriangle className="h-6 w-6 text-yellow-500 mr-2"/> ¡Este DNI ya tiene una cuenta!</AlertDialogTitle>
                <AlertDialogDescription>
                    El documento que ingresaste ya está registrado en nuestra plataforma. No es necesario crear una nueva cuenta.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowUserExistsAlert(false)}>Volver</AlertDialogCancel>
                <AlertDialogAction onClick={() => router.push('/login')} className="bg-primary hover:bg-primary/90">
                    Ir a Iniciar Sesión
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
