

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  limit,
  getDoc,
  runTransaction,
  arrayUnion
} from "firebase/firestore";
import type {
  BusinessManagedEntity,
  Business,
  QrClient,
  QrCodeData,
  NewQrClientFormData,
  GeneratedCode,
} from "@/lib/types";
import { format, parseISO, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { anyToDate, isEntityCurrentlyActivatable, sanitizeObjectForFirestore } from "@/lib/utils";
import {
  Loader2,
  Building,
  Tag,
  CalendarDays,
  QrCode as QrCodeIcon,
  PackageOpen,
  UserCircle,
  AlertTriangle,
  Info,
  Download,
  Calendar,
  ArrowLeft,
  History,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as UIDialogTitleComponent,
  DialogDescription as UIDialogDescriptionComponent,
  DialogFooter as ShadcnDialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useAuth } from "@/context/AuthContext";
import { LoginModal } from "@/components/auth/LoginModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as UIDialogDescription,
  AlertDialogFooter as ShadcnAlertDialogFooterAliased,
  AlertDialogHeader,
  AlertDialogTitle as UIAlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SocioVipLogo } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import * as htmlToImage from 'html-to-image';


// --- Helpers robustos para códigos ---
const normalizeCode = (v: unknown) =>
  String(v ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "")            // quita espacios y guiones
    .replace(/[^A-Z0-9]/g, "");       // deja solo A-Z-0-9

const extractCodeString = (codeObj: any) =>
  normalizeCode(codeObj?.value ?? codeObj?.code ?? codeObj?.codigo ?? codeObj?.val);

const isCodeAvailableForUse = (codeObj: any) => {
  const status = String(codeObj?.status ?? codeObj?.estado ?? "").toLowerCase();
  const usedFlag = Boolean(codeObj?.used ?? codeObj?.redeemed ?? codeObj?.isUsed);
  // disponible si NO tiene flags de usado y su status es vacío/available/nuevo/libre
  return !usedFlag && (status === "" || status === "available" || status === "nuevo" || status === "libre");
};


// helper `cn` local
const cn = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

const specificCodeFormSchema = z.object({
  specificCode: z
    .string()
    .length(9, "El código debe tener 9 caracteres alfanuméricos.")
    .regex(/^[A-Z0-9]{9}$/, "El código debe ser alfanumérico y en mayúsculas."),
});
type SpecificCodeFormValues = z.infer<typeof specificCodeFormSchema>;

const DniEntrySchema = z.object({
  docType: z.enum(['dni', 'ce'], { required_error: "Debes seleccionar un tipo de documento." }),
  docNumber: z.string().min(1, "El número de documento es requerido."),
}).superRefine((data, ctx) => {
    if (data.docType === 'dni') {
        if (!/^\d{8}$/.test(data.docNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El DNI debe contener exactamente 8 dígitos numéricos.",
                path: ['docNumber'],
            });
        }
    } else if (data.docType === 'ce') {
        if (!/^\d{10,20}$/.test(data.docNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El Carnet de Extranjería debe tener entre 10 y 20 dígitos numéricos.",
                path: ['docNumber'],
            });
        }
    }
});
type DniFormValues = z.infer<typeof DniEntrySchema>;

const newQrClientSchema = z.object({
  name: z.string().min(2, { message: "Nombre es requerido." }),
  surname: z.string().min(2, { message: "Apellido es requerido." }),
  phone: z.string().regex(/^9\d{8}$/, "El celular debe tener 9 dígitos y empezar con 9."),
  dob: z.date({ required_error: "Fecha de nacimiento es requerida." }),
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
});

type NewQrClientFormData = z.infer<typeof newQrClientSchema>;


