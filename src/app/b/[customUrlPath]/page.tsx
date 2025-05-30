
"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import type { BusinessManagedEntity, Business, QrClient, QrCodeData, NewQrClientFormData } from "@/lib/types";
import { format, parseISO, set, startOfDay, endOfDay, getMonth } from "date-fns";
import { es } from "date-fns/locale";
import { isEntityCurrentlyActivatable, sanitizeObjectForFirestore } from "@/lib/utils";
import { Loader2, Building, Tag, CalendarDays, ExternalLink, QrCode as QrCodeIcon, Home, User, ShieldCheck, Download, Info, AlertTriangle, PackageOpen, UserCheck as UserCheckIcon, Edit } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { PublicHeaderAuth } from "@/components/layout/PublicHeaderAuth";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as UIDialogDescription, DialogFooter as ShadcnDialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle as UIAlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import QRCode from 'qrcode';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";


const specificCodeSchema = z.object({
  specificCode: z.string().length(9, "El código debe tener 9 caracteres alfanuméricos.").regex(/^[A-Z0-9]{9}$/, "El código debe ser alfanumérico y en mayúsculas."),
});
type SpecificCodeFormValues = z.infer<typeof specificCodeSchema>;

const dniSchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
});
type DniFormValues = z.infer<typeof dniSchema>;

const newQrClientSchema = z.object({
  name: z.string().min(2, { message: "Nombre es requerido." }),
  surname: z.string().min(2, { message: "Apellido es requerido." }),
  phone: z.string().min(7, { message: "Celular es requerido." }).regex(/^\+?[0-9\s-()]*$/, "Número de celular inválido."),
  dob: z.date({ required_error: "Fecha de nacimiento es requerida." }),
  dniConfirm: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
});
type NewQrClientFormValues = z.infer<typeof newQrClientSchema>;


