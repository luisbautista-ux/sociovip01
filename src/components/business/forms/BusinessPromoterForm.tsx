
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
import type { BusinessPromoterFormData, BusinessPromoterLink, InitialDataForPromoterLink, QrClient, SocioVipMember, PlatformUser } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";

const promoterFormSchema = z.object({
  promoterDni: z.string(), 
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
  // Check if we are creating a new link based on an existing PlatformUser who is a promoter
  const isPrePopulatedFromPlatformUser = !!initialData?.existingPlatformUserPromoter;
  // Check if we are creating a new link based on an existing QrClient or SocioVipMember (but not a PlatformUser promoter)
  const isPrePopulatedFromOtherSource = !!(initialData && (initialData.qrClientData || initialData.socioVipData) && !isPrePopulatedFromPlatformUser);

  const form = useForm<PromoterFormValues>({
    resolver: zodResolver(promoterFormSchema),
    defaultValues: {
      promoterDni: promoterLinkToEdit?.promoterDni || initialData?.dni || "",
      promoterName: promoterLinkToEdit?.promoterName || initialData?.existingPlatformUserPromoter?.name || initialData?.qrClientData?.name || initialData?.socioVipData?.name || "",
      promoterEmail: promoterLinkToEdit?.promoterEmail || initialData?.existingPlatformUserPromoter?.email || initialData?.socioVipData?.email || "",
      promoterPhone: promoterLinkToEdit?.promoterPhone || initialData?.existingPlatformUserPromoter?.phone || initialData?.qrClientData?.phone || initialData?.socioVipData?.phone || "",
      commissionRate: promoterLinkToEdit?.commissionRate || "",
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
    } else if (initialData) {
        defaultVals.promoterDni = initialData.dni;
        const platformUser = initialData.existingPlatformUserPromoter;
        const qrClient = initialData.qrClientData;
        const socioVip = initialData.socioVipData;

        if (platformUser) {
            defaultVals.promoterName = platformUser.name || "";
            defaultVals.promoterEmail = platformUser.email || "";
            // PlatformUser type doesn't explicitly have 'phone', assuming it might be added or part of a more generic profile
            defaultVals.promoterPhone = (platformUser as any).phone || ""; 
        } else if (qrClient) {
            defaultVals.promoterName = `${qrClient.name || ''} ${qrClient.surname || ''}`.trim();
            defaultVals.promoterEmail = ""; // QrClient doesn't have email
            defaultVals.promoterPhone = qrClient.phone || "";
        } else if (socioVip) {
            defaultVals.promoterName = `${socioVip.name || ''} ${socioVip.surname || ''}`.trim();
            defaultVals.promoterEmail = socioVip.email || "";
            defaultVals.promoterPhone = socioVip.phone || "";
        }
    }
    form.reset(defaultVals);
  }, [promoterLinkToEdit, initialData, form, isEditingLink]);


  const handleSubmit = (values: PromoterFormValues) => {
    onSubmit({
        promoterName: values.promoterName,
        promoterEmail: values.promoterEmail,
        promoterPhone: values.promoterPhone,
        commissionRate: values.commissionRate,
    });
  };
  
  const disableContactFields = (isPrePopulatedFromPlatformUser && !isEditingLink) || (isEditingLink && !!promoterLinkToEdit?.isPlatformUser);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {disableContactFields && !isEditingLink && ( // Only show this alert when creating a new link for an existing Platform User
             <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">Vinculando Promotor de Plataforma Existente</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400">
                    Los datos de contacto (Nombre, Email, Teléfono) se toman del perfil global del promotor y no son editables aquí. Solo define la comisión para este vínculo con tu negocio.
                </AlertDescription>
            </Alert>
        )}
        {isPrePopulatedFromOtherSource && !isEditingLink && ( // If pre-populating from QrClient or SocioVip
             <Alert variant="default" className="bg-sky-50 border-sky-200 dark:bg-sky-900/30 dark:border-sky-700">
                <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <AlertTitle className="text-sky-700 dark:text-sky-300">DNI Encontrado como Cliente</AlertTitle>
                <AlertDescription className="text-sky-600 dark:text-sky-400">
                    Este DNI pertenece a un Cliente QR o Socio VIP. Algunos datos han sido pre-rellenados. Por favor, completa o confirma la información para vincularlo como promotor a tu negocio. Los datos de contacto editados aquí serán para este vínculo específico.
                </AlertDescription>
            </Alert>
        )}
         {isEditingLink && promoterLinkToEdit?.isPlatformUser && (
             <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">Editando Vínculo con Promotor de Plataforma</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400">
                    Los datos de contacto (Nombre, Email, Teléfono) pertenecen al perfil global del promotor y no son editables aquí. Solo puedes modificar la tasa de comisión.
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
              <FormControl><Input type="tel" placeholder="+51 987654321" {...field} disabled={isSubmitting || disableContactFields} className={(isSubmitting || disableContactFields) ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""} /></FormControl>
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
