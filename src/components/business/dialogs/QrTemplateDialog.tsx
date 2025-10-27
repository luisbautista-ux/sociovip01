
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Upload, Move, Settings, RefreshCw, Grab, ImageIcon as ImageIconLucide } from "lucide-react";
import NextImage from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import QRCode from 'qrcode';
import type { BusinessManagedEntity, QrTemplateLayout } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const templateFormSchema = z.object({
  qrTemplateFile: z.custom<File | null>(() => true).optional(),
  qrTemplateLayout: z.object({
    qr: z.object({ x: z.coerce.number(), y: z.coerce.number(), size: z.coerce.number() }),
    name: z.object({ x: z.coerce.number(), y: z.coerce.number(), size: z.coerce.number().optional() }),
    dni: z.object({ x: z.coerce.number(), y: z.coerce.number(), size: z.coerce.number().optional() }),
    promoTitle: z.object({ x: z.coerce.number(), y: z.coerce.number(), size: z.coerce.number().optional() }),
  }),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;
type DraggableElement = "qr" | "name" | "dni" | "promoTitle";

const elementLabels: Record<DraggableElement, string> = {
  qr: "Código QR",
  name: "Nombre Cliente",
  dni: "DNI Cliente",
  promoTitle: "Título Campaña",
};

interface QrTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: BusinessManagedEntity;
  onSave: (entityId: string, templateFile: File | null, layout: QrTemplateLayout) => Promise<void>;
  isSubmitting: boolean;
}

export function QrTemplateDialog({ open, onOpenChange, entity, onSave, isSubmitting }: QrTemplateDialogProps) {
  const { toast } = useToast();
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draggedElement, setDraggedElement] = useState<DraggableElement | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [selectedElement, setSelectedElement] = useState<DraggableElement | null>(null);
  const [snapLines, setSnapLines] = useState<{ x: number[], y: number[] }>({ x: [], y: [] });
  const templateImageInputRef = useRef<HTMLInputElement>(null);

  // --- Refs for caching images ---
  const templateImageRef = useRef<HTMLImageElement | null>(null);
  const qrImageRef = useRef<HTMLImageElement | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      qrTemplateFile: null,
      qrTemplateLayout: entity.qrTemplateLayout || {
        qr: { x: 190, y: 350, size: 80 },
        name: { x: 190, y: 450, size: 16 },
        dni: { x: 190, y: 470, size: 12 },
        promoTitle: { x: 190, y: 500, size: 14 },
      },
    }
  });

  const formValues = form.watch();

  useEffect(() => {
    if (open && entity) {
      setTemplatePreview(entity.qrTemplateImageUrl || null);
      form.reset({
        qrTemplateFile: null,
        qrTemplateLayout: entity.qrTemplateLayout || {
          qr: { x: 190, y: 350, size: 80 },
          name: { x: 190, y: 450, size: 16 },
          dni: { x: 190, y: 470, size: 12 },
          promoTitle: { x: 190, y: 500, size: 14 },
        },
      });
    }
  }, [open, entity, form]);

  const getElementRect = useCallback((key: DraggableElement, layout: QrTemplateLayout, ctx: CanvasRenderingContext2D): { x1: number, y1: number, x2: number, y2: number, cx: number, cy: number } => {
    const el = layout[key];
    const size = el.size || 16;
    if (key === 'qr') {
      const halfSize = size / 2;
      return { x1: el.x - halfSize, y1: el.y - halfSize, x2: el.x + halfSize, y2: el.y + halfSize, cx: el.x, cy: el.y };
    } else {
      const text = key === 'name' ? "Nombre1 Nombre2 Paterno Materno" : key === 'dni' ? "DNI: 12345678" : entity.name || "Nombre Promoción";
      ctx.font = `bold ${size}px Arial`;
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = size;
      return {
        x1: el.x - textWidth / 2,
        y1: el.y - textHeight,
        x2: el.x + textWidth / 2,
        y2: el.y + textHeight * 0.2,
        cx: el.x,
        cy: el.y - textHeight / 2,
      };
    }
  }, [entity.name]);
  
  // Load images and QR code into memory
  useEffect(() => {
    let isMounted = true;
    setImagesLoaded(false);

    const loadResources = async () => {
      const layout = form.getValues('qrTemplateLayout');
      
      const templatePromise = new Promise<HTMLImageElement | null>((resolve) => {
        if (templatePreview) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = templatePreview;
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
        } else {
          resolve(null);
        }
      });

      const qrPromise = new Promise<HTMLImageElement | null>((resolve) => {
          QRCode.toDataURL("SocioVipPreview", { width: layout.qr.size, errorCorrectionLevel: "H", margin: 1 })
            .then(url => {
              const img = new Image();
              img.src = url;
              img.onload = () => resolve(img);
              img.onerror = () => resolve(null);
            })
            .catch(() => resolve(null));
      });
      
      const [templateImg, qrImg] = await Promise.all([templatePromise, qrPromise]);

      if (isMounted) {
        templateImageRef.current = templateImg;
        qrImageRef.current = qrImg;
        setImagesLoaded(true);
      }
    };
    
    loadResources();

    return () => { isMounted = false; };
  }, [templatePreview, form.getValues('qrTemplateLayout').qr.size]);


  const drawPreviewOnCanvas = useCallback((highlightedElement: DraggableElement | null = null, currentSnapLines: { x: number[], y: number[] }) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    if (templateImageRef.current) {
        const templateImg = templateImageRef.current;
        canvas.width = templateImg.width;
        canvas.height = templateImg.height;

        ctx.drawImage(templateImg, 0, 0, templateImg.width, templateImg.height);
        
        const layout = form.getValues('qrTemplateLayout') as QrTemplateLayout;

        const drawElement = (key: DraggableElement, isHighlight: boolean) => {
          if (!key) return;
          const config = layout[key as keyof typeof layout] as any;
          if (!config) return;

          ctx.save();
          if (isHighlight) {
            ctx.fillStyle = 'rgba(0, 123, 255, 0.3)';
            ctx.strokeStyle = 'rgba(0, 123, 255, 0.7)';
            ctx.lineWidth = 2;
          }

          if (key === 'qr' && qrImageRef.current) {
            const rect = getElementRect(key, layout, ctx);
            ctx.drawImage(qrImageRef.current, rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
            if (isHighlight) ctx.strokeRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
          } else if (key !== 'qr') {
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            const text = key === 'name' ? "Nombre Completo Del Cliente" : key === 'dni' ? "DNI: 12345678" : entity.name || "Nombre Campaña";
            let fontSize = config.size || (key === 'name' ? 16 : key === 'dni' ? 12 : 14);
            ctx.font = `bold ${fontSize}px Arial`;
            
            const maxWidth = canvas.width * 0.9;
            while (ctx.measureText(text).width > maxWidth && fontSize > 8) {
              fontSize--;
              ctx.font = `bold ${fontSize}px Arial`;
            }
            
            const rect = getElementRect(key, layout, ctx);
            ctx.fillText(text, config.x, config.y);
            if (isHighlight) ctx.strokeRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
          }
          ctx.restore();
        };

        (Object.keys(layout) as DraggableElement[]).forEach(key => drawElement(key, highlightedElement === key));
        
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = Math.max(1, canvas.width / 250);
        currentSnapLines.x.forEach(x => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); });
        currentSnapLines.y.forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); });
        ctx.restore();
        
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
  }, [entity.name, form, getElementRect, imagesLoaded]);


  useEffect(() => {
    if (imagesLoaded) {
      drawPreviewOnCanvas(selectedElement, snapLines);
    }
  }, [drawPreviewOnCanvas, formValues, selectedElement, snapLines, imagesLoaded]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Archivo muy grande", description: "La imagen no debe superar los 5MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setTemplatePreview(reader.result as string);
        form.setValue("qrTemplateFile", file);
      };
      reader.readAsDataURL(file);
    }
  };

  const getElementAtPos = (x: number, y: number): DraggableElement | null => {
    const layout = form.getValues('qrTemplateLayout');
    if (!layout || !canvasRef.current) return null;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return null;
    
    const elements: DraggableElement[] = ['qr', 'name', 'dni', 'promoTitle'];
    for (const key of elements) {
      const rect = getElementRect(key, layout, ctx);
      if (x > rect.x1 && x < rect.x2 && y > rect.y1 && y < rect.y2) {
        return key;
      }
    }
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
    let canvasX = (e.clientX - rect.left) * scaleX;
    let canvasY = (e.clientY - rect.top) * scaleY;
    
    if (draggedElement) {
        let newX = Math.round(canvasX + dragOffset.current.x);
        let newY = Math.round(canvasY + dragOffset.current.y);

        const layout = form.getValues('qrTemplateLayout');
        const ctx = canvas.getContext('2d');
        if (!layout || !ctx) return;
        
        const snapThreshold = Math.max(5, Math.round(canvas.width * 0.01));

        const activeSnapLines: { x: number[], y: number[] } = { x: [], y: [] };

        const snapPoints: { x: { val: number }[], y: { val: number }[] } = {
            x: [{ val: canvas.width / 2 }],
            y: [{ val: canvas.height / 2 }],
        };

        (Object.keys(layout) as DraggableElement[]).forEach(key => {
            if (key !== draggedElement) {
                const staticRect = getElementRect(key, layout, ctx);
                snapPoints.x.push({ val: staticRect.cx });
                snapPoints.y.push({ val: staticRect.cy });
            }
        });
        
        for (const snapPoint of snapPoints.x) if (Math.abs(newX - snapPoint.val) < snapThreshold) { newX = snapPoint.val; activeSnapLines.x.push(snapPoint.val); break; }
        for (const snapPoint of snapPoints.y) if (Math.abs(newY - snapPoint.val) < snapThreshold) { newY = snapPoint.val; activeSnapLines.y.push(snapPoint.val); break; }

        setSnapLines(activeSnapLines);
        form.setValue(`qrTemplateLayout.${draggedElement}.x`, newX);
        form.setValue(`qrTemplateLayout.${draggedElement}.y`, newY);

    } else {
        const element = getElementAtPos(canvasX, canvasY);
        canvas.style.cursor = element ? 'move' : 'default';
        setSnapLines({ x: [], y: [] });
    }
  };
  
  const handleCanvasMouseUp = () => { setDraggedElement(null); setSnapLines({ x: [], y: [] }); if(canvasRef.current) canvasRef.current.style.cursor = 'default'; };
  
  const handleResetPosition = (element: DraggableElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = Math.round(canvas.width / 2);
    const centerY = Math.round(canvas.height / 2);
    form.setValue(`qrTemplateLayout.${element}.x`, centerX);
    form.setValue(`qrTemplateLayout.${element}.y`, centerY);
    toast({ title: "Posición Reseteada", description: `El elemento "${elementLabels[element]}" se ha centrado.`})
  };

  const handleSave = (values: TemplateFormValues) => {
    onSave(entity.id, values.qrTemplateFile || null, values.qrTemplateLayout);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle>Personalizar Plantilla QR para: {entity.name}</DialogTitle>
          <DialogDescription>Sube una imagen de fondo y arrastra los elementos para posicionarlos.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="flex-grow grid md:grid-cols-3 gap-6 overflow-hidden p-6 pt-0">
            <div className="md:col-span-2 flex flex-col items-center justify-center space-y-3 bg-muted/50 p-4 rounded-lg overflow-hidden">
                <canvas 
                  ref={canvasRef} 
                  className="w-full max-w-xs h-auto cursor-grab active:cursor-grabbing rounded-md shadow-lg"
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
            </div>
            <div className="md:col-span-1 flex flex-col space-y-4 overflow-y-auto pr-2">
                <div className="space-y-2">
                    <Label htmlFor="template-upload-button">Imagen de Plantilla</Label>
                    <input type="file" ref={templateImageInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
                    <Button id="template-upload-button" type="button" variant="outline" onClick={() => templateImageInputRef.current?.click()} disabled={isSubmitting} className="w-full">
                        <Upload className="mr-2 h-4 w-4"/> {templatePreview ? 'Cambiar Plantilla' : 'Subir Plantilla'}
                    </Button>
                    <FormMessage>{form.formState.errors.qrTemplateFile?.message}</FormMessage>
                </div>

                <Card>
                    <CardHeader className="p-3"><CardTitle className="text-base">Caja de Herramientas</CardTitle></CardHeader>
                    <CardContent className="p-3 grid grid-cols-2 gap-2">
                        {(Object.keys(elementLabels) as DraggableElement[]).map(key => (
                            <Button 
                                key={key} 
                                type="button" 
                                variant={selectedElement === key ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedElement(key)}
                                className="flex items-center justify-start gap-2"
                                onMouseDown={(e) => { e.preventDefault(); setDraggedElement(key); toast({title:"Arrastrando elemento", description: `Ahora mueve "${elementLabels[key]}" en la vista previa.`})}}
                            >
                                <Grab size={16} className="text-muted-foreground"/> {elementLabels[key]}
                            </Button>
                        ))}
                    </CardContent>
                </Card>
                
                {selectedElement && (
                  <Card className="bg-background">
                    <CardHeader className="p-3"><CardTitle className="text-base flex items-center justify-between">Ajustes para: {elementLabels[selectedElement]}
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleResetPosition(selectedElement)}><RefreshCw className="h-4 w-4"/><span className="sr-only">Resetear Posición</span></Button>
                    </CardTitle></CardHeader>
                    <CardContent className="p-3 grid grid-cols-2 gap-4">
                        <FormField control={form.control} name={`qrTemplateLayout.${selectedElement}.x`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Posición X</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                        <FormField control={form.control} name={`qrTemplateLayout.${selectedElement}.y`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Posición Y</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                        <FormField control={form.control} name={`qrTemplateLayout.${selectedElement}.size`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel className="text-xs">Tamaño</FormLabel><FormControl><Input type="number" {...field}/></FormControl></FormItem>)}/>
                    </CardContent>
                  </Card>
                )}
            </div>

            <DialogFooter className="md:col-span-3 pt-4 border-t mt-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                <Button type="submit" variant="gradient" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Guardar Plantilla"}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
