
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, Send, Users, AlertCircle, Unplug } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import type { QrClient, Business } from "@/lib/types";
import { Alert, AlertTitle } from '@/components/ui/alert';

export default function EmailCampaignsPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  
  const [allClients, setAllClients] = useState<QrClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);

  const businessId = userProfile?.businessId;

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

      const clientsQuery = query(collection(db, "qrClients"), where("associatedBusinessIds", "array-contains", businessId));
      const clientsSnap = await getDocs(clientsQuery);
      const fetchedClients: QrClient[] = clientsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as QrClient))
        .filter(c => c.email); // Solo clientes con email
      setAllClients(fetchedClients);
    } catch (error: any) {
      toast({ title: "Error", description: `No se pudieron cargar los clientes: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredClients = useMemo(() => {
    if (!searchTerm) return allClients;
    const lowercasedTerm = searchTerm.toLowerCase();
    return allClients.filter(c =>
      c.name.toLowerCase().includes(lowercasedTerm) ||
      c.surname.toLowerCase().includes(lowercasedTerm) ||
      (c.email && c.email.toLowerCase().includes(lowercasedTerm)) ||
      c.dni.includes(lowercasedTerm)
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
    
    const recipientEmails = allClients
      .filter(client => selectedClients.has(client.id))
      .map(client => client.email);
      
    try {
      const response = await fetch('/api/business-panel/send-email-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    window.location.href = '/api/auth/google/initiate';
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
