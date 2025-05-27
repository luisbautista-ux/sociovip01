
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
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
import { CalendarIcon, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { BusinessManagedEntity, BusinessPromotionFormData } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";

const promotionFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  startDate: z.date({ required_error: "Fecha de inicio es requerida." }),
  endDate: z.date({ required_error: "Fecha de fin es requerida." }),
  usageLimit: z.coerce.number().int().positive().optional().or(z.literal(0)).or(z.literal(undefined)),
  isActive: z.boolean().default(true),
  imageUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal("")),
  aiHint: z.string().optional(),
  termsAndConditions: z.string().optional(),
}).refine(data => data.endDate >= data.startDate, {
  message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
  path: ["endDate"],
});

type PromotionFormValues = z.infer<typeof promotionFormSchema>;

interface BusinessPromotionFormProps {
  promotion?: BusinessManagedEntity; // For editing
  onSubmit: (data: BusinessPromotionFormData) => void;
  onCancel: () => void;
}

export function BusinessPromotionForm({ promotion, onSubmit, onCancel }: BusinessPromotionFormProps) {
  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      name: promotion?.name || "",
      description: promotion?.description || "",
      startDate: promotion?.startDate ? new Date(promotion.startDate) : new Date(),
      endDate: promotion?.endDate ? new Date(promotion.endDate) : new Date(new Date().setDate(new Date().getDate() + 7)),
      usageLimit: promotion?.usageLimit || undefined,
      isActive: promotion?.isActive === undefined ? true : promotion.isActive,
      imageUrl: promotion?.imageUrl || "",
      aiHint: promotion?.aiHint || "",
      termsAndConditions: promotion?.termsAndConditions || "",
    },
  });

  const handleSubmit = (values: PromotionFormValues) => {
    onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la Promoción</FormLabel>
              <FormControl><Input placeholder="Ej: 2x1 en Cervezas" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl><Textarea placeholder="Detalles de la promoción..." {...field} rows={3} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="termsAndConditions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Términos y Condiciones (Opcional)</FormLabel>
              <FormControl><Textarea placeholder="Condiciones de la promoción..." {...field} rows={3} /></FormControl>
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
                <FormLabel>Fecha de Inicio</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
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
                <FormLabel>Fecha de Fin</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
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
              <FormLabel>Límite de Usos (Opcional)</FormLabel>
              <FormControl><Input type="number" placeholder="Ej: 100 (0 para ilimitado)" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || undefined)} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL de Imagen (Opcional)</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <Input placeholder="https://ejemplo.com/imagen.png" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="aiHint"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Palabras Clave para Imagen (si URL está vacía)</FormLabel>
              <FormControl><Input placeholder="Ej: fiesta cocteles (máx 2 palabras)" {...field} /></FormControl>
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
                <FormLabel>Activar Promoción</FormLabel>
                <FormMessage />
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )}
        />
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90">{promotion ? "Guardar Cambios" : "Crear Promoción"}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

