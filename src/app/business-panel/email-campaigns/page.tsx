
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, Send, Users, Unplug, DatabaseZap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, writeBatch, Timestamp, limit } from "firebase/firestore";
import type { QrClient, Business } from "@/lib/types";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

// --- One-time migration utility ---
const MIGRATION_EMAILS = [
  "kerenarango123@gmail.com", "gcarocolquepisco@gmail.com", "wdlcm.2710@gmail.com",
  "dachocachete13@gmail.com", "dimart996@gmail.com", "claudio.elevated@gmail.com",
  "canvapro202521@gmail.com", "innovacionuai2025@gmail.com", "jefersonmondalgo229@gmail.com",
  "anaceciliaroman@gmail.com", "bautistamolinasimon@gmail.com", "rosangela.graziani.vicente@gmail.com",
  "angel13nov13@gmail.com", "melissa.pp.2018@gmail.com", "gabrielapachasportuguez@gmail.com",
  "dianasalazar120@gmail.com", "angellrodriguez78@gmail.com", "carlitos120519@gmail.com",
  "jhancarlossg@gmail.com", "elizabethanchante@gmail.com", "ronaldo.sanchez2003@gmail.com",
  "diegobautista150@gmail.com", "carmenvilcapoma@gmail.com", "juanmiguelcc17@gmail.com",
  "kevinandres2007@gmail.com", "angiequintana1504@gmail.com", "jenniferrojas2807@gmail.com",
  "jhordy.gomez.22@gmail.com", "michaelalexis2022@gmail.com", "cristopherleonm@gmail.com",
  "samuelramirez2021@gmail.com", "erickchavez1510@gmail.com", "angelo2004p@gmail.com",
  "jersonhuamani24@gmail.com", "carlosdanielpoma@gmail.com", "bryanlopez0806@gmail.com",
  "edisonbautista998@gmail.com", "josealberto120@gmail.com", "marcosrivera2005@gmail.com",
  "luisfernando1507@gmail.com", "fernandoramos23@gmail.com", "jorgeluisperez@gmail.com",
  "rafaelhuaman150@gmail.com", "andreaquiroz2006@gmail.com", "oscarvilcapoma@gmail.com",
  "paolavargas150@gmail.com", "sebastianrojas17@gmail.com", "alonsochavez04@gmail.com",
  "karlaquintana22@gmail.com", "pedrohuaman2003@gmail.com", "allanrivera150@gmail.com",
  "danielmedina150@gmail.com", "jhoelcastro2004@gmail.com", "rodrigobautista@gmail.com",
  "alldalex10@gmail.com", "luis.bautista@uai.edu.pe", "danielalex.atuncar@gmail.com",
  "christophercardenas63@gmail.com", "bautistaluis989@gmail.com", "correacondec@gmail.com",
  "andrevaleri2013@gmail.com", "mauriciovelamateo@gmail.com", "alejanius.123@gmail.com",
  "adrianmateo32@gmail.com", "hugofelix8301@gmail.com", "aymaralvarez040920@gmail.com",
  "et5744454@gmail.com", "ivonme2997@gmail.com",
];
const MIGRATION_FLAG_KEY = 'clientEmailMigrationDone';

