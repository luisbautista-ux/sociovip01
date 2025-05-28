
"use client";

import React, { useEffect } from "react";
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
import type { BusinessPromoterFormData, BusinessPromoterLink, InitialDataForPromoterLink } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";

const promoterFormSchema = z.object({
  promoterDni: z.string(), // No se valida aquí, ya viene verificado
  promoterName: z.string().min(3, "Nombre del promotor es requerido."),
  promoterEmail: z.string().email("Email del promotor inválido."),
  promoterPhone: z.string().optional(),
  commissionRate: z.string().optional(),
});

type PromoterFormValues = z.infer<typeof promoterFormSchema>;

interface BusinessPromoterFormProps {
  promoterLinkToEdit?: BusinessPromoterLink; 
  initialData?: InitialDataForPromoterLink;
  onSubmit: (data: BusinessPromoterFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BusinessPromoterForm({ 
    promoterLinkToEdit, 
    initialData, 
    onSubmit, 
    onCancel, 
    isSubmitting = false 
}: BusinessPromoterFormProps) {
  
  const isEditingLink = !!promoterLinkToEdit;
  const isPrePopulatedFromPlatformUser = !!initialData?.existingPlatformUserPromoter;
  const isPrePopulatedFromOtherSource = !!(initialData?.qrClientData || initialData?.socioVipData) && !isPrePopulatedFromPlatformUser;

  const form = useForm<PromoterFormValues>({
    resolver: zodResolver(promoterFormSchema),
    defaultValues: {
      promoterDni: "", // Se llenará en useEffect
      promoterName: "",
      promoterEmail: "",
      promoterPhone: "",
      commissionRate: "",
    },
  });

  useEffect(() => {
    let defaultVals: PromoterFormValues = {
        promoterDni: initialData?.dni || promoterLinkToEdit?.promoterDni || "",
        promoterName: "",
        promoterEmail: "",
        promoterPhone: "",
        commissionRate: promoterLinkToEdit?.commissionRate || "",
    };

    if (isEditingLink && promoterLinkToEdit) {
        defaultVals.promoterName = promoterLinkToEdit.promoterName || "";
        defaultVals.promoterEmail = promoterLinkToEdit.promoterEmail || "";
        defaultVals.promoterPhone = promoterLinkToEdit.promoterPhone || "";
        // DNI y commissionRate ya están seteados
    } else if (initialData) {
        defaultVals.promoterDni = initialData.dni;
        if (initialData.existingPlatformUserPromoter) {
            defaultVals.promoterName = initialData.existingPlatformUserPromoter.name || "";
            defaultVals.promoterEmail = initialData.existingPlatformUserPromoter.email || "";
            defaultVals.promoterPhone = ""; // PlatformUser no tiene phone directamente, se podría añadir
        } else if (initialData.qrClientData) {
            defaultVals.promoterName = `${initialData.qrClientData.name || ''} ${initialData.qrClientData.surname || ''}`.trim();
            defaultVals.promoterPhone = initialData.qrClientData.phone || "";
            // QrClient no tiene email
        } else if (initialData.socioVipData) {
            defaultVals.promoterName = `${initialData.socioVipData.name || ''} ${initialData.socioVipData.surname || ''}`.trim();
            defaultVals.promoterEmail = initialData.socioVipData.email || "";
            defaultVals.promoterPhone = initialData.socioVipData.phone || "";
        }
    }
    form.reset(defaultVals);
  }, [promoterLinkToEdit, initialData, form, isEditingLink]);


  const handleSubmit = (values: PromoterFormValues) => {
    onSubmit({
        // DNI no se envía desde el form, se toma del estado `verifiedPromoterDniResult.dni` en la página padre
        promoterName: values.promoterName,
        promoterEmail: values.promoterEmail,
        promoterPhone: values.promoterPhone,
        commissionRate: values.commissionRate,
    });
  };
  
  // Los campos de Nombre, Email, Teléfono se deshabilitan si se está vinculando un PlatformUser existente
  const disableContactFields = isPrePopulatedFromPlatformUser && !isEditingLink;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {isPrePopulatedFromPlatformUser && !isEditingLink && (
             <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">Vinculando Promotor Existente de Plataforma</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400">
                    Los datos de contacto (Nombre, Email) se toman del perfil global del promotor y no son editables aquí. Solo define la comisión para este negocio.
                </AlertDescription>
            </Alert>
        )}
        {isPrePopulatedFromOtherSource && !isEditingLink && (
             <Alert variant="default" className="bg-sky-50 border-sky-200 dark:bg-sky-900/30 dark:border-sky-700">
                <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <AlertTitle className="text-sky-700 dark:text-sky-300">DNI Encontrado como Cliente</AlertTitle>
                <AlertDescription className="text-sky-600 dark:text-sky-400">
                    Este DNI pertenece a un Cliente QR o Socio VIP. Algunos datos han sido pre-rellenados. Por favor, completa/confirma la información para vincularlo como promotor a tu negocio.
                </AlertDescription>
            </Alert>
        )}

        <FormField
          control={form.control}
          name="promoterDni"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Verificado en paso anterior" {...field} disabled={true} className="disabled:bg-muted/50 disabled:text-muted-foreground/80" /></FormControl>
              <FormDescription className="text-xs">El DNI/CE ha sido verificado y no se puede cambiar aquí.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="promoterName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Promotor <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Ej: Juan Pérez" {...field} disabled={isSubmitting || disableContactFields} className={disableContactFields ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""} /></FormControl>
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
              <FormControl><Input type="email" placeholder="Ej: juan.promotor@example.com" {...field} disabled={isSubmitting || disableContactFields} className={disableContactFields ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""} /></FormControl>
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
              <FormControl><Input type="tel" placeholder="+51 987654321" {...field} disabled={isSubmitting || disableContactFields} className={disableContactFields ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="commissionRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tasa de Comisión para este Negocio (Ej: 10% o S/5 por código)</FormLabel>
              <FormControl><Input placeholder="Definir comisión para este negocio" {...field} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {promoterLinkToEdit ? "Guardar Cambios de Vínculo" : "Vincular Promotor"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

    