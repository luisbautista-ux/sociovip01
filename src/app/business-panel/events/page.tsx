"use client";
import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,    
  CardDescription as ShadcnCardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlusCircle,
  Edit,
  Trash2,
  Search,
  Calendar as CalendarIconLucide,
  QrCodeIcon,
  Copy,
  ListChecks,
  BarChart3,
  Loader2,
  X,
  Edit as EditIcon,
} from "lucide-react";
import type {
  BusinessManagedEntity,
  GeneratedCode,
  TicketType,
  EventBox,
  EventPromoterAssignment,
  CommissionRule,
  BusinessPromoterLink,
} from "@/lib/types";
import { format, parseISO, isBefore, isEqual, set, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as UIAlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  BusinessEventForm,
  type EventDetailsFormValues,
} from "@/components/business/forms/BusinessEventForm";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import {
  TicketTypeForm,
  type TicketTypeFormData,
} from "@/components/business/forms/TicketTypeForm";
import {
  EventBoxForm,
  type EventBoxFormData,
} from "@/components/business/forms/EventBoxForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreateBatchBoxesDialog,
  type BatchBoxFormData,
} from "@/components/business/dialogs/CreateBatchBoxesDialog";
import {
  isEntityCurrentlyActivatable,
  calculateMaxAttendance,
  sanitizeObjectForFirestore,
  anyToDate,
  cn,
} from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage as FormMessageHook,
  FormDescription,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as UIDialogDescription,
  DialogFooter as UIDialogFooterAliased,
} from "@/components/ui/dialog";
import { StatusSwitch } from "@/components/business/StatusSwitch";

/* ========================
   Validaciones (zod)
======================== */
const initialEventFormSchema = z
  .object({
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
    startDate: z.date({ required_error: "Fecha de inicio es requerida." }),
    endDate: z.date({ required_error: "Fecha de fin es requerida." }),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      const start = startOfDay(data.startDate);
      const end = startOfDay(data.endDate);
      return isEqual(end, start) || isBefore(start, end);
    },
    {
      message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
      path: ["endDate"],
    }
  );
type InitialEventFormValues = z.infer<typeof initialEventFormSchema>;
const commissionRuleFormSchema = z
  .object({
    appliesTo: z.enum(["event_general", "ticket_type", "box_type"], {
      required_error: "Debes seleccionar a qué aplica.",
    }),
    appliesToId: z.string().optional(),
    appliesToName: z.string().optional(),
    commissionType: z.enum(["fixed", "percentage"], {
      required_error: "Debes seleccionar el tipo de comisión.",
    }),
    commissionValue: z.coerce.number().min(0, "El valor no puede ser negativo.").optional().or(z.literal(0)),
    description: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.appliesTo === "ticket_type" || data.appliesTo === "box_type") {
        return !!data.appliesToId && data.appliesToId.length > 0;
      }
      return true;
    },
    {
      message: "Debe seleccionar un tipo de entrada o box específico.",
      path: ["appliesToId"],
    }
  );
type CommissionRuleFormValues = z.infer<typeof commissionRuleFormSchema>;