export default function BusinessPublicPageByUrl({ params }: { params: { customUrlPath: string } }) {
  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);
  const [activeEntitiesForBusiness, setActiveEntitiesForBusiness] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [pageViewState, setPageViewState] = useState<'entityList' | 'qrDisplay'>('entityList');
  const [showDniModal, setShowDniModal] = useState(false);
  const [currentStepInModal, setCurrentStepInModal] = useState<'enterDni' | 'newUserForm'>('enterDni');
  const [activeEntityForQr, setActiveEntityForQr] = useState<BusinessManagedEntity | null>(null);
  const [validatedSpecificCode, setValidatedSpecificCode] = useState<string | null>(null); // Este es el código de 9 dígitos
  const [enteredDni, setEnteredDni] = useState<string>("");
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string | null>(null);
  const [isLoadingQrFlow, setIsLoadingQrFlow] = useState(false);
  const [showDniExistsWarningDialog, setShowDniExistsWarningDialog] = useState(false);
  const [formDataForDniWarning, setFormDataForDniWarning] = useState<NewQrClientFormValues | null>(null);

  const dniForm = useForm<DniFormValues>({
    resolver: zodResolver(dniSchema),
    defaultValues: { dni: "" },
  });

  const newQrClientForm = useForm<NewQrClientFormValues>({
    resolver: zodResolver(newQrClientSchema),
    defaultValues: { name: "", surname: "", phone: "", dob: undefined, dniConfirm: "" },
  });

  const fetchBusinessData = useCallback(async () => {
    if (!params.customUrlPath) {
      setError("URL de negocio inválida.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log("BusinessPage by URL: Fetching business with customUrlPath:", params.customUrlPath);
    try {
      const businessQuery = query(
        collection(db, "businesses"),
        where("customUrlPath", "==", params.customUrlPath.toLowerCase().trim()),
        limit(1)
      );
      const businessSnap = await getDocs(businessQuery);

      if (businessSnap.empty) {
        setError("Negocio no encontrado. Verifica que la URL sea correcta.");
        setBusinessDetails(null);
        setActiveEntitiesForBusiness([]);
      } else {
        const businessDoc = businessSnap.docs[0];
        const bizData = businessDoc.data();
        const fetchedBusiness: Business = {
          id: businessDoc.id,
          name: bizData.name,
          contactEmail: bizData.contactEmail,
          joinDate: bizData.joinDate instanceof Timestamp ? bizData.joinDate.toDate().toISOString() : String(bizData.joinDate || new Date().toISOString()),
          customUrlPath: bizData.customUrlPath || params.customUrlPath,
          logoUrl: bizData.logoUrl || undefined,
          publicCoverImageUrl: bizData.publicCoverImageUrl || undefined,
          slogan: bizData.slogan || undefined,
          publicContactEmail: bizData.publicContactEmail || undefined,
          publicPhone: bizData.publicPhone || undefined,
          publicAddress: bizData.publicAddress || undefined,
        };
        setBusinessDetails(fetchedBusiness);
        console.log("BusinessPage by URL: Business data found:", fetchedBusiness.name);

        const entitiesQuery = query(
          collection(db, "businessEntities"),
          where("businessId", "==", fetchedBusiness.id),
          where("isActive", "==", true)
        );
        const entitiesSnapshot = await getDocs(entitiesQuery);
        console.log(`BusinessPage by URL: Fetched ${entitiesSnapshot.docs.length} active entities for business ${fetchedBusiness.id}.`);
        
        const allActiveEntities: BusinessManagedEntity[] = [];
        entitiesSnapshot.forEach(docSnap => {
          const entityData = docSnap.data();
          let startDateStr: string;
          let endDateStr: string;
          const nowStr = new Date().toISOString();

          if (entityData.startDate instanceof Timestamp) {
              startDateStr = entityData.startDate.toDate().toISOString();
          } else if (typeof entityData.startDate === 'string') {
              startDateStr = entityData.startDate;
          } else if (entityData.startDate instanceof Date) {
              startDateStr = entityData.startDate.toISOString();
          } else {
              console.warn(`BusinessPage by URL (Client): Entity ${docSnap.id} for business ${entityData.businessId} missing or invalid startDate. Using fallback.`);
              startDateStr = nowStr; 
          }

          if (entityData.endDate instanceof Timestamp) {
              endDateStr = entityData.endDate.toDate().toISOString();
          } else if (typeof entityData.endDate === 'string') {
              endDateStr = entityData.endDate;
          } else if (entityData.endDate instanceof Date) {
              endDateStr = entityData.endDate.toISOString();
          } else {
              console.warn(`BusinessPage by URL (Client): Entity ${docSnap.id} for business ${entityData.businessId} missing or invalid endDate. Using fallback.`);
              endDateStr = nowStr; 
          }
          
          const entityToAdd: BusinessManagedEntity = {
            id: docSnap.id,
            businessId: entityData.businessId,
            type: entityData.type,
            name: entityData.name || "Entidad sin nombre",
            description: entityData.description || "",
            startDate: startDateStr,
            endDate: endDateStr,
            isActive: entityData.isActive === undefined ? true : entityData.isActive,
            usageLimit: entityData.usageLimit || 0,
            maxAttendance: entityData.maxAttendance || 0,
            ticketTypes: entityData.ticketTypes || [],
            eventBoxes: entityData.eventBoxes || [],
            assignedPromoters: entityData.assignedPromoters || [],
            generatedCodes: entityData.generatedCodes || [],
            imageUrl: entityData.imageUrl,
            aiHint: entityData.aiHint,
            termsAndConditions: entityData.termsAndConditions,
            createdAt: entityData.createdAt instanceof Timestamp ? entityData.createdAt.toDate().toISOString() : (typeof entityData.createdAt === 'string' ? entityData.createdAt : (entityData.createdAt instanceof Date ? entityData.createdAt.toISOString() : undefined)),
          };

          if (isEntityCurrentlyActivatable(entityToAdd)) {
            allActiveEntities.push(entityToAdd);
          }
        });
        setActiveEntitiesForBusiness(allActiveEntities.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      }
    } catch (err: any) {
      console.error("BusinessPage by URL: Error fetching business data:", err);
      setError("No se pudo cargar la información del negocio. Inténtalo de nuevo más tarde.");
      setBusinessDetails(null);
      setActiveEntitiesForBusiness([]);
    } finally {
      setIsLoading(false);
    }
  }, [params.customUrlPath]);

  useEffect(() => {
    if (params.customUrlPath) {
        fetchBusinessData();
    }
  }, [params.customUrlPath, fetchBusinessData]);


  const handleSpecificCodeSubmit = (entity: BusinessManagedEntity, codeValue: string) => {
    setIsLoadingQrFlow(true);
    const codeToValidate = codeValue.toUpperCase().trim();

    if (!entity.generatedCodes || entity.generatedCodes.length === 0) {
        toast({
            title: "Error de Configuración",
            description: `Esta ${entity.type === 'promotion' ? 'promoción' : 'evento'} no tiene códigos de 9 dígitos configurados por el negocio.`,
            variant: "destructive",
        });
        setIsLoadingQrFlow(false);
        return;
    }

    const foundCodeObject = entity.generatedCodes.find(
      (gc) => gc.value.toUpperCase() === codeToValidate && gc.status === 'available'
    );

    if (foundCodeObject) {
      setActiveEntityForQr(entity);
      setValidatedSpecificCode(codeToValidate); // El código de 9 dígitos validado
      setCurrentStepInModal('enterDni');
      dniForm.reset({ dni: "" });
      setShowDniModal(true);
    } else {
      toast({
        title: "Código Inválido o No Disponible",
        description: `El código de 9 dígitos ingresado no es válido para esta ${entity.type === 'promotion' ? 'promoción' : 'evento'} o ya fue utilizado.`,
        variant: "destructive",
      });
    }
    setIsLoadingQrFlow(false);
  };


  const handleDniSubmitInModal: SubmitHandler<DniFormValues> = async (data) => {
    if (!activeEntityForQr || !validatedSpecificCode) {
      toast({title: "Error interno", description:"Falta promoción activa o código validado.", variant: "destructive"});
      return;
    }
    setIsLoadingQrFlow(true);
    setEnteredDni(data.dni);

    try {
        const qrClientsRef = collection(db, "qrClients");
        const q = query(qrClientsRef, where("dni", "==", data.dni), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const existingClientDoc = querySnapshot.docs[0];
          const clientData = existingClientDoc.data();
          const qrClient: QrClient = {
            id: existingClientDoc.id,
            dni: clientData.dni,
            name: clientData.name,
            surname: clientData.surname,
            phone: clientData.phone,
            dob: clientData.dob instanceof Timestamp ? clientData.dob.toDate().toISOString() : String(clientData.dob),
            registrationDate: clientData.registrationDate instanceof Timestamp ? clientData.registrationDate.toDate().toISOString() : String(clientData.registrationDate),
          };
          
          setQrData({
            user: qrClient,
            promotion: { 
                id: activeEntityForQr.id,
                title: activeEntityForQr.name,
                description: activeEntityForQr.description,
                validUntil: activeEntityForQr.endDate,
                imageUrl: activeEntityForQr.imageUrl || "",
                promoCode: validatedSpecificCode, // Usamos el código de 9 dígitos aquí
                type: activeEntityForQr.type as 'promotion' | 'event',
                termsAndConditions: activeEntityForQr.termsAndConditions,
                aiHint: activeEntityForQr.aiHint || "",
            },
            code: validatedSpecificCode, // Código de 9 dígitos
            status: 'available', // Asumimos que si llega aquí, el código estaba disponible
          });
          setShowDniModal(false);
          setPageViewState('qrDisplay');
          toast({ title: "DNI Verificado", description: "Cliente encontrado. Generando QR." });
        } else {
          newQrClientForm.reset({ name: "", surname: "", phone: "", dob: undefined, dniConfirm: data.dni });
          setCurrentStepInModal('newUserForm');
        }
    } catch(e: any) {
        console.error("Error verificando DNI:", e);
        toast({ title: "Error de Verificación", description: "No se pudo verificar el DNI. " + e.message, variant: "destructive" });
    } finally {
        setIsLoadingQrFlow(false);
    }
  };

  const processNewQrClientRegistration = async (formData: NewQrClientFormValues) => {
    if (!activeEntityForQr || !validatedSpecificCode || !enteredDni) {
         toast({title: "Error interno", description:"Falta información para registrar cliente.", variant: "destructive"});
        return;
    }
    setIsLoadingQrFlow(true);

    const newClientData: Omit<QrClient, 'id' | 'registrationDate'> & {registrationDate: any, dob: Timestamp} = {
      dni: enteredDni, // Usar el DNI verificado/confirmado
      name: formData.name,
      surname: formData.surname,
      phone: formData.phone,
      dob: Timestamp.fromDate(formData.dob),
      registrationDate: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, "qrClients"), newClientData);
      const registeredClient: QrClient = {
        id: docRef.id,
        dni: newClientData.dni,
        name: newClientData.name,
        surname: newClientData.surname,
        phone: newClientData.phone,
        dob: newClientData.dob.toDate().toISOString(),
        registrationDate: new Date().toISOString(), 
      };
      setQrData({
        user: registeredClient,
        promotion: {
            id: activeEntityForQr.id,
            title: activeEntityForQr.name,
            description: activeEntityForQr.description,
            validUntil: activeEntityForQr.endDate,
            imageUrl: activeEntityForQr.imageUrl || "",
            promoCode: validatedSpecificCode,
            type: activeEntityForQr.type as 'promotion' | 'event',
            termsAndConditions: activeEntityForQr.termsAndConditions,
            aiHint: activeEntityForQr.aiHint || "",
        },
        code: validatedSpecificCode,
        status: 'available',
      });
      setShowDniModal(false);
      setPageViewState('qrDisplay');
      toast({ title: "Registro Exitoso", description: "Cliente registrado. Generando QR." });
    } catch (e: any) {
      console.error("Error adding new QrClient: ", e);
      toast({ title: "Error de Registro", description: "No se pudo registrar al cliente. " + e.message, variant: "destructive" });
    } finally {
        setIsLoadingQrFlow(false);
    }
  };
  
  const handleNewUserDniChangeDuringRegistration = async (newDniValue: string, currentFormData: NewQrClientFormValues): Promise<boolean> => {
      const newDniCleaned = newDniValue.trim();
      if (newDniCleaned === enteredDni) return true; // No change, or changed back to original DNI for this flow
      if (newDniCleaned.length < 7 || newDniCleaned.length > 15) {
          newQrClientForm.setError("dniConfirm", { type: "manual", message: "DNI/CE debe tener entre 7 y 15 caracteres."});
          return false;
      }
      newQrClientForm.clearErrors("dniConfirm");

      try {
        setIsLoadingQrFlow(true);
        const qrClientsRef = collection(db, "qrClients");
        const q = query(qrClientsRef, where("dni", "==", newDniCleaned), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            setFormDataForDniWarning(currentFormData); // Guardar los datos del formulario actual
            setEnteredDni(newDniCleaned); // Actualizar el DNI que causó la advertencia
            setShowDniExistsWarningDialog(true);
            return false; // Detener el submit actual del formulario de nuevo usuario
        }
        setEnteredDni(newDniCleaned); // Actualizar el DNI principal si es único y ha cambiado
        return true; 
      } catch (e: any) {
        toast({ title: "Error al verificar DNI", description: e.message, variant: "destructive"});
        return false;
      } finally {
        setIsLoadingQrFlow(false);
      }
  };

  const handleDniExistsWarningConfirm = async () => {
      setShowDniExistsWarningDialog(false);
      // El DNI que causó la advertencia ya está en 'enteredDni'
      // Simular el flujo de DNI existente
      dniForm.setValue("dni", enteredDni); // Poner DNI en el form de DNI
      await handleDniSubmitInModal({ dni: enteredDni });
      setFormDataForDniWarning(null); // Limpiar datos temporales
  };

  const handleNewUserSubmitInModal: SubmitHandler<NewQrClientFormValues> = async (data) => {
      const dniIsValidForCreation = await handleNewUserDniChangeDuringRegistration(data.dniConfirm, data);
      if (dniIsValidForCreation) {
          processNewQrClientRegistration(data);
      }
  };
  
  useEffect(() => {
    const generateQrImage = async () => {
      if (pageViewState === 'qrDisplay' && qrData?.code) {
        try {
          const dataUrl = await QRCode.toDataURL(qrData.code, { width: 250, errorCorrectionLevel: 'H', margin: 2 });
          setGeneratedQrDataUrl(dataUrl);
        } catch (err) {
          console.error("Failed to generate QR code", err);
          toast({ title: "Error", description: "No se pudo generar el código QR.", variant: "destructive" });
          setGeneratedQrDataUrl(null);
        }
      } else {
        setGeneratedQrDataUrl(null);
      }
    };
    generateQrImage();
  }, [qrData, pageViewState, toast]);

  const handleSaveQrWithDetails = async () => {
    if (!qrData || !qrData.user || !qrData.promotion || !generatedQrDataUrl || !businessDetails) {
      toast({ title: "Error", description: "No hay datos de QR para guardar.", variant: "destructive" });
      return;
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast({ title: "Error", description: "No se pudo preparar la imagen para descarga.", variant: "destructive" });
      return;
    }

    const padding = 20;
    let currentY = padding;
    const qrSize = 180;
    const maxLogoHeight = 40; 
    const spacingAfterLogo = 10; 
    const businessNameFontSize = 18;
    const spacingAfterBusinessName = 15;
    const promoTitleFontSize = 20;
    const spacingAfterPromoTitle = 20; 
    const userDetailsFontSize = 16;
    const smallTextFontSize = 10;
    const lineSpacing = 5;
    const canvasWidth = 320;

    canvas.width = canvasWidth;
    // Calculate initial height, will be adjusted
    canvas.height = 550; // Estimate, will be recalculated
    ctx.fillStyle = 'hsl(var(--background))'; // Light Gray
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const businessLogo = new Image();
    businessLogo.crossOrigin = "anonymous";
    
    // Function to draw all content, to be called once logo (if any) is loaded
    const drawContent = () => {
        currentY = padding; 
        const headerBgHeight = maxLogoHeight + spacingAfterLogo + businessNameFontSize + padding * 1.5;
        ctx.fillStyle = 'hsl(var(--primary))'; // Vibrant Purple
        ctx.fillRect(0, 0, canvas.width, headerBgHeight);
        currentY += padding / 2;

        if (businessDetails.logoUrl) {
            const aspectRatio = businessLogo.width / businessLogo.height;
            let logoHeight = businessLogo.height;
            let logoWidth = businessLogo.width;

            if (logoHeight > maxLogoHeight) {
                logoHeight = maxLogoHeight;
                logoWidth = logoHeight * aspectRatio;
            }
            if (logoWidth > canvas.width - 2 * padding) {
                logoWidth = canvas.width - 2 * padding;
                logoHeight = logoWidth / aspectRatio;
            }
            ctx.drawImage(businessLogo, (canvas.width - logoWidth) / 2, currentY, logoWidth, logoHeight);
            currentY += logoHeight + spacingAfterLogo;
        } else {
            currentY += maxLogoHeight + spacingAfterLogo; 
        }
        
        ctx.fillStyle = 'hsl(var(--primary-foreground))'; 
        ctx.font = `bold ${businessNameFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(businessDetails.name, canvas.width / 2, currentY);
        currentY += businessNameFontSize + spacingAfterBusinessName + padding /2 ; 

        ctx.fillStyle = 'hsl(var(--primary))'; 
        ctx.font = `bold ${promoTitleFontSize}px Arial`;
        ctx.fillText(qrData.promotion.title, canvas.width / 2, currentY);
        currentY += promoTitleFontSize + spacingAfterPromoTitle;

        const qrImage = new Image();
        qrImage.onload = () => {
            const qrX = (canvas.width - qrSize) / 2;
            ctx.drawImage(qrImage, qrX, currentY, qrSize, qrSize);
            ctx.strokeStyle = 'hsl(var(--primary))'; 
            ctx.lineWidth = 2;
            ctx.strokeRect(qrX - 2, currentY - 2, qrSize + 4, qrSize + 4);
            currentY += qrSize + padding;

            ctx.fillStyle = 'hsl(var(--primary))';
            ctx.font = `bold ${userDetailsFontSize}px Arial`;
            ctx.fillText(`${qrData.user.name} ${qrData.user.surname}`, canvas.width / 2, currentY);
            currentY += userDetailsFontSize + lineSpacing;

            ctx.fillStyle = 'hsl(var(--foreground))'; 
            ctx.font = `${userDetailsFontSize - 2}px Arial`; 
            ctx.fillText(`DNI/CE: ${qrData.user.dni}`, canvas.width / 2, currentY);
            currentY += (userDetailsFontSize - 2) + padding;

            ctx.font = `italic ${smallTextFontSize}px Arial`;
            ctx.fillStyle = 'hsl(var(--muted-foreground))'; 
            ctx.fillText(`Válido hasta: ${format(parseISO(qrData.promotion.validUntil), "dd MMMM yyyy", { locale: es })}`, canvas.width / 2, currentY);
            currentY += smallTextFontSize + lineSpacing;

            if (qrData.promotion.termsAndConditions) {
              ctx.font = `${smallTextFontSize}px Arial`;
              const lines = [];
              let currentLineText = "Términos: ";
              const words = qrData.promotion.termsAndConditions.split(" ");
              for (const word of words) {
                  const testLine = currentLineText + word + " ";
                  if (ctx.measureText(testLine).width > canvas.width - 2 * padding && currentLineText !== "Términos: ") {
                      lines.push(currentLineText.trim());
                      currentLineText = word + " ";
                  } else {
                      currentLineText = testLine;
                  }
              }
              lines.push(currentLineText.trim());
              
              for (const line of lines) {
                  ctx.fillText(line, canvas.width / 2, currentY);
                  currentY += smallTextFontSize + lineSpacing;
              }
            }
            
            const finalHeight = currentY + padding;
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) return;
            tempCanvas.width = canvas.width;
            tempCanvas.height = finalHeight;
            tempCtx.drawImage(canvas, 0, 0); // Draw the oversized canvas onto the correctly sized one
            
            const dataUrl = tempCanvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `SocioVIP_QR_${qrData.promotion.type}_${qrData.code}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: "QR Guardado", description: "La imagen del QR con detalles se ha descargado." });
        };
        qrImage.onerror = () => {
            toast({ title: "Error", description: "No se pudo cargar la imagen del QR para guardarla.", variant: "destructive" });
        };
        if (generatedQrDataUrl) qrImage.src = generatedQrDataUrl;
        else toast({ title: "Error", description: "URL de QR no generada aún.", variant: "destructive" });
    }; 

    if (businessDetails.logoUrl) {
        businessLogo.onload = drawContent;
        businessLogo.onerror = () => {
            console.warn("Logo del negocio no se pudo cargar. Se procederá sin él.");
            drawContent(); 
        };
        businessLogo.src = businessDetails.logoUrl;
    } else {
        drawContent(); // No logo URL, proceed to draw without it
    }
  };

  const resetQrFlow = () => {
    setPageViewState('entityList');
    setQrData(null);
    setGeneratedQrDataUrl(null);
    setActiveEntityForQr(null);
    setValidatedSpecificCode(null);
    setEnteredDni("");
    dniForm.reset();
    newQrClientForm.reset();
    setShowDniModal(false);
  };

  const SpecificCodeEntryForm = ({ entity }: { entity: BusinessManagedEntity }) => {
    const form = useForm<SpecificCodeFormValues>({
      resolver: zodResolver(specificCodeSchema),
      defaultValues: { specificCode: "" },
    });
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(data => handleSpecificCodeSubmit(entity, data.specificCode))} className="space-y-2 mt-2">
          <FormField
            control={form.control}
            name="specificCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor={`specificCode-${entity.id}`} className="text-xs text-muted-foreground">Código (9 dígitos) <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input
                    id={`specificCode-${entity.id}`}
                    placeholder="ABC123XYZ"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    maxLength={9}
                    className="text-sm h-9"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-9" disabled={isLoadingQrFlow}>
            {isLoadingQrFlow ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCodeIcon className="h-4 w-4 mr-2" />}
            Generar QR
          </Button>
        </form>
      </Form>
    );
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm fixed top-0 left-0 right-0 z-20 w-full">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" passHref className="flex items-center gap-2 group">
                    <SocioVipLogo className="h-10 w-10 text-primary group-hover:animate-pulse" />
                    <div><span className="font-semibold text-2xl text-primary group-hover:text-primary/80">SocioVIP</span><p className="text-xs text-muted-foreground group-hover:text-primary/70">Conexiones que Premian</p></div>
                </Link>
                <PublicHeaderAuth />
            </div>
        </header>
        <div className="flex flex-col items-center justify-center flex-grow pt-20">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
            <p className="text-xl text-muted-foreground">Cargando información del negocio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm fixed top-0 left-0 right-0 z-20 w-full">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" passHref className="flex items-center gap-2 group">
                    <SocioVipLogo className="h-10 w-10 text-primary group-hover:animate-pulse" />
                    <div><span className="font-semibold text-2xl text-primary group-hover:text-primary/80">SocioVIP</span><p className="text-xs text-muted-foreground group-hover:text-primary/70">Conexiones que Premian</p></div>
                </Link>
                <PublicHeaderAuth />
            </div>
        </header>
        <div className="pt-24">
            <AlertTriangle className="h-20 w-20 text-destructive mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-destructive">{error}</h1>
            <Link href="/" passHref className="mt-6">
              <Button variant="outline">Volver a la Página Principal</Button>
            </Link>
        </div>
         <footer className="w-full mt-12 py-8 bg-muted/50 text-center fixed bottom-0 left-0 right-0">
            <p className="text-sm text-muted-foreground">Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociosvip.app</Link></p>
        </footer>
      </div>
    );
  }

  if (!businessDetails && !isLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm fixed top-0 left-0 right-0 z-20 w-full">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" passHref className="flex items-center gap-2 group">
                    <SocioVipLogo className="h-10 w-10 text-primary group-hover:animate-pulse" />
                    <div><span className="font-semibold text-2xl text-primary group-hover:text-primary/80">SocioVIP</span><p className="text-xs text-muted-foreground group-hover:text-primary/70">Conexiones que Premian</p></div>
                </Link>
                <PublicHeaderAuth />
            </div>
        </header>
        <div className="pt-24">
            <Building className="h-20 w-20 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground">Negocio No Encontrado</h1>
            <p className="text-muted-foreground mt-2">La página del negocio con la URL "/b/{params.customUrlPath}" no existe o la URL es incorrecta.</p>
            <Link href="/" passHref className="mt-6">
              <Button variant="outline">Volver a la Página Principal</Button>
            </Link>
        </div>
        <footer className="w-full mt-12 py-8 bg-muted/50 text-center fixed bottom-0 left-0 right-0">
            <p className="text-sm text-muted-foreground">Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociosvip.app</Link></p>
        </footer>
      </div>
    );
  }


  if (pageViewState === 'qrDisplay' && qrData && activeEntityForQr && businessDetails) {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20 w-full">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                     <Link href="/" passHref className="flex items-center gap-2 group">
                        <SocioVipLogo className="h-10 w-10 text-primary group-hover:animate-pulse" />
                        <div><span className="font-semibold text-2xl text-primary group-hover:text-primary/80">SocioVIP</span><p className="text-xs text-muted-foreground group-hover:text-primary/70">Conexiones que Premian</p></div>
                    </Link>
                    <PublicHeaderAuth />
                </div>
            </header>
            <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-8">
                <Card className="w-full max-w-md shadow-xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold text-primary">
                          {activeEntityForQr.type === 'event' ? "Tu Entrada para el Evento" : "Tu Promoción Adquirida"}
                        </CardTitle>
                        <CardDescription>
                            ¡Tu QR está listo! Presenta este código en {businessDetails.name}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {generatedQrDataUrl ? (
                            <Image src={generatedQrDataUrl} alt="Código QR" width={250} height={250} className="mx-auto border rounded-md shadow-md p-1 bg-white" />
                        ) : (
                            <div className="h-[250px] w-[250px] mx-auto flex items-center justify-center border rounded-md bg-muted text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Generando QR...</span>
                            </div>
                        )}
                         <div className="text-center">
                            <p className="text-2xl font-semibold text-primary">{qrData.user.name} {qrData.user.surname}</p>
                            <p className="text-muted-foreground">DNI/CE: {qrData.user.dni}</p>
                        </div>
                        <div className="text-sm space-y-1 text-center border-t pt-3">
                            <p className="font-semibold">{activeEntityForQr.name}</p>
                            <p className="text-muted-foreground">
                                Válido hasta: {format(parseISO(activeEntityForQr.endDate), "dd MMMM yyyy", { locale: es })}
                            </p>
                            {activeEntityForQr.termsAndConditions && (
                                <p className="text-xs text-muted-foreground pt-1">
                                    Términos: {activeEntityForQr.termsAndConditions}
                                </p>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={handleSaveQrWithDetails} className="w-full sm:flex-1" variant="outline" disabled={!generatedQrDataUrl}>
                            <Download className="mr-2 h-4 w-4" /> Guardar QR con Detalles
                        </Button>
                        <Button onClick={resetQrFlow} className="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                             Volver a {businessDetails.name}
                        </Button>
                    </CardFooter>
                </Card>
            </main>
             <footer className="py-8 bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociosvip.app</Link></p>
            </footer>
        </div>
    );
  }

  // Fallback to entity list view if businessDetails is not null
  if (!businessDetails) return null; // Should be caught by loading or error states above

  const events = activeEntitiesForBusiness.filter(e => e.type === 'event');
  const promotions = activeEntitiesForBusiness.filter(e => e.type === 'promotion');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20 w-full">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" passHref className="flex items-center gap-2 group">
                    <SocioVipLogo className="h-10 w-10 text-primary group-hover:animate-pulse" />
                    <div><span className="font-semibold text-2xl text-primary group-hover:text-primary/80">SocioVIP</span><p className="text-xs text-muted-foreground group-hover:text-primary/70">Conexiones que Premian</p></div>
                </Link>
                <PublicHeaderAuth />
            </div>
        </header>

        {businessDetails.publicCoverImageUrl && (
          <div className="relative h-48 md:h-64 lg:h-80 w-full">
            <Image
              src={businessDetails.publicCoverImageUrl}
              alt={`Portada de ${businessDetails.name}`}
              fill
              priority
              className="object-cover"
              data-ai-hint="business cover"
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
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {events.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-primary mb-6 flex items-center">
              <CalendarDays className="h-8 w-8 mr-3" /> Eventos Próximos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Card key={event.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg bg-card">
                  <div className="relative aspect-[16/9] w-full">
                    <Image src={event.imageUrl || "https://placehold.co/600x400.png?text=Evento"} alt={event.name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover" data-ai-hint={event.aiHint || "event party"} />
                  </div>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{event.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-1">
                    <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
                    <p className="text-xs text-muted-foreground">Del {format(parseISO(event.startDate), "dd MMM", { locale: es })} al {format(parseISO(event.endDate), "dd MMM, yyyy", { locale: es })}</p>
                    {event.termsAndConditions && <p className="text-xs text-muted-foreground pt-1 line-clamp-2">Términos: {event.termsAndConditions}</p>}
                  </CardContent>
                  <CardFooter className="flex-col items-start p-4 border-t">
                     <SpecificCodeEntryForm entity={event} />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {promotions.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-primary mb-6 flex items-center">
              <Tag className="h-8 w-8 mr-3" /> Promociones Vigentes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((promo) => (
                 <Card key={promo.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg bg-card">
                  <div className="relative aspect-[16/9] w-full">
                    <Image src={promo.imageUrl || "https://placehold.co/600x400.png?text=Promoción"} alt={promo.name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover" data-ai-hint={promo.aiHint || "discount offer"} />
                  </div>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{promo.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-1">
                    <p className="text-sm text-muted-foreground line-clamp-3">{promo.description}</p>
                    <p className="text-xs text-muted-foreground">Válido hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}</p>
                     {promo.termsAndConditions && <p className="text-xs text-muted-foreground pt-1 line-clamp-2">Términos: {promo.termsAndConditions}</p>}
                  </CardContent>
                  <CardFooter className="flex-col items-start p-4 border-t">
                    <SpecificCodeEntryForm entity={promo} />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}
        
        {!isLoading && !error && events.length === 0 && promotions.length === 0 && (
            <Card className="col-span-full">
                <CardHeader className="text-center">
                    <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                    <CardTitle className="mt-2">No hay Actividad por Ahora</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <CardDescription>Este negocio no tiene eventos o promociones activos en este momento. ¡Vuelve pronto!</CardDescription>
                </CardContent>
            </Card>
        )}
        
        {businessDetails.publicAddress || businessDetails.publicPhone || businessDetails.publicContactEmail ? (
            <section className="mt-12 pt-8 border-t">
                <h2 className="text-xl font-semibold tracking-tight text-foreground mb-4 flex items-center">
                    <Info className="h-6 w-6 mr-2 text-primary" />
                    Información de Contacto
                </h2>
                <div className="space-y-2 text-sm text-muted-foreground">
                    {businessDetails.publicAddress && <p><strong>Dirección:</strong> {businessDetails.publicAddress}</p>}
                    {businessDetails.publicPhone && <p><strong>Teléfono:</strong> {businessDetails.publicPhone}</p>}
                    {businessDetails.publicContactEmail && <p><strong>Email:</strong> <a href={`mailto:${businessDetails.publicContactEmail}`} className="text-primary hover:underline">{businessDetails.publicContactEmail}</a></p>}
                </div>
            </section>
        ) : null }
      </main>

      <footer className="mt-12 py-8 bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground">
          Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociosvip.app</Link>
        </p>
      </footer>
      
      <Dialog open={showDniModal} onOpenChange={(isOpen) => { if (!isOpen) { dniForm.reset(); newQrClientForm.reset(); } setShowDniModal(isOpen); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {currentStepInModal === 'enterDni' ? "Ingresa tu DNI/CE" : "Completa tus Datos"}
            </DialogTitle>
            <UIDialogDescription>
              {currentStepInModal === 'enterDni' 
                ? `Para obtener tu QR para "${activeEntityForQr?.name}".`
                : "Necesitamos algunos datos para generar tu QR."
              }
            </UIDialogDescription>
          </DialogHeader>
          {currentStepInModal === 'enterDni' ? (
            <Form {...dniForm}>
              <form onSubmit={dniForm.handleSubmit(handleDniSubmitInModal)} className="space-y-4 py-2">
                <FormField control={dniForm.control} name="dni" render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="Número de documento" {...field} maxLength={15} disabled={isLoadingQrFlow} autoFocus /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <ShadcnDialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => {setShowDniModal(false); resetQrFlow();}} disabled={isLoadingQrFlow}>Cancelar</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isLoadingQrFlow}>
                    {isLoadingQrFlow ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Verificar DNI"}
                  </Button>
                </ShadcnDialogFooter>
              </form>
            </Form>
          ) : ( 
            <Form {...newQrClientForm}>
              <form onSubmit={newQrClientForm.handleSubmit(handleNewUserSubmitInModal)} className="space-y-3 py-1 max-h-[60vh] overflow-y-auto pr-2">
                <FormField control={newQrClientForm.control} name="dniConfirm" render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Confirma tu número de documento"
                        {...field} 
                        onBlur={(e) => handleNewUserDniChangeDuringRegistration(e.target.value, newQrClientForm.getValues())}
                        maxLength={15} 
                        disabled={isLoadingQrFlow} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newQrClientForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre(s) <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Tus nombres" {...field} disabled={isLoadingQrFlow} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={newQrClientForm.control} name="surname" render={({ field }) => (
                  <FormItem><FormLabel>Apellido(s) <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Tus apellidos" {...field} disabled={isLoadingQrFlow} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={newQrClientForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Celular <span className="text-destructive">*</span></FormLabel><FormControl><Input type="tel" placeholder="987654321" {...field} disabled={isLoadingQrFlow} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={newQrClientForm.control} name="dob" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Fecha de Nacimiento <span className="text-destructive">*</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isLoadingQrFlow}>
                            {field.value ? format(field.value, "d MMMM yyyy", { locale: es }) : <span>Selecciona tu fecha</span>}
                            <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date(new Date().setFullYear(new Date().getFullYear() - 10)) || date < new Date("1920-01-01")} captionLayout="dropdown-buttons" fromYear={1920} toYear={new Date().getFullYear() -10} locale={es} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
                <ShadcnDialogFooter className="pt-3">
                  <Button type="button" variant="outline" onClick={() => {setCurrentStepInModal('enterDni'); newQrClientForm.reset(); dniForm.reset({dni: enteredDni});}} disabled={isLoadingQrFlow}>Volver</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isLoadingQrFlow}>
                    {isLoadingQrFlow ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Registrar y Generar QR"}
                  </Button>
                </ShadcnDialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDniExistsWarningDialog} onOpenChange={setShowDniExistsWarningDialog}>
        <AlertDialogContent>
          <UIAlertTitle className="font-semibold">DNI Ya Registrado</UIAlertTitle>
          <UIDialogDescription>
              El DNI/CE <span className="font-semibold">{enteredDni}</span> ya está registrado como Cliente QR. ¿Deseas usar los datos existentes para generar tu QR?
          </UIDialogDescription>
          <ShadcnDialogFooter>
            <Button variant="outline" onClick={() => { setShowDniExistsWarningDialog(false); newQrClientForm.setValue("dniConfirm", ""); /* Limpiar DNI del form para que re-ingrese */ }}>No, corregir DNI</Button>
            <Button onClick={handleDniExistsWarningConfirm} className="bg-primary hover:bg-primary/90">Sí, usar datos existentes</Button>
          </ShadcnDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    