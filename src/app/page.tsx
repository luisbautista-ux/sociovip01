
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { UserData, PromotionDetails, QrCodeData, QrCodeStatus } from "@/lib/types";
import Image from "next/image";
import { CheckCircle2, XCircle, BadgeCheck, Calendar as CalendarIcon, Ticket, User, Info, ScanLine, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SocioVipLogo } from "@/components/icons";


type Step = "enterCode" | "enterDni" | "newUserForm" | "displayQr";

const codeSchema = z.object({
  promoCode: z.string().length(9, "El código debe tener 9 caracteres.").regex(/^[A-Z0-9]{9}$/, "El código debe ser alfanumérico y en mayúsculas."),
});

const dniSchema = z.object({
  dni: z.string().min(8, "DNI/CE debe tener al menos 8 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
});

const newUserSchema = z.object({
  name: z.string().min(2, "Nombre es requerido."),
  surname: z.string().min(2, "Apellido es requerido."),
  phone: z.string().min(7, "Celular es requerido.").regex(/^\+?[0-9\s-()]*$/, "Número de celular inválido."),
  dob: z.date({ required_error: "Fecha de nacimiento es requerida." }),
  dniConfirm: z.string(), // DNI is pre-filled, user confirms
});

const mockPromotions: { [key: string]: PromotionDetails } = {
  "VALIDNEW1": { id: "promo1", title: "2x1 en Cocktails", description: "Disfruta de dos cocktails al precio de uno. Válido todos los martes.", validUntil: "2024-12-31" },
  "VALIDEXT1": { id: "promo2", title: "Entrada VIP Gratuita", description: "Acceso exclusivo a nuestra zona VIP este Sábado.", validUntil: "2024-11-30" },
};

const mockExistingUser: UserData = {
  id: "user123",
  name: "Ana",
  surname: "García",
  phone: "+51987654321",
  dob: "1990-05-15",
  dni: "12345678",
};

const statusTranslations: { [key in QrCodeStatus]: string } = {
  generated: "Generado",
  utilized: "Utilizado",
  expired: "Vencido",
};

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<Step>("enterCode");
  const [validatedCode, setValidatedCode] = useState<string | null>(null);
  const [enteredDni, setEnteredDni] = useState<string | null>(null);
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { promoCode: "" },
  });

  const dniForm = useForm<z.infer<typeof dniSchema>>({
    resolver: zodResolver(dniSchema),
    defaultValues: { dni: "" },
  });

  const newUserForm = useForm<z.infer<typeof newUserSchema>>({
    resolver: zodResolver(newUserSchema),
  });
  
  useEffect(() => {
    if (currentStep === 'newUserForm' && enteredDni) {
      newUserForm.setValue('dniConfirm', enteredDni);
    }
  }, [currentStep, enteredDni, newUserForm]);


  const handleCodeSubmit = async (values: z.infer<typeof codeSchema>) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);

    const code = values.promoCode.toUpperCase();
    if (code === "INVALIDC1") {
      toast({ title: "Error", description: "Código no válido.", variant: "destructive" });
    } else if (code === "EXPIREDCD") {
      toast({ title: "Error", description: "Código vencido.", variant: "destructive" });
    } else if (mockPromotions[code]) {
      setValidatedCode(code);
      setCurrentStep("enterDni");
      toast({ title: "Código Válido", description: "Por favor, ingresa tu número de DNI o carnet de extranjería." });
    } else {
       // Generic valid codes for testing
      if (code.startsWith("VALID")) {
        setValidatedCode(code);
        setCurrentStep("enterDni");
        toast({ title: "Código Válido", description: "Por favor, ingresa tu número de DNI o carnet de extranjería." });
      } else {
        toast({ title: "Error", description: "Código desconocido. Intenta con VALIDNEW1 o VALIDEXT1.", variant: "destructive" });
      }
    }
  };

  const handleDniSubmit = async (values: z.infer<typeof dniSchema>) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    
    setEnteredDni(values.dni);

    // Simulate DNI check
    if (values.dni === mockExistingUser.dni && validatedCode && mockPromotions[validatedCode]) {
      const promotion = mockPromotions[validatedCode];
      setQrData({
        user: mockExistingUser,
        promotion,
        qrImageUrl: `https://placehold.co/250x250.png?text=QR+${validatedCode}`,
        code: validatedCode,
        status: "generated",
      });
      setCurrentStep("displayQr");
      toast({ title: `Bienvenido ${mockExistingUser.name}!`, description: "Tu QR ha sido generado." });
    } else if (validatedCode && mockPromotions[validatedCode]) {
      setCurrentStep("newUserForm");
      newUserForm.setValue("dniConfirm", values.dni);
      toast({ title: "Nuevo Usuario", description: "Por favor, completa tus datos para generar tu QR." });
    } else {
      // Fallback if validatedCode or promotion is somehow lost (should not happen in normal flow)
      toast({ title: "Error", description: "Ha ocurrido un error. Por favor, intenta de nuevo.", variant: "destructive" });
      setCurrentStep("enterCode");
    }
  };

  const handleNewUserSubmit = async (values: z.infer<typeof newUserSchema>) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);

    if (!validatedCode || !enteredDni || !mockPromotions[validatedCode]) {
      toast({ title: "Error", description: "Información incompleta. Por favor, reinicia el proceso.", variant: "destructive" });
      setCurrentStep("enterCode");
      return;
    }
    
    const promotion = mockPromotions[validatedCode];
    const newUser: UserData = {
      id: `user-${Date.now()}`,
      name: values.name,
      surname: values.surname,
      phone: values.phone,
      dob: format(values.dob, "yyyy-MM-dd"), // Keep ISO format for storage
      dni: enteredDni,
    };

    setQrData({
      user: newUser,
      promotion,
      qrImageUrl: `https://placehold.co/250x250.png?text=QR+${validatedCode}`,
      code: validatedCode,
      status: "generated",
    });
    setCurrentStep("displayQr");
    toast({ title: `Bienvenido ${newUser.name}!`, description: "Tu QR ha sido generado con éxito." });
  };

  const resetFlow = () => {
    setCurrentStep("enterCode");
    setValidatedCode(null);
    setEnteredDni(null);
    setQrData(null);
    codeForm.reset();
    dniForm.reset();
    newUserForm.reset();
  };

  const renderStatusIcon = (status: QrCodeStatus) => {
    switch (status) {
      case "generated":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "utilized":
        return <BadgeCheck className="h-5 w-5 text-blue-500" />;
      case "expired":
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <header className="mb-8 flex flex-col items-center">
        <SocioVipLogo className="h-16 w-16 text-primary mb-2" />
        <h1 className="text-4xl font-bold text-primary">SocioVIP</h1>
        <p className="text-muted-foreground">Tu acceso a promociones exclusivas.</p>
      </header>

      <Card className="w-full max-w-md shadow-2xl">
        {currentStep === "enterCode" && (
          <>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Genera tu QR</CardTitle>
              <CardDescription className="text-center">Ingresa tu código promocional para obtener tu QR.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...codeForm}>
                <form onSubmit={codeForm.handleSubmit(handleCodeSubmit)} className="space-y-6">
                  <FormField
                    control={codeForm.control}
                    name="promoCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Promocional</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: VALIDNEW1" {...field} className="text-center text-lg tracking-widest" maxLength={9} />
                        </FormControl>
                        <FormDescription>El código tiene 9 caracteres alfanuméricos.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                    {isLoading ? "Validando..." : "Validar Código"} <ScanLine className="ml-2 h-5 w-5"/>
                  </Button>
                </form>
              </Form>
            </CardContent>
          </>
        )}

        {currentStep === "enterDni" && (
          <>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Verificación de Identidad</CardTitle>
              <CardDescription className="text-center">Ingresa tu DNI o Carnet de Extranjería.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...dniForm}>
                <form onSubmit={dniForm.handleSubmit(handleDniSubmit)} className="space-y-6">
                  <FormField
                    control={dniForm.control}
                    name="dni"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DNI / Carnet de Extranjería</FormLabel>
                        <FormControl>
                          <Input placeholder="Tu número de documento" {...field} className="text-center text-lg"/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                    {isLoading ? "Verificando..." : "Continuar"}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setCurrentStep("enterCode")}>Volver</Button>
                </form>
              </Form>
            </CardContent>
          </>
        )}
        
        {currentStep === "newUserForm" && (
           <Dialog open={true} onOpenChange={(isOpen) => !isOpen && setCurrentStep("enterDni")}>
            <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle className="text-2xl">Completa tus Datos</DialogTitle>
                <DialogDescription>
                  Es la primera vez que usas un código con este DNI. Por favor, completa tu información.
                </DialogDescription>
              </DialogHeader>
              <Form {...newUserForm}>
                <form onSubmit={newUserForm.handleSubmit(handleNewUserSubmit)} className="space-y-4">
                  <FormField
                    control={newUserForm.control}
                    name="dniConfirm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DNI / Carnet de Extranjería (Confirmar)</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-muted"/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={newUserForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre(s)</FormLabel>
                        <FormControl>
                          <Input placeholder="Tus nombres" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={newUserForm.control}
                    name="surname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido(s)</FormLabel>
                        <FormControl>
                          <Input placeholder="Tus apellidos" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={newUserForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Celular</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="Tu número de celular" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                      control={newUserForm.control}
                      name="dob"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Fecha de Nacimiento</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "d MMMM yyyy", { locale: es })
                                  ) : (
                                    <span>Selecciona una fecha</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                locale={es}
                                captionLayout="dropdown-buttons"
                                fromYear={1900}
                                toYear={new Date().getFullYear()}
                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  <DialogFooter className="pt-4">
                    <Button variant="outline" type="button" onClick={() => setCurrentStep("enterDni")}>Cancelar</Button>
                    <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                      {isLoading ? "Guardando..." : "Confirmar y Generar QR"} <Sparkles className="ml-2 h-4 w-4" />
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}


        {currentStep === "displayQr" && qrData && (
          <>
            <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
              <CardTitle className="text-3xl text-center">¡Bienvenido, {qrData.user.name}!</CardTitle>
              <CardDescription className="text-center text-primary-foreground/80">Tu QR para "{qrData.promotion.title}" está listo.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex justify-center">
                <Image
                  src={qrData.qrImageUrl}
                  alt="QR Code"
                  width={250}
                  height={250}
                  className="rounded-lg shadow-lg border-4 border-primary"
                  data-ai-hint="qr code"
                />
              </div>
              
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-primary flex items-center"><Ticket className="mr-2 h-5 w-5"/> Detalles de la Promoción</h3>
                <p><strong className="font-medium">Título:</strong> {qrData.promotion.title}</p>
                <p><strong className="font-medium">Descripción:</strong> {qrData.promotion.description}</p>
                <p className="flex items-center"><CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground"/> <strong className="font-medium">Válido hasta:</strong> {format(new Date(qrData.promotion.validUntil), "d MMMM yyyy", { locale: es })}</p>
                <p className="flex items-center">
                  {renderStatusIcon(qrData.status)}
                  <strong className="font-medium ml-2">Estado:</strong> <span className="ml-1">{statusTranslations[qrData.status]}</span>
                </p>
              </div>

              <div className="space-y-2 border-t pt-4">
                <h3 className="text-lg font-semibold text-primary flex items-center"><User className="mr-2 h-5 w-5"/> Tus Datos</h3>
                <p><strong className="font-medium">Nombre Completo:</strong> {qrData.user.name} {qrData.user.surname}</p>
                <p><strong className="font-medium">DNI/CE:</strong> {qrData.user.dni}</p>
              </div>

              <div className="text-sm text-muted-foreground p-3 bg-secondary rounded-md flex items-start">
                <Info className="h-5 w-5 mr-2 mt-0.5 shrink-0"/>
                <span>Presenta este QR en el establecimiento para validar tu promoción. Recuerda que este código es personal e intransferible.</span>
              </div>

            </CardContent>
            <CardFooter>
              <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={resetFlow}>
                Generar Otro Código
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} SocioVIP. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
    

      