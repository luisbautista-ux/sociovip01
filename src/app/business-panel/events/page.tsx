

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Edit, Trash2, Search, Calendar, BadgeCheck, BadgeX, QrCode, ListChecks, Ticket as TicketIcon, Box, Copy, UserPlus, BarChartHorizontalSquare } from "lucide-react";
import type { BusinessManagedEntity, BusinessEventFormData, GeneratedCode, TicketType, EventBox, TicketTypeFormData, EventBoxFormData, PromoterProfile, EventPromoterAssignment, BatchBoxFormData } from "@/lib/types";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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


// Mock data for business events
let mockBusinessEvents: BusinessManagedEntity[] = [
  { 
    id: "evt1", 
    businessId: "biz1", 
    type: "event", 
    name: "Noche de Karaoke Estelar", 
    description: "Saca la estrella que llevas dentro. Premios para los mejores.", 
    termsAndConditions: "Consumo mínimo S/ 50.00 por persona. Mayores de 18 años.",
    startDate: "2025-08-15T12:00:00",
    endDate: "2025-08-15T12:00:00",
    maxAttendance: 100, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "karaoke night",
    generatedCodes: [
        { id: "codeEvt1-1", entityId: "evt1", value: "KARAOKE01", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-08-01T10:00:00Z", observation: "Invitado especial" },
        { id: "codeEvt1-2", entityId: "evt1", value: "KARAOKE02", status: "redeemed", generatedByName: "Admin Negocio", generatedDate: "2025-08-01T10:05:00Z", redemptionDate: "2025-08-15T20:00:00Z" },
    ],
    ticketTypes: [
      { id: "tt1-evt1", eventId:"evt1", businessId: "biz1", name: "Entrada General - Karaoke", cost: 50, description: "Acceso general al evento de Karaoke.", quantity: 80 },
      { id: "tt2-evt1", eventId:"evt1", businessId: "biz1", name: "Entrada VIP - Karaoke", cost: 150, description: "Acceso VIP + 1 bebida para Karaoke.", quantity: 20 },
    ],
    eventBoxes: [
      { id: "box1-evt1", eventId:"evt1", businessId: "biz1", name: "Box A1 (Escenario Karaoke)", cost: 800, description: "Para 8 personas, cerca al escenario.", status: 'available', capacity: 8, sellerName: "Ana Staff", ownerName: "Cliente VIP Juan", ownerDni:"12345670" },
    ],
    assignedPromoters: [
      { promoterProfileId: "pp1", promoterName: "Carlos Santana", promoterEmail: "carlos.santana@promo.com", commissionRate: "5% por entrada vendida vía su código", notes: "Foco en entradas VIP" }
    ]
  },
  { 
    id: "evt2", 
    businessId: "biz1", 
    type: "event", 
    name: "Fiesta Temática: Años 80", 
    description: "Revive la mejor década con música y ambiente ochentero.", 
    termsAndConditions: "Código de vestimenta: Ropa de los 80s.",
    startDate: "2025-09-20T12:00:00",
    endDate: "2025-09-20T12:00:00",
    maxAttendance: 200, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "80s party",
    generatedCodes: [],
    ticketTypes: [ { id: "tt3-evt2", eventId:"evt2", businessId: "biz1", name: "Entrada General - Fiesta 80s", cost: 70, description: "Acceso general a la Fiesta 80s.", quantity: 200 }],
    eventBoxes: [],
    assignedPromoters: []
  },
  { 
    id: "evt3", 
    businessId: "biz1", 
    type: "event", 
    name: "Taller de Coctelería Premium", 
    description: "Aprende a preparar cocktails como un profesional.", 
    termsAndConditions: "Cupos limitados. Incluye materiales.",
    startDate: "2025-10-05T12:00:00", 
    endDate: "2025-10-05T12:00:00", 
    maxAttendance: 30, 
    isActive: false, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "cocktail workshop",
    generatedCodes: [],
    ticketTypes: [],
    eventBoxes: [],
    assignedPromoters: []
  },
];

// Mock list of promoters available to this business (would typically come from /business-panel/promoters)
const mockBusinessPromoters: PromoterProfile[] = [
  { id: "pp1", name: "Carlos Santana", email: "carlos.santana@promo.com", phone: "+51911223344"},
  { id: "pp2", name: "Lucia Fernandez", email: "lucia.fernandez@promo.com", phone: "+51955667788"},
  { id: "pp3", name: "Pedro Pascal", email: "pedro.pascal@promo.com"},
];

const isEntityCurrentlyActivatable = (entity: BusinessManagedEntity): boolean => {
  if (!entity.isActive) {
    return false;
  }
  const now = new Date();
  const entityStartDateObj = new Date(entity.startDate);
  const entityEndDateObj = new Date(entity.endDate);

  if (isNaN(entityStartDateObj.getTime()) || isNaN(entityEndDateObj.getTime())) {
    return false; 
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Current date at 00:00:00
  const effectiveStartDate = new Date(entityStartDateObj.getFullYear(), entityStartDateObj.getMonth(), entityStartDateObj.getDate());
  const effectiveEndDate = new Date(entityEndDateObj.getFullYear(), entityEndDateObj.getMonth(), entityEndDateObj.getDate(), 23, 59, 59, 999); // End of day for end date
  
  return today >= effectiveStartDate && today <= effectiveEndDate;
};


export default function BusinessEventsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [events, setEvents] = useState<BusinessManagedEntity[]>(mockBusinessEvents);
  
  const [showManageEventModal, setShowManageEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BusinessManagedEntity | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const { toast } = useToast();

  // State for Ticket Management within the main Event Modal
  const [editingTicketInEventModal, setEditingTicketInEventModal] = useState<TicketType | null>(null);
  const [showTicketFormInEventModal, setShowTicketFormInEventModal] = useState(false);

  // State for Box Management within the main Event Modal
  const [editingBoxInEventModal, setEditingBoxInEventModal] = useState<EventBox | null>(null);
  const [showBoxFormInEventModal, setShowBoxFormInEventModal] = useState(false);
  const [showCreateBatchBoxesModal, setShowCreateBatchBoxesModal] = useState(false);
  
  // State for Promoter Assignment within the main Event Modal
  const [selectedPromoterForAssignment, setSelectedPromoterForAssignment] = useState<string>("");
  const [promoterEventCommission, setPromoterEventCommission] = useState("");
  const [promoterEventNotes, setPromoterEventNotes] = useState("");


  const filteredEvents = events.filter(event => {
    const nameMatch = event.name && typeof event.name === 'string' ? event.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const descriptionMatch = event.description && typeof event.description === 'string' ? event.description.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    return nameMatch || descriptionMatch;
  }).sort((a, b) => { 
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleOpenManageEventModal = (event: BusinessManagedEntity | null, duplicate = false) => {
    setIsDuplicating(duplicate);
    if (duplicate && event) {
        const newId = `evt${Date.now()}`;
        setEditingEvent({
            ...event,
            id: newId, 
            name: `${event.name} (Copia)`,
            generatedCodes: [], 
            ticketTypes: event.ticketTypes ? JSON.parse(JSON.stringify(event.ticketTypes.map(tt => ({...tt, id: `tt-${newId}-${Math.random().toString(36).substring(7)}`, eventId: newId })))) : [],
            eventBoxes: event.eventBoxes ? JSON.parse(JSON.stringify(event.eventBoxes.map(eb => ({...eb, id: `box-${newId}-${Math.random().toString(36).substring(7)}`, eventId: newId })))) : [],
            assignedPromoters: event.assignedPromoters ? JSON.parse(JSON.stringify(event.assignedPromoters)) : [] 
        });
    } else if (event) { // Editing existing event
        setEditingEvent({...event, 
          ticketTypes: event.ticketTypes ? [...event.ticketTypes] : [], 
          eventBoxes: event.eventBoxes ? [...event.eventBoxes] : [],
          assignedPromoters: event.assignedPromoters ? [...event.assignedPromoters] : [],
          generatedCodes: event.generatedCodes ? [...event.generatedCodes] : [],
        });
    }
     else { // For a NEW event (event is null)
        const newEventScaffold: BusinessManagedEntity = {
            id: '', 
            businessId: "biz1", 
            type: "event",
            name: "", 
            description: "",
            termsAndConditions: "",
            startDate: new Date().toISOString(),
            endDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
            isActive: true,
            maxAttendance: 0,
            imageUrl: "",
            aiHint: "",
            generatedCodes: [],
            ticketTypes: [],
            eventBoxes: [],
            assignedPromoters: []
        };
        setEditingEvent(newEventScaffold);
        setIsDuplicating(false);
    }
    setShowManageEventModal(true);
  };
  

  const handleMainEventFormSubmit = (data: BusinessEventFormData) => {
      if (editingEvent && showManageEventModal) { 
        const updatedEventDetails: Partial<BusinessManagedEntity> = {
            name: data.name,
            description: data.description,
            termsAndConditions: data.termsAndConditions,
            startDate: format(data.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
            endDate: format(data.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
            maxAttendance: data.maxAttendance === undefined || data.maxAttendance === null || data.maxAttendance < 0 ? 0 : data.maxAttendance,
            isActive: data.isActive,
            imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : editingEvent.imageUrl || `https://placehold.co/300x200.png`),
            aiHint: data.aiHint,
        };

        if (!editingEvent.id) { 
            const newEventId = `evt${Date.now()}`;
            setEditingEvent(prev => prev ? ({ 
                ...prev, 
                ...updatedEventDetails,
                id: newEventId, 
                businessId: prev.businessId || "biz1", 
                type: prev.type || "event", 
             }) : null);
            toast({ title: "Evento Configurado", description: `Los detalles de "${data.name}" están listos. Continúa en las otras pestañas si es necesario.` });
        } else { 
             setEditingEvent(prev => prev ? ({ 
                ...prev, 
                ...updatedEventDetails 
            }) : null);
            toast({ title: "Detalles del Evento Actualizados", description: `Los detalles de "${data.name}" han sido actualizados.` });
        }
    }
  };
  
  const handleDeleteEvent = (eventId: string) => {
    setEvents(prev => prev.filter(p => p.id !== eventId));
    toast({ title: "Evento Eliminado", description: `El evento ha sido eliminado.`, variant: "destructive" });
  };

  const handleSaveManagedEventAndClose = () => {
    if (!editingEvent) return;

    if (!editingEvent.id || !editingEvent.name) {
        toast({
            title: "Faltan Detalles del Evento",
            description: "Por favor, completa y guarda los detalles básicos del evento en la pestaña 'Detalles del Evento' primero.",
            variant: "destructive"
        });
        return;
    }

    const eventExists = events.some(e => e.id === editingEvent.id);

    if (isDuplicating || !eventExists) { 
      setEvents(prev => [editingEvent, ...prev.filter(e => e.id !== editingEvent.id)]);
      toast({ title: isDuplicating ? "Evento Duplicado y Guardado" : "Evento Creado y Guardado", description: `El evento "${editingEvent.name}" ha sido ${isDuplicating ? 'duplicado y guardado' : 'guardado'}.` });
    } else { 
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? editingEvent : e));
      toast({ title: "Evento Guardado", description: `Los cambios en "${editingEvent.name}" han sido guardados.` });
    }
    setShowManageEventModal(false);
    setEditingEvent(null);
    setIsDuplicating(false);
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
    const updateLogic = (prevEvent: BusinessManagedEntity | null) => {
        if (!prevEvent || prevEvent.id !== entityId) return prevEvent;
        const updatedCodes = [...(prevEvent.generatedCodes || []), ...newCodes];
        return { ...prevEvent, generatedCodes: updatedCodes };
    };

    if (editingEvent && editingEvent.id === entityId) {
        setEditingEvent(prev => updateLogic(prev));
    }
    setEvents(prevEvents => prevEvents.map(event => event.id === entityId ? updateLogic(event) as BusinessManagedEntity : event));
  };

  const handleCodesUpdatedFromManageDialog = (entityId: string, updatedCodes: GeneratedCode[]) => {
     const updateLogic = (prevEvent: BusinessManagedEntity | null) => {
        if (!prevEvent || prevEvent.id !== entityId) return prevEvent;
        return { ...prevEvent, generatedCodes: updatedCodes };
    };
    
    if (editingEvent && editingEvent.id === entityId) {
        setEditingEvent(prev => updateLogic(prev));
    }
    setEvents(prevEvents => prevEvents.map(event => event.id === entityId ? updateLogic(event) as BusinessManagedEntity : event));
  };

  const getAttendanceCount = (event: BusinessManagedEntity) => {
    const redeemedCount = event.generatedCodes?.filter(c => c.status === 'redeemed').length || 0;
    return `${redeemedCount} / ${event.maxAttendance === 0 || !event.maxAttendance ? '∞' : event.maxAttendance}`;
  };

 const handleToggleEventStatus = (eventId: string) => {
    let eventNameForToast = "";
    let newStatusForToast = false;

    const updateStatusInEvent = (eventToUpdate: BusinessManagedEntity | null): BusinessManagedEntity | null => {
      if (!eventToUpdate || eventToUpdate.id !== eventId) return eventToUpdate;
      eventNameForToast = eventToUpdate.name;
      newStatusForToast = !eventToUpdate.isActive;
      return { ...eventToUpdate, isActive: !eventToUpdate.isActive };
    };
    
    setEvents(prevEvents =>
      prevEvents.map(event =>
        event.id === eventId ? updateStatusInEvent(event) as BusinessManagedEntity : event
      )
    );
    
    if (editingEvent && editingEvent.id === eventId) {
      setEditingEvent(prev => updateStatusInEvent(prev));
    }
    
    if (eventNameForToast) {
       setTimeout(() => {
        toast({
            title: "Estado Actualizado",
            description: `El evento "${eventNameForToast}" ahora está ${newStatusForToast ? "Activo" : "Inactivo"}.`
        });
      }, 0);
    }
  };


  // CRUD for Ticket Types within an Event (inside Manage Event Modal)
  const handleCreateOrEditTicketTypeForEvent = (data: TicketTypeFormData) => {
    if (!editingEvent) return;

    const eventId = editingEvent.id;
    let updatedTicketTypes: TicketType[];

    if (editingTicketInEventModal) { // Editing
      updatedTicketTypes = (editingEvent.ticketTypes || []).map(tt =>
        tt.id === editingTicketInEventModal.id ? { ...editingTicketInEventModal, ...data, eventId, businessId: editingEvent.businessId } : tt
      );
      toast({ title: "Entrada Actualizada", description: `La entrada "${data.name}" ha sido actualizada.` });
    } else { // Creating
      const newTicketType: TicketType = {
        id: `tt-${eventId}-${Date.now()}`,
        businessId: editingEvent.businessId, 
        eventId,
        ...data,
      };
      updatedTicketTypes = [...(editingEvent.ticketTypes || []), newTicketType];
      toast({ title: "Entrada Creada", description: `La entrada "${newTicketType.name}" ha sido creada.` });
    }
    
    setEditingEvent(prev => prev ? {...prev, ticketTypes: updatedTicketTypes} : null);
    setShowTicketFormInEventModal(false);
    setEditingTicketInEventModal(null);
  };

  const handleDeleteTicketTypeFromEvent = (ticketTypeId: string) => {
     if (!editingEvent) return;
     const updatedTicketTypes = (editingEvent.ticketTypes || []).filter(tt => tt.id !== ticketTypeId);
     setEditingEvent(prev => prev ? {...prev, ticketTypes: updatedTicketTypes} : null);
     toast({ title: "Entrada Eliminada", variant: "destructive" });
  };

  // CRUD for Event Boxes within an Event (inside Manage Event Modal)
  const handleCreateOrEditBoxForEvent = (data: EventBoxFormData) => {
    if (!editingEvent) return;
    const eventId = editingEvent.id;
    let updatedEventBoxes: EventBox[];

    if (editingBoxInEventModal) { // Editing
        updatedEventBoxes = (editingEvent.eventBoxes || []).map(box => 
            box.id === editingBoxInEventModal.id ? {...editingBoxInEventModal, ...data, eventId, businessId: editingEvent.businessId} : box
        );
        toast({ title: "Box Actualizado", description: `El box "${data.name}" ha sido actualizado.` });
    } else { // Creating
        const newBox: EventBox = {
            id: `box-${eventId}-${Date.now()}`,
            businessId: editingEvent.businessId,
            eventId,
            ...data,
        };
        updatedEventBoxes = [...(editingEvent.eventBoxes || []), newBox];
        toast({ title: "Box Creado", description: `El box "${newBox.name}" ha sido creado.` });
    }
    setEditingEvent(prev => prev ? {...prev, eventBoxes: updatedEventBoxes} : null);
    setShowBoxFormInEventModal(false);
    setEditingBoxInEventModal(null);
  };

  const handleDeleteBoxFromEvent = (boxId: string) => {
    if (!editingEvent) return;
    const updatedEventBoxes = (editingEvent.eventBoxes || []).filter(box => box.id !== boxId);
    setEditingEvent(prev => prev ? {...prev, eventBoxes: updatedEventBoxes} : null);
    toast({ title: "Box Eliminado", variant: "destructive" });
  };

  // Promoter Assignment Logic (inside Manage Event Modal)
  const handleAssignPromoterToEvent = () => {
    if (!editingEvent || !selectedPromoterForAssignment) {
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
    if (!editingEvent) return;

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
      description: `${newBoxesForBatch.length} boxes han sido creados y añadidos al evento.`,
    });
    setShowCreateBatchBoxesModal(false);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Calendar className="h-8 w-8 mr-2" /> Gestión de Eventos
        </h1>
        <Button onClick={() => handleOpenManageEventModal(null)} className="bg-primary hover:bg-primary/90">
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
            />
          </div>
        </CardHeader>
        <CardContent>
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
                      {format(new Date(event.startDate), "P", { locale: es })} - {format(new Date(event.endDate), "P", { locale: es })}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-center">{getAttendanceCount(event)}</TableCell>
                    <TableCell className="text-center">
                        <div className="flex items-center justify-center space-x-2">
                            <Switch
                                checked={event.isActive}
                                onCheckedChange={() => handleToggleEventStatus(event.id)}
                                aria-label={`Estado del evento ${event.name}`}
                                id={`status-switch-${event.id}`}
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
                      <Button variant="default" size="xs" onClick={() => openCreateCodesDialog(event)} disabled={!isEntityCurrentlyActivatable(event)}>
                        <QrCode className="h-3 w-3 mr-1" /> Crear
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => openViewCodesDialog(event)}>
                        <ListChecks className="h-3 w-3 mr-1" /> Ver ({event.generatedCodes?.length || 0})
                      </Button>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                       <Button variant="ghost" size="icon" title="Duplicar Evento" onClick={() => handleOpenManageEventModal(event, true)}>
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Duplicar</span>
                      </Button>
                      <Button variant="ghost" size="icon" title="Gestionar Evento" onClick={() => handleOpenManageEventModal(event)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Gestionar</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Eliminar Evento" className="text-destructive hover:text-destructive">
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
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteEvent(event.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
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
                  <TableCell colSpan={6} className="text-center h-24">No se encontraron eventos.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Comprehensive Manage Event Modal */}
      {editingEvent && (
      <Dialog open={showManageEventModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
            setEditingEvent(null); 
            setIsDuplicating(false);
        }
        setShowManageEventModal(isOpen);
      }}>
        <DialogContent className="sm:max-w-4xl h-[90vh]"> {/* Increased max-width and height */}
          <DialogHeader>
            <DialogTitle className="text-2xl">
                {isDuplicating ? `Duplicar Evento: ${editingEvent?.name?.replace(' (Copia)','')}` : 
                (editingEvent?.id && events.some(e=>e.id === editingEvent.id && e.id !== '') ? `Gestionar Evento: ${editingEvent.name}` : "Crear Nuevo Evento")}
            </DialogTitle>
            <DialogDescription>
                 {isDuplicating ? `Creando una copia. Ajusta los detalles necesarios.` : "Administra todos los aspectos de tu evento desde las pestañas."}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-grow flex flex-col overflow-hidden">
            <TabsList className="mb-4">
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
                onCancel={() => {setShowManageEventModal(false); setEditingEvent(null); setIsDuplicating(false);}}
              />
            </TabsContent>

            <TabsContent value="tickets" className="flex-grow overflow-y-auto p-1 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Entradas del Evento</h3>
                    <Button onClick={() => { setEditingTicketInEventModal(null); setShowTicketFormInEventModal(true); }} className="bg-primary hover:bg-primary/90">
                        <PlusCircle className="mr-2 h-4 w-4" /> Crear Nueva Entrada
                    </Button>
                </div>
                {(editingEvent.ticketTypes?.length || 0) > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Costo (S/)</TableHead><TableHead>Descripción</TableHead><TableHead>Cantidad</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {editingEvent.ticketTypes?.map((tt) => (
                                <TableRow key={tt.id}>
                                    <TableCell>{tt.name}</TableCell><TableCell>{tt.cost.toFixed(2)}</TableCell><TableCell>{tt.description || "N/A"}</TableCell><TableCell>{tt.quantity === undefined || tt.quantity === null ? 'Ilimitada' : tt.quantity}</TableCell>
                                    <TableCell className="text-right">
                                      <Button variant="ghost" size="icon" onClick={() => { setEditingTicketInEventModal(tt); setShowTicketFormInEventModal(true); }}><Edit className="h-4 w-4" /></Button>
                                      <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar entrada?</AlertDialogTitle><AlertDialogDescription>Eliminar "{tt.name}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTicketTypeFromEvent(tt.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                      </AlertDialog>
                                    </TableCell>
                                </TableRow>))}
                        </TableBody>
                    </Table>
                ) : <p className="text-muted-foreground text-center py-4">No hay entradas definidas para este evento.</p>}
            </TabsContent>

            <TabsContent value="boxes" className="flex-grow overflow-y-auto p-1 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Boxes del Evento</h3>
                    <div className="space-x-2">
                        <Button onClick={() => setShowCreateBatchBoxesModal(true)} variant="outline">
                            <PlusCircle className="mr-2 h-4 w-4" /> Crear Boxes en Lote
                        </Button>
                        <Button onClick={() => { setEditingBoxInEventModal(null); setShowBoxFormInEventModal(true); }} className="bg-primary hover:bg-primary/90">
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
                                      <Button variant="ghost" size="icon" onClick={() => { setEditingBoxInEventModal(box); setShowBoxFormInEventModal(true);}}><Edit className="h-4 w-4" /></Button>
                                      <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar box?</AlertDialogTitle><AlertDialogDescription>Eliminar "{box.name}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBoxFromEvent(box.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                      </AlertDialog>
                                    </TableCell>
                                </TableRow>))}
                        </TableBody>
                    </Table>
                ) : <p className="text-muted-foreground text-center py-4">No hay boxes definidos para este evento.</p>}
            </TabsContent>

            <TabsContent value="promoters" className="flex-grow overflow-y-auto p-1 space-y-4">
                <h3 className="text-lg font-semibold">Asignar Promotores al Evento</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 border rounded-md">
                    <div className="space-y-1">
                        <Label htmlFor="promoter-select">Seleccionar Promotor</Label>
                        <Select value={selectedPromoterForAssignment} onValueChange={setSelectedPromoterForAssignment}>
                            <SelectTrigger id="promoter-select"><SelectValue placeholder="Elige un promotor" /></SelectTrigger>
                            <SelectContent>
                                {mockBusinessPromoters.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.email})</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="promoter-commission">Comisión para este Evento (Opcional)</Label>
                        <Input id="promoter-commission" placeholder="Ej: 10% por entrada" value={promoterEventCommission} onChange={(e) => setPromoterEventCommission(e.target.value)} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="promoter-notes">Notas (Opcional)</Label>
                        <Input id="promoter-notes" placeholder="Notas específicas para el promotor" value={promoterEventNotes} onChange={(e) => setPromoterEventNotes(e.target.value)} />
                    </div>
                    <Button onClick={handleAssignPromoterToEvent} className="md:col-span-3 bg-primary hover:bg-primary/90">
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
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="link" size="sm" className="text-destructive hover:text-destructive">Desvincular</Button></AlertDialogTrigger>
                                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Desvincular Promotor?</AlertDialogTitle><AlertDialogDescription>Desvincular a {ap.promoterName} de este evento?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleUnassignPromoterFromEvent(ap.promoterProfileId)} className="bg-destructive hover:bg-destructive/90">Desvincular</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ): <p className="text-muted-foreground text-center py-4">No hay promotores asignados a este evento.</p>}
            </TabsContent>

            <TabsContent value="stats" className="flex-grow overflow-y-auto p-1 space-y-4">
                <h3 className="text-lg font-semibold">Estadísticas del Evento (Mock)</h3>
                <Card><CardContent className="p-4 space-y-2">
                    <p><strong>Códigos Generados (Total):</strong> {editingEvent.generatedCodes?.length || 0}</p>
                    <p><strong>Códigos Canjeados:</strong> {editingEvent.generatedCodes?.filter(c => c.status === 'redeemed').length || 0}</p>
                    <p><strong>Tasa de Canje:</strong> {editingEvent.generatedCodes?.length ? ((editingEvent.generatedCodes.filter(c => c.status === 'redeemed').length / editingEvent.generatedCodes.length) * 100).toFixed(2) : '0.00'}%</p>
                    <p><strong>Entradas Vendidas (Mock):</strong> General (50), VIP (10) - <i>Se calcularía a partir de códigos canjeados asociados a tipos de entrada.</i></p>
                    <p><strong>Boxes Ocupados (Mock):</strong> Box A1 - <i>Se determinaría por el estado 'ownerName' del box.</i></p>
                    <p><strong>Top Promotores (Códigos Canjeados de este Evento - Mock):</strong> Ana (15 canjes), Pedro (10 canjes) - <i>Se calcularía analizando `generatedByName` en códigos canjeados y cruzando con `assignedPromoters`.</i></p>
                    <p className="text-sm text-muted-foreground pt-2">Estas son estadísticas de ejemplo. La implementación real requeriría lógica de agregación de datos.</p>
                </CardContent></Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4 border-t mt-auto"> {/* Ensure footer is at the bottom */}
            <Button variant="outline" onClick={() => {setShowManageEventModal(false); setEditingEvent(null); setIsDuplicating(false);}}>Cancelar</Button>
            <Button onClick={handleSaveManagedEventAndClose} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isDuplicating ? "Crear Evento Duplicado" : (editingEvent?.id && events.some(e=>e.id === editingEvent.id && e.id !== '') ? "Guardar Cambios y Cerrar" : "Guardar Evento y Cerrar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}


      {/* Sub-Modal for TicketTypeForm (inside Manage Event Modal) */}
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
                  />
              </DialogContent>
          </Dialog>
      )}

      {/* Sub-Modal for EventBoxForm (inside Manage Event Modal) */}
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
                  />
              </DialogContent>
          </Dialog>
      )}

      {/* Sub-Modal for BatchBoxForm (inside Manage Event Modal) */}
      {editingEvent && showCreateBatchBoxesModal && (
        <CreateBatchBoxesDialog
          open={showCreateBatchBoxesModal}
          onOpenChange={setShowCreateBatchBoxesModal}
          onSubmit={handleCreateBatchBoxes}
        />
      )}


      {/* Create Codes Modal (for selected event from main list) */}
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

      {/* Manage Codes Modal (for selected event from main list) */}
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
            const currentEntity = selectedEntityForViewingCodes; 
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