/* ========================
   Página principal
======================== */
export default function BusinessEventsPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<BusinessManagedEntity[]>([]);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // ✅ SISTEMA UNIFICADO DE MODALES - SOLUCIÓN DEFINITIVA
  type ModalState = 
    | 'closed'
    | 'initialEvent'
    | 'manageEvent'
    | 'ticketForm'
    | 'boxForm'
    | 'batchBoxes'
    | 'commissionRule'
    | 'manageCodes'
    | 'createCodes'
    | 'stats';
    
  const [activeModal, setActiveModal] = useState<ModalState>('closed');
  const [modalContext, setModalContext] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<BusinessManagedEntity | null>(null);
  const [isDuplicatingEvent, setIsDuplicatingEvent] = useState(false);
  const [availablePromotersForAssignment, setAvailablePromotersForAssignment] = useState<BusinessPromoterLink[]>([]);
  const [selectedPromoterForAssignment, setSelectedPromoterForAssignment] = useState<string>("");
  const [currentPromoterAssignmentForRules, setCurrentPromoterAssignmentForRules] =
    useState<EventPromoterAssignment | null>(null);
  const [selectedEventForStats, setSelectedEventForStats] = useState<BusinessManagedEntity | null>(null);
  
  /* ========================
     Manejo del estado del Switch (CORREGIDO)
  ======================== */
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    eventId: string;
    newStatus: boolean;
  } | null>(null);

  useEffect(() => {
    if (!pendingStatusChange) return;
    
    const { eventId, newStatus } = pendingStatusChange;
    let isMounted = true;
    
    const updateStatus = async () => {
      if (!isMounted) return;
      
      setIsSubmitting(true);
      try {
        await updateDoc(doc(db, "businessEntities", eventId), { isActive: newStatus });
        toast({
          title: "Estado Actualizado",
          description: `El estado del evento ha sido cambiado a ${newStatus ? "Activo" : "Inactivo"}.`,
        });
      } catch (error: any) {
        console.error("Error updating event status:", error);
        toast({
          title: "Error al Actualizar",
          description: `No se pudo cambiar el estado. ${error.message}`,
          variant: "destructive",
        });
        // Revertir en caso de error
        if (isMounted) {
          setEvents(prev => prev.map(e => 
            e.id === eventId ? { ...e, isActive: !newStatus } : e
          ));
        }
      } finally {
        if (isMounted) {
          setIsLoadingPageData(false);
          setIsSubmitting(false);
          setPendingStatusChange(null);
        }
      }
    };

    // ✅ USAMOS setTimeout PARA EVITAR BUCLES EN FIREBASE STUDIO
    setTimeout(updateStatus, 0);
    
    return () => {
      isMounted = false;
    };
  }, [pendingStatusChange]);

  const handleToggleEventStatus = useCallback((eventId: string, newStatus: boolean) => {
    if (isSubmitting) return;
    
    // ✅ PRIMERO ACTUALIZA LOCALMENTE
    setEvents(prev => prev.map(e => 
      e.id === eventId ? { ...e, isActive: newStatus } : e
    ));
    
    // ✅ LUEGO PROGRAMA LA ACTUALIZACIÓN A FIRESTORE
    setTimeout(() => {
      setPendingStatusChange({ eventId, newStatus });
    }, 0);
  }, [isSubmitting]);

  /* ========================
     Forms
  ======================== */
  const initialEventForm = useForm<InitialEventFormValues>({
    resolver: zodResolver(initialEventFormSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: set(new Date(), { hours: 19, minutes: 0, seconds: 0, milliseconds: 0 }),
      endDate: set(new Date(new Date().setDate(new Date().getDate() + 1)), {
        hours: 2,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      }),
    },
  });
  const commissionRuleForm = useForm<CommissionRuleFormValues>({
    resolver: zodResolver(commissionRuleFormSchema),
    defaultValues: {
      appliesTo: "event_general",
      appliesToId: undefined,
      appliesToName: "",
      commissionType: "fixed",
      commissionValue: 0,
      description: "",
    },
  });

  /* ========================
     Carga de datos - CORREGIDO PARA EVITAR CARGA INFINITA
  ======================== */
  const fetchBusinessEvents = useCallback(
    async (businessIdToFetch: string) => {
      try {
        const q = query(
          collection(db, "businessEntities"),
          where("businessId", "==", businessIdToFetch),
          where("type", "==", "event")
        );
        const querySnapshot = await getDocs(q);
        const fetched: BusinessManagedEntity[] = querySnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const eventEntity: BusinessManagedEntity = {
            id: docSnap.id,
            businessId: data.businessId || businessIdToFetch,
            type: "event",
            name: data.name || "Evento sin nombre",
            description: data.description || "",
            termsAndConditions: data.termsAndConditions || "",
            startDate: (anyToDate(data.startDate) ?? new Date()).toISOString(),
            endDate: (anyToDate(data.endDate) ?? new Date()).toISOString(),
            isActive: data.isActive === undefined ? true : data.isActive,
            imageUrl: data.imageUrl || "",
            aiHint: data.aiHint || "",
            generatedCodes: Array.isArray(data.generatedCodes)
              ? data.generatedCodes.map((gc: any) => sanitizeObjectForFirestore({ ...gc }) as GeneratedCode)
              : [],
            ticketTypes: Array.isArray(data.ticketTypes) ? data.ticketTypes.map((tt: any) => sanitizeObjectForFirestore({ ...tt })) : [],
            eventBoxes: Array.isArray(data.eventBoxes) ? data.eventBoxes.map((eb: any) => sanitizeObjectForFirestore({ ...eb })) : [],
            assignedPromoters: Array.isArray(data.assignedPromoters)
              ? data.assignedPromoters.map((ap: any) => sanitizeObjectForFirestore({ ...ap }))
              : [],
            maxAttendance: 0,
            createdAt: (anyToDate(data.createdAt) ?? new Date()).toISOString(),
          };
          eventEntity.maxAttendance = calculateMaxAttendance(eventEntity.ticketTypes);
          return eventEntity;
        });
        setEvents(
          fetched.sort((a, b) => {
            if (a.createdAt && b.createdAt)
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (a.startDate && b.startDate)
              return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
            return 0;
          })
        );
      } catch (error: any) {
        console.error("Events Page: Error fetching events:", error.code, error.message, error);
        toast({
          title: "Error al Cargar Eventos",
          description: `No se pudieron obtener los eventos. ${error.message}`,
          variant: "destructive",
        });
        setEvents([]);
      }
    },
    [toast]
  );
  
  const fetchBusinessPromotersForAssignment = useCallback(
    async (businessIdToFetch: string) => {
      if (!businessIdToFetch) {
        setAvailablePromotersForAssignment([]);
        return;
      }
      try {
        const q = query(
          collection(db, "businessPromoterLinks"),
          where("businessId", "==", businessIdToFetch),
          where("isActive", "==", true)
        );
        const querySnapshot = await getDocs(q);
        const fetchedLinks: BusinessPromoterLink[] = querySnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            businessId: data.businessId,
            promoterDni: data.promoterDni || "N/A",
            promoterName: data.promoterName || "Promotor Sin Nombre",
            promoterEmail: data.promoterEmail || "Sin Email",
            promoterPhone: data.promoterPhone || "",
            promoterPlatformUserId: data.promoterPlatformUserId || "",
            commissionRate: data.commissionRate || "No definida",
            isActive: data.isActive === undefined ? true : data.isActive,
            isPlatformUser: data.isPlatformUser || false,
            platformUserUid: data.platformUserUid,
            joinDate:
              data.joinDate instanceof Timestamp
                ? data.joinDate.toDate().toISOString()
                : typeof data.joinDate === "string"
                ? data.joinDate
                : new Date().toISOString(),
          };
        });
        setAvailablePromotersForAssignment(fetchedLinks);
      } catch (error: any) {
        console.error("Events Page: Error fetching promoter profiles for assignment:", error.code, error.message, error);
        setAvailablePromotersForAssignment([]);
        toast({
          title: "Error al cargar promotores",
          description:
            "Asegúrate de tener permisos para leer la colección 'businessPromoterLinks' y que los datos sean correctos.",
          variant: "destructive",
          duration: 10000,
        });
      }
    },
    [toast]
  );
  
  useEffect(() => {
    setCurrentBusinessId(userProfile?.businessId ?? null);
  }, [userProfile?.businessId]);
  
  // ✅ MEJORADA - Manejo de errores y timeout para evitar carga infinita
  useEffect(() => {
    // Resetear modales y estados relacionados
    setActiveModal('closed');
    setModalContext(null);
    
    // Si no hay businessId, limpiar datos y salir
    if (!currentBusinessId) {
      setEvents([]);
      setAvailablePromotersForAssignment([]);
      setIsLoadingPageData(false);
      return;
    }
    
    // Marcar como cargando
    setIsLoadingPageData(true);
    
    // Crear un timeout para evitar carga infinita
    const loadingTimeout = setTimeout(() => {
      if (isLoadingPageData) {
        console.error("Events Page: Timeout - Las consultas a Firestore tardaron demasiado");
        toast({
          title: "Error de carga",
          description: "Las consultas a la base de datos tardaron demasiado. Verifica tu conexión a Firebase.",
          variant: "destructive",
        });
        setIsLoadingPageData(false);
      }
    }, 15000); // 15 segundos de timeout
    
    // Función para manejar errores de forma consistente
    const handleError = (error: any, operation: string) => {
      console.error(`Events Page: Error en ${operation}:`, {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      toast({
        title: `Error al cargar ${operation}`,
        description: error.message || "Error desconocido al conectarse a Firebase",
        variant: "destructive",
      });
    };
    
    // Ejecutar las consultas
    Promise.all([
      fetchBusinessEvents(currentBusinessId).catch(error => {
        handleError(error, "eventos");
        return []; // Devolver array vacío para no romper Promise.all
      }),
      fetchBusinessPromotersForAssignment(currentBusinessId).catch(error => {
        handleError(error, "promotores");
        return []; // Devolver array vacío para no romper Promise.all
      })
    ])
    .finally(() => {
      clearTimeout(loadingTimeout);
      setIsLoadingPageData(false);
      
      // Resetear modales después de cargar datos
      setTimeout(() => {
        setActiveModal('closed');
        setModalContext(null);
        setEditingEvent(null);
        setIsDuplicatingEvent(false);
      }, 50);
    });

    // Limpieza al desmontar
    return () => clearTimeout(loadingTimeout);
  }, [currentBusinessId, fetchBusinessEvents, fetchBusinessPromotersForAssignment]);
  
  /* ========================
     Filtro de eventos
  ======================== */
  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => {
        const nameMatch =
          event.name && typeof event.name === "string"
            ? event.name.toLowerCase().includes(searchTerm.toLowerCase())
            : false;
        const descriptionMatch =
          event.description && typeof event.description === "string"
            ? event.description.toLowerCase().includes(searchTerm.toLowerCase())
            : false;
        return nameMatch || descriptionMatch;
      })
      .sort((a, b) => {
        const aActiveCurrent = isEntityCurrentlyActivatable(a);
        const bActiveCurrent = isEntityCurrentlyActivatable(b);
        if (aActiveCurrent && !bActiveCurrent) return -1;
        if (!aActiveCurrent && bActiveCurrent) return 1;
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        if (a.createdAt && b.createdAt)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (a.startDate && b.startDate)
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        return 0;
      });
  }, [events, searchTerm]);
  
  /* ========================
     Apertura y creación
  ======================== */
  const handleOpenManageEventModal = (
    eventToManage: BusinessManagedEntity | null,
    duplicate = false
  ) => {
    // ✅ PREVENIR APERTURA ACCIDENTAL
    if (isSubmitting) return;
    
    setIsSubmitting(false);
    setIsDuplicatingEvent(duplicate);
    commissionRuleForm.reset();
    setSelectedPromoterForAssignment("");
    
    if (duplicate && eventToManage && currentBusinessId) {
      const {
        id,
        generatedCodes,
        ticketTypes = [],
        eventBoxes = [],
        assignedPromoters = [],
        createdAt,
        ...eventDataToDuplicate
      } = eventToManage;
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const newEventForDuplication: BusinessManagedEntity = {
        ...eventDataToDuplicate,
        id: "",
        businessId: currentBusinessId,
        type: "event",
        name: `${eventToManage.name || "Evento"} (Copia)`,
        startDate: eventToManage.startDate ? anyToDate(eventToManage.startDate)!.toISOString() : now.toISOString(),
        endDate: eventToManage.endDate ? anyToDate(eventToManage.endDate)!.toISOString() : oneWeekFromNow.toISOString(),
        isActive: true,
        ticketTypes: [],
        eventBoxes: [],
        assignedPromoters: [],
        generatedCodes: [],
        maxAttendance: 0,
        createdAt: undefined,
      };
      setEditingEvent(newEventForDuplication);
      setActiveModal('manageEvent');
    } else if (eventToManage) {
      setEditingEvent({
        ...eventToManage,
        startDate: anyToDate(eventToManage.startDate)!.toISOString(),
        endDate: anyToDate(eventToManage.endDate)!.toISOString(),
        maxAttendance: calculateMaxAttendance(eventToManage.ticketTypes),
      });
      setActiveModal('manageEvent');
    } else {
      initialEventForm.reset({
        name: "",
        description: "",
        startDate: set(new Date(), { hours: 19, minutes: 0, seconds: 0, milliseconds: 0 }),
        endDate: set(new Date(new Date().setDate(new Date().getDate() + 1)), {
          hours: 2,
          minutes: 0,
          seconds: 0,
          milliseconds: 0,
        }),
      });
      setEditingEvent(null);
      setActiveModal('initialEvent');
    }
  };
  
  const handleInitialEventSubmit = useCallback(
    async (data: InitialEventFormValues) => {
      if (!currentBusinessId) {
        toast({
          title: "Error de Negocio",
          description: "Tu perfil de usuario no está asociado a un negocio. No se puede crear el evento.",
          variant: "destructive",
          duration: 7000,
        });
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(true);
      const newEventToSave: Omit<
        BusinessManagedEntity,
        "id" | "createdAt" | "businessId" | "startDate" | "endDate" | "maxAttendance"
      > = {
        type: "event",
        name: data.name,
        description: data.description || "",
        termsAndConditions: "",
        isActive: true,
        imageUrl: `https://placehold.co/600x400.png?text=${encodeURIComponent(
          data.name.substring(0, 10)
        )}`,
        aiHint: data.name.split(" ").slice(0, 2).join(" ") || "event image",
        ticketTypes: [],
        eventBoxes: [],
        assignedPromoters: [],
        generatedCodes: [],
      };
      const defaultTicketData: Omit<TicketType, "id" | "eventId" | "businessId"> = {
        name: "Entrada General",
        cost: 0,
        quantity: 0,
        description: "Entrada estándar para el evento.",
      };
      let docRef;
      try {
        const eventPayloadForFirestore = {
          ...newEventToSave,
          businessId: currentBusinessId,
          startDate: Timestamp.fromDate(data.startDate),
          endDate: Timestamp.fromDate(data.endDate),
          ticketTypes: [
            sanitizeObjectForFirestore({
              ...defaultTicketData,
              id: `tt-initial-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              eventId: "",
              businessId: currentBusinessId,
            }),
          ],
          maxAttendance: calculateMaxAttendance(newEventToSave.ticketTypes),
          createdAt: serverTimestamp(),
        };
        docRef = await addDoc(collection(db, "businessEntities"), sanitizeObjectForFirestore(eventPayloadForFirestore));
        const finalNewEvent: BusinessManagedEntity = {
          ...newEventToSave,
          id: docRef.id,
          businessId: currentBusinessId,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
          createdAt: new Date().toISOString(),
          ticketTypes: eventPayloadForFirestore.ticketTypes.map((tt: any, index: number) => ({
            ...tt,
            id: `tt-${docRef!.id}-${Date.now()}-${index}`,
            eventId: docRef!.id,
          })),
          maxAttendance: calculateMaxAttendance(eventPayloadForFirestore.ticketTypes),
        };
        await updateDoc(doc(db, "businessEntities", docRef.id), {
          ticketTypes: finalNewEvent.ticketTypes.map((tt) => sanitizeObjectForFirestore(tt)),
          maxAttendance: finalNewEvent.maxAttendance,
        });
        setEvents((prev) => [finalNewEvent, ...prev]);
        toast({
          title: "Evento Creado Inicialmente",
          description: `El evento "${finalNewEvent.name}" ha sido creado. Ahora puedes configurar más detalles.`,
        });
        setActiveModal('manageEvent');
        setEditingEvent(finalNewEvent);
      } catch (error: any) {
        console.error("Events Page: Error creating event:", error.code, error.message, error);
        let descriptionError = `No se pudo crear el evento. ${error.message}.`;
        if (error.code === "permission-denied") {
          descriptionError = `Error de permisos al crear el evento. Verifica tu perfil en 'platformUsers' (roles, businessId) y las reglas de Firestore. Detalle: ${error.message}`;
        } else if (error.code === "invalid-argument") {
          descriptionError = `Error al crear evento: Datos inválidos. Revisa los campos. ${error.message}`;
        }
        toast({
          title: "Error al Crear Evento",
          description: descriptionError,
          variant: "destructive",
          duration: 15000,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentBusinessId, toast, initialEventForm]
  );
  
  /* ========================
     Guardado/Eliminación
  ======================== */
  const handleDeleteEvent = async (eventId: string, eventName?: string) => {
    if (isSubmitting) return;
    if (!currentBusinessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "businessEntities", eventId));
      toast({
        title: "Evento Eliminado",
        description: `El evento "${eventName || "seleccionado"}" ha sido eliminado.`,
        variant: "destructive",
      });
      if (currentBusinessId) fetchBusinessEvents(currentBusinessId);
      if (editingEvent?.id === eventId) {
        setActiveModal('closed');
        setEditingEvent(null);
      }
    } catch (error: any) {
      console.error("Events Page: Error deleting event:", error.code, error.message, error);
      toast({
        title: "Error al Eliminar",
        description: `No se pudo eliminar el evento. ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSaveManagedEventAndClose = async () => {
    if (!editingEvent || !currentBusinessId) {
      toast({
        title: "Error",
        description: "No hay evento para guardar o ID de negocio no disponible.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const eventToSave: BusinessManagedEntity = {
        ...editingEvent,
        maxAttendance: calculateMaxAttendance(editingEvent.ticketTypes),
        businessId: currentBusinessId,
        type: "event",
      };
      const finalTicketTypes = (eventToSave.ticketTypes || []).map((tt, index) =>
        sanitizeObjectForFirestore({
          ...tt,
          id: tt.id || `tt-${eventToSave.id || "new"}-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}F`,
          eventId: eventToSave.id || "",
          businessId: currentBusinessId,
        }) as TicketType
      );
      const finalEventBoxes = (eventToSave.eventBoxes || []).map((eb, index) =>
        sanitizeObjectForFirestore({
          ...eb,
          id: eb.id || `box-${eventToSave.id || "new"}-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}G`,
          eventId: eventToSave.id || "",
          businessId: currentBusinessId,
        }) as EventBox
      );
      const finalAssignedPromoters = (eventToSave.assignedPromoters || []).map((ap) =>
        sanitizeObjectForFirestore({
          ...ap,
          promoterProfileId: ap.promoterProfileId || `unknown-promoter-${Date.now()}-${Math.random().toString(36).slice(2)}H`,
          commissionRules: (ap.commissionRules || []).map((cr, crIndex) =>
            sanitizeObjectForFirestore({
              ...cr,
              id: cr.id || `cr-${ap.promoterProfileId || "unknown"}-${Date.now()}-${crIndex}-${Math.random().toString(36).slice(2)}I`,
            }) as CommissionRule
          ),
        }) as EventPromoterAssignment
      );
      const finalGeneratedCodes = Array.isArray(eventToSave.generatedCodes)
        ? eventToSave.generatedCodes.map((gc) => sanitizeObjectForFirestore({ ...gc }))
        : [];
      const payloadForFirestore: any = sanitizeObjectForFirestore({
        ...eventToSave,
        ticketTypes: finalTicketTypes,
        eventBoxes: finalEventBoxes,
        assignedPromoters: finalAssignedPromoters,
        generatedCodes: finalGeneratedCodes,
        startDate: Timestamp.fromDate(anyToDate(eventToSave.startDate)!),
        endDate: Timestamp.fromDate(anyToDate(eventToSave.endDate)!),
        createdAt: eventToSave.createdAt
          ? Timestamp.fromDate(new Date(eventToSave.createdAt))
          : serverTimestamp(),
      });
      delete payloadForFirestore.id;
      if (isDuplicatingEvent || !editingEvent.id || editingEvent.id === "") {
        if (!payloadForFirestore.createdAt) payloadForFirestore.createdAt = serverTimestamp();
        await addDoc(collection(db, "businessEntities"), payloadForFirestore);
        toast({
          title: isDuplicatingEvent ? "Evento Duplicado Exitosamente" : "Evento Creado Exitosamente",
          description: `El evento "${payloadForFirestore.name}" ha sido guardado.`,
        });
      } else {
        if (payloadForFirestore.createdAt === undefined) {
          delete payloadForFirestore.createdAt;
        }
        await updateDoc(doc(db, "businessEntities", editingEvent.id), payloadForFirestore);
        toast({
          title: "Evento Guardado",
          description: `Los cambios en "${payloadForFirestore.name}" han sido guardados.`,
        });
      }
      setActiveModal('closed');
      setEditingEvent(null);
      setIsDuplicatingEvent(false);
      if (currentBusinessId) fetchBusinessEvents(currentBusinessId);
    } catch (error: any) {
      console.error("Events Page: Error saving/updating event:", error.code, error.message, error);
      toast({
        title: "Error al Guardar Evento",
        description: `No se pudo guardar el evento. ${error.message}`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  /* ========================
     Códigos (QR)
  ======================== */
  const openCreateCodesDialog = (event: BusinessManagedEntity) => {
    if (!isEntityCurrentlyActivatable(event)) {
      toast({
        title: "No se pueden crear códigos",
        description: "Este evento no está activo o está fuera de su periodo de vigencia.",
        variant: "destructive",
      });
      return;
    }
    setModalContext({ entity: event });
    setActiveModal('createCodes');
  };
  
  const openViewCodesDialog = (event: BusinessManagedEntity) => {
    setModalContext({ entity: event });
    setActiveModal('manageCodes');
  };
  
  const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    if (isSubmitting) {
      setIsSubmitting(false);
      return;
    }
    if (!currentBusinessId || !userProfile?.name || !userProfile.uid) {
      toast({
        title: "Error",
        description: "ID de negocio o datos de usuario no disponibles para crear códigos.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    const targetEventRef = doc(db, "businessEntities", entityId);
    try {
      const targetEventSnap = await getDoc(targetEventRef);
      if (!targetEventSnap.exists()) {
        toast({
          title: "Error",
          description: "Evento no encontrado para añadir códigos.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      const targetEventData = targetEventSnap.data() as BusinessManagedEntity;
      const newCodesWithDetails = newCodes.map(
        (code) =>
          sanitizeObjectForFirestore({
            ...code,
            entityId,
            generatedByName: userProfile.name,
            generatedByUid: userProfile.uid,
            observation: observation && observation.trim() !== "" ? observation.trim() : null,
            redemptionDate: code.redemptionDate || null,
            redeemedByInfo: code.redeemedByInfo || null,
            isVipCandidate: code.isVipCandidate || false,
          }) as GeneratedCode
      );
      const existingSanitizedCodes = (targetEventData.generatedCodes || []).map((c) =>
        sanitizeObjectForFirestore(c as GeneratedCode)
      );
      const updatedCodes = [...existingSanitizedCodes, ...newCodesWithDetails];
      await updateDoc(targetEventRef, { generatedCodes: updatedCodes });
      toast({
        title: `${newCodes.length} Código(s) Creado(s)`,
        description: `Para: ${targetEventData.name}. Guardados en la base de datos.`,
      });
      if (currentBusinessId) fetchBusinessEvents(currentBusinessId);
      if (editingEvent && editingEvent.id === entityId) {
        setEditingEvent((prev) => (prev ? { ...prev, generatedCodes: updatedCodes } : null));
      }
      if (modalContext?.entity && modalContext.entity.id === entityId) {
        setModalContext(prev => prev ? { ...prev, entity: { ...prev.entity, generatedCodes: updatedCodes } } : null);
      }
    } catch (error: any) {
      console.error("Events Page: Error saving new codes to Firestore:", error.code, error.message, error);
      toast({
        title: "Error al Guardar Códigos",
        description: `No se pudieron guardar los códigos. ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCodesUpdatedFromManageDialog = async (
    entityId: string,
    updatedCodesFromDialog: GeneratedCode[]
  ) => {
    if (isSubmitting) {
      setIsSubmitting(false);
      return;
    }
    if (!currentBusinessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    const targetEventRef = doc(db, "businessEntities", entityId);
    try {
      const targetEventSnap = await getDoc(targetEventRef);
      if (!targetEventSnap.exists()) {
        toast({
          title: "Error",
          description: "Evento no encontrado para actualizar códigos.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      const targetEventData = targetEventSnap.data() as BusinessManagedEntity;
      const updatedCodesForFirestore = updatedCodesFromDialog.map((code) =>
        sanitizeObjectForFirestore(code as GeneratedCode)
      );
      await updateDoc(targetEventRef, { generatedCodes: updatedCodesForFirestore });
      toast({
        title: "Códigos Actualizados",
        description: `Los códigos para "${targetEventData.name}" han sido guardados en la base de datos.`,
      });
      if (currentBusinessId) fetchBusinessEvents(currentBusinessId);
      if (editingEvent && editingEvent.id === entityId) {
        setEditingEvent((prev) => (prev ? { ...prev, generatedCodes: updatedCodesForFirestore } : null));
      }
      if (modalContext?.entity && modalContext.entity.id === entityId) {
        setModalContext(prev => prev ? { ...prev, entity: { ...prev.entity, generatedCodes: updatedCodesForFirestore } } : null);
      }
    } catch (error: any) {
      console.error("Events Page: Error saving updated codes to Firestore:", error.code, error.message, error);
      toast({
        title: "Error al Guardar Códigos",
        description: `No se pudieron actualizar los códigos. ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  /* ========================
     Tickets / Boxes / Promotores
  ======================== */
  const handleOpenTicketFormModal = (ticket: TicketType | null) => {
    if (!editingEvent) {
      toast({
        title: "Error",
        description: "No hay un evento seleccionado para gestionar entradas.",
        variant: "destructive",
      });
      return;
    }
    setModalContext({ ticket });
    setActiveModal('ticketForm');
  };
  
  const handleCreateOrEditTicketTypeForEvent = (data: TicketTypeFormData) => {
    if (!editingEvent || !currentBusinessId) {
      toast({
        title: "Error",
        description: "No hay un evento seleccionado o ID de negocio para añadir/editar entradas.",
        variant: "destructive",
      });
      return;
    }
    const currentTickets = editingEvent.ticketTypes || [];
    let updatedTickets: TicketType[];
    const sanitizedData = sanitizeObjectForFirestore(data) as TicketTypeFormData;
    if (modalContext?.ticket && modalContext.ticket.id) {
      updatedTickets = currentTickets.map((tt) =>
        tt.id === modalContext.ticket.id
          ? {
              ...tt,
              ...sanitizedData,
              businessId: currentBusinessId,
              eventId: editingEvent.id || "",
              quantity:
                sanitizedData.quantity === undefined ||
                sanitizedData.quantity === null ||
                isNaN(Number(sanitizedData.quantity))
                  ? undefined
                  : Number(sanitizedData.quantity),
            }
          : tt
      );
      toast({
        title: "Entrada Actualizada",
        description: `La entrada "${sanitizedData.name}" ha sido actualizada en el editor.`,
      });
    } else {
      const newTicket: TicketType = {
        id: `tt-${editingEvent.id || "new"}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        businessId: currentBusinessId,
        eventId: editingEvent.id || "",
        ...sanitizedData,
        quantity:
          sanitizedData.quantity === undefined ||
          sanitizedData.quantity === null ||
          isNaN(Number(sanitizedData.quantity))
            ? undefined
            : Number(sanitizedData.quantity),
      };
      updatedTickets = [...currentTickets, newTicket];
      toast({
        title: "Entrada Creada",
        description: `La entrada "${sanitizedData.name}" ha sido añadida al editor.`,
      });
    }
    const newMaxAttendance = calculateMaxAttendance(updatedTickets);
    setEditingEvent((prev) => (prev ? { ...prev, ticketTypes: updatedTickets, maxAttendance: newMaxAttendance } : null));
    setActiveModal('manageEvent');
    setModalContext(null);
  };
  
  const handleDeleteTicketTypeFromEvent = (ticketId: string) => {
    if (!editingEvent) return;
    const ticketToDelete = editingEvent.ticketTypes?.find((tt) => tt.id === ticketId);
    if (!ticketToDelete) return;
    const updatedTickets = (editingEvent.ticketTypes || []).filter((tt) => tt.id !== ticketId);
    const newMaxAttendance = calculateMaxAttendance(updatedTickets);
    setEditingEvent((prev) => (prev ? { ...prev, ticketTypes: updatedTickets, maxAttendance: newMaxAttendance } : null));
    toast({
      title: `Entrada "${ticketToDelete.name}" Eliminada del editor`,
      variant: "destructive",
    });
  };
  
  const handleOpenBoxFormModal = (box: EventBox | null) => {
    if (!editingEvent) {
      toast({
        title: "Error",
        description: "No hay un evento seleccionado para gestionar boxes.",
        variant: "destructive",
      });
      return;
    }
    setModalContext({ box });
    setActiveModal('boxForm');
  };
  
  const handleCreateOrEditBoxForEvent = (data: EventBoxFormData) => {
    if (!editingEvent || !currentBusinessId) {
      toast({
        title: "Error",
        description: "No hay un evento seleccionado o ID de negocio para añadir/editar boxes.",
        variant: "destructive",
      });
      return;
    }
    const currentBoxes = editingEvent.eventBoxes || [];
    let updatedBoxes: EventBox[];
    const sanitizedData = sanitizeObjectForFirestore(data) as EventBoxFormData;
    if (modalContext?.box && modalContext.box.id) {
      updatedBoxes = currentBoxes.map((b) =>
        b.id === modalContext.box.id
          ? {
              ...b,
              ...sanitizedData,
              id: b.id,
              businessId: currentBusinessId,
              eventId: editingEvent.id || "",
            }
          : b
      );
      toast({
        title: "Box Actualizado",
        description: `El box "${sanitizedData.name}" ha sido actualizado en el editor.`,
      });
    } else {
      const newBox: EventBox = {
        id: `box-${editingEvent.id || "new"}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        businessId: currentBusinessId,
        eventId: editingEvent.id || "",
        ...sanitizedData,
      };
      updatedBoxes = [...currentBoxes, newBox];
      toast({ title: "Box Creado", description: `El box "${sanitizedData.name}" ha sido añadido al editor.` });
    }
    setEditingEvent((prev) => (prev ? { ...prev, eventBoxes: updatedBoxes } : null));
    setActiveModal('manageEvent');
    setModalContext(null);
  };
  
  const handleDeleteBoxFromEvent = (boxId: string) => {
    if (!editingEvent) return;
    const boxToDelete = editingEvent.eventBoxes?.find((b) => b.id === boxId);
    if (!boxToDelete) return;
    const updatedBoxes = (editingEvent.eventBoxes || []).filter((b) => b.id !== boxId);
    setEditingEvent((prev) => (prev ? { ...prev, eventBoxes: updatedBoxes } : null));
    toast({ title: `Box "${boxToDelete.name}" Eliminado del editor`, variant: "destructive" });
  };
  
  const handleCreateBatchBoxes = (data: BatchBoxFormData) => {
    if (!editingEvent || !currentBusinessId) {
      toast({
        title: "Error",
        description: "No hay un evento seleccionado para crear boxes en lote.",
        variant: "destructive",
      });
      return;
    }
    const existingBoxNames = new Set((editingEvent.eventBoxes || []).map((b) => b.name.toLowerCase()));
    const newBoxes: EventBox[] = [];
    let hasDuplicates = false;
    for (let i = data.fromNumber; i <= data.toNumber; i++) {
      const boxName = `${data.prefix} ${i}`;
      if (existingBoxNames.has(boxName.toLowerCase())) {
        hasDuplicates = true;
        toast({
          title: "Error: Box Duplicado",
          description: `El box "${boxName}" ya existe en este evento. No se creó ningún box del lote.`,
          variant: "destructive",
        });
        break;
      }
      newBoxes.push(
        sanitizeObjectForFirestore({
          id: `box-batch-${editingEvent.id || "new"}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
          businessId: currentBusinessId,
          eventId: editingEvent.id || "",
          name: boxName,
          cost: data.cost,
          description: data.description || "",
          status: data.status,
          capacity: data.capacity === undefined || data.capacity === null ? undefined : data.capacity,
          sellerName: "",
          ownerName: "",
          ownerDni: "",
        }) as EventBox
      );
    }
    if (!hasDuplicates && newBoxes.length > 0) {
      const updatedBoxes = [...(editingEvent.eventBoxes || []), ...newBoxes];
      setEditingEvent((prev) => (prev ? { ...prev, eventBoxes: updatedBoxes } : null));
      toast({
        title: "Lote de Boxes Creado",
        description: `${newBoxes.length} boxes han sido añadidos al editor.`,
      });
    }
    setActiveModal('manageEvent');
    setModalContext(null);
  };
  
  const handleAssignPromoterToEvent = () => {
    if (!editingEvent || !selectedPromoterForAssignment || !currentBusinessId) {
      toast({
        title: "Error",
        description: "Selecciona un evento y un promotor, o falta ID de negocio.",
        variant: "destructive",
      });
      return;
    }
    const promoterLinkData = availablePromotersForAssignment.find(
      (pLink) => pLink.id === selectedPromoterForAssignment
    );
    if (!promoterLinkData) {
      toast({
        title: "Error",
        description: "Datos del promotor vinculado no encontrados.",
        variant: "destructive",
      });
      return;
    }
    const promoterIdentifierForAssignment =
      promoterLinkData.promoterPlatformUserId || promoterLinkData.promoterDni || promoterLinkData.id;
    const existingAssignment = editingEvent.assignedPromoters?.find(
      (ap) => ap.promoterProfileId === promoterIdentifierForAssignment
    );
    if (existingAssignment) {
      toast({
        title: "Promotor ya Asignado",
        description: `${promoterLinkData.promoterName} ya está asignado a este evento.`,
        variant: "destructive",
      });
      return;
    }
    const newAssignment: EventPromoterAssignment = sanitizeObjectForFirestore({
      promoterProfileId: promoterIdentifierForAssignment,
      promoterName: promoterLinkData.promoterName,
      promoterEmail: promoterLinkData.promoterEmail,
      commissionRules: [],
      notes: "",
    }) as EventPromoterAssignment;
    setEditingEvent((prev) => {
      if (!prev) return null;
      return { ...prev, assignedPromoters: [...(prev.assignedPromoters || []), newAssignment] };
    });
    setSelectedPromoterForAssignment("");
    toast({
      title: "Promotor Asignado al Evento",
      description: `${promoterLinkData.promoterName} asignado al editor.`,
    });
  };
  
  const handleRemovePromoterFromEvent = (promoterProfileIdToRemove: string) => {
    if (!editingEvent) return;
    const promoterToRemove = editingEvent.assignedPromoters?.find(
      (ap) => ap.promoterProfileId === promoterProfileIdToRemove
    );
    if (!promoterToRemove) return;
    setEditingEvent((prev) =>
      prev
        ? {
            ...prev,
            assignedPromoters: (prev.assignedPromoters || []).filter(
              (ap) => ap.promoterProfileId !== promoterProfileIdToRemove
            ),
          }
        : null
    );
    toast({
      title: `Promotor "${promoterToRemove.promoterName}" Desvinculado del editor`,
      variant: "destructive",
    });
  };
  
  const handleOpenCommissionRuleForm = (assignment: EventPromoterAssignment, rule?: CommissionRule) => {
    if (!editingEvent) return;
    setCurrentPromoterAssignmentForRules(assignment);
    setModalContext({ rule });
    setActiveModal('commissionRule');
  };
  
  const handleCommissionRuleFormSubmit = (data: CommissionRuleFormValues) => {
    if (!editingEvent || !currentPromoterAssignmentForRules) return;
    const updatedAssignments = (editingEvent.assignedPromoters || []).map((assignment) => {
      if (assignment.promoterProfileId === currentPromoterAssignmentForRules.promoterProfileId) {
        let updatedRules = [...(assignment.commissionRules || [])];
        const sanitizedRuleData = sanitizeObjectForFirestore(data) as CommissionRuleFormValues;
        let ruleAppliesToName = "General del Evento";
        if (sanitizedRuleData.appliesTo === "ticket_type" && sanitizedRuleData.appliesToId) {
          const ticket = editingEvent.ticketTypes?.find((t) => t.id === sanitizedRuleData.appliesToId);
          ruleAppliesToName = ticket?.name || `Entrada ID: ${sanitizedRuleData.appliesToId.substring(0, 5)}`;
        } else if (sanitizedRuleData.appliesTo === "box_type" && sanitizedRuleData.appliesToId) {
          const box = editingEvent.eventBoxes?.find((b) => b.id === sanitizedRuleData.appliesToId);
          ruleAppliesToName = box?.name || `Box ID: ${sanitizedRuleData.appliesToId.substring(0, 5)}`;
        }
        const newRuleBase: Omit<CommissionRule, "id"> = {
          appliesTo: sanitizedRuleData.appliesTo,
          appliesToId: sanitizedRuleData.appliesTo === "event_general" ? undefined : sanitizedRuleData.appliesToId,
          appliesToName: ruleAppliesToName,
          commissionType: sanitizedRuleData.commissionType,
          commissionValue: sanitizedRuleData.commissionValue || 0,
          description: sanitizedRuleData.description || "",
        };
        if (modalContext?.rule && modalContext.rule.id) {
          updatedRules = updatedRules.map((rule) =>
            rule.id === modalContext.rule.id ? { ...newRuleBase, id: rule.id } : rule
          );
        } else {
          const newRule: CommissionRule = {
            id: `cr-${currentPromoterAssignmentForRules.promoterProfileId}-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`,
            ...newRuleBase,
          };
          updatedRules.push(newRule);
        }
        return { ...assignment, commissionRules: updatedRules };
      }
      return assignment;
    });
    setEditingEvent((prev) => (prev ? { ...prev, assignedPromoters: updatedAssignments } : null));
    setActiveModal('manageEvent');
    setModalContext(null);
    setCurrentPromoterAssignmentForRules(null);
    toast({ title: modalContext?.rule ? "Regla de Comisión Actualizada" : "Regla de Comisión Añadida" });
  };
  
  const handleDeleteCommissionRule = (assignmentPromoterId: string, ruleId: string) => {
    if (!editingEvent) return;
    const assignedPromoter = editingEvent.assignedPromoters?.find(
      (ap) => ap.promoterProfileId === assignmentPromoterId
    );
    const ruleToDelete = assignedPromoter?.commissionRules?.find((r) => r.id === ruleId);
    if (!ruleToDelete) return;
    const updatedAssignments = (editingEvent.assignedPromoters || []).map((assignment) => {
      if (assignment.promoterProfileId === assignmentPromoterId) {
        const updatedRules = (assignment.commissionRules || []).filter((rule) => rule.id !== ruleId);
        return { ...assignment, commissionRules: updatedRules };
      }
      return assignment;
    });
    setEditingEvent((prev) => (prev ? { ...prev, assignedPromoters: updatedAssignments } : null));
    toast({
      title: `Regla de Comisión "${ruleToDelete.appliesToName || ruleToDelete.id?.substring(0, 5) || "N/A"}" Eliminada`,
      variant: "destructive",
    });
  };
  
  const openStatsModalForMainList = (event: BusinessManagedEntity) => {
    setSelectedEventForStats(event);
    setActiveModal('stats');
  };
  
  /* ========================
     Render
  ======================== */
  if (isLoadingPageData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] space-y-4">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div>
            <p className="text-lg font-semibold text-primary">Cargando información...</p>
            <p className="text-muted-foreground">Conectando a Firebase - Por favor espera</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground max-w-md text-center">
          <p>Si esto tarda más de 15 segundos, podría haber un problema con:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Tus reglas de seguridad de Firestore</li>
            <li>La conexión a Firebase en Firebase Studio</li>
            <li>El ID de negocio asociado a tu perfil</li>
          </ul>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Eventos</CardTitle>
              <ShadcnCardDescription>
                Gestiona los eventos de tu negocio. Crea, edita y monitorea el estado de tus eventos.
              </ShadcnCardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar eventos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-full sm:w-[300px]"
                />
              </div>
              <Button onClick={() => handleOpenManageEventModal(null)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Evento
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="current" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="current">Eventos Actuales</TabsTrigger>
              <TabsTrigger value="past">Eventos Pasados</TabsTrigger>
            </TabsList>
            <TabsContent value="current">
              <ScrollArea className="h-[600px] pr-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Detalles</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents
                      .filter((event) => isEntityCurrentlyActivatable(event))
                      .map((event) => {
                        const codesCreatedCount = event.generatedCodes?.length || 0;
                        const codesRedeemedCount = event.generatedCodes?.filter(
                          (c) => c.status === "redeemed"
                        ).length || 0;
                        const isActivatable = isEntityCurrentlyActivatable(event);
                        
                        return (
                          <TableRow key={event.id} className={cn(!isActivatable && "opacity-50")}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{event.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {event.description?.substring(0, 50)}
                                  {event.description && event.description.length > 50 && "..."}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <StatusSwitch 
                                  eventId={event.id!} 
                                  initialStatus={event.isActive} 
                                  onStatusChange={handleToggleEventStatus}
                                  isSubmitting={isSubmitting}
                                />
                                <Badge variant={event.isActive ? "default" : "secondary"}>
                                  {event.isActive ? "Activo" : "Inactivo"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="align-top py-3 text-xs">
                              <div className="flex flex-col">
                                <span>Códigos Creados ({codesCreatedCount})</span>
                                <span>QRs Generados (0)</span>
                                <span>QRs Usados ({codesRedeemedCount})</span>
                                <span>Aforo Máximo ({event.maxAttendance === 0 || !event.maxAttendance ? "Ilimitado" : event.maxAttendance})</span>
                              </div>
                            </TableCell>
                            <TableCell className="align-top py-3 text-xs">
                              {event.startDate ? format(parseISO(event.startDate), "P p", { locale: es }) : "N/A"}
                              <br />
                              {event.endDate ? format(parseISO(event.endDate), "P p", { locale: es }) : "N/A"}
                            </TableCell>
                            <TableCell className="align-top py-3">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => handleOpenManageEventModal(event)}
                                  disabled={isSubmitting}
                                  className="px-2 py-1 h-auto text-xs"
                                >
                                  <Edit className="h-3 w-3 mr-1" /> Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => handleOpenManageEventModal(event, true)}
                                  disabled={isSubmitting}
                                  className="px-2 py-1 h-auto text-xs"
                                >
                                  <Copy className="h-3 w-3 mr-1" /> Duplicar
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      disabled={isSubmitting}
                                      className="px-2 py-1 h-auto text-xs text-destructive hover:text-destructive border-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Esto eliminará permanentemente el evento "
                                        {event.name}" y sus datos asociados.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteEvent(event.id!, event.name)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Sí, Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => openCreateCodesDialog(event)}
                                  disabled={!isActivatable || isSubmitting}
                                  className="px-2 py-1 h-auto text-xs"
                                >
                                  <QrCodeIcon className="h-3 w-3 mr-1" /> Crear Códigos
                                </Button>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => openViewCodesDialog(event)}
                                  disabled={isSubmitting}
                                  className="px-2 py-1 h-auto text-xs"
                                >
                                  <ListChecks className="h-3 w-3 mr-1" /> Ver Códigos ({codesCreatedCount})
                                </Button>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => openStatsModalForMainList(event)}
                                  disabled={isSubmitting}
                                  className="px-2 py-1 h-auto text-xs"
                                >
                                  <BarChart3 className="h-3 w-3 mr-1" /> Estadísticas
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {filteredEvents.filter((event) => isEntityCurrentlyActivatable(event)).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay eventos actuales. Crea uno nuevo para comenzar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="past">
              <ScrollArea className="h-[600px] pr-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Detalles</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents
                      .filter((event) => !isEntityCurrentlyActivatable(event))
                      .map((event) => {
                        const codesCreatedCount = event.generatedCodes?.length || 0;
                        const codesRedeemedCount = event.generatedCodes?.filter(
                          (c) => c.status === "redeemed"
                        ).length || 0;
                        const isActivatable = isEntityCurrentlyActivatable(event);
                        
                        return (
                          <TableRow key={event.id} className={cn(!isActivatable && "opacity-50")}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{event.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {event.description?.substring(0, 50)}
                                  {event.description && event.description.length > 50 && "..."}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <StatusSwitch 
                                  eventId={event.id!} 
                                  initialStatus={event.isActive} 
                                  onStatusChange={handleToggleEventStatus}
                                  isSubmitting={isSubmitting}
                                />
                                <Badge variant={event.isActive ? "default" : "secondary"}>
                                  {event.isActive ? "Activo" : "Inactivo"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="align-top py-3 text-xs">
                              <div className="flex flex-col">
                                <span>Códigos Creados ({codesCreatedCount})</span>
                                <span>QRs Generados (0)</span>
                                <span>QRs Usados ({codesRedeemedCount})</span>
                                <span>Aforo Máximo ({event.maxAttendance === 0 || !event.maxAttendance ? "Ilimitado" : event.maxAttendance})</span>
                              </div>
                            </TableCell>
                            <TableCell className="align-top py-3 text-xs">
                              {event.startDate ? format(parseISO(event.startDate), "P p", { locale: es }) : "N/A"}
                              <br />
                              {event.endDate ? format(parseISO(event.endDate), "P p", { locale: es }) : "N/A"}
                            </TableCell>
                            <TableCell className="align-top py-3">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => handleOpenManageEventModal(event)}
                                  disabled={isSubmitting}
                                  className="px-2 py-1 h-auto text-xs"
                                >
                                  <Edit className="h-3 w-3 mr-1" /> Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => handleOpenManageEventModal(event, true)}
                                  disabled={isSubmitting}
                                  className="px-2 py-1 h-auto text-xs"
                                >
                                  <Copy className="h-3 w-3 mr-1" /> Duplicar
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      disabled={isSubmitting}
                                      className="px-2 py-1 h-auto text-xs text-destructive hover:text-destructive border-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Esto eliminará permanentemente el evento "
                                        {event.name}" y sus datos asociados.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteEvent(event.id!, event.name)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Sí, Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => openCreateCodesDialog(event)}
                                  disabled={!isActivatable || isSubmitting}
                                  className="px-2 py-1 h-auto text-xs"
                                >
                                  <QrCodeIcon className="h-3 w-3 mr-1" /> Crear Códigos
                                </Button>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => openViewCodesDialog(event)}
                                  disabled={isSubmitting}
                                  className="px-2 py-1 h-auto text-xs"
                                >
                                  <ListChecks className="h-3 w-3 mr-1" /> Ver Códigos ({codesCreatedCount})
                                </Button>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => openStatsModalForMainList(event)}
                                  disabled={isSubmitting}
                                  className="px-2 py-1 h-auto text-xs"
                                >
                                  <BarChart3 className="h-3 w-3 mr-1" /> Estadísticas
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {filteredEvents.filter((event) => !isEntityCurrentlyActivatable(event)).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay eventos pasados. Los eventos que finalicen aparecerán aquí.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* ======= MODALES UNIFICADOS - SOLUCIÓN DEFINITIVA ======= */}
      {activeModal === 'initialEvent' && (
        <Dialog 
          open={true} 
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              initialEventForm.reset();
              setActiveModal('closed');
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Evento</DialogTitle>
              <UIDialogDescription>
                Configura los detalles básicos de tu nuevo evento.
              </UIDialogDescription>
            </DialogHeader>
            <BusinessEventForm
              form={initialEventForm}
              onSubmit={handleInitialEventSubmit}
              isSubmitting={isSubmitting}
              isEditing={false}
              businessId={currentBusinessId || undefined}
            />
          </DialogContent>
        </Dialog>
      )}
      
      {activeModal === 'manageEvent' && editingEvent && (
        <Dialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setEditingEvent(null);
              setIsDuplicatingEvent(false);
              setCurrentPromoterAssignmentForRules(null);
              setSelectedPromoterForAssignment("");
            }
            setActiveModal('closed');
          }}
        >
          <DialogContent className="sm:max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {isDuplicatingEvent
                  ? `Duplicar Evento: ${(editingEvent?.name || "Evento").replace(" (Copia)", "")} (Copia)`
                  : editingEvent
                  ? `Editar Evento: ${editingEvent.name}`
                  : "Gestionar Evento"}
              </DialogTitle>
              <UIDialogDescription>
                {isDuplicatingEvent
                  ? "Configura los detalles del evento duplicado."
                  : "Administra todos los aspectos de tu evento"}
              </UIDialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="details">Detalles</TabsTrigger>
                <TabsTrigger value="tickets">Entradas</TabsTrigger>
                <TabsTrigger value="boxes">Boxes</TabsTrigger>
                <TabsTrigger value="promoters">Promotores</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details">
                <BusinessEventForm
                  form={initialEventForm}
                  onSubmit={handleSaveManagedEventAndClose}
                  isSubmitting={isSubmitting}
                  isEditing={true}
                  businessId={currentBusinessId || undefined}
                  existingEvent={editingEvent}
                />
              </TabsContent>
              
              <TabsContent value="tickets">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Tipos de Entrada</h3>
                    <Button onClick={() => handleOpenTicketFormModal(null)}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Nueva Entrada
                    </Button>
                  </div>
                  
                  {editingEvent.ticketTypes && editingEvent.ticketTypes.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Costo</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editingEvent.ticketTypes.map((ticket) => (
                          <TableRow key={ticket.id}>
                            <TableCell className="font-medium">{ticket.name}</TableCell>
                            <TableCell>S/ {ticket.cost?.toFixed(2) || "0.00"}</TableCell>
                            <TableCell>{ticket.quantity || "Ilimitado"}</TableCell>
                            <TableCell>{ticket.description || "Sin descripción"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenTicketFormModal(ticket)}
                                >
                                  <EditIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteTicketTypeFromEvent(ticket.id!)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay tipos de entrada definidos. Crea uno nuevo para comenzar.
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="boxes">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Boxes</h3>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setActiveModal('batchBoxes')}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Lote de Boxes
                      </Button>
                      <Button onClick={() => handleOpenBoxFormModal(null)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Box
                      </Button>
                    </div>
                  </div>
                  
                  {editingEvent.eventBoxes && editingEvent.eventBoxes.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Costo</TableHead>
                          <TableHead>Capacidad</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editingEvent.eventBoxes.map((box) => (
                          <TableRow key={box.id}>
                            <TableCell className="font-medium">{box.name}</TableCell>
                            <TableCell>S/ {box.cost?.toFixed(2) || "0.00"}</TableCell>
                            <TableCell>{box.capacity || "Ilimitado"}</TableCell>
                            <TableCell>
                              <Badge variant={box.status === "available" ? "default" : "secondary"}>
                                {box.status === "available" ? "Disponible" : "No disponible"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenBoxFormModal(box)}
                                >
                                  <EditIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteBoxFromEvent(box.id!)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay boxes definidos. Crea uno nuevo para comenzar.
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="promoters">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Promotores Asignados</h3>
                    <div className="flex gap-2">
                      <Select
                        value={selectedPromoterForAssignment}
                        onValueChange={setSelectedPromoterForAssignment}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Seleccionar promotor" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePromotersForAssignment.map((promoter) => (
                            <SelectItem key={promoter.id} value={promoter.id}>
                              {promoter.promoterName} - {promoter.promoterEmail}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={handleAssignPromoterToEvent}
                        disabled={!selectedPromoterForAssignment}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" /> Asignar
                      </Button>
                    </div>
                  </div>
                  
                  {editingEvent.assignedPromoters && editingEvent.assignedPromoters.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Reglas de Comisión</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editingEvent.assignedPromoters.map((ap) => (
                          <TableRow key={ap.promoterProfileId}>
                            <TableCell className="font-medium">{ap.promoterName}</TableCell>
                            <TableCell>{ap.promoterEmail || "Sin email"}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {ap.commissionRules && ap.commissionRules.length > 0 ? (
                                  ap.commissionRules.map((rule) => (
                                    <div key={rule.id} className="flex items-center justify-between">
                                      <span>
                                        {rule.appliesTo === "event_general"
                                          ? "General del Evento"
                                          : rule.appliesToId
                                          ? `ID: ${rule.appliesToId.substring(0, 5)}...`
                                          : "Elemento específico"}
                                        :{" "}
                                        {rule.commissionType === "fixed"
                                          ? `S/ ${(rule.commissionValue || 0).toFixed(2)}`
                                          : `${rule.commissionValue || 0}%`}
                                        {rule.description ? ` (${rule.description})` : ""}
                                      </span>
                                      <div>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5"
                                          onClick={() => handleOpenCommissionRuleForm(ap, rule)}
                                          disabled={isSubmitting}
                                        >
                                          <EditIcon className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="text-destructive hover:text-destructive h-5 w-5"
                                          onClick={() => handleDeleteCommissionRule(ap.promoterProfileId, rule.id!)}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground">Sin reglas de comisión</span>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => handleOpenCommissionRuleForm(ap)}
                                >
                                  <PlusCircle className="mr-2 h-4 w-4" /> Nueva Regla
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleRemovePromoterFromEvent(ap.promoterProfileId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay promotores asignados. Asigna uno nuevo para comenzar.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            
            <UIDialogFooterAliased className="pt-6">
              <Button variant="outline" onClick={() => setActiveModal('closed')}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveManagedEventAndClose}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isDuplicatingEvent ? "Duplicar Evento" : "Guardar Cambios"}
              </Button>
            </UIDialogFooterAliased>
          </DialogContent>
        </Dialog>
      )}
      
      {activeModal === 'ticketForm' && editingEvent && (
        <Dialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) setModalContext(null);
            setActiveModal('manageEvent');
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{modalContext?.ticket ? "Editar Entrada" : "Añadir Nueva Entrada"}</DialogTitle>
              <UIDialogDescription>Para el evento: {editingEvent?.name}</UIDialogDescription>
            </DialogHeader>
            <TicketTypeForm
              ticketType={modalContext?.ticket || undefined}
              onSubmit={handleCreateOrEditTicketTypeForEvent}
              onCancel={() => {
                setModalContext(null);
                setActiveModal('manageEvent');
              }}
              isSubmitting={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      )}
      
      {activeModal === 'boxForm' && editingEvent && (
        <Dialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) setModalContext(null);
            setActiveModal('manageEvent');
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{modalContext?.box ? "Editar Box" : "Añadir Nuevo Box"}</DialogTitle>
              <UIDialogDescription>Para el evento: {editingEvent?.name}</UIDialogDescription>
            </DialogHeader>
            <EventBoxForm
              box={modalContext?.box || undefined}
              onSubmit={handleCreateOrEditBoxForEvent}
              onCancel={() => {
                setModalContext(null);
                setActiveModal('manageEvent');
              }}
              isSubmitting={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      )}
      
      {activeModal === 'batchBoxes' && editingEvent && (
        <Dialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) setModalContext(null);
            setActiveModal('manageEvent');
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Lote de Boxes</DialogTitle>
              <UIDialogDescription>
                Crea múltiples boxes con un formato común para el evento: {editingEvent?.name}
              </UIDialogDescription>
            </DialogHeader>
            <CreateBatchBoxesDialog
              onSubmit={handleCreateBatchBoxes}
              onCancel={() => {
                setModalContext(null);
                setActiveModal('manageEvent');
              }}
              isSubmitting={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      )}
      
      {activeModal === 'commissionRule' && currentPromoterAssignmentForRules && (
        <Dialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setModalContext(null);
              setCurrentPromoterAssignmentForRules(null);
            }
            setActiveModal('manageEvent');
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {modalContext?.rule ? "Editar Regla de Comisión" : "Nueva Regla de Comisión"}
              </DialogTitle>
              <UIDialogDescription>
                Para el promotor: {currentPromoterAssignmentForRules?.promoterName}
              </UIDialogDescription>
            </DialogHeader>
            <FormProvider {...commissionRuleForm}>
              <form 
                onSubmit={commissionRuleForm.handleSubmit(handleCommissionRuleFormSubmit)} 
                className="space-y-4"
              >
                <FormField
                  control={commissionRuleForm.control}
                  name="appliesTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aplica a</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona a qué aplica" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="event_general">Evento General</SelectItem>
                          <SelectItem value="ticket_type">Tipo de Entrada</SelectItem>
                          <SelectItem value="box_type">Tipo de Box</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Define a qué elemento específico aplica esta regla de comisión
                      </FormDescription>
                      <FormMessageHook />
                    </FormItem>
                  )}
                />
                
                {(commissionRuleForm.watch("appliesTo") === "ticket_type" || 
                  commissionRuleForm.watch("appliesTo") === "box_type") && (
                  <FormField
                    control={commissionRuleForm.control}
                    name="appliesToId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {commissionRuleForm.watch("appliesTo") === "ticket_type" 
                            ? "Tipo de Entrada" 
                            : "Tipo de Box"}
                        </FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un elemento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {commissionRuleForm.watch("appliesTo") === "ticket_type" ? (
                              editingEvent?.ticketTypes?.map((ticket) => (
                                <SelectItem key={ticket.id} value={ticket.id!}>
                                  {ticket.name} (S/ {ticket.cost?.toFixed(2) || "0.00"})
                                </SelectItem>
                              ))
                            ) : (
                              editingEvent?.eventBoxes?.map((box) => (
                                <SelectItem key={box.id} value={box.id!}>
                                  {box.name} (Capacidad: {box.capacity || "Ilimitado"})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessageHook />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={commissionRuleForm.control}
                  name="commissionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Comisión</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fixed">Monto Fijo</SelectItem>
                          <SelectItem value="percentage">Porcentaje</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessageHook />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={commissionRuleForm.control}
                  name="commissionValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {commissionRuleForm.watch("commissionType") === "fixed" 
                          ? "Monto (S/)" 
                          : "Porcentaje (%)"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step={commissionRuleForm.watch("commissionType") === "fixed" ? "0.01" : "1"}
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessageHook />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={commissionRuleForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detalles adicionales sobre esta regla de comisión..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessageHook />
                    </FormItem>
                  )}
                />
                
                <UIDialogFooterAliased>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setModalContext(null);
                      setCurrentPromoterAssignmentForRules(null);
                      setActiveModal('manageEvent');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {modalContext?.rule ? "Actualizar Regla" : "Crear Regla"}
                  </Button>
                </UIDialogFooterAliased>
              </form>
            </FormProvider>
          </DialogContent>
        </Dialog>
      )}
      
      {activeModal === 'manageCodes' && modalContext?.entity && (
        <Dialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setModalContext(null);
              setActiveModal('closed');
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Códigos para: {modalContext.entity.name}</DialogTitle>
              <UIDialogDescription>Administra los códigos QR para este evento.</UIDialogDescription>
            </DialogHeader>
            <ManageCodesDialog
              entity={modalContext.entity}
              onCodesUpdated={handleCodesUpdatedFromManageDialog}
              onRequestCreateNewCodes={() => {
                if (isEntityCurrentlyActivatable(modalContext.entity)) {
                  setModalContext(null);
                  setActiveModal('createCodes');
                } else {
                  toast({
                    title: "Acción no permitida",
                    description: "Este evento no está activo o está fuera de su periodo de vigencia.",
                    variant: "destructive",
                  });
                }
              }}
            />
          </DialogContent>
        </Dialog>
      )}
      
      {activeModal === 'createCodes' && modalContext?.entity && (
        <Dialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setModalContext(null);
              setActiveModal('closed');
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Códigos para: {modalContext.entity.name}</DialogTitle>
              <UIDialogDescription>Genera nuevos códigos QR para este evento.</UIDialogDescription>
            </DialogHeader>
            <CreateCodesDialog
              entity={modalContext.entity}
              onCodesCreated={handleNewCodesCreated}
              isSubmittingMain={isSubmitting}
              currentUserProfileName={userProfile?.name || ""}
              currentUserProfileUid={userProfile?.uid || ""}
            />
          </DialogContent>
        </Dialog>
      )}
      
      {activeModal === 'stats' && selectedEventForStats && (
        <Dialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedEventForStats(null);
            setActiveModal('closed');
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Estadísticas para: {selectedEventForStats?.name}</DialogTitle>
              <UIDialogDescription>Resumen del rendimiento del evento.</UIDialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <p><strong>Códigos Creados (Total):</strong> ({selectedEventForStats.generatedCodes?.length || 0})</p>
              <p><strong>QRs Usados (Asistencia):</strong> ({selectedEventForStats.generatedCodes?.filter((c) => c.status === "redeemed").length || 0})</p>
              <p><strong>Tasa de Asistencia:</strong> {" "}
                {selectedEventForStats.generatedCodes && selectedEventForStats.generatedCodes.length > 0
                  ? `${((selectedEventForStats.generatedCodes.filter((c) => c.status === "redeemed").length / selectedEventForStats.generatedCodes.length) * 100).toFixed(1)}%`
                  : "0%"}
              </p>
              <p><strong>Aforo Máximo:</strong> {selectedEventForStats.maxAttendance || "Ilimitado"}</p>
              <p><strong>Entradas Vendidas:</strong> 
                {selectedEventForStats.ticketTypes?.reduce((sum, tt) => sum + (tt.quantity || 0), 0) || 0}
              </p>
              <p><strong>Boxes Vendidos:</strong> 
                {selectedEventForStats.eventBoxes?.length || 0}
              </p>
            </div>
            <UIDialogFooterAliased>
              <Button onClick={() => setActiveModal('closed')}>Cerrar</Button>
            </UIDialogFooterAliased>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}