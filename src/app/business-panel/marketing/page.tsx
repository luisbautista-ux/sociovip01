
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Megaphone, Send, Users, Activity, Repeat } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { BusinessManagedEntity } from "@/lib/types";
import { anyToDate } from "@/lib/utils";
import { isPast } from 'date-fns';

export default function MarketingPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  
  const [pastEvents, setPastEvents] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados para la segmentación por evento
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [attendeeCount, setAttendeeCount] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState(false);

  const fetchPastEvents = useCallback(async () => {
    if (!userProfile?.businessId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const eventsQuery = query(
        collection(db, "businessEntities"),
        where("businessId", "==", userProfile.businessId),
        where("type", "==", "event")
      );
      const snapshot = await getDocs(eventsQuery);
      const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessManagedEntity));
      
      const filteredPastEvents = allEvents.filter(event => 
        event.endDate && isPast(anyToDate(event.endDate) || new Date())
      ).sort((a,b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
      
      setPastEvents(filteredPastEvents);
    } catch (error: any) {
      toast({ title: "Error", description: `No se pudieron cargar los eventos pasados: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [userProfile?.businessId, toast]);

  useEffect(() => {
    fetchPastEvents();
  }, [fetchPastEvents]);

  const handleEventSelectionChange = async (eventId: string) => {
    setSelectedEventId(eventId);
    if (!eventId) {
      setAttendeeCount(null);
      return;
    }
    
    setIsCounting(true);
    setAttendeeCount(null);
    try {
      const selectedEvent = pastEvents.find(e => e.id === eventId);
      if (!selectedEvent || !selectedEvent.generatedCodes) {
        setAttendeeCount(0);
        return;
      }
      
      const attendees = new Set<string>();
      selectedEvent.generatedCodes.forEach(code => {
        if (code.status === 'used' && code.redeemedByInfo?.dni) {
          attendees.add(code.redeemedByInfo.dni);
        }
      });
      setAttendeeCount(attendees.size);
    } catch (error) {
      toast({title: "Error", description: "No se pudo contar a los asistentes.", variant: "destructive"});
    } finally {
      setIsCounting(false);
    }
  };

  return (
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
          
          {/* --- Segmentación por Asistencia a Evento --- */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary"/>
                Segmentar por Asistencia a Evento Pasado
              </CardTitle>
              <CardDescription>
                Dirígete a los clientes que asistieron a un evento específico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Cargando eventos...</div>
              ) : (
                <Select onValueChange={handleEventSelectionChange} value={selectedEventId} disabled={isCounting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un evento pasado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pastEvents.length > 0 ? (
                      pastEvents.map(event => (
                        <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">No hay eventos pasados.</div>
                    )}
                  </SelectContent>
                </Select>
              )}

              {isCounting && <div className="flex items-center text-primary"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Contando asistentes...</div>}
              
              {attendeeCount !== null && (
                <div className="p-4 bg-background rounded-md text-center">
                  <p className="text-3xl font-bold text-primary">{attendeeCount}</p>
                  <p className="text-sm text-muted-foreground">clientes únicos asistieron a este evento.</p>
                  <Button className="mt-4" variant="gradient" disabled={attendeeCount === 0}>
                    <Send className="mr-2 h-4 w-4" />
                    Crear Campaña para este Segmento
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* --- Futuros Segmentos --- */}
          <Card className="opacity-50 pointer-events-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
                <Repeat className="h-5 w-5"/>
                Segmentar por Lealtad (Próximamente)
              </CardTitle>
              <CardDescription>
                Premia a tus clientes más recurrentes.
              </CardDescription>
            </CardHeader>
          </Card>

           <Card className="opacity-50 pointer-events-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
                <Users className="h-5 w-5"/>
                Selección Manual (Próximamente)
              </CardTitle>
              <CardDescription>
                Elige manualmente a los clientes de tu base de datos.
              </CardDescription>
            </CardHeader>
          </Card>

        </CardContent>
      </Card>
    </div>
  );
}
