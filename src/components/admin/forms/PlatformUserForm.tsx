
"use client";

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
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  role: z.enum(['superadmin', 'business_admin', 'staff'], { required_error: "Debes seleccionar un rol."}),
  businessId: z.string().optional(),
}).refine(data => data.role === 'superadmin' || (data.role !== 'superadmin' && data.businessId), {
  message: "Debes seleccionar un negocio para roles de 'Admin Negocio' o 'Staff'.",
  path: ["businessId"],
});

type PlatformUserFormValues = z.infer<typeof platformUserFormSchema>;

interface PlatformUserFormProps {
  user?: PlatformUser;
  businesses: Business[];
  onSubmit: (data: PlatformUserFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function PlatformUserForm({ user, businesses, onSubmit, onCancel, isSubmitting = false }: PlatformUserFormProps) {
  const form = useForm<PlatformUserFormValues>({
    resolver: zodResolver(platformUserFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      role: user?.role || undefined,
      businessId: user?.businessId || undefined,
    },
  });

  const selectedRole = form.watch("role");

  const handleSubmit = (values: PlatformUserFormValues) => {
    const dataToSubmit: PlatformUserFormData = { ...values };
    if (values.role === 'superadmin') {
      delete dataToSubmit.businessId; // Superadmin no necesita businessId
    }
    onSubmit(dataToSubmit);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Ej: juan.perez@ejemplo.com" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rol</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                  <SelectItem value="business_admin">Admin Negocio</SelectItem>
                  <SelectItem value="staff">Staff Negocio</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {selectedRole && selectedRole !== 'superadmin' && (
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

    