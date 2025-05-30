
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
import { collection, getDocs, query, where, Timestamp, doc, updateDoc, addDoc } from "firebase/firestore";
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
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import QRCode from 'qrcode';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Schemas for forms - similar to original src/app/page.tsx
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
  dniConfirm: z.string(), // DNI pre-filled, not usually editable here but good for Zod
});
type NewQrClientFormValues = z.infer<typeof newQrClientSchema>;


export default function BusinessPublicPageByUrl({ params }: { params: { customUrlPath: string } }) {
  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);
  const [activeEntities, setActiveEntities] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // States for QR generation flow
  const [pageViewState, setPageViewState] = useState<'entityList' | 'qrDisplay'>('entityList');
  const [showDniModal, setShowDniModal] = useState(false);
  const [currentStepInModal, setCurrentStepInModal] = useState<'enterDni' | 'newUserForm'>('enterDni');
  const [activeEntityForQr, setActiveEntityForQr] = useState<BusinessManagedEntity | null>(null);
  const [validatedSpecificCode, setValidatedSpecificCode] = useState<string | null>(null); // The 9-digit code
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
    try {
      console.log("BusinessPublicPageByUrl: Fetching business with customUrlPath:", params.customUrlPath);
      const businessQuery = query(
        collection(db, "businesses"),
        where("customUrlPath", "==", params.customUrlPath.toLowerCase().trim()),
        limit(1)
      );
      const businessSnap = await getDocs(businessQuery);

      if (businessSnap.empty) {
        setError("Negocio no encontrado. Verifica que la URL sea correcta.");
        setBusinessDetails(null);
        setActiveEntities([]);
      } else {
        const businessDoc = businessSnap.docs[0];
        const bizData = businessDoc.data() as Omit<Business, 'id'>;
        const fetchedBusiness: Business = { 
          id: businessDoc.id, 
          ...bizData,
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
        console.log("BusinessPublicPageByUrl: Business data found:", fetchedBusiness.name);

        const entitiesQuery = query(
          collection(db, "businessEntities"),
          where("businessId", "==", fetchedBusiness.id),
          where("isActive", "==", true)
        );
        const entitiesSnapshot = await getDocs(entitiesQuery);
        console.log(`BusinessPublicPageByUrl: Fetched ${entitiesSnapshot.docs.length} active entities for business ${fetchedBusiness.id}.`);
        
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
              console.warn(`BusinessPage (Server): Entity ${docSnap.id} for business ${entityData.businessId} missing or invalid startDate. Using fallback.`);
              startDateStr = nowStr; 
          }

          if (entityData.endDate instanceof Timestamp) {
              endDateStr = entityData.endDate.toDate().toISOString();
          } else if (typeof entityData.endDate === 'string') {
              endDateStr = entityData.endDate;
          } else if (entityData.endDate instanceof Date) {
              endDateStr = entityData.endDate.toISOString();
          } else {
              console.warn(`BusinessPage (Server): Entity ${docSnap.id} for business ${entityData.businessId} missing or invalid endDate. Using fallback.`);
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
          if (isEntityCurrentlyActivatable(entityToAdd)) {
            allActiveEntities.push(entityToAdd);
          }
        });
        setActiveEntities(allActiveEntities.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      }
    } catch (err: any) {
      console.error("BusinessPublicPageByUrl: Error fetching business data:", err);
      setError("No se pudo cargar la información del negocio. Inténtalo de nuevo más tarde.");
      setBusinessDetails(null);
      setActiveEntities([]);
    } finally {
      setIsLoading(false);
    }
  }, [params.customUrlPath]);

  useEffect(() => {
    fetchBusinessData();
  }, [fetchBusinessData]);

  // QR Generation Flow Logic (adapted from original src/app/page.tsx)
  const handleSpecificCodeSubmit = (entity: BusinessManagedEntity, codeValue: string) => {
    setIsLoadingQrFlow(true);
    const codeToValidate = codeValue.toUpperCase().trim();
    const foundCode = entity.generatedCodes?.find(
      (gc) => gc.value.toUpperCase() === codeToValidate && gc.status === 'available'
    );

    if (foundCode) {
      setActiveEntityForQr(entity);
      setValidatedSpecificCode(codeToValidate); // Store the valid 9-digit code
      setCurrentStepInModal('enterDni');
      dniForm.reset({ dni: "" }); // Reset DNI form
      setShowDniModal(true);
    } else {
      toast({
        title: "Código Inválido o No Disponible",
        description: "El código ingresado no es válido para esta promoción/evento o ya fue utilizado.",
        variant: "destructive",
      });
    }
    setIsLoadingQrFlow(false);
  };

  const handleDniSubmitInModal = async (data: DniFormValues) => {
    if (!activeEntityForQr || !validatedSpecificCode) return;
    setIsLoadingQrFlow(true);
    setEnteredDni(data.dni);

    const qrClientsRef = collection(db, "qrClients");
    const q = query(qrClientsRef, where("dni", "==", data.dni));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const existingClientDoc = querySnapshot.docs[0];
      const clientData = existingClientDoc.data() as Omit<QrClient, 'id'>;
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
        promotion: { // Using PromotionDetails structure for simplicity in QrCodeData
            id: activeEntityForQr.id,
            title: activeEntityForQr.name,
            description: activeEntityForQr.description,
            validUntil: activeEntityForQr.endDate,
            imageUrl: activeEntityForQr.imageUrl || "",
            promoCode: validatedSpecificCode, // This is the specific 9-digit code
            type: activeEntityForQr.type as 'promotion' | 'event',
            termsAndConditions: activeEntityForQr.termsAndConditions,
            aiHint: activeEntityForQr.aiHint || "",
        },
        code: validatedSpecificCode, // The specific 9-digit code
        status: 'available', // Assuming it's available as it passed the first check
      });
      setShowDniModal(false);
      setPageViewState('qrDisplay');
      toast({ title: "DNI Verificado", description: "Cliente encontrado. Generando QR." });
    } else {
      newQrClientForm.reset({ name: "", surname: "", phone: "", dob: undefined, dniConfirm: data.dni });
      setCurrentStepInModal('newUserForm');
    }
    setIsLoadingQrFlow(false);
  };

  const processNewQrClientRegistration = async (formData: NewQrClientFormValues) => {
    if (!activeEntityForQr || !validatedSpecificCode || !enteredDni) return;
    setIsLoadingQrFlow(true);

    const newClientData: Omit<QrClient, 'id'> = {
      dni: enteredDni,
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
        dob: (newClientData.dob as Timestamp).toDate().toISOString(), // Convert for immediate use
        registrationDate: new Date().toISOString(), // Approximate for immediate use
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
    } catch (e) {
      console.error("Error adding new QrClient: ", e);
      toast({ title: "Error de Registro", description: "No se pudo registrar al cliente.", variant: "destructive" });
    }
    setIsLoadingQrFlow(false);
  };
  
  const handleNewUserDniChangeDuringRegistration = async (newDni: string, currentFormData: NewQrClientFormValues) => {
      if (newDni === enteredDni) return; // No change
      if (newDni.length < 7 || newDni.length > 15) {
          newQrClientForm.setError("dniConfirm", { type: "manual", message: "DNI/CE debe tener entre 7 y 15 caracteres."});
          return;
      }
      newQrClientForm.clearErrors("dniConfirm");

      const qrClientsRef = collection(db, "qrClients");
      const q = query(qrClientsRef, where("dni", "==", newDni));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
          setFormDataForDniWarning(currentFormData); 
          setShowDniExistsWarningDialog(true);
          return false; // DNI exists, stop normal submission
      }
      return true; // DNI is unique or not changed
  };

  const handleDniExistsWarningConfirm = async () => {
      // User confirmed the DNI is theirs, proceed as if this DNI was entered initially
      setShowDniExistsWarningDialog(false);
      if (formDataForDniWarning) {
          const newDni = newQrClientForm.getValues("dniConfirm"); // Get the DNI that triggered the warning
          dniForm.setValue("dni", newDni);
          await handleDniSubmitInModal({ dni: newDni });
          setFormDataForDniWarning(null);
      }
  };

  const handleNewUserSubmitInModal = async (data: NewQrClientFormValues) => {
      const dniIsValidForCreation = await handleNewUserDniChangeDuringRegistration(data.dniConfirm, data);
      if (dniIsValidForCreation) {
          processNewQrClientRegistration(data);
      }
  };
  
  useEffect(() => {
    const generateQrCode = async () => {
      if (pageViewState === 'qrDisplay' && qrData?.code) {
        try {
          const dataUrl = await QRCode.toDataURL(qrData.code, { width: 200, errorCorrectionLevel: 'H', margin: 2 });
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
    generateQrCode();
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
    const logoHeight = 40; 
    const spacingAfterLogo = 10;
    const businessNameFontSize = 18;
    const spacingAfterBusinessName = 10;
    const promoTitleFontSize = 16;
    const spacingAfterPromoTitle = 15;
    const userDetailsFontSize = 14;
    const smallTextFontSize = 10;
    const lineSpacing = 5;
    let currentY = padding;

    // Calculate dynamic height
    ctx.font = `bold ${userDetailsFontSize}px Arial`;
    const userNameText = `${qrData.user.name} ${qrData.user.surname}`;
    const userNameMetrics = ctx.measureText(userNameText);
    
    ctx.font = `${userDetailsFontSize}px Arial`;
    const dniText = `DNI/CE: ${qrData.user.dni}`;
    const dniMetrics = ctx.measureText(dniText);

    ctx.font = `${smallTextFontSize}px Arial`;
    const validUntilText = `Válido hasta: ${format(parseISO(qrData.promotion.validUntil), "dd MMMM yyyy", { locale: es })}`;
    const termsText = qrData.promotion.termsAndConditions ? `Términos: ${qrData.promotion.termsAndConditions}` : "";
    let termsTextHeight = 0;
    if (termsText) {
        const termsLines = []; // Simple line splitting for height calculation
        let currentLine = "";
        const words = termsText.split(" ");
        for (const word of words) {
            const testLine = currentLine + word + " ";
            if (ctx.measureText(testLine).width > (320 - 2 * padding) && currentLine !== "") {
                termsLines.push(currentLine);
                currentLine = word + " ";
            } else {
                currentLine = testLine;
            }
        }
        termsLines.push(currentLine);
        termsTextHeight = termsLines.length * (smallTextFontSize + lineSpacing);
    }
    
    // Header area (Logo + Business Name)
    currentY += logoHeight + spacingAfterLogo + businessNameFontSize + spacingAfterBusinessName;
    // Promo Title
    currentY += promoTitleFontSize + spacingAfterPromoTitle;
    // QR Code
    currentY += qrSize + padding; // Padding after QR
    // User Info
    currentY += userNameMetrics.actualBoundingBoxAscent + userNameMetrics.actualBoundingBoxDescent + lineSpacing;
    currentY += dniMetrics.actualBoundingBoxAscent + dniMetrics.actualBoundingBoxDescent + padding; // Padding after DNI
    // Valid Until
    currentY += smallTextFontSize + lineSpacing;
    // Terms
    currentY += termsTextHeight + padding; // Final padding

    canvas.width = 320;
    canvas.height = currentY;

    // Background
    ctx.fillStyle = 'hsl(280, 13%, 96%)'; // Light gray background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    currentY = padding;

    // Draw Business Logo (placeholder) & Name
    const businessLogo = new Image();
    businessLogo.crossOrigin = "anonymous"; 
    businessLogo.onload = () => {
        const aspectRatio = businessLogo.width / businessLogo.height;
        const newLogoWidth = logoHeight * aspectRatio;
        ctx.drawImage(businessLogo, (canvas.width - newLogoWidth) / 2, currentY, newLogoWidth, logoHeight);
        currentY += logoHeight + spacingAfterLogo;

        ctx.fillStyle = 'hsl(283, 44%, 53%)'; // Primary color for business name text
        ctx.font = `bold ${businessNameFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(businessDetails.name, canvas.width / 2, currentY + businessNameFontSize / 2);
        currentY += businessNameFontSize + spacingAfterBusinessName;
        
        // Draw Promo Title
        ctx.fillStyle = 'hsl(283, 44%, 53%)'; // Primary color
        ctx.font = `bold ${promoTitleFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(qrData.promotion.title, canvas.width / 2, currentY);
        currentY += promoTitleFontSize + spacingAfterPromoTitle;

        // Draw QR Code
        const qrImage = new Image();
        qrImage.onload = () => {
            const qrX = (canvas.width - qrSize) / 2;
            ctx.drawImage(qrImage, qrX, currentY, qrSize, qrSize);
            // Border for QR
            ctx.strokeStyle = 'hsl(283, 44%, 53%)'; // Primary color
            ctx.lineWidth = 2;
            ctx.strokeRect(qrX - 2, currentY - 2, qrSize + 4, qrSize + 4);
            currentY += qrSize + padding;

            // User Name
            ctx.fillStyle = 'hsl(283, 44%, 53%)'; // Primary color
            ctx.font = `bold ${userDetailsFontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(userNameText, canvas.width / 2, currentY);
            currentY += userNameMetrics.actualBoundingBoxAscent + userNameMetrics.actualBoundingBoxDescent + lineSpacing;

            // User DNI
            ctx.fillStyle = '#333333'; // Dark gray
            ctx.font = `${userDetailsFontSize}px Arial`;
            ctx.fillText(dniText, canvas.width / 2, currentY);
            currentY += dniMetrics.actualBoundingBoxAscent + dniMetrics.actualBoundingBoxDescent + padding;

            // Valid Until
            ctx.font = `italic ${smallTextFontSize}px Arial`;
            ctx.fillStyle = '#555555'; // Medium gray
            ctx.fillText(validUntilText, canvas.width / 2, currentY);
            currentY += smallTextFontSize + lineSpacing;

            // Terms and Conditions
            if (qrData.promotion.termsAndConditions) {
                ctx.font = `${smallTextFontSize}px Arial`;
                // Simple text wrapping for terms
                const words = qrData.promotion.termsAndConditions.split(" ");
                let line = "";
                for (const word of words) {
                    const testLine = line + word + " ";
                    if (ctx.measureText(testLine).width > canvas.width - 2 * padding && line !== "") {
                        ctx.fillText(line.trim(), canvas.width / 2, currentY);
                        currentY += smallTextFontSize + lineSpacing;
                        line = word + " ";
                    } else {
                        line = testLine;
                    }
                }
                ctx.fillText(line.trim(), canvas.width / 2, currentY);
            }

            // Download
            const dataUrl = canvas.toDataURL('image/png');
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
        qrImage.src = generatedQrDataUrl;
    };
    businessLogo.onerror = () => { // Fallback if business logo fails to load
        console.warn("Business logo failed to load for download, proceeding without it.");
        // Manually trigger the drawing sequence without the logo if it fails
        currentY = padding; // Reset Y
        ctx.fillStyle = 'hsl(283, 44%, 53%)';
        ctx.font = `bold ${businessNameFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(businessDetails.name, canvas.width / 2, currentY + businessNameFontSize / 2);
        currentY += businessNameFontSize + spacingAfterBusinessName;

        ctx.fillStyle = 'hsl(283, 44%, 53%)';
        ctx.font = `bold ${promoTitleFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(qrData.promotion.title, canvas.width / 2, currentY);
        currentY += promoTitleFontSize + spacingAfterPromoTitle;
        
        const qrImage = new Image();
        qrImage.onload = () => { /* ... rest of drawing logic as above ... */ 
            const qrX = (canvas.width - qrSize) / 2;
            ctx.drawImage(qrImage, qrX, currentY, qrSize, qrSize);
            ctx.strokeStyle = 'hsl(283, 44%, 53%)'; 
            ctx.lineWidth = 2;
            ctx.strokeRect(qrX - 2, currentY - 2, qrSize + 4, qrSize + 4);
            currentY += qrSize + padding;

            ctx.fillStyle = 'hsl(283, 44%, 53%)'; 
            ctx.font = `bold ${userDetailsFontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(userNameText, canvas.width / 2, currentY);
            currentY += userNameMetrics.actualBoundingBoxAscent + userNameMetrics.actualBoundingBoxDescent + lineSpacing;

            ctx.fillStyle = '#333333'; 
            ctx.font = `${userDetailsFontSize}px Arial`;
            ctx.fillText(dniText, canvas.width / 2, currentY);
            currentY += dniMetrics.actualBoundingBoxAscent + dniMetrics.actualBoundingBoxDescent + padding;

            ctx.font = `italic ${smallTextFontSize}px Arial`;
            ctx.fillStyle = '#555555'; 
            ctx.fillText(validUntilText, canvas.width / 2, currentY);
            currentY += smallTextFontSize + lineSpacing;

            if (qrData.promotion.termsAndConditions) {
                ctx.font = `${smallTextFontSize}px Arial`;
                const words = qrData.promotion.termsAndConditions.split(" ");
                let line = "";
                for (const word of words) {
                    const testLine = line + word + " ";
                    if (ctx.measureText(testLine).width > canvas.width - 2 * padding && line !== "") {
                        ctx.fillText(line.trim(), canvas.width / 2, currentY);
                        currentY += smallTextFontSize + lineSpacing;
                        line = word + " ";
                    } else {
                        line = testLine;
                    }
                }
                ctx.fillText(line.trim(), canvas.width / 2, currentY);
            }
            const dataUrl = canvas.toDataURL('image/png');
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

    };
    businessLogo.src = businessDetails.logoUrl || "https://placehold.co/100x40.png?text=Logo"; // Fallback placeholder for logo itself
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
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Cargando información del negocio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm fixed top-0 left-0 right-0 z-20">
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

  if (!businessDetails) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm fixed top-0 left-0 right-0 z-20">
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

  const events = activeEntities.filter(e => e.type === 'event');
  const promotions = activeEntities.filter(e => e.type === 'promotion');

  // Component for individual specific code form
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
                <FormLabel htmlFor={`specificCode-${entity.id}`} className="sr-only">Código de 9 dígitos</FormLabel>
                <FormControl>
                  <Input
                    id={`specificCode-${entity.id}`}
                    placeholder="ABC123XYZ"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    maxLength={9}
                    className="text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoadingQrFlow}>
            {isLoadingQrFlow ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCodeIcon className="h-4 w-4 mr-2" />}
            Generar QR
          </Button>
        </form>
      </Form>
    );
  };


  if (pageViewState === 'qrDisplay' && qrData && activeEntityForQr) {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
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
                          {activeEntityForQr.type === 'event' ? "Entrada para Evento" : "Promoción Adquirida"}
                        </CardTitle>
                        <CardDescription>
                            ¡Tu QR está listo! Presenta este código en {businessDetails.name}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {generatedQrDataUrl ? (
                            <Image src={generatedQrDataUrl} alt="Código QR" width={250} height={250} className="mx-auto border rounded-md shadow-md p-1" />
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="py-4 px-4 sm:px-6 lg:px-8 bg-card/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
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
                    <p className="text-xs text-muted-foreground mb-1">Ingresa el código de 9 dígitos para este evento:</p>
                    <SpecificCodeEntryForm entity={event} />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {promotions.length > 0 && (
          <section>
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
                    <p className="text-xs text-muted-foreground mb-1">Ingresa el código de 9 dígitos para esta promoción:</p>
                    <SpecificCodeEntryForm entity={promo} />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}
        
        {events.length === 0 && promotions.length === 0 && !isLoading && (
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

        <section className="mt-12 pt-8 border-t">
            <h2 className="text-xl font-semibold tracking-tight text-foreground mb-4 flex items-center">
                <Info className="h-6 w-6 mr-2 text-primary" />
                Información de Contacto
            </h2>
            <div className="space-y-2 text-sm text-muted-foreground">
                {businessDetails.publicAddress && <p><strong>Dirección:</strong> {businessDetails.publicAddress}</p>}
                {businessDetails.publicPhone && <p><strong>Teléfono:</strong> {businessDetails.publicPhone}</p>}
                {businessDetails.publicContactEmail && <p><strong>Email:</strong> <a href={`mailto:${businessDetails.publicContactEmail}`} className="text-primary hover:underline">{businessDetails.publicContactEmail}</a></p>}
                 {(!businessDetails.publicAddress && !businessDetails.publicPhone && !businessDetails.publicContactEmail) && (
                    <p>No hay información de contacto pública disponible para este negocio.</p>
                )}
            </div>
        </section>
      </main>

      <footer className="mt-12 py-8 bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground">
          Copyright ©{new Date().getFullYear()} Todos los derechos reservados | Plataforma de <Link href="/" className="hover:text-primary underline">sociosvip.app</Link>
        </p>
      </footer>
      
      {/* DNI Modal and New User Modal */}
      <Dialog open={showDniModal} onOpenChange={setShowDniModal}>
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
                  <Button type="button" variant="outline" onClick={() => setShowDniModal(false)} disabled={isLoadingQrFlow}>Cancelar</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isLoadingQrFlow}>
                    {isLoadingQrFlow ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Verificar DNI"}
                  </Button>
                </ShadcnDialogFooter>
              </form>
            </Form>
          ) : ( // newUserForm
            <Form {...newQrClientForm}>
              <form onSubmit={newQrClientForm.handleSubmit(handleNewUserSubmitInModal)} className="space-y-3 py-1 max-h-[60vh] overflow-y-auto pr-2">
                <FormField control={newQrClientForm.control} name="dniConfirm" render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input 
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
                  <Button type="button" variant="outline" onClick={() => setCurrentStepInModal('enterDni')} disabled={isLoadingQrFlow}>Volver</Button>
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
          <AlertHeader>
            <UIAlertTitle>DNI Ya Registrado</UIAlertTitle>
            <UIDialogDescription>
              El DNI/CE <span className="font-semibold">{newQrClientForm.getValues("dniConfirm")}</span> ya está registrado como Cliente QR. ¿Deseas usar los datos existentes para generar tu QR?
            </UIDialogDescription>
          </AlertHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDniExistsWarningDialog(false); newQrClientForm.setValue("dniConfirm", enteredDni); /* Revert DNI field */ }}>No, corregir DNI</AlertDialogCancel>
            <AlertDialogAction onClick={handleDniExistsWarningConfirm} className="bg-primary hover:bg-primary/90">Sí, usar datos existentes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Sub-component for specific code entry
function SpecificCodeEntryForm({ entity, onSubmit }: { entity: BusinessManagedEntity; onSubmit: (entity: BusinessManagedEntity, code: string) => void }) {
  const form = useForm<SpecificCodeFormValues>({
    resolver: zodResolver(specificCodeSchema),
    defaultValues: { specificCode: "" },
  });
  const [isLoading, setIsLoading] = useState(false); // Local loading for this form

  const handleSubmit = async (data: SpecificCodeFormValues) => {
    setIsLoading(true);
    await onSubmit(entity, data.specificCode); // onSubmit is now async
    setIsLoading(false);
    form.reset(); // Reset form after submission attempt
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-2 mt-2">
        <FormField
          control={form.control}
          name="specificCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={`specificCode-${entity.id}`} className="sr-only">Código de 9 dígitos</FormLabel>
              <FormControl>
                <Input
                  id={`specificCode-${entity.id}`}
                  placeholder="ABC123XYZ"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  maxLength={9}
                  className="text-sm h-9" // Adjusted height
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-9" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCodeIcon className="h-4 w-4 mr-2" />}
          Generar QR
        </Button>
      </form>
    </Form>
  );
}

    