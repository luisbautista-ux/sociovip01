

"use client";

import { useState, useEffect, useCallback } from "react";
import NextImage from "next/image"; // Renamed import
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { collection, getDocs, query, where, Timestamp, doc, updateDoc, addDoc, serverTimestamp, limit, getDoc } from "firebase/firestore";
import type { BusinessManagedEntity, Business, QrClient, QrCodeData, NewQrClientFormData } from "@/lib/types";
import { format, parseISO, set, startOfDay, endOfDay, getMonth } from "date-fns";
import { es } from "date-fns/locale";
import { isEntityCurrentlyActivatable, sanitizeObjectForFirestore } from "@/lib/utils";
import { Loader2, Building, Tag, CalendarDays, ExternalLink, QrCode as QrCodeIcon, Home, User, ShieldCheck, Download, Info, AlertTriangle, PackageOpen, UserCheck as UserCheckIcon, Edit, LogOut, UserCircle, Camera } from "lucide-react";
import { SocioVipLogo } from "@/components/icons"; // Para el footer
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle as UIDialogTitleComponent, DialogDescription as UIDialogDescriptionComponent, DialogFooter as ShadcnDialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle as UIAlertTitleComponent } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import QRCode from 'qrcode';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { LoginModal } from "@/components/auth/LoginModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter as ShadcnAlertDialogFooterAliased,
  AlertDialogHeader,
  AlertDialogTitle as UIAlertDialogTitleAliased,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const specificCodeFormSchema = z.object({
  specificCode: z.string().length(9, "El código debe tener 9 caracteres alfanuméricos.").regex(/^[A-Z0-9]{9}$/, "El código debe ser alfanumérico y en mayúsculas."),
});
type SpecificCodeFormValues = z.infer<typeof specificCodeFormSchema>;

const dniSchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
});
type DniFormValues = z.infer<typeof dniSchema>;

const newQrClientSchema = z.object({
  name: z.string().min(2, { message: "Nombre es requerido." }),
  surname: z.string().min(2, { message: "Apellido es requerido." }),
  phone: z.string().min(7, { message: "Celular es requerido." }).regex(/^\+?[0-9\s-()]*$/, "Número de celular inválido."),
  dob: z.date({ required_error: "Fecha de nacimiento es requerida." }),
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
});


