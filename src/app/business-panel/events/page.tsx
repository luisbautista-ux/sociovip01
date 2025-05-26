
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Search, Calendar, BadgeCheck, BadgeX, QrCode, ListChecks, Ticket as TicketIcon, Box } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TicketTypeForm } from "@/components/business/forms/TicketTypeForm";
import { EventBoxForm } from "@/components/business/forms/EventBoxForm";

// Mock data for business events - In a real app, this would be fetched for the logged-in business
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
    generatedCodes: []
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
    generatedCodes: []
  },
];

let mockTicketTypes: TicketType[] = [
    { id: "tt1", businessId: "biz1", eventId: "evt1", name: "Entrada General - Karaoke", cost: 50, description: "Acceso general al evento de Karaoke.", quantity: 80 },
    { id: "tt2", businessId: "biz1", eventId: "evt1", name: "Entrada VIP - Karaoke", cost: 150, description: "Acceso VIP + 1 bebida para Karaoke.", quantity: 20 },
    { id: "tt3", businessId: "biz1", eventId: "evt2", name: "Entrada General - Fiesta 80s", cost: 70, description: "Acceso general a la Fiesta 80s.", quantity: 200 },
];

let mockEventBoxes: EventBox[] = [
    { id: "box1", businessId: "biz1", eventId: "evt1", name: "Box A1 (Escenario Karaoke)", cost: 800, description: "Para 8 personas, cerca al escenario.", status: 'available', capacity: 8, sellerName: "Ana Staff", ownerName: "Cliente VIP Juan", ownerDni:"12345670" },
    { id: "box2", businessId: "biz1", eventId: "evt2", name: "Box B2 (Lateral Fiesta 80s)", cost: 600, description: "Para 6 personas, vista lateral.", status: 'unavailable', capacity: 6, sellerName: "Luis Staff" },
];


