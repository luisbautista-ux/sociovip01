
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Search, Calendar, BadgeCheck, BadgeX, QrCode, ListChecks, Ticket as TicketIcon, Box, Copy, Ticket } from "lucide-react"; // Added Copy, Ticket
import type { BusinessManagedEntity, BusinessEventFormData, GeneratedCode, TicketType, EventBox, TicketTypeFormData, EventBoxFormData } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessEventForm } from "@/components/business/forms/BusinessEventForm";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { TicketTypeForm } from "@/components/business/forms/TicketTypeForm";
import { EventBoxForm } from "@/components/business/forms/EventBoxForm";

// Mock data for business events
let mockBusinessEvents: BusinessManagedEntity[] = [
  { 
    id: "evt1", 
    businessId: "biz1", 
    type: "event", 
    name: "Noche de Karaoke Estelar", 
    description: "Saca la estrella que llevas dentro. Premios para los mejores.", 
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
    ]
  },
  { 
    id: "evt2", 
    businessId: "biz1", 
    type: "event", 
    name: "Fiesta Temática: Años 80", 
    description: "Revive la mejor década con música y ambiente ochentero.", 
    startDate: "2025-09-20T12:00:00",
    endDate: "2025-09-20T12:00:00",
    maxAttendance: 200, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "80s party",
    generatedCodes: [],
    ticketTypes: [ { id: "tt3-evt2", eventId:"evt2", businessId: "biz1", name: "Entrada General - Fiesta 80s", cost: 70, description: "Acceso general a la Fiesta 80s.", quantity: 200 }],
    eventBoxes: []
  },
  { 
    id: "evt3", 
    businessId: "biz1", 
    type: "event", 
    name: "Taller de Coctelería Premium", 
    description: "Aprende a preparar cocktails como un profesional.", 
    startDate: "2024-10-05T12:00:00", 
    endDate: "2024-10-05T12:00:00", 
    maxAttendance: 30, 
    isActive: false, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "cocktail workshop",
    generatedCodes: [],
    ticketTypes: [],
    eventBoxes: []
  },
];


