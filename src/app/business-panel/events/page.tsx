

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription as UIDialogDescriptionComponent,
  DialogFooter
} from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Calendar, Loader2, Copy, BarChart3, ListChecks, QrCode as QrCodeIcon, DollarSign, ChevronsUpDown, MoreVertical, Box, User, Phone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db, storage } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, Timestamp, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { BusinessManagedEntity, TicketType, EventBox, EventPromoterAssignment, TicketTypeFormData, GeneratedCode, Business, EventBoxFormData, BatchBoxFormData, CommissionRule, BusinessPromoterLink } from "@/lib/types";
import { isEntityCurrentlyActivatable, anyToDate, calculateMaxAttendance, sanitizeObjectForFirestore } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessEventForm, type EventDetailsFormRef, type EventDetailsFormValues } from '@/components/business/forms/BusinessEventForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as ShadcnAlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TicketTypeForm } from '@/components/business/forms/TicketTypeForm';
import { EventBoxForm } from '@/components/business/forms/EventBoxForm';
import { BatchBoxForm } from '@/components/business/forms/BatchBoxForm';
import { CreateCodesDialog } from '@/components/business/dialogs/CreateCodesDialog';
import { ManageCodesDialog } from '@/components/business/dialogs/ManageCodesDialog';
import { Label } from '@/components/ui/label';
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";


