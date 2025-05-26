
"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SocioVipMember, SocioVipMemberFormData } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";

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
  member?: SocioVipMember; // For editing
  onSubmit: (data: SocioVipMemberFormData) => void;
  onCancel: () => void;
}

export function SocioVipMemberForm({ member, onSubmit, onCancel }: SocioVipMemberFormProps) {
  const form = useForm<SocioVipMemberFormValues>({
    resolver: zodResolver(socioVipMemberFormSchema),
    defaultValues: {
      name: member?.name || "",
      surname: member?.surname || "",
      dni: member?.dni || "",
      phone: member?.phone || "",
      dob: member?.dob ? new Date(member.dob) : undefined,
      email: member?.email || "",
      address: member?.address || "",
      profession: member?.profession || "",
      preferences: member?.preferences?.join(', ') || "",
      loyaltyPoints: member?.loyaltyPoints || 0,
      membershipStatus: member?.membershipStatus || undefined,
    },
  });

  const handleSubmit = (values: SocioVipMemberFormValues) => {
    onSubmit(values); // The parent component will handle conversion (e.g. preferences string to array)
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre(s)</FormLabel>
                <FormControl><Input placeholder="Nombres del socio" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="surname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido(s)</FormLabel>
                <FormControl><Input placeholder="Apellidos del socio" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dni"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DNI / Carnet de Extranjería</FormLabel>
                <FormControl><Input placeholder="Documento de identidad" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Celular</FormLabel>
                <FormControl><Input type="tel" placeholder="Número de celular" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="dob"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Fecha de Nacimiento</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
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
                    toYear={new Date().getFullYear() - 18} // Must be at least 18
                    disabled={(date) => date > new Date(new Date().setFullYear(new Date().getFullYear() - 18)) || date < new Date("1920-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (para cuenta)</FormLabel>
              <FormControl><Input type="email" placeholder="correo@ejemplo.com" {...field} /></FormControl>
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
              <FormControl><Input placeholder="Ej: Av. Principal 123" {...field} /></FormControl>
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
              <FormControl><Input placeholder="Ej: Ingeniero, Abogada" {...field} /></FormControl>
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
              <FormControl><Textarea placeholder="Ej: Viajes, Cocina, Música Rock (separadas por comas)" {...field} /></FormControl>
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
                <FormLabel>Puntos de Lealtad</FormLabel>
                <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="membershipStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado de Membresía</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90">
            {member ? "Guardar Cambios" : "Crear Socio VIP"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
