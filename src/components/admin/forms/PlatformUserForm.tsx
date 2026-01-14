
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
import { Info, Loader2, CalendarIcon } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import type { PlatformUser, PlatformUserFormData, Business, PlatformUserRole, InitialDataForPlatformUserCreation } from "@/lib/types";
import { PLATFORM_USER_ROLE_TRANSLATIONS, ALL_PLATFORM_USER_ROLES, ROLES_REQUIRING_BUSINESS_ID } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GoogleIcon } from "@/components/icons";
import { toast } from "@/hooks/use-toast";


const platformUserFormSchema = z.object({
  uid: z.string().optional(),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  dni: z.string().min(7, "El DNI/CE debe tener entre 7 y 15 caracteres.").max(15),
  email: z.string().email("Debe ser un email válido.").optional().or(z.literal("")),
  phone: z.string().regex(/^9\d{8}$/, "El celular debe tener 9 dígitos y empezar con 9."),
  dob: z.date({ required_error: "La fecha de nacimiento es requerida."}),
  password: z.string().optional(),
  roles: z.array(z.string()).refine((value) => value.length > 0, {
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
  allowedRoles?: PlatformUserRole[];
  onSubmit: (data: PlatformUserFormData, isEditing: boolean) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  disableSubmitOverride?: boolean;
}

export function PlatformUserForm({
  user,
  initialDataForCreation,
  businesses,
  allowedRoles = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  disableSubmitOverride = false,
}: PlatformUserFormProps) {
  const { userProfile: currentUserProfile, signupWithGoogle } = useAuth();
  const isSuperAdminView = currentUserProfile?.roles.includes('superadmin') || false;

  const rolesToDisplay = (isSuperAdminView ? ALL_PLATFORM_USER_ROLES : allowedRoles).filter(role => role !== 'host');
  
  const isSingleRoleSelection = true; 

  const isEditing = !!user;
  
  const form = useForm<PlatformUserFormValues>({
    resolver: zodResolver(platformUserFormSchema),
    defaultValues: {
      uid: user?.uid || undefined,
      name: user?.name || "",
      dni: user?.dni || initialDataForCreation?.dni || "",
      email: user?.email || "",
      phone: user?.phone || "",
      dob: user?.dob ? anyToDate(user.dob) ?? undefined : undefined,
      password: "",
      roles: user?.roles || [],
      businessId: user?.businessId || null,
      businessIds: user?.businessIds || [],
    },
  });

  useEffect(() => {
    const initialValues = {
      uid: user?.uid || undefined,
      name: user?.name || initialDataForCreation?.name || "",
      dni: user?.dni || initialDataForCreation?.dni || "",
      email: user?.email || initialDataForCreation?.email || "",
      phone: user?.phone || (initialDataForCreation as any)?.phone || "",
      dob: user?.dob ? anyToDate(user.dob) : (initialDataForCreation as any)?.dob ? anyToDate((initialDataForCreation as any).dob) : undefined,
      password: "",
      roles: user?.roles || [],
      businessId: user?.businessId || null,
      businessIds: user?.businessIds || [],
    };
    form.reset(initialValues);
  }, [user, initialDataForCreation, form]);

  const selectedRoles = form.watch("roles", user?.roles || []);
  const showBusinessIdSelector = isSuperAdminView && selectedRoles.some(role => ROLES_REQUIRING_BUSINESS_ID.includes(role as PlatformUserRole));
  const showMultipleBusinessSelector = isSuperAdminView && selectedRoles.includes('promoter');
  
  const handleSubmit = (values: PlatformUserFormValues) => {
    onSubmit(values, isEditing);
  };
  
  const handleGoogleSignup = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast({
        title: "Campos incompletos",
        description: "Por favor, revisa y completa todos los campos requeridos antes de continuar.",
        variant: "destructive",
      });
      return;
    }
    const values = form.getValues();
    
    toast({
        title: "Inicia sesión con Google",
        description: "Se abrirá una ventana para que el nuevo usuario inicie sesión y vincule su cuenta de Google.",
    });

    const result = await signupWithGoogle(values.roles[0] as PlatformUserRole, {
        dni: values.dni,
        phone: values.phone,
        dob: values.dob,
        overrideName: values.name
    });

    if ("user" in result) {
        toast({ title: "¡Usuario Creado y Vinculado!", description: `${values.name} ahora es parte del equipo.` });
        onSubmit(values, false); // Notifica al padre que se completó
    } else {
        let errorMessage = "No se pudo completar el registro con Google.";
        if (result.code === 'auth/popup-closed-by-user') {
            errorMessage = "La ventana de Google fue cerrada. Inténtalo de nuevo.";
        } else if (result.code === 'auth/credential-already-in-use') {
            errorMessage = "Esta cuenta de Google ya está registrada en la plataforma.";
        }
        toast({ title: "Error de Vinculación", description: errorMessage, variant: "destructive"});
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
         {initialDataForCreation?.preExistingUserType && (
             <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">
                  DNI Encontrado como {PLATFORM_USER_ROLE_TRANSLATIONS[initialDataForCreation.preExistingUserType as keyof typeof PLATFORM_USER_ROLE_TRANSLATIONS]}
                </AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400">
                  Este DNI pertenece a un {initialDataForCreation.preExistingUserType === 'QrClient' ? 'Cliente QR' : 'Usuario de Plataforma'} existente.
                  Se han pre-rellenado los datos conocidos. Completa el perfil para crear la cuenta de usuario.
                </AlertDescription>
            </Alert>
         )}
        
        <FormField control={form.control} name="dni" render={({ field }) => (
            <FormItem><FormLabel>DNI/CE <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Número de documento" {...field} disabled={isSubmitting || isEditing || !!initialDataForCreation?.dni} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Nombre Completo <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Nombre del usuario" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>

        {!isEditing && (
            <>
                <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Celular <span className="text-destructive">*</span></FormLabel><FormControl><Input type="tel" placeholder="987654321" {...field} maxLength={9} value={field.value || ""} disabled={isSubmitting}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={form.control} name="dob" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Fecha de Nacimiento <span className="text-destructive">*</span></FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>
                                {field.value ? format(field.value, "d 'de' MMMM, yyyy", { locale: es }) : <span>Selecciona la fecha</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={1940} toYear={new Date().getFullYear() - 18} disabled={(date) => date > new Date(new Date().setFullYear(new Date().getFullYear() - 18))} locale={es} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage/>
                    </FormItem>
                )}/>
            </>
        )}
        
        <FormField
          control={form.control}
          name="roles"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rol <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                    <RadioGroup
                        onValueChange={(value) => field.onChange(value ? [value] : [])}
                        value={field.value?.[0] || ""}
                        className="grid grid-cols-2 gap-2"
                    >
                        {rolesToDisplay.map((role) => (
                            <FormItem key={role} className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                    <RadioGroupItem value={role} />
                                </FormControl>
                                <FormLabel className="font-normal">
                                    {PLATFORM_USER_ROLE_TRANSLATIONS[role as PlatformUserRole]}
                                </FormLabel>
                            </FormItem>
                        ))}
                    </RadioGroup>
                </FormControl>
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
                <FormLabel>Negocio Principal (Para Staff/Admin/Lector) <span className="text-destructive">*</span></FormLabel>
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
                <FormDescription className="text-xs">Negocio al que el Staff/Lector/Admin pertenece.</FormDescription>
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
          
          {isEditing ? (
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting || disableSubmitOverride}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
            </Button>
          ) : (
            <Button type="button" onClick={handleGoogleSignup} variant="gradient" disabled={isSubmitting || disableSubmitOverride}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon className="mr-2 h-4 w-4" />}
                Crear y Vincular con Google
            </Button>
          )}

        </DialogFooter>
      </form>
    </Form>
  );
}

// Helper robusto para convertir a fecha
function anyToDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

    