export default function BusinessPublicPage() {
  const pathname = usePathname();
  const customUrlPath = React.useMemo(() => {
    if (!pathname) return undefined;
    const parts = pathname.split("/").filter(Boolean); // ["b", "{slug}", ...]
    const i = parts.indexOf("b");
    return i !== -1 && parts[i + 1] ? decodeURIComponent(parts[i + 1]) : undefined;
  }, [pathname]);


  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, userProfile, logout, loadingAuth, loadingProfile } = useAuth();

  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);
  const [promotions, setPromotions] = useState<BusinessManagedEntity[]>([]);
  const [allEvents, setAllEvents] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'all' | 'promotions' | 'events'>('all');

  const [pageViewState, setPageViewState] = useState<"entityList" | "qrDisplay">("entityList");
  const [showDniModal, setShowDniModal] = useState(false);
  const [currentStepInModal, setCurrentStepInModal] = useState<"enterDni" | "newUserForm">("enterDni");
  const [activeEntityForQr, setActiveEntityForQr] = useState<BusinessManagedEntity | null>(null);
  const [validatedCodeObject, setValidatedCodeObject] = useState<GeneratedCode | null>(null);
  const [enteredDni, setEnteredDni] = useState<string>("");
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [isLoadingQrFlow, setIsLoadingQrFlow] = useState(false);
  const [showDniExistsWarningDialog, setShowDniExistsWarningDialog] = useState(false);
  const [formDataForDniWarning, setFormDataForDniWarning] = useState<NewQrClientFormData | null>(null);
  const [isConsultingDni, setIsConsultingDni] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);


  const [showLoginModal, setShowLoginModal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null); // For custom template rendering

  const dniForm = useForm<DniFormValues>({
    resolver: zodResolver(DniEntrySchema),
    defaultValues: { docType: 'dni', docNumber: "" },
  });
  const watchedDocType = dniForm.watch('docType');

  const newQrClientForm = useForm<NewQrClientFormData>({
    resolver: zodResolver(newQrClientSchema),
    defaultValues: { name: "", surname: "", phone: "", dob: undefined, dni: "" },
  });

  const fetchBusinessDataByCustomUrl = useCallback(async () => {
    if (!customUrlPath || typeof customUrlPath !== "string") {
      setError("URL de negocio inválida.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const businessQuery = query(
        collection(db, "businesses"),
        where("customUrlPath", "==", customUrlPath.toLowerCase().trim()),
        limit(1)
      );
      const businessSnap = await getDocs(businessQuery);

      if (businessSnap.empty) {
        setError("Negocio no encontrado. Verifica que la URL sea correcta.");
        setBusinessDetails(null);
        setPromotions([]);
        setAllEvents([]);
      } else {
        const businessDoc = businessSnap.docs[0];
        const bizData = businessDoc.data();
        const fetchedBusiness: Business = {
          id: businessDoc.id,
          name: bizData.name || "Nombre de Negocio Desconocido",
          contactEmail: bizData.contactEmail || "",
          joinDate: anyToDate(bizData.joinDate)?.toISOString() || new Date().toISOString(),
          customUrlPath: bizData.customUrlPath || customUrlPath,
          logoUrl: bizData.logoUrl || undefined,
          publicCoverImageUrl: bizData.publicCoverImageUrl || undefined,
          slogan: bizData.slogan || undefined,
          publicContactEmail: bizData.publicContactEmail || undefined,
          publicPhone: bizData.publicPhone || undefined,
          primaryColor: bizData.primaryColor || '#B080D0',
          secondaryColor: bizData.secondaryColor || '#8E5EA2',
        };
        setBusinessDetails(fetchedBusiness);

        const entitiesQuery = query(
          collection(db, "businessEntities"),
          where("businessId", "==", fetchedBusiness.id),
        );
        const entitiesSnapshot = await getDocs(entitiesQuery);

        const currentPromotions: BusinessManagedEntity[] = [];
        const events: BusinessManagedEntity[] = [];

        entitiesSnapshot.forEach((docSnap) => {
          const entityData = docSnap.data();

          const entity: BusinessManagedEntity = {
            id: docSnap.id,
            businessId: entityData.businessId,
            type: entityData.type,
            name: entityData.name || "Entidad sin nombre",
            description: entityData.description || "",
            startDate: anyToDate(entityData.startDate)?.toISOString() || "",
            endDate: anyToDate(entityData.endDate)?.toISOString() || "",
            isActive: entityData.isActive === undefined ? true : entityData.isActive,
            usageLimit: entityData.usageLimit || 0,
            maxAttendance: entityData.maxAttendance || 0,
            ticketTypes: Array.isArray(entityData.ticketTypes)
              ? entityData.ticketTypes.map((tt: any) => sanitizeObjectForFirestore({ ...tt }))
              : [],
            eventBoxes: Array.isArray(entityData.eventBoxes)
              ? entityData.eventBoxes.map((eb: any) => sanitizeObjectForFirestore({ ...eb }))
              : [],
            assignedPromoters: Array.isArray(entityData.assignedPromoters)
              ? entityData.assignedPromoters.map((ap: any) => sanitizeObjectForFirestore({ ...ap }))
              : [],
            generatedCodes: Array.isArray(entityData.generatedCodes)
              ? entityData.generatedCodes.map((gc: any) => sanitizeObjectForFirestore({ ...gc }))
              : [],
            imageUrl: entityData.imageUrl,
            imageObjectPosition: entityData.imageObjectPosition,
            aiHint: entityData.aiHint,
            termsAndConditions: entityData.termsAndConditions,
            createdAt: anyToDate(entityData.createdAt)?.toISOString() || "",
            qrTemplateImageUrl: entityData.qrTemplateImageUrl,
            qrTemplateLayout: entityData.qrTemplateLayout,
          };

          if (entity.type === 'promotion' && entity.isActive) {
            currentPromotions.push(entity);
          } else if (entity.type === 'event') {
            events.push(entity);
          }
        });
        
        setPromotions(
          currentPromotions.filter(p => isEntityCurrentlyActivatable(p)).sort(
            (a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime()
          )
        );
        setAllEvents(
          events.sort(
            (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
          )
        );
      }
    } catch (err: any) {
      setError("No se pudo cargar la información del negocio. Inténtalo de nuevo más tarde.");
      setBusinessDetails(null);
      setPromotions([]);
      setAllEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [customUrlPath]);

  useEffect(() => {
    if (typeof customUrlPath === "string" && customUrlPath.trim() !== "") {
      fetchBusinessDataByCustomUrl();
    } else if (typeof customUrlPath === "string" && customUrlPath.trim() === "") {
      setError("URL de negocio inválida.");
      setIsLoading(false);
    }
  }, [customUrlPath, fetchBusinessDataByCustomUrl]);


const handleSpecificCodeSubmit = async (entity: BusinessManagedEntity, codeInputValue: string) => {
  const codeToValidate = normalizeCode(codeInputValue);

  if (codeToValidate.length !== 9) {
    toast({
      title: "Código inválido",
      description: "El código debe tener 9 caracteres alfanuméricos.",
      variant: "destructive",
    });
    return;
  }

  setIsLoadingQrFlow(true);
  try {
    const entityRef = doc(db, "businessEntities", entity.id);
    const snap = await getDoc(entityRef);

    if (!snap.exists()) {
      toast({ title: "Error", description: "La promoción o evento ya no existe.", variant: "destructive" });
      return;
    }
    
    const realTimeEntityData: BusinessManagedEntity = { 
        id: snap.id, 
        ...(snap.data() as any),
        startDate: anyToDate(snap.data().startDate)?.toISOString() || "",
        endDate: anyToDate(snap.data().endDate)?.toISOString() || "",
    };

    if (!isEntityCurrentlyActivatable(realTimeEntityData)) {
      toast({
        title: "Promoción/Evento no disponible",
        description: "Esta oferta no está vigente en este momento.",
        variant: "destructive",
      });
      return;
    }
    
    const codes: any[] = Array.isArray(realTimeEntityData.generatedCodes) ? realTimeEntityData.generatedCodes : [];
    const foundCodeObject = codes.find((c) => extractCodeString(c) === codeToValidate);

    if (foundCodeObject && isCodeAvailableForUse(foundCodeObject)) {
      setActiveEntityForQr(realTimeEntityData);
      setValidatedCodeObject(foundCodeObject);
      setCurrentStepInModal("enterDni");
      dniForm.reset({ docType: 'dni', docNumber: "" });
      setShowDniModal(true);
    } else {
      toast({
        title: "Código inválido o no disponible",
        description: `El código "${codeToValidate}" no existe, ya fue utilizado o está vencido.`,
        variant: "destructive",
      });
    }
  } catch (e) {
    console.error("Error validating specific code:", e);
    toast({ title: "Error de validación", description: "No se pudo validar el código.", variant: "destructive" });
  } finally {
    setIsLoadingQrFlow(false);
  }
};

const getFreshEntityData = async (entityId: string): Promise<BusinessManagedEntity> => {
    const entityRef = doc(db, "businessEntities", entityId);
    const docSnap = await getDoc(entityRef);
    if (!docSnap.exists()) {
      throw new Error("La entidad ya no existe.");
    }
    const data = docSnap.data();
    // Ensure all nested date-like fields are properly converted.
    return { 
        id: docSnap.id, 
        ...data,
        startDate: anyToDate(data.startDate)?.toISOString() || "",
        endDate: anyToDate(data.endDate)?.toISOString() || "",
        createdAt: anyToDate(data.createdAt)?.toISOString(),
        qrTemplateImageUrl: data.qrTemplateImageUrl,
        qrTemplateLayout: data.qrTemplateLayout,
    } as BusinessManagedEntity;
};


const handleDniSubmitInModal: SubmitHandler<DniFormValues> = async (data) => {
    if (!activeEntityForQr || !validatedCodeObject || !businessDetails?.id) {
        toast({ title: "Error interno", description: "Falta información clave para continuar (entidad, código o negocio).", variant: "destructive" });
        return;
    }
    setIsLoadingQrFlow(true);
    const docNumberCleaned = data.docNumber.trim();
    setEnteredDni(docNumberCleaned);

    try {
        const response = await fetch('/api/redeem-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entityId: activeEntityForQr.id,
                codeId: validatedCodeObject.id,
                dni: docNumberCleaned,
                businessId: businessDetails.id
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Ocurrió un error en el servidor.');
        }

        if (result.action === 'newUser') {
            newQrClientForm.reset({ name: "", surname: "", phone: "", dob: undefined, dni: docNumberCleaned });
            setCurrentStepInModal("newUserForm");
            
            if (data.docType === 'dni') {
                setIsConsultingDni(true);
                try {
                    const dniApiResponse = await fetch('/api/public/consult-document', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ docNumber: docNumberCleaned, docType: 'dni' }),
                    });
                    if (dniApiResponse.ok) {
                        const dniData = await dniApiResponse.json();
                        
                        const names = dniData.nombres || "";
                        const surnames = `${dniData.apellidoPaterno || ''} ${dniData.apellidoMaterno || ''}`.trim();

                        newQrClientForm.setValue('name', names);
                        newQrClientForm.setValue('surname', surnames);

                        if (dniData.fechaNacimiento) {
                            const [day, month, year] = dniData.fechaNacimiento.split('/');
                            if (day && month && year) {
                                const dob = new Date(`${year}-${month}-${day}T00:00:00`);
                                if (!isNaN(dob.getTime())) {
                                    newQrClientForm.setValue('dob', dob);
                                }
                            }
                        }
                    } else {
                       console.warn(`DNI consultation failed with status ${dniApiResponse.status}.`);
                    }
                } catch (e) {
                    console.warn("DNI consultation API call failed, user will fill manually.", e);
                } finally {
                    setIsConsultingDni(false);
                }
            }
        } else if (result.action === 'userExists') {
            const freshEntityData = await getFreshEntityData(activeEntityForQr.id);
            const clientForQr: QrClient = result.clientData;
             const qrCodeDetails: QrCodeData["promotion"] = {
                id: freshEntityData.id,
                title: freshEntityData.name,
                description: freshEntityData.description,
                validUntil: freshEntityData.endDate,
                imageUrl: freshEntityData.imageUrl || "",
                promoCode: validatedCodeObject.value,
                qrValue: validatedCodeObject.id,
                aiHint: freshEntityData.aiHint || "",
                type: freshEntityData.type,
                termsAndConditions: freshEntityData.termsAndConditions,
                qrTemplateImageUrl: freshEntityData.qrTemplateImageUrl,
                qrTemplateLayout: freshEntityData.qrTemplateLayout,
            };
            setQrData({ user: clientForQr, promotion: qrCodeDetails, code: validatedCodeObject.id, status: "redeemed" });
            setShowDniModal(false);
            setPageViewState("qrDisplay");
             toast({ title: "¡Éxito!", description: "Cliente verificado y código canjeado. Generando QR." });
        }
    } catch (e: any) {
        toast({ title: "Error de Verificación", description: `No se pudo procesar la solicitud. ${e.message}`, variant: "destructive" });
        resetQrFlow();
    } finally {
        setIsLoadingQrFlow(false);
    }
};

const handleNewUserSubmitInModal: SubmitHandler<NewQrClientFormData> = async (formData) => {
    if (!activeEntityForQr || !validatedCodeObject || !enteredDni || !businessDetails) {
      toast({ title: "Error interno", description: "Falta información para registrar cliente.", variant: "destructive" });
      return;
    }
    
    if (formData.dni.trim() !== enteredDni.trim()) {
      toast({ title: "Inconsistencia de DNI", description: "El DNI del formulario no coincide. Por favor, reinicia el proceso.", variant: "destructive" });
      return;
    }

    setIsLoadingQrFlow(true);
    try {
        const response = await fetch('/api/redeem-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entityId: activeEntityForQr.id,
                codeId: validatedCodeObject.id,
                dni: enteredDni,
                businessId: businessDetails.id,
                newClientData: {
                    name: formData.name,
                    surname: formData.surname,
                    phone: formData.phone,
                    dob: formData.dob.toISOString()
                }
            })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Ocurrió un error al registrar el nuevo cliente.');
        }
        
        const freshEntityData = await getFreshEntityData(activeEntityForQr.id);
        const clientForQr: QrClient = result.clientData;
        const qrCodeDetails: QrCodeData["promotion"] = {
            id: freshEntityData.id,
            title: freshEntityData.name,
            description: freshEntityData.description,
            validUntil: freshEntityData.endDate,
            imageUrl: freshEntityData.imageUrl || "",
            promoCode: validatedCodeObject.value,
            qrValue: validatedCodeObject.id,
            aiHint: freshEntityData.aiHint || "",
            type: freshEntityData.type,
            termsAndConditions: freshEntityData.termsAndConditions,
            qrTemplateImageUrl: freshEntityData.qrTemplateImageUrl,
            qrTemplateLayout: freshEntityData.qrTemplateLayout,
        };
  
        setQrData({ user: clientForQr, promotion: qrCodeDetails, code: validatedCodeObject.id, status: "redeemed" });
        setShowDniModal(false);
        setPageViewState("qrDisplay");
        toast({ title: "Registro Exitoso", description: "Cliente registrado. Generando QR." });

    } catch (e: any) {
      toast({ title: "Error de Registro", description: "No se pudo registrar al cliente. " + e.message, variant: "destructive" });
      resetQrFlow();
    } finally {
      setIsLoadingQrFlow(false);
    }
  };


 useEffect(() => {
    if (qrData?.promotion.qrValue && !qrData?.promotion.qrTemplateImageUrl) {
      QRCode.toDataURL(qrData.promotion.qrValue, { width: 400, errorCorrectionLevel: 'H' }, (err, url) => {
        if (err) {
          console.error("Failed to generate QR code:", err);
          setQrCodeImage(null);
        } else {
          setQrCodeImage(url);
        }
      });
    } else {
      setQrCodeImage(null);
    }
  }, [qrData]);

  const handleSaveQrWithDetails = async () => {
    const elementToCapture = cardRef.current;
    if (!elementToCapture) {
        toast({ title: "Error", description: "No se encontró el elemento para descargar.", variant: "destructive" });
        return;
    }
    try {
        const dataUrl = await htmlToImage.toPng(elementToCapture, {
          quality: 1.0,
          pixelRatio: 2,
        });
        const link = document.createElement('a');
        link.download = `SocioVIP_QR_${qrData?.promotion.promoCode}.png`;
        link.href = dataUrl;
        link.click();
        toast({ title: "QR Guardado", description: "La imagen de la tarjeta se ha descargado." });
    } catch (error) {
        console.error('oops, something went wrong!', error);
        toast({ title: "Error al Guardar", description: "No se pudo generar la imagen de la tarjeta.", variant: "destructive" });
    }
  };
  
    const drawPreviewOnCanvas = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas || !qrData || !qrData.promotion.qrTemplateImageUrl) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        try {
            const templateImg = new Image();
            templateImg.crossOrigin = "anonymous";
            templateImg.src = qrData.promotion.qrTemplateImageUrl;
            await new Promise<void>((resolve, reject) => {
                templateImg.onload = () => resolve();
                templateImg.onerror = (err) => {
                  console.error("Failed to load template image:", err);
                  reject(new Error("Image load error"));
                };
            });

            canvas.width = templateImg.width;
            canvas.height = templateImg.height;
            ctx.drawImage(templateImg, 0, 0);

            const layout = qrData.promotion.qrTemplateLayout || {
                qr: { x: 190, y: 350, size: 80 },
                name: { x: 190, y: 450, size: 16 },
                dni: { x: 190, y: 470, size: 12 },
                promoTitle: { x: 190, y: 500, size: 14 },
            };

            const qrDataUrl = await QRCode.toDataURL(qrData.promotion.qrValue, { width: layout.qr.size, errorCorrectionLevel: 'H', margin: 1 });
            const qrImage = new Image();
            qrImage.src = qrDataUrl;
            await new Promise(resolve => qrImage.onload = resolve);
            ctx.drawImage(qrImage, layout.qr.x - layout.qr.size / 2, layout.qr.y - layout.qr.size / 2, layout.qr.size, layout.qr.size);

            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.font = `bold ${layout.name.size || 16}px Arial`;
            ctx.fillText(`${qrData.user.name} ${qrData.user.surname}`, layout.name.x, layout.name.y);
            ctx.font = `${layout.dni.size || 12}px Arial`;
            ctx.fillText(`DNI/CE: ${qrData.user.dni}`, layout.dni.x, layout.dni.y);
            ctx.font = `bold ${layout.promoTitle.size || 14}px Arial`;
            ctx.fillText(qrData.promotion.title, layout.promoTitle.x, layout.promoTitle.y);

        } catch (error) {
            console.error("Error drawing on canvas:", error);
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'red';
            ctx.font = '16px Arial';
            ctx.fillText('Error al cargar plantilla.', canvas.width / 2, canvas.height / 2);
        }
    }, [qrData]);

    useEffect(() => {
        if (pageViewState === 'qrDisplay' && qrData?.promotion.qrTemplateImageUrl) {
            drawPreviewOnCanvas();
        }
    }, [pageViewState, qrData, drawPreviewOnCanvas]);


  const resetQrFlow = () => {
    setPageViewState("entityList");
    setQrData(null);
    setQrCodeImage(null);
    setActiveEntityForQr(null);
    setValidatedCodeObject(null);
    setEnteredDni("");
    dniForm.reset();
    newQrClientForm.reset();
    setShowDniModal(false);
  };

  const SpecificCodeEntryForm = ({ entity }: { entity: BusinessManagedEntity }) => {
    const form = useForm<SpecificCodeFormValues>({
      resolver: zodResolver(specificCodeFormSchema),
      defaultValues: { specificCode: "" },
    });
    
    const isEvent = entity.type === 'event';

    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => handleSpecificCodeSubmit(entity, data.specificCode))}
          className="space-y-2 mt-2"
        >
          <FormField
            control={form.control}
            name="specificCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor={`specificCode-${entity.id}`} className="text-xs text-muted-foreground">
                  Código Alfanumérico (9 dígitos) <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    id={`specificCode-${entity.id}`}
                    placeholder="ABC123XYZ"
                    {...field}
                    onChange={(e) => field.onChange(normalizeCode(e.target.value))}
                    maxLength={9}
                    className="text-sm h-9 w-full"
                    disabled={isLoadingQrFlow}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            size="sm"
            className="w-full h-9 text-white"
            style={{
                backgroundImage: `linear-gradient(to right, ${businessDetails?.primaryColor || '#B080D0'}, ${businessDetails?.secondaryColor || '#8E5EA2'})`
            }}
            disabled={isLoadingQrFlow}
          >
            {isLoadingQrFlow ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (isEvent ? <Calendar className="h-4 w-4 mr-2" /> : <QrCodeIcon className="h-4 w-4 mr-2" />)}
            {isEvent ? "Obtener Entrada" : "Generar QR"}
          </Button>
        </form>
      </Form>
    );
  };

  const PastEventCardFooter = ({ entity }: { entity: BusinessManagedEntity }) => (
    <CardFooter className="flex-col items-center justify-center p-4 border-t bg-muted/50">
        <div className="flex items-center text-sm font-semibold text-muted-foreground">
            <History className="h-4 w-4 mr-2" />
            <span>Evento Finalizado</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
            Finalizó el {format(new Date(entity.endDate), "dd MMMM, yyyy", { locale: es })}
        </p>
    </CardFooter>
  );

  const showPromotions = (view === 'all' || view === 'promotions') && promotions.length > 0;
  const showEvents = (view === 'all' || view === 'events') && allEvents.length > 0;
  const noContentToShow = !isLoading && (
    (view === 'all' && promotions.length === 0 && allEvents.length === 0) ||
    (view === 'promotions' && promotions.length === 0) ||
    (view === 'events' && allEvents.length === 0)
  );


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
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
        <div className="flex flex-col items-center justify-center flex-grow pt-12">
          <AlertTriangle className="h-20 w-20 text-destructive mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-destructive">{error}</h1>
          <p className="text-muted-foreground mt-2">Ruta intentada: /b/{customUrlPath}</p>
          <Link href="/" passHref>
            <Button variant="outline" className="mt-6">
              Volver a la Página Principal
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!businessDetails && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <div className="flex flex-col items-center justify-center flex-grow pt-12">
          <Building className="h-20 w-20 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">Negocio No Encontrado</h1>
          <p className="text-muted-foreground mt-2">
            La página del negocio con la URL "/b/{customUrlPath}" no existe o la URL es incorrecta.
          </p>
          <Link href="/" passHref>
            <Button variant="outline" className="mt-6">
              Volver a la Página Principal
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (pageViewState === "qrDisplay" && qrData && activeEntityForQr && businessDetails) {
     if (qrData.promotion.qrTemplateImageUrl) {
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col">
                 <header
                    className="py-4 px-4 sm:px-6 lg:px-8 shadow-sm sticky top-0 z-20 w-full bg-white"
                    >
                    <div className="max-w-7xl mx-auto flex items-center justify-start">
                        {businessDetails.logoUrl && (
                        <NextImage
                            src={businessDetails.logoUrl}
                            alt={`${businessDetails.name} logo`}
                            width={40}
                            height={40}
                            className="h-10 w-10 object-contain rounded-md bg-white/20 p-1 mr-4"
                        />
                        )}
                        <h1 className="font-semibold text-xl" style={{ color: businessDetails.primaryColor }}>{businessDetails.name}</h1>
                        {businessDetails.slogan && (
                        <p className="text-xs text-muted-foreground ml-3">{businessDetails.slogan}</p>
                        )}
                    </div>
                </header>
                <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-8">
                   <div className="w-full max-w-sm shadow-xl rounded-xl">
                      <canvas ref={canvasRef} className="w-full h-auto" />
                   </div>
                </main>
                <footer className="sticky bottom-0 z-20 w-full bg-white/80 backdrop-blur-sm py-2 px-4 sm:px-6 lg:px-8 border-t space-y-2">
                    <div className="max-w-7xl mx-auto flex items-center justify-between h-12 gap-2">
                        <Button onClick={handleSaveQrWithDetails} variant="outline" className="w-full">
                            <Download className="mr-2 h-4 w-4" /> Guardar QR
                        </Button>
                        <Button onClick={resetQrFlow} className="w-full text-white" style={{ backgroundColor: businessDetails.secondaryColor || '#8E5EA2' }}>
                            Ver Otras del Negocio
                        </Button>
                    </div>
                    <div className="max-w-7xl mx-auto flex items-center justify-between h-12">
                        <Button variant="outline" className="text-primary" onClick={() => setShowLoginModal(true)}>
                            <UserCircle className="mr-2 h-4 w-4" /> Iniciar Sesión
                        </Button>
                        <Link href="/" passHref>
                            <Button variant="link" className="text-primary">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Inicio
                            </Button>
                        </Link>
                    </div>
                </footer>
            </div>
        )
    }

    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header
          className="py-4 px-4 sm:px-6 lg:px-8 shadow-sm sticky top-0 z-20 w-full bg-white"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-start">
            {businessDetails.logoUrl && (
              <NextImage
                src={businessDetails.logoUrl}
                alt={`${businessDetails.name} logo`}
                width={40}
                height={40}
                className="h-10 w-10 object-contain rounded-md bg-white/20 p-1 mr-4"
              />
            )}
            <h1 className="font-semibold text-xl" style={{ color: businessDetails.primaryColor }}>{businessDetails.name}</h1>
            {businessDetails.slogan && (
              <p className="text-xs text-muted-foreground ml-3">{businessDetails.slogan}</p>
            )}
          </div>
        </header>
         <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-8">
            <Card ref={cardRef} className="w-full max-w-sm shadow-xl rounded-xl">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-bold">
                  {activeEntityForQr.type === "event" ? "Tu Entrada para el Evento" : "Tu Promoción"}
                </CardTitle>
                <CardDescription>Presenta este código en {businessDetails.name}.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-4">
                {qrCodeImage ? (
                  <NextImage src={qrCodeImage} alt="Tu código QR" width={250} height={250} className="rounded-lg border p-1" />
                ) : (
                  <div className="h-[250px] w-[250px] flex items-center justify-center border rounded-lg bg-muted text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-lg font-semibold">Hola, {qrData.user.name} {qrData.user.surname}</p>
                  <p className="text-sm text-muted-foreground">DNI/CE: {qrData.user.dni}</p>
                </div>
                <Separator />
                <div className="text-center">
                   <p className="font-semibold">{qrData.promotion.title}</p>
                   <p className="text-xs text-muted-foreground">Válido hasta: {format(parseISO(qrData.promotion.validUntil), "dd MMMM, yyyy", { locale: es })}</p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button onClick={handleSaveQrWithDetails} variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" /> Guardar QR
                </Button>
                <Button onClick={resetQrFlow} className="w-full text-white" style={{ backgroundColor: businessDetails.secondaryColor || '#8E5EA2' }}>
                  Ver Otras del Negocio
                </Button>
              </CardFooter>
            </Card>
        </main>
        <footer className="sticky bottom-0 z-20 w-full bg-white/80 backdrop-blur-sm py-2 px-4 sm:px-6 lg:px-8 border-t">
          <div className="max-w-7xl mx-auto flex items-center justify-between h-12">
            <Button variant="outline" className="text-primary border-primary/50" onClick={() => setShowLoginModal(true)}>
              <UserCircle className="mr-2 h-4 w-4" /> Iniciar Sesión
            </Button>
            <Link href="/" passHref>
              <Button variant="link" className="text-primary">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Inicio
              </Button>
            </Link>
          </div>
        </footer>
      </div>
    )
  }

  if (!businessDetails) return null;

  return (
    <div className="min-h-screen bg-muted/40 text-foreground flex flex-col">
       <header 
         className="sticky top-0 z-20 w-full"
         style={{ 
           backgroundColor: businessDetails.primaryColor || '#B080D0'
         }}
       >
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                 <Link href="/" className="flex items-center gap-2">
                    <SocioVipLogo size={32} />
                    <span className="font-bold text-xl text-white hidden sm:inline">SocioVIP</span>
                 </Link>
              </div>
              <div className="flex items-center gap-2">
                 <Link href="/" passHref>
                    <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Inicio
                    </Button>
                 </Link>
                  <Button variant="outline" className="text-white border-white/50 hover:bg-white/10 hover:text-white" onClick={() => setShowLoginModal(true)}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    Iniciar Sesión
                  </Button>
              </div>
            </div>
         </div>
       </header>

       <div className="relative w-full h-48 md:h-64">
        {businessDetails.publicCoverImageUrl ? (
          <NextImage
            src={businessDetails.publicCoverImageUrl}
            alt={`${businessDetails.name} cover image`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-purple-500 to-purple-700"></div>
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-4">
             {businessDetails.logoUrl && (
              <NextImage
                src={businessDetails.logoUrl}
                alt={`${businessDetails.name} logo`}
                width={80}
                height={80}
                className="h-16 w-16 md:h-20 md:w-20 object-contain rounded-md mx-auto mb-2 border-2 border-white/50 shadow-lg bg-black/20 p-1"
              />
            )}
            <h1 className="font-bold text-2xl md:text-4xl text-white shadow-md">{businessDetails.name}</h1>
            {businessDetails.slogan && (
              <p className="text-sm md:text-lg text-white/90 mt-1 shadow-sm">{businessDetails.slogan}</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="sticky top-16 z-10" style={{ backgroundColor: businessDetails.primaryColor || '#B080D0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-start h-12 gap-6">
                <button onClick={() => setView('all')} className={cn("text-white font-semibold text-sm transition-colors hover:text-white/80", view === 'all' ? 'border-b-2 border-white' : '')}>Ver Todo</button>
                <button onClick={() => setView('promotions')} className={cn("text-white font-semibold text-sm transition-colors hover:text-white/80", view === 'promotions' ? 'border-b-2 border-white' : '')}>Promociones</button>
                <button onClick={() => setView('events')} className={cn("text-white font-semibold text-sm transition-colors hover:text-white/80", view === 'events' ? 'border-b-2 border-white' : '')}>Eventos</button>
            </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex-grow w-full">
        {showPromotions && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-6 flex items-center" style={{ color: businessDetails.primaryColor }}>
              <Tag className="h-7 w-7 mr-3" /> Promociones Vigentes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {promotions.map((promo) => (
                <Card
                  key={promo.id}
                  className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg bg-card group hover:-translate-y-1"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-lg">
                    <NextImage
                      src={promo.imageUrl || "https://placehold.co/600x400.png?text=Promoción"}
                      alt={promo.name}
                      fill
                      className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                      style={{ objectPosition: promo.imageObjectPosition || '50% 50%' }}
                      data-ai-hint={promo.aiHint || "discount offer"}
                    />
                  </div>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{promo.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-1">
                    <p className="text-sm text-muted-foreground line-clamp-3">{promo.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Válido hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col items-start p-4 border-t">
                    <SpecificCodeEntryForm entity={promo} />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}
        
        {showEvents && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-6 flex items-center" style={{ color: businessDetails.primaryColor }}>
              <Calendar className="h-7 w-7 mr-3" /> Eventos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {allEvents.map((event) => (
                <Card
                  key={event.id}
                  className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg bg-card group hover:-translate-y-1"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-lg">
                    <NextImage
                      src={event.imageUrl || "https://placehold.co/600x400.png?text=Evento"}
                      alt={event.name}
                      fill
                      className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                      style={{ objectPosition: event.imageObjectPosition || '50% 50%' }}
                      data-ai-hint={event.aiHint || "party concert"}
                    />
                     {isPast(new Date(event.endDate)) && (
                       <div className="absolute inset-0 bg-black/30" />
                     )}
                  </div>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">{event.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-1">
                    <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Fecha: {format(parseISO(event.startDate), "dd MMMM, yyyy", { locale: es })}
                    </p>
                  </CardContent>
                  {isEntityCurrentlyActivatable(event) ? (
                     <CardFooter className="flex-col items-start p-4 border-t">
                       <SpecificCodeEntryForm entity={event} />
                     </CardFooter>
                  ) : (
                    <PastEventCardFooter entity={event} />
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {noContentToShow && (
          <div className="py-12">
            <Card className="col-span-full">
              <CardHeader className="text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle className="mt-2">
                  {view === 'promotions' && 'No hay Promociones por Ahora'}
                  {view === 'events' && 'No hay Eventos por Ahora'}
                  {view === 'all' && 'No hay Promociones y Eventos por Ahora'}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription>
                  {view === 'promotions' && 'Este negocio no tiene promociones activas en este momento. ¡Vuelve pronto!'}
                  {view === 'events' && 'Este negocio no tiene eventos activos en este momento. ¡Vuelve pronto!'}
                  {view === 'all' && 'Este negocio no tiene promociones o eventos activos en este momento. ¡Vuelve pronto!'}
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        )}

        {businessDetails.publicAddress || businessDetails.publicPhone || businessDetails.publicContactEmail ? (
          <section className="mt-12 pt-8 border-t">
            <h2 className="text-xl font-semibold tracking-tight text-foreground mb-4 flex items-center">
              <Info className="h-6 w-6 mr-2 text-foreground" />
              Información de Contacto
            </h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              {businessDetails.publicAddress && (
                <p>
                  <strong>Dirección:</strong> {businessDetails.publicAddress}
                </p>
              )}
              {businessDetails.publicPhone && (
                <p>
                  <strong>Teléfono:</strong> {businessDetails.publicPhone}
                </p>
              )}
              {businessDetails.publicContactEmail && (
                <p>
                  <strong>Email:</strong>{" "}
                  <a href={`mailto:${businessDetails.publicContactEmail}`} className="text-muted-foreground hover:underline">
                    {businessDetails.publicContactEmail}
                  </a>
                </p>
              )}
            </div>
          </section>
        ) : null}
      </main>

      <Dialog
        open={showDniModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            dniForm.reset();
            newQrClientForm.reset();
            setEnteredDni("");
            setCurrentStepInModal("enterDni");
          }
          setShowDniModal(isOpen);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <UIDialogTitleComponent>
              {currentStepInModal === "enterDni" ? "Ingresa tu Documento" : "Completa tus Datos"}
            </UIDialogTitleComponent>
            <UIDialogDescriptionComponent>
              {currentStepInModal === "enterDni"
                ? `Para obtener tu QR para "${activeEntityForQr?.name}".`
                : "Necesitamos algunos datos para generar tu QR."}
            </UIDialogDescriptionComponent>
          </DialogHeader>
          {currentStepInModal === "enterDni" ? (
            <Form {...dniForm}>
              <form onSubmit={dniForm.handleSubmit(handleDniSubmitInModal)} className="space-y-4 py-2">
                <FormField
                control={dniForm.control}
                name="docType"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Tipo de Documento</FormLabel>
                    <FormControl>
                        <RadioGroup
                            onValueChange={(value) => {
                                field.onChange(value);
                                dniForm.setValue('docNumber', ''); // Reset docNumber on type change
                                dniForm.clearErrors('docNumber');
                            }}
                            defaultValue={field.value}
                            className="grid grid-cols-2 gap-2"
                        >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <Label
                                    htmlFor="docType-dni-public"
                                    className={cn(
                                        "w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                        field.value === 'dni' && "bg-primary text-primary-foreground border-primary"
                                    )}
                                >
                                    <FormControl>
                                        <RadioGroupItem value="dni" id="docType-dni-public" className="sr-only" />
                                    </FormControl>
                                    DNI
                                </Label>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                 <Label
                                    htmlFor="docType-ce-public"
                                    className={cn(
                                        "w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                        field.value === 'ce' && "bg-primary text-primary-foreground border-primary"
                                    )}
                                >
                                    <FormControl>
                                        <RadioGroupItem value="ce" id="docType-ce-public" className="sr-only" />
                                    </FormControl>
                                    Carnet de Extranjería
                                </Label>
                            </FormItem>
                        </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                <FormField
                  control={dniForm.control}
                  name="docNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Número de Documento <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                            placeholder={watchedDocType === 'dni' ? "8 dígitos numéricos" : "10-20 dígitos numéricos"} 
                            {...field} 
                            maxLength={watchedDocType === 'dni' ? 8 : 20}
                            onChange={(e) => {
                                const numericValue = e.target.value.replace(/[^0-9]/g, '');
                                field.onChange(numericValue);
                            }}
                            autoFocus 
                            disabled={isLoadingQrFlow}
                          />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <ShadcnDialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowDniModal(false);
                      resetQrFlow();
                    }}
                    disabled={isLoadingQrFlow}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="text-white font-bold shadow-lg" 
                    style={{
                        backgroundImage: `linear-gradient(to right, ${businessDetails.primaryColor || '#B080D0'}, ${businessDetails.secondaryColor || '#8E5EA2'})`
                    }}
                    disabled={isLoadingQrFlow}>
                    {isLoadingQrFlow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar"}
                  </Button>
                </ShadcnDialogFooter>
              </form>
            </Form>
          ) : (
            <Form {...newQrClientForm}>
              <form onSubmit={newQrClientForm.handleSubmit(handleNewUserSubmitInModal)} className="space-y-3 py-1 max-h-[60vh] overflow-y-auto pr-2">
                {isConsultingDni && (
                    <div 
                        className="flex flex-col items-center justify-center p-6 rounded-lg my-3 text-white"
                        style={{
                            backgroundSize: '400% 400%',
                            animation: 'gradient-animation 15s ease infinite',
                            backgroundImage: `linear-gradient(-45deg, ${businessDetails.primaryColor}, ${businessDetails.secondaryColor}, #ee7752, #e73c7e, #23a6d5, #23d5ab)`
                        }}
                    >
                        <Loader2 className="h-8 w-8 animate-spin mb-3"/>
                        <p className="text-base font-semibold">Verificando identidad...</p>
                        <p className="text-sm opacity-90">Estamos consultando tus datos, un momento.</p>
                    </div>
                )}
                <FormField
                  control={newQrClientForm.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        DNI / Carnet de Extranjería <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Confirma tu número de documento"
                          {...field}
                          disabled={true}
                          className="disabled:bg-muted/30"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                 <FormField
                  control={newQrClientForm.control}
                  name="surname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Apellido(s) <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Tus apellidos" {...field} value={field.value || ""} disabled={isLoadingQrFlow || isConsultingDni} />
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
                      <FormLabel>
                        Nombre(s) <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Tus nombres" {...field} value={field.value || ""} disabled={isLoadingQrFlow || isConsultingDni} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
                <FormField
                  control={newQrClientForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Celular <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                            type="tel" 
                            placeholder="987654321" 
                            {...field} 
                            maxLength={9}
                            onChange={(e) => {
                                const numericValue = e.target.value.replace(/[^0-9]/g, '');
                                field.onChange(numericValue);
                            }}
                            disabled={isLoadingQrFlow || isConsultingDni} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={newQrClientForm.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>
                        Fecha de Nacimiento <span className="text-destructive">*</span>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              disabled={isLoadingQrFlow || isConsultingDni}
                            >
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
                              date > new Date(new Date().setFullYear(new Date().getFullYear() - 10)) || date < new Date("1920-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <ShadcnDialogFooter className="pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCurrentStepInModal("enterDni");
                      newQrClientForm.reset({ dni: enteredDni });
                      dniForm.setValue("docNumber", enteredDni);
                    }}
                    disabled={isLoadingQrFlow || isConsultingDni}
                  >
                    Volver
                  </Button>
                  <Button type="submit" className="text-white font-bold shadow-lg" 
                    style={{
                        backgroundImage: `linear-gradient(to right, ${businessDetails.primaryColor || '#B080D0'}, ${businessDetails.secondaryColor || '#8E5EA2'})`
                    }}
                    disabled={isLoadingQrFlow || isConsultingDni}>
                    {isLoadingQrFlow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Registrar y Generar QR"}
                  </Button>
                </ShadcnDialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  );
}
