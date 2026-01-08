
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
import { collection, query, where, getDocs } from "firebase/firestore";
import type { BusinessManagedEntity, QrClient } from "@/lib/types";
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

  // Estados para segmentación
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [eventAttendeeCount, setEventAttendeeCount] = useState<number | null>(null);
  const [loyaltyThreshold, setLoyaltyThreshold] = useState<number>(3);
  const [loyaltyClientsCount, setLoyaltyClientsCount] = useState<number | null>(null);
  const [birthdayMonth, setBirthdayMonth] = useState<string>('');
  const [birthdayClients, setBirthdayClients] = useState<QrClient[]>([]);
  const [inactiveDays, setInactiveDays] = useState<number>(90);
  const [inactiveClientsCount, setInactiveClientsCount] = useState<number | null>(null);
  const [manualSelection, setManualSelection] = useState<Set<string>>(new Set());
  const [manualSearchTerm, setManualSearchTerm] = useState('');

  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);

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
      // Fetch all entities (events and promotions)
      const entitiesQuery = query(collection(db, "businessEntities"), where("businessId", "==", businessId));
      const entitiesSnap = await getDocs(entitiesQuery);
      const fetchedEntities = entitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessManagedEntity));
      setAllEntities(fetchedEntities);
      
      // Fetch all clients related to the business
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
      setEventAttendeeCount(null);
      return;
    }
    setIsProcessing('event');
    const selectedEvent = allEntities.find(e => e.id === eventId);
    if (!selectedEvent || !selectedEvent.generatedCodes) {
      setEventAttendeeCount(0);
      setIsProcessing(null);
      return;
    }
    const attendees = new Set<string>();
    selectedEvent.generatedCodes.forEach(code => {
      if (code.status === 'used' && code.redeemedByInfo?.dni) {
        attendees.add(code.redeemedByInfo.dni);
      }
    });
    setEventAttendeeCount(attendees.size);
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
    const loyalClients = Array.from(visitCounts.entries()).filter(([dni, count]) => count >= loyaltyThreshold);
    setLoyaltyClientsCount(loyalClients.length);
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
    const inactiveClientDnis = new Set<string>();
    const activeClientDnis = new Set<string>();

    allEntities.forEach(entity => {
        entity.generatedCodes?.forEach(code => {
            if (code.redeemedByInfo?.dni) {
                const redemptionDate = anyToDate(code.redemptionDate);
                if(redemptionDate && differenceInDays(now, redemptionDate) <= inactiveDays) {
                    activeClientDnis.add(code.redeemedByInfo.dni);
                }
            }
        });
    });

    allClients.forEach(client => {
        if (!activeClientDnis.has(client.dni)) {
            inactiveClientDnis.add(client.dni);
        }
    });
    setInactiveClientsCount(inactiveClientDnis.size);
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
              {eventAttendeeCount !== null && <div className="p-4 bg-background rounded-md text-center"><p className="text-3xl font-bold text-primary">{eventAttendeeCount}</p><p className="text-sm text-muted-foreground">clientes únicos asistieron a este evento.</p><Button className="mt-4" variant="gradient" disabled={eventAttendeeCount === 0}><Send className="mr-2 h-4 w-4"/>Crear Campaña</Button></div>}
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
                {loyaltyClientsCount !== null && <div className="p-4 bg-background rounded-md text-center"><p className="text-3xl font-bold text-primary">{loyaltyClientsCount}</p><p className="text-sm text-muted-foreground">clientes leales encontrados.</p><Button className="mt-4" variant="gradient" disabled={loyaltyClientsCount === 0}><Send className="mr-2 h-4 w-4"/>Crear Campaña</Button></div>}
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
                {birthdayClients.length > 0 && <div className="p-4 bg-background rounded-md text-center"><p className="text-3xl font-bold text-primary">{birthdayClients.length}</p><p className="text-sm text-muted-foreground">clientes cumplen años en {MESES_DEL_ANO_ES[parseInt(birthdayMonth,10)]}.</p><Button onClick={() => setShowBirthdayModal(true)} className="mt-4" variant="gradient" disabled={birthdayClients.length === 0}><Gift className="mr-2 h-4 w-4"/>Enviar Felicitación</Button></div>}
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
                {inactiveClientsCount !== null && <div className="p-4 bg-background rounded-md text-center"><p className="text-3xl font-bold text-primary">{inactiveClientsCount}</p><p className="text-sm text-muted-foreground">clientes inactivos encontrados.</p><Button className="mt-4" variant="gradient" disabled={inactiveClientsCount === 0}><Send className="mr-2 h-4 w-4"/>Crear Campaña de Reactivación</Button></div>}
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
                  <Button className="mt-4" variant="gradient" disabled={manualSelection.size === 0}><Send className="mr-2 h-4 w-4"/>Crear Campaña Manual</Button>
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
            birthdayMonthName={MESES_DEL_ANO_ES[parseInt(birthdayMonth, 10)]}
            clients={birthdayClients}
            availablePromotions={activePromotions}
            businessId={userProfile?.businessId || ""}
        />
    )}
    </>
  );
}
