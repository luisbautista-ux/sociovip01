
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as UIDialogDescription,
  DialogFooter as UIDialogFooterAliased,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlusCircle,
  Edit,
  Trash2,
  Search,
  Calendar as CalendarIconLucide,
  QrCode as QrCodeIcon,
  Copy,
  ListChecks,
  BarChart3,
  Loader2,
  AlertTriangle,
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useForm, Controller, FormProvider } from "react-hook-form";
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
  
  const [showInitialEventModal, setShowInitialEventModal] = useState(false);
  const [showManageEventModal, setShowManageEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BusinessManagedEntity | null>(null);
  const [isDuplicatingEvent, setIsDuplicatingEvent] = useState(false);

  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);

  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);

  const [showTicketFormInEventModal, setShowTicketFormInEventModal] = useState(false);
  const [editingTicketInEventModal, setEditingTicketInEventModal] = useState<TicketType | null>(null);

  const [showBoxFormInEventModal, setShowBoxFormInEventModal] = useState(false);
  const [editingBoxInEventModal, setEditingBoxInEventModal] = useState<EventBox | null>(null);
  const [showCreateBatchBoxesModal, setShowCreateBatchBoxesModal] = useState(false);

  const [availablePromotersForAssignment, setAvailablePromotersForAssignment] = useState<BusinessPromoterLink[]>([]);
  const [selectedPromoterForAssignment, setSelectedPromoterForAssignment] = useState<string>("");

  const [showCommissionRuleForm, setShowCommissionRuleForm] = useState(false);
  const [editingCommissionRule, setEditingCommissionRule] = useState<CommissionRule | null>(null);
  const [currentPromoterAssignmentForRules, setCurrentPromoterAssignmentForRules] =
    useState<EventPromoterAssignment | null>(null);

  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedEventForStats, setSelectedEventForStats] = useState<BusinessManagedEntity | null>(null);

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
     Carga de datos
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

  useEffect(() => {
    if (currentBusinessId) {
      setIsLoadingPageData(true);
      Promise.all([
        fetchBusinessEvents(currentBusinessId),
        fetchBusinessPromotersForAssignment(currentBusinessId),
      ])
        .catch((e) => console.error("Events Page: Error during Promise.all:", e))
        .finally(() => setIsLoadingPageData(false));
    } else {
      setEvents([]);
      setAvailablePromotersForAssignment([]);
      setIsLoadingPageData(false);
    }
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
      setShowManageEventModal(true);
    } else if (eventToManage) {
      setEditingEvent({
        ...eventToManage,
        startDate: anyToDate(eventToManage.startDate)!.toISOString(),
        endDate: anyToDate(eventToManage.endDate)!.toISOString(),
        maxAttendance: calculateMaxAttendance(eventToManage.ticketTypes),
      });
      setShowManageEventModal(true);
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
      setShowInitialEventModal(true);
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
        setShowInitialEventModal(false);
        initialEventForm.reset();
        setEditingEvent(finalNewEvent);
        setShowManageEventModal(true);
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
        setShowManageEventModal(false);
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

      setShowManageEventModal(false);
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
    setSelectedEntityForCreatingCodes(event);
    setShowCreateCodesModal(true);
  };

  const openViewCodesDialog = (event: BusinessManagedEntity) => {
    setSelectedEntityForViewingCodes(event);
    setShowManageCodesModal(true);
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
      if (selectedEntityForViewingCodes && selectedEntityForViewingCodes.id === entityId) {
        setSelectedEntityForViewingCodes((prev) =>
          prev ? { ...prev, generatedCodes: updatedCodes } : null
        );
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
      if (selectedEntityForViewingCodes && selectedEntityForViewingCodes.id === entityId) {
        setSelectedEntityForViewingCodes((prev) =>
          prev ? { ...prev, generatedCodes: updatedCodesForFirestore } : null
        );
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
     Switch: activar/inactivar
  ======================== */
  const handleToggleEventStatus = useCallback(async (event: BusinessManagedEntity) => {
    if (isSubmitting || !event?.id) return;
    
    const newStatus = !event.isActive;
    setIsSubmitting(true);

    // Optimistic UI update
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, isActive: newStatus } : e));
  
    try {
      await updateDoc(doc(db, "businessEntities", event.id), { isActive: newStatus });
      toast({
        title: "Estado Actualizado",
        description: `El estado del evento "${event.name}" ha sido cambiado a ${newStatus ? "Activo" : "Inactivo"}.`,
      });
    } catch (error: any) {
      // Revert optimistic UI update on error
      setEvents(prev => prev.map(e => e.id === event.id ? { ...e, isActive: event.isActive } : e));
      toast({
        title: "Error al Actualizar",
        description: `No se pudo cambiar el estado. ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, toast]);
  
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
    setEditingTicketInEventModal(ticket);
    setShowTicketFormInEventModal(true);
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

    if (editingTicketInEventModal && editingTicketInEventModal.id) {
      updatedTickets = currentTickets.map((tt) =>
        tt.id === editingTicketInEventModal.id
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

    setShowTicketFormInEventModal(false);
    setEditingTicketInEventModal(null);
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
    setEditingBoxInEventModal(box);
    setShowBoxFormInEventModal(true);
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

    if (editingBoxInEventModal && editingBoxInEventModal.id) {
      updatedBoxes = currentBoxes.map((b) =>
        b.id === editingBoxInEventModal.id
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

    setShowBoxFormInEventModal(false);
    setEditingBoxInEventModal(null);
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
    setShowCreateBatchBoxesModal(false);
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
      promoterLinkData.platformUserUid || promoterLinkData.promoterDni || promoterLinkData.id;

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
    setEditingCommissionRule(rule || null);
    commissionRuleForm.reset({
      appliesTo: rule?.appliesTo || "event_general",
      appliesToId: rule?.appliesToId || undefined,
      appliesToName: rule?.appliesToName || "",
      commissionType: rule?.commissionType || "fixed",
      commissionValue: rule?.commissionValue || 0,
      description: rule?.description || "",
    });
    setShowCommissionRuleForm(true);
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
          ruleAppliesToName = ticket?.name || `Entrada ID: ${sanitizedRuleData.appliesToId.substring(0, 6)}`;
        } else if (sanitizedRuleData.appliesTo === "box_type" && sanitizedRuleData.appliesToId) {
          const box = editingEvent.eventBoxes?.find((b) => b.id === sanitizedRuleData.appliesToId);
          ruleAppliesToName = box?.name || `Box ID: ${sanitizedRuleData.appliesToId.substring(0, 6)}`;
        }

        const newRuleBase: Omit<CommissionRule, "id"> = {
          appliesTo: sanitizedRuleData.appliesTo,
          appliesToId: sanitizedRuleData.appliesTo === "event_general" ? undefined : sanitizedRuleData.appliesToId,
          appliesToName: ruleAppliesToName,
          commissionType: sanitizedRuleData.commissionType,
          commissionValue: sanitizedRuleData.commissionValue || 0,
          description: sanitizedRuleData.description || "",
        };

        if (editingCommissionRule && editingCommissionRule.id) {
          updatedRules = updatedRules.map((rule) =>
            rule.id === editingCommissionRule.id ? { ...newRuleBase, id: rule.id } : rule
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
    setShowCommissionRuleForm(false);
    setEditingCommissionRule(null);
    setCurrentPromoterAssignmentForRules(null);
    toast({ title: editingCommissionRule ? "Regla de Comisión Actualizada" : "Regla de Comisión Añadida" });
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
    setShowStatsModal(true);
  };

  /* ========================
     Render
  ======================== */
  if (isLoadingPageData) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando información...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <CalendarIconLucide className="h-8 w-8 mr-2" /> Gestión de Eventos
        </h1>
        <Button
          onClick={() => handleOpenManageEventModal(null, false)}
          className="bg-primary hover:bg-primary/90"
          disabled={!currentBusinessId || isSubmitting || isLoadingPageData}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Evento
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Mis Eventos</CardTitle>
          <ShadcnCardDescription>Crea y administra los eventos de tu negocio.</ShadcnCardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre o descripción..."
              className="pl-8 w-full sm:w-[300px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoadingPageData || !currentBusinessId}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!currentBusinessId && !isLoadingPageData ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed rounded-md p-4 text-center">
              <AlertTriangle className="h-10 w-10 mb-2 text-yellow-500" />
              <p className="font-semibold">No se pudo cargar la información del negocio.</p>
              <p className="text-sm">Asegúrate de que tu perfil de usuario esté correctamente asociado a un negocio.</p>
            </div>
          ) : events.length === 0 && !searchTerm ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed rounded-md p-4 text-center">
              <AlertTriangle className="h-10 w-10 mb-2 text-yellow-500" />
              <p className="font-semibold">No hay eventos registrados.</p>
              <p className="text-sm">Haz clic en "Crear Evento" para empezar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Evento y Gestión</TableHead>
                    <TableHead className="min-w-[150px]">QRs Entrada</TableHead>
                    <TableHead className="min-w-[180px]">Vigencia</TableHead>
                    <TableHead className="min-w-[150px] text-left">Acciones Adicionales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.length > 0 ? (
                    filteredEvents.map((event) => {
                      const codesRedeemedCount =
                        event.generatedCodes?.filter((c) => c.status === "redeemed").length || 0;
                      const codesCreatedCount = event.generatedCodes?.length || 0;
                      const isActivatable = isEntityCurrentlyActivatable(event);
                    
                      return (
                        <TableRow key={event.id || `event-fallback-${Math.random()}`}>
                          <TableCell className="font-medium align-top py-3">
                            <div className="font-semibold text-base">{event.name}</div>
                            <div className="flex items-center space-x-2 mt-1.5 mb-2">
                              <Switch
                                id={`status-switch-event-${event.id}`}
                                checked={event.isActive} 
                                onCheckedChange={() => handleToggleEventStatus(event)}
                                aria-label={`Estado del evento ${event.name}`}
                                disabled={isSubmitting}
                              />
                              <Label htmlFor={`status-switch-event-${event.id}`} className="sr-only">
                                {event.isActive ? "Activo" : "Inactivo"}
                              </Label>

                              <Badge
                                variant={event.isActive ? "default" : "outline"}
                                className={cn(
                                  event.isActive && isActivatable
                                    ? "bg-green-500 hover:bg-green-600"
                                    : event.isActive
                                    ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                                    : "bg-red-500 hover:bg-red-600 text-white",
                                  "text-xs"
                                )}
                              >
                                {event.isActive
                                  ? isActivatable
                                    ? "Vigente"
                                    : "Activo (Fuera de Fecha)"
                                  : "Inactivo"}
                              </Badge>
                            </div>

                            <div className="flex flex-col items-start gap-1">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleOpenManageEventModal(event, false)}
                                disabled={isSubmitting}
                                className="px-2 py-1 h-auto text-xs"
                              >
                                <Edit className="h-3 w-3 mr-1" /> Gestionar
                              </Button>
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

                          <TableCell className="align-top py-3 text-xs">
                            <div className="flex flex-col">
                              <span>Códigos Creados ({codesCreatedCount})</span>
                              <span>QRs Generados (0)</span>
                              <span>QRs Usados ({codesRedeemedCount})</span>
                              <span>
                                Aforo Máximo (
                                {event.maxAttendance === 0 || !event.maxAttendance
                                  ? "Ilimitado"
                                  : event.maxAttendance}
                                )
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="align-top py-3 text-xs">
                            {event.startDate ? format(parseISO(event.startDate), "P p", { locale: es }) : "N/A"}
                            <br />
                            {event.endDate ? format(parseISO(event.endDate), "P p", { locale: es }) : "N/A"}
                          </TableCell>

                          <TableCell className="align-top py-3">
                            <div className="flex flex-col items-start gap-1">
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
                                    variant="destructive"
                                    size="xs"
                                    disabled={isSubmitting}
                                    className="px-2 py-1 h-auto text-xs"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Esto eliminará permanentemente el evento:
                                      <span className="font-semibold"> {event.name}</span> y todos sus datos asociados.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteEvent(event.id!, event.name)}
                                      className="bg-destructive hover:bg-destructive/90"
                                      disabled={isSubmitting}
                                    >
                                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    !isLoadingPageData && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">
                          No se encontraron eventos con los filtros aplicados.
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ======= Modal: Crear evento básico ======= */}
      <Dialog
        open={showInitialEventModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) initialEventForm.reset();
          setShowInitialEventModal(isOpen);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paso 1: Crear Evento Básico</DialogTitle>
            <UIDialogDescription>
              Ingresa los detalles iniciales de tu evento. Podrás configurar entradas, boxes y más opciones después.
            </UIDialogDescription>
          </DialogHeader>
          <Form {...initialEventForm}>
            <form onSubmit={initialEventForm.handleSubmit(handleInitialEventSubmit)} className="space-y-4 py-2">
              <FormField
                control={initialEventForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <Label>
                      Nombre del Evento <span className="text-destructive">*</span>
                    </Label>
                    <FormControl>
                      <Input placeholder="Ej: Concierto de Verano" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessageHook />
                  </FormItem>
                )}
              />
              <FormField
                control={initialEventForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <Label>
                      Descripción <span className="text-destructive">*</span>
                    </Label>
                    <FormControl>
                      <Textarea
                        placeholder="Una breve descripción del evento..."
                        {...field}
                        rows={3}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessageHook />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={initialEventForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <Label>
                        Fecha de Inicio <span className="text-destructive">*</span>
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              disabled={isSubmitting}
                            >
                              {field.value ? format(field.value, "PPP HH:mm", { locale: es }) : (
                                <span>Selecciona fecha y hora</span>
                              )}
                              <CalendarIconLucide className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <ShadcnCalendar mode="single" selected={field.value} onSelect={field.onChange} locale={es} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessageHook />
                    </FormItem>
                  )}
                />
                <FormField
                  control={initialEventForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <Label>
                        Fecha de Fin <span className="text-destructive">*</span>
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              disabled={isSubmitting}
                            >
                              {field.value ? format(field.value, "PPP HH:mm", { locale: es }) : (
                                <span>Selecciona fecha y hora</span>
                              )}
                              <CalendarIconLucide className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <ShadcnCalendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              initialEventForm.getValues("startDate")
                                ? isBefore(date, initialEventForm.getValues("startDate")!)
                                : false
                            }
                            locale={es}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessageHook />
                    </FormItem>
                  )}
                />
              </div>
              <UIDialogFooterAliased className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowInitialEventModal(false);
                    initialEventForm.reset();
                  }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Continuar y Configurar"}
                </Button>
              </UIDialogFooterAliased>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ======= Modal: Gestionar evento (tabs) ======= */}
      <Dialog
        open={showManageEventModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditingEvent(null);
            setIsDuplicatingEvent(false);
            setShowTicketFormInEventModal(false);
            setEditingTicketInEventModal(null);
            setShowBoxFormInEventModal(false);
            setEditingBoxInEventModal(null);
            setShowCommissionRuleForm(false);
            setEditingCommissionRule(null);
            setCurrentPromoterAssignmentForRules(null);
            setSelectedPromoterForAssignment("");
          }
          setShowManageEventModal(isOpen);
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {isDuplicatingEvent
                ? `Duplicar Evento: ${(editingEvent?.name || "Evento").replace(" (Copia)", "")} (Copia)`
                : editingEvent?.id
                ? `Gestionar Evento: ${editingEvent.name}`
                : "Gestionar Nuevo Evento"}
            </DialogTitle>
            <UIDialogDescription>
              {isDuplicatingEvent
                ? "Creando una copia. Ajusta los detalles."
                : editingEvent?.id
                ? "Modifica los detalles, entradas, boxes y promotores de tu evento."
                : "Completa los detalles principales de tu nuevo evento."}
            </UIDialogDescription>
          </DialogHeader>

          {editingEvent && (
            <ScrollArea className="max-h-[calc(90vh-220px)] pr-5">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="details">Detalles</TabsTrigger>
                  <TabsTrigger value="tickets">Entradas ({editingEvent.ticketTypes?.length || 0})</TabsTrigger>
                  <TabsTrigger value="boxes">Boxes ({editingEvent.eventBoxes?.length || 0})</TabsTrigger>
                  <TabsTrigger value="promoters">Promotores ({editingEvent.assignedPromoters?.length || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                  <BusinessEventForm
                    event={editingEvent}
                    isSubmitting={isSubmitting}
                    onFormChange={(updatedDetails: Partial<EventDetailsFormValues>) => {
                      setEditingEvent((prev) => (prev ? { ...prev, ...updatedDetails } : null));
                    }}
                  />
                </TabsContent>

                <TabsContent value="tickets">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Entradas para "{editingEvent.name}"</CardTitle>
                        <Button onClick={() => handleOpenTicketFormModal(null)} size="sm" disabled={isSubmitting}>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Añadir Entrada
                        </Button>
                      </div>
                      <ShadcnCardDescription>
                        Define los diferentes tipos de entrada. El aforo total se calcula a partir de estas.
                      </ShadcnCardDescription>
                    </CardHeader>
                    <CardContent>
                      {(editingEvent.ticketTypes || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No hay tipos de entrada definidos para este evento.
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Costo (S/)</TableHead>
                              <TableHead>Descripción</TableHead>
                              <TableHead>Cantidad</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {editingEvent.ticketTypes?.map((tt) => (
                              <TableRow key={tt.id || `tt-fallback-${Math.random()}`}>
                                <TableCell>{tt.name}</TableCell>
                                <TableCell>{tt.cost.toFixed(2)}</TableCell>
                                <TableCell className="max-w-xs truncate" title={tt.description || undefined}>
                                  {tt.description || "N/A"}
                                </TableCell>
                                <TableCell>
                                  {tt.quantity === undefined || tt.quantity === null || tt.quantity <= 0
                                    ? "Ilimitada"
                                    : tt.quantity}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenTicketFormModal(tt)}
                                    disabled={isSubmitting}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive"
                                        disabled={isSubmitting}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <UIAlertDialogTitle>¿Eliminar Entrada?</UIAlertDialogTitle>
                                        <AlertDialogDescription>
                                          Se eliminará la entrada "{tt.name}".
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteTicketTypeFromEvent(tt.id!)}
                                          className="bg-destructive hover:bg-destructive/90"
                                          disabled={isSubmitting}
                                        >
                                          Eliminar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="boxes">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Boxes para "{editingEvent.name}"</CardTitle>
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => setShowCreateBatchBoxesModal(true)}
                            size="sm"
                            variant="outline"
                            disabled={isSubmitting}
                          >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Crear Lote
                          </Button>
                          <Button onClick={() => handleOpenBoxFormModal(null)} size="sm" disabled={isSubmitting}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir Box
                          </Button>
                        </div>
                      </div>
                      <ShadcnCardDescription>Define los boxes disponibles para este evento.</ShadcnCardDescription>
                    </CardHeader>
                    <CardContent>
                      {(editingEvent.eventBoxes || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No hay boxes definidos para este evento.
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Costo (S/)</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Capacidad</TableHead>
                              <TableHead>Vendedor</TableHead>
                              <TableHead>Dueño (Cliente)</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {editingEvent.eventBoxes?.map((box) => (
                              <TableRow key={box.id || `box-fallback-${Math.random()}`}>
                                <TableCell>{box.name}</TableCell>
                                <TableCell>{box.cost.toFixed(2)}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={box.status === "available" ? "default" : "secondary"}
                                    className={
                                      box.status === "available"
                                        ? "bg-green-500 hover:bg-green-600"
                                        : "bg-orange-500 hover:bg-orange-600"
                                    }
                                  >
                                    {box.status === "available" ? "Disponible" : "No Disponible"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{box.capacity || "N/A"}</TableCell>
                                <TableCell>{box.sellerName || "N/A"}</TableCell>
                                <TableCell>
                                  {box.ownerName ? `${box.ownerName} (${box.ownerDni || "N/A"})` : "N/A"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenBoxFormModal(box)}
                                    disabled={isSubmitting}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive"
                                        disabled={isSubmitting}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <UIAlertDialogTitle>¿Eliminar Box?</UIAlertDialogTitle>
                                        <AlertDialogDescription>Se eliminará el box "{box.name}".</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteBoxFromEvent(box.id!)}
                                          className="bg-destructive hover:bg-destructive/90"
                                          disabled={isSubmitting}
                                        >
                                          Eliminar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="promoters">
                  <Card>
                    <CardHeader>
                      <CardTitle>Asignar Promotores a "{editingEvent.name}"</CardTitle>
                      <ShadcnCardDescription>
                        Vincula promotores a este evento y define sus reglas de comisión específicas.
                      </ShadcnCardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-end gap-2">
                        <div className="flex-grow">
                          <Label htmlFor="select-promoter-event">
                            Seleccionar Promotor <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={selectedPromoterForAssignment}
                            onValueChange={setSelectedPromoterForAssignment}
                            disabled={isSubmitting || availablePromotersForAssignment.length === 0}
                          >
                            <SelectTrigger id="select-promoter-event">
                              <SelectValue
                                placeholder={
                                  availablePromotersForAssignment.length === 0
                                    ? "No hay promotores vinculados activos"
                                    : "Elige un promotor"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePromotersForAssignment.length === 0 && (
                                <SelectItem
                                  key="no-promoters-item-events-tab-unique-key-selectcontent"
                                  value="no-promoters-placeholder"
                                  disabled
                                >
                                  No hay promotores activos vinculados
                                </SelectItem>
                              )}
                              {availablePromotersForAssignment.map((pLink, index) => {
                                const key = pLink?.id || `promoter-select-item-${index}-${Math.random().toString(36).slice(2)}A`;
                                const value = pLink?.id || `promoter-value-fallback-${index}-${Math.random().toString(36).slice(2)}B`;
                                return (
                                  <SelectItem key={key} value={value}>
                                    {pLink.promoterName || "Nombre Desconocido"} ({pLink.promoterEmail || "Email Desconocido"})
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleAssignPromoterToEvent} disabled={isSubmitting || !selectedPromoterForAssignment}>
                          Asignar a Evento
                        </Button>
                      </div>

                      <h4 className="text-md font-semibold pt-2">Promotores Asignados a este Evento:</h4>
                      {(editingEvent.assignedPromoters || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aún no hay promotores asignados a este evento.</p>
                      ) : (
                        <div className="space-y-3">
                          {(editingEvent.assignedPromoters || []).map((ap) => (
                            <Card key={ap.promoterProfileId || `ap-fallback-${Math.random()}`} className="p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold">
                                    {ap.promoterName}{" "}
                                    <span className="text-xs text-muted-foreground">
                                      ({ap.promoterEmail || "N/A"})
                                    </span>
                                  </p>
                                  {ap.notes && (
                                    <p className="text-xs text-muted-foreground italic mt-0.5">Notas: {ap.notes}</p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleRemovePromoterFromEvent(ap.promoterProfileId)}
                                  disabled={isSubmitting}
                                >
                                  Desvincular
                                </Button>
                              </div>

                              <div className="mt-2">
                                <div className="flex justify-between items-center mb-1">
                                  <h5 className="text-xs font-medium text-muted-foreground">
                                    Reglas de Comisión Específicas del Evento:
                                  </h5>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => handleOpenCommissionRuleForm(ap)}
                                    disabled={isSubmitting}
                                  >
                                    <PlusCircle className="mr-1 h-3 w-3" />
                                    Añadir Regla
                                  </Button>
                                </div>

                                {(ap.commissionRules || []).length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">Sin reglas específicas.</p>
                                ) : (
                                  <ul className="list-disc list-inside pl-2 space-y-0.5 text-xs">
                                    {(ap.commissionRules || []).map((rule) => (
                                      <li key={rule.id || `cr-fallback-${Math.random()}`} className="flex justify-between items-center">
                                        <span>
                                          {rule.appliesTo === "event_general"
                                            ? "General del Evento"
                                            : rule.appliesToName
                                            ? `${rule.appliesToName}`
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
                                            <Edit className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive h-5 w-5"
                                            onClick={() => handleDeleteCommissionRule(ap.promoterProfileId, rule.id!)}
                                            disabled={isSubmitting}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}

          <UIDialogFooterAliased className="pt-6 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowManageEventModal(false);
                setEditingEvent(null);
                setIsDuplicatingEvent(false);
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveManagedEventAndClose}
              className="bg-primary hover:bg-primary/90"
              disabled={isSubmitting || !editingEvent}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : !editingEvent || !editingEvent.id || isDuplicatingEvent ? (
                "Crear Evento y Cerrar"
              ) : (
                "Guardar Cambios y Cerrar"
              )}
            </Button>
          </UIDialogFooterAliased>
        </DialogContent>
      </Dialog>

      {/* ======= Modal: Entrada ======= */}
      <Dialog
        open={showTicketFormInEventModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingTicketInEventModal(null);
          setShowTicketFormInEventModal(isOpen);
        }}
      >
        {showTicketFormInEventModal && editingEvent && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTicketInEventModal ? "Editar Entrada" : "Añadir Nueva Entrada"}</DialogTitle>
              <UIDialogDescription>Para el evento: {editingEvent?.name}</UIDialogDescription>
            </DialogHeader>
            <TicketTypeForm
              ticketType={editingTicketInEventModal || undefined}
              onSubmit={handleCreateOrEditTicketTypeForEvent}
              onCancel={() => {
                setShowTicketFormInEventModal(false);
                setEditingTicketInEventModal(null);
              }}
              isSubmitting={isSubmitting}
            />
          </DialogContent>
        )}
      </Dialog>

      {/* ======= Modal: Box ======= */}
      <Dialog
        open={showBoxFormInEventModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingBoxInEventModal(null);
          setShowBoxFormInEventModal(isOpen);
        }}
      >
        {showBoxFormInEventModal && editingEvent && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingBoxInEventModal ? "Editar Box" : "Añadir Nuevo Box"}</DialogTitle>
              <UIDialogDescription>Para el evento: {editingEvent?.name}</UIDialogDescription>
            </DialogHeader>
            <EventBoxForm
              eventBox={editingBoxInEventModal || undefined}
              onSubmit={handleCreateOrEditBoxForEvent}
              onCancel={() => {
                setShowBoxFormInEventModal(false);
                setEditingBoxInEventModal(null);
              }}
              isSubmitting={isSubmitting}
            />
          </DialogContent>
        )}
      </Dialog>

      {/* ======= Crear lote de boxes ======= */}
      {editingEvent && (
        <CreateBatchBoxesDialog
          open={showCreateBatchBoxesModal}
          onOpenChange={setShowCreateBatchBoxesModal}
          onSubmit={handleCreateBatchBoxes}
          isSubmitting={isSubmitting}
        />
      )}

      {/* ======= Modal: Reglas de comisión ======= */}
      <Dialog
        open={showCommissionRuleForm}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditingCommissionRule(null);
            setCurrentPromoterAssignmentForRules(null);
            commissionRuleForm.reset();
          }
          setShowCommissionRuleForm(isOpen);
        }}
      >
        {showCommissionRuleForm && editingEvent && currentPromoterAssignmentForRules && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCommissionRule ? "Editar Regla de Comisión" : "Añadir Nueva Regla de Comisión"}</DialogTitle>
              <UIDialogDescription>
                Para: {currentPromoterAssignmentForRules?.promoterName} en el evento "{editingEvent?.name}"
              </UIDialogDescription>
            </DialogHeader>
            <Form {...commissionRuleForm}>
              <form onSubmit={commissionRuleForm.handleSubmit(handleCommissionRuleFormSubmit)} className="space-y-4 py-2">
                <FormField
                  control={commissionRuleForm.control}
                  name="appliesTo"
                  render={({ field }) => (
                    <FormItem>
                      <Label>
                        Aplica A <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          commissionRuleForm.setValue("appliesToId", undefined);
                          commissionRuleForm.setValue("appliesToName", "");
                        }}
                        value={field.value}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="event_general">General del Evento</SelectItem>
                          <SelectItem value="ticket_type">Tipo de Entrada Específico</SelectItem>
                          <SelectItem value="box_type">Tipo de Box Específico</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessageHook />
                    </FormItem>
                  )}
                />

                {commissionRuleForm.watch("appliesTo") === "ticket_type" &&
                  editingEvent?.ticketTypes &&
                  editingEvent.ticketTypes.length > 0 && (
                    <FormField
                      control={commissionRuleForm.control}
                      name="appliesToId"
                      render={({ field }) => (
                        <FormItem>
                          <Label>
                            Seleccionar Tipo de Entrada <span className="text-destructive">*</span>
                          </Label>
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Elige una entrada" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(editingEvent.ticketTypes || []).map((tt) => (
                                <SelectItem key={tt.id || `tt-select-${Math.random()}`} value={tt.id!}>
                                  {tt.name} (S/ {tt.cost.toFixed(2)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessageHook />
                        </FormItem>
                      )}
                    />
                  )}

                {commissionRuleForm.watch("appliesTo") === "box_type" &&
                  editingEvent?.eventBoxes &&
                  editingEvent.eventBoxes.length > 0 && (
                    <FormField
                      control={commissionRuleForm.control}
                      name="appliesToId"
                      render={({ field }) => (
                        <FormItem>
                          <Label>
                            Seleccionar Tipo de Box <span className="text-destructive">*</span>
                          </Label>
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Elige un box" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(editingEvent.eventBoxes || []).map((b) => (
                                <SelectItem key={b.id || `box-select-${Math.random()}`} value={b.id!}>
                                  {b.name} (S/ {b.cost.toFixed(2)})
                                </SelectItem>
                              ))}
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
                      <Label>
                        Tipo de Comisión <span className="text-destructive">*</span>
                      </Label>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fixed">Monto Fijo (S/)</SelectItem>
                          <SelectItem value="percentage">Porcentaje (%)</SelectItem>
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
                      <Label>
                        Valor de Comisión <span className="text-destructive">*</span>
                      </Label>
                      <FormControl>
                        <Input type="number" placeholder="Ej: 5 o 10" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Si es porcentaje, ingresa solo el número (ej: 10 para 10%).
                      </FormDescription>
                      <FormMessageHook />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Descripción de la Regla (Opcional)</Label>
                      <FormControl>
                        <Textarea
                          placeholder="Ej: Por cada entrada VIP vendida"
                          {...field}
                          value={field.value || ""}
                          rows={2}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessageHook />
                    </FormItem>
                  )}
                />

                <UIDialogFooterAliased className="pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCommissionRuleForm(false);
                      commissionRuleForm.reset();
                    }}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : editingCommissionRule ? (
                      "Guardar Regla"
                    ) : (
                      "Añadir Regla"
                    )}
                  </Button>
                </UIDialogFooterAliased>
              </form>
            </Form>
          </DialogContent>
        )}
      </Dialog>

      {/* ======= Modal: Estadísticas ======= */}
      <Dialog
        open={showStatsModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedEventForStats(null);
          setShowStatsModal(isOpen);
        }}
      >
        {showStatsModal && selectedEventForStats && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Estadísticas para: {selectedEventForStats?.name}</DialogTitle>
              <UIDialogDescription>Resumen del rendimiento del evento.</UIDialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <p>
                <strong>Códigos Creados (Total):</strong> ({selectedEventForStats.generatedCodes?.length || 0})
              </p>
              <p>
                <strong>QRs Usados (Asistencia):</strong> (
                {selectedEventForStats.generatedCodes?.filter((c) => c.status === "redeemed").length || 0})
              </p>
              <p>
                <strong>Tasa de Asistencia:</strong>{" "}
                {selectedEventForStats.generatedCodes && selectedEventForStats.generatedCodes.length > 0
                  ? `${
                      (
                        ((selectedEventForStats.generatedCodes.filter((c) => c.status === "redeemed").length || 0) /
                          selectedEventForStats.generatedCodes.length) *
                        100
                      ).toFixed(1)
                    }%`
                  : "0%"}
              </p>
              <p>
                <strong>Aforo Máximo Configurado:</strong> (
                {selectedEventForStats.maxAttendance === 0 || !selectedEventForStats.maxAttendance
                  ? "Ilimitado"
                  : selectedEventForStats.maxAttendance}
                )
              </p>
              <div className="border-top pt-3 mt-3">
                <h4 className="font-semibold text-muted-foreground">Más Detalles (Ejemplos):</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  <li>Top Promotor (Ventas): [Nombre Promotor Ejemplo]</li>
                  <li>Entrada Más Popular: [Nombre Entrada Ejemplo]</li>
                  <li>Ingresos Estimados por Entradas: S/ [Monto Ejemplo]</li>
                </ul>
              </div>
            </div>
            <UIDialogFooterAliased>
              <Button
                variant="outline"
                onClick={() => {
                  setShowStatsModal(false);
                  setSelectedEventForStats(null);
                }}
              >
                Cerrar
              </Button>
            </UIDialogFooterAliased>
          </DialogContent>
        )}
      </Dialog>

      {/* ======= Dialogs de Códigos ======= */}
      {selectedEntityForCreatingCodes && userProfile && (
        <CreateCodesDialog
          open={showCreateCodesModal}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedEntityForCreatingCodes(null);
            setShowCreateCodesModal(isOpen);
          }}
          entityName={selectedEntityForCreatingCodes.name}
          entityId={selectedEntityForCreatingCodes.id!}
          existingCodesValues={(selectedEntityForCreatingCodes.generatedCodes || []).map((c) => c.value)}
          onCodesCreated={handleNewCodesCreated}
          isSubmittingMain={isSubmitting}
          currentUserProfileName={userProfile.name}
          currentUserProfileUid={userProfile.uid}
        />
      )}

      {selectedEntityForViewingCodes && userProfile && (
        <ManageCodesDialog
          open={showManageCodesModal}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedEntityForViewingCodes(null);
            setShowManageCodesModal(isOpen);
          }}
          entity={selectedEntityForViewingCodes}
          onCodesUpdated={handleCodesUpdatedFromManageDialog}
          onRequestCreateNewCodes={() => {
            const currentEntity = events.find((e) => e.id === selectedEntityForViewingCodes?.id);
            if (currentEntity) {
              if (isEntityCurrentlyActivatable(currentEntity)) {
                setShowManageCodesModal(false);
                setSelectedEntityForCreatingCodes(currentEntity);
                setShowCreateCodesModal(true);
              } else {
                toast({
                  title: "Acción no permitida",
                  description: "Este evento no está activo o está fuera de su periodo de vigencia.",
                  variant: "destructive",
                });
              }
            }
          }}
          isPromoterView={false}
          currentUserProfileName={userProfile.name}
          currentUserProfileUid={userProfile.uid}
        />
      )}
    </div>
  );
}
