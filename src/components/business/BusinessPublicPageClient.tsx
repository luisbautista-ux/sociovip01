"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  TicketType
} from "@/lib/types";
import { format, isPast, parse, isAfter, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { anyToDate, isEntityCurrentlyActivatable, sanitizeObjectForFirestore, cn } from "@/lib/utils";
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
  Video,
  MapPin,
  Smartphone,
  Mail,
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
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription 
} from "@/components/ui/form";
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
import { ImageCarousel } from "@/components/business/ImageCarousel";
import { VideoCarousel } from "@/components/business/VideoCarousel";
import { ScrollReveal } from "@/components/ui/scroll-reveal";


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

function hexToHsl(hex: string | undefined): string | null {
  if (!hex || !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
    return null;
  }
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  return `${h} ${s}% ${l}%`;
}


export default function BusinessPublicPageClient({ customUrlPath }: { customUrlPath: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, userProfile, logout, loadingAuth, loadingProfile } = useAuth();

  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);
  const [promotions, setPromotions] = useState<BusinessManagedEntity[]>([]);
  const [allEvents, setAllEvents] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'description' | 'promotions' | 'events' | 'gallery'>('description');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [pageViewState, setPageViewState] = useState<"entityList" | "qrDisplay">("entityList");
  const [showDniModal, setShowDniModal] = useState(false);
  const [currentStepInModal, setCurrentStepInModal] = useState<"enterDni" | "newUserForm">("enterDni");
  const [activeEntityForQr, setActiveEntityForQr] = useState<BusinessManagedEntity | null>(null);
  const [validatedCodeObject, setValidatedCodeObject] = useState<GeneratedCode | null>(null);
  const [enteredDni, setEnteredDni] = useState<string>("");
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [isLoadingQrFlow, setIsLoadingQrFlow] = useState(false);
  const [isConsultingDni, setIsConsultingDni] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);


  const [showLoginModal, setShowLoginModal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null); // For custom template rendering
  const [isScrolled, setIsScrolled] = useState(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);

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
          publicCoverImageUrls: bizData.publicCoverImageUrls || [],
          publicVideoUrls: bizData.publicVideoUrls || [],
          slogan: bizData.slogan || undefined,
          publicContactEmail: bizData.publicContactEmail || undefined,
          publicPhone: bizData.publicPhone || undefined,
          publicAddress: bizData.publicAddress, // Keep as is
          primaryColor: bizData.primaryColor || '#053264',
          secondaryColor: bizData.secondaryColor || '#ccffbc',
          description: bizData.description || "",
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
            isPublicAccess: entityData.isPublicAccess || false,
            locationAddress: entityData.locationAddress || "",
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
  
  useEffect(() => {
    if (businessDetails) {
      const primaryHsl = hexToHsl(businessDetails.primaryColor);
      const accentHsl = hexToHsl(businessDetails.secondaryColor);
      
      if (primaryHsl) {
        document.documentElement.style.setProperty('--primary', primaryHsl);
      }
      if (accentHsl) {
        document.documentElement.style.setProperty('--accent', accentHsl);
        // Garantizar que el anillo de enfoque use el color de marca
        document.documentElement.style.setProperty('--ring', accentHsl);
      }
    }
    // Cleanup function to reset colors when component unmounts
    return () => {
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--ring');
    };
  }, [businessDetails]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY || document.documentElement.scrollTop || (mainScrollRef.current ? mainScrollRef.current.scrollTop : 0);
      setIsScrolled(scrollPos > 30);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    const scrollContainer = mainScrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }

    // Ejecutar inmediatamente para capturar posición inicial
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [businessDetails, isLoading]);


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

