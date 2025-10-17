
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import React, { useState, useEffect, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ImageIcon, Loader2, Move } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { BusinessManagedEntity, BusinessPromotionFormData } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import NextImage from "next/image";
import { useToast } from "@/hooks/use-toast";


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
  qrTemplateImageUrl: z.string().url("URL de plantilla inválida.").optional().or(z.literal("")),
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

interface BusinessPromotionFormProps {
  promotion?: BusinessManagedEntity; 
  onSubmit: (data: BusinessPromotionFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BusinessPromotionForm({ promotion, onSubmit, onCancel, isSubmitting = false }: BusinessPromotionFormProps) {
  
  const [imageToAdjust, setImageToAdjust] = useState<string | null>(null);
  const [objectPosition, setObjectPosition] = useState(promotion?.imageObjectPosition || '50% 50%');
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      name: promotion?.name || "",
      description: promotion?.description || "",
      startDate: promotion?.startDate ? new Date(promotion.startDate) : new Date(),
      endDate: promotion?.endDate ? new Date(promotion.endDate) : new Date(new Date().setDate(new Date().getDate() + 7)),
      usageLimit: promotion?.usageLimit === undefined || promotion?.usageLimit === null ? undefined : promotion.usageLimit,
      isActive: promotion?.isActive === undefined ? true : promotion.isActive,
      imageUrl: promotion?.imageUrl || "",
      imageFile: null,
      imageObjectPosition: promotion?.imageObjectPosition || "50% 50%",
      termsAndConditions: promotion?.termsAndConditions || "",
      qrTemplateImageUrl: promotion?.qrTemplateImageUrl || "",
    },
  });

  useEffect(() => {
    if (promotion) {
      const initialPosition = promotion.imageObjectPosition || '50% 50%';
      setImageToAdjust(promotion.imageUrl || null);
      setObjectPosition(initialPosition);
      form.reset({
        name: promotion.name || "",
        description: promotion.description || "",
        startDate: promotion.startDate ? new Date(promotion.startDate) : new Date(),
        endDate: promotion.endDate ? new Date(promotion.endDate) : new Date(new Date().setDate(new Date().getDate() + 7)),
        usageLimit: promotion.usageLimit === undefined || promotion.usageLimit === null ? undefined : promotion.usageLimit,
        isActive: promotion.isActive === undefined ? true : promotion.isActive,
        imageUrl: promotion.imageUrl || "",
        imageFile: null,
        imageObjectPosition: initialPosition,
        termsAndConditions: promotion.termsAndConditions || "",
        qrTemplateImageUrl: promotion.qrTemplateImageUrl || "",
      });
    }
  }, [promotion, form]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "Archivo muy grande", description: "La imagen no debe superar los 5MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImageToAdjust(reader.result as string);
        setObjectPosition('50% 50%'); // Reset position for new image
        form.setValue("imageFile", file);
        form.setValue("imageObjectPosition", '50% 50%');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !imgContainerRef.current) return;
    const container = imgContainerRef.current;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    const [currentX, currentY] = objectPosition.split(' ').map(p => parseFloat(p));
    
    const newX = Math.max(0, Math.min(100, currentX - (dx / container.clientWidth) * 100));
    const newY = Math.max(0, Math.min(100, currentY - (dy / container.clientHeight) * 100));

    const newPosition = `${newX.toFixed(2)}% ${newY.toFixed(2)}%`;
    setObjectPosition(newPosition);
    form.setValue("imageObjectPosition", newPosition);

    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };
  
  const handleMouseLeave = () => {
    isDragging.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current || !imgContainerRef.current || e.touches.length !== 1) return;
    const container = imgContainerRef.current;
    const dx = e.touches[0].clientX - dragStart.current.x;
    const dy = e.touches[0].clientY - dragStart.current.y;

    const [currentX, currentY] = objectPosition.split(' ').map(p => parseFloat(p));
    
    const newX = Math.max(0, Math.min(100, currentX - (dx / container.clientWidth) * 100));
    const newY = Math.max(0, Math.min(100, currentY - (dy / container.clientHeight) * 100));

    const newPosition = `${newX.toFixed(2)}% ${newY.toFixed(2)}%`;
    setObjectPosition(newPosition);
    form.setValue("imageObjectPosition", newPosition);

    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const handleSubmit = (values: PromotionFormValues) => {
    const dataToSubmit: BusinessPromotionFormData = {
        ...values,
        usageLimit: values.usageLimit === undefined || values.usageLimit === null || isNaN(Number(values.usageLimit)) ? undefined : Number(values.usageLimit),
        imageObjectPosition: objectPosition,
    };
    onSubmit(dataToSubmit);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        
        <div className="flex flex-col items-center justify-center mb-4 space-y-3">
          <div 
            ref={imgContainerRef}
            className="group w-full aspect-video relative rounded-md border bg-muted flex items-center justify-center overflow-hidden cursor-move"
            style={{ touchAction: 'none' }} // This is the crucial fix for mobile
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {imageToAdjust ? (
              <>
                <NextImage 
                  src={imageToAdjust} 
                  alt="Vista previa de la imagen" 
                  layout="fill" 
                  className="object-cover pointer-events-none"
                  style={{ objectPosition }}
                  draggable={false}
                  unoptimized // Important for data URLs
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white pointer-events-none">
                    <Move className="h-8 w-8" />
                    <span className="text-sm font-semibold mt-1">Arrastra para ajustar la imagen</span>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center">
                <ImageIcon className="h-10 w-10" />
                <span className="text-sm mt-1">Vista Previa</span>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
          />
          
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
              Cambiar Imagen
          </Button>

          <FormMessage>{form.formState.errors.imageFile?.message}</FormMessage>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la Promoción <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Ej: 2x1 en Cervezas" {...field} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción <span className="text-destructive">*</span></FormLabel>
              <FormControl><Textarea placeholder="Detalles de la promoción..." {...field} rows={3} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="termsAndConditions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Términos y Condiciones</FormLabel>
              <FormControl><Textarea placeholder="Condiciones de la promoción, ej: Válido solo para consumo en local." {...field} value={field.value || ""} rows={3} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de Inicio <span className="text-destructive">*</span></FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>
                        {field.value ? format(new Date(field.value), "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={es} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de Fin <span className="text-destructive">*</span></FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>
                        {field.value ? format(new Date(field.value), "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={{ before: form.getValues("startDate") }} locale={es} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="usageLimit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Límite de Usos</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="Ej: 100 (0 o vacío para ilimitado)" 
                  {...field}
                  value={field.value ?? ""}
                  onChange={e => {
                    const value = e.target.value;
                    field.onChange(value === "" ? undefined : Number(value));
                  }} 
                  disabled={isSubmitting} 
                />
              </FormControl>
              <FormDescription className="text-xs">Dejar vacío o 0 para usos ilimitados.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="qrTemplateImageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL de Plantilla para QR (Opcional)</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://ejemplo.com/plantilla-qr.png"
                  {...field}
                  value={field.value || ""}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription className="text-xs">
                La imagen de fondo sobre la que se colocarán el QR y los datos del cliente.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Activar Promoción <span className="text-destructive">*</span></FormLabel>
                <FormMessage />
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} /></FormControl>
            </FormItem>
          )}
        />
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
