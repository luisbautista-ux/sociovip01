
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
import type { PlatformUser, PlatformUserFormData, Business, QrClient, SocioVipMember, PlatformUserRole } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";

// Schema now expects a single role from the form, which will be wrapped in an array on save for new users
const platformUserFormSchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  role: z.enum(['superadmin', 'business_admin', 'staff', 'promoter', 'host'], { required_error: "Debes seleccionar un rol."}),
  businessId: z.string().optional(),
}).refine(data => {
  if (['business_admin', 'staff', 'host'].includes(data.role)) {
    return !!data.businessId && data.businessId.length > 0; 
  }
  return true; 
}, {
  message: "Debes seleccionar un negocio para roles de 'Admin Negocio', 'Staff' o 'Anfitrión'.",
  path: ["businessId"],
});

type PlatformUserFormValues = z.infer<typeof platformUserFormSchema>;

export interface InitialDataForPlatformUserCreation {
  dni: string;
  name?: string; // From QrClient or SocioVipMember
  email?: string; // From SocioVipMember
  existingUserType?: 'QrClient' | 'SocioVipMember';
  existingUserIsOtherType?: boolean; // Flag if DNI was found as QrClient or SocioVipMember
  existingUserIsPlatformUser?: boolean; // Flag if DNI was found as PlatformUser
  existingPlatformUser?: PlatformUser; // Full PlatformUser data if DNI is already a PlatformUser
  existingPlatformUserRoles?: PlatformUserRole[];
}

interface PlatformUserFormProps {
  user?: PlatformUser; // For editing an existing PlatformUser
  initialDataForCreation?: InitialDataForPlatformUserCreation; // For creation after DNI verification
  businesses: Business[];
  onSubmit: (data: PlatformUserFormData) => Promise<void>; // isEditing flag removed, form determines via `user` prop
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
    // Default values will be set by useEffect
  });

  const selectedRole = form.watch("role");

  React.useEffect(() => {
    if (isEditing && user) {
      form.reset({
        dni: user.dni || "",
        name: user.name || "",
        email: user.email || "",
        role: user.roles?.[0] || undefined, // Use the first role for single select, or undefined
        businessId: user.businessId || undefined,
      });
    } else if (!isEditing && initialDataForCreation) {
      form.reset({
        dni: initialDataForCreation.dni, // DNI is pre-filled and disabled
        name: initialDataForCreation.name || "",
        email: initialDataForCreation.email || "",
        role: undefined, 
        businessId: undefined,
      });
    } else if (!isEditing && !initialDataForCreation) {
        // Should not happen if DNI-first flow is enforced, but good fallback
        form.reset({ dni: "", name: "", email: "", role: undefined, businessId: undefined });
    }
  }, [user, initialDataForCreation, isEditing, form]);


  const handleSubmit = async (values: PlatformUserFormValues) => {
    // The dataToSubmit structure matches PlatformUserFormData (single role from form)
    // The backend/Server Action will handle putting this into a roles array.
    const dataToSubmit: PlatformUserFormData = { 
      dni: values.dni.trim(),
      name: values.name,
      email: values.email,
      role: values.role, // Pass the single selected role
    };
    if (['business_admin', 'staff', 'host'].includes(values.role)) {
      dataToSubmit.businessId = values.businessId;
    } else {
      dataToSubmit.businessId = undefined; 
    }
    await onSubmit(dataToSubmit);
  };

  // DNI field is disabled if we are creating a new user (after DNI verification step) or editing an existing user
  const shouldDisableDni = (!isEditing && !!initialDataForCreation?.dni) || isEditing;
  const showPrePopulatedAlert = !isEditing && initialDataForCreation?.existingUserIsOtherType;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {showPrePopulatedAlert && (
          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700">DNI Encontrado como {initialDataForCreation?.existingUserType}</AlertTitle>
            <AlertDescription>
              Este DNI pertenece a un {initialDataForCreation?.existingUserType === 'QrClient' ? 'Cliente QR' : 'Socio VIP'} existente.
              Se han pre-rellenado los datos conocidos. Por favor, complete y asigne un rol de plataforma.
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
              {shouldDisableDni && <FormDescription className="text-xs">El DNI ha sido verificado y no puede cambiarse en este paso (o al editar).</FormDescription>}
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
              {isEditing && !!user?.email && <FormDescription className="text-xs">El email no se puede cambiar para usuarios existentes.</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rol Principal de Plataforma</FormLabel>
              <Select 
                onValueChange={(value) => {
                  field.onChange(value);
                  if (['superadmin', 'promoter'].includes(value)) {
                    form.setValue('businessId', undefined, { shouldValidate: true });
                  }
                }} 
                defaultValue={field.value} 
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                  <SelectItem value="business_admin">Admin Negocio</SelectItem>
                  <SelectItem value="staff">Staff Negocio</SelectItem>
                  <SelectItem value="promoter">Promotor</SelectItem>
                  <SelectItem value="host">Anfitrión</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription className="text-xs">La gestión de múltiples roles se habilitará en futuras actualizaciones.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {selectedRole && ['business_admin', 'staff', 'host'].includes(selectedRole) && (
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
