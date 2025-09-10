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
  BusinessEventFormData,
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

/* ========================
   Validaciones (zod)
======================== */
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
  
  // State management for dialogs
  const [showManageEventModal, setShowManageEventModal] = useState(false);
  const [showInitialEventModal, setShowInitialEventModal] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showBoxForm, setShowBoxForm] = useState(false);
  const [showCommissionRuleModal, setShowCommissionRuleModal] = useState(false);
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [modalTicketContext, setModalTicketContext] = useState<{ ticket?: TicketType } | null>(null);
  const [modalBoxContext, setModalBoxContext] = useState<{ box?: EventBox } | null>(null);

  // States for handling data in the modals
  const [editingEvent, setEditingEvent] = useState<BusinessManagedEntity | null>(null);
  const [editedEventDetails, setEditedEventDetails] = useState<any>(null); // Intermediate state for details form
  const [isDuplicatingEvent, setIsDuplicatingEvent] = useState(false);
  const [availablePromotersForAssignment, setAvailablePromotersForAssignment] = useState<BusinessPromoterLink[]>([]);
  const [selectedPromoterForAssignment, setSelectedPromoterForAssignment] = useState<string>("");
  const [currentPromoterAssignmentForRules, setCurrentPromoterAssignmentForRules] =
    useState<EventPromoterAssignment | null>(null);

  /* ========================
     Forms
  ======================== */
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
    if (!currentBusinessId) {
      setEvents([]);
      setAvailablePromotersForAssignment([]);
      setIsLoadingPageData(false);
      return;
    }
    
    setIsLoadingPageData(true);
    
    Promise.all([
      fetchBusinessEvents(currentBusinessId),
      fetchBusinessPromotersForAssignment(currentBusinessId)
    ])
    .catch(error => console.error("Error fetching initial data for events page", error))
    .finally(() => setIsLoadingPageData(false));

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
     Manejo de apertura y cierre de modales
  ======================== */

  const handleOpenManageEventModal = (event: BusinessManagedEntity | null, duplicate = false) => {
    if (isSubmitting) return;

    if (duplicate && event && currentBusinessId) {
      const { id, generatedCodes, ticketTypes = [], eventBoxes = [], assignedPromoters = [], createdAt, ...eventData } = event;
      setEditingEvent({
        ...eventData, id: '', businessId: currentBusinessId, type: 'event',
        name: `${event.name || "Evento"} (Copia)`, startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true, ticketTypes: [], eventBoxes: [], assignedPromoters: [], generatedCodes: [], maxAttendance: 0,
      });
      setIsDuplicatingEvent(true);
    } else if (event) {
      setEditingEvent({ ...event });
      setIsDuplicatingEvent(false);
    } else {
      setEditingEvent(null);
      setIsDuplicatingEvent(false);
    }
    setShowManageEventModal(true);
  };

  const handleOpenInitialEventModal = () => {
    setEditingEvent(null);
    setShowInitialEventModal(true);
  };
  
  const closeModal = () => {
    setShowManageEventModal(false);
    setShowInitialEventModal(false);
    setShowTicketForm(false);
    setShowBoxForm(false);
    setShowCommissionRuleModal(false);
    setShowManageCodesModal(false);
    setShowCreateCodesModal(false);
    setShowStatsModal(false);

    // Reset contexts
    setEditingEvent(null);
    setIsDuplicatingEvent(false);
    setModalTicketContext(null);
    setModalBoxContext(null);
    setCurrentPromoterAssignmentForRules(null);
  };
  
  /* ========================
     Guardado/Eliminación/Operaciones CRUD
  ======================== */
   const handleInitialEventCreate = async (eventDetails: BusinessEventFormData) => {
    if (!currentBusinessId) return;
    setIsSubmitting(true);
    try {
        const newEventPayload: Omit<BusinessManagedEntity, 'id' | 'createdAt' | 'businessId'> = {
            type: 'event',
            name: eventDetails.name,
            description: eventDetails.description,
            startDate: eventDetails.startDate.toISOString(),
            endDate: eventDetails.endDate.toISOString(),
            isActive: true,
            imageUrl: `https://placehold.co/600x400/9333ea/ffffff?text=${encodeURIComponent(eventDetails.name.substring(0, 10))}`,
            aiHint: eventDetails.name.split(" ").slice(0, 2).join(" "),
            ticketTypes: [], eventBoxes: [], assignedPromoters: [], generatedCodes: [],
        };
        const docRef = await addDoc(collection(db, "businessEntities"), {
            ...newEventPayload,
            businessId: currentBusinessId,
            createdAt: serverTimestamp()
        });
        const createdEvent = { ...newEventPayload, id: docRef.id, businessId: currentBusinessId, createdAt: new Date().toISOString() };
        setEditingEvent(createdEvent);
        setShowInitialEventModal(false);
        setShowManageEventModal(true);
        if (currentBusinessId) fetchBusinessEvents(currentBusinessId);
        toast({ title: "Evento Creado", description: "Ahora puedes configurar más detalles." });
    } catch (error: any) {
        toast({ title: "Error al Crear", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, eventName?: string) => {
    if (isSubmitting) return;
    if (!currentBusinessId) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "businessEntities", eventId));
      toast({ title: "Evento Eliminado", description: `El evento "${eventName || 'seleccionado'}" ha sido eliminado.`, variant: "destructive" });
      if (currentBusinessId) fetchBusinessEvents(currentBusinessId);
      closeModal();
    } catch (error: any) {
      toast({ title: "Error al Eliminar", description: `No se pudo eliminar el evento. ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSaveManagedEventAndClose = async () => {
    if (!editingEvent || !currentBusinessId) {
      toast({ title: "Error", description: "No hay evento para guardar o ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const eventToSave = { ...editingEvent, ...editedEventDetails, businessId: currentBusinessId, type: "event" };
      
      const payloadForFirestore: any = {
          ...eventToSave,
          maxAttendance: calculateMaxAttendance(eventToSave.ticketTypes),
          ticketTypes: (eventToSave.ticketTypes || []).map(tt => sanitizeObjectForFirestore({ ...tt })),
          eventBoxes: (eventToSave.eventBoxes || []).map(eb => sanitizeObjectForFirestore({ ...eb })),
          assignedPromoters: (eventToSave.assignedPromoters || []).map(ap => sanitizeObjectForFirestore({ ...ap })),
          generatedCodes: (eventToSave.generatedCodes || []).map(gc => sanitizeObjectForFirestore({ ...gc })),
          startDate: Timestamp.fromDate(anyToDate(eventToSave.startDate)!),
          endDate: Timestamp.fromDate(anyToDate(eventToSave.endDate)!),
      };
      
      delete payloadForFirestore.id;

      if (isDuplicatingEvent || !editingEvent.id) {
          payloadForFirestore.createdAt = serverTimestamp();
          await addDoc(collection(db, "businessEntities"), payloadForFirestore);
          toast({ title: isDuplicatingEvent ? "Evento Duplicado" : "Evento Creado", description: `El evento "${eventToSave.name}" ha sido guardado.` });
      } else {
          await updateDoc(doc(db, "businessEntities", editingEvent.id), payloadForFirestore);
          toast({ title: "Evento Guardado", description: `Los cambios en "${eventToSave.name}" han sido guardados.` });
      }
      
      closeModal();
      if (currentBusinessId) fetchBusinessEvents(currentBusinessId);
    } catch (error: any) {
      toast({ title: "Error al Guardar", description: `No se pudo guardar el evento. ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  /* ========================
     Códigos (QR)
  ======================== */
  const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    if (isSubmitting) return;
    if (!currentBusinessId || !userProfile?.name || !userProfile.uid) return;

    setIsSubmitting(true);
    const targetEventRef = doc(db, "businessEntities", entityId);
    try {
      const targetEventSnap = await getDoc(targetEventRef);
      if (!targetEventSnap.exists()) {
          toast({ title: "Error", description: "Evento no encontrado para añadir códigos.", variant: "destructive" }); return;
      }
      const targetEventData = targetEventSnap.data() as BusinessManagedEntity;
      const newCodesWithDetails = newCodes.map(code => sanitizeObjectForFirestore({ ...code, entityId, generatedByName: userProfile.name, generatedByUid: userProfile.uid, observation: observation || null }));
      const updatedCodes = [...(targetEventData.generatedCodes || []), ...newCodesWithDetails];
      
      await updateDoc(targetEventRef, { generatedCodes: updatedCodes });
      toast({ title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${targetEventData.name}.` });
      
      if (editingEvent?.id === entityId) setEditingEvent(prev => prev ? { ...prev, generatedCodes: updatedCodes } : null);
      if (currentBusinessId) fetchBusinessEvents(currentBusinessId);
    } catch (error: any) {
      toast({ title: "Error al Guardar Códigos", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodes: GeneratedCode[]) => {
    if (isSubmitting) return;
    if (!currentBusinessId) return;

    setIsSubmitting(true);
    const targetEventRef = doc(db, "businessEntities", entityId);
    try {
      await updateDoc(targetEventRef, { generatedCodes: updatedCodes.map(c => sanitizeObjectForFirestore(c)) });
      toast({ title: "Códigos Actualizados", description: "Los cambios se han guardado." });
      
      if (editingEvent?.id === entityId) setEditingEvent(prev => prev ? { ...prev, generatedCodes: updatedCodes } : null);
      if (currentBusinessId) fetchBusinessEvents(currentBusinessId);
    } catch (error: any) {
      toast({ title: "Error al Actualizar Códigos", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  /* ========================
     Tickets / Boxes / Promotores
  ======================== */
  const handleCreateOrEditTicketType = (data: TicketTypeFormData) => {
    if (!editingEvent || !currentBusinessId) return;
    
    const currentTickets = editingEvent.ticketTypes || [];
    const isEditingTicket = modalTicketContext?.ticket?.id;
    let updatedTickets;

    if (isEditingTicket) {
      updatedTickets = currentTickets.map(tt => tt.id === modalTicketContext.ticket.id ? { ...tt, ...data } : tt);
      toast({ title: "Entrada Actualizada", description: `La entrada "${data.name}" se actualizó en el editor.` });
    } else {
      const newTicket: TicketType = { ...data, id: `tt-temp-${Date.now()}`, eventId: editingEvent.id || '', businessId: currentBusinessId };
      updatedTickets = [...currentTickets, newTicket];
      toast({ title: "Entrada Creada", description: `La entrada "${data.name}" se añadió al editor.` });
    }
    setEditingEvent(prev => prev ? { ...prev, ticketTypes: updatedTickets, maxAttendance: calculateMaxAttendance(updatedTickets) } : null);
    setShowTicketForm(false);
  };
  
  const handleDeleteTicketType = (ticketId: string) => {
    if (!editingEvent) return;
    const ticketToDelete = editingEvent.ticketTypes?.find(tt => tt.id === ticketId);
    if (!ticketToDelete) return;
    const updatedTickets = (editingEvent.ticketTypes || []).filter(tt => tt.id !== ticketId);
    setEditingEvent(prev => prev ? { ...prev, ticketTypes: updatedTickets, maxAttendance: calculateMaxAttendance(updatedTickets) } : null);
    toast({ title: `Entrada "${ticketToDelete.name}" Eliminada`, variant: "destructive" });
  };
  
  const handleCreateOrEditBox = (data: EventBoxFormData) => {
    if (!editingEvent || !currentBusinessId) return;
    
    const currentBoxes = editingEvent.eventBoxes || [];
    const isEditingBox = modalBoxContext?.box?.id;
    let updatedBoxes;

    if (isEditingBox) {
        updatedBoxes = currentBoxes.map(b => b.id === modalBoxContext.box.id ? { ...b, ...data } : b);
        toast({ title: "Box Actualizado", description: `El box "${data.name}" se actualizó en el editor.` });
    } else {
        const newBox: EventBox = { ...data, id: `box-temp-${Date.now()}`, eventId: editingEvent.id || '', businessId: currentBusinessId };
        updatedBoxes = [...currentBoxes, newBox];
        toast({ title: "Box Creado", description: `El box "${data.name}" se añadió al editor.` });
    }
    setEditingEvent(prev => prev ? { ...prev, eventBoxes: updatedBoxes } : null);
    setShowBoxForm(false);
  };

  const handleDeleteBox = (boxId: string) => {
    if (!editingEvent) return;
    const boxToDelete = editingEvent.eventBoxes?.find(b => b.id === boxId);
    const updatedBoxes = (editingEvent.eventBoxes || []).filter(b => b.id !== boxId);
    setEditingEvent(prev => prev ? { ...prev, eventBoxes: updatedBoxes } : null);
    if (boxToDelete) toast({ title: `Box "${boxToDelete.name}" Eliminado`, variant: "destructive" });
  };
  
  const handleAssignPromoter = () => {
    if (!editingEvent || !selectedPromoterForAssignment) return;

    const promoterLink = availablePromotersForAssignment.find(p => p.id === selectedPromoterForAssignment);
    if (!promoterLink) return;

    const promoterId = promoterLink.platformUserUid || promoterLink.promoterDni;
    if (editingEvent.assignedPromoters?.some(ap => ap.promoterProfileId === promoterId)) {
        toast({ title: "Promotor ya asignado", variant: "destructive" });
        return;
    }
    
    const newAssignment: EventPromoterAssignment = { promoterProfileId: promoterId, promoterName: promoterLink.promoterName, promoterEmail: promoterLink.promoterEmail };
    const updatedAssignments = [...(editingEvent.assignedPromoters || []), newAssignment];
    setEditingEvent(prev => prev ? { ...prev, assignedPromoters: updatedAssignments } : null);
    setSelectedPromoterForAssignment("");
    toast({ title: "Promotor Asignado" });
  };
  
  const handleRemovePromoter = (promoterId: string) => {
    if (!editingEvent) return;
    const promoterToRemove = editingEvent.assignedPromoters?.find(ap => ap.promoterProfileId === promoterId);
    const updatedAssignments = (editingEvent.assignedPromoters || []).filter(ap => ap.promoterProfileId !== promoterId);
    setEditingEvent(prev => prev ? { ...prev, assignedPromoters: updatedAssignments } : null);
    if (promoterToRemove) toast({ title: `Promotor "${promoterToRemove.promoterName}" desvinculado`, variant: "destructive" });
  };
  
  const handleCommissionRuleSubmit = (data: CommissionRuleFormValues) => {
    if (!editingEvent || !currentPromoterAssignmentForRules) return;

    const updatedAssignments = (editingEvent.assignedPromoters || []).map(assignment => {
        if (assignment.promoterProfileId === currentPromoterAssignmentForRules.promoterProfileId) {
            let rules = assignment.commissionRules || [];
            // Aquí falta el ID para editar, se debe manejar esto en modalContext
            rules.push({ ...data, id: `cr-temp-${Date.now()}` });
            return { ...assignment, commissionRules: rules };
        }
        return assignment;
    });
    setEditingEvent(prev => prev ? { ...prev, assignedPromoters: updatedAssignments } : null);
    setShowCommissionRuleModal(false);
  };

  const handleDeleteCommissionRule = (promoterId: string, ruleId: string) => {
    if (!editingEvent) return;
    const updatedAssignments = (editingEvent.assignedPromoters || []).map(assignment => {
        if (assignment.promoterProfileId === promoterId) {
            return { ...assignment, commissionRules: (assignment.commissionRules || []).filter(r => r.id !== ruleId) };
        }
        return assignment;
    });
    setEditingEvent(prev => prev ? { ...prev, assignedPromoters: updatedAssignments } : null);
    toast({ title: "Regla de Comisión Eliminada", variant: "destructive" });
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
            <p className="text-lg font-semibold text-primary">Cargando eventos...</p>
          </div>
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
              <Button onClick={() => setShowInitialEventModal(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Evento
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Detalles</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => {
                const codesCreatedCount = event.generatedCodes?.length || 0;
                const codesRedeemedCount = event.generatedCodes?.filter(c => c.status === "redeemed" || c.status === "used").length || 0;
                const isActivatable = isEntityCurrentlyActivatable(event);

                return (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>
                      <div>Aforo: {calculateMaxAttendance(event.ticketTypes) || 'Ilimitado'}</div>
                      <div>QRs Generados: {codesRedeemedCount}/{codesCreatedCount}</div>
                    </TableCell>
                    <TableCell>
                      <div>Inicio: {format(parseISO(event.startDate), 'P p', { locale: es })}</div>
                      <div>Fin: {format(parseISO(event.endDate), 'P p', { locale: es })}</div>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleOpenManageEventModal(event)}>
                        <Edit className="mr-2 h-4 w-4" /> Gestionar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    No se encontraron eventos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={showManageEventModal} onOpenChange={(isOpen) => !isOpen && closeModal()}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {isDuplicatingEvent ? `Duplicar Evento: ${editingEvent?.name}` : `Editar Evento: ${editingEvent?.name}`}
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="details">Detalles</TabsTrigger>
              <TabsTrigger value="tickets">Entradas</TabsTrigger>
              <TabsTrigger value="boxes">Boxes</TabsTrigger>
              <TabsTrigger value="promoters">Promotores</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details">
              <BusinessEventForm 
                event={editingEvent!} 
                isSubmitting={isSubmitting} 
                onFormChange={setEditedEventDetails} 
              />
            </TabsContent>
            <TabsContent value="tickets">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Tipos de Entrada</h3>
                <Button size="sm" onClick={() => { setModalTicketContext({}); setShowTicketForm(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Añadir Entrada
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Nombre</TableHead><TableHead>Costo</TableHead><TableHead>Cantidad</TableHead><TableHead>Acciones</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(editingEvent?.ticketTypes || []).map(ticket => (
                    <TableRow key={ticket.id}>
                      <TableCell>{ticket.name}</TableCell>
                      <TableCell>S/ {ticket.cost.toFixed(2)}</TableCell>
                      <TableCell>{ticket.quantity || 'Ilimitado'}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => { setModalTicketContext({ ticket }); setShowTicketForm(true); }}><EditIcon className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteTicketType(ticket.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="boxes">
               <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Boxes</h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { setModalBoxContext({}); setShowBoxForm(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Box</Button>
                </div>
              </div>
              <Table>
                 <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Costo</TableHead><TableHead>Capacidad</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
                 <TableBody>
                  {(editingEvent?.eventBoxes || []).map(box => (
                     <TableRow key={box.id}>
                      <TableCell>{box.name}</TableCell><TableCell>S/ {box.cost.toFixed(2)}</TableCell><TableCell>{box.capacity || 'N/A'}</TableCell><TableCell><Badge>{box.status}</Badge></TableCell>
                      <TableCell>
                         <Button size="icon" variant="ghost" onClick={() => { setModalBoxContext({ box }); setShowBoxForm(true); }}><EditIcon className="h-4 w-4" /></Button>
                         <Button size="icon" variant="ghost" onClick={() => handleDeleteBox(box.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                     </TableRow>
                  ))}
                 </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="promoters">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-semibold">Promotores</h3>
                 <div className="flex gap-2 items-center">
                   <Select value={selectedPromoterForAssignment} onValueChange={setSelectedPromoterForAssignment}><SelectTrigger className="w-[200px]"><SelectValue placeholder="Seleccionar promotor" /></SelectTrigger><SelectContent>{availablePromotersForAssignment.map(p=><SelectItem key={p.id} value={p.id}>{p.promoterName}</SelectItem>)}</SelectContent></Select>
                   <Button size="sm" onClick={handleAssignPromoter} disabled={!selectedPromoterForAssignment}><PlusCircle className="h-4 w-4 mr-2"/>Asignar</Button>
                 </div>
              </div>
               <Table>
                 <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Comisiones</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
                 <TableBody>
                   {(editingEvent?.assignedPromoters || []).map(ap=>(
                     <TableRow key={ap.promoterProfileId}>
                       <TableCell>{ap.promoterName}</TableCell>
                       <TableCell>
                         {(ap.commissionRules||[]).map(cr=>(<div key={cr.id}>{cr.appliesToName}: {cr.commissionValue}{cr.commissionType==='fixed'?' S/.':'%'} <Button size="icon" variant="ghost" onClick={()=>{setCurrentPromoterAssignmentForRules(ap); setShowCommissionRuleModal(true);}}><EditIcon className="h-3 w-3"/></Button><Button size="icon" variant="ghost" onClick={()=>handleDeleteCommissionRule(ap.promoterProfileId, cr.id)}><Trash2 className="h-3 w-3 text-destructive"/></Button></div>))}
                         <Button size="xs" variant="outline" onClick={()=>{setCurrentPromoterAssignmentForRules(ap); setShowCommissionRuleModal(true);}}>+ Regla</Button>
                       </TableCell>
                       <TableCell><Button size="icon" variant="ghost" onClick={()=>handleRemovePromoter(ap.promoterProfileId)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
            </TabsContent>
          </Tabs>
           <UIDialogFooterAliased className="pt-6">
             <Button variant="outline" onClick={closeModal}>Cancelar</Button>
             <Button onClick={handleSaveManagedEventAndClose} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Guardar Cambios</Button>
           </UIDialogFooterAliased>
        </DialogContent>
      </Dialog>

      <Dialog open={showInitialEventModal} onOpenChange={setShowInitialEventModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Evento (Paso 1 de 2)</DialogTitle>
            <UIDialogDescription>Completa los detalles básicos para crear tu evento. Podrás añadir entradas y más detalles en el siguiente paso.</UIDialogDescription>
          </DialogHeader>
          <BusinessEventForm event={null as any} isSubmitting={isSubmitting} onFormChange={handleInitialEventCreate as any}/>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showTicketForm} onOpenChange={setShowTicketForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{modalTicketContext?.ticket ? "Editar" : "Añadir"} Entrada</DialogTitle></DialogHeader>
          <TicketTypeForm ticketType={modalTicketContext?.ticket} onSubmit={handleCreateOrEditTicketType} onCancel={() => setShowTicketForm(false)} isSubmitting={isSubmitting}/>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showBoxForm} onOpenChange={setShowBoxForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{modalBoxContext?.box ? "Editar" : "Añadir"} Box</DialogTitle></DialogHeader>
          <EventBoxForm eventBox={modalBoxContext?.box} onSubmit={handleCreateOrEditBox} onCancel={() => setShowBoxForm(false)} isSubmitting={isSubmitting}/>
        </DialogContent>
      </Dialog>

    </div>
  );
}
