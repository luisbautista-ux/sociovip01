
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { QrClient, PromotionDetails, QrCodeData, NewQrClientFormData } from "@/lib/types";
import Image from "next/image";
import QRCode from 'qrcode';
import { CheckCircle2, XCircle, BadgeCheck, Calendar as CalendarIcon, Ticket, User, Info, ScanLine, Sparkles, Download, Gift, Crown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SocioVipLogo } from "@/components/icons";
import { GENERATED_CODE_STATUS_TRANSLATIONS } from "@/lib/constants";


type PageViewState = "promotionsList" | "qrDisplay";
type ModalStep = "enterDni" | "newQrClientForm";

const promoCodeEntrySchema = z.object({
  promoCode: z.string().length(9, "El código debe tener 9 caracteres.").regex(/^[A-Z0-9]{9}$/, "El código debe ser alfanumérico y en mayúsculas."),
});

const dniSchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
});

const newQrClientSchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
  name: z.string().min(2, "Nombre es requerido."),
  surname: z.string().min(2, "Apellido es requerido."),
  phone: z.string().min(7, "Celular es requerido.").regex(/^\+?[0-9\s-()]*$/, "Número de celular inválido."),
  dob: z.date({ required_error: "Fecha de nacimiento es requerida." }),
});


const MOCK_PROMOTIONS: PromotionDetails[] = [
  {
    id: "promo1",
    title: "Martes de 2x1 en Cocktails",
    description: "Disfruta de dos cocktails al precio de uno. Válido todos los martes.",
    validUntil: "2025-12-31T12:00:00",
    promoCode: "VALIDNEW1",
    imageUrl: "https://placehold.co/600x400.png",
    aiHint: "cocktails party",
    type: "promotion",
    termsAndConditions: "Válido para cocktails seleccionados. No acumulable con otras promociones. Máximo 2 promociones por mesa."
  },
  {
    id: "promo2",
    title: "Sábado VIP: Entrada Gratuita",
    description: "Acceso exclusivo a nuestra zona VIP este Sábado. ¡No te lo pierdas!",
    validUntil: "2025-11-30T12:00:00",
    promoCode: "VALIDEXT1",
    imageUrl: "https://placehold.co/600x400.png",
    aiHint: "vip club",
    type: "event",
    termsAndConditions: "Presentar este QR en puerta. Aforo limitado. Dress code: Elegante."
  },
  {
    id: "promo3",
    title: "Noche de Salsa: Mojito Gratis",
    description: "Ven a bailar y te regalamos un mojito con tu entrada.",
    validUntil: "2025-10-31T12:00:00",
    promoCode: "SALSACOOL",
    imageUrl: "https://placehold.co/600x400.png",
    aiHint: "salsa dancing",
    type: "promotion",
    termsAndConditions: "Un mojito gratis por persona al presentar este QR y pagar entrada al evento de salsa."
  },
];

const mockExistingQrClient: QrClient = {
  id: "qrclient123",
  name: "Ana",
  surname: "García",
  phone: "+51987654321",
  dob: "1990-05-15T12:00:00",
  dni: "12345678",
  registrationDate: "2025-01-10T10:00:00Z"
};


