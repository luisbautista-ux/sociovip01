
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Edit, Trash2, Search, CalendarIcon as CalendarIconLucide, BadgeCheck, BadgeX, QrCode, ListChecks, Ticket as TicketIcon, Box, Copy, UserPlus, BarChartHorizontalSquare, Loader2, AlertTriangle, CalendarIcon as CalendarShadcnIcon, Info } from "lucide-react";
import type { BusinessManagedEntity, BusinessEventFormData, GeneratedCode, TicketType, EventBox, PromoterProfile, EventPromoterAssignment, BatchBoxFormData, TicketTypeFormData, EventBoxFormData } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea }from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessEventForm } from "@/components/business/forms/BusinessEventForm";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { TicketTypeForm } from "@/components/business/forms/TicketTypeForm";
import { EventBoxForm } from "@/components/business/forms/EventBoxForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreateBatchBoxesDialog } from "@/components/business/dialogs/CreateBatchBoxesDialog";
import { isEntityCurrentlyActivatable, calculateMaxAttendance } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage as FormMessageHook } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarShadcnUi } from "@/components/ui/calendar"; // Renamed to avoid conflict

const initialEventFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  // Temporarily commented out for debugging
  startDate: z.date({ required_error: "Fecha de inicio es requerida." }),
  endDate: z.date({ required_error: "Fecha de fin es requerida." }),
}).refine(data => data.endDate >= data.startDate, {
  message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
  path: ["endDate"],
});
type InitialEventFormValues = z.infer<typeof initialEventFormSchema>;


