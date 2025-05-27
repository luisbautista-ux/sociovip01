
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { PlatformUser, PlatformUserFormData, Business, PlatformUserRole, InitialDataForPlatformUserCreation } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { ALL_PLATFORM_USER_ROLES, PLATFORM_USER_ROLE_TRANSLATIONS, ROLES_REQUIRING_BUSINESS_ID } from "@/lib/constants";


const platformUserFormSchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  roles: z.array(z.enum(ALL_PLATFORM_USER_ROLES)).min(1, { message: "Debes seleccionar al menos un rol."}),
  businessId: z.string().optional(),
}).refine(data => {
  const requiresBusinessId = data.roles.some(role => ROLES_REQUIRING_BUSINESS_ID.includes(role));
  if (requiresBusinessId) {
    return !!data.businessId && data.businessId.length > 0; 
  }
  return true; 
}, {
  message: "Debes seleccionar un negocio para los roles que lo requieren (Admin Negocio, Staff, Anfitrión).",
  path: ["businessId"], 
});

type PlatformUserFormValues = z.infer<typeof platformUserFormSchema>;

interface PlatformUserFormProps {
  user?: PlatformUser; 
  initialDataForCreation?: InitialDataForPlatformUserCreation;
  businesses: Business[];
  onSubmit: (data: PlatformUserFormData, isEditingOperation: boolean) => Promise<void>; 
  onCancel: () => void;
  isSubmitting?: boolean;
  disableSubmitOverride?: boolean; // New prop to disable submit from parent
}

export function PlatformUserForm({ 
  user, 
  initialDataForCreation, 
  businesses, 
  onSubmit, 
  onCancel, 
  isSubmitting = false,
  disableSubmitOverride = false,
}: PlatformUserFormProps) {
  
  const isEditing = !!user;

  const form = useForm<PlatformUserFormValues>({
    resolver: zodResolver(platformUserFormSchema),
    // Default values are set in useEffect to handle dynamic props
  });

  const watchedRoles = form.watch("roles", user?.roles || initialDataForCreation?.existingPlatformUserRoles || []);
  
  const showBusinessIdField = React.useMemo(() => {
    return watchedRoles.some(role => ROLES_REQUIRING_BUSINESS_ID.includes(role));
  }, [watchedRoles]);

  React.useEffect(() => {
    if (isEditing && user) {
      form.reset({
        dni: user.dni || "",
        name: user.name || "",
        email: user.email || "",
        roles: user.roles || [],
        businessId: user.businessId || undefined,
      });
    } else if (!isEditing && initialDataForCreation) {
      form.reset({
        dni: initialDataForCreation.dni,
        name: initialDataForCreation.name || "",
        email: initialDataForCreation.email || "",
        roles: initialDataForCreation.existingPlatformUserRoles || [], // Pre-fill roles if editing existing platform user
        businessId: initialDataForCreation.existingPlatformUser?.businessId || undefined,
      });
    } else if (!isEditing && !initialDataForCreation) { // Truly new, no DNI verification yet (or DNI was new)
        form.reset({ dni: "", name: "", email: "", roles: [], businessId: undefined });
    }
  }, [user, initialDataForCreation, isEditing, form]);

  // Effect to clear businessId if roles no longer require it
  React.useEffect(() => {
    if (!showBusinessIdField && form.getValues('businessId')) {
      form.setValue('businessId', undefined, { shouldValidate: true });
    }
  }, [showBusinessIdField, form]);

  const handleSubmit = async (values: PlatformUserFormValues) => {
    const dataToSubmit: PlatformUserFormData = { 
      dni: values.dni.trim(),
      name: values.name,
      email: values.email,
      roles: values.roles,
      businessId: showBusinessIdField ? values.businessId : undefined,
    };
    await onSubmit(dataToSubmit, isEditing);
  };

  // DNI field is disabled if:
  // 1. We are editing an existing user (user prop is present).
  // 2. We are in a creation flow AFTER DNI verification (initialDataForCreation prop is present).
  const shouldDisableDni = isEditing || (!isEditing && !!initialDataForCreation?.dni);
  
  const showPrePopulatedAlert = !isEditing && initialDataForCreation?.existingUserIsOtherType && !initialDataForCreation?.existingUserIsPlatformUser;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-3">
        {showPrePopulatedAlert && (
          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700">DNI Encontrado como {initialDataForCreation?.existingUserType}</AlertTitle>
            <AlertDescription>
              Este DNI pertenece a un {initialDataForCreation?.existingUserType === 'QrClient' ? 'Cliente QR' : 'Socio VIP'} existente.
              Se han pre-rellenado los datos conocidos. Por favor, complete y asigne roles de plataforma.
            </AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="dni"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DNI / Carnet de Extranjería</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Número de documento" 
                  {...field} 
                  disabled={isSubmitting || shouldDisableDni} 
                />
              </FormControl>
              {shouldDisableDni && !isEditing && <FormDescription className="text-xs">El DNI ha sido verificado y no puede cambiarse en este paso.</FormDescription>}
              {isEditing && <FormDescription className="text-xs">El DNI no puede ser modificado para usuarios existentes.</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre Completo</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Juan Pérez" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (para inicio de sesión)</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Ej: juan.perez@ejemplo.com" {...field} disabled={isSubmitting || (isEditing && !!user?.email)} />
              </FormControl>
              {isEditing && !!user?.email && <FormDescription className="text-xs">El email no se puede cambiar para usuarios existentes con un email ya asignado.</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormItem>
          <FormLabel>Roles de Plataforma</FormLabel>
          <div className="space-y-2">
            {ALL_PLATFORM_USER_ROLES.map((roleValue) => (
              <FormField
                key={roleValue}
                control={form.control}
                name="roles"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(roleValue)}
                        onCheckedChange={(checked) => {
                          const currentRoles = field.value || [];
                          const newRoles = checked
                            ? [...currentRoles, roleValue]
                            : currentRoles.filter((value) => value !== roleValue);
                          field.onChange(newRoles);
                        }}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormLabel className="font-normal text-sm">
                      {PLATFORM_USER_ROLE_TRANSLATIONS[roleValue]}
                    </FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
          <FormDescription className="text-xs">
            La gestión detallada de permisos por rol múltiple se definirá en el backend.
          </FormDescription>
          <FormMessage>{form.formState.errors.roles?.message}</FormMessage>
        </FormItem>

        {showBusinessIdField && (
          <FormField
            control={form.control}
            name="businessId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Negocio Asociado</FormLabel>
                <Select 
                    onValueChange={field.onChange} 
                    value={field.value || ""} 
                    disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un negocio" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {businesses.length === 0 ? (
                         <FormItem><FormLabel className="p-2 text-sm text-muted-foreground">No hay negocios disponibles.</FormLabel></FormItem>
                    ) : (
                        businesses.map(biz => (
                            <SelectItem key={biz.id} value={biz.id}>{biz.name}</SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting || disableSubmitOverride}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar Cambios" : "Crear Perfil de Usuario"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
