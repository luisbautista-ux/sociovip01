
"use client";

import * as React from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlatformUser, PlatformUserFormData, Business } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const platformUserFormSchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  role: z.enum(['superadmin', 'business_admin', 'staff', 'promoter', 'host'], { required_error: "Debes seleccionar un rol."}),
  businessId: z.string().optional(),
}).refine(data => {
  if (['business_admin', 'staff', 'host'].includes(data.role)) {
    return !!data.businessId; 
  }
  return true; 
}, {
  message: "Debes seleccionar un negocio para roles de 'Admin Negocio', 'Staff' o 'Anfitrión'.",
  path: ["businessId"],
});

type PlatformUserFormValues = z.infer<typeof platformUserFormSchema>;

interface PlatformUserFormProps {
  user?: PlatformUser;
  businesses: Business[];
  onSubmit: (data: PlatformUserFormData, isEditing: boolean) => Promise<void>; // onSubmit is now async
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function PlatformUserForm({ user, businesses, onSubmit, onCancel, isSubmitting = false }: PlatformUserFormProps) {
  const form = useForm<PlatformUserFormValues>({
    resolver: zodResolver(platformUserFormSchema),
    defaultValues: {
      dni: user?.dni || "",
      name: user?.name || "",
      email: user?.email || "",
      role: user?.role || undefined,
      businessId: user?.businessId || undefined,
    },
  });

  const selectedRole = form.watch("role");

  const handleSubmit = async (values: PlatformUserFormValues) => { // handleSubmit is now async
    const dataToSubmit: PlatformUserFormData = { 
      dni: values.dni.trim(),
      name: values.name,
      email: values.email,
      role: values.role,
    };
    if (['business_admin', 'staff', 'host'].includes(values.role)) {
      dataToSubmit.businessId = values.businessId;
    } else {
      dataToSubmit.businessId = undefined; // Ensure businessId is not set for roles that don't need it
    }
    await onSubmit(dataToSubmit, !!user); // Pass isEditing flag
  };

  React.useEffect(() => {
    form.reset({
      dni: user?.dni || "",
      name: user?.name || "",
      email: user?.email || "",
      role: user?.role || undefined,
      businessId: user?.businessId || undefined,
    });
  }, [user, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="dni"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DNI / Carnet de Extranjería</FormLabel>
              <FormControl>
                <Input placeholder="Número de documento" {...field} disabled={isSubmitting || !!user} />
              </FormControl>
              {!!user && <FormMessage>El DNI no se puede cambiar para usuarios existentes.</FormMessage>}
              {!user && <FormMessage />}
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
                <Input type="email" placeholder="Ej: juan.perez@ejemplo.com" {...field} disabled={isSubmitting || !!user} />
              </FormControl>
              {!!user && <FormMessage>El email no se puede cambiar para usuarios existentes.</FormMessage>}
              {!user && <FormMessage />}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rol</FormLabel>
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
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un negocio" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {businesses.map(biz => (
                      <SelectItem key={biz.id} value={biz.id}>{biz.name}</SelectItem>
                    ))}
                    {businesses.length === 0 && <FormItem><FormLabel className="p-2 text-sm text-muted-foreground">No hay negocios disponibles. Crea uno primero.</FormLabel></FormItem>}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {user ? "Guardar Cambios" : "Crear Usuario"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

    