export default function BusinessEventsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateEditEventModal, setShowCreateEditEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BusinessManagedEntity | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [events, setEvents] = useState<BusinessManagedEntity[]>(mockBusinessEvents);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const { toast } = useToast();

  // States for managing tickets for a specific event
  const [selectedEventForTicketManagement, setSelectedEventForTicketManagement] = useState<BusinessManagedEntity | null>(null);
  const [showTicketManagementModal, setShowTicketManagementModal] = useState(false);
  const [editingTicketInEventModal, setEditingTicketInEventModal] = useState<TicketType | null>(null);
  const [showTicketFormInEventModal, setShowTicketFormInEventModal] = useState(false);

  // States for managing boxes for a specific event
  const [selectedEventForBoxManagement, setSelectedEventForBoxManagement] = useState<BusinessManagedEntity | null>(null);
  const [showBoxManagementModal, setShowBoxManagementModal] = useState(false);
  const [editingBoxInEventModal, setEditingBoxInEventModal] = useState<EventBox | null>(null);
  const [showBoxFormInEventModal, setShowBoxFormInEventModal] = useState(false);

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateOrEditEvent = (data: BusinessEventFormData) => {
    if (editingEvent && !isDuplicating) { // Editing existing event
      const updatedEvent: BusinessManagedEntity = {
        ...editingEvent,
        name: data.name,
        description: data.description,
        startDate: format(data.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(data.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
        maxAttendance: data.maxAttendance || 0,
        isActive: data.isActive,
        imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : editingEvent.imageUrl || `https://placehold.co/300x200.png`),
        aiHint: data.aiHint,
      };
      setEvents(prev => prev.map(p => p.id === editingEvent.id ? updatedEvent : p));
      toast({ title: "Evento Actualizado", description: `El evento "${updatedEvent.name}" ha sido actualizado.` });
    } else { // Creating new event (or duplicating)
      const newEvent: BusinessManagedEntity = {
        id: `evt${Date.now()}`,
        businessId: "biz1", 
        type: "event",
        name: data.name,
        description: data.description,
        startDate: format(data.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(data.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
        maxAttendance: data.maxAttendance || 0, 
        isActive: data.isActive,
        imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : `https://placehold.co/300x200.png`),
        aiHint: data.aiHint,
        generatedCodes: [], // Duplicated event starts with no codes
        ticketTypes: isDuplicating && editingEvent?.ticketTypes ? JSON.parse(JSON.stringify(editingEvent.ticketTypes.map(tt => ({...tt, id: `tt${Date.now()}-${Math.random().toString(36).substring(7)}`})))) : [], // Deep copy tickets with new IDs
        eventBoxes: isDuplicating && editingEvent?.eventBoxes ? JSON.parse(JSON.stringify(editingEvent.eventBoxes.map(eb => ({...eb, id: `box${Date.now()}-${Math.random().toString(36).substring(7)}`})))) : [], // Deep copy boxes with new IDs
      };
      setEvents(prev => [newEvent, ...prev]);
      toast({ title: isDuplicating ? "Evento Duplicado" : "Evento Creado", description: `El evento "${newEvent.name}" ha sido ${isDuplicating ? 'duplicado' : 'creado'}.` });
    }
    setShowCreateEditEventModal(false);
    setEditingEvent(null);
    setIsDuplicating(false);
  };
  
  const handleDeleteEvent = (eventId: string) => {
    setEvents(prev => prev.filter(p => p.id !== eventId));
    toast({ title: "Evento Eliminado", description: `El evento ha sido eliminado.`, variant: "destructive" });
  };

  const handleDuplicateEvent = (eventToDuplicate: BusinessManagedEntity) => {
    setIsDuplicating(true);
    setEditingEvent({ // Temporarily set editingEvent to prefill form for duplication
        ...eventToDuplicate,
        name: `${eventToDuplicate.name} (Copia)`, // Suggest a new name
        // Dates could be shifted here if desired, e.g., by one week
        // For now, they are copied as-is, user can edit.
    });
    setShowCreateEditEventModal(true);
  };

  const openCreateCodesDialog = (event: BusinessManagedEntity) => {
    setSelectedEntityForCreatingCodes(event);
    setShowCreateCodesModal(true);
  };

  const openViewCodesDialog = (event: BusinessManagedEntity) => {
    setSelectedEntityForViewingCodes(event);
    setShowManageCodesModal(true);
  };
  
  const handleNewCodesCreated = (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    setEvents(prevEvents => prevEvents.map(event => {
      if (event.id === entityId) {
        const updatedCodes = [...(event.generatedCodes || []), ...newCodes];
        return { ...event, generatedCodes: updatedCodes };
      }
      return event;
    }));
  };

  const handleCodesUpdatedFromManageDialog = (entityId: string, updatedCodes: GeneratedCode[]) => {
    setEvents(prevEvents => prevEvents.map(event => 
      event.id === entityId ? { ...event, generatedCodes: updatedCodes } : event
    ));
  };

  const getAttendanceCount = (event: BusinessManagedEntity) => {
    const redeemedCount = event.generatedCodes?.filter(c => c.status === 'redeemed').length || 0;
    return `${redeemedCount} / ${event.maxAttendance === 0 || !event.maxAttendance ? '∞' : event.maxAttendance}`;
  };


  // CRUD for Ticket Types within an Event
  const openTicketManagement = (event: BusinessManagedEntity) => {
    setSelectedEventForTicketManagement(event);
    setShowTicketManagementModal(true);
  };

  const handleCreateOrEditTicketTypeForEvent = (data: TicketTypeFormData) => {
    if (!selectedEventForTicketManagement) return;

    const eventId = selectedEventForTicketManagement.id;
    let updatedTicketTypes: TicketType[];

    if (editingTicketInEventModal) { // Editing
      updatedTicketTypes = (selectedEventForTicketManagement.ticketTypes || []).map(tt =>
        tt.id === editingTicketInEventModal.id ? { ...editingTicketInEventModal, ...data, eventId } : tt
      );
      toast({ title: "Entrada Actualizada", description: `La entrada "${data.name}" ha sido actualizada.` });
    } else { // Creating
      const newTicketType: TicketType = {
        id: `tt-${eventId}-${Date.now()}`,
        businessId: "biz1", // Assuming current business
        eventId,
        ...data,
      };
      updatedTicketTypes = [...(selectedEventForTicketManagement.ticketTypes || []), newTicketType];
      toast({ title: "Entrada Creada", description: `La entrada "${newTicketType.name}" ha sido creada.` });
    }
    
    setEvents(prevEvents => prevEvents.map(ev => 
        ev.id === eventId ? { ...ev, ticketTypes: updatedTicketTypes } : ev
    ));
    // Update selectedEventForTicketManagement to reflect changes if modal stays open
    setSelectedEventForTicketManagement(prev => prev ? {...prev, ticketTypes: updatedTicketTypes} : null);

    setShowTicketFormInEventModal(false);
    setEditingTicketInEventModal(null);
  };

  const handleDeleteTicketTypeFromEvent = (ticketTypeId: string) => {
     if (!selectedEventForTicketManagement) return;
     const updatedTicketTypes = (selectedEventForTicketManagement.ticketTypes || []).filter(tt => tt.id !== ticketTypeId);
     setEvents(prevEvents => prevEvents.map(ev => 
        ev.id === selectedEventForTicketManagement.id ? { ...ev, ticketTypes: updatedTicketTypes } : ev
    ));
    setSelectedEventForTicketManagement(prev => prev ? {...prev, ticketTypes: updatedTicketTypes} : null);
    toast({ title: "Entrada Eliminada", variant: "destructive" });
  };

  // CRUD for Event Boxes within an Event
  const openBoxManagement = (event: BusinessManagedEntity) => {
    setSelectedEventForBoxManagement(event);
    setShowBoxManagementModal(true);
  };

  const handleCreateOrEditBoxForEvent = (data: EventBoxFormData) => {
    if (!selectedEventForBoxManagement) return;
    const eventId = selectedEventForBoxManagement.id;
    let updatedEventBoxes: EventBox[];

    if (editingBoxInEventModal) { // Editing
        updatedEventBoxes = (selectedEventForBoxManagement.eventBoxes || []).map(box => 
            box.id === editingBoxInEventModal.id ? {...editingBoxInEventModal, ...data, eventId} : box
        );
        toast({ title: "Box Actualizado", description: `El box "${data.name}" ha sido actualizado.` });
    } else { // Creating
        const newBox: EventBox = {
            id: `box-${eventId}-${Date.now()}`,
            businessId: "biz1",
            eventId,
            ...data,
        };
        updatedEventBoxes = [...(selectedEventForBoxManagement.eventBoxes || []), newBox];
        toast({ title: "Box Creado", description: `El box "${newBox.name}" ha sido creado.` });
    }
    setEvents(prevEvents => prevEvents.map(ev => 
        ev.id === eventId ? { ...ev, eventBoxes: updatedEventBoxes } : ev
    ));
    setSelectedEventForBoxManagement(prev => prev ? {...prev, eventBoxes: updatedEventBoxes} : null);
    setShowBoxFormInEventModal(false);
    setEditingBoxInEventModal(null);
  };

  const handleDeleteBoxFromEvent = (boxId: string) => {
    if (!selectedEventForBoxManagement) return;
    const updatedEventBoxes = (selectedEventForBoxManagement.eventBoxes || []).filter(box => box.id !== boxId);
     setEvents(prevEvents => prevEvents.map(ev => 
        ev.id === selectedEventForBoxManagement.id ? { ...ev, eventBoxes: updatedEventBoxes } : ev
    ));
    setSelectedEventForBoxManagement(prev => prev ? {...prev, eventBoxes: updatedEventBoxes} : null);
    toast({ title: "Box Eliminado", variant: "destructive" });
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Calendar className="h-8 w-8 mr-2" /> Gestión de Eventos
        </h1>
        <Button onClick={() => {setEditingEvent(null); setIsDuplicating(false); setShowCreateEditEventModal(true);}} className="bg-primary hover:bg-primary/90">
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
                <TableHead>Estado</TableHead>
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
                    <TableCell>
                      <Badge variant={event.isActive ? "default" : "outline"} className={event.isActive ? "bg-green-500 hover:bg-green-600" : ""}>
                        {event.isActive ? <BadgeCheck className="mr-1 h-3 w-3"/> : <BadgeX className="mr-1 h-3 w-3"/>}
                        {event.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="xs" className="text-xs" onClick={() => openTicketManagement(event)}>
                        <TicketIcon className="h-3 w-3 mr-1"/> Entradas ({event.ticketTypes?.length || 0})
                      </Button>
                      <Button variant="outline" size="xs" className="text-xs" onClick={() => openBoxManagement(event)}>
                        <Box className="h-3 w-3 mr-1"/> Boxes ({event.eventBoxes?.length || 0})
                      </Button>
                      <Button variant="default" size="xs" onClick={() => openCreateCodesDialog(event)}>
                        <QrCode className="h-3 w-3 mr-1" /> Crear Códigos
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => openViewCodesDialog(event)}>
                        <ListChecks className="h-3 w-3 mr-1" /> Ver Códigos ({event.generatedCodes?.length || 0})
                      </Button>
                       <Button variant="ghost" size="icon" title="Duplicar Evento" onClick={() => handleDuplicateEvent(event)}>
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Duplicar</span>
                      </Button>
                      <Button variant="ghost" size="icon" title="Editar Evento" onClick={() => {setIsDuplicating(false); setEditingEvent(event); setShowCreateEditEventModal(true);}}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
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
                  <TableCell colSpan={5} className="text-center h-24">No se encontraron eventos.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Event Create/Edit Modal */}
      <Dialog open={showCreateEditEventModal} onOpenChange={(isOpen) => {
        setShowCreateEditEventModal(isOpen);
        if (!isOpen) {
            setEditingEvent(null); // Clear editing/duplicating state when dialog closes
            setIsDuplicating(false);
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isDuplicating ? "Duplicar Evento" : (editingEvent ? "Editar Evento" : "Crear Nuevo Evento")}</DialogTitle>
            <DialogDescription>
                 {isDuplicating ? `Creando una copia de "${editingEvent?.name?.replace(' (Copia)','')}". Ajusta los detalles necesarios.` : (editingEvent ? `Actualiza los detalles de "${editingEvent.name}".` : "Completa los detalles para tu nuevo evento.")}
            </DialogDescription>
          </DialogHeader>
          <BusinessEventForm
            event={editingEvent || undefined} // Pass the original event data for duplication prefill
            onSubmit={handleCreateOrEditEvent} 
            onCancel={() => { setShowCreateEditEventModal(false); setEditingEvent(null); setIsDuplicating(false);}} 
          />
        </DialogContent>
      </Dialog>

      {/* Create Codes Modal (for selected event) */}
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

      {/* Manage Codes Modal (for selected event) */}
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
            setShowManageCodesModal(false);
             if(selectedEntityForViewingCodes) {
                setTimeout(() => openCreateCodesDialog(selectedEntityForViewingCodes), 0);
            }
          }}
        />
      )}

    {/* Ticket Management Modal for a Specific Event */}
    {selectedEventForTicketManagement && (
        <Dialog open={showTicketManagementModal} onOpenChange={(isOpen) => {
            setShowTicketManagementModal(isOpen);
            if (!isOpen) setSelectedEventForTicketManagement(null);
        }}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Gestionar Entradas para: {selectedEventForTicketManagement.name}</DialogTitle>
                    <DialogDescription>Añade, edita o elimina los tipos de entrada para este evento.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <Button onClick={() => { setEditingTicketInEventModal(null); setShowTicketFormInEventModal(true); }} className="bg-primary hover:bg-primary/90">
                        <PlusCircle className="mr-2 h-4 w-4" /> Crear Nueva Entrada
                    </Button>
                    {(selectedEventForTicketManagement.ticketTypes?.length || 0) > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead className="text-right">Costo (S/)</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-center">Cantidad</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedEventForTicketManagement.ticketTypes?.map((tt) => (
                                    <TableRow key={tt.id}>
                                        <TableCell className="font-medium">{tt.name}</TableCell>
                                        <TableCell className="text-right">{tt.cost.toFixed(2)}</TableCell>
                                        <TableCell>{tt.description || "N/A"}</TableCell>
                                        <TableCell className="text-center">{tt.quantity === undefined || tt.quantity === null ? 'Ilimitada' : tt.quantity}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" onClick={() => { setEditingTicketInEventModal(tt); setShowTicketFormInEventModal(true); }}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>¿Eliminar tipo de entrada?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esto eliminará permanentemente "{tt.name}" para este evento.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteTicketTypeFromEvent(tt.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-muted-foreground text-center">No hay tipos de entrada definidos para este evento.</p>
                    )}
                </div>
                 {/* Nested Modal for TicketTypeForm */}
                <Dialog open={showTicketFormInEventModal} onOpenChange={setShowTicketFormInEventModal}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingTicketInEventModal ? "Editar Entrada" : "Crear Nueva Entrada"}</DialogTitle>
                        </DialogHeader>
                        <TicketTypeForm
                            ticketType={editingTicketInEventModal || undefined}
                            onSubmit={handleCreateOrEditTicketTypeForEvent}
                            onCancel={() => { setShowTicketFormInEventModal(false); setEditingTicketInEventModal(null); }}
                        />
                    </DialogContent>
                </Dialog>
                <DialogFooter>
                    <Button variant="outline" onClick={() => {setShowTicketManagementModal(false); setSelectedEventForTicketManagement(null);}}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )}

    {/* Box Management Modal for a Specific Event */}
    {selectedEventForBoxManagement && (
         <Dialog open={showBoxManagementModal} onOpenChange={(isOpen) => {
            setShowBoxManagementModal(isOpen);
            if(!isOpen) setSelectedEventForBoxManagement(null);
        }}>
            <DialogContent className="sm:max-w-3xl"> {/* Increased width for more columns */}
                <DialogHeader>
                    <DialogTitle>Gestionar Boxes para: {selectedEventForBoxManagement.name}</DialogTitle>
                    <DialogDescription>Añade, edita o elimina los boxes para este evento.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                     <Button onClick={() => { setEditingBoxInEventModal(null); setShowBoxFormInEventModal(true); }} className="bg-primary hover:bg-primary/90">
                        <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevo Box
                    </Button>
                    {(selectedEventForBoxManagement.eventBoxes?.length || 0) > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead className="text-right">Costo (S/)</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-center">Capacidad</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedEventForBoxManagement.eventBoxes?.map((box) => (
                                    <TableRow key={box.id}>
                                        <TableCell className="font-medium">{box.name}</TableCell>
                                        <TableCell className="text-right">{box.cost.toFixed(2)}</TableCell>
                                        <TableCell>{box.description || "N/A"}</TableCell>
                                        <TableCell className="text-center">{box.capacity || "N/A"}</TableCell>
                                        <TableCell>
                                          <Badge variant={box.status === 'available' ? 'default' : 'secondary'}
                                                 className={box.status === 'available' ? 'bg-green-500 hover:bg-green-600' : ''}>
                                            {box.status === 'available' ? "Disponible" : "No Disponible"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" onClick={() => { setEditingBoxInEventModal(box); setShowBoxFormInEventModal(true);}}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>¿Eliminar box?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                    Esto eliminará permanentemente "{box.name}" para este evento.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteBoxFromEvent(box.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-muted-foreground text-center">No hay boxes definidos para este evento.</p>
                    )}
                </div>
                 {/* Nested Modal for EventBoxForm */}
                <Dialog open={showBoxFormInEventModal} onOpenChange={setShowBoxFormInEventModal}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingBoxInEventModal ? "Editar Box" : "Crear Nuevo Box"}</DialogTitle>
                        </DialogHeader>
                        <EventBoxForm
                            eventBox={editingBoxInEventModal || undefined}
                            onSubmit={handleCreateOrEditBoxForEvent}
                            onCancel={() => { setShowBoxFormInEventModal(false); setEditingBoxInEventModal(null);}}
                        />
                    </DialogContent>
                </Dialog>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => {setShowBoxManagementModal(false); setSelectedEventForBoxManagement(null);}}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )}
    </div>
  );
}
