
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

const promoterFormSchemaBase = z.object({
  promoterDni: z.string(), 
  promoterName: z.string().min(3, "Nombre del promotor es requerido."),
  promoterEmail: z.string().email("Email del promotor inválido."),
  promoterPhone: z.string()
    .regex(/^9\d{8}$/, "El celular debe empezar con 9 y tener 9 dígitos.")
    .optional()
    .or(z.literal('')),
  commissionRate: z.string().optional(),
});

const promoterFormSchemaCreate = promoterFormSchemaBase.extend({
  password: z.string().optional(),
});

type PromoterFormValues = z.infer<typeof promoterFormSchemaCreate>;

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
  const isPrePopulatedFromOtherSource = !!(initialData && (initialData.qrClientData || initialData.socioVipData) && !isPrePopulatedFromPlatformUser);
  const needsPassword = !isEditingLink && !isPrePopulatedFromPlatformUser;

  const form = useForm<PromoterFormValues>({
    resolver: zodResolver(
      needsPassword
        ? promoterFormSchemaCreate.extend({
            password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
          })
        : promoterFormSchemaCreate
    ),
    defaultValues: {
      promoterDni: "",
      promoterName: "",
      promoterEmail: "",
      promoterPhone: "",
      commissionRate: "",
      password: "",
    },
  });

  useEffect(() => {
    let defaultVals: PromoterFormValues = {
        promoterDni: initialData?.dni || promoterLinkToEdit?.promoterDni || "",
        promoterName: "",
        promoterEmail: "",
        promoterPhone: "",
        commissionRate: promoterLinkToEdit?.commissionRate || "",
        password: initialData?.dni || "",
    };

    if (isEditingLink && promoterLinkToEdit) {
        defaultVals.promoterName = promoterLinkToEdit.promoterName || "";
        defaultVals.promoterEmail = promoterLinkToEdit.promoterEmail || "";
        defaultVals.promoterPhone = promoterLinkToEdit.promoterPhone || "";
    } else if (initialData) {
        const platformUser = initialData.existingPlatformUserPromoter;
        const qrClient = initialData.qrClientData;
        const socioVip = initialData.socioVipData;
        
        if (platformUser) {
            defaultVals.promoterName = platformUser.name || "";
            defaultVals.promoterEmail = platformUser.email || "";
            defaultVals.promoterPhone = (platformUser as any).phone || ""; 
        } else {
             const name = qrClient ? `${qrClient.name || ''} ${qrClient.surname || ''}`.trim() : (socioVip ? `${socioVip.name || ''} ${socioVip.surname || ''}`.trim() : "");
             defaultVals.promoterName = name;
             defaultVals.promoterEmail = socioVip?.email || "";
             defaultVals.promoterPhone = qrClient?.phone || socioVip?.phone || "";
        }
    }
    form.reset(defaultVals);
  }, [promoterLinkToEdit, initialData, form, isEditingLink]);


  const handleSubmit = (values: PromoterFormValues) => {
    onSubmit(values);
  };
  
  const disableContactFields = isPrePopulatedFromPlatformUser;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {isPrePopulatedFromPlatformUser && !isEditingLink && (
             <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">Vinculando Promotor Existente</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400">
                    Este promotor ya tiene una cuenta en la plataforma. Sus datos están pre-rellenados. Solo define la comisión para este vínculo.
                </AlertDescription>
            </Alert>
        )}
        {isPrePopulatedFromOtherSource && !isEditingLink && (
             <Alert variant="default" className="bg-sky-50 border-sky-200 dark:bg-sky-900/30 dark:border-sky-700">
                <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <AlertTitle className="text-sky-700 dark:text-sky-300">Creando Cuenta de Promotor</AlertTitle>
                <AlertDescription className="text-sky-600 dark:text-sky-400">
                    Se creará una nueva cuenta de acceso para este promotor. Por favor, completa o confirma sus datos.
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
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="promoterName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Promotor <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Ej: Juan Pérez" {...field} disabled={isSubmitting || disableContactFields} className={(isSubmitting || disableContactFields) ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""} /></FormControl>
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
              <FormControl><Input type="email" placeholder="Ej: juan.promotor@example.com" {...field} disabled={isSubmitting || disableContactFields} className={(isSubmitting || disableContactFields) ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""} /></FormControl>
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
              <FormControl>
                <Input 
                  type="tel" 
                  placeholder="987654321" 
                  {...field} 
                  maxLength={9}
                  onChange={(e) => {
                    const numericValue = e.target.value.replace(/[^0-9]/g, '');
                    field.onChange(numericValue);
                  }}
                  disabled={isSubmitting || disableContactFields} 
                  className={(isSubmitting || disableContactFields) ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {needsPassword && (
           <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña Inicial para el Promotor <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="text" placeholder="Mínimo 6 caracteres" {...field} disabled={isSubmitting} /></FormControl>
                  <FormDescription className="text-xs">Por defecto, es el DNI del promotor. Puedes cambiarla.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
        )}

        <FormField
          control={form.control}
          name="commissionRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tasa de Comisión para este Negocio (Ej: 10% o S/5 por código)</FormLabel>
              <FormControl><Input placeholder="Definir comisión para este negocio" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl>
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
            {isEditingLink ? "Guardar Cambios" : "Crear y Vincular Promotor"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
