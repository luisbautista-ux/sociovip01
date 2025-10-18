
"use client";

import React, { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EventBox, EventBoxFormData } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";


const eventBoxFormSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo."),
  description: z.string().optional(),
  status: z.enum(['available', 'reserved', 'sold'], { required_error: "Debes seleccionar un estado."}),
  capacity: z.coerce.number().int().min(1, "La capacidad debe ser al menos 1.").optional().or(z.literal(undefined)),
  promoterName: z.string().optional(),
  ownerName: z.string().optional(),
  ownerDni: z.string().optional(),
  ownerPhone: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.status === 'reserved' || data.status === 'sold') {
        if (!data.ownerName || data.ownerName.length < 3) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El nombre del dueño es obligatorio (mín. 3 caracteres).",
                path: ["ownerName"],
            });
        }
        if (!data.ownerDni || !/^\d{8,20}$/.test(data.ownerDni)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El DNI/CE es obligatorio y debe tener entre 8 y 20 dígitos numéricos.",
                path: ["ownerDni"],
            });
        }
        if (!data.ownerPhone || !/^9\d{8}$/.test(data.ownerPhone)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El celular es obligatorio (9 dígitos empezando con 9).",
                path: ["ownerPhone"],
            });
        }
    }
});


type EventBoxFormValues = z.infer<typeof eventBoxFormSchema>;

interface EventBoxFormProps {
  eventBox?: EventBox;
  onSubmit: (data: EventBoxFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function EventBoxForm({ eventBox, onSubmit, onCancel, isSubmitting = false }: EventBoxFormProps) {
  const { userProfile, currentUser } = useAuth();
  const { toast } = useToast();
  const [isDniLoading, setIsDniLoading] = useState(false);
  const [docType, setDocType] = useState<'dni' | 'ce'>('dni');

  const form = useForm<EventBoxFormValues>({
    resolver: zodResolver(eventBoxFormSchema),
    defaultValues: {
      name: eventBox?.name ?? "",
      cost: eventBox?.cost ?? 0,
      description: eventBox?.description ?? "",
      status: eventBox?.status ?? 'available',
      capacity: eventBox?.capacity ?? undefined,
      promoterName: eventBox?.promoterName ?? "",
      ownerName: eventBox?.ownerName ?? "",
      ownerDni: eventBox?.ownerDni ?? "",
      ownerPhone: eventBox?.ownerPhone ?? "",
    },
    mode: "onChange",
  });

  const watchedStatus = form.watch("status");

  useEffect(() => {
    // Si el modal se abre para editar un box disponible Y el campo de vendedor está vacío, se autocompleta con el admin actual.
    if (eventBox?.status === 'available' && !eventBox.promoterName && userProfile?.name) {
      form.setValue('promoterName', userProfile.name, { shouldValidate: true });
    }
    
    // Si el estado cambia a 'disponible', limpiar los campos del dueño
    if (watchedStatus === 'available') {
      if (form.getValues('ownerName') || form.getValues('ownerDni') || form.getValues('ownerPhone')) {
          form.setValue('ownerName', "");
          form.setValue('ownerDni', "");
          form.setValue('ownerPhone', "");
      }
    } else { // Si cambia a 'reservado' o 'vendido'
       // Si el campo de vendedor está vacío, se autocompleta con el admin actual
       if (!form.getValues('promoterName') && userProfile?.name) {
           form.setValue('promoterName', userProfile.name);
       }
    }
  }, [watchedStatus, eventBox, userProfile, form]);
  
  const handleVerifyDni = async () => {
    const ownerDni = form.getValues('ownerDni');
    if (!ownerDni || !currentUser) return;
    
    setIsDniLoading(true);
    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`/api/promoter/get-client-name?dni=${ownerDni}&docType=${docType}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error del servidor (${response.status})`);
        }
        
        const data = await response.json();
        
        if (data.name) {
            form.setValue('ownerName', data.name);
            if (data.phone) {
                 form.setValue('ownerPhone', data.phone);
            }
            toast({ title: "Cliente Encontrado", description: `Se autocompletaron los datos para ${data.name}.` });
        } else {
            toast({ title: "No Encontrado", description: "No se encontró un cliente con ese DNI. Por favor, ingrese los datos manualmente.", variant: "default"});
        }
    } catch (error: any) {
        toast({ title: "Error de Búsqueda", description: `No se pudo verificar el DNI. ${error.message}`, variant: "destructive"});
    } finally {
        setIsDniLoading(false);
    }
  };

  const handleSubmit = (values: EventBoxFormValues) => {
    if (values.status === 'available' && (values.ownerName || values.ownerDni || values.ownerPhone)) {
        toast({
            title: "Acción Requerida",
            description: "Para guardar los datos del dueño, por favor cambia el estado a 'Reservado' o 'Vendido'.",
            variant: "destructive",
            duration: 7000
        });
        return; 
    }

    let finalValues = { ...values };
    if (values.status === 'available') {
        finalValues = {
            ...values,
            promoterName: "",
            ownerName: "",
            ownerDni: "",
            ownerPhone: "",
        };
    }
    onSubmit(finalValues);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-3 py-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Box <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Ej: Box A1 (Escenario), Mesa VIP 5" {...field} value={field.value ?? ""} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Costo (S/) <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="number" placeholder="500.00" {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                  <FormLabel>Capacidad (Personas)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="8" 
                      {...field} 
                      value={field.value ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        const numVal = parseInt(val, 10);
                        field.onChange(val === "" ? undefined : (isNaN(numVal) ? undefined : numVal));
                      }} 
                      disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción </FormLabel>
              <FormControl><Textarea placeholder="Detalles del box, ej: Incluye 2 botellas y piqueos." {...field} value={field.value ?? ""} rows={2} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="space-y-2 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">Detalles de Asignación</h4>
        </div>
        
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estado <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="available">Disponible</SelectItem>
                  <SelectItem value="reserved">Reservado</SelectItem>
                  <SelectItem value="sold">Vendido</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="promoterName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendedor Asignado </FormLabel>
                <FormControl><Input placeholder="Nombre del promotor/vendedor" {...field} value={field.value ?? ""} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="space-y-1 mt-4">
              <FormLabel>DNI/CE Dueño del Box</FormLabel>
              <div className="flex gap-2 items-start">
                  <div className="flex-grow">
                      <FormField control={form.control} name="ownerDni" render={({ field }) => (
                          <FormItem>
                              <FormControl><Input placeholder="DNI/CE del cliente dueño" {...field} value={field.value ?? ""} disabled={isSubmitting || isDniLoading} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )}/>
                  </div>
                   <Button type="button" size="icon" variant="outline" onClick={handleVerifyDni} disabled={isSubmitting || isDniLoading || !form.getValues('ownerDni')}>
                      {isDniLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}
                   </Button>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <FormField
              control={form.control}
              name="ownerName"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Nombre Dueño del Box </FormLabel>
                  <FormControl><Input placeholder="Nombre del cliente dueño" {...field} value={field.value ?? ""} disabled={isSubmitting} /></FormControl>
                  <FormMessage />
                  </FormItem>
              )}
              />
              <FormField
              control={form.control}
              name="ownerPhone"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Celular Dueño del Box </FormLabel>
                  <FormControl><Input type="tel" placeholder="987654321" {...field} value={field.value ?? ""} disabled={isSubmitting} maxLength={9}/></FormControl>
                  <FormMessage />
                  </FormItem>
              )}
              />
          </div>
        </div>

        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="gradient" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {eventBox ? "Guardar Cambios" : "Crear Box"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
