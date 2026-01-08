
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Megaphone, Send, Users, Activity, Repeat, UserCheck, Cake, Moon, Gift } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import type { BusinessManagedEntity, QrClient, Business } from "@/lib/types";
import { anyToDate, isEntityCurrentlyActivatable } from "@/lib/utils";
import { isPast, getMonth, differenceInDays } from 'date-fns';
import { MESES_DEL_ANO_ES } from "@/lib/constants";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from "@/components/ui/label";
import { BirthdayCampaignModal } from '@/components/business/marketing/BirthdayCampaignModal';

export default function MarketingPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  
  const [allEntities, setAllEntities] = useState<BusinessManagedEntity[]>([]);
  const [allClients, setAllClients] = useState<QrClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);

  // Estados para segmentación
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [eventAttendeeClients, setEventAttendeeClients] = useState<QrClient[]>([]);
  
  const [loyaltyThreshold, setLoyaltyThreshold] = useState<number>(3);
  const [loyalClients, setLoyalClients] = useState<QrClient[]>([]);

  const [birthdayMonth, setBirthdayMonth] = useState<string>('');
  const [birthdayClients, setBirthdayClients] = useState<QrClient[]>([]);
  
  const [inactiveDays, setInactiveDays] = useState<number>(90);
  const [inactiveClients, setInactiveClients] = useState<QrClient[]>([]);
  
  const [manualSelection, setManualSelection] = useState<Set<string>>(new Set());
  const [manualSearchTerm, setManualSearchTerm] = useState('');

  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  // Estados de los modales
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showEventCampaignModal, setShowEventCampaignModal] = useState(false);
  const [showInactiveCampaignModal, setShowInactiveCampaignModal] = useState(false);
  const [showManualCampaignModal, setShowManualCampaignModal] = useState(false);

  const pastEvents = useMemo(() => {
    return allEntities
        .filter(event => event.type === 'event' && event.endDate && isPast(anyToDate(event.endDate) || new Date()))
        .sort((a,b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  }, [allEntities]);
  
  const activePromotions = useMemo(() => {
    return allEntities
        .filter(promo => promo.type === 'promotion' && isEntityCurrentlyActivatable(promo));
  }, [allEntities]);

  const fetchData = useCallback(async () => {
    if (!userProfile?.businessId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const businessId = userProfile.businessId;

      const businessDoc = await getDoc(doc(db, "businesses", businessId));
      if (businessDoc.exists()) {
        setBusinessDetails({ id: businessDoc.id, ...businessDoc.data() } as Business);
      }
      
      const entitiesQuery = query(collection(db, "businessEntities"), where("businessId", "==", businessId));
      const entitiesSnap = await getDocs(entitiesQuery);
      const fetchedEntities = entitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessManagedEntity));
      setAllEntities(fetchedEntities);
      
      const clientsQuery = query(collection(db, "qrClients"), where("associatedBusinessIds", "array-contains", businessId));
      const clientsSnap = await getDocs(clientsQuery);
      const fetchedClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as QrClient));
      setAllClients(fetchedClients);

    } catch (error: any) {
      toast({ title: "Error", description: `No se pudieron cargar los datos necesarios: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [userProfile?.businessId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSegmentByEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    if (!eventId) {
      setEventAttendeeClients([]);
      return;
    }
    setIsProcessing('event');
    const selectedEvent = allEntities.find(e => e.id === eventId);
    if (!selectedEvent || !selectedEvent.generatedCodes) {
      setEventAttendeeClients([]);
      setIsProcessing(null);
      return;
    }
    const attendeeDnis = new Set<string>();
    selectedEvent.generatedCodes.forEach(code => {
      if (code.status === 'used' && code.redeemedByInfo?.dni) {
        attendeeDnis.add(code.redeemedByInfo.dni);
      }
    });

    const attendeeClients = allClients.filter(client => attendeeDnis.has(client.dni));
    setEventAttendeeClients(attendeeClients);
    setIsProcessing(null);
  };

  const handleSegmentByLoyalty = () => {
    setIsProcessing('loyalty');
    const visitCounts = new Map<string, number>();
    allEntities.forEach(entity => {
      entity.generatedCodes?.forEach(code => {
        if (code.status === 'used' && code.redeemedByInfo?.dni) {
          const dni = code.redeemedByInfo.dni;
          visitCounts.set(dni, (visitCounts.get(dni) || 0) + 1);
        }
      });
    });
    
    const loyalClientDnis = new Set<string>();
    visitCounts.forEach((count, dni) => {
        if (count >= loyaltyThreshold) {
            loyalClientDnis.add(dni);
        }
    });

    const loyalClientsData = allClients.filter(client => loyalClientDnis.has(client.dni));
    setLoyalClients(loyalClientsData);

    setIsProcessing(null);
  };
  
  const handleSegmentByBirthday = (month: string) => {
    setBirthdayMonth(month);
    if (!month) {
        setBirthdayClients([]);
        return;
    }
    setIsProcessing('birthday');
    const monthIndex = parseInt(month, 10);
    const clients = allClients.filter(client => {
        const dob = anyToDate(client.dob);
        return dob && getMonth(dob) === monthIndex;
    });
    setBirthdayClients(clients);
    setIsProcessing(null);
  };

  const handleSegmentByInactivity = () => {
    setIsProcessing('inactivity');
    const now = new Date();
    const lastActivityMap = new Map<string, Date>();

    allEntities.forEach(entity => {
      (entity.generatedCodes || []).forEach(code => {
        if (code.redeemedByInfo?.dni) {
          const redemptionDate = anyToDate(code.redemptionDate);
          if (redemptionDate) {
            const dni = code.redeemedByInfo.dni;
            const lastDate = lastActivityMap.get(dni);
            if (!lastDate || redemptionDate > lastDate) {
              lastActivityMap.set(dni, redemptionDate);
            }
          }
        }
      });
    });

    const inactiveClientList = allClients.filter(client => {
        const lastActivity = lastActivityMap.get(client.dni);
        if (!lastActivity) {
            // Si nunca ha tenido actividad, considerar la fecha de registro
            const registrationDate = anyToDate(client.registrationDate);
            if (!registrationDate) return false; // Si no hay fecha de registro, no podemos calcular inactividad
            return differenceInDays(now, registrationDate) > inactiveDays;
        }
        return differenceInDays(now, lastActivity) > inactiveDays;
    });

    setInactiveClients(inactiveClientList);
    setIsProcessing(null);
  };

  const filteredManualClients = useMemo(() => {
    if (!manualSearchTerm) return allClients;
    return allClients.filter(c => 
      c.name.toLowerCase().includes(manualSearchTerm.toLowerCase()) || 
      c.surname.toLowerCase().includes(manualSearchTerm.toLowerCase()) ||
      c.dni.includes(manualSearchTerm)
    );
  }, [allClients, manualSearchTerm]);
  
  const toggleManualSelection = (clientId: string) => {
    setManualSelection(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const manuallySelectedClients = useMemo(() => {
      return allClients.filter(client => manualSelection.has(client.id));
  }, [manualSelection, allClients]);


  const birthdayMonthName = useMemo(() => {
    if (birthdayMonth === '') return '';
    return MESES_DEL_ANO_ES[parseInt(birthdayMonth, 10)];
  }, [birthdayMonth]);

  const selectedEventName = useMemo(() => {
    if (!selectedEventId) return '';
    return pastEvents.find(e => e.id === selectedEventId)?.name || '';
  }, [selectedEventId, pastEvents]);


  return (
    <>
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gradient flex items-center gap-3">
        <Megaphone className="h-8 w-8 text-primary" />
        Campañas de Marketing
      </h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Paso 1: Crea un Segmento de Clientes</CardTitle>
          <CardDescription>
            Elige un grupo de clientes al que deseas enviarle una comunicación o promoción.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/>Segmentar por Asistencia a Evento Pasado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select onValueChange={handleSegmentByEvent} value={selectedEventId} disabled={!!isProcessing || isLoading}>
                <SelectTrigger><SelectValue placeholder="Selecciona un evento pasado..." /></SelectTrigger>
                <SelectContent>{pastEvents.length > 0 ? pastEvents.map(event => <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>) : <div className="p-4 text-center text-sm text-muted-foreground">No hay eventos pasados.</div>}</SelectContent>
              </Select>
              {isProcessing === 'event' && <div className="flex items-center text-primary"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Contando...</div>}
              {eventAttendeeClients.length > 0 && selectedEventId && <div className="p-4 bg-background rounded-md text-center"><p className="text-3xl font-bold text-primary">{eventAttendeeClients.length}</p><p className="text-sm text-muted-foreground">clientes únicos asistieron a este evento.</p><Button onClick={() => setShowEventCampaignModal(true)} className="mt-4" variant="gradient"><Send className="mr-2 h-4 w-4"/>Crear Campaña</Button></div>}
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Repeat className="h-5 w-5 text-primary"/>Segmentar por Lealtad</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                    <Label htmlFor="loyalty" className="whitespace-nowrap">Clientes con al menos</Label>
                    <Input id="loyalty" type="number" value={loyaltyThreshold} onChange={e => setLoyaltyThreshold(Number(e.target.value))} className="w-20" min="1"/>
                    <Label htmlFor="loyalty">asistencias</Label>
                    <Button onClick={handleSegmentByLoyalty} disabled={!!isProcessing || isLoading} className="ml-auto">Calcular</Button>
                </div>
                {isProcessing === 'loyalty' && <div className="flex items-center text-primary"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Calculando...</div>}
                {loyalClients.length > 0 && <div className="p-4 bg-background rounded-md text-center"><p className="text-3xl font-bold text-primary">{loyalClients.length}</p><p className="text-sm text-muted-foreground">clientes leales encontrados.</p><Button onClick={() => setShowLoyaltyModal(true)} className="mt-4" variant="gradient"><Send className="mr-2 h-4 w-4"/>Crear Campaña</Button></div>}
                {!isProcessing && loyalClients.length === 0 && <p className="text-center text-sm text-muted-foreground pt-2">No se encontraron clientes para este criterio.</p>}
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Cake className="h-5 w-5 text-primary"/>Segmentar por Cumpleaños</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <Select onValueChange={handleSegmentByBirthday} value={birthdayMonth} disabled={!!isProcessing || isLoading}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un mes..." /></SelectTrigger>
                  <SelectContent>{MESES_DEL_ANO_ES.map((mes, index) => <SelectItem key={index} value={String(index)}>{mes}</SelectItem>)}</SelectContent>
                </Select>
                {isProcessing === 'birthday' && <div className="flex items-center text-primary"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Contando...</div>}
                {birthdayClients.length > 0 && <div className="p-4 bg-background rounded-md text-center"><p className="text-3xl font-bold text-primary">{birthdayClients.length}</p><p className="text-sm text-muted-foreground">clientes cumplen años en {birthdayMonthName}.</p><Button onClick={() => setShowBirthdayModal(true)} className="mt-4" variant="gradient"><Gift className="mr-2 h-4 w-4"/>Enviar Felicitación</Button></div>}
                {birthdayMonth && !isProcessing && birthdayClients.length === 0 && <p className="text-center text-sm text-muted-foreground pt-2">No se encontraron clientes para este mes.</p>}
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Moon className="h-5 w-5 text-primary"/>Segmentar por Inactividad</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                    <Label htmlFor="inactivity" className="whitespace-nowrap">Clientes sin actividad en los últimos</Label>
                    <Input id="inactivity" type="number" value={inactiveDays} onChange={e => setInactiveDays(Number(e.target.value))} className="w-20" min="30"/>
                    <Label htmlFor="inactivity">días</Label>
                    <Button onClick={handleSegmentByInactivity} disabled={!!isProcessing || isLoading} className="ml-auto">Calcular</Button>
                </div>
                {isProcessing === 'inactivity' && <div className="flex items-center text-primary"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Calculando...</div>}
                {inactiveClients.length > 0 && <div className="p-4 bg-background rounded-md text-center"><p className="text-3xl font-bold text-primary">{inactiveClients.length}</p><p className="text-sm text-muted-foreground">clientes inactivos encontrados.</p><Button className="mt-4" variant="gradient" onClick={() => setShowInactiveCampaignModal(true)}><Send className="mr-2 h-4 w-4"/>Crear Campaña de Reactivación</Button></div>}
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary"/>Selección Manual</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <Input placeholder="Buscar cliente por nombre o DNI..." value={manualSearchTerm} onChange={e => setManualSearchTerm(e.target.value)} disabled={isLoading}/>
                <ScrollArea className="h-60 border rounded-md p-2">
                    <div className="space-y-2">
                    {filteredManualClients.map(client => (
                        <div key={client.id} className="flex items-center space-x-2">
                            <Checkbox id={`client-${client.id}`} checked={manualSelection.has(client.id)} onCheckedChange={() => toggleManualSelection(client.id)}/>
                            <label htmlFor={`client-${client.id}`} className="text-sm">{client.name} {client.surname} ({client.dni})</label>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
                <div className="p-4 bg-background rounded-md text-center">
                  <p className="text-3xl font-bold text-primary">{manualSelection.size}</p>
                  <p className="text-sm text-muted-foreground">clientes seleccionados.</p>
                  <Button className="mt-4" variant="gradient" disabled={manualSelection.size === 0} onClick={() => setShowManualCampaignModal(true)}><Send className="mr-2 h-4 w-4"/>Crear Campaña Manual</Button>
                </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>

    {showBirthdayModal && (
        <BirthdayCampaignModal
            open={showBirthdayModal}
            onOpenChange={setShowBirthdayModal}
            campaignTitle={`Campaña de Cumpleaños para ${birthdayMonthName}`}
            clients={birthdayClients}
            availablePromotions={activePromotions}
            businessDetails={businessDetails}
        />
    )}
    {showLoyaltyModal && (
        <BirthdayCampaignModal
            open={showLoyaltyModal}
            onOpenChange={setShowLoyaltyModal}
            campaignTitle={`Campaña para ${loyalClients.length} Clientes Leales`}
            clients={loyalClients}
            availablePromotions={activePromotions}
            businessDetails={businessDetails}
        />
    )}
    {showEventCampaignModal && (
        <BirthdayCampaignModal
            open={showEventCampaignModal}
            onOpenChange={setShowEventCampaignModal}
            campaignTitle={`Campaña para Asistentes de "${selectedEventName}"`}
            clients={eventAttendeeClients}
            availablePromotions={activePromotions}
            businessDetails={businessDetails}
        />
    )}
    {showInactiveCampaignModal && (
        <BirthdayCampaignModal
            open={showInactiveCampaignModal}
            onOpenChange={setShowInactiveCampaignModal}
            campaignTitle={`Campaña de Reactivación para ${inactiveClients.length} clientes`}
            clients={inactiveClients}
            availablePromotions={activePromotions}
            businessDetails={businessDetails}
        />
    )}
    {showManualCampaignModal && (
        <BirthdayCampaignModal
            open={showManualCampaignModal}
            onOpenChange={setShowManualCampaignModal}
            campaignTitle={`Campaña Manual para ${manuallySelectedClients.length} clientes`}
            clients={manuallySelectedClients}
            availablePromotions={activePromotions}
            businessDetails={businessDetails}
        />
    )}
    </>
  );
}
