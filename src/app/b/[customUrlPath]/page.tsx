
"use client"; // Convertir a Client Component para estados y formularios

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, addDoc, serverTimestamp } from "firebase/firestore";
import type { Business, BusinessManagedEntity, QrClient, NewQrClientFormData, QrCodeData, PromotionDetails } from "@/lib/types";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter as ShadcnDialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import QRCode from 'qrcode';
import { useToast } from "@/hooks/use-toast";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { Building, CalendarDays, Tag, Mail, Phone, MapPin, ExternalLink, Loader2, AlertCircle, QrCode as QrCodeIcon, UserPlus, Download, Home, AlertTriangle } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { PublicHeaderAuth } from "@/components/layout/PublicHeaderAuth";
import Link from "next/link"; // Asegurar que Link esté importado

// --- Zod Schemas para el modal ---
const dniSchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres.").regex(/^[a-zA-Z0-9]*$/, "Solo letras y números permitidos."),
});
type DniFormValues = z.infer<typeof dniSchema>;

const newQrClientSchema = z.object({
  name: z.string().min(2, { message: "Nombre es requerido." }),
  surname: z.string().min(2, { message: "Apellido es requerido." }),
  phone: z.string().min(7, { message: "Celular es requerido." }).regex(/^\+?[0-9\s-()]*$/, "Número de celular inválido."),
  dob: z.date({ required_error: "Fecha de nacimiento es requerida." })
    .refine(date => differenceInYears(new Date(), date) >= 10, { message: "Debes tener al menos 10 años." }),
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres.").regex(/^[a-zA-Z0-9]*$/, "Solo letras y números permitidos."),
});
type NewQrClientFormValues = z.infer<typeof newQrClientSchema>;


