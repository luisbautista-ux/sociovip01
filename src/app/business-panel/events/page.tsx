
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as UIDialogDescription, DialogFooter as UIDialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Edit, Trash2, Search, Calendar as CalendarIconLucide, Ticket as TicketIconLucide, Box, Copy, UserCheck, Percent, ListChecks, QrCode as QrCodeIcon, ChevronDown, ChevronUp, BarChart3, Loader2, Info, Users, CalendarDays } from "lucide-react";
import type { BusinessManagedEntity, BusinessEventFormData, GeneratedCode, TicketType, EventBox, EventPromoterAssignment, CommissionRule, CommissionRuleType, CommissionRuleTarget, TicketTypeFormData, EventBoxFormData, BatchBoxFormData, BusinessPromoterLink, PromoterProfile } from "@/lib/types"; // Added PromoterProfile
import { format, parseISO, isBefore, isEqual, set, getMonth, startOfDay, endOfDay, isFuture } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { isEntityCurrentlyActivatable, calculateMaxAttendance, sanitizeObjectForFirestore } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage as FormMessageHook, FormDescription } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarShadcnUi } from "@/components/ui/calendar";
import { PLATFORM_USER_ROLE_TRANSLATIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const initialEventFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  startDate: z.date({ required_error: "Fecha de inicio es requerida." }),
  endDate: z.date({ required_error: "Fecha de fin es requerida." }),
}).refine(data => {
    if (!data.startDate || !data.endDate) return true; 
    const start = startOfDay(data.startDate);
    const end = startOfDay(data.endDate); 
    return isEqual(end, start) || isBefore(start, end) ;
}, {
  message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
  path: ["endDate"],
});

type InitialEventFormValues = z.infer<typeof initialEventFormSchema>;

const commissionRuleFormSchema = z.object({
  appliesTo: z.enum(['event_general', 'ticket_type', 'box_type'], {required_error: "Debes seleccionar a qué aplica."}),
  appliesToId: z.string().optional(), 
  appliesToName: z.string().optional(), 
  commissionType: z.enum(['fixed', 'percentage'], {required_error: "Debes seleccionar el tipo de comisión."}),
  commissionValue: z.coerce.number().min(0, "El valor no puede ser negativo.").optional().or(z.literal(0)),
  description: z.string().optional().or(z.literal("")),
}).refine(data => {
    if (data.appliesTo === 'ticket_type' || data.appliesTo === 'box_type') {
        return !!data.appliesToId && data.appliesToId.length > 0;
    }
    return true;
}, {
    message: "Debe seleccionar un tipo de entrada o box específico.",
    path: ["appliesToId"],
});
type CommissionRuleFormValues = z.infer<typeof commissionRuleFormSchema>;

