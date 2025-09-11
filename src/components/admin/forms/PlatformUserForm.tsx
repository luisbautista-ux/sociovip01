
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import React, { useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import type { PlatformUser, PlatformUserFormData, Business, PlatformUserRole, InitialDataForPlatformUserCreation } from "@/lib/types";
import { PLATFORM_USER_ROLE_TRANSLATIONS, ALL_PLATFORM_USER_ROLES, ROLES_REQUIRING_BUSINESS_ID } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";


const platformUserFormSchema = z.object({
  uid: z.string().optional(),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  dni: z.string().min(7, "El DNI/CE debe tener entre 7 y 15 caracteres.").max(15),
  email: z.string().email("Debe ser un email válido."),
  password: z.string().optional(),
  roles: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "Debes seleccionar al menos un rol.",
  }),
  businessId: z.string().optional().nullable(),
  businessIds: z.array(z.string()).optional().nullable(),
});

type PlatformUserFormValues = z.infer<typeof platformUserFormSchema>;

interface PlatformUserFormProps {
  user?: PlatformUser;
  initialDataForCreation?: InitialDataForPlatformUserCreation;
  businesses: Business[];
  onSubmit: (data: PlatformUserFormData, isEditing: boolean) => void;
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
  const { userProfile: currentUserProfile } = useAuth();
  const isSuperAdminView = currentUserProfile?.roles.includes('superadmin') || false;

  const isEditing = !!user;
  const needsPassword = !isEditing;
  
  const form = useForm<PlatformUserFormValues>({
    resolver: zodResolver(
      platformUserFormSchema.refine((data) => {
        if (needsPassword && (!data.password || data.password.length < 6)) {
          return false;
        }
        return true;
      }, {
        message: "La contraseña es requerida y debe tener al menos 6 caracteres.",
        path: ["password"],
      }).refine((data) => {
        const hasRoleRequiringBusiness = data.roles.some(role => ROLES_REQUIRING_BUSINESS_ID.includes(role as PlatformUserRole));
        if (hasRoleRequiringBusiness && !data.businessId) {
            return false;
        }
        return true;
      }, {
        message: "Se requiere un ID de negocio para los roles seleccionados.",
        path: ["businessId"],
      })
    ),
    defaultValues: {
      uid: user?.uid || undefined,
      name: user?.name || initialDataForCreation?.name || "",
      dni: user?.dni || initialDataForCreation?.dni || "",
      email: user?.email || initialDataForCreation?.email || "",
      password: "",
      roles: user?.roles || [],
      businessId: user?.businessId || null,
      businessIds: user?.businessIds || [],
    },
  });

  const selectedRoles = form.watch("roles", user?.roles || []);
  const showBusinessIdSelector = isSuperAdminView && selectedRoles.some(role => ROLES_REQUIRING_BUSINESS_ID.includes(role as PlatformUserRole));
  const showMultipleBusinessSelector = isSuperAdminView && selectedRoles.includes('promoter');
  
  const handleSubmit = (values: PlatformUserFormValues) => {
    onSubmit(values, isEditing);
  };
  
  const allowedRoles = isSuperAdminView ? ALL_PLATFORM_USER_ROLES : (['staff', 'host', 'lector_qr'] as PlatformUserRole[]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
         {initialDataForCreation?.preExistingUserType && (
             <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">
                  DNI Encontrado como {PLATFORM_USER_ROLE_TRANSLATIONS[initialDataForCreation.preExistingUserType]}
                </AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400">
                  Algunos datos se han pre-rellenado. Completa el perfil para crear la cuenta de usuario.
                </AlertDescription>
            </Alert>
         )}
        
        <FormField control={form.control} name="dni" render={({ field }) => (
            <FormItem><FormLabel>DNI/CE <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Número de documento" {...field} disabled={isSubmitting || isEditing || !!initialDataForCreation?.dni} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Nombre Completo <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Nombre del usuario" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email <span className="text-destructive">*</span></FormLabel><FormControl><Input type="email" placeholder="usuario@email.com" {...field} disabled={isSubmitting || isEditing} /></FormControl><FormMessage /></FormItem>
        )}/>
        {needsPassword && (
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem><FormLabel>Contraseña <span className="text-destructive">*</span></FormLabel><FormControl><Input type="password" placeholder="Mínimo 6 caracteres" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
          )}/>
        )}
        
        <FormField
          control={form.control}
          name="roles"
          render={() => (
            <FormItem>
              <FormLabel>Roles <span className="text-destructive">*</span></FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {allowedRoles.map((role) => (
                  <FormField
                    key={role}
                    control={form.control}
                    name="roles"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(role)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...(field.value || []), role])
                                : field.onChange((field.value || []).filter((value) => value !== role))
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {PLATFORM_USER_ROLE_TRANSLATIONS[role]}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        
       {showBusinessIdSelector && (
          <FormField
            control={form.control}
            name="businessId"
            render={() => (
              <FormItem>
                <FormLabel>Negocio Principal (Para Staff/Admin/Host) <span className="text-destructive">*</span></FormLabel>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border p-2 rounded-md">
                  {businesses.map((biz) => (
                    <FormField
                      key={biz.id}
                      control={form.control}
                      name="businessId"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value === biz.id}
                              onCheckedChange={() => {
                                field.onChange(biz.id);
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal text-sm">{biz.name}</FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormDescription className="text-xs">Negocio al que el Staff/Host/Admin pertenece.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}


        {showMultipleBusinessSelector && (
             <FormField control={form.control} name="businessIds" render={() => (
                <FormItem><FormLabel>Negocios Asignados (Para Promotor)</FormLabel>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border p-2 rounded-md">
                  {businesses.map(biz => (
                     <FormField key={biz.id} control={form.control} name="businessIds" render={({ field }) => (
                       <FormItem className="flex items-center space-x-2"><FormControl><Checkbox
                            checked={field.value?.includes(biz.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...(field.value || []), biz.id])
                                : field.onChange((field.value || []).filter((id) => id !== biz.id))
                            }}
                        /></FormControl><FormLabel className="font-normal text-sm">{biz.name}</FormLabel></FormItem>
                     )}/>
                  ))}
                </div>
                <FormDescription className="text-xs">Negocios en los que el promotor puede generar códigos.</FormDescription><FormMessage /></FormItem>
             )}/>
        )}
        
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting || disableSubmitOverride}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar Cambios" : "Crear Usuario"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