const handlePublicAccessSubmit = (entity: BusinessManagedEntity) => {
    if (!isEntityCurrentlyActivatable(entity)) {
        toast({ title: "Evento no disponible", description: "Este evento no está vigente en este momento.", variant: "destructive" });
        return;
    }
    setActiveEntityForQr(entity);
    setValidatedCodeObject({
        id: 'PUBLIC_ACCESS',
        value: 'PUBLIC_ACCESS',
        status: 'available',
        entityId: entity.id,
        generatedByName: 'Sistema',
        generatedDate: new Date().toISOString(),
    } as any);
    setCurrentStepInModal("enterDni");
    dniForm.reset({ docType: 'dni', docNumber: "" });
    setShowDniModal(true);
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

const consultExternalDniApi = async (dni: string, docType: 'dni' | 'ce') => {
    try {
        const response = await fetch('/api/public/consult-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni, docType }),
        });
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (e) {
        console.warn("External DNI API call failed, user will fill manually.", e);
        return null;
    }
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
            
            setIsConsultingDni(true);
            try {
                const apiData = await consultExternalDniApi(docNumberCleaned, data.docType);
                if (apiData) {
                    if (apiData.nombreCompleto) {
                        const nameParts = apiData.nombreCompleto.split(' ');
                        const surname = nameParts.slice(-2).join(' ');
                        const name = nameParts.slice(0, -2).join(' ');
                        newQrClientForm.setValue('name', name || "");
                        newQrClientForm.setValue('surname', surname || "");
                    } else if (apiData.nombres && apiData.apellidoPaterno) {
                        newQrClientForm.setValue('name', apiData.nombres || "");
                        newQrClientForm.setValue('surname', `${apiData.apellidoPaterno || ''} ${apiData.apellidoMaterno || ''}`.trim());
                    }

                    if (apiData.fechaNacimiento) {
                        const parsedDate = parse(apiData.fechaNacimiento, 'dd/MM/yyyy', new Date());
                        if (!isNaN(parsedDate.getTime())) {
                            newQrClientForm.setValue('dob', parsedDate);
                        }
                    }
                } else {
                   console.warn(`DNI/CE consultation failed.`);
                }
            } catch (e) {
                console.warn("DNI/CE consultation API call failed, user will fill manually.", e);
            } finally {
                setIsConsultingDni(false);
            }
            
        } else if (result.action === 'userExists' || result.action === 'alreadyRedeemed') {
            const finalCodeObject = result.code || validatedCodeObject;
            toast({ title: "¡Éxito!", description: result.action === 'alreadyRedeemed' ? "QR Recuperado. Redirigiendo..." : "QR Generado. Redirigiendo..." });
            router.push(`/qr/${finalCodeObject.id}`);
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
        const ticketType = freshEntityData.ticketTypes?.find(t => t.id === validatedCodeObject.ticketTypeId);
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
            ticketType: ticketType ? { name: ticketType.name, cost: ticketType.cost, color: ticketType.color } : undefined,
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
    const elementToCapture = qrData?.promotion.qrTemplateImageUrl ? canvasRef.current : cardRef.current;
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
                qr: { x: 190, y: 350, size: 80, color: '#000000' },
                name: { x: 190, y: 450, size: 16, color: '#FFFFFF' },
                dni: { x: 190, y: 470, size: 12, color: '#FFFFFF' },
                promoTitle: { x: 190, y: 500, size: 14, color: '#FFFFFF' },
            };

            const qrDataUrl = await QRCode.toDataURL(qrData.promotion.qrValue, { 
                width: layout.qr.size, 
                errorCorrectionLevel: 'H', 
                margin: 1,
                color: {
                  dark: layout.qr.color || '#000000',
                  light: '#0000' // Transparent background
                }
            });
            const qrImage = new Image();
            qrImage.src = qrDataUrl;
            await new Promise(resolve => qrImage.onload = resolve);
            ctx.drawImage(qrImage, layout.qr.x - layout.qr.size / 2, layout.qr.y - layout.qr.size / 2, layout.qr.size, layout.qr.size);

            ctx.textAlign = 'center';
            
            const fullName = `${qrData.user.name} ${qrData.user.surname}`;
            let nameFontSize = layout.name.size || 16;
            ctx.font = `bold ${nameFontSize}px Arial`;
            ctx.fillStyle = layout.name.color || '#FFFFFF';
            const maxWidth = canvas.width * 0.9;
            while(ctx.measureText(fullName).width > maxWidth && nameFontSize > 8) {
                nameFontSize--;
                ctx.font = `bold ${nameFontSize}px Arial`;
            }
            ctx.fillText(fullName, layout.name.x, layout.name.y);
            
            ctx.font = `bold ${layout.dni.size || 12}px Arial`;
            ctx.fillStyle = layout.dni.color || '#FFFFFF';
            ctx.fillText(`DNI/CE: ${qrData.user.dni}`, layout.dni.x, layout.dni.y);
            
            let promoFontSize = layout.promoTitle.size || 14;
            ctx.font = `bold ${promoFontSize}px Arial`;
            ctx.fillStyle = layout.promoTitle.color || '#FFFFFF';
            while(ctx.measureText(qrData.promotion.title).width > maxWidth && promoFontSize > 8) {
                promoFontSize--;
                ctx.font = `bold ${promoFontSize}px Arial`;
            }
            ctx.fillText(qrData.promotion.title, layout.promoTitle.x, layout.promoTitle.y);
            
            // --- Dibuja la pulsera del tipo de entrada ---
            if (qrData.promotion.ticketType && qrData.promotion.ticketType.name) {
                const ticketType = qrData.promotion.ticketType;
                const rectY = layout.promoTitle.y + 15;
                const rectHeight = 35;
                const textY = rectY + rectHeight / 2 + 5;
                
                ctx.fillStyle = ticketType.color || "#888888";
                ctx.fillRect(0, rectY, canvas.width, rectHeight);

                ctx.font = "bold 16px Arial";
                ctx.fillStyle = "#FFFFFF";
                ctx.textAlign = "center";
                ctx.fillText(ticketType.name.toUpperCase(), canvas.width / 2, textY);
            }


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


  const resetQrFlow = useCallback(() => {
    setPageViewState("entityList");
    setQrData(null);
    setQrCodeImage(null);
    setActiveEntityForQr(null);
    setValidatedCodeObject(null);
    setEnteredDni("");
    dniForm.reset();
    newQrClientForm.reset();
    setShowDniModal(false);
  }, [dniForm, newQrClientForm]);

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
                    className="text-sm h-9 w-full focus-visible:ring-offset-0 transition-all border-2"
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
            className="w-full h-9 text-white font-bold transition-all hover:scale-105 active:scale-95"
            style={{
                backgroundImage: `linear-gradient(to right, ${businessDetails?.primaryColor || '#053264'}, ${businessDetails?.secondaryColor || '#ccffbc'})`
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

  const PastEventCardFooter = ({ entity }: { entity: BusinessManagedEntity }) => {
    const isFinished = isPast(anyToDate(entity.endDate) || new Date());
    
    return (
      <CardFooter className="flex-col items-center justify-center p-4 border-t bg-muted/50">
          <div className="flex items-center text-sm font-semibold text-muted-foreground">
              <History className="h-4 w-4 mr-2" />
              <span>{isFinished ? "Evento Finalizado" : "Evento No Disponible"}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
              {isFinished 
                ? `Finalizó el ${format(anyToDate(entity.endDate)!, "dd MMMM, yyyy", { locale: es })}`
                : "La generación de QRs está desactivada temporalmente."
              }
          </p>
      </CardFooter>
    );
  };

  const showDescription = view === 'description';
  const showPromotions = view === 'promotions';
  const showEvents = view === 'events';
  const showGallery = view === 'gallery';
  const noContentToShow = !isLoading && (
    (view === 'promotions' && promotions.length === 0) ||
    (view === 'events' && allEvents.length === 0) ||
    (view === 'gallery' && (!businessDetails?.publicCoverImageUrls?.length && !businessDetails?.publicVideoUrls?.length))
  );


  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-loader">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative animate-drop-in animate-float mb-6 max-w-[85vw]">
            <SocioVipLogo 
              size={180} 
              variant="pill" 
              pillPadding="py-0 px-[1.5%]" 
              className="!aspect-[1.6/1] !h-auto object-fill border-[1px] border-white/95 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.3)] drop-shadow-lg" 
            />
          </div>
          <p className="mt-4 text-lg font-semibold text-white/90">
            Cargando información del negocio...
          </p>
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
          <p className="text-muted-foreground mt-2">Ruta intentada: /{customUrlPath}</p>
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
            La página del negocio con la URL "/{customUrlPath}" no existe o la URL es incorrecta.
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
    // This view is now handled by redirecting to /qr/[codeId], so this is a fallback.
    return <div>Redirigiendo a tu QR...</div>;
  }

  if (!businessDetails) return null;

  return (
    <div className="h-screen flex flex-col bg-[#0b1319]">
       <header 
          className={cn(
             "fixed top-0 left-0 right-0 z-50 w-full shrink-0 transition-all duration-500",
             isScrolled 
                 ? "bg-white/95 backdrop-blur-md shadow-md border-b border-slate-100 py-3" 
                 : "bg-transparent border-none py-5"
          )}
       >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
             <div className="flex items-center justify-between h-14">
               {/* Brand & Partner Co-Branding */}
               <div className="flex items-center gap-2 sm:gap-4">
                  <Link href="/" className="flex items-center group">
                     {/* SocioVIP logo square animated wrapper */}
                     <div className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-lg overflow-hidden flex items-center justify-center bg-[#070f14] border border-white/10 shadow-sm transition-all group-hover:scale-105 shrink-0">
                        <img 
                           src="https://www.image2url.com/r2/default/gifs/1778861156032-56811580-9ea6-4eab-9dd1-9cec2b902ccb.gif" 
                           alt="SocioVIP Logo" 
                           className="w-full h-full object-cover"
                        />
                     </div>
                  </Link>
                  
                  {businessDetails.logoUrl && (
                     <div 
                        className={cn(
                           "flex items-center gap-2 sm:gap-3 border-l pl-2 sm:pl-4 transition-colors duration-500",
                           isScrolled ? "border-slate-200" : "border-white/20"
                        )}
                     >
                        {/* Business logo: square with rounded corners */}
                        <div className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-lg overflow-hidden border border-white/10 shadow-sm bg-white/5 shrink-0">
                           <NextImage 
                              src={businessDetails.logoUrl} 
                              alt={businessDetails.name} 
                              fill 
                              className="object-cover"
                           />
                        </div>
                        <span 
                           className={cn(
                              "font-black text-sm sm:text-base uppercase tracking-wider transition-colors duration-500 hidden md:inline-block",
                              isScrolled ? "text-slate-800" : "text-white"
                           )}
                        >
                           {businessDetails.name}
                        </span>
                     </div>
                  )}
               </div>
               
               {/* Actions */}
               <div className="flex items-center gap-1.5 sm:gap-3">
                  <Link href="/" passHref>
                     <Button
                         variant="ghost"
                         size="sm"
                         className={cn(
                             "font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all rounded-full px-2 h-9 sm:px-4 sm:h-10 flex items-center gap-1.5 sm:gap-2 bg-transparent border-none",
                             isScrolled 
                                 ? "text-slate-600 hover:bg-slate-100" 
                                 : "text-white hover:bg-white/10"
                         )}
                     >
                       <ArrowLeft className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors", isScrolled ? "text-slate-600" : "text-white")} />
                       <span className="hidden sm:inline">Volver</span>
                     </Button>
                  </Link>
                  <Link href="/login" passHref>
                     <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            "font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-full px-3 h-9 sm:px-5 sm:h-10 flex items-center gap-1.5 sm:gap-2 transition-all shadow-sm bg-transparent",
                            isScrolled
                                ? "border-slate-300 text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900"
                                : "border-2 border-white text-white hover:bg-white hover:text-slate-900"
                        )}
                      >
                       <UserCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                       <span className="hidden sm:inline">Iniciar Sesión</span>
                       <span className="inline sm:hidden">Ingresar</span>
                     </Button>
                  </Link>
               </div>
             </div>
          </div>
       </header>

       <main ref={mainScrollRef} className="flex-grow overflow-y-auto bg-slate-50">
            <div className="w-full px-0 pt-0">
                <ScrollReveal direction="none">
                    <div className="w-full">
                        <ImageCarousel
                        images={businessDetails.publicCoverImageUrls || []}
                        primaryColor={businessDetails.primaryColor}
                        title={businessDetails.name}
                        slogan={businessDetails.slogan}
                        logoUrl={businessDetails.logoUrl}
                        />
                    </div>
                </ScrollReveal>

                <div id="entity-views-tabs" className="w-full bg-[#15222C] border-b border-white/5 shadow-2xl overflow-hidden">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-4 w-full">
                            <button 
                                onClick={() => setView('description')} 
                                className={cn(
                                    "flex flex-col sm:flex-row items-center justify-center py-4 sm:py-6 px-1.5 sm:px-4 gap-1 sm:gap-3 transition-all border-r border-white/5", 
                                    view === 'description' 
                                        ? "bg-slate-900 text-accent font-black" 
                                        : "text-slate-400 hover:bg-slate-900/40 hover:text-white"
                                )}
                            >
                                <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="font-black text-[9px] xs:text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest">Descripción</span>
                            </button>
                            
                            <button 
                                onClick={() => setView('promotions')} 
                                className={cn(
                                    "flex flex-col sm:flex-row items-center justify-center py-4 sm:py-6 px-1.5 sm:px-4 gap-1 sm:gap-3 transition-all border-r border-white/5", 
                                    view === 'promotions' 
                                        ? "bg-slate-900 text-accent font-black" 
                                        : "text-slate-400 hover:bg-slate-900/40 hover:text-white"
                                )}
                            >
                                <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="font-black text-[9px] xs:text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest">Promociones</span>
                            </button>
                            
                            <button 
                                onClick={() => setView('events')} 
                                className={cn(
                                    "flex flex-col sm:flex-row items-center justify-center py-4 sm:py-6 px-1.5 sm:px-4 gap-1 sm:gap-3 transition-all border-r border-white/5", 
                                    view === 'events' 
                                        ? "bg-slate-900 text-accent font-black" 
                                        : "text-slate-400 hover:bg-slate-900/40 hover:text-white"
                                )}
                            >
                                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="font-black text-[9px] xs:text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest">Eventos</span>
                            </button>

                            <button 
                                onClick={() => setView('gallery')} 
                                className={cn(
                                    "flex flex-col sm:flex-row items-center justify-center py-4 sm:py-6 px-1.5 sm:px-4 gap-1 sm:gap-3 transition-all", 
                                    view === 'gallery' 
                                        ? "bg-slate-900 text-accent font-black" 
                                        : "text-slate-400 hover:bg-slate-900/40 hover:text-white"
                                )}
                            >
                                <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="font-black text-[9px] xs:text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest">Experiencia</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-4 sm:px-6 lg:px-8 mt-16 max-w-7xl mx-auto mb-20">
                    {showDescription && (
                        <ScrollReveal direction="up">
                            <div className="space-y-12">
                                {/* Description Card */}
                                <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-[0_4px_30px_rgba(0,0,0,0.015)] border border-slate-100">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                                        {/* Left Column */}
                                        <div className="space-y-6">
                                            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-slate-800" style={{ color: businessDetails.primaryColor }}>
                                                {businessDetails.name}
                                            </h2>
                                            <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] border-l-4 pl-4" style={{ borderColor: businessDetails.primaryColor }}>
                                                Ficha Oficial • SocioVIP
                                            </p>
                                            <div className="text-lg leading-relaxed text-slate-600 font-bold">
                                                {businessDetails.slogan || "Garantía de calidad excepcional y servicio preferente."}
                                            </div>
                                        </div>
                                        
                                        {/* Right Column */}
                                        <div className="space-y-6">
                                            <div className="text-base leading-relaxed text-slate-600 whitespace-pre-wrap font-medium">
                                                {businessDetails.description || "Este negocio aún no ha proporcionado una descripción detallada en su ficha de SocioVIP. Por favor, explora las promociones y eventos disponibles o ponte en contacto directo para obtener más detalles de sus exclusivos servicios."}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Details Row */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-start gap-4">
                                        <div className="mt-1 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                                            <MapPin className="h-5 w-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">Ubicación</h4>
                                            <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                                                {businessDetails.publicAddress || "Dirección no disponible"}
                                            </p>
                                            {businessDetails.publicAddress && (
                                                <a 
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessDetails.publicAddress)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-bold mt-2 inline-block hover:underline"
                                                    style={{ color: businessDetails.primaryColor }}
                                                >
                                                    Ver en Google Maps
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-start gap-4">
                                        <div className="mt-1 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                                            <CalendarDays className="h-5 w-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">Horarios</h4>
                                            <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                                                Lunes a Domingo.<br/>
                                                <span className="font-medium text-slate-400">Abierto incluso feriados.</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-start gap-4">
                                        <div className="mt-1 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                                            <Smartphone className="h-5 w-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">Contacto directo</h4>
                                            <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                                                {businessDetails.publicPhone || "Teléfono no disponible"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Elite branding card */}
                                <div className="relative overflow-hidden rounded-3xl p-8 border border-[#eedca5] bg-gradient-to-br from-[#fdfbf7] to-[#f5eed6] flex flex-col items-center text-center shadow-sm">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#ebd28a]/20 rounded-full blur-2xl animate-pulse" />
                                    <SocioVipLogo size={56} variant="pill" pillPadding="py-0 px-[1%]" className="mb-4 drop-shadow-md animate-float" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#8a6d25] bg-[#ebd28a]/35 px-4 py-1.5 rounded-full mb-3">
                                        Establecimiento Verificado
                                    </span>
                                    <p className="text-sm text-[#6e5820] font-bold leading-relaxed max-w-lg">
                                        Este establecimiento ha sido auditado y cumple con las normas de servicio preferente de SocioVIP.<br/>
                                        <span className="font-medium text-[#8c7438] text-xs mt-1 block">Recibe un trato preferencial y acumula beneficios en cada visita.</span>
                                    </p>
                                </div>
                            </div>
                        </ScrollReveal>
                    )}

                    {showPromotions && (
                      <section className="space-y-8">
                        <div className="text-center space-y-2 mb-12">
                          <span className="font-black text-xs uppercase tracking-[0.2em]" style={{ color: businessDetails.primaryColor }}>
                            Nuestras Ofertas
                          </span>
                          <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
                            PROMOCIONES DISPONIBLES
                          </h2>
                          <div className="h-[3px] w-16 mx-auto rounded-full mt-4" style={{ backgroundColor: businessDetails.primaryColor }} />
                        </div>

                        {promotions.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-8">
                                {promotions.map((promo, index) => (
                                    <ScrollReveal key={promo.id} delay={index * 100}>
                                        <Card className="shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col overflow-hidden rounded-3xl bg-card border border-slate-100 group hover:-translate-y-2 h-full">
                                        <div className="relative aspect-[16/9] w-full overflow-hidden">
                                            <NextImage 
                                                src={promo.imageUrl || "https://placehold.co/600x400.png?text=Promoción"} 
                                                alt={promo.name} fill 
                                                className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-110" 
                                                style={{ objectPosition: promo.imageObjectPosition || '50% 50%' }} 
                                                data-ai-hint={promo.aiHint || "discount offer"}
                                            />
                                            <div className="absolute top-4 right-4 bg-slate-900/90 text-white font-black text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-full backdrop-blur-sm shadow-md">
                                                Promoción
                                            </div>
                                        </div>
                                        <CardHeader className="pb-3 px-6 pt-6">
                                            <CardTitle className="text-xl font-black text-slate-800">{promo.name}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="flex-grow space-y-4 px-6">
                                            <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed font-medium">{promo.description}</p>
                                            <p className="text-[10px] font-bold text-slate-400 bg-slate-50 py-1.5 px-3 rounded-full inline-block border border-slate-100 uppercase tracking-widest">
                                                Hasta el {format(parseISO(promo.endDate), "dd MMMM, yyyy", { locale: es })}
                                            </p>
                                        </CardContent>
                                        <CardFooter className="flex-col items-start p-6 border-t border-slate-100 bg-slate-50/50"><SpecificCodeEntryForm entity={promo} /></CardFooter>
                                        </Card>
                                    </ScrollReveal>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12"><Card className="col-span-full border-dashed border-2 rounded-3xl"><CardHeader className="text-center"><PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" /><CardTitle className="mt-2 text-xl font-black text-slate-800">No hay Promociones por Ahora</CardTitle></CardHeader><CardContent className="text-center"><CardDescription className="text-sm font-semibold">Este negocio no tiene promociones activas en este momento. ¡Vuelve pronto!</CardDescription></CardContent></Card></div>
                        )}
                      </section>
                    )}
                    
                    {showEvents && (
                      <section>
                        <h2 className="text-3xl font-bold tracking-tight mb-8 flex items-center" style={{ color: businessDetails.primaryColor }}>
                          <Calendar className="h-8 w-8 mr-3" /> Próximos Eventos
                        </h2>
                        {allEvents.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
                            {allEvents.map((event, index) => {
                                const location = event.locationAddress || (businessDetails.publicAddress);
                                return (
                                    <ScrollReveal key={event.id} delay={index * 100}>
                                        <Card className="shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col overflow-hidden rounded-xl bg-card group hover:-translate-y-2 h-full border-2 border-transparent hover:border-primary/20">
                                        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-xl">
                                            <NextImage 
                                                src={event.imageUrl || "https://placehold.co/600x400.png?text=Evento"} 
                                                alt={event.name} fill 
                                                className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-110" 
                                                style={{ objectPosition: event.imageObjectPosition || '50% 50%' }} 
                                                data-ai-hint={event.aiHint || "party concert"}
                                            />
                                            {isPast(new Date(event.endDate)) && (<div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />)}
                                        </div>
                                        <CardHeader className="pb-3 px-6 pt-6">
                                            <CardTitle className="text-xl font-bold">{event.name}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="flex-grow space-y-3 px-6">
                                            <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{event.description}</p>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center text-xs font-semibold text-primary">
                                                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                                                    {format(parseISO(event.startDate), "dd MMMM, yyyy", { locale: es })}
                                                </div>
                                                {location && (
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center text-xs text-muted-foreground hover:text-primary transition-colors pt-1 group"
                                                    >
                                                        <MapPin className="h-4 w-4 mr-1.5 shrink-0" />
                                                        <span className="group-hover:underline line-clamp-1">{location}</span>
                                                    </a>
                                                )}
                                            </div>
                                        </CardContent>
                                        {isEntityCurrentlyActivatable(event) ? (
                                            <CardFooter className="flex-col items-start p-6 border-t bg-muted/5">
                                                {event.isPublicAccess ? (
                                                    <Button onClick={() => handlePublicAccessSubmit(event)} className="w-full h-10 text-white font-bold shadow-lg transition-all hover:scale-105" style={{backgroundImage: `linear-gradient(to right, ${businessDetails?.primaryColor || '#053264'}, ${businessDetails?.secondaryColor || '#ccffbc'})`}}>
                                                        <QrCodeIcon className="mr-2 h-4 w-4"/> Generar Entrada QR
                                                    </Button>
                                                ) : (
                                                    <SpecificCodeEntryForm entity={event} />
                                                )}
                                            </CardFooter>
                                            ) : (<PastEventCardFooter entity={event} />)
                                        }
                                        </Card>
                                    </ScrollReveal>
                                )
                            })}
                            </div>
                        ) : (
                            <div className="py-12"><Card className="col-span-full border-dashed"><CardHeader className="text-center"><PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" /><CardTitle className="mt-2">No hay Eventos por Ahora</CardTitle></CardHeader><CardContent className="text-center"><CardDescription>Este negocio no tiene eventos activos en este momento. ¡Vuelve pronto!</CardDescription></CardContent></Card></div>
                        )}
                      </section>
                    )}
                    
                    {showGallery && (
                      <section className="space-y-12 animate-fade-in">
                        {(businessDetails.publicVideoUrls?.length > 0 || businessDetails.publicCoverImageUrls?.length > 0) ? (
                          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch">
                            {/* Lado Izquierdo: Galería & Momentos (Imágenes) - Más ancho en desktop */}
                            {businessDetails.publicCoverImageUrls && businessDetails.publicCoverImageUrls.length > 0 && (
                              <div className={cn(
                                "flex flex-col space-y-6 w-full",
                                businessDetails.publicVideoUrls?.length > 0 ? "lg:w-2/3" : "w-full"
                              )}>
                                <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 text-slate-800">
                                  <span className="p-2 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-center">
                                    <Smartphone className="h-5 w-5 text-indigo-500" />
                                  </span>
                                  Galería & Momentos
                                </h2>
                                <div className="flex-1 w-full rounded-3xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.08)] relative border border-slate-100 min-h-[300px]">
                                  <ImageCarousel 
                                    images={businessDetails.publicCoverImageUrls} 
                                    primaryColor={businessDetails.primaryColor} 
                                    showOverlay={false} 
                                    aspectClass="h-full aspect-[4/3] lg:aspect-auto"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Lado Derecho: Videos & Ambiente - Más angosto en desktop */}
                            {businessDetails.publicVideoUrls && businessDetails.publicVideoUrls.length > 0 && (
                              <div className={cn(
                                "flex flex-col space-y-6 w-full",
                                businessDetails.publicCoverImageUrls?.length > 0 ? "lg:w-1/3" : "w-full"
                              )}>
                                <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 text-slate-800">
                                  <span className="p-2 bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-center">
                                    <Video className="h-5 w-5 text-rose-500" />
                                  </span>
                                  Videos & Ambiente
                                </h2>
                                <div className="w-full aspect-[9/16] rounded-3xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.08)] relative border border-slate-100 bg-black">
                                  <VideoCarousel videos={businessDetails.publicVideoUrls} primaryColor={businessDetails.primaryColor} />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="py-12">
                            <Card className="col-span-full border-dashed rounded-3xl">
                              <CardHeader className="text-center">
                                <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                                <CardTitle className="mt-2">No hay Multimedia disponible</CardTitle>
                              </CardHeader>
                              <CardContent className="text-center">
                                <CardDescription>Este negocio no ha compartido fotos ni videos por el momento.</CardDescription>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </section>
                    )}
                </div>
                
                {businessDetails.publicAddress && (
                  <div className="px-4 sm:px-6 lg:px-8 mt-12 mb-8 max-w-7xl mx-auto">
                    <ScrollReveal direction="up">
                      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.015)] border border-slate-100 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 text-slate-800">
                              <span className="p-2 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-center">
                                <MapPin className="h-5 w-5 text-emerald-500" />
                              </span>
                              Ubicación & Mapa
                            </h2>
                            <p className="text-slate-500 text-sm mt-1 font-semibold">
                              {businessDetails.publicAddress}
                            </p>
                          </div>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessDetails.name + ", " + businessDetails.publicAddress)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold text-xs uppercase tracking-widest shadow-md transition-all hover:scale-105 justify-center"
                          >
                            Abrir en Google Maps
                          </a>
                        </div>
                        <div className="w-full h-[350px] md:h-[450px] rounded-3xl overflow-hidden border border-slate-100 shadow-inner relative group">
                          <iframe 
                            width="100%" 
                            height="100%" 
                            className="absolute inset-0"
                            frameBorder="0" 
                            scrolling="no" 
                            marginHeight={0} 
                            marginWidth={0} 
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(businessDetails.name + ", " + businessDetails.publicAddress)}&t=&z=16&ie=UTF8&iwloc=A&output=embed`}
                          />
                        </div>
                      </div>
                    </ScrollReveal>
                  </div>
                )}
            </div>
            
             <footer className="w-full bg-[#0b1319] text-slate-400 border-t border-white/5 pt-16 pb-8 shrink-0">
                 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                         {/* Column 1: Nosotros */}
                         <div className="space-y-6">
                             <div className="flex items-center gap-2">
                                 <SocioVipLogo size={40} />
                                 <span className="font-black text-lg text-white">SocioVIP</span>
                             </div>
                             <p className="text-sm leading-relaxed text-slate-400 font-medium">
                                 Ofrecemos un servicio personalizado de primer nivel con las mejores opciones y precios que se acomodan a tus necesidades, garantizando experiencias inolvidables.
                             </p>
                             <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 py-2 px-4 rounded-full w-fit border border-white/5">
                                 Establecimiento Premium
                             </div>
                         </div>
                         
                         {/* Column 2: Links */}
                         <div className="space-y-6">
                             <h4 className="font-black text-xs uppercase tracking-[0.2em] text-white">Nuestra Plataforma</h4>
                             <ul className="space-y-3 text-sm font-semibold">
                                 <li><Link href="/" className="hover:text-white transition-colors">Página Principal</Link></li>
                                 <li><button onClick={() => setView('description')} className="hover:text-white transition-colors">Descripción del Negocio</button></li>
                                 <li><button onClick={() => setView('promotions')} className="hover:text-white transition-colors">Promociones Activas</button></li>
                                 <li><button onClick={() => setView('events')} className="hover:text-white transition-colors">Eventos & Agendas</button></li>
                                 <li><button onClick={() => setView('gallery')} className="hover:text-white transition-colors flex items-center gap-2">Experiencia & Reels <span className="bg-emerald-500/20 text-emerald-400 text-[8px] px-2 py-0.5 rounded-full uppercase tracking-widest">Nuevo</span></button></li>
                             </ul>
                         </div>
                         
                         {/* Column 3: Contacto */}
                         <div className="space-y-6">
                             <h4 className="font-black text-xs uppercase tracking-[0.2em] text-white">Contactos</h4>
                             <ul className="space-y-4 text-sm font-semibold">
                                 {businessDetails.publicPhone && (
                                     <li className="flex items-center gap-3">
                                         <Smartphone className="h-4 w-4 text-[#ccffbc]" />
                                         <span>{businessDetails.publicPhone}</span>
                                     </li>
                                 )}
                                 {businessDetails.publicContactEmail && (
                                     <li className="flex items-center gap-3">
                                         <Mail className="h-4 w-4 text-[#ccffbc]" />
                                         <a href={`mailto:${businessDetails.publicContactEmail}`} className="hover:text-white transition-colors">{businessDetails.publicContactEmail}</a>
                                     </li>
                                 )}
                                 {businessDetails.publicAddress && (
                                     <li className="flex items-start gap-3">
                                         <MapPin className="h-4 w-4 text-[#ccffbc] mt-1 shrink-0" />
                                         <span className="leading-relaxed text-slate-300">{businessDetails.publicAddress}</span>
                                     </li>
                                 )}
                             </ul>
                         </div>
                     </div>
                     
                     <div className="border-t border-white/5 pt-8 mt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500">
                         <p>© {new Date().getFullYear()} SocioVIP. Todos los derechos reservados.</p>
                         <div className="flex items-center gap-4 opacity-50 hover:opacity-80 transition-opacity">
                             <span className="bg-white/10 px-2.5 py-1 rounded text-[10px] font-bold">VISA</span>
                             <span className="bg-white/10 px-2.5 py-1 rounded text-[10px] font-bold">MC</span>
                             <span className="bg-white/10 px-2.5 py-1 rounded text-[10px] font-bold">AMEX</span>
                             <span className="bg-white/10 px-2.5 py-1 rounded text-[10px] font-bold">PP</span>
                         </div>
                     </div>
                 </div>
             </footer>
      </main>

      <Dialog
        open={showDniModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            resetQrFlow();
          }
          setShowDniModal(isOpen);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <UIDialogTitleComponent className="font-headline text-2xl">
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
                                "w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium transition-all hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                field.value === 'dni' && "bg-black text-white border-black"
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
                                "w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium transition-all hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                field.value === 'ce' && "bg-black text-white border-black"
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
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder={watchedDocType === 'dni' ? "8 dígitos numéricos" : "10-20 dígitos numéricos"} 
                            {...field} 
                            className="focus-visible:ring-offset-0 border-2"
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
                <ShadcnDialogFooter className="pt-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowDniModal(false);
                      resetQrFlow();
                    }}
                    disabled={isLoadingQrFlow}
                  >
                    Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-black text-white font-bold shadow-lg hover:bg-black/80 transition-all"
                      disabled={isLoadingQrFlow}
                    >
                      {isLoadingQrFlow ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        "Verificar"
                      )}
                    </Button>
                </ShadcnDialogFooter>
              </form>
            </Form>
          ) : (
            <Form {...newQrClientForm}>
              <form onSubmit={newQrClientForm.handleSubmit(handleNewUserSubmitInModal)} className="space-y-3 py-1 max-h-[60vh] overflow-y-auto pr-2">
                {isConsultingDni && (
                    <div 
                        className="flex flex-col items-center justify-center p-6 rounded-lg my-3 text-white shadow-inner"
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
                          className="disabled:bg-muted/30 border-2"
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
                        <Input placeholder="Tus apellidos" {...field} value={field.value || ""} disabled={isLoadingQrFlow || isConsultingDni} className="border-2"/>
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
                        <Input placeholder="Tus nombres" {...field} value={field.value || ""} disabled={isLoadingQrFlow || isConsultingDni} className="border-2"/>
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
                            className="border-2"
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
                              className={cn("w-full pl-3 text-left font-normal border-2", !field.value && "text-muted-foreground")}
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
                <ShadcnDialogFooter className="pt-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setCurrentStepInModal("enterDni");
                      newQrClientForm.reset({ dni: enteredDni });
                      dniForm.setValue("docNumber", enteredDni);
                    }}
                    disabled={isLoadingQrFlow || isConsultingDni}
                  >
                    Volver
                  </Button>
                  <Button type="submit" className="flex-1 text-white font-bold shadow-lg transition-all hover:scale-105" 
                    style={{
                        backgroundImage: `linear-gradient(to right, ${businessDetails.primaryColor || '#053264'}, ${businessDetails.secondaryColor || '#ccffbc'})`
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
      
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <NextImage 
              src={lightboxImage} 
              alt="Ampliación de Galería" 
              fill
              className="object-contain"
              sizes="100vw"
            />
            <button 
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors backdrop-blur-sm shadow-md"
              onClick={() => setLightboxImage(null)}
            >
              Cerrar ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
