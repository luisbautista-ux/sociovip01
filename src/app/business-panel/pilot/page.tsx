
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2, Star, UserX, Gift, Check, Save } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import type { BusinessManagedEntity, QrClient, AutomationRule } from "@/lib/types";
import { anyToDate } from "@/lib/utils";
import { differenceInDays, getMonth } from 'date-fns';
import { MESES_DEL_ANO_ES } from '@/lib/constants';

type RuleType = 'loyalty' | 'retention' | 'birthday';

export default function PilotPage() {
  const { userProfile, currentUser } = useAuth();
  const { toast } = useToast();
  
  const [availablePromotions, setAvailablePromotions] = useState<BusinessManagedEntity[]>([]);
  const [allClients, setAllClients] = useState<QrClient[]>([]);
  const [allEntities, setAllEntities] = useState<BusinessManagedEntity[]>([]);
  
  const [rules, setRules] = useState<Record<RuleType, AutomationRule | null>>({
    loyalty: null,
    retention: null,
    birthday: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState<RuleType | null>(null);

  const businessId = userProfile?.businessId;

  const fetchData = useCallback(async () => {
    if (!businessId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const promosQuery = query(collection(db, "businessEntities"), where("businessId", "==", businessId), where("type", "==", "promotion"), where("isActive", "==", true));
      const clientsQuery = query(collection(db, "qrClients"), where("associatedBusinessIds", "array-contains", businessId));
      const entitiesQuery = query(collection(db, "businessEntities"), where("businessId", "==", businessId));
      
      const [promosSnap, clientsSnap, entitiesSnap] = await Promise.all([
        getDocs(promosQuery),
        getDocs(clientsQuery),
        getDocs(entitiesSnap)
      ]);

      setAvailablePromotions(promosSnap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessManagedEntity)));
      setAllClients(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as QrClient)));
      setAllEntities(entitiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessManagedEntity)));
      
      // Fetch saved rules
      const ruleTypes: RuleType[] = ['loyalty', 'retention', 'birthday'];
      const fetchedRules: Record<RuleType, AutomationRule | null> = { loyalty: null, retention: null, birthday: null };
      for (const type of ruleTypes) {
        const ruleDocRef = doc(db, "automationRules", `${businessId}_${type}`);
        const ruleSnap = await getDoc(ruleDocRef);
        if (ruleSnap.exists()) {
          fetchedRules[type] = ruleSnap.data() as AutomationRule;
        }
      }
      setRules(fetchedRules);

    } catch (error: any) {
      toast({ title: "Error", description: `No se pudieron cargar los datos necesarios: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleRuleChange = (type: RuleType, field: keyof AutomationRule, value: any) => {
    setRules(prev => ({
        ...prev,
        [type]: {
            ...prev[type],
            id: prev[type]?.id || `${businessId}_${type}`,
            businessId: businessId!,
            type: type,
            name: type,
            [field]: value,
        } as AutomationRule
    }));
  };

  const handleSaveRule = async (type: RuleType) => {
    const rule = rules[type];
    if (!rule || !businessId) return;

    setIsExecuting(type);
    try {
        const ruleDocRef = doc(db, "automationRules", `${businessId}_${type}`);
        await setDoc(ruleDocRef, rule, { merge: true });
        toast({ title: "Regla Guardada", description: `La configuración para la automatización de ${type} ha sido guardada.`});
    } catch (error: any) {
        toast({ title: "Error al Guardar", description: `No se pudo guardar la regla: ${error.message}`, variant: "destructive" });
    } finally {
        setIsExecuting(null);
    }
  };
  
  const executeRule = async (type: RuleType) => {
    const rule = rules[type];
    if (!rule || !rule.isEnabled || !rule.actionPromoId || !currentUser) {
        toast({ title: "Regla incompleta", description: "Asegúrate de que la regla esté activada y tenga una promoción seleccionada.", variant: "destructive" });
        return;
    }
    
    setIsExecuting(type);
    let targetClients: QrClient[] = [];

    // --- Client Segmentation Logic ---
    if (type === 'loyalty') {
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
            if (count >= rule.threshold) loyalClientDnis.add(dni);
        });
        targetClients = allClients.filter(client => loyalClientDnis.has(client.dni));
    } else if (type === 'retention') {
        const now = new Date();
        const lastActivityMap = new Map<string, Date>();
        allClients.forEach(client => {
            const registrationDate = anyToDate(client.registrationDate);
            if (registrationDate) lastActivityMap.set(client.dni, registrationDate);
        });
        allEntities.forEach(entity => {
            (entity.generatedCodes || []).forEach(code => {
                if (code.redeemedByInfo?.dni) {
                    const activityDate = anyToDate(code.usedDate) || anyToDate(code.redemptionDate);
                    if (activityDate) {
                        const dni = code.redeemedByInfo.dni;
                        const lastDate = lastActivityMap.get(dni);
                        if (!lastDate || activityDate > lastDate) lastActivityMap.set(dni, activityDate);
                    }
                }
            });
        });
        targetClients = allClients.filter(client => {
            const lastActivity = lastActivityMap.get(client.dni);
            return lastActivity && differenceInDays(now, lastActivity) > rule.threshold;
        });
    } else if (type === 'birthday') {
        const monthIndex = rule.threshold -1;
        targetClients = allClients.filter(client => client.dob && getMonth(anyToDate(client.dob)!) === monthIndex);
    }
    
    if (targetClients.length === 0) {
        toast({ title: "Sin Destinatarios", description: `No se encontraron clientes que cumplan los criterios de la regla de ${type}.` });
        setIsExecuting(null);
        return;
    }
    
    // --- Email Sending Logic ---
    const promotionToSend = availablePromotions.find(p => p.id === rule.actionPromoId);
    if (!promotionToSend) {
        toast({ title: "Error", description: "La promoción seleccionada ya no está disponible.", variant: "destructive" });
        setIsExecuting(null);
        return;
    }

    const recipients = targetClients
      .filter(client => client.email)
      .map(client => ({ email: client.email!, name: `${client.name} ${client.surname}`.trim() }));
      
    const subject = `¡Un regalo especial para ti de parte de ${userProfile?.name}!`;
    const body = `¡Hola, [Nombre]! Como cliente valioso, te hemos enviado un regalo especial: "${promotionToSend.name}". ¡Esperamos verte pronto!`;

    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/business-panel/send-email-campaign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ recipients, subject, body }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error desconocido al enviar campaña.');

        toast({ title: "Campaña Ejecutada", description: `Se enviaron correos a ${recipients.length} cliente(s).` });
        await handleSaveRule(type); // Save the rule to update lastRun
    } catch (error: any) {
        toast({ title: "Error de Envío", description: error.message, variant: "destructive" });
    } finally {
        setIsExecuting(null);
    }
  };

  const renderRuleCard = (type: RuleType, title: string, description: string, icon: React.ElementType) => {
    const Icon = icon;
    const rule = rules[type];
    const promo = availablePromotions.find(p => p.id === rule?.actionPromoId);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Icon className="h-6 w-6 text-primary"/>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch id={`enable-${type}`} checked={rule?.isEnabled ?? false} onCheckedChange={(checked) => handleRuleChange(type, 'isEnabled', checked)} />
            <Label htmlFor={`enable-${type}`}>Activar esta regla</Label>
          </div>
          
          {type === 'loyalty' && (
            <div className="flex items-center gap-2">
              <Label htmlFor={`threshold-${type}`} className="whitespace-nowrap">Cuando el cliente complete</Label>
              <Input id={`threshold-${type}`} type="number" value={rule?.threshold || 5} onChange={e => handleRuleChange(type, 'threshold', Number(e.target.value))} className="w-20" min="1"/>
              <Label htmlFor={`threshold-${type}`}>visitas, enviarle:</Label>
            </div>
          )}
          {type === 'retention' && (
            <div className="flex items-center gap-2">
              <Label htmlFor={`threshold-${type}`} className="whitespace-nowrap">Si el cliente lleva más de</Label>
              <Input id={`threshold-${type}`} type="number" value={rule?.threshold || 60} onChange={e => handleRuleChange(type, 'threshold', Number(e.target.value))} className="w-20" min="1"/>
              <Label htmlFor={`threshold-${type}`}>días sin volver, enviarle:</Label>
            </div>
          )}
          {type === 'birthday' && (
             <div className="flex items-center gap-2">
              <Label htmlFor={`threshold-${type}`} className="whitespace-nowrap">A los clientes que cumplen años en</Label>
              <Select value={String(rule?.threshold || new Date().getMonth() + 1)} onValueChange={(val) => handleRuleChange(type, 'threshold', Number(val))}>
                  <SelectTrigger className="w-[180px]"><SelectValue/></SelectTrigger>
                  <SelectContent>{MESES_DEL_ANO_ES.map((mes, i) => <SelectItem key={i} value={String(i+1)}>{mes}</SelectItem>)}</SelectContent>
              </Select>
               <Label htmlFor={`threshold-${type}`}>enviarles:</Label>
            </div>
          )}

          <Select value={rule?.actionPromoId || ''} onValueChange={(val) => handleRuleChange(type, 'actionPromoId', val)}>
            <SelectTrigger><SelectValue placeholder="Selecciona una promoción de regalo..."/></SelectTrigger>
            <SelectContent>
              {availablePromotions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Última ejecución: {rule?.lastRun ? anyToDate(rule.lastRun)?.toLocaleString('es-PE') : 'Nunca'}</p>
            <div>
              <Button variant="outline" onClick={() => handleSaveRule(type)} disabled={isExecuting !== null || !rule}>
                {isExecuting === type ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
                <span className="ml-2">Guardar Regla</span>
              </Button>
              <Button onClick={() => executeRule(type)} disabled={isExecuting !== null || !rule?.isEnabled}>
                {isExecuting === type ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}
                <span className="ml-2">Ejecutar Ahora</span>
              </Button>
            </div>
        </CardFooter>
      </Card>
    )
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gradient flex items-center gap-3">
        <Wand2 className="h-8 w-8 text-primary" />
        Piloto Automático de Marketing
      </h1>
      <p className="text-muted-foreground">Configura reglas para que el sistema envíe campañas de email automáticamente a tus clientes, manteniéndolos comprometidos y premiando su lealtad.</p>
      
      <div className="space-y-6">
        {renderRuleCard('loyalty', 'Campaña de Fidelización', 'Premia a tus clientes más leales cuando alcancen un número de visitas.', Star)}
        {renderRuleCard('retention', 'Campaña de Retención', 'Recupera a los clientes que no han vuelto en un tiempo con una oferta especial.', UserX)}
        {renderRuleCard('birthday', 'Campaña de Cumpleaños', 'Envía un regalo a tus clientes en el mes de su cumpleaños.', Gift)}
      </div>
    </div>
  );
}
