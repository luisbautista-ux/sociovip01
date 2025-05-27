
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

const ALL_ROLES: PlatformUserRole[] = ['superadmin', 'business_admin', 'staff', 'promoter', 'host'];
const ROLE_TRANSLATIONS: Record<PlatformUserRole, string> = {
  superadmin: "Super Admin",
  business_admin: "Admin Negocio",
  staff: "Staff Negocio",
  promoter: "Promotor",
  host: "Anfitrión",
};
const ROLES_REQUIRING_BUSINESS_ID: PlatformUserRole[] = ['business_admin', 'staff', 'host'];

const platformUserFormSchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  roles: z.array(z.enum(ALL_ROLES)).min(1, { message: "Debes seleccionar al menos un rol."}),
  businessId: z.string().optional(),
}).refine(data => {
  const requiresBusinessId = data.roles.some(role => ROLES_REQUIRING_BUSINESS_ID.includes(role));
  if (requiresBusinessId) {
    return !!data.businessId && data.businessId.length > 0; 
  }
  return true; 
}, {
  message: "Debes seleccionar un negocio para los roles que lo requieren (Admin Negocio, Staff, Anfitrión).",
  path: ["businessId"], // Apply error to businessId field
});

type PlatformUserFormValues = z.infer<typeof platformUserFormSchema>;

interface PlatformUserFormProps {
  user?: PlatformUser; 
  initialDataForCreation?: InitialDataForPlatformUserCreation;
  businesses: Business[];
  onSubmit: (data: PlatformUserFormData) => Promise<void>; 
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function PlatformUserForm({ 
  user, 
  initialDataForCreation, 
  businesses, 
  onSubmit, 
  onCancel, 
  isSubmitting = false 
}: PlatformUserFormProps) {
  
  const isEditing = !!user;

  const form = useForm<PlatformUserFormValues>({
    resolver: zodResolver(platformUserFormSchema),
    defaultValues: {
      dni: user?.dni || initialDataForCreation?.dni || "",
      name: user?.name || initialDataForCreation?.name || "",
      email: user?.email || initialDataForCreation?.email || "",
      roles: user?.roles || [],
      businessId: user?.businessId || undefined,
    },
  });

  const watchedRoles = form.watch("roles", user?.roles || []);
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
        roles: [], 
        businessId: undefined,
      });
    } else if (!isEditing && !initialDataForCreation) {
        form.reset({ dni: "", name: "", email: "", roles: [], businessId: undefined });
    }
  }, [user, initialDataForCreation, isEditing, form]);

  React.useEffect(() => {
    if (!showBusinessIdField) {
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
    await onSubmit(dataToSubmit);
  };

  const shouldDisableDni = (!isEditing && !!initialDataForCreation?.dni) || (isEditing && !!user?.dni);
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
            {ALL_ROLES.map((roleValue) => (
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
                          return checked
                            ? field.onChange([...(field.value || []), roleValue])
                            : field.onChange(
                                (field.value || []).filter(
                                  (value) => value !== roleValue
                                )
                              )
                        }}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormLabel className="font-normal text-sm">
                      {ROLE_TRANSLATIONS[roleValue]}
                    </FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
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
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar Cambios" : "Crear Perfil de Usuario"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
