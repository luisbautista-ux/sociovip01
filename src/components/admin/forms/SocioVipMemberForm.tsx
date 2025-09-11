

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { SocioVipMember, SocioVipMemberFormData, InitialDataForSocioVipCreation } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { PLATFORM_USER_ROLE_TRANSLATIONS } from "@/lib/constants";


const socioVipMemberFormSchema = z.object({
  name: z.string().min(2, "Nombre es requerido."),
  surname: z.string().min(2, "Apellido es requerido."),
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
  phone: z.string().min(7, "Celular es requerido.").regex(/^\+?[0-9\s-()]*$/, "Número de celular inválido."),
  dob: z.date({ required_error: "Fecha de nacimiento es requerida." }),
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  address: z.string().optional(),
  profession: z.string().optional(),
  preferences: z.string().optional(), // Will be comma-separated string from textarea
  loyaltyPoints: z.coerce.number().min(0, "Los puntos no pueden ser negativos.").default(0),
  membershipStatus: z.enum(['active', 'inactive', 'pending_payment', 'cancelled'], { required_error: "Debes seleccionar un estado."}),
});

type SocioVipMemberFormValues = z.infer<typeof socioVipMemberFormSchema>;

interface SocioVipMemberFormProps {
  member?: SocioVipMember; 
  initialData?: InitialDataForSocioVipCreation; 
  onSubmit: (data: SocioVipMemberFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  disableSubmitOverride?: boolean;
}

export function SocioVipMemberForm({
  member,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  disableSubmitOverride = false,
}: SocioVipMemberFormProps) {
  const isEditing = !!member;

  const form = useForm<SocioVipMemberFormValues>({
    resolver: zodResolver(socioVipMemberFormSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (isEditing && member) {
      form.reset({
        name: member.name || "",
        surname: member.surname || "",
        dni: member.dni || "",
        phone: member.phone || "",
        dob: member.dob ? (typeof member.dob === 'string' ? parseISO(member.dob) : member.dob instanceof Date ? member.dob : undefined) : undefined,
        email: member.email || "",
        address: member.address || "",
        profession: member.profession || "",
        preferences: member.preferences?.join(', ') || "",
        loyaltyPoints: member.loyaltyPoints || 0,
        membershipStatus: member.membershipStatus || 'active',
      });
    } else if (!isEditing && initialData) {
      form.reset({
        dni: initialData.dni,
        name: initialData.name || "",
        surname: initialData.surname || "",
        phone: initialData.phone || "",
        dob: initialData.dob ? parseISO(initialData.dob) : undefined,
        email: initialData.email || "",
        address: "", 
        profession: "",
        preferences: "",
        loyaltyPoints: 0,
        membershipStatus: 'active', 
      });
    } else if (!isEditing && !initialData) { 
        form.reset({
            dni: "", name: "", surname: "", phone: "", dob: undefined, email: "",
            address: "", profession: "", preferences: "", loyaltyPoints: 0, membershipStatus: 'active',
        });
    }
  }, [member, initialData, isEditing, form]);

  const handleSubmit = (values: SocioVipMemberFormValues) => {
    onSubmit(values);
  };

  const shouldDisableDniField = isEditing || (!isEditing && !!initialData?.dni);
  const isPrePopulatedFromOtherSource = !isEditing && initialData?.existingUserType;


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {isPrePopulatedFromOtherSource && (
           <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-700 dark:text-blue-300">
              DNI Encontrado como {PLATFORM_USER_ROLE_TRANSLATIONS[initialData?.existingUserType as keyof typeof PLATFORM_USER_ROLE_TRANSLATIONS] || initialData?.existingUserType}
            </AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-400">
              Este DNI pertenece a un {initialData?.existingUserType === 'QrClient' ? 'Cliente QR' : 'Usuario de Plataforma'} existente.
              Se han pre-rellenado los datos conocidos. Por favor, complete la información para registrarlo como Socio VIP.
            </AlertDescription>
          </Alert>
        )}
        <FormField
            control={form.control}
            name="dni"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Ingrese el documento de identidad" {...field} maxLength={15} disabled={isSubmitting || shouldDisableDniField} /></FormControl>
                {shouldDisableDniField && !isEditing && <FormDescription className="text-xs">El DNI ha sido verificado y no puede cambiarse en este paso.</FormDescription>}
                {isEditing && <FormDescription className="text-xs">El DNI no puede ser modificado para socios existentes.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre(s) <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Ingrese los nombres del socio" {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="surname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido(s) <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Ingrese los apellidos del socio" {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Celular <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="tel" placeholder="Ingrese el número de celular" {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dob"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de Nacimiento <span className="text-destructive">*</span></FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        disabled={isSubmitting}
                      >
                        {field.value ? format(field.value, "d MMMM yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      locale={es}
                      captionLayout="dropdown-buttons"
                      fromYear={1920}
                      toYear={new Date().getFullYear() - 18} 
                      disabled={(date) => date > new Date(new Date().setFullYear(new Date().getFullYear() - 18)) || date < new Date("1920-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (para cuenta) <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input type="email" placeholder="Ingrese el correo electrónico" {...field} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección (Opcional)</FormLabel>
              <FormControl><Input placeholder="Ej: Av. Principal 123" {...field} value={field.value || ''} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="profession"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Profesión (Opcional)</FormLabel>
              <FormControl><Input placeholder="Ej: Ingeniero, Abogada" {...field} value={field.value || ''} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="preferences"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preferencias (Opcional)</FormLabel>
              <FormControl><Textarea placeholder="Ej: Viajes, Cocina, Música Rock (separadas por comas)" {...field} value={field.value || ''} rows={2} disabled={isSubmitting} /></FormControl>
              <FormDescription>Separa las preferencias por comas.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="loyaltyPoints"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Puntos de Lealtad <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="number" placeholder="0" {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="membershipStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado de Membresía <span className="text-destructive">*</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Activa</SelectItem>
                    <SelectItem value="inactive">Inactiva</SelectItem>
                    <SelectItem value="pending_payment">Pendiente de Pago</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="gradient" disabled={isSubmitting || disableSubmitOverride}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {member ? "Guardar Cambios" : "Crear Socio VIP"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