export default function BusinessEventsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateEditEventModal, setShowCreateEditEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BusinessManagedEntity | null>(null);
  const [events, setEvents] = useState<BusinessManagedEntity[]>(mockBusinessEvents);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const { toast } = useToast();

  // States for Ticket Types
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>(mockTicketTypes);
  const [showTicketTypeModal, setShowTicketTypeModal] = useState(false);
  const [editingTicketType, setEditingTicketType] = useState<TicketType | null>(null);

  // States for Event Boxes
  const [eventBoxes, setEventBoxes] = useState<EventBox[]>(mockEventBoxes);
  const [showEventBoxModal, setShowEventBoxModal] = useState(false);
  const [editingEventBox, setEditingEventBox] = useState<EventBox | null>(null);


  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateEvent = (data: BusinessEventFormData) => {
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
      generatedCodes: [],
    };
    setEvents(prev => [newEvent, ...prev]);
    setShowCreateEditEventModal(false);
    toast({ title: "Evento Creado", description: `El evento "${newEvent.name}" ha sido creado.` });
  };

  const handleEditEvent = (data: BusinessEventFormData) => {
    if (!editingEvent) return;
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
    setEditingEvent(null);
    setShowCreateEditEventModal(false);
    toast({ title: "Evento Actualizado", description: `El evento "${updatedEvent.name}" ha sido actualizado.` });
  };
  
  const handleDeleteEvent = (eventId: string) => {
    setEvents(prev => prev.filter(p => p.id !== eventId));
    toast({ title: "Evento Eliminado", description: `El evento ha sido eliminado.`, variant: "destructive" });
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
    // For now, maxAttendance comes directly from the event.
    // Later, it could be sum of quantities from associated ticket types/boxes.
    return `${redeemedCount} / ${event.maxAttendance === 0 || !event.maxAttendance ? '∞' : event.maxAttendance}`;
  };

  // TicketType CRUD
  const handleCreateTicketType = (data: TicketTypeFormData) => {
    const newTicketType: TicketType = {
      id: `tt${Date.now()}`,
      businessId: "biz1", // Assuming fixed business ID for mock
      // eventId: selectedEventId, // If managing tickets per event
      ...data,
    };
    setTicketTypes(prev => [newTicketType, ...prev]);
    setShowTicketTypeModal(false);
    toast({ title: "Entrada Creada", description: `La entrada "${newTicketType.name}" ha sido creada.` });
  };

  const handleEditTicketType = (data: TicketTypeFormData) => {
    if (!editingTicketType) return;
    setTicketTypes(prev => prev.map(tt => tt.id === editingTicketType.id ? { ...editingTicketType, ...data } : tt));
    setEditingTicketType(null);
    setShowTicketTypeModal(false);
    toast({ title: "Entrada Actualizada", description: `La entrada "${data.name}" ha sido actualizada.` });
  };

  const handleDeleteTicketType = (ticketTypeId: string) => {
    setTicketTypes(prev => prev.filter(tt => tt.id !== ticketTypeId));
    toast({ title: "Entrada Eliminada", variant: "destructive" });
  };

  // EventBox CRUD
  const handleCreateEventBox = (data: EventBoxFormData) => {
    const newBox: EventBox = {
      id: `box${Date.now()}`,
      businessId: "biz1", // Assuming fixed business ID for mock
      // eventId: selectedEventId, // If managing boxes per event
      ...data,
    };
    setEventBoxes(prev => [newBox, ...prev]);
    setShowEventBoxModal(false);
    toast({ title: "Box Creado", description: `El box "${newBox.name}" ha sido creado.` });
  };

  const handleEditEventBox = (data: EventBoxFormData) => {
    if (!editingEventBox) return;
    setEventBoxes(prev => prev.map(b => b.id === editingEventBox.id ? { ...editingEventBox, ...data } : b));
    setEditingEventBox(null);
    setShowEventBoxModal(false);
    toast({ title: "Box Actualizado", description: `El box "${data.name}" ha sido actualizado.` });
  };

  const handleDeleteEventBox = (boxId: string) => {
    setEventBoxes(prev => prev.filter(b => b.id !== boxId));
    toast({ title: "Box Eliminado", variant: "destructive" });
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Calendar className="h-8 w-8 mr-2" /> Gestión de Eventos
        </h1>
      </div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="events">Mis Eventos</TabsTrigger>
          <TabsTrigger value="ticketTypes">Entradas</TabsTrigger>
          <TabsTrigger value="boxes">Boxes</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button onClick={() => {setEditingEvent(null); setShowCreateEditEventModal(true);}} className="bg-primary hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Crear Evento
            </Button>
          </div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Lista de Eventos</CardTitle>
              <CardDescription>Administra los eventos organizados por tu negocio. Próximamente podrás gestionar entradas y boxes por cada evento.</CardDescription>
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
                           {/* Placeholder buttons for managing tickets/boxes per event */}
                          {/* <Button variant="outline" size="xs" className="text-xs" onClick={() => alert(`Gestionar Entradas para ${event.name}`)}>Entradas</Button> */}
                          {/* <Button variant="outline" size="xs" className="text-xs" onClick={() => alert(`Gestionar Boxes para ${event.name}`)}>Boxes</Button> */}
                          <Button variant="default" size="sm" onClick={() => openCreateCodesDialog(event)}>
                            <QrCode className="h-4 w-4 mr-1" /> Crear Códigos
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openViewCodesDialog(event)}>
                            <ListChecks className="h-4 w-4 mr-1" /> Ver Códigos ({event.generatedCodes?.length || 0})
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => {setEditingEvent(event); setShowCreateEditEventModal(true);}}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Eliminar</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Esto eliminará permanentemente el evento:
                                  <span className="font-semibold"> {event.name}</span>.
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
        </TabsContent>

        <TabsContent value="ticketTypes" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button onClick={() => {setEditingTicketType(null); setShowTicketTypeModal(true);}} className="bg-primary hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Crear Entrada
            </Button>
          </div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Entradas</CardTitle>
              <CardDescription>Define diferentes tipos de entradas para tus eventos. (Gestión global por ahora)</CardDescription>
            </CardHeader>
            <CardContent>
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
                  {ticketTypes.length > 0 ? (
                    ticketTypes.map((tt) => (
                      <TableRow key={tt.id}>
                        <TableCell className="font-medium">{tt.name}</TableCell>
                        <TableCell className="text-right">{tt.cost.toFixed(2)}</TableCell>
                        <TableCell>{tt.description || "N/A"}</TableCell>
                        <TableCell className="text-center">{tt.quantity === undefined || tt.quantity === null ? 'Ilimitada' : tt.quantity}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => {setEditingTicketType(tt); setShowTicketTypeModal(true);}}>
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
                                  Esto eliminará permanentemente "{tt.name}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTicketType(tt.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">No hay tipos de entrada definidos.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boxes" className="mt-6">
           <div className="flex justify-end mb-4">
            <Button onClick={() => {setEditingEventBox(null); setShowEventBoxModal(true);}} className="bg-primary hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Crear Box
            </Button>
            {/* Placeholder for Create Boxes in Batch */}
            {/* <Button variant="outline" className="ml-2">Crear Boxes en Lote</Button> */}
          </div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Boxes del Evento</CardTitle>
              <CardDescription>Define y gestiona los boxes disponibles. (Gestión global por ahora)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre Box</TableHead>
                    <TableHead className="text-right">Costo (S/)</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="hidden md:table-cell">Vendedor</TableHead>
                    <TableHead className="hidden lg:table-cell">Dueño (Cliente)</TableHead>
                    <TableHead className="text-center">Capacidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventBoxes.length > 0 ? (
                    eventBoxes.map((box) => (
                      <TableRow key={box.id}>
                        <TableCell className="font-medium">{box.name}</TableCell>
                        <TableCell className="text-right">{box.cost.toFixed(2)}</TableCell>
                        <TableCell>{box.description || "N/A"}</TableCell>
                        <TableCell className="hidden md:table-cell">{box.sellerName || "N/A"}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {box.ownerName ? `${box.ownerName}${box.ownerDni ? ` (${box.ownerDni})` : ''}` : "N/A"}
                        </TableCell>
                        <TableCell className="text-center">{box.capacity || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={box.status === 'available' ? 'default' : 'secondary'}
                                 className={box.status === 'available' ? 'bg-green-500 hover:bg-green-600' : ''}>
                            {box.status === 'available' ? "Disponible" : "No Disponible"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                           <Button variant="ghost" size="icon" onClick={() => {setEditingEventBox(box); setShowEventBoxModal(true);}}>
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
                                   Esto eliminará permanentemente "{box.name}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteEventBox(box.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                     <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">No hay boxes definidos.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Event Create/Edit Modal */}
      <Dialog open={showCreateEditEventModal} onOpenChange={setShowCreateEditEventModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar Evento" : "Crear Nuevo Evento"}</DialogTitle>
            <DialogDescription>
                 {editingEvent ? `Actualiza los detalles de "${editingEvent.name}".` : "Completa los detalles para tu nuevo evento."}
            </DialogDescription>
          </DialogHeader>
          <BusinessEventForm
            event={editingEvent || undefined}
            onSubmit={editingEvent ? handleEditEvent : handleCreateEvent} 
            onCancel={() => setShowCreateEditEventModal(false)} 
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

      {/* Ticket Type Create/Edit Modal */}
      <Dialog open={showTicketTypeModal} onOpenChange={setShowTicketTypeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTicketType ? "Editar Entrada" : "Crear Nueva Entrada"}</DialogTitle>
          </DialogHeader>
          <TicketTypeForm
            ticketType={editingTicketType || undefined}
            onSubmit={editingTicketType ? handleEditTicketType : handleCreateTicketType}
            onCancel={() => { setShowTicketTypeModal(false); setEditingTicketType(null); }}
          />
        </DialogContent>
      </Dialog>

       {/* Event Box Create/Edit Modal */}
      <Dialog open={showEventBoxModal} onOpenChange={setShowEventBoxModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEventBox ? "Editar Box" : "Crear Nuevo Box"}</DialogTitle>
          </DialogHeader>
          <EventBoxForm
            eventBox={editingEventBox || undefined}
            onSubmit={editingEventBox ? handleEditEventBox : handleCreateEventBox}
            onCancel={() => { setShowEventBoxModal(false); setEditingEventBox(null); }}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}

    