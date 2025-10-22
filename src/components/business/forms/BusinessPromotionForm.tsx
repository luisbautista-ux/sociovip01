"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ImageIcon, Loader2, Move, Upload, Settings, RefreshCw, Grab } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { BusinessManagedEntity, BusinessPromotionFormData, QrTemplateLayout } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import NextImage from "next/image";
import { useToast } from "@/hooks/use-toast";
import QRCode from 'qrcode';


const promotionFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  startDate: z.date({ required_error: "Fecha de inicio es requerida." }),
  endDate: z.date({ required_error: "Fecha de fin es requerida." }),
  usageLimit: z.coerce.number().int().positive().optional().or(z.literal(0)).or(z.literal(undefined)),
  isActive: z.boolean().default(true),
  imageUrl: z.string().optional(),
  imageFile: z.custom<File | null>(() => true).optional(),
  imageObjectPosition: z.string().optional(),
  termsAndConditions: z.string().optional(),
  qrTemplateImageUrl: z.string().optional(),
  qrTemplateFile: z.custom<File | null>(() => true).optional(),
  templateObjectPosition: z.string().optional(),
  qrTemplateLayout: z.object({
    qr: z.object({ x: z.coerce.number(), y: z.coerce.number(), size: z.coerce.number() }),
    name: z.object({ x: z.coerce.number(), y: z.coerce.number(), size: z.coerce.number().optional() }),
    dni: z.object({ x: z.coerce.number(), y: z.coerce.number(), size: z.coerce.number().optional() }),
    promoTitle: z.object({ x: z.coerce.number(), y: z.coerce.number(), size: z.coerce.number().optional() }),
  }).optional(),
}).refine(data => {
    if (data.startDate && data.endDate) {
        const start = new Date(data.startDate.getFullYear(), data.startDate.getMonth(), data.startDate.getDate());
        const end = new Date(data.endDate.getFullYear(), data.endDate.getMonth(), data.endDate.getDate());
        return end >= start;
    }
    return true;
}, {
  message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
  path: ["endDate"],
});

type PromotionFormValues = z.infer<typeof promotionFormSchema>;

type DraggableElement = "qr" | "name" | "dni" | "promoTitle";

const elementLabels: Record<DraggableElement, string> = {
  qr: "Código QR",
  name: "Nombre Cliente",
  dni: "DNI Cliente",
  promoTitle: "Título Promoción",
};