export default function EmailCampaignsPage() {
  const { userProfile, currentUser } = useAuth();
  const { toast } = useToast();
  
  const [allClients, setAllClients] = useState<QrClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  
  // Migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState(false);

  const businessId = userProfile?.businessId;
  
  useEffect(() => {
    // Check if migration has been done using localStorage
    const flag = localStorage.getItem(MIGRATION_FLAG_KEY);
    if (flag) {
      setMigrationDone(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!businessId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const businessDocRef = doc(db, 'businesses', businessId);
      const businessDoc = await getDoc(businessDocRef);
      if (businessDoc.exists()) {
        const businessData = businessDoc.data() as Business;
        if (businessData.gmailRefreshToken) {
          setIsGmailConnected(true);
        }
      }
      
      const newModelQuery = query(collection(db, "qrClients"), where("associatedBusinessIds", "array-contains", businessId));
      const oldModelQuery = query(collection(db, "qrClients"), where("generatedForBusinessId", "==", businessId));

      const [newClientsSnap, oldClientsSnap] = await Promise.all([
          getDocs(newModelQuery),
          getDocs(oldModelQuery),
      ]);
      
      const clientsMap = new Map<string, QrClient>();

      const processSnapshot = (snap: typeof newClientsSnap) => {
        snap.forEach(d => {
            if (!clientsMap.has(d.id)) {
                const clientData = { id: d.id, ...d.data() } as QrClient;
                if (clientData.email && clientData.email.includes('@')) {
                   clientsMap.set(d.id, clientData);
                }
            }
        });
      };

      processSnapshot(newClientsSnap);
      processSnapshot(oldClientsSnap);

      const combinedClients = Array.from(clientsMap.values());
      setAllClients(combinedClients);

    } catch (error: any) {
      toast({ title: "Error", description: `No se pudieron cargar los clientes: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Migration function
  const handleRunMigration = async () => {
    if (!businessId) {
      toast({ title: "Error", description: "No se encontró el ID de tu negocio.", variant: "destructive" });
      return;
    }
    setIsMigrating(true);
    toast({ title: "Iniciando migración...", description: "Por favor, espera un momento." });

    try {
      const batch = writeBatch(db);
      let count = 0;
      
      for (const email of MIGRATION_EMAILS) {
        // Simple check to avoid creating duplicates based on email for THIS business.
        const q = query(collection(db, "qrClients"), where("email", "==", email), where("associatedBusinessIds", "array-contains", businessId), limit(1));
        const existing = await getDocs(q);
        
        if (existing.empty) {
          const newClientRef = doc(collection(db, "qrClients"));
          const newClientData: Partial<QrClient> = {
            email,
            name: "Cliente Antiguo",
            surname: "",
            dni: `MIGRATED${Math.floor(Math.random() * 900000) + 100000}`,
            phone: "",
            dob: Timestamp.fromDate(new Date(2000, 0, 1)),
            registrationDate: Timestamp.now(),
            associatedBusinessIds: [businessId],
          };
          batch.set(newClientRef, newClientData);
          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        toast({ title: "Migración Completada", description: `${count} nuevos clientes fueron añadidos y asociados a tu negocio.` });
      } else {
        toast({ title: "Migración Finalizada", description: "No se encontraron nuevos clientes para añadir." });
      }

      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      setMigrationDone(true);
      fetchData(); // Refresh client list

    } catch (error: any) {
      toast({ title: "Error en la Migración", description: error.message, variant: "destructive" });
    } finally {
      setIsMigrating(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchTerm) return allClients;
    const lowercasedTerm = searchTerm.toLowerCase();
    return allClients.filter(c =>
      (c.name && c.name.toLowerCase().includes(lowercasedTerm)) ||
      (c.surname && c.surname.toLowerCase().includes(lowercasedTerm)) ||
      (c.email && c.email.toLowerCase().includes(lowercasedTerm)) ||
      (c.dni && c.dni.includes(lowercasedTerm))
    );
  }, [allClients, searchTerm]);

  const handleSelectAll = (isChecked: boolean) => {
    if (isChecked) {
      setSelectedClients(new Set(filteredClients.map(c => c.id)));
    } else {
      setSelectedClients(new Set());
    }
  };

  const handleSelectClient = (clientId: string, isChecked: boolean) => {
    setSelectedClients(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(clientId);
      } else {
        newSet.delete(clientId);
      }
      return newSet;
    });
  };

  const handleSendCampaign = async () => {
    if (isSending) return;
    setIsSending(true);
    
    if (!currentUser) {
        toast({ title: "No autenticado", description: "Debes estar logueado para enviar campañas.", variant: "destructive" });
        setIsSending(false);
        return;
    }
    
    const recipientEmails = allClients
      .filter(client => selectedClients.has(client.id) && client.email)
      .map(client => client.email as string);
      
    if (recipientEmails.length === 0) {
        toast({ title: "Sin Destinatarios", description: "No has seleccionado clientes con email para enviar la campaña.", variant: "destructive"});
        setIsSending(false);
        return;
    }

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/business-panel/send-email-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ recipientEmails, subject, body }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error desconocido en el servidor');
      }
      toast({
        title: "Campaña en Proceso",
        description: data.message || `Se inició el envío a ${recipientEmails.length} cliente(s).`,
      });
      setSelectedClients(new Set());
      setSubject('');
      setBody('');
    } catch (error: any) {
      toast({ title: "Error al Enviar", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const canSend = isGmailConnected && selectedClients.size > 0 && subject.trim().length > 0 && body.trim().length > 10;

  const handleGmailConnect = () => {
    if (!currentUser) {
        toast({title: "No autenticado", description: "Por favor, inicia sesión de nuevo para conectar tu cuenta.", variant: "destructive" });
        return;
    }
    currentUser.getIdToken().then(idToken => {
        const currentUrl = new URL(window.location.href);
        const redirectUrl = `${currentUrl.protocol}//${currentUrl.host}/api/auth/google/initiate`;
        
        document.cookie = `idToken=${idToken}; path=/; secure; samesite=strict`;
        window.location.href = redirectUrl;
    }).catch(err => {
        toast({title: "Error de autenticación", description: "No se pudo obtener tu token de sesión.", variant: "destructive" });
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gradient flex items-center gap-3">
        <Mail className="h-8 w-8 text-primary" />
        Campañas de Email
      </h1>
      
      {!isGmailConnected && !isLoading && (
        <Alert>
          <Unplug className="h-4 w-4" />
          <AlertTitle>Conexión Requerida</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            Para enviar campañas de email, primero debes conectar tu cuenta de Gmail.
            <Button onClick={handleGmailConnect} variant="gradient">Conectar Cuenta de Gmail</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Migration Utility */}
      {!migrationDone && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DatabaseZap className="text-amber-600"/>Utilidad de Migración de Clientes</CardTitle>
            <CardDescription>
              Detectamos que podrías tener clientes de un sistema anterior. Usa este botón una sola vez para añadirlos a tu lista de contactos para campañas de email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRunMigration} disabled={isMigrating}>
              {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4"/>}
              {isMigrating ? 'Migrando...' : 'Migrar Clientes Antiguos'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle>Paso 2: Redacta tu Correo</CardTitle>
            <CardDescription>Escribe el asunto y el contenido del email que quieres enviar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject">Asunto</Label>
              <Input
                id="subject"
                placeholder="Ej: ¡Una oferta especial para ti!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSending || !isGmailConnected}
              />
            </div>
            <div>
              <Label htmlFor="body">Cuerpo del Mensaje</Label>
              <Textarea
                id="body"
                placeholder="Hola [Nombre], tenemos algo especial para ti..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                disabled={isSending || !isGmailConnected}
              />
              <p className="text-xs text-muted-foreground mt-2">Puedes usar [Nombre] y se reemplazará automáticamente.</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Paso 1: Selecciona Destinatarios</CardTitle>
              <CardDescription>Elige los clientes de tu negocio a los que deseas enviar el correo.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
              ) : allClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No se encontraron clientes con email.</div>
              ) : (
                <div className="space-y-3">
                  <Input
                    placeholder="Buscar cliente por nombre, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <div className="flex items-center space-x-2 border-b pb-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedClients.size > 0 && selectedClients.size === filteredClients.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <Label htmlFor="select-all">Seleccionar todos ({filteredClients.length})</Label>
                  </div>
                  <ScrollArea className="h-60">
                    <div className="space-y-2 p-1">
                      {filteredClients.map(client => (
                        <div key={client.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`client-${client.id}`}
                            checked={selectedClients.has(client.id)}
                            onCheckedChange={(checked) => handleSelectClient(client.id, !!checked)}
                          />
                          <Label htmlFor={`client-${client.id}`} className="font-normal flex flex-col">
                            <span>{client.name} {client.surname}</span>
                            <span className="text-xs text-muted-foreground">{client.email}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Paso 3: Enviar Campaña</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="p-4 bg-primary/10 rounded-md text-center">
                    <Users className="mx-auto h-8 w-8 text-primary"/>
                    <p className="text-2xl font-bold text-primary mt-2">{selectedClients.size}</p>
                    <p className="text-sm font-semibold text-muted-foreground">Cliente(s) seleccionado(s)</p>
                </div>
            </CardContent>
            <CardContent>
              <Button onClick={handleSendCampaign} disabled={!canSend || isSending} className="w-full" variant="gradient">
                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                Enviar Campaña
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
