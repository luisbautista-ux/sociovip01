
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import type { BusinessPromoterLink, BusinessPromoterFormData, InitialDataForPromoterLink } from "@/lib/types";
import { PLATFORM_USER_ROLE_TRANSLATIONS } from "@/lib/constants";

const promoterFormSchemaBase = z.object({
  promoterDni: z.string(),
  promoterName: z.string().min(3, "Nombre del promotor es requerido."),
  promoterEmail: z.string().email("Email del promotor inválido."),
  promoterPhone: z.string().regex(/^9\d{8}$/, "El celular debe empezar con 9 y tener 9 dígitos.").optional().or(z.literal('')),
});

const promoterFormSchemaCreate = promoterFormSchemaBase.extend({
  password: z.string().optional(),
});

type PromoterFormValues = z.infer<typeof promoterFormSchemaCreate>;

interface PromoterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoterLinkToEdit?: BusinessPromoterLink | null;
  initialData?: InitialDataForPromoterLink | null;
  onSubmit: (data: BusinessPromoterFormData) => void;
  isSubmitting: boolean;
}

export function PromoterFormDialog({ open, onOpenChange, promoterLinkToEdit, initialData, onSubmit, isSubmitting }: PromoterFormDialogProps) {
  const isEditingLink = !!promoterLinkToEdit;
  const isPrePopulatedFromPlatformUser = !!initialData?.existingPlatformUserPromoter;
  const isPrePopulatedFromOtherSource = !!(initialData && (initialData.qrClientData || initialData.socioVipData) && !isPrePopulatedFromPlatformUser);
  const needsPassword = !isEditingLink && !isPrePopulatedFromPlatformUser;

  const form = useForm<PromoterFormValues>({
    resolver: zodResolver(
      needsPassword ? promoterFormSchemaCreate.extend({
        password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
      }) : promoterFormSchemaCreate
    ),
    defaultValues: {},
  });

  useEffect(() => {
    if (open) {
      form.reset({
        promoterDni: initialData?.dni || promoterLinkToEdit?.promoterDni || "",
        promoterName: promoterLinkToEdit?.promoterName || initialData?.existingPlatformUserPromoter?.name || `${initialData?.qrClientData?.name || initialData?.socioVipData?.name || ''} ${initialData?.qrClientData?.surname || initialData?.socioVipData?.surname || ''}`.trim() || "",
        promoterEmail: promoterLinkToEdit?.promoterEmail || initialData?.existingPlatformUserPromoter?.email || initialData?.socioVipData?.email || "",
        promoterPhone: promoterLinkToEdit?.promoterPhone || (initialData?.existingPlatformUserPromoter as any)?.phone || initialData?.qrClientData?.phone?.toString() || initialData?.socioVipData?.phone?.toString() || "",
        password: initialData?.dni || "",
      });
    }
  }, [open, promoterLinkToEdit, initialData, form]);

  const handleSubmit = (values: PromoterFormValues) => {
    const { password, ...rest } = values;
    const finalData: BusinessPromoterFormData = { ...rest, promoterDni: initialData?.dni || promoterLinkToEdit?.promoterDni || "" };
    if (needsPassword) {
      finalData.password = password;
    }
    onSubmit(finalData);
  };
  
  const disableContactFields = isPrePopulatedFromPlatformUser;
  
  let buttonText = "Crear y Vincular Promotor";
  if (isEditingLink) {
    buttonText = "Guardar Cambios";
  } else if (isPrePopulatedFromPlatformUser) {
    buttonText = "Vincular Promotor";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditingLink ? "Editar Vínculo con Promotor" : "Paso 2: Completar Datos"}</DialogTitle>
          <DialogDescription>
            {isEditingLink 
              ? `Actualiza la información para ${promoterLinkToEdit.promoterName}.`
              : (isPrePopulatedFromPlatformUser 
                  ? "Este DNI pertenece a un Promotor existente. Confirma para vincularlo."
                  : "Completa los datos para crear una cuenta para este nuevo promotor.")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {isPrePopulatedFromPlatformUser && !isEditingLink && (
                 <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-700 dark:text-blue-300">Vinculando Promotor Existente</AlertTitle>
                    <DialogDescription>Este promotor ya tiene una cuenta. Sus datos están pre-rellenados.</DialogDescription>
                </Alert>
            )}
            {isPrePopulatedFromOtherSource && !isEditingLink && (
                 <Alert variant="default" className="bg-sky-50 border-sky-200 dark:bg-sky-900/30 dark:border-sky-700">
                    <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    <AlertTitle className="text-sky-700 dark:text-sky-300">Creando Cuenta de Promotor</AlertTitle>
                    <DialogDescription>Se creará una nueva cuenta de acceso. Completa o confirma sus datos.</DialogDescription>
                </Alert>
            )}

            <FormField control={form.control} name="promoterDni" render={({ field }) => (
              <FormItem>
                <FormLabel>DNI / CE <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Verificado en paso anterior" {...field} disabled={true} /></FormControl>
              </FormItem>
            )}/>
            <FormField control={form.control} name="promoterName" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Ej: Juan Pérez" {...field} disabled={isSubmitting || disableContactFields} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="promoterEmail" render={({ field }) => (
              <FormItem>
                <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="email" placeholder="juan.p@example.com" {...field} disabled={isSubmitting || disableContactFields} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="promoterPhone" render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono (Opcional)</FormLabel>
                <FormControl><Input type="tel" placeholder="987654321" {...field} maxLength={9} onChange={(e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))} disabled={isSubmitting || disableContactFields} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            {needsPassword && (
               <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña Inicial <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="text" placeholder="Mínimo 6 caracteres" {...field} value={field.value || ''} disabled={isSubmitting} /></FormControl>
                  <FormDescription className="text-xs">Por defecto, es el DNI. Puedes cambiarla.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}/>
            )}
            
            <DialogFooter className="pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" variant="gradient" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {buttonText}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