export default function BusinessPublicPageByUrl({ params }: { params: { customUrlPath: string } }) {
  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);
  const [entities, setEntities] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // --- Estados para el flujo de Generar QR ---
  const [pageViewState, setPageViewState] = useState<'entityList' | 'qrDisplay'>('entityList');
  const [showDniModal, setShowDniModal] = useState(false);
  const [currentStepInModal, setCurrentStepInModal] = useState<'enterDni' | 'newUserForm'>('enterDni');
  const [activeEntityForQr, setActiveEntityForQr] = useState<BusinessManagedEntity | null>(null);
  const [enteredDni, setEnteredDni] = useState("");
  const [qrDataForDisplay, setQrDataForDisplay] = useState<QrCodeData | null>(null);
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string | null>(null);
  const [isLoadingQrFlow, setIsLoadingQrFlow] = useState(false);
  const [showDniExistsWarningDialog, setShowDniExistsWarningDialog] = useState(false);
  const [formDataForDniWarning, setFormDataForDniWarning] = useState<NewQrClientFormValues | null>(null);
  const [existingUserForDniWarning, setExistingUserForDniWarning] = useState<QrClient | null>(null);

  const dniForm = useForm<DniFormValues>({ resolver: zodResolver(dniSchema), defaultValues: { dni: "" } });
  const newQrClientForm = useForm<NewQrClientFormValues>({ resolver: zodResolver(newQrClientSchema), defaultValues: { name: "", surname: "", phone: "", dob: undefined, dni: "" } });
  // --- Fin de estados para Generar QR ---

  const fetchBusinessData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("BusinessPublicPageByUrl: Fetching business with customUrlPath:", params.customUrlPath);
      if (!params.customUrlPath || typeof params.customUrlPath !== 'string' || params.customUrlPath.trim() === '') {
        console.warn("BusinessPublicPageByUrl: Invalid customUrlPath provided.");
        setError("URL de negocio inválida.");
        setBusinessDetails(null);
        setEntities([]);
        setIsLoading(false);
        return;
      }

      const businessQuery = query(collection(db, "businesses"), where("customUrlPath", "==", params.customUrlPath));
      const businessSnap = await getDocs(businessQuery);

      if (businessSnap.empty) {
        console.warn("BusinessPublicPageByUrl: No business found for customUrlPath:", params.customUrlPath);
        setError("Negocio no encontrado.");
        setBusinessDetails(null);
        setEntities([]);
        setIsLoading(false);
        return;
      }
      
      const businessDoc = businessSnap.docs[0];
      const bizData = businessDoc.data() as Omit<Business, 'id'>;
      const fetchedBusinessDetails = { 
        id: businessDoc.id, 
        ...bizData,
        joinDate: bizData.joinDate instanceof Timestamp ? bizData.joinDate.toDate().toISOString() : String(bizData.joinDate || new Date().toISOString()),
      };
      setBusinessDetails(fetchedBusinessDetails);
      console.log("BusinessPublicPageByUrl: Business data found:", fetchedBusinessDetails.name);

      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("businessId", "==", fetchedBusinessDetails.id),
        where("isActive", "==", true)
      );
      const entitiesSnapshot = await getDocs(entitiesQuery);
      console.log(`BusinessPublicPageByUrl: Fetched ${entitiesSnapshot.docs.length} active entities for business ${fetchedBusinessDetails.id}.`);

      const validEntities: BusinessManagedEntity[] = [];
      entitiesSnapshot.forEach(docSnap => {
        const entityData = docSnap.data() as Omit<BusinessManagedEntity, 'id' | 'startDate' | 'endDate' | 'createdAt'> & { startDate: Timestamp | string, endDate: Timestamp | string, createdAt?: Timestamp | string };
        
        let startDateStr: string;
        let endDateStr: string;
        const nowISO = new Date().toISOString();

        if (entityData.startDate instanceof Timestamp) startDateStr = entityData.startDate.toDate().toISOString();
        else if (typeof entityData.startDate === 'string') startDateStr = entityData.startDate;
        else { console.warn(`Entity ${docSnap.id} missing startDate.`); startDateStr = nowISO; }

        if (entityData.endDate instanceof Timestamp) endDateStr = entityData.endDate.toDate().toISOString();
        else if (typeof entityData.endDate === 'string') endDateStr = entityData.endDate;
        else { console.warn(`Entity ${docSnap.id} missing endDate.`); endDateStr = nowISO; }

        const entityForCheck: BusinessManagedEntity = {
          id: docSnap.id,
          businessId: entityData.businessId,
          type: entityData.type,
          name: entityData.name || "Entidad sin nombre",
          description: entityData.description || "",
          startDate: startDateStr,
          endDate: endDateStr,
          isActive: entityData.isActive,
          usageLimit: entityData.usageLimit || 0,
          maxAttendance: entityData.maxAttendance || 0,
          ticketTypes: entityData.ticketTypes || [],
          eventBoxes: entityData.eventBoxes || [],
          assignedPromoters: entityData.assignedPromoters || [],
          generatedCodes: entityData.generatedCodes || [],
          imageUrl: entityData.imageUrl,
          aiHint: entityData.aiHint,
          termsAndConditions: entityData.termsAndConditions,
          createdAt: entityData.createdAt instanceof Timestamp ? entityData.createdAt.toDate().toISOString() : (typeof entityData.createdAt === 'string' ? entityData.createdAt : undefined),
        };

        if (isEntityCurrentlyActivatable(entityForCheck)) {
          validEntities.push(entityForCheck);
        }
      });
      setEntities(validEntities.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
      console.log(`BusinessPublicPageByUrl: Filtered to ${validEntities.length} currently activatable entities.`);

    } catch (err: any) {
      console.error("BusinessPublicPageByUrl: Error fetching business data:", err);
      setError("No se pudo cargar la información del negocio.");
      setBusinessDetails(null);
      setEntities([]);
    } finally {
      setIsLoading(false);
    }
  }, [params.customUrlPath]);

  useEffect(() => {
    fetchBusinessData();
  }, [fetchBusinessData]);

  // --- Lógica para Generar QR ---
  const handleOpenDniModal = (entity: BusinessManagedEntity) => {
    setActiveEntityForQr(entity);
    setEnteredDni("");
    dniForm.reset({ dni: "" });
    newQrClientForm.reset({ name: "", surname: "", phone: "", dob: undefined, dni: "" });
    setCurrentStepInModal('enterDni');
    setShowDniModal(true);
  };

  const processQrGeneration = async (clientData: QrClient, entityData: BusinessManagedEntity) => {
    setIsLoadingQrFlow(true);
    const qrContent = `${entityData.type.toUpperCase()}_${entityData.id}_${clientData.dni}_${Date.now()}`; // Ejemplo de contenido
    
    const promotionDetailsForQr: PromotionDetails = {
        id: entityData.id,
        title: entityData.name,
        description: entityData.description,
        validUntil: entityData.endDate,
        imageUrl: entityData.imageUrl || "",
        promoCode: qrContent, // El código único del QR será este contenido
        aiHint: entityData.aiHint || "",
        type: entityData.type as 'promotion' | 'event',
        termsAndConditions: entityData.termsAndConditions
    };

    setQrDataForDisplay({
        user: clientData,
        promotion: promotionDetailsForQr,
        code: qrContent, // Este es el contenido que se codificará en el QR
        status: 'available' 
    });
    setShowDniModal(false);
    setPageViewState('qrDisplay');
    setIsLoadingQrFlow(false);
  };

  const onSubmitDni = async (data: DniFormValues) => {
    setIsLoadingQrFlow(true);
    setEnteredDni(data.dni);
    try {
      const q = query(collection(db, "qrClients"), where("dni", "==", data.dni));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const existingClientDoc = querySnapshot.docs[0];
        const clientData = {
          id: existingClientDoc.id,
          ...existingClientDoc.data(),
          dob: existingClientDoc.data().dob instanceof Timestamp ? existingClientDoc.data().dob.toDate().toISOString() : existingClientDoc.data().dob,
          registrationDate: existingClientDoc.data().registrationDate instanceof Timestamp ? existingClientDoc.data().registrationDate.toDate().toISOString() : existingClientDoc.data().registrationDate,
        } as QrClient;
        toast({ title: "Cliente Encontrado", description: "Usando datos existentes para generar QR." });
        if (activeEntityForQr) {
          await processQrGeneration(clientData, activeEntityForQr);
        }
      } else {
        newQrClientForm.setValue("dni", data.dni); // Pre-fill DNI for new user form
        setCurrentStepInModal('newUserForm');
      }
    } catch (err) {
      toast({ title: "Error", description: "No se pudo verificar el DNI.", variant: "destructive" });
      console.error("Error checking DNI:", err);
    } finally {
      setIsLoadingQrFlow(false);
    }
  };

  const onSubmitNewUser = async (data: NewQrClientFormValues) => {
    setIsLoadingQrFlow(true);
    try {
      // Doble check si el DNI ya existe (por si el usuario lo cambió en el form de nuevo usuario y ya existía)
      const q = query(collection(db, "qrClients"), where("dni", "==", data.dni));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty && data.dni !== enteredDni) { // Si el DNI fue cambiado y ahora sí existe
        setFormDataForDniWarning(data);
        const existingClientData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as QrClient;
        setExistingUserForDniWarning(existingClientData);
        setShowDniExistsWarningDialog(true);
        setIsLoadingQrFlow(false);
        return;
      }

      const newClientData: Omit<QrClient, 'id' | 'registrationDate'> & { registrationDate: any } = {
        ...data,
        dob: Timestamp.fromDate(data.dob),
        registrationDate: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, "qrClients"), newClientData);
      const createdClient: QrClient = {
        id: docRef.id,
        dni: data.dni,
        name: data.name,
        surname: data.surname,
        phone: data.phone,
        dob: data.dob.toISOString(), // Convert Date to ISO string for QrCodeData
        registrationDate: new Date().toISOString() // Approximate for immediate use
      };
      toast({ title: "Registro Exitoso", description: "Cliente registrado y QR listo." });
      if (activeEntityForQr) {
        await processQrGeneration(createdClient, activeEntityForQr);
      }
    } catch (err) {
      toast({ title: "Error de Registro", description: "No se pudo registrar el cliente.", variant: "destructive" });
      console.error("Error registering new client:", err);
    } finally {
      setIsLoadingQrFlow(false);
    }
  };
  
  const handleConfirmUseExistingData = async () => {
    if (existingUserForDniWarning && activeEntityForQr) {
      await processQrGeneration(existingUserForDniWarning, activeEntityForQr);
    }
    setShowDniExistsWarningDialog(false);
    setFormDataForDniWarning(null);
    setExistingUserForDniWarning(null);
  };

  const handleBackToDniEntry = () => {
    setCurrentStepInModal('enterDni');
    // No limpiar dniForm aquí, el usuario podría querer corregir el DNI que ya puso
  };

  useEffect(() => {
    const generateQr = async () => {
      if (pageViewState === 'qrDisplay' && qrDataForDisplay?.code) {
        try {
          const dataUrl = await QRCode.toDataURL(qrDataForDisplay.code, { width: 280, errorCorrectionLevel: 'H', margin: 2 });
          setGeneratedQrDataUrl(dataUrl);
        } catch (err) {
          console.error("Error generating QR code:", err);
          toast({ title: "Error", description: "No se pudo generar la imagen del QR.", variant: "destructive" });
          setGeneratedQrDataUrl(null);
        }
      } else {
        setGeneratedQrDataUrl(null);
      }
    };
    generateQr();
  }, [qrDataForDisplay, pageViewState, toast]);

  const handleSaveQrWithDetails = async () => {
    if (!qrDataForDisplay || !generatedQrDataUrl || !businessDetails || !activeEntityForQr) {
        toast({ title: "Error", description: "No hay datos del QR o del negocio para guardar.", variant: "destructive" });
        return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        toast({ title: "Error", description: "No se pudo crear el lienzo para la imagen.", variant: "destructive" });
        return;
    }

    const user = qrDataForDisplay.user;
    const entity = activeEntityForQr;

    // --- Dimensiones y Estilos ---
    const canvasWidth = 320;
    const padding = 20;
    const contentWidth = canvasWidth - 2 * padding;
    let currentY = 0;

    // Header
    const headerHeight = 60;
    const logoHeight = 40;
    const spacingAfterLogo = 10;

    // QR Code
    const qrSize = 180;
    const spacingAboveQr = 20;
    const spacingBelowQr = 20;

    // Textos
    const businessNameFontSize = 16;
    const entityTitleFontSize = 18;
    const userNameFontSize = 20;
    const dniFontSize = 14;
    const detailsFontSize = 12;
    const termsFontSize = 10;
    const lineHeightSmall = 14;
    const lineHeightMedium = 18;
    const lineHeightLarge = 24;

    // Colores
    const bgColor = 'hsl(280, 13%, 96%)'; // Light Gray
    const primaryColor = 'hsl(283, 44%, 53%)'; // Vibrant Purple
    const primaryFgColor = 'hsl(0, 0%, 98%)'; // White
    const textColor = 'hsl(0, 0%, 15%)'; // Darker Gray
    const mutedTextColor = 'hsl(0, 0%, 40%)'; // Medium Gray

    // Cargar imágenes (Logo y QR)
    const loadImages = (logoSrc?: string, qrSrc?: string): Promise<[HTMLImageElement | null, HTMLImageElement | null]> => {
        return new Promise(resolve => {
            let loadedCount = 0;
            const images: [HTMLImageElement | null, HTMLImageElement | null] = [null, null];
            const onSingleLoad = () => {
                loadedCount++;
                if (loadedCount === 2) resolve(images);
            };

            if (logoSrc) {
                const logoImg = new window.Image();
                logoImg.crossOrigin = "anonymous";
                logoImg.onload = () => { images[0] = logoImg; onSingleLoad(); };
                logoImg.onerror = () => { console.error("Error loading logo"); onSingleLoad(); };
                logoImg.src = logoSrc;
            } else {
                onSingleLoad(); // No logo
            }

            if (qrSrc) {
                const qrImg = new window.Image();
                qrImg.crossOrigin = "anonymous";
                qrImg.onload = () => { images[1] = qrImg; onSingleLoad(); };
                qrImg.onerror = () => { console.error("Error loading QR"); onSingleLoad(); };
                qrImg.src = qrSrc;
            } else {
                onSingleLoad(); // No QR
            }
        });
    };
    
    const [logoImage, qrImage] = await loadImages(businessDetails.logoUrl || `https://placehold.co/100x40.png?text=${encodeURIComponent(businessDetails.name.substring(0,10))}`, generatedQrDataUrl);

    // Calcular altura del canvas dinámicamente
    currentY += padding; // Top padding

    // Header (Logo y Nombre Negocio)
    if (logoImage) currentY += Math.min(logoImage.height, logoHeight) + spacingAfterLogo;
    currentY += businessNameFontSize + lineHeightMedium; // Nombre negocio + espacio

    // Título de la Entidad
    currentY += entityTitleFontSize + lineHeightLarge;

    // QR Code
    currentY += qrSize + spacingBelowQr;

    // Nombre Usuario
    currentY += userNameFontSize + lineHeightSmall;
    // DNI Usuario
    currentY += dniFontSize + lineHeightMedium;

    // Válido Hasta
    currentY += detailsFontSize + lineHeightSmall;

    // Términos y Condiciones (manejar multilínea)
    if (entity.termsAndConditions) {
        ctx.font = `${termsFontSize}px Arial`;
        const termsLines = getWrappedTextLines(ctx, entity.termsAndConditions, contentWidth);
        currentY += termsLines.length * lineHeightSmall + lineHeightSmall;
    }
    currentY += padding; // Bottom padding
    canvas.height = currentY;
    canvas.width = canvasWidth;

    // --- Dibujar en el Canvas ---
    // Fondo
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    currentY = 0;

    // Header Background
    let actualHeaderHeight = 0;
    if (logoImage) actualHeaderHeight += Math.min(logoImage.height, logoHeight) + spacingAfterLogo;
    actualHeaderHeight += businessNameFontSize + padding / 2;
    actualHeaderHeight = Math.max(headerHeight, actualHeaderHeight);

    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, canvas.width, actualHeaderHeight + padding);
    currentY += padding;

    // Logo
    if (logoImage) {
        const aspectRatio = logoImage.width / logoImage.height;
        let h = Math.min(logoImage.height, logoHeight);
        let w = h * aspectRatio;
        if (w > contentWidth) {
            w = contentWidth;
            h = w / aspectRatio;
        }
        ctx.drawImage(logoImage, (canvasWidth - w) / 2, currentY, w, h);
        currentY += h + spacingAfterLogo;
    } else {
        currentY += logoHeight + spacingAfterLogo; // Reserve space
    }

    // Nombre del Negocio
    ctx.font = `bold ${businessNameFontSize}px Arial`;
    ctx.fillStyle = primaryFgColor;
    ctx.textAlign = 'center';
    ctx.fillText(businessDetails.name, canvasWidth / 2, currentY);
    currentY += businessNameFontSize + padding; // Espacio después de la cabecera completa

    // Título de la Entidad
    ctx.font = `bold ${entityTitleFontSize}px Arial`;
    ctx.fillStyle = primaryColor;
    ctx.fillText(entity.name, canvasWidth / 2, currentY);
    currentY += entityTitleFontSize + spacingAboveQr;

    // Código QR
    if (qrImage) {
        ctx.fillStyle = 'white'; // Fondo blanco para el QR
        const qrX = (canvasWidth - qrSize) / 2;
        ctx.fillRect(qrX - 5, currentY - 5, qrSize + 10, qrSize + 10); // Padding blanco
        ctx.drawImage(qrImage, qrX, currentY, qrSize, qrSize);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(qrX - 5, currentY - 5, qrSize + 10, qrSize + 10);
    }
    currentY += qrSize + spacingBelowQr;

    // Nombre del Usuario
    ctx.font = `bold ${userNameFontSize}px Arial`;
    ctx.fillStyle = primaryColor;
    ctx.fillText(`${user.name} ${user.surname}`, canvasWidth / 2, currentY);
    currentY += userNameFontSize + 2;

    // DNI del Usuario
    ctx.font = `${dniFontSize}px Arial`;
    ctx.fillStyle = textColor;
    ctx.fillText(`DNI/CE: ${user.dni}`, canvasWidth / 2, currentY);
    currentY += dniFontSize + lineHeightMedium;

    // Válido Hasta
    ctx.font = `${detailsFontSize}px Arial`;
    ctx.fillStyle = mutedTextColor;
    ctx.fillText(`Válido hasta: ${format(parseISO(entity.endDate), "dd MMMM yyyy", { locale: es })}`, canvasWidth / 2, currentY);
    currentY += detailsFontSize + lineHeightSmall;

    // Términos y Condiciones
    if (entity.termsAndConditions) {
        ctx.font = `${termsFontSize}px Arial`;
        ctx.fillStyle = mutedTextColor;
        drawWrappedText(ctx, `T&C: ${entity.termsAndConditions}`, padding, currentY, contentWidth, lineHeightSmall, 'center');
    }

    // Descargar imagen
    const link = document.createElement('a');
    const entityTypeSlug = entity.type === 'promotion' ? 'promo' : 'evento';
    link.download = `SocioVIP_QR_${entityTypeSlug}_${(qrDataForDisplay.code || "CODIGO").substring(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast({ title: "QR con Detalles Guardado", description: "La imagen del QR con los detalles ha sido descargada." });
  };
  
  function getWrappedTextLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = context.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
  }

  function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, align: 'left' | 'center' | 'right' = 'left') {
    const lines = getWrappedTextLines(context, text, maxWidth);
    lines.forEach((line, index) => {
        let drawX = x;
        if (align === 'center') {
            drawX = (context.canvas.width - context.measureText(line).width) / 2;
        } else if (align === 'right') {
            drawX = context.canvas.width - x - context.measureText(line).width;
        }
        context.fillText(line, drawX, y + (index * lineHeight));
    });
  }
  // --- Fin de Lógica para Generar QR ---

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Cargando información del negocio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        <SocioVipLogo className="h-20 w-20 text-destructive mb-4" />
        <h1 className="text-3xl font-bold text-destructive">{error}</h1>
        <Link href="/" passHref className="mt-6">
          <Button variant="outline">Volver a la Página Principal</Button>
        </Link>
      </div>
    );
  }

  if (!businessDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        <SocioVipLogo className="h-20 w-20 text-destructive mb-4" />
        <h1 className="text-3xl font-bold text-destructive">Negocio No Encontrado</h1>
        <p className="text-muted-foreground mt-2">
          La página del negocio que buscas no existe o la URL es incorrecta.
        </p>
        <Link href="/" passHref className="mt-6">
          <Button variant="outline">Volver a la Página Principal</Button>
        </Link>
      </div>
    );
  }

  if (pageViewState === 'qrDisplay' && qrDataForDisplay) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-3">
                {businessDetails.logoUrl ? (
                    <Image src={businessDetails.logoUrl} alt={`${businessDetails.name} logo`} width={120} height={40} className="object-contain data-[ai-hint=business logo]" />
                ) : (
                    <SocioVipLogo className="h-12 w-12 text-primary" />
                )}
            </div>
            <CardTitle className="text-xl text-primary">{businessDetails.name}</CardTitle>
            <CardDescription>Tu {qrDataForDisplay.promotion.type === 'event' ? 'entrada' : 'promoción'} está lista</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {generatedQrDataUrl ? (
              <div className="flex justify-center">
                 <Image src={generatedQrDataUrl} alt="Código QR Generado" width={280} height={280} data-ai-hint="qr code" />
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mr-2" /> Generando QR...
              </div>
            )}
            <h2 className="text-2xl font-semibold text-primary">{qrDataForDisplay.user.name} {qrDataForDisplay.user.surname}</h2>
            <p className="text-muted-foreground">DNI/CE: {qrDataForDisplay.user.dni}</p>
            <div className="border-t pt-3 mt-3 text-left text-sm space-y-1">
              <p><strong>{qrDataForDisplay.promotion.type === 'event' ? 'Evento' : 'Promoción'}:</strong> {qrDataForDisplay.promotion.title}</p>
              <p><strong>Válido hasta:</strong> {format(parseISO(qrDataForDisplay.promotion.validUntil), "dd MMMM yyyy", { locale: es })}</p>
              {qrDataForDisplay.promotion.termsAndConditions && (
                <p className="text-xs text-muted-foreground"><strong>T&C:</strong> {qrDataForDisplay.promotion.termsAndConditions}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button onClick={handleSaveQrWithDetails} className="w-full bg-primary hover:bg-primary/90" disabled={!generatedQrDataUrl}>
              <Download className="mr-2 h-4 w-4" /> Guardar QR con Detalles
            </Button>
            <Button onClick={() => { setPageViewState('entityList'); setQrDataForDisplay(null); setGeneratedQrDataUrl(null); }} variant="outline" className="w-full">
              Ver Otras Promociones/Eventos del Negocio
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const events = entities.filter(e => e.type === 'event');
  const promotions = entities.filter(e => e.type === 'promotion');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="relative">
        <div className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" passHref className="flex items-center gap-2 group">
                    <SocioVipLogo className="h-8 w-8 text-primary group-hover:animate-pulse" />
                    <span className="font-semibold text-xl text-primary group-hover:text-primary/80">SocioVIP</span>
                </Link>
                <PublicHeaderAuth />
            </div>
        </div>

        {businessDetails.publicCoverImageUrl && (
          <div className="relative h-48 md:h-64 lg:h-80 w-full">
            <Image
              src={businessDetails.publicCoverImageUrl}
              alt={`Portada de ${businessDetails.name}`}
              fill
              className="object-cover"
              data-ai-hint="business cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/10"></div>
          </div>
        )}
        <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${businessDetails.publicCoverImageUrl ? '-mt-16 md:-mt-20' : 'pt-12 pb-6'} relative z-10`}>
          <Card className="shadow-xl bg-card/90 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6 flex flex-col sm:flex-row items-center gap-4 md:gap-6">
              {businessDetails.logoUrl && (
                <Image
                  src={businessDetails.logoUrl}
                  alt={`Logo de ${businessDetails.name}`}
                  width={100}
                  height={100}
                  className="rounded-md object-contain h-20 w-20 sm:h-24 sm:w-24 border bg-background p-1 shadow-md"
                  data-ai-hint="business logo"
                />
              )}
              <div className="text-center sm:text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-primary">{businessDetails.name}</h1>
                {businessDetails.slogan && <p className="text-md text-muted-foreground mt-1">{businessDetails.slogan}</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {events.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
              <CalendarDays className="h-7 w-7 mr-3 text-primary" />
              Próximos Eventos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Card key={event.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg">
                  {event.imageUrl && (
                    <div className="relative aspect-[16/9] w-full">
                      <Image
                        src={event.imageUrl}
                        alt={event.name || "Evento"}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover"
                        data-ai-hint={event.aiHint || "event party"}
                      />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{event.name}</CardTitle>
                    <CardDescription>
                      Del {format(parseISO(event.startDate), "dd MMM, HH:mm", { locale: es })} al {format(parseISO(event.endDate), "dd MMM, HH:mm 'hrs'", { locale: es })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-4">{event.description}</p>
                    {event.termsAndConditions && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">T&C: {event.termsAndConditions}</p>}
                  </CardContent>
                  <CardFooter>
                    <Button onClick={() => handleOpenDniModal(event)} className="w-full bg-primary hover:bg-primary/90">
                      <QrCodeIcon className="mr-2 h-4 w-4"/> Generar QR
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {promotions.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
              <Tag className="h-7 w-7 mr-3 text-primary" />
              Promociones Vigentes
            </h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((promo) => (
                <Card key={promo.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg">
                  {promo.imageUrl && (
                    <div className="relative aspect-[16/9] w-full">
                      <Image
                        src={promo.imageUrl}
                        alt={promo.name || "Promoción"}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover"
                        data-ai-hint={promo.aiHint || "discount offer"}
                      />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{promo.name}</CardTitle>
                    <CardDescription>
                      Válido hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-4">{promo.description}</p>
                     {promo.termsAndConditions && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">T&C: {promo.termsAndConditions}</p>}
                  </CardContent>
                   <CardFooter>
                    <Button onClick={() => handleOpenDniModal(promo)} className="w-full bg-primary hover:bg-primary/90">
                        <QrCodeIcon className="mr-2 h-4 w-4"/> Generar QR
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {!events.length && !promotions.length && !isLoading && (
           <div className="text-center py-10">
            <Tag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">Este negocio no tiene eventos ni promociones activas en este momento.</p>
          </div>
        )}

        <section className="mt-12 pt-8 border-t">
            <h2 className="text-xl font-semibold tracking-tight text-foreground mb-4 flex items-center">
                <MapPin className="h-6 w-6 mr-2 text-primary" />
                Información de Contacto
            </h2>
            <div className="space-y-2 text-sm text-muted-foreground">
                {businessDetails.publicAddress && <p><strong>Dirección:</strong> {businessDetails.publicAddress}</p>}
                {businessDetails.publicPhone && <p><strong>Teléfono:</strong> {businessDetails.publicPhone}</p>}
                {businessDetails.publicContactEmail && <p><strong>Email:</strong> <a href={`mailto:${businessDetails.publicContactEmail}`} className="text-primary hover:underline">{businessDetails.publicContactEmail}</a></p>}
            </div>
        </section>
      </main>

      <footer className="mt-12 py-8 bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground">
          Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociovip.app</Link>
        </p>
      </footer>

      {/* --- Modal para DNI y Nuevo Usuario --- */}
      <Dialog open={showDniModal} onOpenChange={setShowDniModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {currentStepInModal === 'enterDni' ? `Obtener QR para: ${activeEntityForQr?.name}` : "Completa tus Datos"}
            </DialogTitle>
            <DialogDescription>
              {currentStepInModal === 'enterDni' 
                ? "Ingresa tu DNI o Carnet de Extranjería para continuar." 
                : "Necesitamos algunos datos para generar tu QR."}
            </DialogDescription>
          </DialogHeader>
          
          {currentStepInModal === 'enterDni' && (
            <Form {...dniForm}>
              <form onSubmit={dniForm.handleSubmit(onSubmitDni)} className="space-y-4 py-2">
                <FormField control={dniForm.control} name="dni" render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="Número de documento" {...field} autoFocus maxLength={15} disabled={isLoadingQrFlow} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <ShadcnDialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowDniModal(false)} disabled={isLoadingQrFlow}>Cancelar</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isLoadingQrFlow}>
                    {isLoadingQrFlow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar DNI"}
                  </Button>
                </ShadcnDialogFooter>
              </form>
            </Form>
          )}

          {currentStepInModal === 'newUserForm' && (
            <Form {...newQrClientForm}>
              <form onSubmit={newQrClientForm.handleSubmit(onSubmitNewUser)} className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
                <FormField control={newQrClientForm.control} name="dni" render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} maxLength={15} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={newQrClientForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombres <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={newQrClientForm.control} name="surname" render={({ field }) => (
                  <FormItem><FormLabel>Apellidos <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={newQrClientForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Celular <span className="text-destructive">*</span></FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={newQrClientForm.control} name="dob" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Fecha de Nacimiento <span className="text-destructive">*</span></FormLabel>
                    <Popover><PopoverTrigger asChild><FormControl>
                      <Button variant={"outline"} className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}>
                        {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                        <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                      </Button></FormControl></PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date(new Date().setFullYear(new Date().getFullYear() - 10)) || date < new Date("1900-01-01")} initialFocus locale={es} captionLayout="dropdown-buttons" fromYear={1920} toYear={new Date().getFullYear() - 10} />
                      </PopoverContent>
                    </Popover><FormMessage />
                  </FormItem>
                )}/>
                <ShadcnDialogFooter className="pt-2 flex-col sm:flex-row">
                  <Button type="button" variant="ghost" onClick={handleBackToDniEntry} disabled={isLoadingQrFlow}>Volver a Ingresar DNI</Button>
                  <div className="flex-grow sm:flex-grow-0"></div>
                  <Button type="button" variant="outline" onClick={() => setShowDniModal(false)} disabled={isLoadingQrFlow}>Cancelar</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isLoadingQrFlow}>
                    {isLoadingQrFlow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Registrar y Generar QR"}
                  </Button>
                </ShadcnDialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      
      {/* --- Modal de Advertencia DNI Ya Existe (en form nuevo usuario) --- */}
      <AlertDialog open={showDniExistsWarningDialog} onOpenChange={setShowDniExistsWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" /> DNI ya Registrado</AlertDialogTitle>
            <AlertDialogDescription>
              El DNI/CE <span className="font-semibold">{formDataForDniWarning?.dni}</span> ya se encuentra registrado como Cliente QR.
              ¿Deseas continuar y generar el QR utilizando los datos existentes de {existingUserForDniWarning?.name} {existingUserForDniWarning?.surname}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => {
              setShowDniExistsWarningDialog(false); 
              setFormDataForDniWarning(null); 
              setExistingUserForDniWarning(null);
              // Opcional: no limpiar el formulario de nuevo usuario, permitir corregir
            }}>No, deseo corregir el DNI</Button>
            <Button onClick={handleConfirmUseExistingData} className="bg-primary hover:bg-primary/90">Sí, usar datos existentes</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

