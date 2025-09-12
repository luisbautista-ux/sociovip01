

"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
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
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  limit,
  runTransaction
} from "firebase/firestore";
import type {
  BusinessManagedEntity,
  Business,
  QrClient,
  QrCodeData,
  NewQrClientFormData,
  GeneratedCode,
} from "@/lib/types";
import { format, parseISO } from "date-fns";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as UIDialogDescription,
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
  AlertDialogDescription,
  AlertDialogFooter as ShadcnAlertDialogFooterAliased,
  AlertDialogHeader,
  AlertDialogTitle as UIAlertDialogTitleAliased,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SocioVipLogo } from "@/components/icons";

// --- Helpers robustos para códigos ---
const normalizeCode = (v: unknown) =>
  String(v ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "")            // quita espacios y guiones
    .replace(/[^A-Z0-9]/g, "");       // deja solo A-Z0-9

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

export default function BusinessPublicPageById(): React.JSX.Element | null {
  // obtener el id desde la URL: /business/[businessId]
  const pathname = usePathname();
  const businessIdFromParams = React.useMemo(() => {
    if (!pathname) return undefined;
    const parts = pathname.split("/").filter(Boolean); // ["business", "{id}", ...]
    const i = parts.indexOf("business");
    return i !== -1 && parts[i + 1] ? parts[i + 1] : undefined;
  }, [pathname]);


  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, userProfile, logout, loadingAuth, loadingProfile } = useAuth();

  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);
  const [activeEntitiesForBusiness, setActiveEntitiesForBusiness] = useState<BusinessManagedEntity[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [pageViewState, setPageViewState] = useState<"entityList" | "qrDisplay">("entityList");
  const [showDniModal, setShowDniModal] = useState(false);
  const [currentStepInModal, setCurrentStepInModal] = useState<"enterDni" | "newUserForm">("enterDni");
  const [activeEntityForQr, setActiveEntityForQr] = useState<BusinessManagedEntity | null>(null);
  const [validatedCodeObject, setValidatedCodeObject] = useState<GeneratedCode | null>(null);
  const [enteredDni, setEnteredDni] = useState<string>("");
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string | null>(null);
  const [isLoadingQrFlow, setIsLoadingQrFlow] = useState(false);
  const [showDniExistsWarningDialog, setShowDniExistsWarningDialog] = useState(false);
  const [formDataForDniWarning, setFormDataForDniWarning] = useState<NewQrClientFormData | null>(null);

  const dniForm = useForm<DniFormValues>({ 
    resolver: zodResolver(DniEntrySchema), 
    defaultValues: { docType: 'dni', docNumber: "" } 
  });
  const watchedDocType = dniForm.watch('docType');

  const newQrClientForm = useForm<NewQrClientFormData>({
    resolver: zodResolver(newQrClientSchema),
    defaultValues: { name: "", surname: "", phone: "", dob: undefined, dni: "" },
  });

  const fetchBusinessDataById = useCallback(
    async (id: string) => {
      setIsLoadingPage(true);
      setPageError(null);

      try {
        const businessDocRef = doc(db, "businesses", id);
        const businessSnap = await getDoc(businessDocRef);

        if (!businessSnap.exists()) {
          setPageError(`Negocio no encontrado. ID: ${id}`);
          setBusinessDetails(null);
          setActiveEntitiesForBusiness([]);
          setIsLoadingPage(false);
          return;
        }

        const bizData = businessSnap.data();
        const fetchedBusiness: Business = {
          id: businessSnap.id,
          name: bizData.name || "Nombre de Negocio Desconocido",
          contactEmail: bizData.contactEmail || "",
          joinDate: anyToDate(bizData.joinDate)?.toISOString() || new Date().toISOString(),
          customUrlPath: bizData.customUrlPath || undefined,
          logoUrl: bizData.logoUrl || undefined,
          publicCoverImageUrl: bizData.publicCoverImageUrl || undefined,
          slogan: bizData.slogan || undefined,
          publicContactEmail: bizData.publicContactEmail || undefined,
          publicPhone: bizData.publicPhone || undefined,
          publicAddress: bizData.publicAddress || undefined,
          ruc: bizData.ruc,
          razonSocial: bizData.razonSocial,
          department: bizData.department,
          province: bizData.province,
          district: bizData.district,
          address: bizData.address,
          managerName: bizData.managerName,
          managerDni: bizData.managerDni,
          businessType: bizData.businessType,
          primaryColor: bizData.primaryColor || '#B080D0',
          secondaryColor: bizData.secondaryColor || '#8E5EA2',
        };

        // Si tiene customUrlPath, redirige a /b/[customUrlPath]
        if (fetchedBusiness.customUrlPath && fetchedBusiness.customUrlPath.trim() !== "") {
          router.replace(`/b/${fetchedBusiness.customUrlPath.trim()}`);
          return;
        }

        setBusinessDetails(fetchedBusiness);

        const entitiesQuery = query(
          collection(db, "businessEntities"),
          where("businessId", "==", fetchedBusiness.id),
          where("isActive", "==", true)
        );
        const entitiesSnapshot = await getDocs(entitiesQuery);

        const allActiveAndCurrentEntities: BusinessManagedEntity[] = [];
        entitiesSnapshot.forEach((docSnap) => {
          const entityData = docSnap.data();
          const entityForCheck: BusinessManagedEntity = {
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
            aiHint: entityData.aiHint,
            termsAndConditions: entityData.termsAndConditions,
            createdAt: anyToDate(entityData.createdAt)?.toISOString() || "",
          };

          if (isEntityCurrentlyActivatable(entityForCheck)) {
            allActiveAndCurrentEntities.push(entityForCheck);
          }
        });

        setActiveEntitiesForBusiness(
          allActiveAndCurrentEntities.sort((a, b) => {
            const aDate = new Date(a.startDate || 0).getTime();
            const bDate = new Date(b.startDate || 0).getTime();
            if (a.type === "event" && b.type !== "event") return -1;
            if (a.type !== "event" && b.type === "event") return 1;
            return bDate - aDate;
          })
        );
      } catch (err: any) {
        setPageError("No se pudo cargar la información del negocio. Inténtalo de nuevo más tarde.");
        setBusinessDetails(null);
        setActiveEntitiesForBusiness([]);
      } finally {
        setIsLoadingPage(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (businessIdFromParams) {
      fetchBusinessDataById(businessIdFromParams);
    } else {
      setPageError("ID de negocio no especificado en la URL.");
      setIsLoadingPage(false);
    }
  }, [businessIdFromParams, fetchBusinessDataById]);

const markPromoterCodeAsRedeemed = async (
  entityId: string,
  codeId: string,
  clientInfo: { dni: string; name: string; surname: string }
): Promise<void> => {
  const entityRef = doc(db, "businessEntities", entityId);

  try {
    await runTransaction(db, async (transaction) => {
      const entityDoc = await transaction.get(entityRef);
      if (!entityDoc.exists()) {
        throw new Error("La promoción o evento no fue encontrado.");
      }

      const entityData = entityDoc.data();
      const codes = (entityData.generatedCodes || []) as any[];

      let codeFound = false;
      let codeAlreadyUsed = false;
      const codeIndex = codes.findIndex(c => c.id === codeId);

      if (codeIndex !== -1) {
        codeFound = true;
        if (isCodeAvailableForUse(codes[codeIndex])) {
            codes[codeIndex] = {
              ...codes[codeIndex],
              status: "redeemed",
              redemptionDate: new Date().toISOString(),
              redeemedByInfo: {
                dni: clientInfo.dni,
                name: `${clientInfo.name} ${clientInfo.surname}`,
              },
            };
        } else {
            codeAlreadyUsed = true;
        }
      }

      if (!codeFound) {
        throw new Error("El código del promotor no es válido para esta promoción.");
      }
      if (codeAlreadyUsed) {
        throw new Error("Este código ya ha sido utilizado.");
      }
      
      transaction.update(entityRef, { generatedCodes: codes });
    });
  } catch (error: any) {
    console.error("Error in markPromoterCodeAsRedeemed transaction:", error);
    // Re-throw the error to be caught by the calling function
    throw error;
  }
};
  
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
  
const handleDniSubmitInModal: SubmitHandler<DniFormValues> = async (data) => {
  if (!activeEntityForQr || !validatedCodeObject) {
      toast({ title: "Error interno", description: "Falta información clave para continuar (entidad o código).", variant: "destructive" });
      return;
  }
  setIsLoadingQrFlow(true);
  const docNumberCleaned = data.docNumber.trim();
  setEnteredDni(docNumberCleaned);

  try {
      const qrClientsRef = collection(db, "qrClients");
      const q = query(qrClientsRef, where("dni", "==", docNumberCleaned), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
          const existingClientDoc = querySnapshot.docs[0];
          const clientData = existingClientDoc.data();
          const clientForQr: QrClient = {
              id: existingClientDoc.id,
              dni: clientData.dni,
              name: clientData.name,
              surname: clientData.surname,
              phone: clientData.phone,
              dob: anyToDate(clientData.dob)?.toISOString() || "",
              registrationDate: anyToDate(clientData.registrationDate)?.toISOString() || "",
          };

          await markPromoterCodeAsRedeemed(activeEntityForQr.id, validatedCodeObject.id, clientForQr);
          
          toast({ title: "¡Éxito!", description: "Cliente verificado y código canjeado. Generando QR." });
          const qrCodeDetails: QrCodeData["promotion"] = {
              id: activeEntityForQr.id,
              title: activeEntityForQr.name,
              description: activeEntityForQr.description,
              validUntil: activeEntityForQr.endDate,
              imageUrl: activeEntityForQr.imageUrl || "",
              promoCode: validatedCodeObject.value,
              qrValue: validatedCodeObject.id, // THE QR VALUE IS THE UNIQUE ID OF THE CODE
              aiHint: activeEntityForQr.aiHint || "",
              type: activeEntityForQr.type,
              termsAndConditions: activeEntityForQr.termsAndConditions,
          };
          setQrData({ user: clientForQr, promotion: qrCodeDetails, code: validatedCodeObject.id, status: "redeemed" });
          setShowDniModal(false);
          setPageViewState("qrDisplay");
      } else {
            let fetchedNameFromApi: string | undefined = undefined;
              if (data.docType === 'dni') {
                try {
                    const response = await fetch('/api/admin/consult-dni', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dni: docNumberCleaned }),
                    });
                    const resData = await response.json();
                    if (response.ok && resData.nombreCompleto) {
                        fetchedNameFromApi = resData.nombreCompleto;
                    }
                } catch (apiError) {
                    console.warn("DNI consultation API failed, continuing without prefill.", apiError);
                }
            }
            
            const nameParts = fetchedNameFromApi?.split(' ') || [];
            const surname = nameParts.slice(0, 2).join(' '); // Apellido paterno y materno
            const name = nameParts.slice(2).join(' '); // Nombres

            newQrClientForm.reset({ 
                name: name || "", 
                surname: surname || "", 
                phone: "", 
                dob: undefined, 
                dni: docNumberCleaned,
            });
            setCurrentStepInModal("newUserForm");
      }
  } catch (e: any) {
      toast({ title: "Error de Verificación de DNI", description: "No se pudo verificar el DNI. " + e.message, variant: "destructive" });
      resetQrFlow();
  } finally {
      setIsLoadingQrFlow(false);
  }
};
  
