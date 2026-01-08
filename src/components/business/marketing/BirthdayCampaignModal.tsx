
"use client";

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowRight, Gift, Pencil, Wand2, Send, MessageSquare } from "lucide-react";
import { Stepper, Step, StepLabel, StepContent } from '@/components/ui/stepper'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { BusinessManagedEntity, QrClient } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface BirthdayCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  birthdayMonthName: string;
  clients: QrClient[];
  availablePromotions: BusinessManagedEntity[];
  businessId: string;
}

export function BirthdayCampaignModal({
  open,
  onOpenChange,
  birthdayMonthName,
  clients,
  availablePromotions,
  businessId,
}: BirthdayCampaignModalProps) {
  const { toast } = useToast();
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 State
  const [giftType, setGiftType] = useState<'existing' | 'new' | null>(null);
  const [selectedPromotionId, setSelectedPromotionId] = useState<string>('');

  // Step 2 State
  const [generatedMessages, setGeneratedMessages] = useState<string[]>([]);
  const [selectedMessage, setSelectedMessage] = useState('');

  const STEPS = [
    { label: "Define el Regalo", description: "Elige qué promoción enviarás." },
    { label: "Personaliza el Mensaje", description: "Crea el saludo de cumpleaños." },
    { label: "Confirmar y Enviar", description: "Revisa y lanza tu campaña." },
  ];

  const handleNext = () => {
    if (activeStep === 0 && !giftType) {
        toast({ title: "Acción requerida", description: "Debes seleccionar un tipo de regalo.", variant: "destructive" });
        return;
    }
    if (activeStep === 0 && giftType === 'existing' && !selectedPromotionId) {
        toast({ title: "Acción requerida", description: "Debes seleccionar una promoción existente.", variant: "destructive" });
        return;
    }
    // TODO: Validate new gift form
    
    // Simulate AI message generation for Step 2
    if (activeStep === 0) {
        setIsSubmitting(true);
        setTimeout(() => {
            const promotionName = selectedPromotionId ? availablePromotions.find(p => p.id === selectedPromotionId)?.name : "un regalo especial";
            const messages = [
                `¡Feliz Cumpleaños, [Nombre]! 🥳 En [Tu Negocio] celebramos contigo. Te regalamos ${promotionName}. ¡Genera tu QR aquí: [Enlace]!`,
                `¡Que los cumplas muy feliz, [Nombre]! 🎂 Tu regalo de ${promotionName} te espera en [Tu Negocio]. Reclámalo aquí: [Enlace]`,
                `Celebra tu día con nosotros, [Nombre]! 🎉 Como regalo de cumpleaños, te obsequiamos ${promotionName}. Tu QR aquí: [Enlace]`
            ];
            setGeneratedMessages(messages);
            setSelectedMessage(messages[0]);
            setIsSubmitting(false);
            setActiveStep(1);
        }, 1500);
        return;
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleLaunchCampaign = async () => {
    setIsSubmitting(true);
    toast({ title: "Enviando campaña...", description: "Esta es una simulación. En una implementación real, aquí se enviarían los mensajes." });
    setTimeout(() => {
        setIsSubmitting(false);
        toast({ title: "Campaña 'Enviada' Exitosamente", description: `Se 'enviaron' mensajes a ${clients.length} clientes.` });
        onOpenChange(false);
    }, 2000);
  };
  
  const resetState = () => {
    setActiveStep(0);
    setGiftType(null);
    setSelectedPromotionId('');
    setGeneratedMessages([]);
    setSelectedMessage('');
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetState(); onOpenChange(isOpen); }}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Campaña de Cumpleaños para {birthdayMonthName}</DialogTitle>
          <DialogDescription>
            Estás creando una campaña para <span className="font-bold text-primary">{clients.length}</span> cliente(s).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto pr-4 -mr-4">
          <Stepper orientation="vertical" activeStep={activeStep}>
            {STEPS.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                    {index === 0 && (
                        <Card className="bg-muted/50">
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Gift/>Paso 1: ¿Qué regalo enviarás?</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <Card>
                                    <CardHeader className="p-4 cursor-pointer" onClick={() => setGiftType('existing')}>
                                        <div className="flex items-center gap-3">
                                            <input type="radio" name="giftType" checked={giftType === 'existing'} onChange={() => setGiftType('existing')} className="form-radio h-5 w-5 text-primary"/>
                                            <Label>Usar una promoción existente</Label>
                                        </div>
                                    </CardHeader>
                                    {giftType === 'existing' && (
                                        <CardContent className="p-4 pt-0">
                                            <Select value={selectedPromotionId} onValueChange={setSelectedPromotionId}>
                                                <SelectTrigger><SelectValue placeholder="Elige una promoción..."/></SelectTrigger>
                                                <SelectContent>
                                                    {availablePromotions.map(promo => <SelectItem key={promo.id} value={promo.id}>{promo.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </CardContent>
                                    )}
                                </Card>
                                <Card>
                                    <CardHeader className="p-4 cursor-pointer" onClick={() => setGiftType('new')}>
                                        <div className="flex items-center gap-3">
                                            <input type="radio" name="giftType" checked={giftType === 'new'} onChange={() => setGiftType('new')} className="form-radio h-5 w-5 text-primary"/>
                                            <Label>Crear un vale de consumo rápido</Label>
                                        </div>
                                    </CardHeader>
                                    {giftType === 'new' && <CardContent className="p-4 pt-0 space-y-2"><p className="text-sm text-muted-foreground text-center p-4 border rounded-md">Próximamente: Aquí podrás crear un vale simple (ej: 'Vale por S/20').</p></CardContent>}
                                </Card>
                            </CardContent>
                        </Card>
                    )}
                    {index === 1 && (
                         <Card className="bg-muted/50">
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wand2/>Paso 2: Personaliza el Mensaje</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <Label>Elige una opción y edítala a tu gusto</Label>
                                <div className="space-y-2">
                                    {generatedMessages.map((msg, i) => (
                                        <div key={i} className="flex items-start gap-2 p-3 border rounded-md cursor-pointer bg-background hover:bg-accent/20" onClick={() => setSelectedMessage(msg)}>
                                            <input type="radio" name="messageOption" checked={selectedMessage === msg} onChange={() => setSelectedMessage(msg)} className="form-radio h-4 w-4 text-primary mt-1"/>
                                            <p className="text-sm flex-1">{msg}</p>
                                        </div>
                                    ))}
                                </div>
                                <Textarea value={selectedMessage} onChange={(e) => setSelectedMessage(e.target.value)} rows={4} placeholder="Escribe tu mensaje..."/>
                                <p className="text-xs text-muted-foreground">Las etiquetas [Nombre] y [Enlace] se reemplazarán automáticamente para cada cliente.</p>
                            </CardContent>
                        </Card>
                    )}
                    {index === 2 && (
                         <Card className="bg-muted/50">
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Send/>Paso 3: Confirmación</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                               <p>Estás a punto de enviar una campaña a <span className="font-bold">{clients.length}</span> clientes por su cumpleaños en {birthdayMonthName}.</p>
                               <div className="p-4 border rounded-md bg-background space-y-2">
                                  <h4 className="font-semibold">Resumen:</h4>
                                  <p className="text-sm"><strong>Regalo:</strong> {giftType === 'existing' ? availablePromotions.find(p=>p.id === selectedPromotionId)?.name : 'Nuevo Vale'}</p>
                                  <p className="text-sm"><strong>Mensaje a enviar:</strong></p>
                                  <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">"{selectedMessage}"</blockquote>
                               </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="mt-4 flex gap-2">
                      <Button onClick={handleNext} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : (activeStep === STEPS.length - 1 ? 'Preparar Envíos' : 'Siguiente')}
                        {activeStep < STEPS.length - 1 && <ArrowRight className="ml-2 h-4 w-4"/>}
                      </Button>
                      <Button variant="ghost" onClick={handleBack} disabled={activeStep === 0 || isSubmitting}>Atrás</Button>
                    </div>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleLaunchCampaign} variant="gradient" disabled={activeStep !== STEPS.length - 1 || isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Lanzar Campaña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