const ManageEventDialog = ({
    isManageEventDialogOpen,
    setIsManageEventDialogOpen,
    editingEvent: initialEditingEvent, 
    isDuplicating,
    availablePromoters,
    onSave,
    isSubmitting,
}: {
    isManageEventDialogOpen: boolean;
    setIsManageEventDialogOpen: (isOpen: boolean) => void;
    editingEvent: BusinessManagedEntity | null;
    isDuplicating: boolean;
    availablePromoters: BusinessPromoterLink[];
    onSave: (event: BusinessManagedEntity, imageFile: File | null) => Promise<void>;
    isSubmitting: boolean;
}) => {
    const [activeTab, setActiveTab] = useState("details");
    
    const [currentEventData, setCurrentEventData] = useState<BusinessManagedEntity | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    
    const [isTicketFormOpen, setIsTicketFormOpen] = useState(false);
    const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
    const [isBoxFormOpen, setIsBoxFormOpen] = useState(false);
    const [editingBox, setEditingBox] = useState<EventBox | null>(null);
    const [isBatchBoxFormOpen, setIsBatchBoxFormOpen] = useState(false);

    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showUnsavedChangesAlert, setShowUnsavedChangesAlert] = useState(false);
    const initialDataSnapshot = useRef<string | null>(null);

    const [batchCommissionValue, setBatchCommissionValue] = useState<number | string>("");
    const [batchCommissionDesc, setBatchCommissionDesc] = useState("");
    
    const { toast } = useToast();

    const boxStatusTranslations: Record<EventBox['status'], string> = {
        available: 'Disponible',
        reserved: 'Reservado',
        sold: 'Vendido',
    };
    
    useEffect(() => {
        if (isManageEventDialogOpen && initialEditingEvent) {
            const sanitizedInitialEvent = sanitizeObjectForFirestore({ ...initialEditingEvent }) as BusinessManagedEntity;
            setCurrentEventData(sanitizedInitialEvent);
            setImagePreviewUrl(sanitizedInitialEvent.imageUrl || null);
            setImageFile(null);
            setActiveTab("details");
            
            initialDataSnapshot.current = JSON.stringify(sanitizedInitialEvent);
            setHasUnsavedChanges(false);
        }
    }, [initialEditingEvent, isManageEventDialogOpen]);
    
    useEffect(() => {
        if (currentEventData && initialDataSnapshot.current) {
            const currentDataString = JSON.stringify(currentEventData);
            setHasUnsavedChanges(currentDataString !== initialDataSnapshot.current);
        }
    }, [currentEventData]);


     const handleSaveChanges = async () => {
        if (currentEventData) {
            await onSave(currentEventData, imageFile);
        } else {
            toast({ title: "Error", description: "No hay datos del evento para guardar.", variant: "destructive" });
        }
    };

    const handleAttemptClose = () => {
        if (hasUnsavedChanges) {
            setShowUnsavedChangesAlert(true);
        } else {
            setIsManageEventDialogOpen(false);
        }
    };
    
    const handleTicketSubmit = (ticketData: TicketTypeFormData) => {
        const ticketId = editingTicket?.id || `ticket_${Date.now()}`;
        const newOrUpdatedTicket: TicketType = sanitizeObjectForFirestore({
            ...ticketData,
            id: ticketId,
            eventId: currentEventData?.id || '',
            businessId: currentEventData?.businessId || '',
        }) as TicketType;

        setCurrentEventData(prev => {
            if (!prev) return null;
            const existingTickets = prev.ticketTypes || [];
            const updatedTickets = editingTicket
                ? existingTickets.map(t => t.id === editingTicket.id ? newOrUpdatedTicket : t)
                : [...existingTickets, newOrUpdatedTicket];
            return { ...prev, ticketTypes: updatedTickets };
        });

        setIsTicketFormOpen(false);
        setEditingTicket(null);
    };
    
    const handleTicketDelete = (ticketId: string) => {
        setCurrentEventData(prev => {
            if (!prev) return null;
            return { ...prev, ticketTypes: (prev.ticketTypes || []).filter(t => t.id !== ticketId) };
        });
    };
    
     const handleBoxSubmit = (boxData: EventBoxFormData) => {
        const boxId = editingBox?.id || `box_${Date.now()}`;
        
        let finalBoxData: Omit<EventBox, 'id' | 'eventId' | 'businessId'> = {...boxData};
        
        if (boxData.status === 'available') {
             finalBoxData = {
                ...boxData,
                promoterName: "",
                ownerName: "",
                ownerDni: "",
                ownerPhone: "",
            };
        }
        const newOrUpdatedBox: EventBox = sanitizeObjectForFirestore({
            ...finalBoxData,
            id: boxId,
            eventId: currentEventData?.id || '',
            businessId: currentEventData?.businessId || '',
        }) as EventBox;
        
         setCurrentEventData(prev => {
            if (!prev) return null;
            const existingBoxes = prev.eventBoxes || [];
            const updatedBoxes = editingBox
                ? existingBoxes.map(b => b.id === editingBox.id ? newOrUpdatedBox : b)
                : [...existingBoxes, newOrUpdatedBox];
            return { ...prev, eventBoxes: updatedBoxes };
        });
        
        setIsBoxFormOpen(false);
        setEditingBox(null);
    };
    
    const handleBatchBoxSubmit = (batchData: BatchBoxFormData) => {
        const newBoxes: EventBox[] = [];
        for (let i = batchData.fromNumber; i <= batchData.toNumber; i++) {
            newBoxes.push(sanitizeObjectForFirestore({
                id: `box_batch_${Date.now()}_${i}`,
                eventId: currentEventData?.id || '',
                businessId: currentEventData?.businessId || '',
                name: `${batchData.prefix} ${i}`,
                cost: batchData.cost,
                description: batchData.description,
                capacity: batchData.capacity,
                status: 'available',
            }) as EventBox);
        }
        setCurrentEventData(prev => {
            if (!prev) return null;
            return { ...prev, eventBoxes: [...(prev.eventBoxes || []), ...newBoxes] };
        });
        setIsBatchBoxFormOpen(false);
    };

    const handleBoxDelete = (boxId: string) => {
        setCurrentEventData(prev => {
            if (!prev) return null;
            return { ...prev, eventBoxes: (prev.eventBoxes || []).filter(b => b.id !== boxId) };
        });
    };

    const handlePromoterAssignmentChange = (promoterId: string, isChecked: boolean) => {
        const promoterData = availablePromoters.find(p => p.platformUserUid === promoterId);
        if (!promoterData) return;

        setCurrentEventData(prev => {
            if (!prev) return null;
            let updatedAssignments = [...(prev.assignedPromoters || [])];
            if (isChecked) {
                if (!updatedAssignments.some(p => p.promoterProfileId === promoterId)) {
                    updatedAssignments.push({
                        promoterProfileId: promoterData.platformUserUid!,
                        promoterName: promoterData.promoterName,
                        promoterEmail: promoterData.promoterEmail,
                        commissionRules: [],
                    });
                }
            } else {
                updatedAssignments = updatedAssignments.filter(p => p.promoterProfileId !== promoterId);
            }
            return { ...prev, assignedPromoters: updatedAssignments };
        });
    };

    const handleCommissionRuleChange = (promoterId: string, ruleIndex: number, field: keyof CommissionRule, value: any) => {
        setCurrentEventData(prev => {
            if (!prev) return null;
            const updatedAssignments = (prev.assignedPromoters || []).map(p => {
                if (p.promoterProfileId === promoterId) {
                    const updatedRules = [...(p.commissionRules || [])];
                    if (updatedRules[ruleIndex]) {
                        updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], [field]: value };
                    }
                    return { ...p, commissionRules: updatedRules };
                }
                return p;
            });
            return { ...prev, assignedPromoters: updatedAssignments };
        });
    };

    const handleAddCommissionRule = (promoterId: string) => {
        setCurrentEventData(prev => {
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
       setCurrentEventData(prev => {
            if (!prev) return null;
            const updatedAssignments = (prev.assignedPromoters || []).map(p => {
                if (p.promoterProfileId === promoterId) {
                    return { ...p, commissionRules: (p.commissionRules || []).filter(r => r.id !== ruleId) };
                }
                return p;
            });
            return { ...prev, assignedPromoters: updatedAssignments };
        });
    };
    
    const handleSelectAllPromoters = (isChecked: boolean) => {
        if (!isChecked) {
            // Deselect all
            setCurrentEventData(prev => prev ? { ...prev, assignedPromoters: [] } : null);
        } else {
            // Select all
            const allAssignments: EventPromoterAssignment[] = availablePromoters.map(promoter => ({
                promoterProfileId: promoter.platformUserUid!,
                promoterName: promoter.promoterName,
                promoterEmail: promoter.promoterEmail,
                commissionRules: [],
            }));
            setCurrentEventData(prev => prev ? { ...prev, assignedPromoters: allAssignments } : null);
        }
    };

    const applyBatchCommission = () => {
        const commissionValue = Number(batchCommissionValue);
        if (isNaN(commissionValue)) {
            toast({ title: "Error", description: "El monto de la comisión debe ser un número.", variant: "destructive" });
            return;
        }

        setCurrentEventData(prev => {
            if (!prev) return null;
            const updatedAssignments = (prev.assignedPromoters || []).map(p => {
                const newRule: CommissionRule = {
                    id: `rule_batch_${Date.now()}`,
                    appliesTo: 'event_general',
                    commissionType: 'fixed',
                    commissionValue: commissionValue,
                    description: batchCommissionDesc,
                };
                return { ...p, commissionRules: [newRule] }; // Replaces existing rules
            });
            return { ...prev, assignedPromoters: updatedAssignments };
        });

        toast({ title: "Éxito", description: `Comisión aplicada a ${currentEventData?.assignedPromoters?.length || 0} promotor(es).` });
    };

    const handleImageFileChange = (file: File | null) => {
        if (file) {
            setImageFile(file);
            setImagePreviewUrl(URL.createObjectURL(file));
            setCurrentEventData(prev => prev ? { ...prev, imageUrl: '' } : null); // Clear imageUrl to prioritize file
        }
    };

    const maxAttendanceFromTickets = useMemo(() => calculateMaxAttendance(currentEventData?.ticketTypes), [currentEventData?.ticketTypes]);
    
    const allPromotersSelected = useMemo(() => {
        return availablePromoters.length > 0 && currentEventData?.assignedPromoters?.length === availablePromoters.length;
    }, [currentEventData?.assignedPromoters, availablePromoters]);

    const somePromotersSelected = useMemo(() => {
        return (currentEventData?.assignedPromoters?.length ?? 0) > 0 && !allPromotersSelected;
    }, [currentEventData?.assignedPromoters, allPromotersSelected]);

    if (!isManageEventDialogOpen || !currentEventData) return null;

    const assignedPromoters = currentEventData.assignedPromoters || [];
    const ticketTypes = currentEventData.ticketTypes || [];
    const eventBoxes = currentEventData.eventBoxes || [];

    return (
        <>
            <Dialog open={isManageEventDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) handleAttemptClose(); }}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2 shrink-0">
                        <DialogTitle>{currentEventData.id && !isDuplicating ? `Editar Evento: ${currentEventData.name}` : "Crear Nuevo Evento"}</DialogTitle>
                        <UIDialogDescriptionComponent>Gestiona todos los aspectos de tu evento usando las pestañas a continuación.</UIDialogDescriptionComponent>
                    </DialogHeader>
                    
                    <div className="px-6 border-b shrink-0">
                        <div className="overflow-x-auto">
                           <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="w-max">
                                    <TabsTrigger value="details">Detalles</TabsTrigger>
                                    <TabsTrigger value="tickets">Entradas ({maxAttendanceFromTickets || 'Ilimitado'})</TabsTrigger>
                                    <TabsTrigger value="boxes">Boxes ({eventBoxes.length})</TabsTrigger>
                                    <TabsTrigger value="promoters">Promotores ({assignedPromoters.length})</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto">
                        <Tabs value={activeTab} className="h-full">
                            <TabsContent value="details" className="p-6 h-full">
                                <Card>
                                  <CardHeader>
                                    <CardTitle>Detalles Principales del Evento</CardTitle>
                                    <CardDescription>Configura la información básica y las fechas de tu evento.</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <BusinessEventForm 
                                        event={currentEventData} 
                                        isSubmitting={isSubmitting}
                                        setCurrentEventData={setCurrentEventData}
                                        imagePreviewUrl={imagePreviewUrl}
                                        onImageFileChange={handleImageFileChange}
                                    />
                                  </CardContent>
                                </Card>
                            </TabsContent>
                            <TabsContent value="tickets" className="p-6 h-full">
                                <Card>
                                 <CardHeader>
                                     <CardTitle>Gestión de tipos de entrada</CardTitle>
                                     <CardDescription>Añade y configura las entradas para tu evento. El aforo total se calcula sumando las cantidades de cada tipo.</CardDescription>
                                 </CardHeader>
                                 <CardContent>
                                     <Button onClick={() => { setEditingTicket(null); setIsTicketFormOpen(true); }}><PlusCircle className="h-4 w-4 mr-2"/>Añadir Tipo de Entrada</Button>
                                     <div className="mt-4 overflow-x-auto">
                                     <Table>
                                         <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Costo (S/)</TableHead><TableHead>Cantidad</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                         <TableBody>
                                             {ticketTypes.map(ticket => (
                                                 <TableRow key={ticket.id}>
                                                     <TableCell>{ticket.name}</TableCell>
                                                     <TableCell>{ticket.cost.toFixed(2)}</TableCell>
                                                     <TableCell>{ticket.quantity || 'Ilimitadas'}</TableCell>
                                                     <TableCell className="text-right">
                                                         <Button variant="ghost" size="icon" onClick={() => { setEditingTicket(ticket); setIsTicketFormOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                                         <AlertDialog>
                                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader><AlertDialogTitle>¿Eliminar entrada?</AlertDialogTitle><AlertDialogDescription>Se eliminará el tipo de entrada "{ticket.name}".</AlertDialogDescription></AlertDialogHeader>
                                                                <ShadcnAlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleTicketDelete(ticket.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></ShadcnAlertDialogFooter>
                                                            </AlertDialogContent>
                                                         </AlertDialog>
                                                     </TableCell>
                                                 </TableRow>
                                             ))}
                                         </TableBody>
                                     </Table>
                                     </div>
                                      {ticketTypes.length === 0 && (
                                        <p className="text-center text-muted-foreground mt-4">No hay tipos de entrada definidos.</p>
                                      )}
                                 </CardContent>
                                </Card>
                            </TabsContent>
                            <TabsContent value="boxes" className="p-6 h-full">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Gestión de boxes</CardTitle>
                                            <CardDescription>Añade y configura los boxes para tu evento, de forma individual o masiva.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex gap-2">
                                                <Button onClick={() => { setEditingBox(null); setIsBoxFormOpen(true); }}><PlusCircle className="h-4 w-4 mr-2"/>Añadir Box</Button>
                                                <Button onClick={() => setIsBatchBoxFormOpen(true)} variant="outline"><Box className="h-4 w-4 mr-2"/>Crear en Lote</Button>
                                            </div>
                                            
                                            <div className="md:hidden space-y-4 mt-4">
                                                {eventBoxes.map(box => (
                                                    <Card key={box.id} className={cn("overflow-hidden border-2 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-in-out", {
                                                        "bg-green-500/10 border-green-300": box.status === 'available',
                                                        "bg-blue-500/10 border-blue-300": box.status === 'reserved',
                                                        "bg-purple-500/10 border-purple-300": box.status === 'sold',
                                                    })}>
                                                        <CardHeader className="p-3">
                                                            <CardTitle className="text-base">{box.name}</CardTitle>
                                                        </CardHeader>
                                                        <CardContent className="p-3 grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
                                                            <div className="text-muted-foreground">Costo:</div><div className="font-semibold">S/ {box.cost.toFixed(2)}</div>
                                                            <div className="text-muted-foreground">Capacidad:</div><div className="font-semibold">{box.capacity || 'N/A'}</div>
                                                            <div className="text-muted-foreground">Estado:</div>
                                                            <div className="flex flex-col">
                                                              <Badge variant={box.status === 'available' ? 'default' : 'secondary'} className={cn(box.status === 'available' && 'bg-green-500')}>{boxStatusTranslations[box.status]}</Badge>
                                                              {box.status !== 'available' && box.promoterName && <span className="text-xs text-muted-foreground mt-1">Por: {box.promoterName}</span>}
                                                            </div>
                                                             {box.ownerName && (
                                                                <>
                                                                    <div className="col-span-2 mt-2 pt-2 border-t text-muted-foreground flex items-center">
                                                                        <User size={14} className="mr-1.5" />Dueño: <span className="font-medium text-foreground ml-1">{box.ownerName}</span>
                                                                    </div>
                                                                    <div className="col-span-2 text-muted-foreground flex items-center">
                                                                        <User size={14} className="mr-1.5 opacity-0" />DNI/CE: <span className="font-medium text-foreground ml-1">{box.ownerDni}</span>
                                                                    </div>
                                                                    <div className="col-span-2 text-muted-foreground flex items-center">
                                                                      <Phone size={14} className="mr-1.5" />Celular: <span className="font-medium text-foreground ml-1">{box.ownerPhone}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </CardContent>
                                                        <CardFooter className="p-2 bg-muted/50 justify-center">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white px-3 h-8 text-xs">
                                                                        Acciones
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent>
                                                                    <DropdownMenuItem onClick={() => { setEditingBox(box); setIsBoxFormOpen(true); }}><Edit className="h-4 w-4 mr-2"/>Editar</DropdownMenuItem>
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild><DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2"/>Eliminar</DropdownMenuItem></AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar Box?</AlertDialogTitle><AlertDialogDescription>Se eliminará el box "{box.name}".</AlertDialogDescription></AlertDialogHeader>
                                                                            <ShadcnAlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleBoxDelete(box.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></ShadcnAlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </CardFooter>
                                                    </Card>
                                                ))}
                                            </div>

                                            <div className="hidden md:block mt-4 overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                      <TableRow>
                                                        <TableHead>Nombre</TableHead>
                                                        <TableHead>Costo (S/)</TableHead>
                                                        <TableHead>Capacidad</TableHead>
                                                        <TableHead>Estado</TableHead>
                                                        <TableHead>Dueño del Box</TableHead>
                                                        <TableHead className="text-right">Acciones</TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {eventBoxes.map(box => (
                                                            <TableRow key={box.id}>
                                                                <TableCell>{box.name}</TableCell>
                                                                <TableCell>S/ {box.cost.toFixed(2)}</TableCell>
                                                                <TableCell>{box.capacity || 'N/A'}</TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <Badge variant={box.status === 'available' ? 'default' : 'secondary'} className={cn(box.status === 'available' && 'bg-green-500')}>{boxStatusTranslations[box.status]}</Badge>
                                                                        {box.status !== 'available' && box.promoterName && <span className="text-xs text-muted-foreground mt-1">Por: {box.promoterName}</span>}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {box.ownerName ? (
                                                                        <div className="text-xs">
                                                                            <p className="font-semibold">{box.ownerName}</p>
                                                                            <p className="text-muted-foreground">DNI: {box.ownerDni}</p>
                                                                            <p className="text-muted-foreground">Cel: {box.ownerPhone || 'N/A'}</p>
                                                                        </div>
                                                                    ) : "N/A"}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button variant="ghost" size="icon" onClick={() => { setEditingBox(box); setIsBoxFormOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar Box?</AlertDialogTitle><AlertDialogDescription>Se eliminará el box "{box.name}".</AlertDialogDescription></AlertDialogHeader>
                                                                            <ShadcnAlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleBoxDelete(box.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></ShadcnAlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            {eventBoxes.length === 0 && (
                                                <p className="text-center text-muted-foreground mt-4">No hay boxes definidos para este evento.</p>
                                            )}
                                        </CardContent>
                                    </Card>
                            </TabsContent>
                           <TabsContent value="promoters" className="p-6 h-full">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Asignar promotores al evento</CardTitle>
                                        <CardDescription>Selecciona los promotores de tu negocio para vincularlos a este evento y luego configura sus comisiones.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div>
                                            <Label className="font-semibold">Promotores del Negocio</Label>
                                            <div className="mt-2 p-3 border rounded-md max-h-48 overflow-y-auto space-y-2">
                                                {availablePromoters.length > 0 ? (
                                                  <>
                                                    <div className="flex items-center space-x-2 border-b pb-2 mb-2">
                                                        <Checkbox
                                                            id="select-all-promoters"
                                                            checked={allPromotersSelected}
                                                            onCheckedChange={handleSelectAllPromoters}
                                                            data-state={somePromotersSelected ? 'indeterminate' : (allPromotersSelected ? 'checked' : 'unchecked')}
                                                        />
                                                        <Label htmlFor="select-all-promoters" className="font-medium">Seleccionar Todos</Label>
                                                    </div>
                                                    {availablePromoters.map(promoter => {
                                                        const isChecked = assignedPromoters.some(p => p.promoterProfileId === promoter.platformUserUid);
                                                        return (
                                                            <div key={promoter.platformUserUid} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`promoter-${promoter.platformUserUid}`}
                                                                    checked={isChecked}
                                                                    onCheckedChange={(checked) => handlePromoterAssignmentChange(promoter.platformUserUid!, Boolean(checked))}
                                                                />
                                                                <Label htmlFor={`promoter-${promoter.platformUserUid}`} className="font-normal">{promoter.promoterName}</Label>
                                                            </div>
                                                        );
                                                    })}
                                                  </>
                                                ) : <p className="text-sm text-muted-foreground">No hay promotores vinculados a tu negocio.</p>}
                                            </div>
                                        </div>

                                        {assignedPromoters.length > 0 && (
                                            <div className="space-y-3 p-4 border rounded-md bg-muted/50">
                                                <h4 className="font-semibold">Aplicar Comisión Grupal</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    <Input 
                                                        type="number" 
                                                        placeholder="Monto (ej: 5)" 
                                                        value={batchCommissionValue} 
                                                        onChange={(e) => setBatchCommissionValue(e.target.value)}
                                                    />
                                                    <Input 
                                                        placeholder="Descripción (ej: por entrada general)" 
                                                        value={batchCommissionDesc} 
                                                        onChange={(e) => setBatchCommissionDesc(e.target.value)}
                                                        className="sm:col-span-2"
                                                    />
                                                </div>
                                                <Button size="sm" onClick={applyBatchCommission}>Aplicar a todos los seleccionados</Button>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                          <h4 className="font-semibold">Promotores Asignados ({assignedPromoters.length})</h4>
                                          {assignedPromoters.map(assignment => (
                                              <div key={assignment.promoterProfileId} className="border p-3 rounded-md space-y-3 bg-background">
                                                  <div className="flex justify-between items-center">
                                                      <p className="font-medium">{assignment.promoterName}</p>
                                                  </div>
                                                  
                                                  <div className="space-y-2">
                                                      {(assignment.commissionRules || []).map((rule, index) => (
                                                          <div key={rule.id} className="flex items-center gap-2 bg-muted/50 p-2 rounded-md border">
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
                                          {assignedPromoters.length === 0 && (
                                              <p className="text-sm text-muted-foreground text-center py-4">No hay promotores asignados a este evento.</p>
                                          )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <DialogFooter className="p-6 pt-2 border-t mt-auto shrink-0">
                        <Button variant="outline" onClick={handleAttemptClose} disabled={isSubmitting}>Cancelar</Button>
                        <Button onClick={handleSaveChanges} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Guardar Evento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showUnsavedChangesAlert} onOpenChange={setShowUnsavedChangesAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Has realizado cambios que no se han guardado. ¿Estás seguro de que quieres cerrar y descartar estos cambios?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <ShadcnAlertDialogFooter>
                        <AlertDialogCancel>No, continuar editando</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setShowUnsavedChangesAlert(false);
                                setIsManageEventDialogOpen(false);
                            }}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Sí, descartar
                        </AlertDialogAction>
                    </ShadcnAlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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
            <Dialog open={isBoxFormOpen} onOpenChange={setIsBoxFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingBox ? 'Editar Box' : 'Nuevo Box'}</DialogTitle>
                    </DialogHeader>
                    <EventBoxForm
                        eventBox={editingBox || undefined}
                        onSubmit={handleBoxSubmit}
                        onCancel={() => setIsBoxFormOpen(false)}
                        isSubmitting={isSubmitting}
                    />
                </DialogContent>
            </Dialog>
            <Dialog open={isBatchBoxFormOpen} onOpenChange={setIsBatchBoxFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Boxes en Lote</DialogTitle>
                    </DialogHeader>
                    <BatchBoxForm
                        existingBoxes={currentEventData?.eventBoxes || []}
                        onSubmit={handleBatchBoxSubmit}
                        onCancel={() => setIsBatchBoxFormOpen(false)}
                        isSubmitting={isSubmitting}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
};


export default function BusinessEventsPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const { toast } = useToast();

  const [events, setEvents] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);

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
      const businessDocRef = doc(db, "businesses", businessId);
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

      const [businessSnap, eventsSnapshot, promotersSnapshot] = await Promise.all([
        getDoc(businessDocRef),
        getDocs(eventsQuery),
        getDocs(promotersQuery)
      ]);
      
      if (businessSnap.exists()) {
        setBusinessDetails({ id: businessSnap.id, ...businessSnap.data() } as Business);
      } else {
        toast({ title: "Error", description: "No se pudieron cargar los detalles del negocio.", variant: "destructive" });
      }

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
        const { id, createdAt, ...eventToDuplicate } = event;
        setEditingEvent({
            ...eventToDuplicate,
            id: '',
            name: `${event.name} (Copia)`,
            isActive: true,
            createdAt: undefined,
            generatedCodes: [],
        });
    } else if (event) {
      setEditingEvent(event);
    } else { 
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setEditingEvent({
        id: '',
        businessId: currentBusinessId || '',
        type: 'event',
        name: '',
        description: '',
        startDate: now.toISOString(),
        endDate: oneWeekFromNow.toISOString(),
        isActive: true,
        generatedCodes: [],
        ticketTypes: [],
        eventBoxes: [],
        assignedPromoters: [],
        maxAttendance: 0,
      });
    }
    setIsManageEventDialogOpen(true);
  };
  
  const handleDeleteEvent = async (eventToDelete: BusinessManagedEntity) => {
    setIsSubmitting(true);
    try {
        await deleteDoc(doc(db, "businessEntities", eventToDelete.id));
        toast({ title: "Evento Eliminado", description: `El evento "${eventToDelete.name}" ha sido eliminado.`, variant: "destructive" });
        if (eventToDelete.imageUrl && eventToDelete.imageUrl.includes("firebase")) {
            try {
                const imageRef = ref(storage, eventToDelete.imageUrl);
                await deleteObject(imageRef);
            } catch (deleteError: any) {
                if (deleteError.code !== 'storage/object-not-found') {
                    console.warn("Could not delete event image:", deleteError);
                }
            }
        }
        if(currentBusinessId) fetchEventsAndPromoters(currentBusinessId);
    } catch (error: any) {
        toast({ title: "Error al Eliminar", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleSaveEvent = async (eventDataToSave: BusinessManagedEntity, imageFile: File | null) => {
      if(!currentBusinessId) {
          toast({title: "Error", description: "No se ha identificado el negocio actual.", variant: "destructive"});
          return;
      }
      setIsSubmitting(true);
      
      const isNewEntity = !eventDataToSave.id || isDuplicating;
      const entityId = isNewEntity ? doc(collection(db, "businessEntities")).id : eventDataToSave.id;

      try {
        let finalImageUrl = eventDataToSave.imageUrl || "";
        const oldImageUrl = !isNewEntity && editingEvent?.imageUrl ? editingEvent.imageUrl : null;
        
        if (imageFile) {
            toast({ title: "Subiendo imagen...", description: "Por favor, espera." });
            const storageRef = ref(storage, `event-images/${currentBusinessId}/${entityId}/${imageFile.name}`);
            const uploadResult = await uploadBytes(storageRef, imageFile);
            finalImageUrl = await getDownloadURL(uploadResult.ref);
        }

        const payload = {
            ...eventDataToSave,
            imageUrl: finalImageUrl,
            businessId: currentBusinessId,
            type: 'event' as 'event',
            startDate: Timestamp.fromDate(new Date(eventDataToSave.startDate)),
            endDate: Timestamp.fromDate(new Date(eventDataToSave.endDate)),
            maxAttendance: eventDataToSave.maxAttendance || 0,
        };
      
        if (isNewEntity) {
            const { id, ...createData } = payload;
            await setDoc(doc(db, "businessEntities", entityId), { ...sanitizeObjectForFirestore(createData), createdAt: serverTimestamp() });
            toast({title: "Evento Creado", description: `El evento "${payload.name}" ha sido creado.`});
        } else {
            const { id, createdAt, ...updateData } = payload;
            await updateDoc(doc(db, "businessEntities", id), sanitizeObjectForFirestore(updateData));
            toast({title: "Evento Actualizado", description: "Los cambios se han guardado correctamente."});
        }

        if (imageFile && oldImageUrl && oldImageUrl.includes("firebase")) {
            try {
              const oldImageRef = ref(storage, oldImageUrl);
              await deleteObject(oldImageRef);
            } catch (deleteError: any) {
              if (deleteError.code !== 'storage/object-not-found') {
                console.warn("Could not delete old event image:", deleteError);
              }
            }
        }
          
        setIsManageEventDialogOpen(false);
        setEditingEvent(null);
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
  

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-primary flex items-center self-start">
            <Calendar className="h-8 w-8 mr-2" /> Eventos
        </h1>
        <div className="self-end sm:self-center">
            <Button onClick={() => handleOpenManageEventDialog(null)} variant="gradient" disabled={isLoading || !currentBusinessId}>
              <PlusCircle className="h-4 w-4 mr-2" /> Crear Evento
            </Button>
        </div>
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
            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {events.map(event => {
                const isActivatable = isEntityCurrentlyActivatable(event);
                const attendanceFromTickets = calculateMaxAttendance(event.ticketTypes);
                const displayAttendance = (event.maxAttendance && event.maxAttendance > 0)
                  ? event.maxAttendance
                  : (attendanceFromTickets > 0 ? attendanceFromTickets : "Ilimitado");
                return (
                  <Card key={event.id} className="overflow-hidden">
                    <CardHeader className="p-4">
                       <CardTitle>{event.name}</CardTitle>
                       <CardDescription>{format(parseISO(event.startDate), "dd MMM yyyy", { locale: es })}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Aforo Total</span>
                            <span className="font-semibold">{displayAttendance}</span>
                        </div>
                        <div className="flex justify-between text-sm items-center">
                            <span className="text-muted-foreground">Estado</span>
                            <Badge variant={isActivatable ? "default" : "outline"} className={cn(isActivatable ? 'bg-green-500' : '')}>
                              {isActivatable ? "Vigente" : "Finalizado/Inactivo"}
                            </Badge>
                        </div>
                    </CardContent>
                    <CardFooter className="p-2 bg-muted/50 justify-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white px-3 h-8 text-xs font-bold">
                                    Acciones
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenManageEventDialog(event)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Gestionar Evento
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setSelectedEntityForCreatingCodes(event); setShowCreateCodesModal(true); }} disabled={!isActivatable}>
                                    <QrCodeIcon className="h-4 w-4 mr-2" />
                                    Crear Códigos
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedEntityForViewingCodes(event); setShowManageCodesModal(true); }}>
                                    <ListChecks className="h-4 w-4 mr-2" />
                                    Ver Códigos
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenManageEventDialog(event, true)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicar Evento
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:bg-destructive/10">
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                            <AlertDialogDescription>Se eliminará el evento "{event.name}".</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <ShadcnAlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteEvent(event)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                        </ShadcnAlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead className="text-center">Fecha</TableHead>
                    <TableHead className="text-center">Aforo Total</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map(event => {
                    const isActivatable = isEntityCurrentlyActivatable(event);
                    const attendanceFromTickets = calculateMaxAttendance(event.ticketTypes);
                    const displayAttendance = (event.maxAttendance && event.maxAttendance > 0)
                      ? event.maxAttendance
                      : (attendanceFromTickets > 0 ? attendanceFromTickets : "Ilimitado");
                    
                    return (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.name}</TableCell>
                        <TableCell className="text-center">{format(parseISO(event.startDate), "dd MMM yyyy", { locale: es })}</TableCell>
                        <TableCell className="text-center">{displayAttendance}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={isActivatable ? "default" : "outline"} className={cn(isActivatable ? 'bg-green-500' : '')}>
                            {isActivatable ? "Vigente" : "Finalizado/Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="outline" size="xs" onClick={() => { setSelectedEntityForCreatingCodes(event); setShowCreateCodesModal(true); }} disabled={!isActivatable} className="px-2 py-1 h-auto text-xs"><QrCodeIcon className="h-3 w-3 mr-1" /> Códigos</Button>
                          <Button variant="outline" size="xs" onClick={() => { setSelectedEntityForViewingCodes(event); setShowManageCodesModal(true); }} className="px-2 py-1 h-auto text-xs"><ListChecks className="h-3 w-3 mr-1" /> Ver Códigos ({event.generatedCodes?.length || 0})</Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenManageEventDialog(event)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenManageEventDialog(event, true)}>
                            <Copy className="h-4 w-4" />
                            <span className="sr-only">Duplicar</span>
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
                                    <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                    <AlertDialogDescription>Se eliminará el evento "{event.name}". Esta acción es irreversible.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <ShadcnAlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteEvent(event)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                </ShadcnAlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      <ManageEventDialog 
        isManageEventDialogOpen={isManageEventDialogOpen}
        setIsManageEventDialogOpen={setIsManageEventDialogOpen}
        editingEvent={editingEvent}
        isDuplicating={isDuplicating}
        availablePromoters={availablePromoters}
        onSave={handleSaveEvent}
        isSubmitting={isSubmitting}
      />

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
          maxAttendance={
            (selectedEntityForCreatingCodes.maxAttendance && selectedEntityForCreatingCodes.maxAttendance > 0)
            ? selectedEntityForCreatingCodes.maxAttendance
            : calculateMaxAttendance(selectedEntityForCreatingCodes.ticketTypes)
          }
          currentCodeCount={selectedEntityForCreatingCodes.generatedCodes?.length || 0}
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
          currentUserProfileUid={userProfile.uid}
          businessPersonalPhone={businessDetails?.personalPhone}
        />
      )}

    </div>
  );
}

