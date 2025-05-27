
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Edit, Trash2, Search, Calendar, BadgeCheck, BadgeX, QrCode, ListChecks, Ticket as TicketIcon, Box, Copy, UserPlus, BarChartHorizontalSquare, Loader2 } from "lucide-react";
import type { BusinessManagedEntity, BusinessEventFormData, GeneratedCode, TicketType, EventBox, TicketTypeFormData, EventBoxFormData, PromoterProfile, EventPromoterAssignment, BatchBoxFormData } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessEventForm } from "@/components/business/forms/BusinessEventForm";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { TicketTypeForm } from "@/components/business/forms/TicketTypeForm";
import { EventBoxForm } from "@/components/business/forms/EventBoxForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreateBatchBoxesDialog } from "@/components/business/dialogs/CreateBatchBoxesDialog";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp } from "firebase/firestore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage as FormMessageHook } from "@/components/ui/form";

// Mock list of promoters available to this business
const mockBusinessPromoters: PromoterProfile[] = [
  { id: "pp1", name: "Carlos Santana", email: "carlos.santana@promo.com", phone: "+51911223344"},
  { id: "pp2", name: "Lucia Fernandez", email: "lucia.fernandez@promo.com", phone: "+51955667788"},
  { id: "pp3", name: "Pedro Pascal", email: "pedro.pascal@promo.com"},
];

const MOCK_BUSINESS_ID = "biz1"; // This should come from AuthContext in a real app

const initialEventFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
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

  // States for managing event-specific tickets
  const [editingTicketInEventModal, setEditingTicketInEventModal] = useState<TicketType | null>(null);
  const [showTicketFormInEventModal, setShowTicketFormInEventModal] = useState(false);

  // States for managing event-specific boxes
  const [editingBoxInEventModal, setEditingBoxInEventModal] = useState<EventBox | null>(null);
  const [showBoxFormInEventModal, setShowBoxFormInEventModal] = useState(false);
  const [showCreateBatchBoxesModal, setShowCreateBatchBoxesModal] = useState(false);
  
  // States for promoter assignment within event modal
  const [selectedPromoterForAssignment, setSelectedPromoterForAssignment] = useState<string>("");
  const [promoterEventCommission, setPromoterEventCommission] = useState("");
  const [promoterEventNotes, setPromoterEventNotes] = useState("");

  // State for the initial event creation modal
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

  const currentBusinessId = userProfile?.businessId || MOCK_BUSINESS_ID; // Use actual businessId if available

  const fetchEvents = useCallback(async () => {
    if (!currentBusinessId) {
        setIsLoading(false);
        setEvents([]);
        // toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    try {
      const q = query(collection(db, "businessEntities"), where("businessId", "==", currentBusinessId), where("type", "==", "event"));
      const querySnapshot = await getDocs(q);
      const fetchedEvents: BusinessManagedEntity[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          startDate: data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : data.startDate,
          endDate: data.endDate instanceof Timestamp ? data.endDate.toDate().toISOString() : data.endDate,
          generatedCodes: data.generatedCodes || [],
          ticketTypes: data.ticketTypes || [],
          eventBoxes: data.eventBoxes || [],
          assignedPromoters: data.assignedPromoters || [],
        } as BusinessManagedEntity;
      });
      setEvents(fetchedEvents);
    } catch (error) {
      console.error("Failed to fetch events:", error);
      toast({
        title: "Error al Cargar Eventos",
        description: "No se pudieron obtener los eventos. Intenta de nuevo.",
        variant: "destructive",
      });
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentBusinessId, toast]);

  useEffect(() => {
    if (userProfile?.businessId || MOCK_BUSINESS_ID) { // Ensure there's a businessId to fetch for
        fetchEvents();
    } else {
        setIsLoading(false); // No businessId, so stop loading
    }
  }, [userProfile, fetchEvents]);


  const calculateMaxAttendance = useCallback((ticketTypes: TicketType[] | undefined): number => {
    if (!ticketTypes || ticketTypes.length === 0) return 0;
    return ticketTypes.reduce((sum, ticket) => {
      const quantity = ticket.quantity === undefined || ticket.quantity === null || ticket.quantity < 0 ? 0 : ticket.quantity;
      return sum + (quantity > 0 ? quantity : 0); // Sum only if quantity > 0, treat 0 or undefined as no contribution to fixed aforo
    }, 0);
  }, []);

  useEffect(() => {
    if (editingEvent && editingEvent.ticketTypes) {
      const newMaxAttendance = calculateMaxAttendance(editingEvent.ticketTypes);
      if (editingEvent.maxAttendance !== newMaxAttendance) {
        setEditingEvent(prev => prev ? { ...prev, maxAttendance: newMaxAttendance } : null);
      }
    }
  }, [editingEvent?.ticketTypes, calculateMaxAttendance]);


  const filteredEvents = events.filter(event => {
    const nameMatch = event.name && typeof event.name === 'string' ? event.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const descriptionMatch = event.description && typeof event.description === 'string' ? event.description.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    return nameMatch || descriptionMatch;
  }).sort((a, b) => { 
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  const handleOpenManageEventModal = (event: BusinessManagedEntity | null, duplicate = false) => {
    setIsDuplicating(duplicate);
    if (duplicate && event) {
        const newIdBase = `evt-dup-${Date.now()}`;
        setEditingEvent({
            ...event,
            id: '', 
            name: `${event.name || 'Evento'} (Copia)`,
            generatedCodes: [], 
            ticketTypes: [], // Do not duplicate tickets
            eventBoxes: [], // Do not duplicate boxes
            assignedPromoters: [] // Do not duplicate promoters
        });
        setShowManageEventModal(true);
    } else if (event) { 
        setEditingEvent({...event, 
          ticketTypes: event.ticketTypes ? [...event.ticketTypes.map(tt => ({...tt}))] : [], 
          eventBoxes: event.eventBoxes ? [...event.eventBoxes.map(eb => ({...eb}))] : [],
          assignedPromoters: event.assignedPromoters ? [...event.assignedPromoters.map(ap => ({...ap}))] : [],
          generatedCodes: event.generatedCodes ? [...event.generatedCodes.map(gc => ({...gc}))] : [],
        });
        setShowManageEventModal(true);
    } else { // Creating a brand new event
        initialEventForm.reset({
            name: "", description: "", 
            startDate: new Date(), 
            endDate: new Date(new Date().setDate(new Date().getDate() + 7))
        });
        setShowInitialEventModal(true); // Open the initial small modal first
    }
  };
  
  const handleInitialEventSubmit = async (data: InitialEventFormValues) => {
    setIsSubmitting(true);
    const defaultTicket: TicketType = {
      id: `default-ticket-${Date.now()}`,
      eventId: '', // Will be set after event creation
      businessId: currentBusinessId,
      name: "Entrada General",
      cost: 0,
      quantity: 0, // Default to 0, user can edit later
      description: "Entrada estándar para el evento."
    };

    const newEventToSave: Omit<BusinessManagedEntity, 'id'> = {
      businessId: currentBusinessId,
      type: "event",
      name: data.name,
      description: data.description,
      termsAndConditions: "", // Empty by default
      startDate: format(data.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
      endDate: format(data.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
      maxAttendance: calculateMaxAttendance([defaultTicket]), // Initially calculated with default ticket
      isActive: true,
      imageUrl: "",
      aiHint: "",
      generatedCodes: [],
      ticketTypes: [defaultTicket], // Add default ticket
      eventBoxes: [],
      assignedPromoters: [],
    };

    try {
      const docRef = await addDoc(collection(db, "businessEntities"), newEventToSave);
      const finalNewEvent: BusinessManagedEntity = {
        ...newEventToSave,
        id: docRef.id,
        // Update eventId in default ticket
        ticketTypes: newEventToSave.ticketTypes?.map(tt => tt.id === defaultTicket.id ? {...tt, eventId: docRef.id} : tt) || []
      };
      
      setEvents(prev => [finalNewEvent, ...prev]);
      setEditingEvent(finalNewEvent); // Set for the main management modal
      
      toast({ title: "Evento Creado", description: `El evento "${finalNewEvent.name}" ha sido creado. Ahora puedes configurar más detalles.` });
      setShowInitialEventModal(false);
      initialEventForm.reset();
      setShowManageEventModal(true); // Open the main management modal
    } catch (error) {
      console.error("Failed to create initial event:", error);
      toast({ title: "Error al Crear Evento", description: "No se pudo crear el evento inicial.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMainEventFormSubmit = (data: BusinessEventFormData) => {
      // This function updates the 'editingEvent' state with details from the BusinessEventForm
      if (editingEvent && showManageEventModal) { 
        const updatedEventDetails: Partial<BusinessManagedEntity> = {
            name: data.name,
            description: data.description,
            termsAndConditions: data.termsAndConditions,
            startDate: format(data.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
            endDate: format(data.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
            isActive: data.isActive,
            imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : editingEvent.imageUrl || `https://placehold.co/300x200.png`),
            aiHint: data.aiHint,
            // maxAttendance is NOT updated here, it's calculated based on tickets
        };
        setEditingEvent(prev => prev ? ({ ...prev, ...updatedEventDetails }) : null);
        toast({ title: "Detalles del Evento Actualizados", description: `Los detalles de "${data.name}" han sido actualizados en el editor.` });
    }
  };
  
  const handleDeleteEvent = async (eventId: string, eventName?: string) => {
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "businessEntities", eventId));
      toast({ title: "Evento Eliminado", description: `El evento "${eventName || 'seleccionado'}" ha sido eliminado.`, variant: "destructive" });
      fetchEvents();
    } catch (error) {
      console.error("Failed to delete event:", error);
      toast({ title: "Error al Eliminar", description: "No se pudo eliminar el evento.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveManagedEventAndClose = async () => {
    if (!editingEvent || !editingEvent.id) return;

    setIsSubmitting(true);
    try {
      const calculatedAtt = calculateMaxAttendance(editingEvent.ticketTypes);
      const eventToUpdate: BusinessManagedEntity = {
        ...editingEvent,
        maxAttendance: calculatedAtt,
      };

      const { id, ...dataToUpdate } = eventToUpdate; // Firestore update doesn't need the id in the data payload
      await updateDoc(doc(db, "businessEntities", id), dataToUpdate);
      
      toast({ title: "Evento Guardado", description: `Los cambios en "${editingEvent.name}" han sido guardados.` });
      setShowManageEventModal(false);
      setEditingEvent(null);
      setIsDuplicating(false);
      fetchEvents();
    } catch (error) {
      console.error("Failed to save event:", error);
      toast({ title: "Error al Guardar Evento", description: "No se pudo guardar el evento.", variant: "destructive"});
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
  
  const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    const targetEvent = editingEvent?.id === entityId ? editingEvent : events.find(e => e.id === entityId);
    if (!targetEvent) return;

    const updatedCodes = [...(targetEvent.generatedCodes || []), ...newCodes];
    
    if (editingEvent && editingEvent.id === entityId) {
      setEditingEvent(prev => prev ? { ...prev, generatedCodes: updatedCodes } : null);
    }
    setEvents(prevEvents => prevEvents.map(event => 
      event.id === entityId ? { ...event, generatedCodes: updatedCodes } : event
    ));
    toast({title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${targetEvent.name}. Estos cambios se guardarán al cerrar la gestión del evento.`});
  };

  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodes: GeneratedCode[]) => {
     const targetEvent = editingEvent?.id === entityId ? editingEvent : events.find(e => e.id === entityId);
     if (!targetEvent) return;
    
    if (editingEvent && editingEvent.id === entityId) {
      setEditingEvent(prev => prev ? { ...prev, generatedCodes: updatedCodes } : null);
    }
    setEvents(prevEvents => prevEvents.map(event => 
      event.id === entityId ? { ...event, generatedCodes: updatedCodes } : event
    ));
    toast({title: "Códigos Actualizados", description: `Para: ${targetEvent.name}. Estos cambios se guardarán al cerrar la gestión del evento.`});
  };

  const getAttendanceCount = (event: BusinessManagedEntity) => {
    const redeemedCount = event.generatedCodes?.filter(c => c.status === 'redeemed').length || 0;
    const effectiveMaxAttendance = event.maxAttendance === undefined || event.maxAttendance === null ? 0 : event.maxAttendance;
    return `${redeemedCount} / ${effectiveMaxAttendance === 0 ? 'Ilimitado' : effectiveMaxAttendance}`;
  };

 const handleToggleEventStatus = async (eventToToggle: BusinessManagedEntity) => {
    const newStatus = !eventToToggle.isActive;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "businessEntities", eventToToggle.id), { isActive: newStatus });
      toast({
        title: "Estado Actualizado",
        description: `El evento "${eventToToggle.name}" ahora está ${newStatus ? "Activo" : "Inactivo"}.`
      });
      fetchEvents();
    } catch (error) {
      console.error("Failed to update event status:", error);
      toast({
        title: "Error al Actualizar Estado",
        description: "No se pudo cambiar el estado del evento.",
        variant: "destructive"
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  // CRUD for Ticket Types within an Event (inside Manage Event Modal)
  const handleCreateOrEditTicketTypeForEvent = (data: TicketTypeFormData) => {
    if (!editingEvent || !editingEvent.id) {
        toast({title: "Error", description: "El evento no está seleccionado o no tiene ID.", variant: "destructive"});
        return;
    }

    const eventId = editingEvent.id;
    let updatedTicketTypes: TicketType[];

    if (editingTicketInEventModal) { // Editing
      updatedTicketTypes = (editingEvent.ticketTypes || []).map(tt =>
        tt.id === editingTicketInEventModal.id ? { ...editingTicketInEventModal, ...data, eventId, businessId: editingEvent.businessId } : tt
      );
      toast({ title: "Entrada Actualizada", description: `La entrada "${data.name}" ha sido actualizada para este evento.` });
    } else { // Creating
      const newTicketType: TicketType = {
        id: `tt-${eventId}-${Date.now()}`,
        businessId: editingEvent.businessId, 
        eventId,
        ...data,
      };
      updatedTicketTypes = [...(editingEvent.ticketTypes || []), newTicketType];
      toast({ title: "Entrada Creada", description: `La entrada "${newTicketType.name}" ha sido añadida a este evento.` });
    }
    
    setEditingEvent(prev => prev ? {...prev, ticketTypes: updatedTicketTypes, maxAttendance: calculateMaxAttendance(updatedTicketTypes) } : null);
    setShowTicketFormInEventModal(false);
    setEditingTicketInEventModal(null);
  };

  const handleDeleteTicketTypeFromEvent = (ticketTypeId: string) => {
     if (!editingEvent) return;
     const updatedTicketTypes = (editingEvent.ticketTypes || []).filter(tt => tt.id !== ticketTypeId);
     setEditingEvent(prev => prev ? {...prev, ticketTypes: updatedTicketTypes, maxAttendance: calculateMaxAttendance(updatedTicketTypes)} : null);
     toast({ title: "Entrada Eliminada", description: "La entrada ha sido eliminada de este evento.", variant: "destructive" });
  };

  // CRUD for Event Boxes within an Event (inside Manage Event Modal)
  const handleCreateOrEditBoxForEvent = (data: EventBoxFormData) => {
    if (!editingEvent || !editingEvent.id) {
      toast({title: "Error", description: "El evento no está seleccionado o no tiene ID.", variant: "destructive"});
      return;
    }
    const eventId = editingEvent.id;
    let updatedEventBoxes: EventBox[];

    if (editingBoxInEventModal) { // Editing
        updatedEventBoxes = (editingEvent.eventBoxes || []).map(box => 
            box.id === editingBoxInEventModal.id ? {...editingBoxInEventModal, ...data, eventId, businessId: editingEvent.businessId} : box
        );
        toast({ title: "Box Actualizado", description: `El box "${data.name}" ha sido actualizado para este evento.` });
    } else { // Creating
        const newBox: EventBox = {
            id: `box-${eventId}-${Date.now()}`,
            businessId: editingEvent.businessId,
            eventId,
            ...data,
        };
        updatedEventBoxes = [...(editingEvent.eventBoxes || []), newBox];
        toast({ title: "Box Creado", description: `El box "${newBox.name}" ha sido añadido a este evento.` });
    }
    setEditingEvent(prev => prev ? {...prev, eventBoxes: updatedEventBoxes} : null);
    setShowBoxFormInEventModal(false);
    setEditingBoxInEventModal(null);
  };

  const handleDeleteBoxFromEvent = (boxId: string) => {
    if (!editingEvent) return;
    const updatedEventBoxes = (editingEvent.eventBoxes || []).filter(box => box.id !== boxId);
    setEditingEvent(prev => prev ? {...prev, eventBoxes: updatedEventBoxes} : null);
    toast({ title: "Box Eliminado", description: "El box ha sido eliminado de este evento.", variant: "destructive" });
  };

  // Promoter Assignment Logic (inside Manage Event Modal)
  const handleAssignPromoterToEvent = () => {
    if (!editingEvent || !editingEvent.id) {
        toast({title: "Error", description: "El evento no está seleccionado o no tiene ID.", variant: "destructive"});
        return;
    }
    if (!selectedPromoterForAssignment) {
        toast({title: "Error", description: "Selecciona un promotor.", variant:"destructive"});
        return;
    }
    const promoterProfile = mockBusinessPromoters.find(p => p.id === selectedPromoterForAssignment);
    if (!promoterProfile) {
        toast({title: "Error", description: "Promotor no encontrado.", variant:"destructive"});
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

    toast({title: "Promotor Asignado", description: `${promoterProfile.name} asignado a "${editingEvent.name}".`});
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
    toast({title: "Promotor Desvinculado", description: `El promotor ha sido desvinculado de este evento.`, variant: "destructive"});
  };

  const handleCreateBatchBoxes = (batchData: BatchBoxFormData) => {
    if (!editingEvent || !editingEvent.id) {
        toast({title: "Error", description: "El evento no está seleccionado o no tiene ID.", variant: "destructive"});
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
        businessId: editingEvent.businessId,
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
          <Calendar className="h-8 w-8 mr-2" /> Gestión de Eventos
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
                          <span className="sr-only">Gestionar</span>
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
                              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
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
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={es} initialFocus />
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
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={{ before: initialEventForm.getValues("startDate") }} locale={es} initialFocus />
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
      
      {editingEvent && (
      <Dialog open={showManageEventModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
            if (!showTicketFormInEventModal && !showBoxFormInEventModal && !showCreateBatchBoxesModal) { 
                 setEditingEvent(null); 
                 setIsDuplicating(false);
                 setShowManageEventModal(false); 
            }
        } else {
            setShowManageEventModal(true);
        }
      }}>
        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">
                {isDuplicating ? `Duplicar Evento: ${editingEvent?.name?.replace(' (Copia)','') || 'Nuevo Evento'}` : 
                (editingEvent?.id && events.some(e=>e.id === editingEvent.id && e.id !== '') ? `Gestionar Evento: ${editingEvent.name}` : "Configurar Evento Creado")}
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

            <TabsContent value="details" className="flex-grow overflow-y-auto p-1">
              <BusinessEventForm
                event={editingEvent} 
                onSubmit={handleMainEventFormSubmit} 
                onCancel={() => { /* Main cancel/submit is now on DialogFooter */ }}
                isSubmitting={isSubmitting} 
              />
            </TabsContent>

            <TabsContent value="tickets" className="flex-grow overflow-y-auto p-1 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Entradas del Evento</h3>
                    <Button onClick={() => { setEditingTicketInEventModal(null); setShowTicketFormInEventModal(true); }} className="bg-primary hover:bg-primary/90" disabled={isSubmitting || !editingEvent?.id}>
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
                                      <Button variant="ghost" size="icon" onClick={() => { setEditingTicketInEventModal(tt); setShowTicketFormInEventModal(true); }} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                                      <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar entrada?</AlertDialogTitle><AlertDialogDescription>Eliminar "{tt.name}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTicketTypeFromEvent(tt.id)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                      </AlertDialog>
                                    </TableCell>
                                </TableRow>))}
                        </TableBody>
                    </Table>
                ) : <p className="text-muted-foreground text-center py-4">No hay entradas definidas para este evento. Crea los detalles del evento primero si es nuevo.</p>}
            </TabsContent>

            <TabsContent value="boxes" className="flex-grow overflow-y-auto p-1 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Boxes del Evento</h3>
                    <div className="space-x-2">
                        <Button onClick={() => setShowCreateBatchBoxesModal(true)} variant="outline" disabled={isSubmitting || !editingEvent?.id}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Crear Boxes en Lote
                        </Button>
                        <Button onClick={() => { setEditingBoxInEventModal(null); setShowBoxFormInEventModal(true); }} className="bg-primary hover:bg-primary/90" disabled={isSubmitting || !editingEvent?.id}>
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
                                      <Button variant="ghost" size="icon" onClick={() => { setEditingBoxInEventModal(box); setShowBoxFormInEventModal(true);}} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                                      <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar box?</AlertDialogTitle><AlertDialogDescription>Eliminar "{box.name}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBoxFromEvent(box.id)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                      </AlertDialog>
                                    </TableCell>
                                </TableRow>))}
                        </TableBody>
                    </Table>
                ) : <p className="text-muted-foreground text-center py-4">No hay boxes definidos para este evento. Crea los detalles del evento primero si es nuevo.</p>}
            </TabsContent>

            <TabsContent value="promoters" className="flex-grow overflow-y-auto p-1 space-y-4">
                <h3 className="text-lg font-semibold">Asignar Promotores al Evento</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 border rounded-md">
                    <div className="space-y-1">
                        <Label htmlFor="promoter-select">Seleccionar Promotor</Label>
                        <Select value={selectedPromoterForAssignment} onValueChange={setSelectedPromoterForAssignment} disabled={isSubmitting || !editingEvent?.id}>
                            <SelectTrigger id="promoter-select"><SelectValue placeholder="Elige un promotor" /></SelectTrigger>
                            <SelectContent>
                                {mockBusinessPromoters.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.email})</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="promoter-commission">Comisión para este Evento (Opcional)</Label>
                        <Input id="promoter-commission" placeholder="Ej: 10% por entrada" value={promoterEventCommission} onChange={(e) => setPromoterEventCommission(e.target.value)} disabled={isSubmitting || !editingEvent?.id} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="promoter-notes">Notas (Opcional)</Label>
                        <Input id="promoter-notes" placeholder="Notas específicas para el promotor" value={promoterEventNotes} onChange={(e) => setPromoterEventNotes(e.target.value)} disabled={isSubmitting || !editingEvent?.id} />
                    </div>
                    <Button onClick={handleAssignPromoterToEvent} className="md:col-span-3 bg-primary hover:bg-primary/90" disabled={isSubmitting || !editingEvent?.id || !selectedPromoterForAssignment}>
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
                                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Desvincular Promotor?</AlertDialogTitle><AlertDialogDescription>Desvincular a {ap.promoterName} de este evento?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleUnassignPromoterFromEvent(ap.promoterProfileId)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>Desvincular</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ): <p className="text-muted-foreground text-center py-4">No hay promotores asignados a este evento.</p>}
            </TabsContent>

            <TabsContent value="stats" className="flex-grow overflow-y-auto p-1 space-y-4">
                <h3 className="text-lg font-semibold">Estadísticas del Evento</h3>
                <Card><CardContent className="p-4 space-y-2">
                    <p><strong>Códigos Generados (Total):</strong> {editingEvent.generatedCodes?.length || 0}</p>
                    <p><strong>Códigos Canjeados:</strong> {editingEvent.generatedCodes?.filter(c => c.status === 'redeemed').length || 0}</p>
                    <p><strong>Tasa de Canje:</strong> {editingEvent.generatedCodes?.length ? ((editingEvent.generatedCodes.filter(c => c.status === 'redeemed').length / editingEvent.generatedCodes.length) * 100).toFixed(2) : '0.00'}%</p>
                    <p><strong>Entradas Vendidas (Estimado):</strong> {(editingEvent.ticketTypes || []).reduce((acc, tt) => acc + (editingEvent.generatedCodes?.filter(gc => gc.status === 'redeemed' && gc.observation?.includes(tt.name)).length || 0) ,0)}</p>
                    <p><strong>Asistencia Estimada (Canjes):</strong> {editingEvent.generatedCodes?.filter(c => c.status === 'redeemed').length || 0}</p>
                    <p><strong>Aforo Máximo (Entradas):</strong> {editingEvent.maxAttendance}</p>

                    <p className="text-sm text-muted-foreground pt-2">Estas son estadísticas basadas en códigos canjeados y configuración de entradas. La vinculación exacta de código a tipo de entrada o promotor requeriría más detalle en la generación/canje de códigos.</p>
                </CardContent></Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4 border-t mt-auto shrink-0">
            <Button variant="outline" onClick={() => {setShowManageEventModal(false); setEditingEvent(null); setIsDuplicating(false);}} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleSaveManagedEventAndClose} className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || !editingEvent.id}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isDuplicating ? "Crear Evento Duplicado" : "Guardar Cambios y Cerrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {editingEvent && showTicketFormInEventModal && (
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
                      isSubmitting={isSubmitting} // This should probably be a different state for sub-forms
                  />
              </DialogContent>
          </Dialog>
      )}

      {editingEvent && showBoxFormInEventModal && (
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
                      isSubmitting={isSubmitting} // This should probably be a different state
                  />
              </DialogContent>
          </Dialog>
      )}

      {editingEvent && showCreateBatchBoxesModal && (
        <CreateBatchBoxesDialog
          open={showCreateBatchBoxesModal}
          onOpenChange={setShowCreateBatchBoxesModal}
          onSubmit={handleCreateBatchBoxes}
          // isSubmitting could be passed if the dialog form needs a loading state
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
                setTimeout(() => { // Timeout to allow state update of showManageCodesModal to false
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
