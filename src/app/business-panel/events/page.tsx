
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription
} from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Calendar, Loader2, Copy, BarChart3, ListChecks, QrCode as QrCodeIcon, DollarSign, ChevronsUpDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, Timestamp, getDoc } from "firebase/firestore";
import type { BusinessManagedEntity, TicketType, EventBox, EventPromoterAssignment, TicketTypeFormData, GeneratedCode, BusinessPromoterLink, CommissionRule } from "@/lib/types";
import { isEntityCurrentlyActivatable, anyToDate, calculateMaxAttendance, sanitizeObjectForFirestore } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessEventForm, type EventDetailsFormValues } from '@/components/business/forms/BusinessEventForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as ShadcnAlertDialogDescription, AlertDialogFooter as ShadcnAlertDialogFooter, AlertDialogHeader, AlertDialogTitle as ShadcnAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TicketTypeForm } from '@/components/business/forms/TicketTypeForm';
import { EventBoxForm } from '@/components/business/forms/EventBoxForm';
import { CreateCodesDialog } from '@/components/business/dialogs/CreateCodesDialog';
import { ManageCodesDialog } from '@/components/business/dialogs/ManageCodesDialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Input } from '@/components/ui/input';


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
  
  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedEventForStats, setSelectedEventForStats] = useState<BusinessManagedEntity | null>(null);

  const [availablePromoters, setAvailablePromoters] = useState<BusinessPromoterLink[]>([]);

  useEffect(() => {
    if (!loadingAuth && !loadingProfile && userProfile?.businessId) {
      setCurrentBusinessId(userProfile.businessId);
    }
  }, [userProfile, loadingAuth, loadingProfile]);

  const fetchEventsAndPromoters = useCallback(async (businessId: string) => {
    setIsLoading(true);
    try {
      const eventsQuery = query(
        collection(db, "businessEntities"),
        where("businessId", "==", businessId),
        where("type", "==", "event")
      );
      const promotersQuery = query(
        collection(db, "businessPromoterLinks"),
        where("businessId", "==", businessId),
        where("isActive", "==", true)
      );

      const [eventsSnapshot, promotersSnapshot] = await Promise.all([
        getDocs(eventsQuery),
        getDocs(promotersQuery)
      ]);
      
      const fetchedEvents: BusinessManagedEntity[] = eventsSnapshot.docs.map(docSnap => {
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

      const fetchedPromoters: BusinessPromoterLink[] = promotersSnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          joinDate: anyToDate(docSnap.data().joinDate)?.toISOString() || "",
      } as BusinessPromoterLink));
      setAvailablePromoters(fetchedPromoters);

    } catch (error: any) {
      console.error("Error fetching events or promoters:", error);
      toast({ title: "Error", description: `No se pudieron cargar los datos: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentBusinessId) {
      fetchEventsAndPromoters(currentBusinessId);
    } else if (!loadingAuth && !loadingProfile) {
        setIsLoading(false);
    }
  }, [currentBusinessId, fetchEventsAndPromoters, loadingAuth, loadingProfile]);

  const handleOpenManageEventDialog = (event: BusinessManagedEntity | null, duplicate = false) => {
    setIsSubmitting(false);
    setIsDuplicating(duplicate);
    if (duplicate && event) {
        const { id, createdAt, maxAttendance, generatedCodes, ...eventToDuplicate } = event;
        setEditingEvent({
            ...eventToDuplicate,
            id: '',
            name: `${event.name} (Copia)`,
            isActive: true,
            createdAt: undefined,
            maxAttendance: 0,
            ticketTypes: event.ticketTypes || [],
            eventBoxes: event.eventBoxes || [],
            assignedPromoters: event.assignedPromoters || [],
            generatedCodes: [],
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
        if(currentBusinessId) fetchEventsAndPromoters(currentBusinessId);
    } catch (error: any) {
        toast({ title: "Error al Eliminar", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleSaveEvent = async (eventDataToSave: BusinessManagedEntity | null) => {
      if(!currentBusinessId) {
          toast({title: "Error", description: "No se ha identificado el negocio actual.", variant: "destructive"});
          return;
      }
       if(!eventDataToSave) {
          toast({title: "Error", description: "No hay datos de evento para guardar.", variant: "destructive"});
          return;
      }
      setIsSubmitting(true);
      
      const payload = {
        ...eventDataToSave,
        businessId: currentBusinessId,
        type: 'event' as 'event',
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
          if(currentBusinessId) fetchEventsAndPromoters(currentBusinessId);
      } catch (error: any) {
          toast({title: "Error al Guardar", description: error.message, variant: "destructive"});
          console.error("Error saving event:", error);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    if (!userProfile?.name || !userProfile.uid) {
        toast({title: "Error de Usuario", description: "No se pudo obtener el nombre del usuario para registrar los códigos.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }
    setIsSubmitting(true);
    const targetEntityRef = doc(db, "businessEntities", entityId);
    try {
        const targetEntitySnap = await getDoc(targetEntityRef);
        if (!targetEntitySnap.exists()) {
            toast({title:"Error", description:"Evento no encontrado para añadir códigos.", variant: "destructive"});
            setIsSubmitting(false);
            return;
        }
        const targetEntityData = targetEntitySnap.data() as BusinessManagedEntity;
        
        const newCodesWithDetails: GeneratedCode[] = newCodes.map(code => (sanitizeObjectForFirestore({
            ...code,
            id: code.id || `code-${entityId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            entityId: entityId,
            value: code.value,
            status: "available", 
            generatedByName: userProfile.name, 
            generatedByUid: userProfile.uid,
            generatedDate: code.generatedDate || new Date().toISOString(),
            observation: (observation && observation.trim() !== "") ? observation.trim() : null,
        }) as GeneratedCode));
        
        const existingSanitizedCodes = (targetEntityData.generatedCodes || []).map(c => sanitizeObjectForFirestore(c as GeneratedCode));
        const updatedCodes = [...existingSanitizedCodes, ...newCodesWithDetails];
            
        await updateDoc(targetEntityRef, { generatedCodes: updatedCodes });
        toast({title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${targetEntityData.name}. Guardados en la base de datos.`});
        
        if (currentBusinessId) fetchEventsAndPromoters(currentBusinessId); 
        
        if (selectedEntityForViewingCodes && selectedEntityForViewingCodes.id === entityId) {
          setSelectedEntityForViewingCodes(prev => prev ? {...prev, generatedCodes: updatedCodes} : null);
        }
    } catch (error: any) {
        toast({title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCodesUpdated = async (entityId: string, updatedCodes: GeneratedCode[]) => {
    setIsSubmitting(true);
    try {
        await updateDoc(doc(db, "businessEntities", entityId), { generatedCodes: updatedCodes });
        toast({title: "Códigos Actualizados", description: "Los cambios en los códigos se han guardado."});
        if (currentBusinessId) fetchEventsAndPromoters(currentBusinessId);
    } catch (error: any) {
        toast({title: "Error", description: "No se pudieron guardar los cambios en los códigos.", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const ManageEventDialog = () => {
    const [activeTab, setActiveTab] = useState("details");
    const [localEventState, setLocalEventState] = useState<BusinessManagedEntity | null>(null);
    const [isTicketFormOpen, setIsTicketFormOpen] = useState(false);
    const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
    
    // States for Promoters Tab
    const [selectedPromoterId, setSelectedPromoterId] = useState<string>("");
    
    useEffect(() => {
        if (isManageEventDialogOpen && editingEvent) {
            setLocalEventState({ ...editingEvent });
        } else {
            setLocalEventState(null);
        }
    }, [isManageEventDialogOpen, editingEvent]);

    const handleDetailsChange = useCallback((values: EventDetailsFormValues) => {
        setLocalEventState(prev => prev ? { ...prev, ...values } : null);
    }, []);

    const handleTicketSubmit = (ticketData: TicketTypeFormData) => {
        setLocalEventState(prev => {
            if (!prev) return null;
            let updatedTicketTypes: TicketType[];
            const ticketId = editingTicket?.id || `ticket_${Date.now()}`;
            const newOrUpdatedTicket: TicketType = {
                ...ticketData,
                id: ticketId,
                eventId: prev.id,
                businessId: prev.businessId,
            };

            if (editingTicket) {
                updatedTicketTypes = (prev.ticketTypes || []).map(t => t.id === editingTicket.id ? newOrUpdatedTicket : t);
            } else {
                updatedTicketTypes = [...(prev.ticketTypes || []), newOrUpdatedTicket];
            }
            return { ...prev, ticketTypes: updatedTicketTypes };
        });
        setIsTicketFormOpen(false);
        setEditingTicket(null);
    };
    
    const handleTicketDelete = (ticketId: string) => {
        setLocalEventState(prev => {
            if (!prev) return null;
            const updatedTicketTypes = (prev.ticketTypes || []).filter(t => t.id !== ticketId);
            return { ...prev, ticketTypes: updatedTicketTypes };
        });
    };

    const handleAssignPromoter = () => {
        if (!selectedPromoterId) return;
        const promoterToAdd = availablePromoters.find(p => p.platformUserUid === selectedPromoterId);
        if (!promoterToAdd) return;
        setLocalEventState(prev => {
            if (!prev) return null;
            const isAlreadyAssigned = (prev.assignedPromoters || []).some(p => p.promoterProfileId === promoterToAdd.platformUserUid);
            if (isAlreadyAssigned) {
                toast({ title: "Promotor ya asignado", variant: "default" });
                return prev;
            }
            const newAssignment: EventPromoterAssignment = {
                promoterProfileId: promoterToAdd.platformUserUid!,
                promoterName: promoterToAdd.promoterName,
                promoterEmail: promoterToAdd.promoterEmail,
                commissionRules: [],
            };
            return { ...prev, assignedPromoters: [...(prev.assignedPromoters || []), newAssignment] };
        });
        setSelectedPromoterId("");
    };

    const handleCommissionRuleChange = (promoterId: string, ruleIndex: number, field: keyof CommissionRule, value: any) => {
        setLocalEventState(prev => {
            if (!prev) return null;
            const updatedAssignments = (prev.assignedPromoters || []).map(p => {
                if (p.promoterProfileId === promoterId) {
                    const updatedRules = [...p.commissionRules!];
                    updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], [field]: value };
                    return { ...p, commissionRules: updatedRules };
                }
                return p;
            });
            return { ...prev, assignedPromoters: updatedAssignments };
        });
    };

    const handleAddCommissionRule = (promoterId: string) => {
        setLocalEventState(prev => {
            if (!prev) return null;
            const updatedAssignments = (prev.assignedPromoters || []).map(p => {
                if (p.promoterProfileId === promoterId) {
                    const newRule: CommissionRule = {
                        id: `rule_${Date.now()}`,
                        appliesTo: 'event_general',
                        commissionType: 'fixed',
                        commissionValue: 0,
                    };
                    return { ...p, commissionRules: [...(p.commissionRules || []), newRule] };
                }
                return p;
            });
            return { ...prev, assignedPromoters: updatedAssignments };
        });
    };
    
    const handleRemoveCommissionRule = (promoterId: string, ruleId: string) => {
         setLocalEventState(prev => {
            if (!prev) return null;
            const updatedAssignments = (prev.assignedPromoters || []).map(p => {
                if (p.promoterProfileId === promoterId) {
                    const updatedRules = (p.commissionRules || []).filter(r => r.id !== ruleId);
                    return { ...p, commissionRules: updatedRules };
                }
                return p;
            });
            return { ...prev, assignedPromoters: updatedAssignments };
        });
    };

    const handleRemovePromoter = (promoterId: string) => {
        setLocalEventState(prev => {
            if (!prev) return null;
            const updatedAssignments = (prev.assignedPromoters || []).filter(p => p.promoterProfileId !== promoterId);
            return { ...prev, assignedPromoters: updatedAssignments };
        });
    };

    if (!isManageEventDialogOpen || !localEventState) return null;

    const unassignedPromoters = availablePromoters.filter(ap => !(localEventState.assignedPromoters || []).some(p => p.promoterProfileId === ap.platformUserUid));

    return (
        <>
            <Dialog open={isManageEventDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingEvent(null); setIsManageEventDialogOpen(isOpen); }}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{editingEvent?.id && !isDuplicating ? `Editar Evento: ${localEventState.name}` : "Crear Nuevo Evento"}</DialogTitle>
                        <DialogDescription>Gestiona todos los aspectos de tu evento usando las pestañas a continuación.</DialogDescription>
                    </DialogHeader>
                    
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col overflow-hidden">
                        <TabsList className="w-full grid grid-cols-4">
                            <TabsTrigger value="details">Detalles</TabsTrigger>
                            <TabsTrigger value="tickets">Entradas ({calculateMaxAttendance(localEventState.ticketTypes)})</TabsTrigger>
                            <TabsTrigger value="boxes">Boxes</TabsTrigger>
                            <TabsTrigger value="promoters">Promotores ({localEventState.assignedPromoters?.length || 0})</TabsTrigger>
                        </TabsList>

                        <div className="flex-grow overflow-y-auto mt-4 pr-2">
                            <TabsContent value="details">
                                <BusinessEventForm 
                                    event={localEventState} 
                                    onFormChange={handleDetailsChange} 
                                    isSubmitting={isSubmitting}
                                />
                            </TabsContent>
                            <TabsContent value="tickets">
                               <Card>
                                 <CardHeader>
                                     <CardTitle>Gestión de Tipos de Entrada</CardTitle>
                                     <CardDescription>Añade y configura las entradas para tu evento. El aforo total se calcula sumando las cantidades de cada tipo.</CardDescription>
                                 </CardHeader>
                                 <CardContent>
                                     <Button onClick={() => { setEditingTicket(null); setIsTicketFormOpen(true); }}><PlusCircle className="h-4 w-4 mr-2"/>Añadir Tipo de Entrada</Button>
                                     <Table className="mt-4">
                                         <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Costo (S/)</TableHead><TableHead>Cantidad</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                         <TableBody>
                                             {(localEventState.ticketTypes || []).map(ticket => (
                                                 <TableRow key={ticket.id}>
                                                     <TableCell>{ticket.name}</TableCell>
                                                     <TableCell>{ticket.cost.toFixed(2)}</TableCell>
                                                     <TableCell>{ticket.quantity || 'Ilimitadas'}</TableCell>
                                                     <TableCell className="text-right">
                                                         <Button variant="ghost" size="icon" onClick={() => { setEditingTicket(ticket); setIsTicketFormOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                                         <AlertDialog>
                                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader><ShadcnAlertDialogTitle>¿Eliminar entrada?</ShadcnAlertDialogTitle><ShadcnAlertDialogDescription>Se eliminará el tipo de entrada "{ticket.name}".</ShadcnAlertDialogDescription></AlertDialogHeader>
                                                                <ShadcnAlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleTicketDelete(ticket.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></ShadcnAlertDialogFooter>
                                                            </AlertDialogContent>
                                                         </AlertDialog>
                                                     </TableCell>
                                                 </TableRow>
                                             ))}
                                         </TableBody>
                                     </Table>
                                      {(!localEventState.ticketTypes || localEventState.ticketTypes.length === 0) && (
                                        <p className="text-center text-muted-foreground mt-4">No hay tipos de entrada definidos.</p>
                                      )}
                                 </CardContent>
                               </Card>
                            </TabsContent>
                            <TabsContent value="boxes">
                                <Card><CardHeader><CardTitle>Gestión de Boxes</CardTitle></CardHeader><CardContent><p>Funcionalidad en construcción.</p></CardContent></Card>
                            </TabsContent>
                            <TabsContent value="promoters">
                                 <Card>
                                     <CardHeader>
                                         <CardTitle>Asignar Promotores al Evento</CardTitle>
                                         <CardDescription>Selecciona los promotores de tu negocio y define sus comisiones para este evento específico.</CardDescription>
                                     </CardHeader>
                                     <CardContent className="space-y-6">
                                         <div className="flex items-end gap-2">
                                             <div className="flex-grow">
                                                 <Label>Promotores del Negocio</Label>
                                                  <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", unassignedPromoters.length === 0 && "text-muted-foreground")}>
                                                            {selectedPromoterId ? unassignedPromoters.find(p => p.platformUserUid === selectedPromoterId)?.promoterName : (unassignedPromoters.length > 0 ? "Seleccionar promotor a asignar..." : "No hay promotores disponibles")}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[300px] p-0">
                                                        <Command><CommandInput placeholder="Buscar promotor..." /><CommandEmpty>No se encontraron promotores.</CommandEmpty><CommandGroup>
                                                            {unassignedPromoters.map(p => (<CommandItem value={p.platformUserUid} key={p.platformUserUid} onSelect={() => setSelectedPromoterId(p.platformUserUid!)}>{p.promoterName}</CommandItem>))}
                                                        </CommandGroup></Command>
                                                    </PopoverContent>
                                                </Popover>
                                             </div>
                                             <Button onClick={handleAssignPromoter} disabled={!selectedPromoterId}>Asignar</Button>
                                         </div>
                                         <div className="space-y-4">
                                            <h4 className="font-semibold">Promotores Asignados</h4>
                                            {(localEventState.assignedPromoters || []).map(assignment => (
                                                <div key={assignment.promoterProfileId} className="border p-3 rounded-md space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <p className="font-medium">{assignment.promoterName}</p>
                                                        <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => handleRemovePromoter(assignment.promoterProfileId)}><Trash2 className="h-4 w-4"/></Button>
                                                    </div>
                                                    
                                                    {/* Commission Rules */}
                                                    <div className="space-y-2">
                                                        {(assignment.commissionRules || []).map((rule, index) => (
                                                            <div key={rule.id} className="flex items-center gap-2 bg-muted/50 p-2 rounded-md">
                                                                <div className="flex-grow grid grid-cols-2 gap-2">
                                                                    <Input placeholder="Valor (ej: 5 o 10)" value={rule.commissionValue} onChange={e => handleCommissionRuleChange(assignment.promoterProfileId, index, 'commissionValue', parseFloat(e.target.value) || 0)} type="number" step="0.01"/>
                                                                    <Input placeholder="Descripción (ej: por entrada VIP)" value={rule.description || ""} onChange={e => handleCommissionRuleChange(assignment.promoterProfileId, index, 'description', e.target.value)} />
                                                                </div>
                                                                <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => handleRemoveCommissionRule(assignment.promoterProfileId, rule.id)}><Trash2 className="h-4 w-4"/></Button>
                                                            </div>
                                                        ))}
                                                        <Button size="sm" variant="outline" onClick={() => handleAddCommissionRule(assignment.promoterProfileId)}><PlusCircle className="h-4 w-4 mr-2"/>Añadir Regla de Comisión</Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!localEventState.assignedPromoters || localEventState.assignedPromoters.length === 0) && (
                                                <p className="text-sm text-muted-foreground text-center py-4">No hay promotores asignados a este evento.</p>
                                            )}
                                         </div>
                                     </CardContent>
                                 </Card>
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
            <Dialog open={isTicketFormOpen} onOpenChange={setIsTicketFormOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingTicket ? 'Editar Tipo de Entrada' : 'Nuevo Tipo de Entrada'}</DialogTitle>
                </DialogHeader>
                <TicketTypeForm 
                    ticketType={editingTicket || undefined} 
                    onSubmit={handleTicketSubmit} 
                    onCancel={() => setIsTicketFormOpen(false)}
                    isSubmitting={isSubmitting}
                />
              </DialogContent>
            </Dialog>
        </>
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
                  <TableHead>Aforo Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map(event => {
                  const isActivatable = isEntityCurrentlyActivatable(event);
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell>{format(parseISO(event.startDate), "dd MMM yyyy", { locale: es })}</TableCell>
                      <TableCell>{calculateMaxAttendance(event.ticketTypes) || (event.maxAttendance || "Ilimitado")}</TableCell>
                      <TableCell>
                        <Badge variant={isActivatable ? "default" : "outline"} className={cn(isActivatable ? 'bg-green-500' : '')}>
                          {isActivatable ? "Vigente" : "Finalizado/Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="xs" onClick={() => { setSelectedEntityForCreatingCodes(event); setShowCreateCodesModal(true); }} disabled={!isActivatable} className="px-2 py-1 h-auto text-xs"><QrCodeIcon className="h-3 w-3 mr-1" /> Crear Códigos</Button>
                        <Button variant="outline" size="xs" onClick={() => { setSelectedEntityForViewingCodes(event); setShowManageCodesModal(true); }} className="px-2 py-1 h-auto text-xs"><ListChecks className="h-3 w-3 mr-1" /> Ver Códigos ({event.generatedCodes?.length || 0})</Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenManageEventDialog(event)}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                            <AlertDialogHeader><ShadcnAlertDialogTitle>¿Confirmar eliminación?</ShadcnAlertDialogTitle><ShadcnAlertDialogDescription>Se eliminará el evento "{event.name}". Esta acción es irreversible.</ShadcnAlertDialogDescription></AlertDialogHeader>
                            <ShadcnAlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteEvent(event.id, event.name)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></ShadcnAlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <ManageEventDialog />

      {selectedEntityForCreatingCodes && userProfile && (
        <CreateCodesDialog
          open={showCreateCodesModal}
          onOpenChange={(isOpen) => { if(!isOpen) setSelectedEntityForCreatingCodes(null); setShowCreateCodesModal(isOpen);}}
          entityName={selectedEntityForCreatingCodes.name}
          entityId={selectedEntityForCreatingCodes.id!}
          existingCodesValues={(selectedEntityForCreatingCodes.generatedCodes || []).map(c => c.value)}
          onCodesCreated={handleNewCodesCreated}
          isSubmittingMain={isSubmitting}
          currentUserProfileName={userProfile.name}
          currentUserProfileUid={userProfile.uid}
        />
      )}

      {selectedEntityForViewingCodes && userProfile && (
        <ManageCodesDialog
          open={showManageCodesModal}
          onOpenChange={(isOpen) => { if(!isOpen) setSelectedEntityForViewingCodes(null); setShowManageCodesModal(isOpen);}}
          entity={selectedEntityForViewingCodes}
          onCodesUpdated={handleCodesUpdated}
          onRequestCreateNewCodes={() => {
            const currentEntity = events.find(e => e.id === selectedEntityForViewingCodes?.id); 
            if(currentEntity) { 
                 if (isEntityCurrentlyActivatable(currentEntity)) {
                    setShowManageCodesModal(false); 
                    setSelectedEntityForCreatingCodes(currentEntity);
                    setShowCreateCodesModal(true);
                 } else {
                    toast({ title: "Acción no permitida", description: "Este evento no está activo o está fuera de su periodo de vigencia.", variant: "destructive" });
                 }
            }
          }}
          isPromoterView={false} 
          currentUserProfileName={userProfile.name}
        />
      )}

    </div>
  );
}
