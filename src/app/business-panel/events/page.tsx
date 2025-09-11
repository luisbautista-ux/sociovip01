
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as UIDescription, AlertDialogFooter as UIFooter, AlertDialogHeader, AlertDialogTitle as UITitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2, Calendar, Loader2, Info, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { BusinessManagedEntity, TicketType, EventBox, EventPromoterAssignment } from "@/lib/types";
import { isEntityCurrentlyActivatable, anyToDate, calculateMaxAttendance, sanitizeObjectForFirestore } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessEventForm, type EventDetailsFormValues } from '@/components/business/forms/BusinessEventForm';
// We will create these new components for the tabs
// import { ManageTicketsTab } from '@/components/business/event-tabs/ManageTicketsTab';
// import { ManageBoxesTab } from '@/components/business/event-tabs/ManageBoxesTab';
// import { ManageEventPromotersTab } from '@/components/business/event-tabs/ManageEventPromotersTab';


export default function BusinessEventsPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const { toast } = useToast();

  const [events, setEvents] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);

  const [isManageEventDialogOpen, setIsManageEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BusinessManagedEntity | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  useEffect(() => {
    if (!loadingAuth && !loadingProfile && userProfile?.businessId) {
      setCurrentBusinessId(userProfile.businessId);
    }
  }, [userProfile, loadingAuth, loadingProfile]);

  const fetchEvents = useCallback(async (businessId: string) => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "businessEntities"),
        where("businessId", "==", businessId),
        where("type", "==", "event")
      );
      const querySnapshot = await getDocs(q);
      const fetchedEvents: BusinessManagedEntity[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          startDate: anyToDate(data.startDate)?.toISOString() || "",
          endDate: anyToDate(data.endDate)?.toISOString() || "",
          createdAt: anyToDate(data.createdAt)?.toISOString() || "",
        } as BusinessManagedEntity;
      });
      setEvents(fetchedEvents.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    } catch (error: any) {
      console.error("Error fetching events:", error);
      toast({ title: "Error", description: `No se pudieron cargar los eventos: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentBusinessId) {
      fetchEvents(currentBusinessId);
    } else if (!loadingAuth && !loadingProfile) {
        setIsLoading(false);
    }
  }, [currentBusinessId, fetchEvents, loadingAuth, loadingProfile]);

  const handleOpenManageEventDialog = (event: BusinessManagedEntity | null, duplicate = false) => {
    setIsSubmitting(false);
    setIsDuplicating(duplicate);
    if (duplicate && event) {
        const { id, createdAt, maxAttendance, ...eventToDuplicate } = event;
        setEditingEvent({
            ...eventToDuplicate,
            id: '',
            name: `${event.name} (Copia)`,
            isActive: true,
            createdAt: undefined,
            maxAttendance: 0, // Reset attendance
            ticketTypes: [], // Reset tickets
            eventBoxes: [], // Reset boxes
            assignedPromoters: [], // Reset promoters
        });
    } else {
        setEditingEvent(event);
    }
    setIsManageEventDialogOpen(true);
  };
  
  const handleDeleteEvent = async (eventId: string, eventName: string) => {
    setIsSubmitting(true);
    try {
        await deleteDoc(doc(db, "businessEntities", eventId));
        toast({ title: "Evento Eliminado", description: `El evento "${eventName}" ha sido eliminado.`, variant: "destructive" });
        if(currentBusinessId) fetchEvents(currentBusinessId);
    } catch (error: any) {
        toast({ title: "Error al Eliminar", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  // Placeholder for advanced save logic
  const handleSaveEvent = async (eventDataToSave: BusinessManagedEntity) => {
      if(!currentBusinessId) {
          toast({title: "Error", description: "No se ha identificado el negocio actual.", variant: "destructive"});
          return;
      }
      setIsSubmitting(true);
      
      const payload = {
        ...eventDataToSave,
        businessId: currentBusinessId,
        type: 'event',
        startDate: Timestamp.fromDate(new Date(eventDataToSave.startDate)),
        endDate: Timestamp.fromDate(new Date(eventDataToSave.endDate)),
      };
      
      try {
          if(eventDataToSave.id && !isDuplicating) {
              const { id, createdAt, ...updateData } = payload;
              await updateDoc(doc(db, "businessEntities", id), sanitizeObjectForFirestore(updateData));
              toast({title: "Evento Actualizado", description: "Los cambios se han guardado correctamente."});
          } else {
              const { id, ...createData } = payload;
              await addDoc(collection(db, "businessEntities"), {...createData, createdAt: serverTimestamp()});
              toast({title: "Evento Creado", description: `El evento "${payload.name}" ha sido creado.`});
          }
          setIsManageEventDialogOpen(false);
          if(currentBusinessId) fetchEvents(currentBusinessId);
      } catch (error: any) {
          toast({title: "Error al Guardar", description: error.message, variant: "destructive"});
          console.error("Error saving event:", error);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleDetailsChange = (values: EventDetailsFormValues) => {
    if (editingEvent) {
        setEditingEvent(prev => ({ ...prev!, ...values }));
    }
  };

  const ManageEventDialog = () => {
    const [activeTab, setActiveTab] = useState("details");
    
    // This local state will hold the draft of the event being edited.
    const [localEventState, setLocalEventState] = useState<BusinessManagedEntity | null>(
        editingEvent ? { ...editingEvent } : null
    );

    useEffect(() => {
        // Initialize local state when dialog opens or editingEvent changes
        if (editingEvent) {
            setLocalEventState({ ...editingEvent });
        } else {
            // Default new event structure
            const now = new Date();
            const endDate = new Date(now);
            endDate.setDate(now.getDate() + 7);
            setLocalEventState({
                id: '',
                businessId: currentBusinessId || '',
                type: 'event',
                name: '',
                description: '',
                startDate: now.toISOString(),
                endDate: endDate.toISOString(),
                isActive: true,
                maxAttendance: 0,
                ticketTypes: [],
                eventBoxes: [],
                assignedPromoters: []
            });
        }
    }, [editingEvent]);

    const handleLocalDetailsChange = (values: EventDetailsFormValues) => {
        setLocalEventState(prev => prev ? { ...prev, ...values } : null);
    };

    if (!isManageEventDialogOpen || !localEventState) return null;

    return (
        <Dialog open={isManageEventDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingEvent(null); setIsManageEventDialogOpen(isOpen); }}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{editingEvent?.id && !isDuplicating ? `Editar Evento: ${localEventState.name}` : "Crear Nuevo Evento"}</DialogTitle>
                    <DialogDescription>Gestiona todos los aspectos de tu evento usando las pestañas a continuación.</DialogDescription>
                </DialogHeader>
                
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col overflow-hidden">
                    <TabsList className="w-full grid grid-cols-4">
                        <TabsTrigger value="details">Detalles</TabsTrigger>
                        <TabsTrigger value="tickets">Entradas</TabsTrigger>
                        <TabsTrigger value="boxes">Boxes</TabsTrigger>
                        <TabsTrigger value="promoters">Promotores</TabsTrigger>
                    </TabsList>

                    <div className="flex-grow overflow-y-auto mt-4 pr-2">
                        <TabsContent value="details">
                            <BusinessEventForm 
                                event={localEventState} 
                                onFormChange={handleLocalDetailsChange} 
                                isSubmitting={isSubmitting}
                            />
                        </TabsContent>
                        <TabsContent value="tickets">
                           <Card><CardHeader><CardTitle>Gestión de Entradas</CardTitle></CardHeader><CardContent className="h-60 flex items-center justify-center text-muted-foreground"><p>Funcionalidad en construcción.</p></CardContent></Card>
                        </TabsContent>
                        <TabsContent value="boxes">
                            <Card><CardHeader><CardTitle>Gestión de Boxes</CardTitle></CardHeader><CardContent className="h-60 flex items-center justify-center text-muted-foreground"><p>Funcionalidad en construcción.</p></CardContent></Card>
                        </TabsContent>
                        <TabsContent value="promoters">
                             <Card><CardHeader><CardTitle>Gestión de Promotores</CardTitle></CardHeader><CardContent className="h-60 flex items-center justify-center text-muted-foreground"><p>Funcionalidad en construcción.</p></CardContent></Card>
                        </TabsContent>
                    </div>
                </Tabs>
                
                <DialogFooter className="pt-4 border-t mt-auto">
                    <Button variant="outline" onClick={() => setIsManageEventDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                    <Button onClick={() => handleSaveEvent(localEventState)} disabled={isSubmitting || !localEventState.name}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Guardar Evento
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gradient flex items-center">
          <Calendar className="h-8 w-8 mr-2" /> Gestión de Eventos
        </h1>
        <Button onClick={() => handleOpenManageEventDialog(null)} disabled={isLoading || !currentBusinessId}>
          <PlusCircle className="h-4 w-4 mr-2" /> Crear Evento
        </Button>
      </div>

      {!currentBusinessId && !isLoading ? (
          <Card><CardHeader><CardTitle className="text-destructive">Negocio no identificado</CardTitle></CardHeader><CardContent><p>Tu perfil no está asociado a un negocio.</p></CardContent></Card>
      ) : isLoading ? (
          <div className="flex justify-center items-center h-60"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
      ) : events.length === 0 ? (
          <Card><CardHeader><CardTitle>Sin Eventos</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Aún no has creado ningún evento. ¡Haz clic en "Crear Evento" para empezar!</p></CardContent></Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Mis Eventos</CardTitle>
            <CardDescription>Lista de todos los eventos creados para tu negocio.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Aforo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map(event => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>{format(parseISO(event.startDate), "dd MMM yyyy", { locale: es })}</TableCell>
                    <TableCell>{calculateMaxAttendance(event.ticketTypes)}</TableCell>
                    <TableCell>
                      <Badge variant={isEntityCurrentlyActivatable(event) ? "default" : "outline"} className={cn(isEntityCurrentlyActivatable(event) ? 'bg-green-500' : '')}>
                        {isEntityCurrentlyActivatable(event) ? "Vigente" : "Finalizado/Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenManageEventDialog(event)}><Edit className="h-4 w-4" /></Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><UITitle>¿Confirmar eliminación?</UITitle><UIDescription>Se eliminará el evento "{event.name}". Esta acción es irreversible.</UIDescription></AlertDialogHeader>
                            <UIFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteEvent(event.id, event.name)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></UIFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <ManageEventDialog />
    </div>
  );
}