export default function HomePage() {
  const [pageViewState, setPageViewState] = useState<PageViewState>("promotionsList");
  const [showDniModal, setShowDniModal] = useState(false);
  const [currentStepInModal, setCurrentStepInModal] = useState<ModalStep>("enterDni");
  const [activePromotion, setActivePromotion] = useState<PromotionDetails | null>(null);
  const [validatedPromoCode, setValidatedPromoCode] = useState<string | null>(null);
  const [enteredDniOriginal, setEnteredDniOriginal] = useState<string | null>(null);
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string | null>(null);
  const [showDniExistsWarningDialog, setShowDniExistsWarningDialog] = useState(false);
  const [formDataForDniWarning, setFormDataForDniWarning] = useState<NewQrClientFormData | null>(null);


  const dniForm = useForm<z.infer<typeof dniSchema>>({
    resolver: zodResolver(dniSchema),
    defaultValues: { dni: "" },
  });

  const newQrClientForm = useForm<NewQrClientFormData>({
    resolver: zodResolver(newQrClientSchema),
    defaultValues: {
      dni: "",
      name: "",
      surname: "",
      phone: "",
      dob: undefined,
    }
  });

  useEffect(() => {
    if (pageViewState === 'qrDisplay' && qrData && qrData.code) {
      QRCode.toDataURL(qrData.code, { width: 250, errorCorrectionLevel: 'H', margin: 2 })
        .then(url => {
          setGeneratedQrDataUrl(url);
        })
        .catch(err => {
          console.error("Failed to generate QR code", err);
          setGeneratedQrDataUrl(null);
          toast({ title: "Error al generar QR", description: "No se pudo generar el código QR.", variant: "destructive" });
        });
    } else {
      setGeneratedQrDataUrl(null); 
    }
  }, [qrData, pageViewState, toast]);


  useEffect(() => {
    if (currentStepInModal === 'newQrClientForm' && enteredDniOriginal) {
      const currentDniInForm = newQrClientForm.getValues('dni');
      if (currentDniInForm !== enteredDniOriginal || !newQrClientForm.getValues('name')) {
        newQrClientForm.reset({
          dni: enteredDniOriginal,
          name: "",
          surname: "",
          phone: "",
          dob: undefined,
        });
      }
    }
  }, [currentStepInModal, enteredDniOriginal, newQrClientForm]);

  const handleValidateAndShowDniModal = (promoCodeValue: string, promotion: PromotionDetails) => {
    const code = promoCodeValue.toUpperCase();
    if (code === promotion.promoCode) {
      setActivePromotion(promotion);
      setValidatedPromoCode(code);
      setCurrentStepInModal("enterDni");
      dniForm.reset();
      setShowDniModal(true);
      toast({ title: "Código Válido", description: `Para ${promotion.type === 'event' ? 'la entrada al evento' : 'la promoción'}: "${promotion.title}". Ingresa tu DNI.` });
    } else {
      toast({ title: "Error", description: "El código ingresado no es válido para esta promoción.", variant: "destructive" });
    }
  };

  const handleDniSubmitInModal = async (values: z.infer<typeof dniSchema>) => {
    if (!activePromotion || !validatedPromoCode) return;
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    setIsLoading(false);

    setEnteredDniOriginal(values.dni);

    // TODO: Replace with actual API call to check DNI and fetch user data if exists
    // For now, use mockExistingQrClient
    if (values.dni === mockExistingQrClient.dni) {
      const newQrData: QrCodeData = {
        user: mockExistingQrClient,
        promotion: activePromotion,
        code: validatedPromoCode, 
        status: "available",
      };
      setQrData(newQrData);
      setShowDniModal(false);
      setPageViewState("qrDisplay");
      toast({ title: `¡Bienvenido de vuelta ${mockExistingQrClient.name}!`, description: "Tu QR ha sido generado." });
    } else {
      setCurrentStepInModal("newQrClientForm");
      newQrClientForm.reset({ 
        dni: values.dni,
        name: "", surname: "", phone: "", dob: undefined,
      });
      toast({ title: "Nuevo Usuario", description: "Por favor, completa tus datos para generar tu QR." });
    }
  };

  const processNewQrClientRegistration = (qrClientData: QrClient) => {
    if (!activePromotion || !validatedPromoCode) return;

    const newQrData: QrCodeData = {
      user: qrClientData,
      promotion: activePromotion,
      code: validatedPromoCode, 
      status: "available",
    };
    setQrData(newQrData);
    setShowDniModal(false);
    setPageViewState("qrDisplay");
    toast({ title: `¡Bienvenido ${qrClientData.name}!`, description: "Tu QR ha sido generado con éxito." });
  }

  const handleNewQrClientSubmitInModal = async (values: NewQrClientFormData) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    setIsLoading(false);

    if (values.dni === mockExistingQrClient.dni && values.dni !== enteredDniOriginal) {
      setFormDataForDniWarning(values); 
      setShowDniExistsWarningDialog(true);
      return; 
    }

    const newQrClient: QrClient = {
      id: `qrclient-${Date.now()}`, 
      name: values.name,
      surname: values.surname,
      phone: values.phone,
      dob: format(values.dob, "yyyy-MM-dd'T'HH:mm:ss"),
      dni: values.dni,
      registrationDate: new Date().toISOString(),
    };
    processNewQrClientRegistration(newQrClient);
  };

  const handleDniExistsConfirmation = (confirmed: boolean) => {
    setShowDniExistsWarningDialog(false);
    if (confirmed && formDataForDniWarning) {
      newQrClientForm.reset({
        dni: mockExistingQrClient.dni,
        name: mockExistingQrClient.name,
        surname: mockExistingQrClient.surname,
        phone: mockExistingQrClient.phone,
        dob: typeof mockExistingQrClient.dob === 'string' ? parseISO(mockExistingQrClient.dob) : mockExistingQrClient.dob as Date,
      });
      toast({ title: "Datos Precargados", description: "Hemos rellenado el formulario con tus datos existentes. Revisa y confirma." });
    } else if (!confirmed && formDataForDniWarning) {
       newQrClientForm.reset(formDataForDniWarning);
    }
    setFormDataForDniWarning(null); 
  };

  const resetProcess = () => {
    setPageViewState("promotionsList");
    setShowDniModal(false);
    setActivePromotion(null);
    setValidatedPromoCode(null);
    setEnteredDniOriginal(null);
    setQrData(null);
    setGeneratedQrDataUrl(null);
    dniForm.reset();
    newQrClientForm.reset();
  };

  const handleCloseDniModal = () => {
    setShowDniModal(false);
    dniForm.reset();
    newQrClientForm.reset(); 
    setEnteredDniOriginal(null); 
  }

  const renderStatusIcon = (status: QrCodeData['status']) => {
    switch (status) {
      case "available": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "redeemed": return <BadgeCheck className="h-5 w-5 text-blue-500" />;
      case "expired": return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const handleSaveQrWithDetails = async () => {
    if (!qrData || !generatedQrDataUrl || !activePromotion) {
      toast({ title: "Error", description: "No hay datos de QR para guardar.", variant: "destructive" });
      return;
    }

    const businessName = "Pandora Lounge Bar"; 
    const businessLogoUrl = "https://placehold.co/120x40.png"; 

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast({ title: "Error", description: "No se pudo generar la imagen.", variant: "destructive" });
      return;
    }

    const canvasWidth = 320; 
    const padding = 20;
    const lineHeightMultiplier = 1.3;

    const headerColor = 'hsl(283, 44%, 53%)'; 
    const headerTextColor = 'hsl(0, 0%, 98%)';  
    const primaryTextColor = 'hsl(283, 44%, 53%)'; 
    const defaultTextColor = 'hsl(0, 0%, 3.9%)';  
    const mutedTextColor = 'hsl(0, 0%, 45.1%)';   
    const canvasBackgroundColor = 'hsl(280, 13%, 96%)';

    const maxLogoHeight = 50; 
    const logoNameSpacing = 5; // Reduced space
    const spacingAfterLogo = 20; // Increased space after logo block
    const businessNameFontSize = 14;
    const headerBottomMargin = 15; // Reduced margin after header block
    
    const promoTitleFontSize = 18;
    const spacingAfterBusinessName = 40; // Increased space after business name block to promo title

    const qrDisplaySize = 180; 
    const qrBorderColor = primaryTextColor;
    const qrBorderWidth = 2;
    const qrTopSpacing = 10; // Reduced space above QR
    const qrBottomSpacing = 20; // Increased space below QR

    const userNameFontSize = 22;
    const dniFontSize = 13;
    const detailsTextFontSize = 13;
    const termsTextFontSize = 10; 

    const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number, fontWeight: string, color: string, textAlign: CanvasTextAlign = 'center', fontName: string = 'Arial'): { endY: number, lines: number } => {
        ctx.font = `${fontWeight} ${fontSize}px ${fontName}`;
        ctx.fillStyle = color;
        ctx.textAlign = textAlign;
        const words = text.split(' ');
        let line = '';
        let currentYPos = y;
        const actualLineHeight = fontSize * lineHeightMultiplier;
        let lineCount = 0;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line.trim(), x, currentYPos);
                line = words[n] + ' ';
                currentYPos += actualLineHeight;
                lineCount++;
            } else {
                line = testLine;
            }
        }
        if (line.trim().length > 0) {
            ctx.fillText(line.trim(), x, currentYPos);
            lineCount++;
        }
        return { endY: currentYPos + (lineCount > 0 ? actualLineHeight : 0), lines: lineCount };
    };

    const businessLogoImg = new window.Image();
    businessLogoImg.crossOrigin = "anonymous";
    const qrImg = new window.Image();
    qrImg.crossOrigin = "anonymous";

    qrImg.onload = () => {
        businessLogoImg.onload = () => {
            let actualLogoHeight = 0;
            let actualLogoWidth = 0;
            if (businessLogoImg.naturalWidth > 0 && businessLogoImg.naturalHeight > 0) {
                const aspectRatio = businessLogoImg.naturalWidth / businessLogoImg.naturalHeight;
                actualLogoHeight = maxLogoHeight;
                actualLogoWidth = actualLogoHeight * aspectRatio;
                if (actualLogoWidth > canvasWidth - 2 * padding) {
                    actualLogoWidth = canvasWidth - 2 * padding;
                    actualLogoHeight = actualLogoWidth / aspectRatio;
                }
            }
            
            const headerBackgroundHeight = padding + actualLogoHeight + (actualLogoHeight > 0 ? spacingAfterLogo : 0) + (businessNameFontSize * lineHeightMultiplier) + padding - 15;

            let calculatedHeight = headerBackgroundHeight;
            calculatedHeight += spacingAfterBusinessName;

            const tempCtx = document.createElement('canvas').getContext('2d')!;
            const promoTitleMetrics = drawWrappedText(activePromotion.title, 0, 0, canvasWidth - 2 * padding, promoTitleFontSize, 'bold', 'transparent', 'center');
            calculatedHeight += (promoTitleMetrics.lines * promoTitleFontSize * lineHeightMultiplier);
            calculatedHeight += qrTopSpacing;

            calculatedHeight += qrDisplaySize + qrBorderWidth * 2;
            calculatedHeight += qrBottomSpacing; 

            calculatedHeight += userNameFontSize * lineHeightMultiplier;
            calculatedHeight += 5; 
            calculatedHeight += dniFontSize * lineHeightMultiplier;
            calculatedHeight += 15; 

            const validUntilMetrics = drawWrappedText("Válido hasta: ...", 0, 0, canvasWidth - 2 * padding, detailsTextFontSize, 'normal', 'transparent');
            calculatedHeight += (validUntilMetrics.lines * detailsTextFontSize * lineHeightMultiplier);
            calculatedHeight += 10;

            if (activePromotion.termsAndConditions) {
                const termsMetrics = drawWrappedText(`Términos: ${activePromotion.termsAndConditions}`, 0, 0, canvasWidth - 2 * padding - 10, termsTextFontSize, 'normal', 'transparent');
                calculatedHeight += (termsMetrics.lines * termsTextFontSize * lineHeightMultiplier);
            }
            calculatedHeight += padding;

            canvas.width = canvasWidth;
            canvas.height = Math.ceil(calculatedHeight);

            ctx.fillStyle = canvasBackgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = headerColor;
            ctx.fillRect(0, 0, canvas.width, headerBackgroundHeight);

            let currentY = padding;

            if (actualLogoWidth > 0 && actualLogoHeight > 0) {
                const logoX = (canvas.width - actualLogoWidth) / 2;
                ctx.drawImage(businessLogoImg, logoX, currentY, actualLogoWidth, actualLogoHeight);
                currentY += actualLogoHeight + spacingAfterLogo;
            } else {
                currentY += maxLogoHeight + spacingAfterLogo; 
            }
            
            currentY = drawWrappedText(businessName, canvas.width / 2, currentY, canvas.width - 2 * padding, businessNameFontSize, 'normal', headerTextColor, 'center').endY;
            
            currentY = headerBackgroundHeight + spacingAfterBusinessName;

            currentY = drawWrappedText(activePromotion.title, canvas.width / 2, currentY, canvas.width - 2 * padding, promoTitleFontSize, 'bold', primaryTextColor, 'center').endY;
            currentY += qrTopSpacing;

            const qrX = (canvas.width - qrDisplaySize) / 2;
            const qrY = currentY;
            ctx.drawImage(qrImg, qrX, qrY, qrDisplaySize, qrDisplaySize);
            ctx.strokeStyle = qrBorderColor;
            ctx.lineWidth = qrBorderWidth;
            ctx.strokeRect(qrX - qrBorderWidth / 2, qrY - qrBorderWidth / 2, qrDisplaySize + qrBorderWidth, qrDisplaySize + qrBorderWidth);
            currentY += qrDisplaySize + qrBorderWidth * 2 + qrBottomSpacing;

            currentY = drawWrappedText(`${qrData.user.name} ${qrData.user.surname}`, canvas.width / 2, currentY, canvas.width - 2 * padding, userNameFontSize, 'bold', primaryTextColor, 'center').endY;
            currentY += 5; 
            currentY = drawWrappedText(`DNI/CE: ${qrData.user.dni}`, canvas.width / 2, currentY, canvas.width - 2 * padding, dniFontSize, 'normal', defaultTextColor, 'center').endY;
            currentY += 15;

            currentY = drawWrappedText(`Válido hasta: ${format(parseISO(activePromotion.validUntil), "d MMMM yyyy", { locale: es })}`, canvas.width / 2, currentY, canvas.width - 2 * padding, detailsTextFontSize, 'normal', mutedTextColor, 'center').endY;
            currentY += 10;

            if (activePromotion.termsAndConditions) {
              drawWrappedText(`Términos: ${activePromotion.termsAndConditions}`, canvas.width / 2, currentY, canvas.width - 2 * padding - 10, termsTextFontSize, 'normal', mutedTextColor, 'center');
            }

            const link = document.createElement('a');
            const fileName = `SocioVIP_QR_${activePromotion.type}_${qrData.code}.png`;
            link.href = canvas.toDataURL('image/png');
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: "QR con Detalles Guardado", description: "La imagen con los detalles se ha descargado." });
        };
        businessLogoImg.onerror = () => {
            console.error("Failed to load business logo for canvas. Drawing without it.");
            businessLogoImg.onload!(); 
        };
        businessLogoImg.src = `${businessLogoUrl}?text=${encodeURIComponent(businessName.substring(0,10))}&width=${canvasWidth - 2*padding}&height=${maxLogoHeight}`; 

    };
    qrImg.onerror = () => {
      toast({ title: "Error", description: "No se pudo cargar la imagen del QR para guardarla.", variant: "destructive" });
    };
    if (generatedQrDataUrl) {
      qrImg.src = generatedQrDataUrl;
    } else {
        toast({ title: "Error", description: "La imagen del QR aún no está lista.", variant: "destructive" });
    }
  };

  const PromotionCodeForm = ({ promotion }: { promotion: PromotionDetails }) => {
    const form = useForm<z.infer<typeof promoCodeEntrySchema>>({
      resolver: zodResolver(promoCodeEntrySchema),
      defaultValues: { promoCode: "" },
    });

    function onSubmit(values: z.infer<typeof promoCodeEntrySchema>) {
      handleValidateAndShowDniModal(values.promoCode, promotion);
    }

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 mt-4">
          <FormField
            control={form.control}
            name="promoCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Código de Promoción <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="Ingresar código (9 caracteres)" {...field} className="text-sm tracking-wider" maxLength={9} />
                </FormControl>
                <FormMessage className="text-xs"/>
              </FormItem>
            )}
          />
          <Button type="submit" size="sm" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground whitespace-nowrap">
            Validar y Obtener QR <ScanLine className="ml-1 h-4 w-4"/>
          </Button>
        </form>
      </Form>
    );
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <header className="mb-8 flex flex-col items-center">
        <SocioVipLogo className="h-16 w-16 text-primary mb-2" />
        <h1 className="text-4xl font-bold text-primary">PANDORA LOUNGE BAR</h1>
        <p className="text-muted-foreground">Lo más exclusivo en Chincha</p>
      </header>

      {pageViewState === 'promotionsList' && (
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_PROMOTIONS.map((promo) => (
            <Card key={promo.id} className="shadow-lg flex flex-col">
              <CardHeader className="p-0">
                <Image
                  src={promo.imageUrl}
                  alt={promo.title}
                  width={600}
                  height={400}
                  className="rounded-t-lg object-cover aspect-[3/2]"
                  data-ai-hint={promo.aiHint}
                />
              </CardHeader>
              <CardContent className="pt-4 flex-grow">
                <CardTitle className="text-xl mb-1">{promo.title}</CardTitle>
                <CardDescription className="text-sm mb-1">{promo.description}</CardDescription>
                <p className="text-xs text-muted-foreground">
                  Válido hasta: {format(parseISO(promo.validUntil), "d MMMM yyyy", { locale: es })}
                </p>
              </CardContent>
              <CardFooter className="flex-col items-stretch">
                <PromotionCodeForm promotion={promo} />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {pageViewState === 'qrDisplay' && qrData && activePromotion && (
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
            <CardTitle className="text-3xl text-center">¡Bienvenido!</CardTitle>
            <CardDescription className="text-center text-primary-foreground/80">
              Tu QR para "{activePromotion.title}" está listo.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex justify-center">
              {generatedQrDataUrl ? (
                <Image
                  src={generatedQrDataUrl}
                  alt="QR Code"
                  width={180}
                  height={180}
                  className="rounded-lg shadow-lg border-4 border-primary"
                  data-ai-hint="qr code"
                />
              ) : (
                <div className="w-[180px] h-[180px] flex items-center justify-center border-4 border-dashed border-primary rounded-lg bg-muted">
                  <p className="text-muted-foreground">Generando QR...</p>
                </div>
              )}
            </div>
            <div className="flex justify-center mt-4">
              <Button variant="outline" className="w-auto" onClick={handleSaveQrWithDetails} disabled={!generatedQrDataUrl}>
                <Download className="mr-2 h-5 w-5"/> Guardar QR con Detalles
              </Button>
            </div>

            <div className="space-y-1 text-center">
              <h2 className="text-2xl font-semibold text-primary">{qrData.user.name} {qrData.user.surname}</h2>
              <p><strong className="font-medium">DNI/CE:</strong> {qrData.user.dni}</p>
            </div>

            <div className="space-y-3 border-t pt-4">
               <h3 className="text-lg font-semibold text-primary flex items-center">
                {activePromotion.type === 'event' ? <Ticket className="mr-2 h-5 w-5"/> : <Gift className="mr-2 h-5 w-5"/>}
                {activePromotion.type === 'event' ? "Detalles del Evento" : "Detalles de la Promoción"}
              </h3>
              <p><strong className="font-medium">Título:</strong> {activePromotion.title}</p>

              <p className="flex items-center"><CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground"/> <strong className="font-medium">Válido hasta:</strong> {format(parseISO(activePromotion.validUntil), "d MMMM yyyy", { locale: es })}</p>
              <p className="flex items-center">
                {renderStatusIcon(qrData.status)}
                <strong className="font-medium ml-2">Estado:</strong> <span className="ml-1">{GENERATED_CODE_STATUS_TRANSLATIONS[qrData.status]}</span>
              </p>
              {activePromotion.termsAndConditions && (
                <div className="text-xs text-muted-foreground pt-2">
                    <h4 className="font-semibold mb-0.5">Términos y Condiciones:</h4>
                    <p>{activePromotion.termsAndConditions}</p>
                </div>
              )}
            </div>

            <div className="text-sm text-muted-foreground p-3 bg-secondary rounded-md flex items-start">
              <Info className="h-5 w-5 mr-2 mt-0.5 shrink-0"/>
              <span>Presenta este QR en el establecimiento para {activePromotion.type === 'event' ? "validar tu entrada" : "validar tu promoción"}. Recuerda que este código es personal e intransferible.</span>
            </div>
          </CardContent>
          <CardFooter className="flex-col space-y-3">
            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={resetProcess}>
              Ver Otros Eventos y Promociones
            </Button>
          </CardFooter>
        </Card>
      )}

      <Dialog open={showDniModal} onOpenChange={(isOpen) => { if (!isOpen) handleCloseDniModal(); }}>
        <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {currentStepInModal === 'enterDni' ? "Verificación de Identidad" : "Completa tus Datos (Cliente QR)"}
            </DialogTitle>
            <DialogDescription>
              {currentStepInModal === 'enterDni'
                ? `Para: "${activePromotion?.title}". Ingresa tu DNI o Carnet de Extranjería.`
                : "Es la primera vez que usas un código con este DNI. Por favor, completa tu información básica."}
            </DialogDescription>
          </DialogHeader>

          {currentStepInModal === 'enterDni' && (
            <Form {...dniForm}>
              <form onSubmit={dniForm.handleSubmit(handleDniSubmitInModal)} className="space-y-4 py-4">
                <FormField
                  control={dniForm.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Ingresa tu número de documento" {...field} maxLength={15} className="text-center text-lg"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-2">
                  <Button variant="outline" type="button" onClick={handleCloseDniModal}>Cancelar</Button>
                  <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                    {isLoading ? "Verificando..." : "Continuar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}

          {currentStepInModal === 'newQrClientForm' && (
            <Form {...newQrClientForm}>
              <form onSubmit={newQrClientForm.handleSubmit(handleNewQrClientSubmitInModal)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
                 <FormField
                  control={newQrClientForm.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Tu número de documento" {...field} maxLength={15} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={newQrClientForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre(s) <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input placeholder="Ingresa tus nombres" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={newQrClientForm.control}
                  name="surname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido(s) <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input placeholder="Ingresa tus apellidos" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={newQrClientForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input type="tel" placeholder="Ingresa tu número de celular" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={newQrClientForm.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de Nacimiento <span className="text-destructive">*</span></FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "d MMMM yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
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
                            toYear={new Date().getFullYear() - 10}
                            disabled={(date) => date > new Date(new Date().setFullYear(new Date().getFullYear() - 10)) || date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => {
                  const currentDniValue = newQrClientForm.getValues("dni");
                  setCurrentStepInModal('enterDni');
                  dniForm.setValue("dni", currentDniValue || enteredDniOriginal || "");
                }}>Volver</Button>
                <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                  {isLoading ? "Guardando..." : "Confirmar y Generar QR"} <Sparkles className="ml-2 h-4 w-4" />
                </Button>
              </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDniExistsWarningDialog} onOpenChange={setShowDniExistsWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>DNI Ya Registrado</AlertDialogTitle>
            <AlertDialogDescription>
              El DNI que has ingresado ya está registrado como Cliente QR. ¿Estás seguro que es tu número?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleDniExistsConfirmation(false)}>No, deseo corregir</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDniExistsConfirmation(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Sí, es mi número
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} SocioVIP. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