export default function BusinessPublicPageByUrl() {
  const params = useParams<{ customUrlPath: string }>();
  const { customUrlPath } = params;
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, userProfile, logout, loadingAuth, loadingProfile } = useAuth();
  
  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);
  const [activeEntitiesForBusiness, setActiveEntitiesForBusiness] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [pageViewState, setPageViewState] = useState<'entityList' | 'qrDisplay'>('entityList');
  const [showDniModal, setShowDniModal] = useState(false);
  const [currentStepInModal, setCurrentStepInModal] = useState<'enterDni' | 'newUserForm'>('enterDni');
  const [activeEntityForQr, setActiveEntityForQr] = useState<BusinessManagedEntity | null>(null);
  const [validatedSpecificCode, setValidatedSpecificCode] = useState<string | null>(null);
  const [enteredDni, setEnteredDni] = useState<string>("");
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string | null>(null);
  const [isLoadingQrFlow, setIsLoadingQrFlow] = useState(false);
  const [showDniExistsWarningDialog, setShowDniExistsWarningDialog] = useState(false);
  const [formDataForDniWarning, setFormDataForDniWarning] = useState<NewQrClientFormData | null>(null);

  const [showLoginModal, setShowLoginModal] = useState(false);


  const dniForm = useForm<DniFormValues>({
    resolver: zodResolver(dniSchema),
    defaultValues: { dni: "" },
  });

  const newQrClientForm = useForm<NewQrClientFormData>({
    resolver: zodResolver(newQrClientSchema),
    defaultValues: { name: "", surname: "", phone: "", dob: undefined, dni: "" },
  });

  const fetchBusinessDataByCustomUrl = useCallback(async () => {
    if (!customUrlPath || typeof customUrlPath !== 'string') {
      console.error("BusinessPage by URL: customUrlPath is missing or invalid:", customUrlPath);
      setError("URL de negocio inválida.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log("BusinessPage by URL: Fetching business with customUrlPath:", customUrlPath);

    try {
      const businessQuery = query(
        collection(db, "businesses"),
        where("customUrlPath", "==", customUrlPath.toLowerCase().trim()),
        limit(1)
      );
      const businessSnap = await getDocs(businessQuery);

      if (businessSnap.empty) {
        console.error("BusinessPage by URL: No business found for customUrlPath:", customUrlPath);
        setError("Negocio no encontrado. Verifica que la URL sea correcta.");
        setBusinessDetails(null);
        setActiveEntitiesForBusiness([]);
      } else {
        const businessDoc = businessSnap.docs[0];
        const bizData = businessDoc.data();
        const fetchedBusiness: Business = {
          id: businessDoc.id,
          name: bizData.name || "Nombre de Negocio Desconocido",
          contactEmail: bizData.contactEmail || "", 
          joinDate: bizData.joinDate instanceof Timestamp ? bizData.joinDate.toDate().toISOString() : (bizData.joinDate ? String(bizData.joinDate) : new Date().toISOString()),
          customUrlPath: bizData.customUrlPath || customUrlPath,
          logoUrl: bizData.logoUrl || undefined,
          publicCoverImageUrl: bizData.publicCoverImageUrl || undefined,
          slogan: bizData.slogan || undefined,
          publicContactEmail: bizData.publicContactEmail || undefined,
          publicPhone: bizData.publicPhone || undefined,
          publicAddress: bizData.publicAddress || undefined,
        };
        setBusinessDetails(fetchedBusiness);
        console.log("BusinessPage by URL: Business data found:", fetchedBusiness.name, "ID:", fetchedBusiness.id);

        const entitiesQuery = query(
          collection(db, "businessEntities"),
          where("businessId", "==", fetchedBusiness.id),
          where("isActive", "==", true)
        );
        const entitiesSnapshot = await getDocs(entitiesQuery);
        console.log(`BusinessPage by URL: Fetched ${entitiesSnapshot.docs.length} active entities for business ${fetchedBusiness.id}.`);
        
        const allActiveAndCurrentEntities: BusinessManagedEntity[] = [];
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
              console.warn(`BusinessPage by URL: Entity ${docSnap.id} for business ${entityData.businessId} missing or invalid startDate. Using fallback.`);
              startDateStr = nowStr; 
          }

          if (entityData.endDate instanceof Timestamp) {
              endDateStr = entityData.endDate.toDate().toISOString();
          } else if (typeof entityData.endDate === 'string') {
              endDateStr = entityData.endDate;
          } else if (entityData.endDate instanceof Date) {
              endDateStr = entityData.endDate.toISOString();
          } else {
              console.warn(`BusinessPage by URL: Entity ${docSnap.id} for business ${entityData.businessId} missing or invalid endDate. Using fallback.`);
              endDateStr = nowStr; 
          }
          
          const entityForCheck: BusinessManagedEntity = {
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
            ticketTypes: Array.isArray(entityData.ticketTypes) ? entityData.ticketTypes.map((tt: any) => sanitizeObjectForFirestore({...tt})) : [],
            eventBoxes: Array.isArray(entityData.eventBoxes) ? entityData.eventBoxes.map((eb: any) => sanitizeObjectForFirestore({...eb})) : [],
            assignedPromoters: Array.isArray(entityData.assignedPromoters) ? entityData.assignedPromoters.map((ap: any) => sanitizeObjectForFirestore({...ap})) : [],
            generatedCodes: Array.isArray(entityData.generatedCodes) ? entityData.generatedCodes.map((gc: any) => sanitizeObjectForFirestore({...gc})) : [],
            imageUrl: entityData.imageUrl,
            aiHint: entityData.aiHint,
            termsAndConditions: entityData.termsAndConditions,
            createdAt: entityData.createdAt instanceof Timestamp 
              ? entityData.createdAt.toDate().toISOString() 
              : (typeof entityData.createdAt === 'string' ? entityData.createdAt : (entityData.createdAt instanceof Date ? entityData.createdAt.toISOString() : undefined)),
          };

          if (isEntityCurrentlyActivatable(entityForCheck)) {
            allActiveAndCurrentEntities.push(entityForCheck);
          }
        });
        setActiveEntitiesForBusiness(allActiveAndCurrentEntities.sort((a,b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime()));
      }
    } catch (err: any) {
      console.error("BusinessPage by URL: Error fetching business data:", err);
      setError("No se pudo cargar la información del negocio. Inténtalo de nuevo más tarde.");
      setBusinessDetails(null);
      setActiveEntitiesForBusiness([]);
    } finally {
      setIsLoading(false);
    }
  }, [customUrlPath]); 

  useEffect(() => {
    if (typeof customUrlPath === 'string' && customUrlPath.trim() !== "") {
        fetchBusinessDataByCustomUrl();
    } else if (typeof customUrlPath === 'string' && customUrlPath.trim() === ""){
        setError("URL de negocio inválida.");
        setIsLoading(false);
    }
  }, [customUrlPath, fetchBusinessDataByCustomUrl]);

  const handleSpecificCodeSubmit = (entity: BusinessManagedEntity, codeInputValue: string) => {
    const codeToValidate = codeInputValue.trim().toUpperCase();
    if (!codeToValidate) {
        toast({title: "Código Requerido", description: "Por favor, ingresa el código de 9 dígitos.", variant: "destructive"});
        return;
    }
    if (codeToValidate.length !== 9) {
        toast({title: "Código Inválido", description: "El código debe tener 9 caracteres.", variant: "destructive"});
        return;
    }
    if (!entity.generatedCodes) {
      toast({title: "Sin Códigos", description: `Esta ${entity.type === 'promotion' ? 'promoción' : 'evento'} no tiene códigos creados.`, variant: "destructive"});
      return;
    }

    const foundCodeObject = entity.generatedCodes.find(
      (gc) => gc.value.toUpperCase() === codeToValidate && gc.status === 'available'
    );

    if (foundCodeObject) {
      setActiveEntityForQr(entity);
      setValidatedSpecificCode(codeToValidate); 
      setCurrentStepInModal('enterDni');
      dniForm.reset({ dni: "" });
      setShowDniModal(true);
    } else {
      toast({
        title: "Código Inválido o No Disponible",
        description: `El código "${codeToValidate}" no es válido para esta ${entity.type === 'promotion' ? 'promoción' : 'evento'} o ya fue utilizado/vencido.`,
        variant: "destructive",
      });
    }
  };
  
  const markPromoterCodeAsRedeemed = async (entityId: string, promoterCodeValue: string, clientInfo: { dni: string, name: string, surname: string }) => {
    const entityRef = doc(db, "businessEntities", entityId);
    try {
        const entitySnap = await getDoc(entityRef);
        if (entitySnap.exists()) {
            const entityData = entitySnap.data() as BusinessManagedEntity;
            const existingCodes = entityData.generatedCodes || [];
            const updatedCodes = existingCodes.map(code => {
                if (code.value.toUpperCase() === promoterCodeValue.toUpperCase()) {
                    return {
                        ...code,
                        status: 'redeemed' as const,
                        redemptionDate: new Date().toISOString(),
                        redeemedByInfo: {
                            dni: clientInfo.dni,
                            name: `${clientInfo.name} ${clientInfo.surname}`,
                        }
                    };
                }
                return code;
            });
            await updateDoc(entityRef, { generatedCodes: updatedCodes });
            console.log(`Successfully marked code ${promoterCodeValue} as redeemed for entity ${entityId}.`);
        }
    } catch (error) {
        console.error("Error marking promoter code as redeemed:", error);
        // Optionally, inform the user that there was an issue, but the main flow can continue.
        toast({
            title: "Advertencia",
            description: "No se pudo actualizar el estado del código del promotor, pero tu QR se ha generado.",
            variant: "destructive",
        });
    }
};

  const handleDniSubmitInModal: SubmitHandler<DniFormValues> = async (data) => {
    if (!activeEntityForQr || !validatedSpecificCode || !businessDetails) {
      toast({title: "Error interno", description:"Falta entidad activa, código validado o detalles del negocio.", variant: "destructive"});
      return;
    }
    setIsLoadingQrFlow(true);
    setEnteredDni(data.dni);

    try {
        const qrClientsRef = collection(db, "qrClients");
        const q = query(qrClientsRef, where("dni", "==", data.dni), limit(1));
        const querySnapshot = await getDocs(q);

        let clientForQr: QrClient;

        if (!querySnapshot.empty) {
          const existingClientDoc = querySnapshot.docs[0];
          const clientData = existingClientDoc.data();
          clientForQr = {
            id: existingClientDoc.id,
            dni: clientData.dni,
            name: clientData.name,
            surname: clientData.surname,
            phone: clientData.phone,
            dob: clientData.dob instanceof Timestamp ? clientData.dob.toDate().toISOString() : String(clientData.dob),
            registrationDate: clientData.registrationDate instanceof Timestamp ? clientData.registrationDate.toDate().toISOString() : String(clientData.registrationDate),
          };
          toast({ title: "DNI Verificado", description: "Cliente encontrado. Generando QR." });
          await markPromoterCodeAsRedeemed(activeEntityForQr.id, validatedSpecificCode, clientForQr);
          setShowDniModal(false);
        } else {
          newQrClientForm.reset({ name: "", surname: "", phone: "", dob: undefined, dni: data.dni });
          setCurrentStepInModal('newUserForm');
          setIsLoadingQrFlow(false); 
          return; 
        }
        
        const qrCodeDetailsFromEntity: QrCodeData['entityDetails'] = { 
          id: activeEntityForQr.id,
          title: activeEntityForQr.name,
          description: activeEntityForQr.description,
          validUntil: activeEntityForQr.endDate,
          imageUrl: activeEntityForQr.imageUrl || "",
          promoCode: validatedSpecificCode, // Usamos el código validado de 9 dígitos aquí
          aiHint: activeEntityForQr.aiHint || "",
          type: activeEntityForQr.type,
          termsAndConditions: activeEntityForQr.termsAndConditions,
        };

        setQrData({ user: clientForQr, promotion: qrCodeDetailsFromEntity, code: validatedSpecificCode, status: 'available' });
        setPageViewState('qrDisplay');
    } catch(e: any) {
        console.error("Error verificando DNI:", e);
        toast({ title: "Error de Verificación", description: "No se pudo verificar el DNI. " + e.message, variant: "destructive" });
    } finally {
        if (currentStepInModal !== 'newUserForm') { 
            setIsLoadingQrFlow(false);
        }
    }
  };

  const processNewQrClientRegistration = async (formData: NewQrClientFormData) => {
    if (!activeEntityForQr || !validatedSpecificCode || !enteredDni || !businessDetails) {
         toast({title: "Error interno", description:"Falta información para registrar cliente.", variant: "destructive"});
        return;
    }
    setIsLoadingQrFlow(true);

    const newClientDataToSave = {
      dni: enteredDni, 
      name: formData.name,
      surname: formData.surname,
      phone: formData.phone,
      dob: Timestamp.fromDate(formData.dob), 
      registrationDate: serverTimestamp(),
      generatedForBusinessId: businessDetails.id, 
      generatedForEntityId: activeEntityForQr.id, 
    };

    try {
      const docRef = await addDoc(collection(db, "qrClients"), sanitizeObjectForFirestore(newClientDataToSave));
      const registeredClient: QrClient = {
        id: docRef.id,
        dni: newClientDataToSave.dni,
        name: newClientDataToSave.name,
        surname: newClientDataToSave.surname,
        phone: newClientDataToSave.phone,
        dob: newClientDataToSave.dob.toDate().toISOString(),
        registrationDate: new Date().toISOString(), 
      };
      
      await markPromoterCodeAsRedeemed(activeEntityForQr.id, validatedSpecificCode, registeredClient);

       const qrCodeDetailsFromEntity: QrCodeData['entityDetails'] = { 
            id: activeEntityForQr.id,
            title: activeEntityForQr.name,
            description: activeEntityForQr.description,
            validUntil: activeEntityForQr.endDate,
            imageUrl: activeEntityForQr.imageUrl || "",
            promoCode: validatedSpecificCode, // Usamos el código validado de 9 dígitos aquí
            aiHint: activeEntityForQr.aiHint || "",
            type: activeEntityForQr.type,
            termsAndConditions: activeEntityForQr.termsAndConditions,
        };
      setQrData({ user: registeredClient, promotion: qrCodeDetailsFromEntity, code: validatedSpecificCode, status: 'available' });
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
  
  const handleNewUserDniChangeDuringRegistration = async (newDniValue: string, currentFormData: NewQrClientFormData): Promise<boolean> => {
      const newDniCleaned = newDniValue.trim();
      if (newDniCleaned === enteredDni) return true; 
      if (newDniCleaned.length < 7 || newDniCleaned.length > 15) {
          newQrClientForm.setError("dni", { type: "manual", message: "DNI/CE debe tener entre 7 y 15 caracteres."});
          return false;
      }
      newQrClientForm.clearErrors("dni");

      try {
        setIsLoadingQrFlow(true);
        const qrClientsRef = collection(db, "qrClients");
        const q = query(qrClientsRef, where("dni", "==", newDniCleaned), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            setFormDataForDniWarning(currentFormData); 
            setEnteredDni(newDniCleaned); 
            setShowDniExistsWarningDialog(true);
            return false; 
        }
        setEnteredDni(newDniCleaned); 
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
      dniForm.setValue("dni", enteredDni); 
      await handleDniSubmitInModal({ dni: enteredDni });
      setFormDataForDniWarning(null); 
  };

  const handleNewUserSubmitInModal: SubmitHandler<NewQrClientFormData> = async (data) => {
      if (data.dni.trim() !== enteredDni.trim()) {
        const dniIsValidForCreation = await handleNewUserDniChangeDuringRegistration(data.dni, data);
        if (dniIsValidForCreation) {
            await processNewQrClientRegistration(data);
        }
      } else {
        await processNewQrClientRegistration(data);
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
    const qrSize = 180; 
    const maxLogoHeight = 50;
    const spacingAfterLogo = 20;
    const businessNameFontSize = 14; 
    const spacingAfterBusinessName = 15;
    const entityTitleFontSize = 20; 
    const spacingAfterEntityTitle = 15; 
    const userDetailsFontSize = 16;
    const smallTextFontSize = 10;
    const lineSpacing = 5;
    const canvasWidth = 320; 

    let currentY = 0;
    const businessLogo = document.createElement('img');
    businessLogo.crossOrigin = "anonymous";
    
    let initialEstimatedHeight = padding + maxLogoHeight + spacingAfterLogo + businessNameFontSize + spacingAfterBusinessName + entityTitleFontSize + spacingAfterEntityTitle + qrSize + padding + userDetailsFontSize + lineSpacing + userDetailsFontSize + padding + smallTextFontSize + lineSpacing + padding;
    if (qrData.promotion.termsAndConditions) {
      initialEstimatedHeight += 50; // rough estimate for terms
    }
    canvas.height = initialEstimatedHeight; // Set initial height

    const drawContent = () => {
      ctx.fillStyle = 'hsl(280, 13%, 96%)'; // Light Gray background for the whole canvas
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      currentY = 0;

      // Header con logo y nombre del negocio
      const headerBgHeight = maxLogoHeight + spacingAfterLogo + businessNameFontSize + padding * 1.5;
      ctx.fillStyle = 'hsl(var(--primary))'; // Vibrant Purple
      ctx.fillRect(0, currentY, canvas.width, headerBgHeight);
      currentY += padding; // Padding superior dentro de la cabecera

      if (businessDetails.logoUrl) {
        const aspectRatio = businessLogo.width / businessLogo.height;
        let logoHeight = businessLogo.height;
        let logoWidth = businessLogo.width;

        if (logoHeight > maxLogoHeight) {
          logoHeight = maxLogoHeight;
          logoWidth = logoHeight * aspectRatio;
        }
        if (logoWidth > canvas.width / 2 - padding) { // Ensure logo doesn't take too much width
            logoWidth = canvas.width / 2 - padding;
            logoHeight = logoWidth / aspectRatio;
        }
        ctx.drawImage(businessLogo, (canvas.width - logoWidth) / 2, currentY, logoWidth, logoHeight); // Center logo
        currentY += logoHeight + spacingAfterLogo / 2 ; 
      } else {
        currentY += maxLogoHeight + spacingAfterLogo / 2; // Placeholder space if no logo
      }
      
      ctx.fillStyle = 'hsl(var(--primary-foreground))'; // White text
      ctx.font = `bold ${businessNameFontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(businessDetails.name, canvas.width / 2, currentY);
      currentY += businessNameFontSize + padding / 2; // Padding inferior dentro de la cabecera
      
      currentY = headerBgHeight; // Reset Y to be after the header for next content
      currentY += spacingAfterBusinessName; // Espacio después de la cabecera

      // Título de la Promoción/Evento
      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.font = `bold ${entityTitleFontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(qrData.promotion.title, canvas.width / 2, currentY);
      currentY += entityTitleFontSize + spacingAfterEntityTitle;

      // QR Code
      const qrImage = document.createElement('img');
      qrImage.crossOrigin = "anonymous";
      qrImage.onload = () => {
        const qrX = (canvas.width - qrSize) / 2;
        ctx.drawImage(qrImage, qrX, currentY, qrSize, qrSize);
        ctx.strokeStyle = 'hsl(var(--primary))';
        ctx.lineWidth = 2;
        ctx.strokeRect(qrX - 2, currentY - 2, qrSize + 4, qrSize + 4);
        currentY += qrSize + padding;

        // Nombre y DNI del Usuario
        ctx.fillStyle = 'hsl(var(--primary))';
        ctx.font = `bold ${userDetailsFontSize + 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`${qrData.user.name} ${qrData.user.surname}`, canvas.width / 2, currentY);
        currentY += (userDetailsFontSize + 2) + lineSpacing;

        ctx.fillStyle = 'hsl(var(--foreground))';
        ctx.font = `${userDetailsFontSize - 2}px Arial`;
        ctx.fillText(`DNI/CE: ${qrData.user.dni}`, canvas.width / 2, currentY);
        currentY += (userDetailsFontSize - 2) + padding;

        // Validez
        ctx.font = `italic ${smallTextFontSize}px Arial`;
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.fillText(`Válido hasta: ${format(parseISO(qrData.promotion.validUntil), "dd MMMM yyyy", { locale: es })}`, canvas.width / 2, currentY);
        currentY += smallTextFontSize + lineSpacing + 15;
        
        // Terms and conditions
        const termsLines = qrData.promotion.termsAndConditions ? qrData.promotion.termsAndConditions.split('\n') : [];
        if (qrData.promotion.termsAndConditions) {
            ctx.font = `italic ${smallTextFontSize -1}px Arial`;
            ctx.fillStyle = 'hsl(var(--muted-foreground))';
            ctx.textAlign = 'center';
            termsLines.forEach(line => {
                ctx.fillText(line, canvas.width / 2, currentY);
                currentY += smallTextFontSize + 2;
            });
            currentY += padding / 2;
        }
        
        // Final height adjustment
        canvas.height = currentY;
        // Redraw everything on the resized canvas
        ctx.fillStyle = 'hsl(280, 13%, 96%)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Redraw header
        ctx.fillStyle = 'hsl(var(--primary))';
        ctx.fillRect(0, 0, canvas.width, headerBgHeight);
        let redrawY = padding;
        if (businessDetails.logoUrl) {
             const aspectRatio = businessLogo.width / businessLogo.height;
            let logoHeight = businessLogo.height;
            let logoWidth = businessLogo.width;
            if (logoHeight > maxLogoHeight) { logoHeight = maxLogoHeight; logoWidth = logoHeight * aspectRatio; }
            if (logoWidth > canvas.width / 2 - padding) { logoWidth = canvas.width / 2 - padding; logoHeight = logoWidth / aspectRatio; }
            ctx.drawImage(businessLogo, (canvas.width - logoWidth) / 2, redrawY, logoWidth, logoHeight);
            redrawY += logoHeight + spacingAfterLogo / 2;
        } else { redrawY += maxLogoHeight + spacingAfterLogo / 2; }
        ctx.fillStyle = 'hsl(var(--primary-foreground))';
        ctx.font = `bold ${businessNameFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(businessDetails.name, canvas.width / 2, redrawY);
        // Redraw rest
        redrawY = headerBgHeight + spacingAfterBusinessName;
        ctx.fillStyle = 'hsl(var(--primary))';
        ctx.font = `bold ${entityTitleFontSize}px Arial`;
        ctx.fillText(qrData.promotion.title, canvas.width / 2, redrawY);
        redrawY += entityTitleFontSize + spacingAfterEntityTitle;
        ctx.drawImage(qrImage, qrX, redrawY, qrSize, qrSize);
        ctx.strokeStyle = 'hsl(var(--primary))';
        ctx.lineWidth = 2;
        ctx.strokeRect(qrX - 2, redrawY - 2, qrSize + 4, qrSize + 4);
        redrawY += qrSize + padding;
        ctx.fillStyle = 'hsl(var(--primary))';
        ctx.font = `bold ${userDetailsFontSize + 2}px Arial`;
        ctx.fillText(`${qrData.user.name} ${qrData.user.surname}`, canvas.width / 2, redrawY);
        redrawY += (userDetailsFontSize + 2) + lineSpacing;
        ctx.fillStyle = 'hsl(var(--foreground))';
        ctx.font = `${userDetailsFontSize - 2}px Arial`;
        ctx.fillText(`DNI/CE: ${qrData.user.dni}`, canvas.width / 2, redrawY);
        redrawY += (userDetailsFontSize - 2) + padding;
        ctx.font = `italic ${smallTextFontSize}px Arial`;
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.fillText(`Válido hasta: ${format(parseISO(qrData.promotion.validUntil), "dd MMMM yyyy", { locale: es })}`, canvas.width / 2, redrawY);
        redrawY += smallTextFontSize + lineSpacing + 15;
        if (qrData.promotion.termsAndConditions) {
            ctx.font = `italic ${smallTextFontSize -1}px Arial`;
            ctx.fillStyle = 'hsl(var(--muted-foreground))';
            termsLines.forEach(line => {
                ctx.fillText(line, canvas.width / 2, redrawY);
                redrawY += smallTextFontSize + 2;
            });
        }


        const dataUrl = canvas.toDataURL('image/png');
        const linkElement = document.createElement('a');
        linkElement.href = dataUrl;
        const entityTypeForFilename = qrData.promotion.type === 'event' ? 'Evento' : 'Promo';
        linkElement.download = `SocioVIP_QR_${entityTypeForFilename}_${qrData.code}.png`;
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);
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
        console.warn("Logo del negocio no se pudo cargar para la descarga. Se procederá sin él.");
        drawContent(); // Proceed without logo
      };
      businessLogo.src = businessDetails.logoUrl;
    } else {
      drawContent(); // Proceed without logo if no URL
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

  // Componente para el formulario de código específico
  const SpecificCodeEntryForm = ({ entity }: { entity: BusinessManagedEntity }) => {
    const form = useForm<SpecificCodeFormValues>({
      resolver: zodResolver(specificCodeFormSchema),
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
                <FormLabel htmlFor={`specificCode-${entity.id}`} className="text-xs text-muted-foreground">Código Alfanumérico (9 dígitos) <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input
                    id={`specificCode-${entity.id}`}
                    placeholder="ABC123XYZ"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    maxLength={9}
                    className="text-sm h-9 w-full" 
                    disabled={isLoadingQrFlow}
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
        <div className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20 w-full flex items-center justify-between">
             {/* Placeholder for business logo and name if needed in header later */}
        </div>
        <div className="flex flex-col items-center justify-center flex-grow pt-12">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
            <p className="text-xl text-muted-foreground">Cargando información del negocio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
         {/* Placeholder if SocioVIP logo or other elements are needed here */}
        </div>
        <div className="flex flex-col items-center justify-center flex-grow pt-12">
            <AlertTriangle className="h-20 w-20 text-destructive mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-destructive">{error}</h1>
            <p className="text-muted-foreground mt-2">Ruta intentada: /b/{customUrlPath}</p>
            <Link href="/" passHref>
              <Button variant="outline" className="mt-6">Volver a la Página Principal</Button>
            </Link>
        </div>
      </div>
    );
  }

  if (!businessDetails && !isLoading) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
         <div className="flex items-center justify-between w-full max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          {/* Placeholder */}
         </div>
        <div className="flex flex-col items-center justify-center flex-grow pt-12">
            <Building className="h-20 w-20 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground">Negocio No Encontrado</h1>
            <p className="text-muted-foreground mt-2">La página del negocio con la URL "/b/{customUrlPath}" no existe o la URL es incorrecta.</p>
            <Link href="/" passHref>
              <Button variant="outline" className="mt-6">Volver a la Página Principal</Button>
            </Link>
        </div>
      </div>
    );
  }

  if (pageViewState === 'qrDisplay' && qrData && activeEntityForQr && businessDetails) {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20 w-full">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    {businessDetails.logoUrl && (
                        <NextImage src={businessDetails.logoUrl} alt={`${businessDetails.name} logo`} width={40} height={40} className="h-10 w-auto object-contain rounded"/>
                    )}
                    <div className="ml-3">
                        <h1 className="font-semibold text-xl text-primary group-hover:text-primary/80">{businessDetails.name}</h1>
                        {businessDetails.slogan && <p className="text-xs text-muted-foreground group-hover:text-primary/70">{businessDetails.slogan}</p>}
                    </div>
                </div>
            </header>
            <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-8">
                <Card className="w-full max-w-md shadow-xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold text-primary">
                          {activeEntityForQr.type === 'event' ? "Tu Entrada para el Evento" : "Tu Promoción Adquirida"}
                        </CardTitle>
                        <CardDescription>
                            Presenta este código en {businessDetails.name}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {generatedQrDataUrl ? (
                            <NextImage src={generatedQrDataUrl} alt="Código QR" width={250} height={250} className="mx-auto border rounded-md shadow-md p-1 bg-white" />
                        ) : (
                            <div className="h-[250px] w-[250px] mx-auto flex items-center justify-center border rounded-md bg-muted text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Generando QR...</span>
                            </div>
                        )}
                         <div className="text-center">
                            <p className="text-2xl font-semibold text-primary">Hola, {qrData.user.name} {qrData.user.surname}</p>
                            <p className="text-muted-foreground">DNI/CE: {qrData.user.dni}</p>
                        </div>
                        <div className="text-sm space-y-1 text-center border-t pt-3">
                            <p className="font-semibold">{activeEntityForQr.name}</p>
                            <p className="text-muted-foreground">
                                Válido hasta: {format(parseISO(activeEntityForQr.endDate), "dd MMMM yyyy", { locale: es })}
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={handleSaveQrWithDetails} className="w-full sm:flex-1" variant="outline" disabled={!generatedQrDataUrl}>
                            <Download className="mr-2 h-4 w-4" /> Guardar QR con Detalles
                        </Button>
                        <Button onClick={resetQrFlow} className="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                             Ver Otras del Negocio
                        </Button>
                    </CardFooter>
                </Card>
            </main>
            <footer className="w-full mt-auto py-6 px-4 sm:px-6 lg:px-8 bg-muted/60 text-sm border-t">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                        {!loadingAuth && !loadingProfile && (
                        <>
                            {currentUser && userProfile ? (
                            <>
                                <span className="text-foreground flex items-center">
                                <UserCircle className="h-4 w-4 mr-1.5 text-muted-foreground" />
                                Hola, {userProfile.name || currentUser.email?.split('@')[0]}
                                </span>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">Cerrar Sesión</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><UIAlertDialogTitleAliased>¿Cerrar Sesión?</UIAlertDialogTitleAliased><AlertDialogDescription>¿Estás seguro de que quieres cerrar tu sesión?</AlertDialogDescription></AlertDialogHeader>
                                        <ShadcnAlertDialogFooterAliased>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={logout} className="bg-destructive hover:bg-destructive/90">Sí, Cerrar Sesión</AlertDialogAction>
                                        </ShadcnAlertDialogFooterAliased>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Link href="/auth/dispatcher" passHref>
                                <Button variant="outline" size="sm">Ir a Administración</Button>
                                </Link>
                            </>
                            ) : (
                            <Button variant="outline" size="sm" onClick={() => setShowLoginModal(true)}>
                                Iniciar Sesión
                            </Button>
                            )}
                        </>
                        )}
                        {(loadingAuth || loadingProfile) && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                    </div>
                    <div className="text-muted-foreground">
                        <Link href="/" className="hover:text-primary hover:underline">
                         Plataforma de sociosvip.app
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
  }

  // Fallback para asegurar que businessDetails no es null antes de usarlo extensivamente
  if (!businessDetails) {
    return null; 
  }

  const events = activeEntitiesForBusiness.filter(e => e.type === 'event');
  const promotions = activeEntitiesForBusiness.filter(e => e.type === 'promotion');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20 w-full">
            <div className="max-w-7xl mx-auto flex items-center justify-start"> {/* Cambiado a justify-start */}
                {businessDetails.logoUrl && (
                  <NextImage src={businessDetails.logoUrl} alt={`${businessDetails.name} logo`} width={40} height={40} className="h-10 w-auto object-contain rounded mr-3"/>
                )}
                <div>
                  <h1 className="font-semibold text-xl text-primary group-hover:text-primary/80">{businessDetails.name}</h1>
                  {businessDetails.slogan && <p className="text-xs text-muted-foreground group-hover:text-primary/70">{businessDetails.slogan}</p>}
                </div>
            </div>
        </header>
        
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex-grow w-full">
        {events.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-primary mb-6 flex items-center">
              <CalendarDays className="h-8 w-8 mr-3" /> Eventos Próximos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Card key={event.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg bg-card">
                  <div className="relative aspect-[16/9] w-full">
                    <NextImage src={event.imageUrl || "https://placehold.co/600x400.png?text=Evento"} alt={event.name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover" data-ai-hint={event.aiHint || "event party"} />
                  </div>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{event.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-1">
                    <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
                    <p className="text-xs text-muted-foreground">Del {format(parseISO(event.startDate), "dd MMM", { locale: es })} al {format(parseISO(event.endDate), "dd MMM, yyyy", { locale: es })}</p>
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
                    <NextImage src={promo.imageUrl || "https://placehold.co/600x400.png?text=Promoción"} alt={promo.name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover" data-ai-hint={promo.aiHint || "discount offer"} />
                  </div>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{promo.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-1">
                    <p className="text-sm text-muted-foreground line-clamp-3">{promo.description}</p>
                    <p className="text-xs text-muted-foreground">Válido hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}</p>
                  </CardContent>
                  <CardFooter className="flex-col items-start p-4 border-t">
                    <SpecificCodeEntryForm entity={promo} />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}
        
        {!isLoading && !error && events.length === 0 && promotions.length === 0 && pageViewState === 'entityList' && (
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

      <footer className="w-full mt-auto py-6 px-4 sm:px-6 lg:px-8 bg-muted/60 text-sm border-t">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            {!loadingAuth && !loadingProfile && (
              <>
                {currentUser && userProfile ? (
                  <>
                    <span className="text-foreground flex items-center">
                      <UserCircle className="h-4 w-4 mr-1.5 text-muted-foreground" />
                      Hola, {userProfile.name || currentUser.email?.split('@')[0]}
                    </span>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">Cerrar Sesión</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><UIAlertDialogTitleAliased>¿Cerrar Sesión?</UIAlertDialogTitleAliased><AlertDialogDescription>¿Estás seguro de que quieres cerrar tu sesión?</AlertDialogDescription></AlertDialogHeader>
                            <ShadcnAlertDialogFooterAliased>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={logout} className="bg-destructive hover:bg-destructive/90">Sí, Cerrar Sesión</AlertDialogAction>
                            </ShadcnAlertDialogFooterAliased>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Link href="/auth/dispatcher" passHref>
                       <Button variant="outline" size="sm">Ir a Administración</Button>
                    </Link>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowLoginModal(true)}>
                    Iniciar Sesión
                  </Button>
                )}
              </>
            )}
            {(loadingAuth || loadingProfile) && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
          <div className="text-muted-foreground">
            <Link href="/" className="hover:text-primary hover:underline">
              Plataforma de sociosvip.app
            </Link>
          </div>
        </div>
      </footer>
      
      <Dialog open={showDniModal} onOpenChange={(isOpen) => { 
          if (!isOpen) { 
            dniForm.reset(); 
            newQrClientForm.reset(); 
            setEnteredDni(""); 
            setCurrentStepInModal('enterDni'); 
          }
          setShowDniModal(isOpen); 
        }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <UIDialogTitleComponent>
              {currentStepInModal === 'enterDni' ? "Ingresa tu DNI/CE" : "Completa tus Datos"}
            </UIDialogTitleComponent>
            <UIDialogDescriptionComponent>
              {currentStepInModal === 'enterDni' 
                ? `Para obtener tu QR para "${activeEntityForQr?.name}".`
                : "Necesitamos algunos datos para generar tu QR."
              }
            </UIDialogDescriptionComponent>
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
                <FormField control={newQrClientForm.control} name="dni" render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Confirma tu número de documento"
                        {...field} 
                        onBlur={(e) => handleNewUserDniChangeDuringRegistration(e.target.value, newQrClientForm.getValues())}
                        maxLength={15} 
                        disabled={isLoadingQrFlow || true} 
                        className="disabled:bg-muted/30"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newQrClientForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre(s) <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Tus nombres" {...field} value={field.value || ''} disabled={isLoadingQrFlow} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={newQrClientForm.control} name="surname" render={({ field }) => (
                  <FormItem><FormLabel>Apellido(s) <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Tus apellidos" {...field} value={field.value || ''} disabled={isLoadingQrFlow} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={newQrClientForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Celular <span className="text-destructive">*</span></FormLabel><FormControl><Input type="tel" placeholder="987654321" {...field} value={field.value || ''} disabled={isLoadingQrFlow} /></FormControl><FormMessage /></FormItem>
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
                        <DayPicker
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            locale={es}
                            captionLayout="dropdown"
                            fromYear={1920}
                            toYear={new Date().getFullYear() - 10}
                            disabled={(date) =>
                              date > new Date(new Date().setFullYear(new Date().getFullYear() - 10)) ||
                              date < new Date("1920-01-01")
                            }
                            initialFocus
                          />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
                <ShadcnDialogFooter className="pt-3">
                  <Button type="button" variant="outline" onClick={() => {setCurrentStepInModal('enterDni'); newQrClientForm.reset({dni: enteredDni}); dniForm.setValue('dni', enteredDni);}} disabled={isLoadingQrFlow}>Volver</Button>
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
          <AlertDialogHeader>
            <UIAlertDialogTitleAliased className="font-semibold">DNI Ya Registrado</UIAlertDialogTitleAliased>
            <AlertDialogDescription>
                El DNI/CE <span className="font-semibold">{enteredDni}</span> ya está registrado como Cliente QR. ¿Deseas usar los datos existentes para generar tu QR?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ShadcnAlertDialogFooterAliased>
            <AlertDialogCancel onClick={() => { setShowDniExistsWarningDialog(false); newQrClientForm.setValue("dni", ""); }}>No, corregir DNI</AlertDialogCancel>
            <AlertDialogAction onClick={handleDniExistsWarningConfirm} className="bg-primary hover:bg-primary/90">Sí, usar datos existentes</AlertDialogAction>
          </ShadcnAlertDialogFooterAliased>
        </AlertDialogContent>
      </AlertDialog>
      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  );
}

    