interface BusinessPromotionFormProps {
  promotion?: BusinessManagedEntity; 
  onSubmit: (data: BusinessPromotionFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BusinessPromotionForm({ promotion, onSubmit, onCancel, isSubmitting = false }: BusinessPromotionFormProps) {
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [objectPosition, setObjectPosition] = useState(promotion?.imageObjectPosition || '50% 50%');
  const [templateObjectPosition, setTemplateObjectPosition] = useState(promotion?.templateObjectPosition || '50% 50%'); // New state for template position
  
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const templateContainerRef = useRef<HTMLDivElement>(null);

  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const templateImageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draggedElement, setDraggedElement] = useState<DraggableElement | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [selectedElement, setSelectedElement] = useState<DraggableElement | null>(null);


  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
      usageLimit: undefined,
      isActive: true,
      imageUrl: "",
      imageFile: null,
      imageObjectPosition: '50% 50%',
      termsAndConditions: "",
      qrTemplateImageUrl: "",
      qrTemplateFile: null,
      templateObjectPosition: '50% 50%',
      qrTemplateLayout: {
        qr: { x: 190, y: 350, size: 80 },
        name: { x: 190, y: 450, size: 16 },
        dni: { x: 190, y: 470, size: 12 },
        promoTitle: { x: 190, y: 500, size: 14 },
      },
    },
  });
  
  const formValues = form.watch();

  useEffect(() => {
    if (promotion) {
      const initialImgPos = promotion.imageObjectPosition || '50% 50%';
      const initialTmplPos = promotion.templateObjectPosition || '50% 50%';
      const initialLayout = promotion.qrTemplateLayout || {
        qr: { x: 190, y: 350, size: 80 },
        name: { x: 190, y: 450, size: 16 },
        dni: { x: 190, y: 470, size: 12 },
        promoTitle: { x: 190, y: 500, size: 14 },
      };

      setObjectPosition(initialImgPos);
      setTemplateObjectPosition(initialTmplPos);
      setImagePreview(promotion.imageUrl || null);
      setTemplatePreview(promotion.qrTemplateImageUrl || null);

      form.reset({
        name: promotion.name || "",
        description: promotion.description || "",
        startDate: promotion.startDate ? new Date(promotion.startDate) : new Date(),
        endDate: promotion.endDate ? new Date(promotion.endDate) : new Date(new Date().setDate(new Date().getDate() + 7)),
        usageLimit: promotion.usageLimit === undefined || promotion.usageLimit === null ? undefined : promotion.usageLimit,
        isActive: promotion.isActive === undefined ? true : promotion.isActive,
        imageUrl: promotion.imageUrl || "",
        imageFile: null,
        imageObjectPosition: initialImgPos,
        termsAndConditions: promotion.termsAndConditions || "",
        qrTemplateImageUrl: promotion.qrTemplateImageUrl || "",
        qrTemplateFile: null,
        templateObjectPosition: initialTmplPos,
        qrTemplateLayout: initialLayout,
      });
    }
  }, [promotion, form]);
  
  const drawPreviewOnCanvas = useCallback(async (highlightedElement: DraggableElement | null = null) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    if (templatePreview) {
        const templateImg = new Image();
        templateImg.crossOrigin = "anonymous";
        templateImg.src = templatePreview;
        await new Promise<void>((resolve, reject) => {
            templateImg.onload = () => resolve();
            templateImg.onerror = reject;
        });

        canvas.width = templateImg.width;
        canvas.height = templateImg.height;

        ctx.drawImage(templateImg, 0, 0, templateImg.width, templateImg.height);

        const layout = form.getValues('qrTemplateLayout') || {
            qr: { x: 190, y: 350, size: 80 },
            name: { x: 190, y: 450, size: 16 },
            dni: { x: 190, y: 470, size: 12 },
            promoTitle: { x: 190, y: 500, size: 14 },
        };

        const exampleQrDataUrl = await QRCode.toDataURL("SocioVipPreview", { width: layout.qr.size, errorCorrectionLevel: "H", margin: 1 });
        const qrImage = new Image();
        qrImage.src = exampleQrDataUrl;
        await new Promise(resolve => (qrImage.onload = resolve));
        
        const drawElement = (key: DraggableElement, isHighlight: boolean) => {
          if(!key) return;
          const config = layout[key as keyof typeof layout] as any;
          if(!config) return;

          ctx.save();
          if (isHighlight) {
            ctx.fillStyle = 'rgba(0, 123, 255, 0.3)';
            ctx.strokeStyle = 'rgba(0, 123, 255, 0.7)';
            ctx.lineWidth = 2;
          }

          if (key === 'qr') {
            ctx.drawImage(qrImage, config.x - (config.size / 2), config.y - (config.size / 2), config.size, config.size);
            if(isHighlight) ctx.strokeRect(config.x - (config.size / 2), config.y - (config.size / 2), config.size, config.size);
          } else {
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            const fontSize = config.size || (key === 'name' ? 16 : key === 'dni' ? 12 : 14);
            ctx.font = `bold ${fontSize}px Arial`;
            const text = key === 'name' ? "Nombre1 Nombre2 Paterno Materno" : key === 'dni' ? "DNI: 12345678" : formValues.name || "Nombre Promoción";
            const textMetrics = ctx.measureText(text);
            const textWidth = textMetrics.width;
            const textHeight = fontSize;
            ctx.fillText(text, config.x, config.y);
            if(isHighlight) ctx.strokeRect(config.x - textWidth/2, config.y - textHeight, textWidth, textHeight * 1.2);
          }
           ctx.restore();
        }
        
        drawElement('qr', highlightedElement === 'qr');
        drawElement('name', highlightedElement === 'name');
        drawElement('dni', highlightedElement === 'dni');
        drawElement('promoTitle', highlightedElement === 'promoTitle');
        
    } else {
        canvas.width = 380;
        canvas.height = 700;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.font = '14px Arial';
        ctx.fillText("Sube una plantilla para ver la vista previa", canvas.width / 2, canvas.height / 2);
    }
  }, [templatePreview, formValues.name, form.getValues('qrTemplateLayout')]);


  useEffect(() => {
    drawPreviewOnCanvas(selectedElement);
  }, [drawPreviewOnCanvas, formValues, selectedElement]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, fileType: 'main' | 'template') => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "Archivo muy grande", description: "La imagen no debe superar los 5MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (fileType === 'main') {
          setImagePreview(reader.result as string);
          setObjectPosition('50% 50%');
          form.setValue("imageFile", file);
          form.setValue("imageObjectPosition", '50% 50%');
        } else {
          setTemplatePreview(reader.result as string);
          setTemplateObjectPosition('50% 50%');
          form.setValue("qrTemplateFile", file);
          form.setValue("templateObjectPosition", '50% 50%');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDragging.current = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      dragStart.current = { x: clientX, y: clientY };
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, containerRef: React.RefObject<HTMLDivElement>, currentPosition: string, setPosition: (pos: string) => void) => {
      if (!isDragging.current || !containerRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const container = containerRef.current;
      const dx = clientX - dragStart.current.x;
      const dy = clientY - dragStart.current.y;
      const [currentX, currentY] = currentPosition.split(' ').map(p => parseFloat(p));
      
      const newX = Math.max(0, Math.min(100, currentX - (dx / container.clientWidth) * 100));
      const newY = Math.max(0, Math.min(100, currentY - (dy / container.clientHeight) * 100));
      const newPosition = `${newX.toFixed(2)}% ${newY.toFixed(2)}%`;
      
      setPosition(newPosition);
      dragStart.current = { x: clientX, y: clientY };
  };

  const handleDragEnd = (fieldName: "imageObjectPosition" | "templateObjectPosition", position: string) => {
      if (isDragging.current) {
          isDragging.current = false;
          form.setValue(fieldName, position);
      }
  };

  const getElementAtPos = (x: number, y: number): DraggableElement | null => {
    const layout = form.getValues('qrTemplateLayout');
    if (!layout) return null;

    const checkHit = (key: 'qr' | 'name' | 'dni' | 'promoTitle') => {
      const el = layout[key as keyof typeof layout];
      if (!el) return false;
      const elSize = el.size || 16;
      if (key === 'qr') {
        return x > el.x - elSize / 2 && x < el.x + elSize / 2 && y > el.y - elSize / 2 && y < el.y + elSize / 2;
      } else {
        const textHeight = elSize * 1.2;
        const textWidth = (key === 'name' ? 200 : key === 'dni' ? 80 : 150); // Approximation
        return x > el.x - textWidth / 2 && x < el.x + textWidth / 2 && y > el.y - textHeight && y < el.y + textHeight * 0.2;
      }
    };
    if (checkHit('qr')) return 'qr';
    if (checkHit('name')) return 'name';
    if (checkHit('dni')) return 'dni';
    if (checkHit('promoTitle')) return 'promoTitle';
    return null;
  };
  
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    
    const element = getElementAtPos(canvasX, canvasY);
    setSelectedElement(element); 
    if (element) {
        setDraggedElement(element);
        const elLayout = form.getValues(`qrTemplateLayout.${element}`);
        if(elLayout) {
          dragOffset.current = { x: elLayout.x - canvasX, y: elLayout.y - canvasY };
        }
        canvas.style.cursor = 'move';
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    
    if (draggedElement) {
        const newX = Math.round(canvasX + dragOffset.current.x);
        const newY = Math.round(canvasY + dragOffset.current.y);
        form.setValue(`qrTemplateLayout.${draggedElement}.x`, newX);
        form.setValue(`qrTemplateLayout.${draggedElement}.y`, newY);
    } else {
        const element = getElementAtPos(canvasX, canvasY);
        canvas.style.cursor = element ? 'move' : 'default';
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggedElement(null);
    if(canvasRef.current) canvasRef.current.style.cursor = 'default';
  };
  
  const handleResetPosition = (element: DraggableElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = Math.round(canvas.width / 2);
    const centerY = Math.round(canvas.height / 2);
    form.setValue(`qrTemplateLayout.${element}.x`, centerX);
    form.setValue(`qrTemplateLayout.${element}.y`, centerY);
    toast({ title: "Posición Reseteada", description: `El elemento "${elementLabels[element]}" se ha centrado.`})
  }


  const handleSubmit = (values: PromotionFormValues) => {
    onSubmit({
      ...values,
      usageLimit: values.usageLimit === undefined || values.usageLimit === null || isNaN(Number(values.usageLimit)) ? undefined : Number(values.usageLimit),
      imageObjectPosition: objectPosition,
      templateObjectPosition: templateObjectPosition,
      qrTemplateLayout: values.qrTemplateLayout,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        
        <div className="flex flex-col items-center justify-center mb-4 space-y-3">
          <FormLabel className="self-start">Imagen Principal <span className="text-destructive">*</span></FormLabel>
          <div 
            ref={imgContainerRef} 
            className="group w-full aspect-video relative rounded-md border bg-muted flex items-center justify-center overflow-hidden cursor-move"
            style={{ touchAction: 'none' }} 
            onMouseDown={(e) => handleDragStart(e)}
            onMouseMove={(e) => handleDragMove(e, imgContainerRef, objectPosition, setObjectPosition)}
            onMouseUp={() => handleDragEnd("imageObjectPosition", objectPosition)}
            onMouseLeave={() => handleDragEnd("imageObjectPosition", objectPosition)}
            onTouchStart={(e) => handleDragStart(e)}
            onTouchMove={(e) => handleDragMove(e, imgContainerRef, objectPosition, setObjectPosition)}
            onTouchEnd={() => handleDragEnd("imageObjectPosition", objectPosition)}
          >
            {imagePreview ? (
              <>
                <NextImage src={imagePreview} alt="Vista previa" layout="fill" className="object-cover pointer-events-none" style={{ objectPosition }} draggable={false} unoptimized />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-2">
                  <Move className="h-8 w-8" />
                  <span className="text-sm font-semibold mt-1 text-center">Arrastra para ajustar el enfoque de la imagen</span>
                </div>
              </>
            ) : ( <div className="text-muted-foreground flex flex-col items-center"><ImageIcon className="h-10 w-10" /><span className="text-sm mt-1">Vista Previa</span></div> )}
          </div>
          <input type="file" ref={mainImageInputRef} onChange={(e) => handleFileChange(e, 'main')} className="hidden" accept="image/png, image/jpeg, image/webp" />
          <Button type="button" variant="outline" onClick={() => mainImageInputRef.current?.click()} disabled={isSubmitting}><Upload className="mr-2 h-4 w-4"/> Subir Imagen Principal</Button>
          <FormMessage>{form.formState.errors.imageFile?.message}</FormMessage>
        </div>

        <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Nombre de la Promoción <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Ej: 2x1 en Cervezas" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem><FormLabel>Descripción <span className="text-destructive">*</span></FormLabel><FormControl><Textarea placeholder="Detalles de la promoción..." {...field} rows={3} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="termsAndConditions" render={({ field }) => (
            <FormItem><FormLabel>Términos y Condiciones</FormLabel><FormControl><Textarea placeholder="Condiciones de la promoción, ej: Válido solo para consumo en local." {...field} value={field.value ?? ""} rows={3} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Fecha de Inicio <span className="text-destructive">*</span></FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>{field.value ? format(new Date(field.value), "PPP", { locale: es }) : <span>Selecciona fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={es} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Fecha de Fin <span className="text-destructive">*</span></FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>{field.value ? format(new Date(field.value), "PPP", { locale: es }) : <span>Selecciona fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={{ before: form.getValues("startDate") }} locale={es} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
            )}/>
        </div>
        
        <FormField control={form.control} name="usageLimit" render={({ field }) => (
            <FormItem><FormLabel>Límite de Usos</FormLabel><FormControl><Input type="number" placeholder="Ej: 100 (0 o vacío para ilimitado)" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} disabled={isSubmitting} /></FormControl><FormDescription className="text-xs">Dejar vacío o 0 para usos ilimitados.</FormDescription><FormMessage /></FormItem>
        )}/>
        
        <div className="pt-4 border-t mt-6 space-y-4">
          <h3 className="flex items-center font-medium"><Settings className="h-5 w-5 mr-2"/>Personalización de Plantilla QR (Opcional)</h3>
          
          <div className="flex flex-col items-center justify-center space-y-3">
            <FormLabel className="self-start">Imagen de Plantilla</FormLabel>
            <div className="group w-full max-w-xs relative rounded-md border bg-muted flex items-center justify-center overflow-hidden">
               <canvas 
                  ref={canvasRef} 
                  className="w-full h-auto cursor-grab active:cursor-grabbing" 
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
            </div>
            <input type="file" ref={templateImageInputRef} onChange={(e) => handleFileChange(e, 'template')} className="hidden" accept="image/png, image/jpeg, image/webp" />
            <Button type="button" variant="outline" onClick={() => templateImageInputRef.current?.click()} disabled={isSubmitting}><Upload className="mr-2 h-4 w-4"/> {templatePreview ? 'Cambiar' : 'Subir'} Plantilla</Button>
            <FormDescription className="text-xs">Imagen de fondo para el QR descargable (Formato Ticket).</FormDescription>
            <FormMessage>{form.formState.errors.qrTemplateFile?.message}</FormMessage>
          </div>

          <Card>
            <CardHeader className="p-3">
              <CardTitle className="text-sm">Caja de Herramientas</CardTitle>
            </CardHeader>
            <CardContent className="p-3 grid grid-cols-2 gap-2">
                {(Object.keys(elementLabels) as DraggableElement[]).map(key => (
                    <Button 
                        key={key} 
                        type="button" 
                        variant={selectedElement === key ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedElement(key)}
                        className="flex items-center justify-start gap-2"
                        onMouseDown={() => {setDraggedElement(key); toast({title:"Arrastrando elemento", description: `Ahora mueve "${elementLabels[key]}" en la vista previa.`})}}
                    >
                        <Grab size={16} className="text-muted-foreground"/> {elementLabels[key]}
                    </Button>
                ))}
            </CardContent>
          </Card>
          
          {selectedElement && (
            <Card className="bg-muted/50">
              <CardHeader className="p-3">
                <CardTitle className="text-base flex items-center justify-between">
                  Ajustes para: {elementLabels[selectedElement]}
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleResetPosition(selectedElement)}>
                    <RefreshCw className="h-4 w-4"/>
                    <span className="sr-only">Resetear Posición</span>
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-2 gap-4">
                  <FormField control={form.control} name={`qrTemplateLayout.${selectedElement}.x`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Posición X</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                  <FormField control={form.control} name={`qrTemplateLayout.${selectedElement}.y`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Posición Y</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                  <FormField control={form.control} name={`qrTemplateLayout.${selectedElement}.size`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel className="text-xs">Tamaño</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
              </CardContent>
            </Card>
          )}

        </div>
        
        <FormField control={form.control} name="isActive" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-6"><div className="space-y-0.5"><FormLabel>Activar Promoción <span className="text-destructive">*</span></FormLabel><FormMessage /></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} /></FormControl></FormItem>
        )}/>
        
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" variant="gradient" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {promotion ? "Guardar Cambios" : "Crear Promoción"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