export default function BusinessEventsPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [events, setEvents] = useState<BusinessManagedEntity[]>([]);
  
  const [showManageEventModal, setShowManageEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BusinessManagedEntity | null>(null);
  const [isDuplicatingEvent, setIsDuplicatingEvent] = useState(false);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const { toast } = useToast();

  const [showTicketFormInEventModal, setShowTicketFormInEventModal] = useState(false);
  const [editingTicketInEventModal, setEditingTicketInEventModal] = useState<TicketType | null>(null);

  const [showBoxFormInEventModal, setShowBoxFormInEventModal] = useState(false);
  const [editingBoxInEventModal, setEditingBoxInEventModal] = useState<EventBox | null>(null);
  const [showCreateBatchBoxesModal, setShowCreateBatchBoxesModal] = useState(false);
  
  const [availablePromotersForAssignment, setAvailablePromotersForAssignment] = useState<BusinessPromoterLink[]>([]); 
  const [selectedPromoterForAssignment, setSelectedPromoterForAssignment] = useState<string>(""); 
  
  const [showCommissionRuleForm, setShowCommissionRuleForm] = useState(false);
  const [editingCommissionRule, setEditingCommissionRule] = useState<CommissionRule | null>(null);
  const [currentPromoterAssignmentForRules, setCurrentPromoterAssignmentForRules] = useState<EventPromoterAssignment | null>(null);

  const [showInitialEventModal, setShowInitialEventModal] = useState(false);

  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedEventForStats, setSelectedEventForStats] = useState<BusinessManagedEntity | null>(null);

  const initialEventForm = useForm<InitialEventFormValues>({
    resolver: zodResolver(initialEventFormSchema),
    defaultValues: { 
        name: "", 
        description: "", 
        startDate: set(new Date(), { hours: 19, minutes: 0, seconds: 0, milliseconds: 0 }),
        endDate: set(new Date(new Date().setDate(new Date().getDate() + 1)), { hours: 23, minutes: 59, seconds: 0, milliseconds: 0 }),
    },
  });

  const commissionRuleForm = useForm<CommissionRuleFormValues>({
    resolver: zodResolver(commissionRuleFormSchema),
    defaultValues: {
      appliesTo: 'event_general',
      appliesToId: undefined,
      appliesToName: "",
      commissionType: 'fixed',
      commissionValue: 0,
      description: "",
    }
  });

 useEffect(() => {
    console.log("Events Page: useEffect for userProfile, loadingAuth, loadingProfile triggered.");
    console.log("Events Page: loadingAuth:", loadingAuth, "loadingProfile:", loadingProfile, "userProfile:", userProfile);

    if (loadingAuth || loadingProfile) {
      setIsLoading(true);
      return;
    }

    if (userProfile) {
      if (userProfile.businessId && typeof userProfile.businessId === 'string' && userProfile.businessId.trim() !== '') {
        console.log("Events Page: Setting currentBusinessId:", userProfile.businessId);
        setCurrentBusinessId(userProfile.businessId);
      } else if (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff')) {
        console.warn("Events Page: User is business_admin/staff but has no valid businessId. UserProfile:", userProfile);
        toast({
          title: "Error de Negocio",
          description: "Tu perfil de usuario no está asociado a un negocio. No se pueden cargar eventos.",
          variant: "destructive",
          duration: 7000,
        });
        setCurrentBusinessId(null);
        setEvents([]);
        setAvailablePromotersForAssignment([]);
        setIsLoading(false); 
      } else {
        console.log("Events Page: User is not a business_admin or staff, or profile is incomplete for this panel.");
        setCurrentBusinessId(null);
        setEvents([]);
        setAvailablePromotersForAssignment([]);
        setIsLoading(false);
      }
    } else {
      console.log("Events Page: No user profile, cannot fetch events or promoters.");
      setCurrentBusinessId(null);
      setEvents([]);
      setAvailablePromotersForAssignment([]);
      setIsLoading(false);
    }
  }, [userProfile, loadingAuth, loadingProfile, toast]);


  const fetchBusinessPromotersForAssignment = useCallback(async () => {
    if (!currentBusinessId) {
      setAvailablePromotersForAssignment([]);
      return;
    }
    console.log('Events Page - Fetching promoter links for assignment for businessId:', currentBusinessId);
    try {
      const q = query(
        collection(db, "businessPromoterLinks"), 
        where("businessId", "==", currentBusinessId), 
        where("isActive", "==", true) 
      );
      const querySnapshot = await getDocs(q);
      const fetchedPromoterLinks: BusinessPromoterLink[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          businessId: data.businessId,
          promoterName: data.promoterName || "Promotor Sin Nombre",
          promoterEmail: data.promoterEmail || "Sin Email",
          promoterDni: data.promoterDni || "Sin DNI",
          commissionRate: data.commissionRate || "No definida", // This is the general rate for the link
          isActive: data.isActive === undefined ? true : data.isActive,
          isPlatformUser: data.isPlatformUser || false,
          platformUserUid: data.platformUserUid || undefined,
          joinDate: data.joinDate instanceof Timestamp ? data.joinDate.toDate().toISOString() : (data.joinDate || new Date().toISOString()),
        } as BusinessPromoterLink;
      });
      setAvailablePromotersForAssignment(fetchedPromoterLinks);
      console.log('Events Page - Fetched promoter links for assignment:', fetchedPromoterLinks.length);
    } catch (error: any) { 
      console.error("Events Page: Error fetching promoter links for assignment:", error.code, error.message, error);
      setAvailablePromotersForAssignment([]); 
      toast({ 
        title: "Error al Cargar Promotores Vinculados", 
        description: `No se pudieron obtener los promotores vinculados al negocio. ${error.message}`, 
        variant: "destructive", 
        duration: 7000 
      });
    }
  }, [currentBusinessId, toast]);

  const fetchBusinessEvents = useCallback(async () => {
    if (!currentBusinessId || typeof currentBusinessId !== 'string' || currentBusinessId.trim() === '') {
      if (userProfile && (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff'))) {
        console.warn("Events Page: Attempted to fetch events but currentBusinessId is invalid.", currentBusinessId, userProfile);
      }
      setEvents([]);
      setIsLoading(false);
      return;
    }
    
    console.log('Events Page: UserProfile for query:', userProfile);
    console.log('Events Page: Querying events with businessId:', currentBusinessId);
    setIsLoading(true);
    try {
      const q = query(collection(db, "businessEntities"), where("businessId", "==", currentBusinessId), where("type", "==", "event"));
      const querySnapshot = await getDocs(q);
      console.log("Events Page: Firestore query executed for events. Snapshot size:", querySnapshot.size);
      
      const fetchedEvents: BusinessManagedEntity[] = querySnapshot.docs.map((docSnap, eventIndex) => {
        const data = docSnap.data();
        const nowISO = new Date().toISOString();

        const ticketTypesData = Array.isArray(data.ticketTypes) ? data.ticketTypes.map((tt: any, index: number) => ({ 
            id: tt.id || `fs-tt-${docSnap.id}-${index}-${Math.random().toString(36).slice(2)}`, 
            eventId: tt.eventId || docSnap.id, 
            businessId: tt.businessId || currentBusinessId, 
            name: tt.name || "Entrada sin nombre",
            cost: typeof tt.cost === 'number' ? tt.cost : 0,
            description: tt.description || "",
            quantity: tt.quantity === undefined || tt.quantity === null ? undefined : Number(tt.quantity),
        })) : [];

        const eventBoxesData = Array.isArray(data.eventBoxes) ? data.eventBoxes.map((eb: any, index: number) => ({ 
            id: eb.id || `fs-eb-${docSnap.id}-${index}-${Math.random().toString(36).slice(2)}`,
            eventId: eb.eventId || docSnap.id,
            businessId: eb.businessId || currentBusinessId,
            name: eb.name || "Box sin nombre",
            cost: typeof eb.cost === 'number' ? eb.cost : 0,
            description: eb.description || "",
            status: eb.status || 'available',
            capacity: eb.capacity === undefined || eb.capacity === null ? undefined : Number(eb.capacity),
            sellerName: eb.sellerName || "",
            ownerName: eb.ownerName || "",
            ownerDni: eb.ownerDni || "",
        })) : [];

        const assignedPromotersData = Array.isArray(data.assignedPromoters) ? data.assignedPromoters.map((ap: any, index: number) => ({
            promoterProfileId: ap.promoterProfileId || `fs-ap-${docSnap.id}-${index}-${Math.random().toString(36).slice(2)}`, // Use actual profile ID if available
            promoterName: ap.promoterName || "Promotor sin nombre",
            promoterEmail: ap.promoterEmail || "",
            commissionRules: Array.isArray(ap.commissionRules) ? ap.commissionRules.map((cr: any, crIndex: number) => ({
                id: cr.id || `fs-cr-${ap.promoterProfileId}-${Date.now()}-${crIndex}-${Math.random().toString(36).slice(2)}`,
                appliesTo: cr.appliesTo || 'event_general',
                appliesToId: cr.appliesToId || undefined,
                appliesToName: cr.appliesToName || "General",
                commissionType: cr.commissionType || 'fixed',
                commissionValue: typeof cr.commissionValue === 'number' ? cr.commissionValue : 0,
                description: cr.description || "",
            })) : [],
            notes: ap.notes || "",
        })) : [];
        
        const calculatedAtt = calculateMaxAttendance(ticketTypesData);

        return {
          id: docSnap.id,
          businessId: data.businessId || currentBusinessId,
          type: "event",
          name: data.name || "Evento sin nombre",
          description: data.description || "",
          termsAndConditions: data.termsAndConditions || "",
          startDate: data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : (typeof data.startDate === 'string' ? data.startDate : nowISO),
          endDate: data.endDate instanceof Timestamp ? data.endDate.toDate().toISOString() : (typeof data.endDate === 'string' ? data.endDate : nowISO),
          isActive: data.isActive === undefined ? true : data.isActive,
          imageUrl: data.imageUrl || "",
          aiHint: data.aiHint || "",
          generatedCodes: Array.isArray(data.generatedCodes) ? data.generatedCodes.map(gc => sanitizeObjectForFirestore({...gc})) : [],
          ticketTypes: ticketTypesData,
          eventBoxes: eventBoxesData,
          assignedPromoters: assignedPromotersData,
          maxAttendance: calculatedAtt,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : undefined),
        };
      });
      setEvents(fetchedEvents.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      console.log("Events Page: Fetched events successfully:", fetchedEvents.length);
    } catch (error: any) {
      console.error("Events Page: Error fetching events:", error.code, error.message, error);
      toast({
        title: "Error al Cargar Eventos",
        description: `No se pudieron obtener los eventos. ${error.message}`,
        variant: "destructive",
      });
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentBusinessId, userProfile, toast]);

  useEffect(() => {
    if (currentBusinessId) { 
        fetchBusinessEvents();
        fetchBusinessPromotersForAssignment(); 
    } else if (!loadingAuth && !loadingProfile) {
        if(isLoading && !currentBusinessId){ 
            setIsLoading(false);
            setEvents([]);
            setAvailablePromotersForAssignment([]);
        }
    }
  }, [currentBusinessId, userProfile, fetchBusinessEvents, fetchBusinessPromotersForAssignment, toast, loadingAuth, loadingProfile, isLoading]);


  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const nameMatch = event.name && typeof event.name === 'string' ? event.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const descriptionMatch = event.description && typeof event.description === 'string' ? event.description.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      return nameMatch || descriptionMatch;
    }).sort((a, b) => { 
      const aActiveCurrent = isEntityCurrentlyActivatable(a);
      const bActiveCurrent = isEntityCurrentlyActivatable(b);
      if (aActiveCurrent && !bActiveCurrent) return -1;
      if (!aActiveCurrent && bActiveCurrent) return 1;
      if (a.isActive && !b.isActive) return -1; 
      if (!a.isActive && b.isActive) return 1;
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
  }, [events, searchTerm]);


  const handleOpenManageEventModal = (eventToManage: BusinessManagedEntity | null, duplicate = false) => {
    setIsSubmitting(false); 
    setIsDuplicatingEvent(duplicate);
    commissionRuleForm.reset({ appliesTo: 'event_general', appliesToId: undefined, appliesToName: "", commissionType: 'fixed', commissionValue: 0, description: "" });
    setSelectedPromoterForAssignment("");

    if (duplicate && eventToManage) { 
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, generatedCodes, ticketTypes = [], eventBoxes = [], assignedPromoters = [], createdAt, ...eventDataToDuplicate } = eventToManage;
        
        const duplicatedEventData = {
            ...eventDataToDuplicate,
            name: `${eventToManage.name || 'Evento'} (Copia)`,
            startDate: eventToManage.startDate, 
            endDate: eventToManage.endDate,     
            isActive: true, 
            ticketTypes: [], 
            eventBoxes: [],
            assignedPromoters: [],
            generatedCodes: [],
            maxAttendance: 0,
        };
        const newEventForDuplication: BusinessManagedEntity = {
            ...(duplicatedEventData as Omit<BusinessManagedEntity, 'id' | 'businessId' | 'type' | 'createdAt'>),
            id: '', 
            businessId: currentBusinessId || "", 
            type: 'event' as 'event',
            createdAt: undefined, 
        };
        setEditingEvent(newEventForDuplication);
        setShowManageEventModal(true);
    } else if (eventToManage) {  
        setEditingEvent({
          ...eventToManage,
          maxAttendance: calculateMaxAttendance(eventToManage.ticketTypes) 
        }); 
        setShowManageEventModal(true);
    } else { 
        initialEventForm.reset({ 
            name: "", 
            description: "", 
            startDate: set(new Date(), { hours: 19, minutes: 0, seconds: 0, milliseconds: 0 }),
            endDate: set(new Date(new Date().setDate(new Date().getDate() + 1)), { hours: 23, minutes: 59, seconds: 0, milliseconds: 0 }),
        });
        setEditingEvent(null); 
        setShowInitialEventModal(true); 
    }
  };
  
  const handleInitialEventSubmit = async (data: InitialEventFormValues) => {
    if (!currentBusinessId) {
        toast({ title: "Error de Negocio", description: "Tu perfil de usuario no está asociado a un negocio. No se puede crear el evento.", variant: "destructive", duration: 7000 });
        setIsSubmitting(false);
        return;
    }
    setIsSubmitting(true);
    console.log("Events Page (Initial Submit): UserProfile:", userProfile);
    console.log("Events Page (Initial Submit): Current Business ID:", currentBusinessId);
    
    const tempStartDate = data.startDate || new Date();
    const tempEndDate = data.endDate || new Date(new Date().setDate(new Date().getDate() + 1));
    
    let newEventToSave: Omit<BusinessManagedEntity, 'id' | 'createdAt'> = {
      businessId: currentBusinessId,
      type: "event",
      name: data.name,
      description: data.description || "",
      termsAndConditions: "", 
      startDate: tempStartDate.toISOString(),
      endDate: tempEndDate.toISOString(),
      isActive: true,
      imageUrl: `https://placehold.co/600x400.png?text=${encodeURIComponent(data.name.substring(0,10))}`,
      aiHint: data.name.split(' ').slice(0,2).join(' '),
      ticketTypes: [], 
      eventBoxes: [],
      assignedPromoters: [],
      generatedCodes: [],
      maxAttendance: 0, 
    };
    
    const defaultTicketData: Omit<TicketType, 'id' | 'eventId' | 'businessId'> = {
      name: "Entrada General",
      cost: 0,
      quantity: 0, 
      description: "Entrada estándar para el evento."
    };

    // Add default ticket directly to newEventToSave
    newEventToSave.ticketTypes = [{
        ...defaultTicketData,
        id: `tt-temp-${Date.now()}-${Math.random().toString(36).slice(2)}`, 
        eventId: '', // Will be updated after event creation
        businessId: currentBusinessId,
    }];
    newEventToSave.maxAttendance = calculateMaxAttendance(newEventToSave.ticketTypes);
    
    const eventPayloadForFirestore = {
      ...sanitizeObjectForFirestore(newEventToSave), 
      startDate: Timestamp.fromDate(tempStartDate),
      endDate: Timestamp.fromDate(tempEndDate),
      // ticketTypes will be initially with placeholder eventId, then updated.
      // Or, more robustly, save event first, then update with tickets that have the correct eventId.
      // For simplicity in this step, we'll save it like this and then update.
      ticketTypes: newEventToSave.ticketTypes!.map(tt => sanitizeObjectForFirestore({...tt, eventId: ''})), // Ensure eventId is string
      createdAt: serverTimestamp(),
    };
    
    console.log("handleInitialEventSubmit: Event payload for Firestore:", eventPayloadForFirestore);
    
    let docRef;
    try {
      docRef = await addDoc(collection(db, "businessEntities"), eventPayloadForFirestore);
      console.log("Events Page: Event created with ID:", docRef.id);
      
      // Now that we have the event ID, update the ticketTypes in the newEventToSave object
      // and then update the document in Firestore with these correct ticketTypes.
      const updatedTicketTypesWithEventId = (newEventToSave.ticketTypes || []).map((tt, index) => ({
        ...tt,
        id: tt.id.startsWith('tt-temp-') ? `tt-${docRef!.id}-${Date.now()}-${index}` : tt.id, // Finalize ID with event ID
        eventId: docRef!.id,
      }));

      const finalNewEvent: BusinessManagedEntity = {
        ...(newEventToSave as Omit<BusinessManagedEntity, 'id' | 'createdAt' | 'ticketTypes'>), 
        id: docRef.id, 
        createdAt: new Date().toISOString(), 
        ticketTypes: updatedTicketTypesWithEventId,
        maxAttendance: calculateMaxAttendance(updatedTicketTypesWithEventId),
      };
      
      // Second update to set the correct eventId in tickets within the event document
      await updateDoc(doc(db, "businessEntities", docRef.id), sanitizeObjectForFirestore({
        ticketTypes: finalNewEvent.ticketTypes.map(tt => sanitizeObjectForFirestore(tt)),
        maxAttendance: finalNewEvent.maxAttendance
      }));
      
      fetchBusinessEvents(); 
      
      toast({ title: "Evento Creado Inicialmente", description: `El evento "${finalNewEvent.name}" ha sido creado. Ahora puedes configurar más detalles.` });
      setShowInitialEventModal(false);
      initialEventForm.reset();
      setEditingEvent(finalNewEvent); 
      setShowManageEventModal(true); 
    } catch (error: any) {
      console.error("Events Page: Error creating event:", error.code, error.message, error);
      const userEmail = userProfile?.email || 'Desconocido';
      const displayBusinessId = currentBusinessId || 'Desconocido';
      let description = `No se pudo crear el evento. ${error.message}.`;
      if (error.code === 'permission-denied') {
        description = `Error de permisos al crear el evento. Asegúrate de que tu usuario (${userEmail}) esté correctamente asignado al negocio con ID: ${displayBusinessId} en 'platformUsers' y que las reglas de Firestore lo permitan. Detalle: ${error.message}`;
      } else if (error.code === 'invalid-argument') {
         description = `Error al crear evento: Datos inválidos. Revisa los campos. ${error.message}`;
      }
      toast({ 
          title: "Error al Crear Evento", 
          description: description, 
          variant: "destructive", 
          duration: 15000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMainEventFormSubmit = (data: Omit<BusinessEventFormData, 'maxAttendance'>) => { 
      if (editingEvent) { 
        const updatedEventDetails: Partial<BusinessManagedEntity> = {
            name: data.name,
            description: data.description || "",
            termsAndConditions: data.termsAndConditions || "",
            startDate: data.startDate.toISOString(),
            endDate: data.endDate.toISOString(),
            isActive: data.isActive,
            imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/600x400.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : editingEvent.imageUrl || `https://placehold.co/600x400.png`),
            aiHint: data.aiHint || "",
        };
        setEditingEvent(prev => {
            if (!prev) return null;
            const currentTickets = prev.ticketTypes || [];
            const newMaxAtt = calculateMaxAttendance(currentTickets); 
            return { ...prev, ...updatedEventDetails, maxAttendance: newMaxAtt };
        });
        toast({ title: "Detalles del Evento Actualizados", description: `Los cambios en "${data.name}" han sido aplicados en el editor. Guarda el evento para persistir.` });
    }
  };
  
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
      toast({ title: "Evento Eliminado", description: `El evento "${eventName || 'seleccionado'}" ha sido eliminado.`, variant: "destructive" });
      fetchBusinessEvents(); 
      if (editingEvent?.id === eventId) { 
        setShowManageEventModal(false);
        setEditingEvent(null);
      }
    } catch (error: any) {
      console.error("Events Page: Error deleting event:", error);
      toast({ title: "Error al Eliminar", description: `No se pudo eliminar el evento. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

 const handleSaveManagedEventAndClose = async () => {
    if (!editingEvent || !currentBusinessId) {
        toast({ title: "Error", description: "No hay evento para guardar o ID de negocio no disponible.", variant: "destructive" });
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
        type: "event" as "event", 
      };
      
      const finalTicketTypes = (eventToSave.ticketTypes || []).map((tt, index) => ({
        ...tt,
        id: tt.id || `tt-${eventToSave.id || 'new'}-${Date.now()}-${index}`, 
        eventId: eventToSave.id || "", 
        businessId: currentBusinessId,
      }));
      const finalEventBoxes = (eventToSave.eventBoxes || []).map((eb, index) => ({
        ...eb,
        id: eb.id || `box-${eventToSave.id || 'new'}-${Date.now()}-${index}`,
        eventId: eventToSave.id || "",
        businessId: currentBusinessId,
      }));

      const finalAssignedPromoters = (eventToSave.assignedPromoters || []).map(ap => ({
        ...ap,
        commissionRules: (ap.commissionRules || []).map((cr, crIndex) => ({
          ...cr,
          id: cr.id || `cr-${ap.promoterProfileId}-${Date.now()}-${crIndex}`
        }))
      }));

      const sanitizedEventForFirestore = sanitizeObjectForFirestore({
          ...eventToSave,
          ticketTypes: finalTicketTypes.map(tt => sanitizeObjectForFirestore(tt)),
          eventBoxes: finalEventBoxes.map(eb => sanitizeObjectForFirestore(eb)),
          assignedPromoters: finalAssignedPromoters.map(ap => sanitizeObjectForFirestore(ap))
      });
      
      const payloadForFirestore: any = {
        ...sanitizedEventForFirestore, 
        startDate: Timestamp.fromDate(new Date(sanitizedEventForFirestore.startDate)),
        endDate: Timestamp.fromDate(new Date(sanitizedEventForFirestore.endDate)),
      };
      
      console.log("Events Page (SaveManaged): Updating/Creating event with payload:", payloadForFirestore);

      if (isDuplicatingEvent || !editingEvent.id) { 
           // eslint-disable-next-line @typescript-eslint/no-unused-vars
           const { id, createdAt, ...dataToCreate } = payloadForFirestore; 
           const createPayload = { ...dataToCreate, createdAt: serverTimestamp() };
           
           const docRef = await addDoc(collection(db, "businessEntities"), createPayload);
           toast({ title: isDuplicatingEvent ? "Evento Duplicado Exitosamente" : "Evento Creado Exitosamente", description: `El evento "${sanitizedEventForFirestore.name}" ha sido guardado con ID: ${docRef.id}.` });
      } else { 
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, createdAt, ...dataToUpdate } = payloadForFirestore; 
          await updateDoc(doc(db, "businessEntities", editingEvent.id), dataToUpdate);
          toast({ title: "Evento Guardado", description: `Los cambios en "${sanitizedEventForFirestore.name}" han sido guardados.` });
      }
      
      setShowManageEventModal(false);
      setEditingEvent(null);
      setIsDuplicatingEvent(false);
      fetchBusinessEvents();
    } catch (error: any) {
      console.error("Events Page: Error saving/updating event:", error.code, error.message, error);
      toast({ title: "Error al Guardar Evento", description: `No se pudo guardar el evento. ${error.message}`, variant: "destructive", duration: 10000});
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
    console.log("Events Page: handleNewCodesCreated called for entityId:", entityId, "New codes count:", newCodes.length, "Observation:", observation);
    if (isSubmitting) {
        console.log("Events Page: Submission already in progress, skipping new codes creation.");
        return;
    }
    if (!currentBusinessId || !userProfile?.name) {
        toast({ title: "Error", description: "ID de negocio o nombre de usuario no disponible.", variant: "destructive" });
        setIsSubmitting(false); // Ensure isSubmitting is reset if we exit early
        return;
    }
    
    setIsSubmitting(true);
    const targetEventRef = doc(db, "businessEntities", entityId);
    try {
        const targetEventSnap = await getDoc(targetEventRef);
        if (!targetEventSnap.exists()) {
            toast({title:"Error", description:"Evento no encontrado para añadir códigos.", variant: "destructive"});
            setIsSubmitting(false);
            return;
        }
        const targetEventData = targetEventSnap.data() as BusinessManagedEntity;
        const existingCodes = targetEventData.generatedCodes || [];

        const newCodesWithDetails = newCodes.map(code => sanitizeObjectForFirestore({
            ...code,
            generatedByName: userProfile.name, 
            observation: (observation && observation.trim() !== "") ? observation.trim() : null,
            redemptionDate: null, 
            redeemedByInfo: null, 
            isVipCandidate: false,
        }));

        const updatedCodes = [...existingCodes, ...newCodesWithDetails];
    
        await updateDoc(targetEventRef, { generatedCodes: updatedCodes });
        toast({title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${targetEventData.name}. Guardados en la base de datos.`});
        
        fetchBusinessEvents(); 

    } catch (error: any) {
        console.error("Events Page: Error saving new codes to Firestore:", error.code, error.message, error);
        toast({title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodesFromDialog: GeneratedCode[]) => {
    if (isSubmitting) return;
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
            toast({title:"Error", description:"Evento no encontrado para actualizar códigos.", variant: "destructive"});
            setIsSubmitting(false);
            return;
        }
        const targetEventData = targetEventSnap.data() as BusinessManagedEntity;
    
        const updatedCodesForFirestore = updatedCodesFromDialog.map(code => sanitizeObjectForFirestore(code));

        await updateDoc(targetEventRef, { generatedCodes: updatedCodesForFirestore });
        toast({title: "Códigos Actualizados", description: `Los códigos para "${targetEventData.name}" han sido guardados en la base de datos.`});
        
        if (editingEvent && editingEvent.id === entityId) {
             setEditingEvent(prev => prev ? {...prev, generatedCodes: updatedCodesForFirestore} : null);
        }
        fetchBusinessEvents();
    } catch (error: any) {
      console.error("Events Page: Error saving updated codes to Firestore:", error.code, error.message, error);
      toast({title: "Error al Guardar Códigos", description: `No se pudieron actualizar los códigos. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleEventStatus = async (eventToToggle: BusinessManagedEntity) => {
    if (isSubmitting) return;
    if (!currentBusinessId || !eventToToggle.id) {
        toast({ title: "Error", description: "ID de evento o negocio no disponible.", variant: "destructive" });
        setIsSubmitting(false); 
        return;
    }
    
    setIsSubmitting(true);
    const newStatus = !eventToToggle.isActive;
    const eventName = eventToToggle.name;
    
    try {
      await updateDoc(doc(db, "businessEntities", eventToToggle.id), { isActive: newStatus });
      toast({
        title: "Estado Actualizado",
        description: `El evento "${eventName}" ahora está ${newStatus ? "Activo" : "Inactivo"}.`
      });
       fetchBusinessEvents(); 
       if (editingEvent && editingEvent.id === eventToToggle.id) { 
          setEditingEvent(prev => prev ? {...prev, isActive: newStatus} : null);
      }
    } catch (error: any) {
      console.error("Events Page: Error updating event status:", error);
      toast({
        title: "Error al Actualizar Estado",
        description: `No se pudo cambiar el estado del evento. ${error.message}`,
        variant: "destructive"
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleOpenTicketFormModal = (ticket: TicketType | null) => {
      setEditingTicketInEventModal(ticket);
      setShowTicketFormInEventModal(true);
  };

  const handleCreateOrEditTicketTypeForEvent = (data: TicketTypeFormData) => {
      if (!editingEvent || !currentBusinessId) {
          toast({ title: "Error", description: "No hay un evento seleccionado o ID de negocio para añadir/editar entradas.", variant: "destructive" });
          return;
      }
      const currentTickets = editingEvent.ticketTypes || [];
      let updatedTickets: TicketType[];
      const sanitizedData = sanitizeObjectForFirestore(data) as TicketTypeFormData;

      if (editingTicketInEventModal && editingTicketInEventModal.id) { 
          updatedTickets = currentTickets.map(tt => 
              tt.id === editingTicketInEventModal.id ? { 
                  ...tt, 
                  ...sanitizedData, 
                  businessId: currentBusinessId, 
                  eventId: editingEvent.id || "",      
                  quantity: sanitizedData.quantity === undefined || sanitizedData.quantity === null || isNaN(Number(sanitizedData.quantity)) ? undefined : Number(sanitizedData.quantity),
              } : tt
          );
          toast({ title: "Entrada Actualizada", description: `La entrada "${sanitizedData.name}" ha sido actualizada en el editor.` });
      } else { 
          const newTicket: TicketType = {
              id: `tt-${editingEvent.id || 'new'}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              businessId: currentBusinessId,
              eventId: editingEvent.id || "", 
              ...sanitizedData,
              quantity: sanitizedData.quantity === undefined || sanitizedData.quantity === null || isNaN(Number(sanitizedData.quantity)) ? undefined : Number(sanitizedData.quantity),
          };
          updatedTickets = [...currentTickets, newTicket];
          toast({ title: "Entrada Creada", description: `La entrada "${sanitizedData.name}" ha sido añadida al evento en el editor.` });
      }
      
      const newMaxAttendance = calculateMaxAttendance(updatedTickets);
      setEditingEvent(prev => prev ? { ...prev, ticketTypes: updatedTickets, maxAttendance: newMaxAttendance } : null);
      setShowTicketFormInEventModal(false);
      setEditingTicketInEventModal(null);
  };

  const handleDeleteTicketTypeFromEvent = (ticketId: string) => {
      if (!editingEvent) return;
      const ticketToDelete = editingEvent.ticketTypes?.find(tt => tt.id === ticketId);
      if (!ticketToDelete) return;

      const updatedTickets = (editingEvent.ticketTypes || []).filter(tt => tt.id !== ticketId);
      const newMaxAttendance = calculateMaxAttendance(updatedTickets);
      setEditingEvent(prev => prev ? { ...prev, ticketTypes: updatedTickets, maxAttendance: newMaxAttendance } : null);
      toast({ title: `Entrada "${ticketToDelete.name}" Eliminada del Editor`, variant: "destructive" });
  };

  const handleOpenBoxFormModal = (box: EventBox | null) => {
      setEditingBoxInEventModal(box);
      setShowBoxFormInEventModal(true);
  };

  const handleCreateOrEditBoxForEvent = (data: EventBoxFormData) => {
      if (!editingEvent || !currentBusinessId) {
          toast({ title: "Error", description: "No hay un evento seleccionado o ID de negocio para añadir/editar boxes.", variant: "destructive" });
          return;
      }
      const currentBoxes = editingEvent.eventBoxes || [];
      let updatedBoxes: EventBox[];
      const sanitizedData = sanitizeObjectForFirestore(data) as EventBoxFormData; 

      if (editingBoxInEventModal && editingBoxInEventModal.id) { 
          updatedBoxes = currentBoxes.map(box => 
              box.id === editingBoxInEventModal.id ? { 
                  ...box, 
                  ...sanitizedData, 
                  businessId: currentBusinessId, 
                  eventId: editingEvent.id || "",      
              } : box
          );
          toast({ title: "Box Actualizado", description: `El box "${sanitizedData.name}" ha sido actualizado en el editor.` });
      } else { 
          const newBox: EventBox = {
              id: `box-${editingEvent.id || 'new'}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              businessId: currentBusinessId,
              eventId: editingEvent.id || "",
              ...sanitizedData
          };
          updatedBoxes = [...currentBoxes, newBox];
          toast({ title: "Box Creado", description: `El box "${sanitizedData.name}" ha sido añadido al evento en el editor.` });
      }
      setEditingEvent(prev => prev ? { ...prev, eventBoxes: updatedBoxes } : null);
      setShowBoxFormInEventModal(false);
      setEditingBoxInEventModal(null);
  };

  const handleDeleteBoxFromEvent = (boxId: string) => {
      if (!editingEvent) return;
      const boxToDelete = editingEvent.eventBoxes?.find(b => b.id === boxId);
      if (!boxToDelete) return;
      const updatedBoxes = (editingEvent.eventBoxes || []).filter(box => box.id !== boxId);
      setEditingEvent(prev => prev ? { ...prev, eventBoxes: updatedBoxes } : null);
      toast({ title: `Box "${boxToDelete.name}" Eliminado del Editor`, variant: "destructive" });
  };

  const handleCreateBatchBoxes = (data: BatchBoxFormData) => {
      if (!editingEvent || !currentBusinessId) {
          toast({ title: "Error", description: "No hay un evento seleccionado para crear boxes en lote.", variant: "destructive" });
          return;
      }
      const existingBoxNames = new Set((editingEvent.eventBoxes || []).map(b => b.name.toLowerCase()));
      const newBoxes: EventBox[] = [];
      let hasDuplicates = false;

      for (let i = data.fromNumber; i <= data.toNumber; i++) {
          const boxName = `${data.prefix} ${i}`;
          if (existingBoxNames.has(boxName.toLowerCase())) {
              hasDuplicates = true;
              toast({ title: "Error: Box Duplicado", description: `El box "${boxName}" ya existe en este evento. No se creó ningún box del lote.`, variant: "destructive" });
              break;
          }
          newBoxes.push(
              sanitizeObjectForFirestore({ 
                  id: `box-batch-${editingEvent.id || 'new'}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
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

      if (!hasDuplicates) {
          setEditingEvent(prev => prev ? { ...prev, eventBoxes: [...(prev.eventBoxes || []), ...newBoxes] } : null);
          toast({ title: "Lote de Boxes Creado", description: `${newBoxes.length} boxes han sido añadidos al evento en el editor.` });
          setShowCreateBatchBoxesModal(false);
      }
  };

  const handleAssignPromoterToEvent = () => {
      if (!editingEvent || !selectedPromoterForAssignment || !currentBusinessId) {
          toast({ title: "Error", description: "Selecciona un evento y un promotor, o falta ID de negocio.", variant: "destructive" });
          return;
      }
      const promoterLinkData = availablePromotersForAssignment.find(pLink => pLink.id === selectedPromoterForAssignment);

      if (!promoterLinkData) {
          toast({ title: "Error", description: "Datos del promotor vinculado no encontrados.", variant: "destructive" });
          return;
      }

      const promoterIdentifierForAssignment = promoterLinkData.platformUserUid || promoterLinkData.promoterDni || promoterLinkData.id;

      const existingAssignment = editingEvent.assignedPromoters?.find(ap => ap.promoterProfileId === promoterIdentifierForAssignment);
      if (existingAssignment) {
          toast({ title: "Promotor ya Asignado", description: `${promoterLinkData.promoterName} ya está asignado a este evento.`, variant: "destructive"});
          return;
      }

      const newAssignment: EventPromoterAssignment = sanitizeObjectForFirestore({ 
          promoterProfileId: promoterIdentifierForAssignment,
          promoterName: promoterLinkData.promoterName,
          promoterEmail: promoterLinkData.promoterEmail,
          commissionRules: [], 
          notes: "",
      }) as EventPromoterAssignment;

      setEditingEvent(prev => {
          if (!prev) return null;
          return { ...prev, assignedPromoters: [...(prev.assignedPromoters || []), newAssignment] };
      });
      setSelectedPromoterForAssignment("");
      toast({ title: "Promotor Asignado al Evento", description: `${promoterLinkData.promoterName} asignado al evento en el editor.` });
  };

  const handleRemovePromoterFromEvent = (promoterProfileIdToRemove: string) => {
      if (!editingEvent) return;
      const promoterToRemove = editingEvent.assignedPromoters?.find(ap => ap.promoterProfileId === promoterProfileIdToRemove);
      if (!promoterToRemove) return;
      setEditingEvent(prev => prev ? { ...prev, assignedPromoters: (prev.assignedPromoters || []).filter(ap => ap.promoterProfileId !== promoterProfileIdToRemove) } : null);
      toast({ title: `Promotor "${promoterToRemove.promoterName}" Desvinculado del Evento`, variant: "destructive"});
  };

  const handleOpenCommissionRuleForm = (assignment: EventPromoterAssignment, rule?: CommissionRule) => {
      setCurrentPromoterAssignmentForRules(assignment);
      setEditingCommissionRule(rule || null);
      commissionRuleForm.reset({
          appliesTo: rule?.appliesTo || 'event_general',
          appliesToId: rule?.appliesToId || undefined,
          appliesToName: rule?.appliesToName || "",
          commissionType: rule?.commissionType || 'fixed',
          commissionValue: rule?.commissionValue || 0,
          description: rule?.description || ""
      });
      setShowCommissionRuleForm(true);
  };

  const handleCommissionRuleFormSubmit = (data: CommissionRuleFormValues) => {
      if (!editingEvent || !currentPromoterAssignmentForRules) return;

      const updatedAssignments = (editingEvent.assignedPromoters || []).map(assignment => {
          if (assignment.promoterProfileId === currentPromoterAssignmentForRules.promoterProfileId) {
              let updatedRules = [...(assignment.commissionRules || [])];
              const sanitizedRuleData = sanitizeObjectForFirestore(data) as CommissionRuleFormValues;
              
              let ruleAppliesToName = "General del Evento"; 
              if (sanitizedRuleData.appliesTo === 'ticket_type' && sanitizedRuleData.appliesToId) {
                  const ticket = editingEvent.ticketTypes?.find(t => t.id === sanitizedRuleData.appliesToId);
                  ruleAppliesToName = ticket?.name || `Entrada ID: ${sanitizedRuleData.appliesToId.substring(0,6)}`;
              } else if (sanitizedRuleData.appliesTo === 'box_type' && sanitizedRuleData.appliesToId) {
                  const box = editingEvent.eventBoxes?.find(b => b.id === sanitizedRuleData.appliesToId);
                  ruleAppliesToName = box?.name || `Box ID: ${sanitizedRuleData.appliesToId.substring(0,6)}`;
              }
              
              const newRuleBase: Omit<CommissionRule, 'id'> = {
                  appliesTo: sanitizedRuleData.appliesTo,
                  appliesToId: sanitizedRuleData.appliesTo === 'event_general' ? undefined : sanitizedRuleData.appliesToId,
                  appliesToName: ruleAppliesToName, 
                  commissionType: sanitizedRuleData.commissionType,
                  commissionValue: sanitizedRuleData.commissionValue || 0,
                  description: sanitizedRuleData.description || ""
              };
              

              if (editingCommissionRule && editingCommissionRule.id) { 
                  updatedRules = updatedRules.map(rule => rule.id === editingCommissionRule.id ? { ...newRuleBase, id: rule.id } : rule);
              } else { 
                  const newRule: CommissionRule = {
                      id: `cr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      ...newRuleBase,
                  };
                  updatedRules.push(newRule);
              }
              return { ...assignment, commissionRules: updatedRules };
          }
          return assignment;
      });

      setEditingEvent(prev => prev ? { ...prev, assignedPromoters: updatedAssignments } : null);
      setShowCommissionRuleForm(false);
      setEditingCommissionRule(null);
      setCurrentPromoterAssignmentForRules(null);
      toast({ title: editingCommissionRule ? "Regla de Comisión Actualizada" : "Regla de Comisión Añadida" });
  };

  const handleDeleteCommissionRule = (assignmentPromoterId: string, ruleId: string) => {
      if (!editingEvent) return;
      const assignedPromoter = editingEvent.assignedPromoters?.find(ap => ap.promoterProfileId === assignmentPromoterId);
      const ruleToDelete = assignedPromoter?.commissionRules?.find(r => r.id === ruleId);
      if (!ruleToDelete) return;

      const updatedAssignments = (editingEvent.assignedPromoters || []).map(assignment => {
          if (assignment.promoterProfileId === assignmentPromoterId) {
              const updatedRules = (assignment.commissionRules || []).filter(rule => rule.id !== ruleId);
              return { ...assignment, commissionRules: updatedRules };
          }
          return assignment;
      });
      setEditingEvent(prev => prev ? { ...prev, assignedPromoters: updatedAssignments } : null);
      toast({ title: `Regla de Comisión "${ruleToDelete.appliesToName}" Eliminada del Editor`, variant: "destructive"});
  };

  const openStatsModal = (event: BusinessManagedEntity) => {
      setSelectedEventForStats(event);
      setShowStatsModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando eventos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <CalendarIconLucide className="h-8 w-8 mr-2" /> Gestión de Eventos
        </h1>
        <Button onClick={() => handleOpenManageEventModal(null)} className="bg-primary hover:bg-primary/90" disabled={!currentBusinessId}>
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Evento
        </Button>
      </div>
      
      {!currentBusinessId && !loadingAuth && !loadingProfile &&(
        <Card className="shadow-lg">
          <CardHeader><CardTitle className="text-destructive">Error de Configuración del Negocio</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Tu perfil de usuario no está asociado a un negocio válido para cargar eventos.</p></CardContent>
        </Card>
      )}

      {currentBusinessId && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Mis Eventos</CardTitle>
            <CardDescription>Crea y administra los eventos de tu negocio.</CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre o descripción..."
                className="pl-8 w-full sm:w-[300px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 && !searchTerm ? (
              <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
                No hay eventos registrados. Haz clic en "Crear Evento" para empezar.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Nombre y Estado</TableHead>
                      <TableHead>Vigencia</TableHead>
                      <TableHead className="text-center">QRs Entrada</TableHead>
                      <TableHead>Códigos</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.length > 0 ? (
                      filteredEvents.map((event) => (
                        <TableRow key={event.id || `event-fallback-${Math.random()}`}>
                          <TableCell className="font-medium align-top py-2">
                            <div className="font-semibold">{event.name}</div>
                            <div className="flex items-center space-x-2 mt-1">
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
                                <Badge variant={event.isActive ? "default" : "outline"} className={cn(event.isActive ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600 text-white", !isEntityCurrentlyActivatable(event) && event.isActive && "bg-yellow-500 hover:bg-yellow-600 text-black")}>
                                    {event.isActive ? (isEntityCurrentlyActivatable(event) ? "Vigente" : "Activo (Fuera de Fecha)") : "Inactivo"}
                                </Badge>
                            </div>
                            <div className="flex flex-col items-start gap-1 mt-2">
                                <Button variant="outline" size="xs" onClick={() => handleOpenManageEventModal(event)} disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                  <Edit className="h-3 w-3 mr-1" /> Gestionar
                                </Button>
                                <Button variant="outline" size="xs" onClick={() => openStatsModal(event)} disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                    <BarChart3 className="h-3 w-3 mr-1" /> Estadísticas
                                </Button>
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-2">
                            {event.startDate ? format(parseISO(event.startDate), "P", { locale: es }) : 'N/A'}
                            <br />
                            {event.endDate ? format(parseISO(event.endDate), "P", { locale: es }) : 'N/A'}
                          </TableCell>
                           <TableCell className="text-center align-top py-2">
                                <div className="flex flex-col text-xs">
                                    <span>QRs Generados: {event.generatedCodes?.length || 0}</span>
                                    <span>QRs Usados: {event.generatedCodes?.filter(c => c.status === 'redeemed').length || 0}</span>
                                    <span>Aforo Máximo: {event.maxAttendance && event.maxAttendance > 0 ? event.maxAttendance : 'Ilimitado'}</span>
                                </div>
                           </TableCell>
                           <TableCell className="align-top space-y-1 py-2">
                              <Button variant="outline" size="xs" onClick={() => openCreateCodesDialog(event)} disabled={!isEntityCurrentlyActivatable(event) || isSubmitting} className="px-2 py-1 h-auto text-xs">
                                <QrCodeIcon className="h-3 w-3 mr-1" /> Crear
                              </Button>
                              <Button variant="outline" size="xs" onClick={() => openViewCodesDialog(event)} disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                <ListChecks className="h-3 w-3 mr-1" /> Ver ({event.generatedCodes?.length || 0})
                              </Button>
                           </TableCell>
                          <TableCell className="align-top space-y-1 py-2">
                            <Button variant="outline" size="xs" onClick={() => handleOpenManageEventModal(event, true)} disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                              <Copy className="h-3 w-3 mr-1" /> Duplicar
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="xs" disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                  <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle>
                                  <UIDialogDescription>
                                    Esta acción no se puede deshacer. Esto eliminará permanentemente el evento:
                                    <span className="font-semibold"> {event.name}</span> y todos sus datos asociados.
                                  </UIDialogDescription>
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
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">No se encontraron eventos con los filtros aplicados.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    <Dialog open={showInitialEventModal} onOpenChange={(isOpen) => {
        if (!isOpen) initialEventForm.reset();
        setShowInitialEventModal(isOpen);
    }}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Paso 1: Crear Evento Básico</DialogTitle>
                <UIDialogDescription>Ingresa los detalles iniciales de tu evento. Podrás configurar entradas, boxes y más opciones después.</UIDialogDescription>
            </DialogHeader>
            <Form {...initialEventForm}>
                <form onSubmit={initialEventForm.handleSubmit(handleInitialEventSubmit)} className="space-y-4 py-2">
                    <FormField
                        control={initialEventForm.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <Label>Nombre del Evento <span className="text-destructive">*</span></Label>
                                <FormControl><Input placeholder="Ej: Concierto de Verano" {...field} disabled={isSubmitting} /></FormControl>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                            control={initialEventForm.control}
                            name="startDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>Fecha de Inicio <span className="text-destructive">*</span></FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>
                                            {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                                            <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
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
                                <FormLabel>Fecha de Fin <span className="text-destructive">*</span></FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>
                                            {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                                            <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarShadcnUi mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => initialEventForm.getValues("startDate") ? isBefore(date, startOfDay(initialEventForm.getValues("startDate"))) : false} locale={es} initialFocus />
                                    </PopoverContent>
                                </Popover>
                                <FormMessageHook />
                                </FormItem>
                            )}
                        />
                    </div>
                    <UIDialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => {setShowInitialEventModal(false); initialEventForm.reset();}} disabled={isSubmitting}>Cancelar</Button>
                        <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Continuar y Configurar"}
                        </Button>
                    </UIDialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
      
    <Dialog open={showManageEventModal} onOpenChange={(isOpen) => {
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
    }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
            <DialogHeader>
                <DialogTitle>
                  {isDuplicatingEvent ? `Duplicar Evento: ${(editingEvent?.name || 'Evento').replace(' (Copia)','')} (Copia)` : (editingEvent?.id ? `Gestionar Evento: ${editingEvent.name}` : "Gestionar Nuevo Evento")}
                </DialogTitle>
                <UIDialogDescription>
                  {isDuplicatingEvent ? "Creando una copia. Ajusta los detalles." : (editingEvent?.id ? "Modifica los detalles, entradas, boxes y promotores de tu evento." : "Completa los detalles principales de tu nuevo evento.")}
                </UIDialogDescription>
            </DialogHeader>

            {editingEvent && ( 
                 <ScrollArea className="max-h-[calc(90vh-220px)] pr-5"> 
                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 mb-4"> {/* Changed from grid-cols-5 */}
                            <TabsTrigger value="details">Detalles</TabsTrigger>
                            <TabsTrigger value="tickets">Entradas ({editingEvent.ticketTypes?.length || 0})</TabsTrigger>
                            <TabsTrigger value="boxes">Boxes ({editingEvent.eventBoxes?.length || 0})</TabsTrigger>
                            <TabsTrigger value="promoters">Promotores ({editingEvent.assignedPromoters?.length || 0})</TabsTrigger>
                        </TabsList>

                        <TabsContent value="details">
                            <BusinessEventForm
                                event={editingEvent}
                                onSubmit={handleMainEventFormSubmit}
                                isSubmitting={isSubmitting} 
                            />
                        </TabsContent>

                        <TabsContent value="tickets">
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle>Entradas para "{editingEvent.name}"</CardTitle>
                                        <Button onClick={() => handleOpenTicketFormModal(null)} size="sm" disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4"/>Añadir Entrada</Button>
                                    </div>
                                    <CardDescription>Define los diferentes tipos de entrada. El aforo total se calcula a partir de estas.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {(editingEvent.ticketTypes || []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No hay tipos de entrada definidos para este evento.</p>
                                    ) : (
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Costo (S/)</TableHead><TableHead>Descripción</TableHead><TableHead>Cantidad</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {editingEvent.ticketTypes?.map((tt) => (
                                                    <TableRow key={tt.id || `tt-fallback-${Math.random()}`}>
                                                        <TableCell>{tt.name}</TableCell><TableCell>{tt.cost.toFixed(2)}</TableCell><TableCell className="max-w-xs truncate" title={tt.description || undefined}>{tt.description || "N/A"}</TableCell><TableCell>{tt.quantity === undefined || tt.quantity === null || tt.quantity <= 0 ? 'Ilimitada' : tt.quantity}</TableCell>
                                                        <TableCell className="text-right">
                                                          <Button variant="ghost" size="icon" onClick={() => handleOpenTicketFormModal(tt)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                                                          <AlertDialog>
                                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader><UIAlertDialogTitle>¿Eliminar Entrada?</UIAlertDialogTitle><UIDialogDescription>Se eliminará la entrada "{tt.name}". Esta acción no se puede deshacer del editor hasta que guarde el evento.</UIDialogDescription></AlertDialogHeader>
                                                                <AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTicketTypeFromEvent(tt.id!)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>Eliminar del Editor</AlertDialogAction></AlertDialogFooter>
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
                                            <Button onClick={() => setShowCreateBatchBoxesModal(true)} size="sm" variant="outline" disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4"/>Crear Lote</Button>
                                            <Button onClick={() => handleOpenBoxFormModal(null)} size="sm" disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4"/>Añadir Box</Button>
                                        </div>
                                    </div>
                                    <CardDescription>Define los boxes disponibles para este evento.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {(editingEvent.eventBoxes || []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No hay boxes definidos para este evento.</p>
                                    ) : (
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Costo (S/)</TableHead><TableHead>Estado</TableHead><TableHead>Capacidad</TableHead><TableHead>Vendedor</TableHead><TableHead>Dueño (Cliente)</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {editingEvent.eventBoxes?.map((box) => (
                                                    <TableRow key={box.id || `box-fallback-${Math.random()}`}>
                                                        <TableCell>{box.name}</TableCell><TableCell>{box.cost.toFixed(2)}</TableCell><TableCell><Badge variant={box.status === 'available' ? 'default' : 'secondary'} className={box.status === 'available' ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}>{box.status === 'available' ? 'Disponible' : 'No Disponible'}</Badge></TableCell><TableCell>{box.capacity || 'N/A'}</TableCell><TableCell>{box.sellerName || 'N/A'}</TableCell><TableCell>{box.ownerName ? `${box.ownerName} (${box.ownerDni || 'N/A'})` : 'N/A'}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => handleOpenBoxFormModal(box)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader><UIAlertDialogTitle>¿Eliminar Box?</UIAlertDialogTitle><UIDialogDescription>Se eliminará el box "{box.name}" del editor.</UIDialogDescription></AlertDialogHeader>
                                                                    <AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBoxFromEvent(box.id!)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>Eliminar del Editor</AlertDialogAction></AlertDialogFooter>
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
                                    <CardDescription>Vincula promotores a este evento y define sus reglas de comisión específicas.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-end gap-2">
                                        <div className="flex-grow">
                                            <Label htmlFor="select-promoter-event">Seleccionar Promotor <span className="text-destructive">*</span></Label>
                                            <Select 
                                                value={selectedPromoterForAssignment} 
                                                onValueChange={setSelectedPromoterForAssignment} 
                                                disabled={isSubmitting || availablePromotersForAssignment.length === 0}
                                            >
                                                <SelectTrigger id="select-promoter-event">
                                                    <SelectValue placeholder={availablePromotersForAssignment.length === 0 ? "No hay promotores vinculados" : "Elige un promotor"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {console.log("Events Page - Rendering SelectContent for promoters. Available:", availablePromotersForAssignment)}
                                                    {availablePromotersForAssignment.length === 0 && (
                                                        <SelectItem value="no-promoters" disabled key="no-promoters-item-events-tab">
                                                            No hay promotores activos vinculados al negocio
                                                        </SelectItem>
                                                    )}
                                                    {availablePromotersForAssignment.map((pLink, index) => {
                                                        const key = pLink && pLink.id ? pLink.id : `promoter-select-item-${index}-${Math.random()}`;
                                                        const value = pLink && pLink.id ? pLink.id : `promoter-value-fallback-${index}-${Math.random()}`; 
                                                        if (!pLink || !pLink.id) {
                                                            console.warn("Events Page - Promoter Select: Missing pLink or pLink.id for item at index", index, pLink);
                                                        }
                                                        return (
                                                            <SelectItem key={key} value={value}>
                                                                {pLink.promoterName || "Nombre Desconocido"} ({pLink.promoterEmail || "Email Desconocido"})
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button onClick={handleAssignPromoterToEvent} disabled={isSubmitting || !selectedPromoterForAssignment}>Asignar a Evento</Button>
                                    </div>
                                    <h4 className="text-md font-semibold pt-2">Promotores Asignados a este Evento:</h4>
                                    {(editingEvent.assignedPromoters || []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Aún no hay promotores asignados a este evento.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {editingEvent.assignedPromoters?.map(ap => (
                                                <Card key={ap.promoterProfileId || `ap-fallback-${Math.random()}`} className="p-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-semibold">{ap.promoterName} <span className="text-xs text-muted-foreground">({ap.promoterEmail || 'N/A'})</span></p>
                                                            {ap.notes && <p className="text-xs text-muted-foreground italic mt-0.5">Notas: {ap.notes}</p>}
                                                        </div>
                                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemovePromoterFromEvent(ap.promoterProfileId)} disabled={isSubmitting}>Desvincular</Button>
                                                    </div>
                                                    <div className="mt-2">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <h5 className="text-xs font-medium text-muted-foreground">Reglas de Comisión Específicas del Evento:</h5>
                                                            <Button size="xs" variant="outline" onClick={() => handleOpenCommissionRuleForm(ap)} disabled={isSubmitting}><PlusCircle className="mr-1 h-3 w-3"/>Añadir Regla</Button>
                                                        </div>
                                                        {(ap.commissionRules || []).length === 0 ? <p className="text-xs text-muted-foreground italic">Sin reglas específicas.</p> : (
                                                            <ul className="list-disc list-inside pl-2 space-y-0.5 text-xs">
                                                                {(ap.commissionRules || []).map(rule => (
                                                                    <li key={rule.id || `cr-fallback-${Math.random()}`} className="flex justify-between items-center">
                                                                        <span>
                                                                            {rule.appliesTo === 'event_general' ? 'General Evento' : 
                                                                            (rule.appliesToName ? `${rule.appliesToName}` : `ID: ${rule.appliesToId?.substring(0,5)}...`)}: 
                                                                            {rule.commissionType === 'fixed' ? `S/ ${(rule.commissionValue || 0).toFixed(2)}` : `${rule.commissionValue || 0}%`}
                                                                            {rule.description ? ` (${rule.description})` : ''}
                                                                        </span>
                                                                        <div>
                                                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleOpenCommissionRuleForm(ap, rule)} disabled={isSubmitting}><Edit className="h-3 w-3" /></Button>
                                                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-5 w-5" onClick={() => handleDeleteCommissionRule(ap.promoterProfileId, rule.id!)} disabled={isSubmitting}><Trash2 className="h-3 w-3" /></Button>
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
            <UIDialogFooter className="pt-6 border-t mt-4">
                <Button variant="outline" onClick={() => { setShowManageEventModal(false); setEditingEvent(null); setIsDuplicatingEvent(false); }} disabled={isSubmitting}>
                    Cancelar
                </Button>
                <Button onClick={handleSaveManagedEventAndClose} className="bg-primary hover:bg-primary/90" disabled={isSubmitting || !editingEvent}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (!editingEvent || !editingEvent.id || isDuplicatingEvent ? "Crear Evento y Cerrar" : "Guardar Cambios y Cerrar")}
                </Button>
            </UIDialogFooter>
        </DialogContent>
    </Dialog>

    {/* Modal for TicketTypeForm */}
    <Dialog open={showTicketFormInEventModal} onOpenChange={(isOpen) => {
        if(!isOpen) setEditingTicketInEventModal(null);
        setShowTicketFormInEventModal(isOpen);
    }}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{editingTicketInEventModal ? "Editar Tipo de Entrada" : "Añadir Nuevo Tipo de Entrada"}</DialogTitle>
                <UIDialogDescription>Para el evento: {editingEvent?.name}</UIDialogDescription>
            </DialogHeader>
            <TicketTypeForm 
                ticketType={editingTicketInEventModal || undefined}
                onSubmit={handleCreateOrEditTicketTypeForEvent}
                onCancel={() => { setShowTicketFormInEventModal(false); setEditingTicketInEventModal(null); }}
                isSubmitting={isSubmitting} 
            />
        </DialogContent>
    </Dialog>

    {/* Modal for EventBoxForm */}
     <Dialog open={showBoxFormInEventModal} onOpenChange={(isOpen) => {
         if(!isOpen) setEditingBoxInEventModal(null);
         setShowBoxFormInEventModal(isOpen);
     }}>
        <DialogContent className="sm:max-w-lg"> 
            <DialogHeader>
                <DialogTitle>{editingBoxInEventModal ? "Editar Box" : "Añadir Nuevo Box"}</DialogTitle>
                <UIDialogDescription>Para el evento: {editingEvent?.name}</UIDialogDescription>
            </DialogHeader>
            <EventBoxForm
                eventBox={editingBoxInEventModal || undefined}
                onSubmit={handleCreateOrEditBoxForEvent}
                onCancel={() => { setShowBoxFormInEventModal(false); setEditingBoxInEventModal(null); }}
                isSubmitting={isSubmitting} 
            />
        </DialogContent>
    </Dialog>

    {/* Modal for CreateBatchBoxesDialog */}
    {editingEvent && (
         <CreateBatchBoxesDialog
            open={showCreateBatchBoxesModal}
            onOpenChange={setShowCreateBatchBoxesModal}
            onSubmit={handleCreateBatchBoxes}
            isSubmitting={isSubmitting}
        />
    )}

    {/* Modal for CommissionRuleForm */}
    <Dialog open={showCommissionRuleForm} onOpenChange={(isOpen) => {
        if (!isOpen) {
            setEditingCommissionRule(null);
            setCurrentPromoterAssignmentForRules(null);
            commissionRuleForm.reset();
        }
        setShowCommissionRuleForm(isOpen);
    }}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>{editingCommissionRule ? "Editar Regla de Comisión" : "Añadir Nueva Regla de Comisión"}</DialogTitle>
                <UIDialogDescription>Para: {currentPromoterAssignmentForRules?.promoterName} en el evento "{editingEvent?.name}"</UIDialogDescription>
            </DialogHeader>
            <Form {...commissionRuleForm}>
                <form onSubmit={commissionRuleForm.handleSubmit(handleCommissionRuleFormSubmit)} className="space-y-4 py-2">
                    <FormField
                        control={commissionRuleForm.control}
                        name="appliesTo"
                        render={({ field }) => (
                            <FormItem>
                                <Label>Aplica A <span className="text-destructive">*</span></Label>
                                <Select onValueChange={(value) => {
                                    field.onChange(value);
                                    commissionRuleForm.setValue("appliesToId", undefined); 
                                    commissionRuleForm.setValue("appliesToName", "");
                                }} value={field.value} disabled={isSubmitting}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                    {commissionRuleForm.watch("appliesTo") === 'ticket_type' && editingEvent?.ticketTypes && editingEvent.ticketTypes.length > 0 && (
                        <FormField
                            control={commissionRuleForm.control}
                            name="appliesToId"
                            render={({ field }) => (
                                <FormItem>
                                    <Label>Seleccionar Tipo de Entrada <span className="text-destructive">*</span></Label>
                                    <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Elige una entrada" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {editingEvent.ticketTypes?.map(tt => <SelectItem key={tt.id || `tt-select-${Math.random()}`} value={tt.id!}>{tt.name} (S/ {tt.cost.toFixed(2)})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessageHook />
                                </FormItem>
                            )}
                        />
                    )}
                     {commissionRuleForm.watch("appliesTo") === 'box_type' && editingEvent?.eventBoxes && editingEvent.eventBoxes.length > 0 && (
                        <FormField
                            control={commissionRuleForm.control}
                            name="appliesToId"
                            render={({ field }) => (
                                <FormItem>
                                    <Label>Seleccionar Tipo de Box <span className="text-destructive">*</span></Label>
                                    <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Elige un box" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {editingEvent.eventBoxes?.map(b => <SelectItem key={b.id || `box-select-${Math.random()}`} value={b.id!}>{b.name} (S/ {b.cost.toFixed(2)})</SelectItem>)}
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
                                <Label>Tipo de Comisión <span className="text-destructive">*</span></Label>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                                     <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                                <Label>Valor de Comisión <span className="text-destructive">*</span></Label>
                                <FormControl><Input type="number" placeholder="Ej: 5 o 10" {...field} disabled={isSubmitting} /></FormControl>
                                <FormDescription className="text-xs">Si es porcentaje, ingresa solo el número (ej: 10 para 10%).</FormDescription>
                                <FormMessageHook />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={commissionRuleForm.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <Label>Descripción de la Regla (Opcional)</Label>
                                <FormControl><Textarea placeholder="Ej: Por cada entrada VIP vendida" {...field} value={field.value || ""} rows={2} disabled={isSubmitting} /></FormControl>
                                <FormMessageHook />
                            </FormItem>
                        )}
                    />
                    <UIDialogFooter className="pt-3">
                        <Button type="button" variant="outline" onClick={() => {setShowCommissionRuleForm(false); commissionRuleForm.reset();}} disabled={isSubmitting}>Cancelar</Button>
                        <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingCommissionRule ? "Guardar Regla" : "Añadir Regla")}
                        </Button>
                    </UIDialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    {/* Modal for Event Statistics (Standalone) */}
    <Dialog open={showStatsModal} onOpenChange={(isOpen) => { if (!isOpen) setSelectedEventForStats(null); setShowStatsModal(isOpen);}}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Estadísticas para: {selectedEventForStats?.name}</DialogTitle>
                <UIDialogDescription>Resumen del rendimiento del evento.</UIDialogDescription>
            </DialogHeader>
            {selectedEventForStats && (
                <div className="space-y-3 py-4">
                    <p><strong>Códigos Generados (Total):</strong> {selectedEventForStats.generatedCodes?.length || 0}</p>
                    <p><strong>Códigos Canjeados/Asistentes:</strong> {selectedEventForStats.generatedCodes?.filter(c => c.status === 'redeemed').length || 0}</p>
                    <p><strong>Tasa de Canje/Asistencia:</strong> {selectedEventForStats.generatedCodes && selectedEventForStats.generatedCodes.length > 0 ? 
                        ((selectedEventForStats.generatedCodes.filter(c => c.status === 'redeemed').length / selectedEventForStats.generatedCodes.length) * 100).toFixed(1) + '%' 
                        : '0%'}
                    </p>
                    <p><strong>Aforo Máximo Configurado:</strong> {selectedEventForStats.maxAttendance === 0 || !selectedEventForStats.maxAttendance ? 'Ilimitado (o no configurado por entradas)' : selectedEventForStats.maxAttendance}</p>
                    <div className="border-t pt-3 mt-3">
                        <h4 className="font-semibold text-muted-foreground">Más Detalles (Ejemplos):</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                            <li>Top Promotor (Ventas): [Nombre Promotor Ejemplo]</li>
                            <li>Entrada Más Popular: [Nombre Entrada Ejemplo]</li>
                            <li>Ingresos Estimados por Entradas: S/ [Monto Ejemplo]</li>
                        </ul>
                    </div>
                </div>
            )}
            <UIDialogFooter>
                <Button variant="outline" onClick={() => {setShowStatsModal(false); setSelectedEventForStats(null);}}>Cerrar</Button>
            </UIDialogFooter>
        </DialogContent>
    </Dialog>


    {selectedEntityForCreatingCodes && userProfile && (
      <CreateCodesDialog
        open={showCreateCodesModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedEntityForCreatingCodes(null);
          setShowCreateCodesModal(isOpen);
         }}
        entityName={selectedEntityForCreatingCodes.name}
        entityId={selectedEntityForCreatingCodes.id!} 
        existingCodesValues={(selectedEntityForCreatingCodes.generatedCodes || []).map(c => c.value)}
        onCodesCreated={handleNewCodesCreated}
        isSubmittingMain={isSubmitting} 
        currentUserProfileName={userProfile.name}
      />
    )}

    {selectedEntityForViewingCodes && (
      <ManageCodesDialog
        open={showManageCodesModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedEntityForViewingCodes(null); 
          setShowManageCodesModal(isOpen);
        }}
        entity={selectedEntityForViewingCodes}
        onCodesUpdated={handleCodesUpdatedFromManageDialog}
        onRequestCreateNewCodes={() => {
          const currentEntity = events.find(e => e.id === selectedEntityForViewingCodes?.id); 
          if(currentEntity) { 
              if (isEntityCurrentlyActivatable(currentEntity)) {
                  setShowManageCodesModal(false); 
                  setSelectedEntityForCreatingCodes(currentEntity);
                  setShowCreateCodesModal(true);
              } else {
                  toast({
                      title: "No se pueden crear códigos",
                      description: "Este evento no está activo o está fuera de su periodo de vigencia.",
                      variant: "destructive"
                  });
              }
          }
        }}
      />
    )}
    </div>
  );
}

    
