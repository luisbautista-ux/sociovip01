
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowRight, Gift, Pencil, Wand2, Send, MessageSquare, List, Check } from "lucide-react";
import { Stepper, Step, StepLabel, StepContent } from '@/components/ui/stepper'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { BusinessManagedEntity, QrClient, Business } from "@/lib/types";
import { useToast } from '@/hooks/use-toast';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

const newGiftSchema = z.object({
  name: z.string().min(5, "El nombre del vale debe tener al menos 5 caracteres."),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  validityDays: z.coerce.number().min(1, "La vigencia debe ser de al menos 1 día.").max(90, "La vigencia no puede superar los 90 días."),
});

type NewGiftValues = z.infer<typeof newGiftSchema>;

export type CampaignType = 'birthday' | 'loyalty' | 'event-attendee' | 'inactive' | 'manual';

interface CampaignCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignTitle: string;
  clients: QrClient[];
  availablePromotions: BusinessManagedEntity[];
  businessDetails: Business | null;
  campaignType: CampaignType; // <-- Nuevo prop para saber el contexto
}

export function CampaignCreationModal({
  open,
  onOpenChange,
  campaignTitle,
  clients,
  availablePromotions,
  businessDetails,
  campaignType,
}: CampaignCreationModalProps) {
  const { toast } = useToast();
  const [activeStep, setActiveStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1 State
  const [giftType, setGiftType] = useState<'existing' | 'new' | null>(null);
  const [selectedPromotionId, setSelectedPromotionId] = useState<string>('');

  const newGiftForm = useForm<NewGiftValues>({
      resolver: zodResolver(newGiftSchema),
      defaultValues: { name: "", description: "", validityDays: 30 }
  });

  // Step 2 State
  const [generatedMessages, setGeneratedMessages] = useState<string[]>([]);
  const [selectedMessage, setSelectedMessage] = useState('');

  // Step 3 State
  const [finalClientList, setFinalClientList] = useState<{name: string, phone: string, message: string}[]>([]);


  const STEPS = [
    { label: "Define el Regalo", description: "Elige qué promoción enviarás." },
    { label: "Personaliza el Mensaje", description: "Crea el saludo de cumpleaños." },
    { label: "Confirmar y Enviar", description: "Revisa y lanza tu campaña." },
  ];
  
  const getGiftName = () => {
    if (giftType === 'existing' && selectedPromotionId) {
        return availablePromotions.find(p => p.id === selectedPromotionId)?.name || "un regalo especial";
    }
    if (giftType === 'new') {
        return newGiftForm.getValues('name') || "un regalo especial";
    }
    return "un regalo especial";
  }

  const handleNext = async () => {
    if (activeStep === 0) {
        if (!giftType) {
            toast({ title: "Acción requerida", description: "Debes seleccionar un tipo de regalo.", variant: "destructive" });
            return;
        }
        if (giftType === 'existing' && !selectedPromotionId) {
            toast({ title: "Acción requerida", description: "Debes seleccionar una promoción existente.", variant: "destructive" });
            return;
        }
        if (giftType === 'new') {
            const isValid = await newGiftForm.trigger();
            if(!isValid) {
                toast({ title: "Formulario incompleto", description: "Por favor, completa los campos del nuevo vale.", variant: "destructive" });
                return;
            }
        }
        
        setIsProcessing(true);
        // Simulate AI message generation
        setTimeout(() => {
            const giftName = getGiftName();
            const businessLink = businessDetails?.customUrlPath
              ? `https://sociovip.app/${businessDetails.customUrlPath}`
              : `https://sociovip.app`;

            let messages: string[];

            switch (campaignType) {
                case 'loyalty':
                    messages = [
                        `¡Hola, [Nombre]! 🌟 En ${businessDetails?.name} valoramos tu lealtad. Como agradecimiento, te obsequiamos ${giftName}. ¡Genera tu QR aquí y disfrútalo: ${businessLink}!`,
                        `¡Gracias por ser un cliente frecuente, [Nombre]! 🤩 Te mereces un premio. Tienes ${giftName} esperándote en ${businessDetails?.name}. Reclámalo aquí: ${businessLink}`,
                    ];
                    break;
                case 'inactive':
                    messages = [
                        `¡Hola, [Nombre]! 👋 En ${businessDetails?.name} te extrañamos. Queremos que vuelvas y por eso te regalamos ${giftName}. ¡Obtén tu QR y visítanos pronto: ${businessLink}!`,
                        `¡Hace tiempo que no te vemos, [Nombre]! 😥 Vuelve a ${businessDetails?.name}, tenemos ${giftName} para ti. ¡No te lo pierdas! Genera tu QR aquí: ${businessLink}`,
                    ];
                    break;
                case 'event-attendee':
                     messages = [
                        `¡Hola, [Nombre]! Gracias por asistir a nuestro último evento. Para que la fiesta continúe, te regalamos ${giftName}. ¡Te esperamos de vuelta en ${businessDetails?.name}! Genera tu QR: ${businessLink}`,
                        `¡Nos encantó verte en el evento, [Nombre]! Como agradecimiento, ${businessDetails?.name} te obsequia ${giftName}. ¡Reclama tu regalo aquí: ${businessLink}!`,
                    ];
                    break;
                case 'birthday':
                default:
                    messages = [
                        `¡Feliz Cumpleaños, [Nombre]! 🥳 En ${businessDetails?.name || 'nuestro local'} celebramos contigo. Te regalamos ${giftName}. ¡Genera tu QR aquí: ${businessLink}!`,
                        `¡Que los cumplas muy feliz, [Nombre]! 🎂 Tu regalo de ${giftName} te espera en ${businessDetails?.name || 'nuestro local'}. Reclámalo aquí: ${businessLink}`,
                        `¡Celebra tu día con nosotros, [Nombre]! 🎉 Como regalo de parte de ${businessDetails?.name || 'nosotros'}, te obsequiamos ${giftName}. Tu QR personalizado aquí: ${businessLink}`
                    ];
                    break;
            }

            setGeneratedMessages(messages);
            setSelectedMessage(messages[0]);
            setIsProcessing(false);
            setActiveStep(1);
        }, 1500);
        return;
    }

    if (activeStep === 1) {
        if (!selectedMessage) {
            toast({ title: "Acción requerida", description: "Debes seleccionar o escribir un mensaje.", variant: "destructive" });
            return;
        }
        
        const clientsWithMessages = clients
            .filter(client => client.phone && client.phone.length > 5) // Filtrar clientes sin teléfono
            .map(client => ({
                name: client.name,
                phone: client.phone,
                message: selectedMessage.replace(/\[Nombre\]/g, client.name.split(' ')[0]) // Reemplaza todas las ocurrencias y usa solo el primer nombre
            }));
        setFinalClientList(clientsWithMessages);
    }
    
    if (activeStep < STEPS.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
        // Lógica de envío en lote
        if (finalClientList.length === 0) {
            toast({title: "No hay clientes", description: "No hay clientes con números de teléfono válidos en este segmento para enviar la campaña.", variant: "destructive"});
            return;
        }

        toast({title: "Iniciando envío...", description: `Se abrirán pestañas de WhatsApp para ${finalClientList.length} cliente(s).`});

        finalClientList.forEach((client, index) => {
            setTimeout(() => {
                handleSendToWhatsApp(client.phone, client.message);
            }, index * 2000); // Abre una nueva pestaña cada 2 segundos
        });

        handleClose();
    }
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSendToWhatsApp = (phone: string, message: string) => {
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleClose = () => {
    onOpenChange(false);
    // Use a timeout to reset state after the dialog has closed
    setTimeout(() => {
        setActiveStep(0);
        setGiftType(null);
        setSelectedPromotionId('');
        newGiftForm.reset();
        setGeneratedMessages([]);
        setSelectedMessage('');
        setFinalClientList([]);
    }, 300);
  }
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{campaignTitle}</DialogTitle>
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
                                <Card className={giftType === 'existing' ? 'border-primary' : ''}>
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
                                                    {availablePromotions.length > 0 ? 
                                                      availablePromotions.map(promo => <SelectItem key={promo.id} value={promo.id}>{promo.name}</SelectItem>)
                                                      : <div className="p-4 text-center text-sm text-muted-foreground">No hay promociones activas para elegir.</div>
                                                    }
                                                </SelectContent>
                                            </Select>
                                        </CardContent>
                                    )}
                                </Card>
                                <Card className={giftType === 'new' ? 'border-primary' : ''}>
                                    <CardHeader className="p-4 cursor-pointer" onClick={() => setGiftType('new')}>
                                        <div className="flex items-center gap-3">
                                            <input type="radio" name="giftType" checked={giftType === 'new'} onChange={() => setGiftType('new')} className="form-radio h-5 w-5 text-primary"/>
                                            <Label>Crear un vale de consumo rápido</Label>
                                        </div>
                                    </CardHeader>
                                    {giftType === 'new' && (
                                        <CardContent className="p-4 pt-0 space-y-4">
                                            <Form {...newGiftForm}>
                                                <FormField control={newGiftForm.control} name="name" render={({ field }) => (
                                                    <FormItem><Label>Nombre del Vale</Label><FormControl><Input placeholder="Ej: Trago de cortesía" {...field}/></FormControl><FormMessage/></FormItem>
                                                )}/>
                                                <FormField control={newGiftForm.control} name="description" render={({ field }) => (
                                                    <FormItem><Label>Descripción</Label><FormControl><Textarea placeholder="Ej: Válido por un Pisco Sour en tu mes." {...field}/></FormControl><FormMessage/></FormItem>
                                                )}/>
                                                <FormField control={newGiftForm.control} name="validityDays" render={({ field }) => (
                                                    <FormItem><Label>Vigencia (días)</Label><FormControl><Input type="number" {...field}/></FormControl><FormMessage/></FormItem>
                                                )}/>
                                            </Form>
                                        </CardContent>
                                    )}
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
                                            <p className="text-sm flex-1" dangerouslySetInnerHTML={{ __html: msg.replace(/🥳/g, '&#129395;').replace(/🎂/g, '&#127874;').replace(/🎉/g, '&#127881;') }} />
                                        </div>
                                    ))}
                                </div>
                                <Textarea value={selectedMessage} onChange={(e) => setSelectedMessage(e.target.value)} rows={4} placeholder="Escribe tu mensaje..."/>
                                <p className="text-xs text-muted-foreground">La etiqueta [Nombre] será reemplazada automáticamente con el primer nombre de cada cliente.</p>
                            </CardContent>
                        </Card>
                    )}
                    {index === 2 && (
                         <Card className="bg-muted/50">
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><List/>Paso 3: Revisión Final</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                               <p className="text-sm text-muted-foreground">Vas a enviar el siguiente mensaje a <span className="font-bold">{finalClientList.length}</span> cliente(s). Al hacer clic en 'Enviar Campaña', se abrirán las ventanas de WhatsApp correspondientes.</p>
                               <div className="p-4 border rounded-md bg-background">
                                   <p className="text-sm italic">{selectedMessage.replace(/\[Nombre\]/g, '(Nombre del Cliente)')}</p>
                               </div>
                               <div className="flex items-center gap-2 text-sm">
                                   <Gift className="h-4 w-4 text-primary"/>
                                   <span className="font-semibold">Regalo:</span>
                                   <span>{getGiftName()}</span>
                               </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="mt-4 flex gap-2">
                      <Button onClick={handleNext} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : (activeStep < STEPS.length - 1 ? 'Siguiente' : 'Enviar Campaña')}
                        {activeStep < STEPS.length - 1 ? <ArrowRight className="ml-2 h-4 w-4"/> : <Send className="ml-2 h-4 w-4"/>}
                      </Button>
                      <Button variant="ghost" onClick={handleBack} disabled={activeStep === 0 || isProcessing}>Atrás</Button>
                    </div>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
