
"use client";

import * as React from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { PlatformUser, PlatformUserFormData, Business, PlatformUserRole, InitialDataForPlatformUserCreation } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { ALL_PLATFORM_USER_ROLES, PLATFORM_USER_ROLE_TRANSLATIONS, ROLES_REQUIRING_BUSINESS_ID } from "@/lib/constants";

const platformUserFormSchemaBase = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  roles: z.array(z.enum(ALL_PLATFORM_USER_ROLES)).min(1, { message: "Debes seleccionar al menos un rol."}),
  businessId: z.string().optional(),
});

// Schema for creation includes optional password
const platformUserFormSchemaCreate = platformUserFormSchemaBase.extend({
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.").optional(),
}).refine(data => {
  const rolesThatNeedBusiness = data.roles.filter(role => ROLES_REQUIRING_BUSINESS_ID.includes(role));
  if (rolesThatNeedBusiness.length > 0) {
    return !!data.businessId && data.businessId.length > 0; 
  }
  return true; 
}, {
  message: "Debes seleccionar un negocio para los roles que lo requieren (Admin Negocio, Staff, Anfitrión).",
  path: ["businessId"], 
});

// Schema for editing does not include password
const platformUserFormSchemaEdit = platformUserFormSchemaBase.refine(data => {
  const rolesThatNeedBusiness = data.roles.filter(role => ROLES_REQUIRING_BUSINESS_ID.includes(role));
  if (rolesThatNeedBusiness.length > 0) {
    return !!data.businessId && data.businessId.length > 0; 
  }
  return true; 
}, {
  message: "Debes seleccionar un negocio para los roles que lo requieren (Admin Negocio, Staff, Anfitrión).",
  path: ["businessId"], 
});

// Merged type for the form, password is optional
type PlatformUserFormValues = z.infer<typeof platformUserFormSchemaBase> & { password?: string };

interface PlatformUserFormProps {
  user?: PlatformUser; 
  initialDataForCreation?: InitialDataForPlatformUserCreation;
  businesses: Business[];
  onSubmit: (data: PlatformUserFormData, isEditing: boolean) => Promise<void>; 
  onCancel: () => void;
  isSubmitting?: boolean;
  disableSubmitOverride?: boolean; 
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
    resolver: zodResolver(isEditing ? platformUserFormSchemaEdit : platformUserFormSchemaCreate),
    defaultValues: {
      dni: initialDataForCreation?.dni || user?.dni || "",
      name: initialDataForCreation?.name || user?.name || "",
      email: initialDataForCreation?.email || user?.email || "",
      roles: initialDataForCreation?.existingPlatformUserRoles || user?.roles || [],
      businessId: user?.businessId || initialDataForCreation?.existingPlatformUser?.businessId || undefined,
      password: initialDataForCreation?.dni || "", // Default password to DNI
    },
  });

  const watchedRoles = form.watch("roles");
  
  const showBusinessIdField = React.useMemo(() => {
    if (!watchedRoles || watchedRoles.length === 0) return false;
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
        password: "", // No password field in edit mode
      });
    } else if (!isEditing && initialDataForCreation) {
      form.reset({
        dni: initialDataForCreation.dni,
        name: initialDataForCreation.name || "",
        email: initialDataForCreation.email || "",
        roles: initialDataForCreation.existingPlatformUserRoles || [],
        businessId: initialDataForCreation.existingPlatformUser?.businessId || undefined,
        password: initialDataForCreation.dni, // Default password to DNI
      });
    } else if (!isEditing && !initialDataForCreation) { // Caso de DNI completamente nuevo
        form.reset({ 
          dni: initialDataForCreation?.dni || "", // DNI ya verificado
          name: "", 
          email: "", 
          roles: [], 
          businessId: undefined,
          password: initialDataForCreation?.dni || "" // Default password to DNI
        });
    }
  }, [user, initialDataForCreation, isEditing, form]);

  React.useEffect(() => {
    // Limpiar businessId si los roles seleccionados no lo requieren
    if (!showBusinessIdField && form.getValues('businessId')) {
      form.setValue('businessId', undefined, { shouldValidate: true });
    }
  }, [showBusinessIdField, form]);

  const handleSubmit = async (values: PlatformUserFormValues) => {
    const dataToSubmit: PlatformUserFormData = { 
      uid: user?.uid, // Only present when editing
      dni: values.dni,
      name: values.name,
      email: values.email,
      roles: values.roles,
      businessId: showBusinessIdField ? values.businessId : undefined,
      password: values.password, // Only present when creating
    };
    await onSubmit(dataToSubmit, isEditing);
  };

  const shouldDisableDni = isEditing || (!isEditing && !!initialDataForCreation?.dni);
  const isPrePopulatedFromOtherSource = !isEditing && initialDataForCreation?.preExistingUserType && initialDataForCreation.preExistingUserType !== 'PlatformUser';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-3">
        {isPrePopulatedFromOtherSource && (
          <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-700 dark:text-blue-300">
              DNI Encontrado como {PLATFORM_USER_ROLE_TRANSLATIONS[initialDataForCreation?.preExistingUserType as PlatformUserRole] || initialDataForCreation?.preExistingUserType}
            </AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-400">
              Este DNI pertenece a un {initialDataForCreation?.preExistingUserType === 'QrClient' ? 'Cliente QR' : 'Socio VIP'} existente.
              Se han pre-rellenado los datos conocidos. Por favor, complete y asigne roles de plataforma.
            </AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="dni"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input 
                  placeholder="Ingrese el número de documento" 
                  {...field} 
                  maxLength={15}
                  disabled={isSubmitting || shouldDisableDni} 
                  className={ (isSubmitting || shouldDisableDni) ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""}
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
              <FormLabel>Nombre Completo <span className="text-destructive">*</span></FormLabel>
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
              <FormLabel>Email (para inicio de sesión) <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input type="email" placeholder="Ej: juan.perez@ejemplo.com" {...field} disabled={isSubmitting || (isEditing && !!user?.email)} 
                 className={ (isSubmitting || (isEditing && !!user?.email)) ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""}
                />
              </FormControl>
              {isEditing && !!user?.email && <FormDescription className="text-xs">El email no se puede cambiar para usuarios existentes con un email ya asignado.</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />

        {!isEditing && (
            <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Contraseña Inicial</FormLabel>
                <FormControl>
                    <Input
                    type="text" // text para que el admin pueda verla
                    placeholder="Contraseña para el nuevo usuario"
                    {...field}
                    disabled={isSubmitting}
                    />
                </FormControl>
                <FormDescription className="text-xs">
                  Por defecto, es el DNI. Si se deja en blanco, el usuario deberá iniciar sesión usando Google.
                </FormDescription>
                <FormMessage />
                </FormItem>
            )}
            />
        )}
        
        <FormItem>
          <FormLabel>Roles de Plataforma <span className="text-destructive">*</span></FormLabel>
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
                          let newRoles: PlatformUserRole[];
                          if (checked) {
                            newRoles = [...currentRoles, roleValue];
                          } else {
                            newRoles = currentRoles.filter((value) => value !== roleValue);
                          }
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
            Selecciona uno o más roles para el usuario.
          </FormDescription>
          <FormMessage />
        </FormItem>

        {showBusinessIdField && (
          <FormField
            control={form.control}
            name="businessId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Negocio Asociado <span className="text-destructive">*</span></FormLabel>
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
          <Button type="submit" variant="gradient" disabled={isSubmitting || disableSubmitOverride}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar Cambios" : "Crear Usuario"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