const processNewQrClientRegistration = async (formData: NewQrClientFormData) => {
  if (!activeEntityForQr || !validatedCodeObject || !enteredDni || !businessDetails) {
    toast({ title: "Error interno", description: "Falta información para registrar cliente.", variant: "destructive" });
    return;
  }
  setIsLoadingQrFlow(true);

  const clientForRedeem = {
    dni: enteredDni,
    name: formData.name,
    surname: formData.surname,
  };

  try {
    await markPromoterCodeAsRedeemed(activeEntityForQr.id, validatedCodeObject.id, clientForRedeem);
    
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
    
    const docRef = await addDoc(collection(db, "qrClients"), sanitizeObjectForFirestore(newClientDataToSave));
    
    const clientForQr: QrClient = {
      id: docRef.id,
      dni: newClientDataToSave.dni,
      name: newClientDataToSave.name,
      surname: newClientDataToSave.surname,
      phone: newClientDataToSave.phone,
      dob: newClientDataToSave.dob.toDate().toISOString(),
      registrationDate: new Date().toISOString(),
    };

    const qrCodeDetails: QrCodeData["promotion"] = {
      id: activeEntityForQr.id,
      title: activeEntityForQr.name,
      description: activeEntityForQr.description,
      validUntil: activeEntityForQr.endDate,
      imageUrl: activeEntityForQr.imageUrl || "",
      promoCode: validatedCodeObject.value,
      qrValue: validatedCodeObject.id, // THE QR VALUE IS THE UNIQUE ID OF THE CODE
      aiHint: activeEntityForQr.aiHint || "",
      type: activeEntityForQr.type,
      termsAndConditions: activeEntityForQr.termsAndConditions,
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

  const handleNewUserDniChangeDuringRegistration = async (
    newDniValue: string,
    currentFormData: NewQrClientFormData
  ): Promise<boolean> => {
    const newDniCleaned = newDniValue.trim();
    if (newDniCleaned === enteredDni) return true;
    if (newDniCleaned.length < 7 || newDniCleaned.length > 15) {
      newQrClientForm.setError("dni", { type: "manual", message: "DNI/CE debe tener entre 7 y 15 caracteres." });
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
      toast({ title: "Error al verificar DNI", description: e.message, variant: "destructive" });
      return false;
    } finally {
      setIsLoadingQrFlow(false);
    }
  };

  const handleDniExistsWarningConfirm = async () => {
    setShowDniExistsWarningDialog(false);
    dniForm.setValue("docNumber", enteredDni);
    await handleDniSubmitInModal({ docType: dniForm.getValues("docType"), docNumber: enteredDni });
    setFormDataForDniWarning(null);
  };

  const handleNewUserSubmitInModal: SubmitHandler<NewQrClientFormData> = async (data) => {
    if (data.dni.trim() !== enteredDni.trim()) {
      toast({ title: "Inconsistencia de DNI", description: "El DNI del formulario no coincide con el verificado. Por favor, reinicia el proceso.", variant: "destructive" });
      return;
    }
    await processNewQrClientRegistration(data);
  };

  useEffect(() => {
    const generateQrImage = async () => {
      if (pageViewState === "qrDisplay" && qrData?.promotion.qrValue) {
        try {
          // The QR content is now the unique ID of the code object.
          const dataUrl = await QRCode.toDataURL(qrData.promotion.qrValue, { width: 250, errorCorrectionLevel: "H", margin: 2 });
          setGeneratedQrDataUrl(dataUrl);
        } catch (err) {
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
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
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
    const businessLogo = document.createElement("img");
    businessLogo.crossOrigin = "anonymous";

    let initialEstimatedHeight =
      padding +
      maxLogoHeight +
      spacingAfterLogo +
      businessNameFontSize +
      spacingAfterBusinessName +
      entityTitleFontSize +
      spacingAfterEntityTitle +
      qrSize +
      padding +
      userDetailsFontSize +
      lineSpacing +
      userDetailsFontSize +
      padding +
      smallTextFontSize +
      lineSpacing +
      padding;
    if (qrData.promotion.termsAndConditions) {
      initialEstimatedHeight += 50;
    }
    canvas.height = initialEstimatedHeight;
    canvas.width = canvasWidth;

    const drawContent = () => {
      ctx.fillStyle = "hsl(280, 13%, 96%)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      currentY = 0;

      const headerBgHeight = maxLogoHeight + spacingAfterLogo + businessNameFontSize + padding * 1.5;
      ctx.fillStyle = "hsl(var(--primary))";
      ctx.fillRect(0, currentY, canvas.width, headerBgHeight);
      currentY += padding;

      if (businessDetails.logoUrl) {
        const aspectRatio = businessLogo.width / businessLogo.height;
        let logoHeight = businessLogo.height;
        let logoWidth = businessLogo.width;

        if (logoHeight > maxLogoHeight) {
          logoHeight = maxLogoHeight;
          logoWidth = logoHeight * aspectRatio;
        }
        if (logoWidth > canvas.width / 2 - padding) {
          logoWidth = canvas.width / 2 - padding;
          logoHeight = logoWidth / aspectRatio;
        }
        ctx.drawImage(businessLogo, (canvas.width - logoWidth) / 2, currentY, logoWidth, logoHeight);
        currentY += logoHeight + spacingAfterLogo / 2;
      } else {
        currentY += maxLogoHeight + spacingAfterLogo / 2;
      }

      ctx.fillStyle = "hsl(var(--primary-foreground))";
      ctx.font = `bold ${businessNameFontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(businessDetails.name, canvas.width / 2, currentY);
      currentY += businessNameFontSize + padding / 2;

      currentY = headerBgHeight;
      currentY += spacingAfterBusinessName;

      ctx.fillStyle = "hsl(var(--primary))";
      ctx.font = `bold ${entityTitleFontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(qrData.promotion.title, canvas.width / 2, currentY);
      currentY += entityTitleFontSize + spacingAfterEntityTitle;

      const qrImage = document.createElement("img");
      qrImage.crossOrigin = "anonymous";
      qrImage.onload = () => {
        const qrX = (canvas.width - qrSize) / 2;
        ctx.drawImage(qrImage, qrX, currentY, qrSize, qrSize);
        ctx.strokeStyle = "hsl(var(--primary))";
        ctx.lineWidth = 2;
        ctx.strokeRect(qrX - 2, currentY - 2, qrSize + 4, qrSize + 4);
        currentY += qrSize + padding;

        ctx.fillStyle = "hsl(var(--primary))";
        ctx.font = `bold ${userDetailsFontSize + 2}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(`${qrData.user.name} ${qrData.user.surname}`, canvas.width / 2, currentY);
        currentY += userDetailsFontSize + 2 + lineSpacing;

        ctx.fillStyle = "hsl(var(--foreground))";
        ctx.font = `${userDetailsFontSize - 2}px Arial`;
        ctx.fillText(`DNI/CE: ${qrData.user.dni}`, canvas.width / 2, currentY);
        currentY += userDetailsFontSize - 2 + padding;

        ctx.font = `italic ${smallTextFontSize}px Arial`;
        ctx.fillStyle = "hsl(var(--muted-foreground))";
        ctx.textAlign = "center";
        ctx.fillText(
          `Válido hasta: ${format(parseISO(qrData.promotion.validUntil), "dd MMMM yyyy", { locale: es })}`,
          canvas.width / 2,
          currentY
        );
        currentY += smallTextFontSize + lineSpacing + 15;

        const termsLines = qrData.promotion.termsAndConditions ? qrData.promotion.termsAndConditions.split("\n") : [];
        if (qrData.promotion.termsAndConditions) {
          ctx.font = `italic ${smallTextFontSize - 1}px Arial`;
          ctx.fillStyle = "hsl(var(--muted-foreground))";
          termsLines.forEach((line) => {
            ctx.fillText(line, canvas.width / 2, currentY);
            currentY += smallTextFontSize + 2;
          });
          currentY += padding / 2;
        }

        canvas.height = currentY;

        ctx.fillStyle = "hsl(280, 13%, 96%)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "hsl(var(--primary))";
        const headerHeight = maxLogoHeight + spacingAfterLogo + businessNameFontSize + padding * 1.5;
        ctx.fillRect(0, 0, canvas.width, headerHeight);
        let redrawY = padding;
        if (businessDetails.logoUrl) {
          const aspectRatio = businessLogo.width / businessLogo.height;
          let logoHeight = businessLogo.height;
          let logoWidth = businessLogo.width;
          if (logoHeight > maxLogoHeight) {
            logoHeight = maxLogoHeight;
            logoWidth = logoHeight * aspectRatio;
          }
          if (logoWidth > canvas.width / 2 - padding) {
            logoWidth = canvas.width / 2 - padding;
            logoHeight = logoWidth / aspectRatio;
          }
          ctx.drawImage(businessLogo, (canvas.width - logoWidth) / 2, redrawY, logoWidth, logoHeight);
          redrawY += logoHeight + spacingAfterLogo / 2;
        } else {
          redrawY += maxLogoHeight + spacingAfterLogo / 2;
        }
        ctx.fillStyle = "hsl(var(--primary-foreground))";
        ctx.font = `bold ${businessNameFontSize}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(businessDetails.name, canvas.width / 2, redrawY);
        redrawY = headerHeight + spacingAfterBusinessName;
        ctx.fillStyle = "hsl(var(--primary))";
        ctx.font = `bold ${entityTitleFontSize}px Arial`;
        ctx.fillText(qrData.promotion.title, canvas.width / 2, redrawY);
        redrawY += entityTitleFontSize + spacingAfterEntityTitle;
        const qrX2 = (canvas.width - qrSize) / 2;
        ctx.drawImage(qrImage, qrX2, redrawY, qrSize, qrSize);
        ctx.strokeStyle = "hsl(var(--primary))";
        ctx.lineWidth = 2;
        ctx.strokeRect(qrX2 - 2, redrawY - 2, qrSize + 4, qrSize + 4);
        redrawY += qrSize + padding;
        ctx.fillStyle = "hsl(var(--primary))";
        ctx.font = `bold ${userDetailsFontSize + 2}px Arial`;
        ctx.fillText(`${qrData.user.name} ${qrData.user.surname}`, canvas.width / 2, redrawY);
        redrawY += userDetailsFontSize + 2 + lineSpacing;
        ctx.fillStyle = "hsl(var(--foreground))";
        ctx.font = `${userDetailsFontSize - 2}px Arial`;
        ctx.fillText(`DNI/CE: ${qrData.user.dni}`, canvas.width / 2, redrawY);
        redrawY += userDetailsFontSize - 2 + padding;
        ctx.font = `italic ${smallTextFontSize}px Arial`;
        ctx.fillStyle = "hsl(var(--muted-foreground))";
        ctx.fillText(
          `Válido hasta: ${format(parseISO(qrData.promotion.validUntil), "dd MMMM yyyy", { locale: es })}`,
          canvas.width / 2,
          redrawY
        );
        redrawY += smallTextFontSize + lineSpacing + 15;
        if (qrData.promotion.termsAndConditions) {
          ctx.font = `italic ${smallTextFontSize - 1}px Arial`;
          ctx.fillStyle = "hsl(var(--muted-foreground))";
          termsLines.forEach((line) => {
            ctx.fillText(line, canvas.width / 2, redrawY);
            redrawY += smallTextFontSize + 2;
          });
        }

        const dataUrl = canvas.toDataURL("image/png");
        const linkElement = document.createElement("a");
        linkElement.href = dataUrl;
        const entityTypeForFilename = qrData.promotion.type === "event" ? "Evento" : "Promo";
        linkElement.download = `SocioVIP_QR_${entityTypeForFilename}_${qrData.promotion.promoCode}.png`;
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
        toast({ title: "Advertencia", description: "No se pudo cargar el logo del negocio para incluirlo en la descarga.", variant: "default" });
        drawContent();
      };
      businessLogo.src = businessDetails.logoUrl;
    } else {
      drawContent();
    }
  };

  const resetQrFlow = () => {
    setPageViewState("entityList");
    setQrData(null);
    setGeneratedQrDataUrl(null);
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
            className="w-full bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-700 hover:to-purple-500 text-white font-bold shadow-lg transition duration-300 ease-in-out transform hover:scale-105 h-9"
            disabled={isLoadingQrFlow}
          >
            {isLoadingQrFlow ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (isEvent ? <Calendar className="h-4 w-4 mr-2" /> : <QrCodeIcon className="h-4 w-4 mr-2" />)}
            {isEvent ? "Obtener Entrada" : "Generar QR"}
          </Button>
        </form>
      </Form>
    );
  };

  if (isLoadingPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex items-center justify-center min-h-screen text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">{pageError}</h1>
        <Link href="/" passHref>
          <Button variant="outline" className="mt-6">Volver al Inicio</Button>
        </Link>
      </div>
    );
  }

  if (pageViewState === "qrDisplay" && qrData && activeEntityForQr && businessDetails) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header
          className="py-4 px-4 sm:px-6 lg:px-8 shadow-sm sticky top-0 z-20 w-full"
          style={{
            background: `linear-gradient(to right, ${businessDetails.primaryColor || '#B080D0'}, ${businessDetails.secondaryColor || '#8E5EA2'})`
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-start space-x-4">
            {businessDetails.logoUrl && (
              <NextImage
                src={businessDetails.logoUrl}
                alt={`${businessDetails.name} logo`}
                width={40}
                height={40}
                className="h-10 w-10 object-contain rounded-md bg-white/20 p-1"
              />
            )}
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-x-3">
              <h1 className="font-semibold text-xl text-white">{businessDetails.name}</h1>
              {businessDetails.slogan && (
                <p className="text-xs text-white/80">{businessDetails.slogan}</p>
              )}
            </div>
          </div>
        </header>
        <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-8">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-gradient">
                {activeEntityForQr.type === "event" ? "Tu Entrada para el Evento" : "Tu Promoción Adquirida"}
              </CardTitle>
              <CardDescription>Presenta este código en {businessDetails.name}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedQrDataUrl ? (
                <NextImage
                  src={generatedQrDataUrl}
                  alt="Código QR"
                  width={250}
                  height={250}
                  className="mx-auto border rounded-md shadow-md p-1 bg-white"
                />
              ) : (
                <div className="h-[250px] w-[250px] mx-auto flex items-center justify-center border rounded-md bg-muted text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Generando QR...</span>
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl font-semibold text-gradient">
                  Hola, {qrData.user.name} {qrData.user.surname}
                </p>
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
              <Button onClick={resetQrFlow} className="w-full sm:flex-1 bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-700 hover:to-purple-500 text-white font-bold shadow-lg transition duration-300 ease-in-out transform hover:scale-105">
                Ver Otras del Negocio
              </Button>
            </CardFooter>
          </Card>
        </main>
        <footer className="w-full mt-auto py-6 px-4 sm:px-6 lg:px-8 bg-muted/60 text-sm border-t">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <Link href="/login" passHref>
                <Button 
                    variant="gradient" 
                    style={{
                        backgroundImage: `linear-gradient(to right, ${businessDetails.primaryColor || '#B080D0'}, ${businessDetails.secondaryColor || '#8E5EA2'})`
                    }}
                >
                    <UserCircle className="mr-2 h-4 w-4" />
                    Iniciar Sesión
                </Button>
            </Link>
            <Link href="/" passHref>
                <Button 
                    variant="gradient"
                    style={{
                        backgroundImage: `linear-gradient(to right, ${businessDetails.primaryColor || '#B080D0'}, ${businessDetails.secondaryColor || '#8E5EA2'})`
                    }}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al Inicio
                </Button>
            </Link>
          </div>
        </footer>
      </div>
    );
  }

  if (!businessDetails) return null;

  const promotions = activeEntitiesForBusiness.filter((e) => e.type === "promotion");
  const events = activeEntitiesForBusiness.filter((e) => e.type === "event");

  return (
    <div className="min-h-screen bg-muted/40 text-foreground flex flex-col">
       <header 
         className="sticky top-0 z-20 w-full"
         style={{ 
           background: `linear-gradient(to right, ${businessDetails.primaryColor || '#B080D0'}, ${businessDetails.secondaryColor || '#8E5EA2'})` 
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
                  <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setShowLoginModal(true)}>
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

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex-grow w-full">
        {promotions.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-gradient mb-6 flex items-center">
              <Tag className="h-8 w-8 mr-3" /> Promociones Vigentes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((promo) => (
                <Card
                  key={promo.id}
                  className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg bg-card"
                >
                  <div className="relative aspect-[16/9] w-full">
                    <NextImage
                      src={promo.imageUrl || "https://placehold.co/600x400.png?text=Promoción"}
                      alt={promo.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
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
        
        {events.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-gradient mb-6 flex items-center">
              <Calendar className="h-8 w-8 mr-3" /> Próximos Eventos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Card
                  key={event.id}
                  className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden rounded-lg bg-card"
                >
                  <div className="relative aspect-[16/9] w-full">
                    <NextImage
                      src={event.imageUrl || "https://placehold.co/600x400.png?text=Evento"}
                      alt={event.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                      data-ai-hint={event.aiHint || "party concert"}
                    />
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
                  <CardFooter className="flex-col items-start p-4 border-t">
                    <SpecificCodeEntryForm entity={event} />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {!isLoadingPage && !pageError && promotions.length === 0 && events.length === 0 && pageViewState === "entityList" && (
          <Card className="col-span-full">
            <CardHeader className="text-center">
              <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" />
              <CardTitle className="mt-2">No hay Actividad por Ahora</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription>
                Este negocio no tiene promociones o eventos activos en este momento. ¡Vuelve pronto!
              </CardDescription>
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
                  <a href={`mailto:${businessDetails.publicContactEmail}`} className="text-primary hover:underline">
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
            <DialogTitle>
              {currentStepInModal === "enterDni" ? "Ingresa tu Documento" : "Completa tus Datos"}
            </DialogTitle>
            <UIDialogDescription>
              {currentStepInModal === "enterDni"
                ? `Para obtener tu QR para "${activeEntityForQr?.name}".`
                : "Necesitamos algunos datos para generar tu QR."}
            </UIDialogDescription>
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
                  <Button type="submit" className="bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-700 hover:to-purple-500 text-white font-bold shadow-lg transition duration-300 ease-in-out transform hover:scale-105" disabled={isLoadingQrFlow}>
                    {isLoadingQrFlow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar"}
                  </Button>
                </ShadcnDialogFooter>
              </form>
            </Form>
          ) : (
            <Form {...newQrClientForm}>
              <form onSubmit={newQrClientForm.handleSubmit(handleNewUserSubmitInModal)} className="space-y-3 py-1 max-h-[60vh] overflow-y-auto pr-2">
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
                        <Input placeholder="Tus apellidos" {...field} value={field.value || ""} disabled={isLoadingQrFlow} />
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
                        <Input placeholder="Tus nombres" {...field} value={field.value || ""} disabled={isLoadingQrFlow} />
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
                            disabled={isLoadingQrFlow} />
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
                              disabled={isLoadingQrFlow}
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
                    disabled={isLoadingQrFlow}
                  >
                    Volver
                  </Button>
                  <Button type="submit" className="bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-700 hover:to-purple-500 text-white font-bold shadow-lg transition duration-300 ease-in-out transform hover:scale-105" disabled={isLoadingQrFlow}>
                    {isLoadingQrFlow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Registrar y Generar QR"}
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
              El DNI/CE <span className="font-semibold">{enteredDni}</span> ya está registrado como Cliente QR. ¿Deseas usar los
              datos existentes para generar tu QR?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ShadcnAlertDialogFooterAliased>
            <AlertDialogCancel
              onClick={() => {
                setShowDniExistsWarningDialog(false);
                newQrClientForm.setValue("dni", "");
              }}
            >
              No, corregir DNI
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDniExistsWarningConfirm} className="bg-primary hover:bg-primary/90">
              Sí, usar datos existentes
            </AlertDialogAction>
          </ShadcnAlertDialogFooterAliased>
        </AlertDialogContent>
      </AlertDialog>
      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  );
}