export default function BusinessEventsPage() {
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [events, setEvents] = useState<BusinessManagedEntity[]>([]);
  
  const [showManageEventModal, setShowManageEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BusinessManagedEntity | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const { toast } = useToast();

  const [editingTicketInEventModal, setEditingTicketInEventModal] = useState<TicketType | null>(null);
  const [showTicketFormInEventModal, setShowTicketFormInEventModal] = useState(false);

  const [editingBoxInEventModal, setEditingBoxInEventModal] = useState<EventBox | null>(null);
  const [showBoxFormInEventModal, setShowBoxFormInEventModal] = useState(false);
  const [showCreateBatchBoxesModal, setShowCreateBatchBoxesModal] = useState(false);
  
  const [selectedPromoterForAssignment, setSelectedPromoterForAssignment] = useState<string>("");
  const [promoterEventCommission, setPromoterEventCommission] = useState("");
  const [promoterEventNotes, setPromoterEventNotes] = useState("");

  const [showInitialEventModal, setShowInitialEventModal] = useState(false);

  const initialEventForm = useForm<InitialEventFormValues>({
    resolver: zodResolver(initialEventFormSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: new Date(), 
      endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
    },
  });

  const currentBusinessId = userProfile?.businessId; 
  const [mockBusinessPromoters, setMockBusinessPromoters] = useState<PromoterProfile[]>([]);

  const fetchBusinessPromoters = useCallback(async () => {
    if (!currentBusinessId) {
      setMockBusinessPromoters([]);
      return;
    }
    // SIMPLIFIED: Using a static list to avoid Firestore permissions issues for now
    // console.log("BusinessEventsPage: Using simplified mockBusinessPromoters to avoid Firestore fetch for now.");
    setMockBusinessPromoters([
      {id: "promoter1", name: "Carlos Ejemplo (Global)", email: "carlos.ej@promo.com"},
      {id: "promoter2", name: "Ana Promotora (Global)", email: "ana.p@promo.com"},
    ]);

    // try {
    //   const businessId = userProfile?.businessId;
    //    if (typeof businessId !== 'string' || businessId.trim() === '') {
    //     console.error("[BusinessEventsPage] Error: Se intentó consultar promotores con un businessId inválido. businessId recibido: ", businessId, ' UserProfile: ', userProfile);
    //     setMockBusinessPromoters([]);
    //     return;
    //   }
    //   const q = query(collection(db, "promoterProfiles")); // Fetch all global promoters
    //   const querySnapshot = await getDocs(q);
    //   const fetchedPromoters: PromoterProfile[] = querySnapshot.docs.map(docSnap => ({
    //     id: docSnap.id,
    //     ...docSnap.data()
    //   } as PromoterProfile));
    //   setMockBusinessPromoters(fetchedPromoters);
    // } catch (error: any) {
    //   console.error("Failed to fetch promoters for assignment:", error.code, error.message, error);
    //   toast({ title: "Error al cargar promotores", description: `Detalle: ${error.message}`, variant: "destructive" });
    //   setMockBusinessPromoters([]);
    // }
  }, [currentBusinessId, userProfile, toast]);

  const fetchEvents = useCallback(async () => {
    if (!currentBusinessId) {
      setIsLoading(false);
      setEvents([]);
      if (userProfile !== undefined && userProfile !== null && userProfile?.roles?.some(role => ['business_admin', 'staff'].includes(role))) { 
        toast({ title: "Error de Negocio", description: "ID de negocio no disponible. Asegúrate de que tu perfil esté correctamente asociado a un negocio.", variant: "destructive", duration: 7000 });
      }
      return;
    }
    setIsLoading(true);
    try {
      const businessId = userProfile?.businessId;
      if (typeof businessId !== 'string' || businessId.trim() === '') {
        console.error("[BusinessEventsPage] Error: Se intentó consultar eventos con un businessId inválido. businessId recibido: ", businessId, ' UserProfile: ', userProfile);
        setEvents([]);
        setIsLoading(false);
        return;
      }
      const q = query(collection(db, "businessEntities"), where("businessId", "==", businessId), where("type", "==", "event"));
      const querySnapshot = await getDocs(q);
      const fetchedEvents: BusinessManagedEntity[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const ticketTypesData = (data.ticketTypes || []).map((tt: any) => ({ 
            ...tt, 
            eventId: docSnap.id, 
            businessId: businessId // Ensure businessId is set
        }));
        const eventBoxesData = (data.eventBoxes || []).map((eb: any) => ({ 
            ...eb, 
            eventId: docSnap.id, 
            businessId: businessId // Ensure businessId is set
        }));

        return {
          id: docSnap.id,
          businessId: data.businessId,
          type: data.type as 'event',
          name: data.name || "Evento sin nombre",
          description: data.description || "",
          termsAndConditions: data.termsAndConditions || "",
          startDate: data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : (data.startDate || new Date().toISOString()),
          endDate: data.endDate instanceof Timestamp ? data.endDate.toDate().toISOString() : (data.endDate || new Date().toISOString()),
          isActive: data.isActive === undefined ? true : data.isActive,
          imageUrl: data.imageUrl || "",
          aiHint: data.aiHint || "",
          generatedCodes: data.generatedCodes || [],
          ticketTypes: ticketTypesData,
          eventBoxes: eventBoxesData,
          assignedPromoters: data.assignedPromoters || [],
          maxAttendance: data.maxAttendance === undefined ? calculateMaxAttendance(ticketTypesData) : data.maxAttendance,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        };
      });
      setEvents(fetchedEvents.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    } catch (error: any) {
      console.error("Failed to fetch events:", error);
      toast({
        title: "Error al Cargar Eventos",
        description: `No se pudieron obtener los eventos. ${error.message}`,
        variant: "destructive",
      });
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentBusinessId, toast, userProfile]);

  useEffect(() => {
    if (userProfile === undefined) { 
        setIsLoading(true);
        return;
    }
    if (userProfile === null && currentBusinessId === undefined) { 
        setIsLoading(false);
        setEvents([]);
        setMockBusinessPromoters([]);
    } else if (currentBusinessId) {
        fetchEvents();
        fetchBusinessPromoters();
    }
  }, [userProfile, currentBusinessId, fetchEvents, fetchBusinessPromoters]);


  const filteredEvents = events.filter(event => {
    const nameMatch = event.name && typeof event.name === 'string' ? event.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const descriptionMatch = event.description && typeof event.description === 'string' ? event.description.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    return nameMatch || descriptionMatch;
  }).sort((a, b) => { 
    const aActive = isEntityCurrentlyActivatable(a);
    const bActive = isEntityCurrentlyActivatable(b);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    if (a.isActive && !b.isActive) return -1; 
    if (!a.isActive && b.isActive) return 1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const handleOpenManageEventModal = (eventToManage: BusinessManagedEntity | null, duplicate = false) => {
    setIsDuplicating(duplicate);
    if (duplicate && eventToManage) {
        const duplicatedEventData: Omit<BusinessManagedEntity, 'id' | 'generatedCodes' | 'ticketTypes' | 'eventBoxes' | 'assignedPromoters' | 'businessId' | 'type' | 'createdAt'> & { id?: string } = {
            name: `${eventToManage.name || 'Evento'} (Copia)`,
            description: eventToManage.description,
            termsAndConditions: eventToManage.termsAndConditions,
            startDate: eventToManage.startDate, // Should be string
            endDate: eventToManage.endDate,     // Should be string
            isActive: true, 
            imageUrl: eventToManage.imageUrl,
            aiHint: eventToManage.aiHint,
            maxAttendance: 0, 
        };
        setEditingEvent({
            ...duplicatedEventData,
            id: '', 
            businessId: currentBusinessId || "", 
            type: 'event',
            generatedCodes: [],
            ticketTypes: [],
            eventBoxes: [],
            assignedPromoters: [],
        } as BusinessManagedEntity);
        setShowManageEventModal(true);
    } else if (eventToManage) { 
        setEditingEvent({...eventToManage}); 
        setShowManageEventModal(true);
    } else { 
        initialEventForm.reset({
            name: "", description: "", 
            startDate: new Date(), 
            endDate: new Date(new Date().setDate(new Date().getDate() + 7))
        });
        setShowInitialEventModal(true); 
    }
  };
  
  const handleInitialEventSubmit = async (data: InitialEventFormValues) => {
    if (!currentBusinessId) {
        toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }
    setIsSubmitting(true);
    
    const defaultTicket: Omit<TicketType, 'id' | 'eventId'> = { // id and eventId will be set later
      businessId: currentBusinessId,
      name: "Entrada General",
      cost: 0,
      quantity: 0, 
      description: "Entrada estándar para el evento."
    };

    const newEventDataForFirestore: Omit<BusinessManagedEntity, 'id' | 'maxAttendance' | 'ticketTypes' | 'createdAt'> & { createdAt: any, ticketTypes: any[] } = {
      businessId: currentBusinessId,
      type: "event",
      name: data.name,
      description: data.description || "",
      termsAndConditions: "", 
      startDate: data.startDate.toISOString(),
      endDate: data.endDate.toISOString(),
      isActive: true,
      imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(data.name.substring(0,10))}`,
      aiHint: data.name.split(' ').slice(0,2).join(' '),
      generatedCodes: [],
      eventBoxes: [],
      assignedPromoters: [],
      createdAt: serverTimestamp(),
      ticketTypes: [{...defaultTicket, id: `default-ticket-${Date.now()}`}], // Add id here for client-side, eventId will be updated after docRef
    };

    try {
      // Create the event object for Firestore without docRef.id in ticketTypes initially
      const eventPayloadForFirestore = {
        ...newEventDataForFirestore,
        maxAttendance: calculateMaxAttendance(newEventDataForFirestore.ticketTypes),
        // Temporarily remove eventId from ticketTypes for initial addDoc
        ticketTypes: newEventDataForFirestore.ticketTypes.map(({ eventId, ...tt }) => tt), 
      };

      const docRef = await addDoc(collection(db, "businessEntities"), {
          ...eventPayloadForFirestore,
          startDate: Timestamp.fromDate(data.startDate),
          endDate: Timestamp.fromDate(data.endDate),
      });
      
      // Now that we have docRef.id, create the final client-side event object
      const finalNewEvent: BusinessManagedEntity = {
        ...newEventDataForFirestore,
        id: docRef.id,
        maxAttendance: calculateMaxAttendance(newEventDataForFirestore.ticketTypes),
        // Link tickets to the new event ID for client-side state
        ticketTypes: newEventDataForFirestore.ticketTypes.map(tt => ({...tt, eventId: docRef.id })), 
        createdAt: new Date().toISOString(), // For immediate client-side use
      };
      
      setEvents(prev => [finalNewEvent, ...prev].sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      
      toast({ title: "Evento Creado", description: `El evento "${finalNewEvent.name}" ha sido creado. Ahora puedes configurar más detalles.` });
      setShowInitialEventModal(false);
      initialEventForm.reset();
      setEditingEvent(finalNewEvent); 
      setShowManageEventModal(true); 
    } catch (error: any) {
      console.error("Failed to create initial event:", error);
      toast({ title: "Error al Crear Evento", description: `No se pudo crear el evento inicial. ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMainEventDetailsUpdate = (data: BusinessEventFormData) => { // This is Omit<BusinessEventFormData, 'maxAttendance'>
      if (editingEvent) { 
        const updatedEventDetails: Partial<BusinessManagedEntity> = {
            name: data.name,
            description: data.description,
            termsAndConditions: data.termsAndConditions,
            startDate: data.startDate.toISOString(),
            endDate: data.endDate.toISOString(),
            isActive: data.isActive,
            imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : editingEvent.imageUrl || `https://placehold.co/300x200.png`),
            aiHint: data.aiHint,
        };
        setEditingEvent(prev => {
            if (!prev) return null;
            // maxAttendance is calculated from ticketTypes, so it's not directly updated here
            // but will be shown correctly in the form based on prev.ticketTypes
            return { ...prev, ...updatedEventDetails };
        });
        toast({ title: "Detalles del Evento Actualizados", description: `Los cambios en "${data.name}" han sido aplicados en el editor. Guarda el evento para persistir.` });
    }
  };
  
  const handleDeleteEvent = async (eventId: string, eventName?: string) => {
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "businessEntities", eventId));
      toast({ title: "Evento Eliminado", description: `El evento "${eventName || 'seleccionado'}" ha sido eliminado.`, variant: "destructive" });
      fetchEvents(); 
    } catch (error: any) {
      console.error("Failed to delete event:", error);
      toast({ title: "Error al Eliminar", description: `No se pudo eliminar el evento. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveManagedEventAndClose = async () => {
    if (!editingEvent) return;
    if (!currentBusinessId) {
        toast({ title: "Error", description: "ID de negocio no disponible para guardar.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    setIsSubmitting(true);
    try {
      const calculatedAtt = calculateMaxAttendance(editingEvent.ticketTypes);
      const eventToSave: BusinessManagedEntity = {
        ...editingEvent,
        maxAttendance: calculatedAtt,
        businessId: currentBusinessId, 
        type: "event", 
      };
      
      const finalTicketTypes = (eventToSave.ticketTypes || []).map(tt => ({...tt, eventId: eventToSave.id, businessId: currentBusinessId}));
      const finalEventBoxes = (eventToSave.eventBoxes || []).map(eb => ({...eb, eventId: eventToSave.id, businessId: currentBusinessId}));
      const finalAssignedPromoters = (eventToSave.assignedPromoters || []);

      const payloadForFirestore: any = {
        ...eventToSave, 
        startDate: Timestamp.fromDate(new Date(eventToSave.startDate)),
        endDate: Timestamp.fromDate(new Date(eventToSave.endDate)),
        ticketTypes: finalTicketTypes,
        eventBoxes: finalEventBoxes,
        assignedPromoters: finalAssignedPromoters,
        // Ensure generatedCodes is an array
        generatedCodes: Array.isArray(eventToSave.generatedCodes) ? eventToSave.generatedCodes : [], 
      };
      
      // Remove client-side only 'createdAt' if it's a string and we are updating
      if (payloadForFirestore.createdAt && typeof payloadForFirestore.createdAt === 'string') {
        delete payloadForFirestore.createdAt;
      }
      
      if (!eventToSave.id || isDuplicating) { 
        const { id, createdAt, ...dataToCreate } = payloadForFirestore; 
        const finalDataToCreate = { ...dataToCreate, createdAt: serverTimestamp() };
        const docRef = await addDoc(collection(db, "businessEntities"), finalDataToCreate);
        toast({ title: isDuplicating ? "Evento Duplicado Exitosamente" : "Evento Creado Exitosamente", description: `El evento "${eventToSave.name}" ha sido guardado con ID: ${docRef.id}.` });
      } else { 
        const { id, createdAt, ...dataToUpdate } = payloadForFirestore; 
        await updateDoc(doc(db, "businessEntities", eventToSave.id), dataToUpdate);
        toast({ title: "Evento Guardado", description: `Los cambios en "${eventToSave.name}" han sido guardados.` });
      }
      
      setShowManageEventModal(false);
      setEditingEvent(null);
      setIsDuplicating(false);
      fetchEvents();
    } catch (error: any) {
      console.error("Failed to save event:", error);
      toast({ title: "Error al Guardar Evento", description: `No se pudo guardar el evento. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateCodesDialog = (event: BusinessManagedEntity) => {
    if (!isEntityCurrentlyActivatable(event)) {
      toast({ 
        title: "No se pueden crear códigos", 
        description: "Este evento no está activo o está fuera de su periodo de vigencia.", 
        variant: "destructive"
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
  
  const handleNewCodesCreated = (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    setEditingEvent(prev => {
      if (prev && prev.id === entityId) {
        const updatedCodes = [...(prev.generatedCodes || []), ...newCodes];
        return { ...prev, generatedCodes: updatedCodes };
      }
      // Also update in main list if not in modal edit context (less likely for this flow)
      setEvents(prevEvents => prevEvents.map(ev => 
        ev.id === entityId ? {...ev, generatedCodes: [...(ev.generatedCodes || []), ...newCodes]} : ev
      ));
      return prev;
    });
    toast({title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${editingEvent?.name || 'el evento actual'}. Los cambios se guardarán al cerrar la gestión del evento.`});
  };

  const handleCodesUpdatedFromManageDialog = (entityId: string, updatedCodes: GeneratedCode[]) => {
     setEditingEvent(prev => {
      if (prev && prev.id === entityId) {
        return { ...prev, generatedCodes: updatedCodes };
      }
      setEvents(prevEvents => prevEvents.map(event => 
        event.id === entityId ? { ...event, generatedCodes: updatedCodes } : event
      ));
      return prev;
    });
    toast({title: "Códigos Actualizados", description: `Los cambios en los códigos se han aplicado. Si estás en el modal de gestión de evento, guarda el evento para persistir estos cambios.`});
  };

  const getAttendanceCount = (event: BusinessManagedEntity) => {
    const redeemedCount = event.generatedCodes?.filter(c => c.status === 'redeemed').length || 0;
    const effectiveMaxAttendance = event.maxAttendance === undefined || event.maxAttendance === null || event.maxAttendance < 0 ? 0 : event.maxAttendance;
    return `${redeemedCount} / ${effectiveMaxAttendance === 0 ? 'Ilimitado' : effectiveMaxAttendance}`;
  };

 const handleToggleEventStatus = async (eventToToggle: BusinessManagedEntity) => {
    const newStatus = !eventToToggle.isActive;
    const eventName = eventToToggle.name; 

    setEvents(prevEvents => 
        prevEvents.map(event => 
            event.id === eventToToggle.id ? { ...event, isActive: newStatus } : event
        )
    );
    if (editingEvent && editingEvent.id === eventToToggle.id) {
        setEditingEvent(prev => prev ? {...prev, isActive: newStatus} : null);
    }

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "businessEntities", eventToToggle.id), { isActive: newStatus });
      toast({
        title: "Estado Actualizado",
        description: `El evento "${eventName}" ahora está ${newStatus ? "Activo" : "Inactivo"}.`
      });
    } catch (error: any) {
      console.error("Failed to update event status:", error);
      toast({
        title: "Error al Actualizar Estado",
        description: `No se pudo cambiar el estado del evento. ${error.message}`,
        variant: "destructive"
      });
      setEvents(prevEvents => 
        prevEvents.map(event => 
            event.id === eventToToggle.id ? { ...event, isActive: !newStatus } : event
        )
      );
       if (editingEvent && editingEvent.id === eventToToggle.id) {
        setEditingEvent(prev => prev ? {...prev, isActive: !newStatus} : null);
      }
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- Ticket Management within Event Modal ---
  const handleOpenTicketFormModal = (ticket: TicketType | null) => {
    setEditingTicketInEventModal(ticket);
    setShowTicketFormInEventModal(true);
  };

  const handleCreateOrEditTicketTypeForEvent = (data: TicketTypeFormData) => {
    if (!editingEvent || !editingEvent.id || !currentBusinessId) {
        toast({title: "Error", description: "El evento o negocio no está seleccionado o no tiene ID.", variant: "destructive"});
        return;
    }
    const eventId = editingEvent.id;
    let updatedTicketTypes: TicketType[];

    if (editingTicketInEventModal) { 
      updatedTicketTypes = (editingEvent.ticketTypes || []).map(tt =>
        tt.id === editingTicketInEventModal.id ? { ...editingTicketInEventModal, ...data, eventId, businessId: currentBusinessId } : tt
      );
      toast({ title: "Entrada Actualizada", description: `La entrada "${data.name}" ha sido actualizada.` });
    } else { 
      const newTicketType: TicketType = {
        id: `tt-${eventId}-${Date.now()}`,
        businessId: currentBusinessId, 
        eventId,
        ...data,
      };
      updatedTicketTypes = [...(editingEvent.ticketTypes || []), newTicketType];
      toast({ title: "Entrada Creada", description: `La entrada "${newTicketType.name}" ha sido añadida.` });
    }
    
    setEditingEvent(prev => {
      if (!prev) return null;
      const newMaxAtt = calculateMaxAttendance(updatedTicketTypes);
      return {...prev, ticketTypes: updatedTicketTypes, maxAttendance: newMaxAtt };
    });
    setShowTicketFormInEventModal(false);
    setEditingTicketInEventModal(null);
  };

  const handleDeleteTicketTypeFromEvent = (ticketTypeId: string) => {
     if (!editingEvent) return;
     const updatedTicketTypes = (editingEvent.ticketTypes || []).filter(tt => tt.id !== ticketTypeId);
     setEditingEvent(prev => {
        if (!prev) return null;
        const newMaxAtt = calculateMaxAttendance(updatedTicketTypes);
        return {...prev, ticketTypes: updatedTicketTypes, maxAttendance: newMaxAtt};
     });
     toast({ title: "Entrada Eliminada", description: "La entrada ha sido eliminada.", variant: "destructive" });
  };

  // --- Box Management within Event Modal ---
   const handleOpenBoxFormModal = (box: EventBox | null) => {
    setEditingBoxInEventModal(box);
    setShowBoxFormInEventModal(true);
  };

  const handleCreateOrEditBoxForEvent = (data: EventBoxFormData) => {
    if (!editingEvent || !editingEvent.id || !currentBusinessId) {
      toast({title: "Error", description: "El evento o negocio no está seleccionado o no tiene ID.", variant: "destructive"});
      return;
    }
    const eventId = editingEvent.id;
    let updatedEventBoxes: EventBox[];

    if (editingBoxInEventModal) { 
        updatedEventBoxes = (editingEvent.eventBoxes || []).map(box => 
            box.id === editingBoxInEventModal.id ? {...editingBoxInEventModal, ...data, eventId, businessId: currentBusinessId} : box
        );
        toast({ title: "Box Actualizado", description: `El box "${data.name}" ha sido actualizado.` });
    } else { 
        const newBox: EventBox = {
            id: `box-${eventId}-${Date.now()}`,
            businessId: currentBusinessId,
            eventId,
            ...data,
        };
        updatedEventBoxes = [...(editingEvent.eventBoxes || []), newBox];
        toast({ title: "Box Creado", description: `El box "${newBox.name}" ha sido añadido.` });
    }
    setEditingEvent(prev => prev ? {...prev, eventBoxes: updatedEventBoxes} : null);
    setShowBoxFormInEventModal(false);
    setEditingBoxInEventModal(null);
  };

  const handleDeleteBoxFromEvent = (boxId: string) => {
    if (!editingEvent) return;
    const updatedEventBoxes = (editingEvent.eventBoxes || []).filter(box => box.id !== boxId);
    setEditingEvent(prev => prev ? {...prev, eventBoxes: updatedEventBoxes} : null);
    toast({ title: "Box Eliminado", description: "El box ha sido eliminado.", variant: "destructive" });
  };

  const handleAssignPromoterToEvent = async () => {
    if (!editingEvent || !editingEvent.id || !currentBusinessId) {
        toast({title: "Error", description: "El evento o negocio no está seleccionado.", variant: "destructive"});
        return;
    }
    if (!selectedPromoterForAssignment) {
        toast({title: "Error", description: "Selecciona un promotor.", variant:"destructive"});
        return;
    }
    
    const promoterProfile = mockBusinessPromoters.find(p => p.id === selectedPromoterForAssignment);
    if (!promoterProfile) {
        toast({title: "Error", description: "Promotor no encontrado en la lista local.", variant:"destructive"});
        return;
    }

    const newAssignment: EventPromoterAssignment = {
        promoterProfileId: promoterProfile.id,
        promoterName: promoterProfile.name,
        promoterEmail: promoterProfile.email,
        commissionRate: promoterEventCommission,
        notes: promoterEventNotes
    };

    const existingAssignments = editingEvent.assignedPromoters || [];
    if (existingAssignments.some(a => a.promoterProfileId === newAssignment.promoterProfileId)) {
        toast({title: "Promotor ya asignado", description: `${promoterProfile.name} ya está asignado a este evento.`, variant:"destructive"});
        return;
    }

    setEditingEvent(prev => prev ? ({
        ...prev,
        assignedPromoters: [...existingAssignments, newAssignment]
    }) : null);

    toast({title: "Promotor Asignado", description: `${promoterProfile.name} asignado a "${editingEvent.name}". Los cambios se guardarán al cerrar la gestión del evento.`});
    setSelectedPromoterForAssignment("");
    setPromoterEventCommission("");
    setPromoterEventNotes("");
  };

  const handleUnassignPromoterFromEvent = (promoterProfileId: string) => {
    if (!editingEvent) return;
    const updatedAssignments = (editingEvent.assignedPromoters || []).filter(
        p => p.promoterProfileId !== promoterProfileId
    );
    setEditingEvent(prev => prev ? ({...prev, assignedPromoters: updatedAssignments}) : null);
    toast({title: "Promotor Desvinculado", description: `El promotor ha sido desvinculado de este evento. Los cambios se guardarán al cerrar la gestión del evento.`, variant: "destructive"});
  };

  const handleCreateBatchBoxes = async (batchData: BatchBoxFormData) => {
    if (!editingEvent || !editingEvent.id || !currentBusinessId) {
        toast({title: "Error", description: "El evento no está seleccionado o no tiene ID de negocio.", variant: "destructive"});
        return;
    }

    const existingBoxNames = new Set((editingEvent.eventBoxes || []).map(box => box.name.toLowerCase()));
    const newBoxesForBatch: EventBox[] = [];
    let hasConflict = false;
    let conflictingName = "";

    for (let i = batchData.fromNumber; i <= batchData.toNumber; i++) {
      const boxName = `${batchData.prefix} ${i}`;
      if (existingBoxNames.has(boxName.toLowerCase())) {
        hasConflict = true;
        conflictingName = boxName;
        break;
      }
      newBoxesForBatch.push({
        id: `box-${editingEvent.id}-${Date.now()}-${i}`,
        businessId: currentBusinessId,
        eventId: editingEvent.id,
        name: boxName,
        cost: batchData.cost,
        description: batchData.description,
        status: batchData.status,
        capacity: batchData.capacity,
      });
    }

    if (hasConflict) {
      toast({
        title: "Conflicto de Nombres",
        description: `Ya existe un box con un nombre similar a '${conflictingName}'. No se crearon boxes del lote.`,
        variant: "destructive",
      });
      return;
    }

    setEditingEvent(prev => {
      if (!prev) return null;
      return {
        ...prev,
        eventBoxes: [...(prev.eventBoxes || []), ...newBoxesForBatch],
      };
    });

    toast({
      title: "Lote de Boxes Creado",
      description: `${newBoxesForBatch.length} boxes han sido creados y añadidos al evento. Los cambios se guardarán al cerrar la gestión del evento.`,
    });
    setShowCreateBatchBoxesModal(false);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <CalendarIconLucide className="h-8 w-8 mr-2" /> Gestión de Eventos
        </h1>
        <Button onClick={() => handleOpenManageEventModal(null)} className="bg-primary hover:bg-primary/90" disabled={isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Evento
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Mis Eventos</CardTitle>
          <CardDescription>Administra los eventos organizados por tu negocio.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar evento por nombre o descripción..."
              className="pl-8 w-full sm:w-[300px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-60">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-muted-foreground">Cargando eventos...</p>
            </div>
          ) : filteredEvents.length === 0 && !searchTerm ? (
            <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
              No hay eventos registrados. Haz clic en "Crear Evento" para empezar.
            </p>
          ): (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Vigencia</TableHead>
                  <TableHead className="hidden lg:table-cell text-center">Asistencia / Aforo</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Códigos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {event.startDate ? format(parseISO(event.startDate), "P", { locale: es }) : 'N/A'} - {event.endDate ? format(parseISO(event.endDate), "P", { locale: es }) : 'N/A'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center">{getAttendanceCount(event)}</TableCell>
                      <TableCell className="text-center">
                          <div className="flex items-center justify-center space-x-2">
                              <Switch
                                  checked={event.isActive}
                                  onCheckedChange={() => handleToggleEventStatus(event)}
                                  aria-label={`Estado del evento ${event.name}`}
                                  id={`status-switch-${event.id}`}
                                  disabled={isSubmitting}
                              />
                              <Label htmlFor={`status-switch-${event.id}`} className="sr-only">
                                  {event.isActive ? "Activo" : "Inactivo"}
                              </Label>
                              <Badge variant={event.isActive ? "default" : "outline"} className={event.isActive ? "bg-green-500 hover:bg-green-600" : ""}>
                                  {event.isActive ? <BadgeCheck className="mr-1 h-3 w-3"/> : <BadgeX className="mr-1 h-3 w-3"/>}
                                  {event.isActive ? "Activo" : "Inactivo"}
                              </Badge>
                          </div>
                      </TableCell>
                       <TableCell className="space-x-1">
                        <Button variant="default" size="xs" onClick={() => openCreateCodesDialog(event)} disabled={!isEntityCurrentlyActivatable(event) || isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground px-2 py-1 h-auto">
                          <QrCode className="h-3 w-3 mr-1" /> Crear
                        </Button>
                        <Button variant="outline" size="xs" onClick={() => openViewCodesDialog(event)} disabled={isSubmitting} className="px-2 py-1 h-auto">
                          <ListChecks className="h-3 w-3 mr-1" /> Ver ({event.generatedCodes?.length || 0})
                        </Button>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" title="Duplicar Evento" onClick={() => handleOpenManageEventModal(event, true)} disabled={isSubmitting}>
                          <Copy className="h-4 w-4" />
                          <span className="sr-only">Duplicar</span>
                        </Button>
                        <Button variant="ghost" size="icon" title="Gestionar Evento" onClick={() => handleOpenManageEventModal(event)} disabled={isSubmitting}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Gestionar Evento</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Eliminar Evento" className="text-destructive hover:text-destructive" disabled={isSubmitting}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Eliminar</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto eliminará permanentemente el evento:
                                <span className="font-semibold"> {event.name}</span> y todas sus entradas, boxes y códigos asociados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteEvent(event.id, event.name)}
                                className="bg-destructive hover:bg-destructive/90"
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">No se encontraron eventos con los filtros aplicados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal para creación inicial del evento */}
      <Dialog open={showInitialEventModal} onOpenChange={(isOpen) => {
          if (!isOpen) initialEventForm.reset();
          setShowInitialEventModal(isOpen);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paso 1: Crear Nuevo Evento</DialogTitle>
            <DialogDescription>Ingresa los detalles básicos del evento. Podrás configurar entradas, boxes y más en el siguiente paso.</DialogDescription>
          </DialogHeader>
          <Form {...initialEventForm}>
            <form onSubmit={initialEventForm.handleSubmit(handleInitialEventSubmit)} className="space-y-4 py-4">
              <FormField
                control={initialEventForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <Label>Nombre del Evento <span className="text-destructive">*</span></Label>
                    <FormControl><Input placeholder="Ej: Fiesta de Verano" {...field} disabled={isSubmitting} /></FormControl>
                    <FormMessageHook />
                  </FormItem>
                )}
              />
              <FormField
                control={initialEventForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <Label>Descripción <span className="text-destructive">*</span></Label>
                    <FormControl><Textarea placeholder="Una breve descripción del evento..." {...field} rows={3} disabled={isSubmitting} /></FormControl>
                    <FormMessageHook />
                  </FormItem>
                )}
              />
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={initialEventForm.control}
                    name="startDate"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <Label>Fecha de Inicio <span className="text-destructive">*</span></Label>
                        <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className="pl-3 text-left font-normal" disabled={isSubmitting}>
                                {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                                <CalendarShadcnIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <CalendarShadcnUi mode="single" selected={field.value} onSelect={field.onChange} locale={es} initialFocus />
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
                        <Label>Fecha de Fin <span className="text-destructive">*</span></Label>
                        <Popover>
                        <PopoverTrigger asChild>
                           <FormControl>
                            <Button variant={"outline"} className="pl-3 text-left font-normal" disabled={isSubmitting}>
                                {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                                <CalendarShadcnIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                           </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <CalendarShadcnUi mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < (initialEventForm.getValues("startDate") || new Date(0))} locale={es} initialFocus />
                        </PopoverContent>
                        </Popover>
                        <FormMessageHook />
                    </FormItem>
                    )}
                />
               </div>
              <DialogFooter className="pt-6">
                <Button type="button" variant="outline" onClick={() => setShowInitialEventModal(false)} disabled={isSubmitting}>Cancelar</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Continuar y Configurar Evento
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Modal principal para gestionar todos los aspectos de un evento */}
      {editingEvent && (
      <Dialog open={showManageEventModal} onOpenChange={(isOpen) => {
        if (!isOpen && !showTicketFormInEventModal && !showBoxFormInEventModal && !showCreateBatchBoxesModal) { 
             setEditingEvent(null); 
             setIsDuplicating(false);
        }
        setShowManageEventModal(isOpen);
      }}>
        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">
                {isDuplicating ? `Duplicar Evento: ${editingEvent?.name?.replace(' (Copia)','') || 'Nuevo Evento'}` : 
                (editingEvent?.id ? `Gestionar Evento: ${editingEvent.name}` : "Configurar Nuevo Evento")}
            </DialogTitle>
            <DialogDescription>
                 {isDuplicating ? `Creando una copia. Ajusta los detalles necesarios.` : "Administra todos los aspectos de tu evento desde las pestañas."}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-grow flex flex-col overflow-hidden">
            <TabsList className="mb-4 shrink-0">
              <TabsTrigger value="details">Detalles del Evento</TabsTrigger>
              <TabsTrigger value="tickets">Entradas</TabsTrigger>
              <TabsTrigger value="boxes">Boxes</TabsTrigger>
              <TabsTrigger value="promoters">Promotores</TabsTrigger>
              <TabsTrigger value="stats">Estadísticas</TabsTrigger>
            </TabsList>

            {/* Pestaña Detalles del Evento */}
            <TabsContent value="details" className="flex-grow overflow-y-auto p-1">
              <BusinessEventForm
                event={editingEvent} 
                onSubmit={handleMainEventDetailsUpdate} 
                isSubmitting={isSubmitting} 
              />
            </TabsContent>

            {/* Pestaña Entradas */}
            <TabsContent value="tickets" className="flex-grow overflow-y-auto p-1 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Entradas para: {editingEvent.name}</h3>
                    <Button onClick={() => handleOpenTicketFormModal(null) } className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Crear Nueva Entrada
                    </Button>
                </div>
                {(editingEvent.ticketTypes?.length || 0) > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Costo (S/)</TableHead><TableHead>Descripción</TableHead><TableHead>Cantidad</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {editingEvent.ticketTypes?.map((tt) => (
                                <TableRow key={tt.id}>
                                    <TableCell>{tt.name}</TableCell><TableCell>{tt.cost.toFixed(2)}</TableCell><TableCell>{tt.description || "N/A"}</TableCell><TableCell>{tt.quantity === undefined || tt.quantity === null || tt.quantity <= 0 ? 'Ilimitada' : tt.quantity}</TableCell>
                                    <TableCell className="text-right">
                                      <Button variant="ghost" size="icon" onClick={() => handleOpenTicketFormModal(tt)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                                      <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                          <AlertDialogContent><AlertDialogHeader><UIAlertDialogTitle>Eliminar entrada?</UIAlertDialogTitle><AlertDialogDescription>Eliminar "{tt.name}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTicketTypeFromEvent(tt.id)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                      </AlertDialog>
                                    </TableCell>
                                </TableRow>))}
                        </TableBody>
                    </Table>
                ) : <p className="text-muted-foreground text-center py-4">No hay entradas definidas para este evento.</p>}
            </TabsContent>

             {/* Pestaña Boxes */}
            <TabsContent value="boxes" className="flex-grow overflow-y-auto p-1 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Boxes para: {editingEvent.name}</h3>
                    <div className="space-x-2">
                        <Button onClick={() => setShowCreateBatchBoxesModal(true)} variant="outline" disabled={isSubmitting}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Crear Boxes en Lote
                        </Button>
                        <Button onClick={() => handleOpenBoxFormModal(null)} className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevo Box
                        </Button>
                    </div>
                </div>
                {(editingEvent.eventBoxes?.length || 0) > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Costo (S/)</TableHead><TableHead>Estado</TableHead><TableHead>Capacidad</TableHead><TableHead>Vendedor</TableHead><TableHead>Dueño (Cliente)</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {editingEvent.eventBoxes?.map((box) => (
                                <TableRow key={box.id}>
                                    <TableCell>{box.name}</TableCell><TableCell>{box.cost.toFixed(2)}</TableCell><TableCell><Badge variant={box.status === 'available' ? 'default' : 'secondary'}>{box.status === 'available' ? "Disponible" : "No Disp."}</Badge></TableCell><TableCell>{box.capacity || "N/A"}</TableCell><TableCell>{box.sellerName || "N/A"}</TableCell><TableCell>{box.ownerName || "N/A"} {box.ownerDni && `(${box.ownerDni})`}</TableCell>
                                    <TableCell className="text-right">
                                      <Button variant="ghost" size="icon" onClick={() => handleOpenBoxFormModal(box)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                                      <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                          <AlertDialogContent><AlertDialogHeader><UIAlertDialogTitle>Eliminar box?</UIAlertDialogTitle><AlertDialogDescription>Eliminar "{box.name}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBoxFromEvent(box.id)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                      </AlertDialog>
                                    </TableCell>
                                </TableRow>))}
                        </TableBody>
                    </Table>
                ) : <p className="text-muted-foreground text-center py-4">No hay boxes definidos para este evento.</p>}
            </TabsContent>

            {/* Pestaña Promotores */}
            <TabsContent value="promoters" className="flex-grow overflow-y-auto p-1 space-y-4">
                <h3 className="text-lg font-semibold">Asignar Promotores a: {editingEvent.name}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 border rounded-md">
                    <div className="space-y-1">
                        <Label htmlFor="promoter-select">Seleccionar Promotor</Label>
                        <Select value={selectedPromoterForAssignment} onValueChange={setSelectedPromoterForAssignment} disabled={isSubmitting || mockBusinessPromoters.length === 0}>
                            <SelectTrigger id="promoter-select"><SelectValue placeholder={mockBusinessPromoters.length === 0 ? "No hay promotores" : "Elige un promotor"} /></SelectTrigger>
                            <SelectContent>
                                {mockBusinessPromoters.length > 0 ? mockBusinessPromoters.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.email})</SelectItem>) : <div className="p-2 text-sm text-muted-foreground">No hay promotores para asignar.</div> }
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="promoter-commission">Comisión para este Evento (Opcional)</Label>
                        <Input id="promoter-commission" placeholder="Ej: 10% por entrada" value={promoterEventCommission} onChange={(e) => setPromoterEventCommission(e.target.value)} disabled={isSubmitting} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="promoter-notes">Notas (Opcional)</Label>
                        <Input id="promoter-notes" placeholder="Notas específicas para el promotor" value={promoterEventNotes} onChange={(e) => setPromoterEventNotes(e.target.value)} disabled={isSubmitting} />
                    </div>
                    <Button onClick={handleAssignPromoterToEvent} className="md:col-span-3 bg-primary hover:bg-primary/90" disabled={isSubmitting || !selectedPromoterForAssignment}>
                        <UserPlus className="mr-2 h-4 w-4" /> Asignar Promotor al Evento
                    </Button>
                </div>
                <h4 className="text-md font-semibold pt-2">Promotores Asignados a este Evento</h4>
                {(editingEvent.assignedPromoters?.length || 0) > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Comisión (Evento)</TableHead><TableHead>Notas</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {editingEvent.assignedPromoters?.map(ap => (
                                <TableRow key={ap.promoterProfileId}>
                                    <TableCell>{ap.promoterName}</TableCell><TableCell>{ap.promoterEmail || "N/A"}</TableCell><TableCell>{ap.commissionRate || "General del negocio"}</TableCell><TableCell>{ap.notes || "N/A"}</TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog><AlertDialogTrigger asChild><Button variant="link" size="sm" className="text-destructive hover:text-destructive" disabled={isSubmitting}>Desvincular</Button></AlertDialogTrigger>
                                            <AlertDialogContent><AlertDialogHeader><UIAlertDialogTitle>Desvincular Promotor?</UIAlertDialogTitle><AlertDialogDescription>Desvincular a {ap.promoterName} de este evento?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleUnassignPromoterFromEvent(ap.promoterProfileId)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>Desvincular</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ): <p className="text-muted-foreground text-center py-4">No hay promotores asignados a este evento.</p>}
            </TabsContent>

            {/* Pestaña Estadísticas */}
            <TabsContent value="stats" className="flex-grow overflow-y-auto p-1 space-y-4">
                <h3 className="text-lg font-semibold">Estadísticas para: {editingEvent.name}</h3>
                <Card><CardContent className="p-4 space-y-2">
                    <p><strong>Códigos Generados (Total):</strong> {editingEvent.generatedCodes?.length || 0}</p>
                    <p><strong>Códigos Canjeados:</strong> {editingEvent.generatedCodes?.filter(c => c.status === 'redeemed').length || 0}</p>
                    <p><strong>Tasa de Canje:</strong> {editingEvent.generatedCodes?.length && editingEvent.generatedCodes?.length > 0 ? ((editingEvent.generatedCodes.filter(c => c.status === 'redeemed').length / editingEvent.generatedCodes.length) * 100).toFixed(2) : '0.00'}%</p>
                    <p><strong>Entradas Vendidas (Estimado por canjes):</strong> {(editingEvent.ticketTypes || []).reduce((acc, tt) => acc + (editingEvent.generatedCodes?.filter(gc => gc.status === 'redeemed' && gc.observation?.includes(tt.name)).length || 0) ,0)}</p>
                    <p><strong>Asistencia Estimada (Canjes):</strong> {editingEvent.generatedCodes?.filter(c => c.status === 'redeemed').length || 0}</p>
                    <p><strong>Aforo Máximo (Calculado de Entradas):</strong> {calculateMaxAttendance(editingEvent.ticketTypes)}</p>

                    <p className="text-sm text-muted-foreground pt-2">Estas son estadísticas basadas en códigos canjeados y configuración de entradas. La vinculación exacta de código a tipo de entrada o promotor requeriría más detalle en la generación/canje de códigos.</p>
                </CardContent></Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4 border-t mt-auto shrink-0">
            <Button variant="outline" onClick={() => {setShowManageEventModal(false); setEditingEvent(null); setIsDuplicating(false);}} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleSaveManagedEventAndClose} className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingEvent.id && !isDuplicating ? "Guardar Cambios y Cerrar" : "Crear Evento y Cerrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Modal para el formulario de TicketType (dentro del modal de gestión de evento) */}
      {showManageEventModal && editingEvent && showTicketFormInEventModal && (
          <Dialog open={showTicketFormInEventModal} onOpenChange={(isOpen) => {
              setShowTicketFormInEventModal(isOpen);
              if (!isOpen) setEditingTicketInEventModal(null);
          }}>
              <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                      <DialogTitle>{editingTicketInEventModal ? "Editar Entrada" : "Crear Nueva Entrada"} para {editingEvent.name}</DialogTitle>
                  </DialogHeader>
                  <TicketTypeForm
                      ticketType={editingTicketInEventModal || undefined}
                      onSubmit={handleCreateOrEditTicketTypeForEvent}
                      onCancel={() => { setShowTicketFormInEventModal(false); setEditingTicketInEventModal(null); }}
                      isSubmitting={isSubmitting} 
                  />
              </DialogContent>
          </Dialog>
      )}

      {/* Modal para el formulario de EventBox (dentro del modal de gestión de evento) */}
      {showManageEventModal && editingEvent && showBoxFormInEventModal && (
          <Dialog open={showBoxFormInEventModal} onOpenChange={(isOpen) => {
              setShowBoxFormInEventModal(isOpen);
              if (!isOpen) setEditingBoxInEventModal(null);
          }}>
              <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                      <DialogTitle>{editingBoxInEventModal ? "Editar Box" : "Crear Nuevo Box"} para {editingEvent.name}</DialogTitle>
                  </DialogHeader>
                  <EventBoxForm
                      eventBox={editingBoxInEventModal || undefined}
                      onSubmit={handleCreateOrEditBoxForEvent}
                      onCancel={() => { setShowBoxFormInEventModal(false); setEditingBoxInEventModal(null);}}
                      isSubmitting={isSubmitting} 
                  />
              </DialogContent>
          </Dialog>
      )}

      {/* Modal para crear boxes en lote (dentro del modal de gestión de evento) */}
      {showManageEventModal && editingEvent && showCreateBatchBoxesModal && (
        <CreateBatchBoxesDialog
          open={showCreateBatchBoxesModal}
          onOpenChange={setShowCreateBatchBoxesModal}
          onSubmit={handleCreateBatchBoxes}
          isSubmitting={isSubmitting} 
        />
      )}

      {selectedEntityForCreatingCodes && (
        <CreateCodesDialog
          open={showCreateCodesModal}
          onOpenChange={setShowCreateCodesModal}
          entityName={selectedEntityForCreatingCodes.name}
          entityId={selectedEntityForCreatingCodes.id}
          existingCodesValues={(selectedEntityForCreatingCodes.generatedCodes || []).map(c => c.value)}
          onCodesCreated={handleNewCodesCreated}
          isSubmitting={isSubmitting} 
        />
      )}

      {selectedEntityForViewingCodes && (
        <ManageCodesDialog
          open={showManageCodesModal}
          onOpenChange={(isOpen) => {
            setShowManageCodesModal(isOpen);
            if (!isOpen) setSelectedEntityForViewingCodes(null);
          }}
          entity={selectedEntityForViewingCodes}
          onCodesUpdated={handleCodesUpdatedFromManageDialog}
          onRequestCreateNewCodes={() => {
            const currentEntity = events.find(e => e.id === selectedEntityForViewingCodes?.id); 
            setShowManageCodesModal(false); 
            if(currentEntity) { 
                setTimeout(() => { 
                    if (isEntityCurrentlyActivatable(currentEntity)) {
                        setSelectedEntityForCreatingCodes(currentEntity);
                        setShowCreateCodesModal(true);
                    } else {
                        toast({
                            title: "No se pueden crear códigos",
                            description: "Este evento no está activo o está fuera de su periodo de vigencia.",
                            variant: "destructive"
                        });
                    }
                }, 0);
            }
          }}
        />
      )}
    </div>
  );
}

    