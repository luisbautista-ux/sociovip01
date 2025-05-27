
"use client";

import React from "react";
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
import type { BusinessPromoterFormData, BusinessPromoterLink, PromoterProfile } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const promoterFormSchema = z.object({
  promoterName: z.string().min(3, "Nombre del promotor es requerido."),
  promoterEmail: z.string().email("Email del promotor inválido."),
  promoterPhone: z.string().optional(),
  commissionRate: z.string().optional(),
});

type PromoterFormValues = z.infer<typeof promoterFormSchema>;

interface BusinessPromoterFormProps {
  promoterLink?: BusinessPromoterLink & { promoterProfile?: PromoterProfile }; 
  onSubmit: (data: BusinessPromoterFormData) => void;
  onCancel: () => void;
  isEditing?: boolean; 
  isSubmitting?: boolean;
}

export function BusinessPromoterForm({ promoterLink, onSubmit, onCancel, isEditing, isSubmitting = false }: BusinessPromoterFormProps) {
  const form = useForm<PromoterFormValues>({
    resolver: zodResolver(promoterFormSchema),
    defaultValues: {
      promoterName: promoterLink?.promoterProfile?.name || "",
      promoterEmail: promoterLink?.promoterProfile?.email || "",
      promoterPhone: promoterLink?.promoterProfile?.phone || "",
      commissionRate: promoterLink?.commissionRate || "",
    },
  });

  React.useEffect(() => {
    form.reset({
      promoterName: promoterLink?.promoterProfile?.name || "",
      promoterEmail: promoterLink?.promoterProfile?.email || "",
      promoterPhone: promoterLink?.promoterProfile?.phone || "",
      commissionRate: promoterLink?.commissionRate || "",
    });
  }, [promoterLink, form]);


  const handleSubmit = (values: PromoterFormValues) => {
    onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="promoterName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Promotor <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Ej: Juan Pérez" {...field} disabled={isEditing || isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="promoterEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email del Promotor <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input type="email" placeholder="Ej: juan.promotor@example.com" {...field} disabled={isEditing || isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="promoterPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono del Promotor (Opcional)</FormLabel>
              <FormControl><Input type="tel" placeholder="+51 987654321" {...field} disabled={isEditing || isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="commissionRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tasa de Comisión (Ej: 10% o S/5 por código)</FormLabel>
              <FormControl><Input placeholder="Definir comisión para este negocio" {...field} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {promoterLink ? "Guardar Cambios" : "Añadir Promotor"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
