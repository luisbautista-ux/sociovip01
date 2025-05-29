
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
import type { Business, BusinessFormData, BusinessType } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERU_LOCATIONS, BUSINESS_TYPES } from "@/lib/constants";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";


const businessFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre comercial debe tener al menos 3 caracteres." }),
  razonSocial: z.string().min(3, "La razón social debe tener al menos 3 caracteres.").optional().or(z.literal("")),
  ruc: z.string().length(11, "El RUC debe tener 11 dígitos.").regex(/^\d+$/, "El RUC solo debe contener números.").optional().or(z.literal("")),
  businessType: z.enum(BUSINESS_TYPES, { required_error: "Debes seleccionar un giro de negocio." }),
  department: z.string().min(1, "Departamento es requerido."),
  province: z.string().min(1, "Provincia es requerida."),
  district: z.string().min(1, "Distrito es requerido."),
  address: z.string().min(5, "La dirección debe tener al menos 5 caracteres.").optional().or(z.literal("")),
  contactEmail: z.string().email({ message: "Por favor, ingresa un email válido." }),
  managerName: z.string().min(3, "Nombre del gerente es requerido.").optional().or(z.literal("")),
  managerDni: z.string().min(8, "DNI/CE debe tener al menos 8 caracteres.").max(15, "No debe exceder 15 caracteres.").regex(/^[a-zA-Z0-9]*$/, "Solo debe contener letras y números.").optional().or(z.literal("")),
  logoUrl: z.string().url("URL de logo inválida. Asegúrate que incluya http:// o https://").optional().or(z.literal("")),
  publicCoverImageUrl: z.string().url("URL de imagen de portada inválida. Asegúrate que incluya http:// o https://").optional().or(z.literal("")),
  slogan: z.string().max(100, "El slogan no debe exceder 100 caracteres.").optional().or(z.literal("")),
  publicContactEmail: z.string().email("Email público de contacto inválido.").optional().or(z.literal("")),
  publicPhone: z.string().optional().or(z.literal("")),
  publicAddress: z.string().optional().or(z.literal("")),
  customUrlPath: z.string()
    .min(3, "La ruta URL debe tener al menos 3 caracteres.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo letras minúsculas, números y guiones (ej: mi-negocio).")
    .optional().or(z.literal("")),
});

type BusinessFormValues = z.infer<typeof businessFormSchema>;

interface BusinessFormProps {
  business?: Business;
  onSubmit: (data: BusinessFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  existingCustomUrlPaths: string[]; 
}

export function BusinessForm({ business, onSubmit, onCancel, isSubmitting = false, existingCustomUrlPaths }: BusinessFormProps) {
  const [selectedDepartment, setSelectedDepartment] = useState(business?.department || "");
  const [provinces, setProvinces] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState(business?.province || "");
  const [districts, setDistricts] = useState<string[]>([]);
  
  const departments = Object.keys(PERU_LOCATIONS);

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema.refine(data => {
      if (data.customUrlPath && data.customUrlPath.trim() !== "") {
        const currentPath = data.customUrlPath.toLowerCase().trim();
        // Check if path is in the list of existing paths AND it's not the business's own current path
        const isEditingOwnPath = business && business.customUrlPath === currentPath;
        return isEditingOwnPath || !existingCustomUrlPaths.includes(currentPath);
      }
      return true;
    }, {
      message: "Esta ruta URL personalizada ya está en uso por otro negocio.",
      path: ["customUrlPath"],
    })),
    defaultValues: {
      name: business?.name || "",
      contactEmail: business?.contactEmail || "",
      ruc: business?.ruc || "",
      razonSocial: business?.razonSocial || "",
      department: business?.department || "",
      province: business?.province || "",
      district: business?.district || "",
      address: business?.address || "",
      managerName: business?.managerName || "",
      managerDni: business?.managerDni || "",
      businessType: business?.businessType || undefined,
      logoUrl: business?.logoUrl || "",
      publicCoverImageUrl: business?.publicCoverImageUrl || "",
      slogan: business?.slogan || "",
      publicContactEmail: business?.publicContactEmail || "",
      publicPhone: business?.publicPhone || "",
      publicAddress: business?.publicAddress || "",
      customUrlPath: business?.customUrlPath || "",
    },
  });

  useEffect(() => {
    const defaultVals = {
      name: business?.name || "",
      contactEmail: business?.contactEmail || "",
      ruc: business?.ruc || "",
      razonSocial: business?.razonSocial || "",
      department: business?.department || "",
      province: business?.province || "",
      district: business?.district || "",
      address: business?.address || "",
      managerName: business?.managerName || "",
      managerDni: business?.managerDni || "",
      businessType: business?.businessType || undefined,
      logoUrl: business?.logoUrl || "",
      publicCoverImageUrl: business?.publicCoverImageUrl || "",
      slogan: business?.slogan || "",
      publicContactEmail: business?.publicContactEmail || "",
      publicPhone: business?.publicPhone || "",
      publicAddress: business?.publicAddress || "",
      customUrlPath: business?.customUrlPath || "",
    };
    form.reset(defaultVals);
    setSelectedDepartment(defaultVals.department);
    
    if (defaultVals.department && PERU_LOCATIONS[defaultVals.department as keyof typeof PERU_LOCATIONS]) {
      const currentProvinces = Object.keys(PERU_LOCATIONS[defaultVals.department as keyof typeof PERU_LOCATIONS]);
      setProvinces(currentProvinces);
      setSelectedProvince(defaultVals.province); // Set before checking inclusion
      if (currentProvinces.includes(defaultVals.province)) {
        const provinceKey = defaultVals.province as keyof typeof PERU_LOCATIONS[keyof typeof PERU_LOCATIONS];
        const districtsForProvince = PERU_LOCATIONS[defaultVals.department as keyof typeof PERU_LOCATIONS][provinceKey] || [];
        setDistricts(districtsForProvince);
        if (!districtsForProvince.includes(defaultVals.district)) {
          form.setValue("district", ""); // Reset district if not in the list for the loaded province
        }
      } else {
        form.setValue("province", ""); // Reset province if not in the list for the loaded department
        form.setValue("district", "");
        setSelectedProvince("");
        setDistricts([]);
      }
    } else {
      setProvinces([]);
      setSelectedProvince("");
      setDistricts([]);
    }
  }, [business, form]);


  useEffect(() => {
    if (selectedDepartment && PERU_LOCATIONS[selectedDepartment as keyof typeof PERU_LOCATIONS]) {
      const currentProvinces = Object.keys(PERU_LOCATIONS[selectedDepartment as keyof typeof PERU_LOCATIONS]);
      setProvinces(currentProvinces);
      if (!currentProvinces.includes(form.getValues("province"))) {
         form.setValue("province", ""); // Reset if current province is not valid for new department
         form.setValue("district", "");
         setSelectedProvince(""); // Also reset selectedProvince state
         setDistricts([]);
      }
    } else {
      setProvinces([]);
      form.setValue("province", "");
      form.setValue("district", "");
      setSelectedProvince("");
      setDistricts([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment, form.setValue]); // form.getValues creates new reference, use form.setValue for stable deps

  useEffect(() => {
    if (selectedDepartment && selectedProvince && PERU_LOCATIONS[selectedDepartment as keyof typeof PERU_LOCATIONS]?.[selectedProvince as keyof typeof PERU_LOCATIONS[keyof typeof PERU_LOCATIONS]]) {
      const currentDistricts = PERU_LOCATIONS[selectedDepartment as keyof typeof PERU_LOCATIONS][selectedProvince as keyof typeof PERU_LOCATIONS[keyof typeof PERU_LOCATIONS]] || [];
      setDistricts(currentDistricts);
      if (!currentDistricts.includes(form.getValues("district"))) {
         form.setValue("district", "");
      }
    } else {
      setDistricts([]);
      form.setValue("district", "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment, selectedProvince, form.setValue]);

  const handleSubmit = (values: BusinessFormValues) => {
    const dataToSubmit: BusinessFormData = {
      ...values,
      customUrlPath: values.customUrlPath ? values.customUrlPath.toLowerCase().trim().replace(/\s+/g, '-') : undefined,
    };
    onSubmit(dataToSubmit);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-3 pl-1 py-1">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Nombre Comercial <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Ej: Pandora Lounge Bar" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="razonSocial" render={({ field }) => (
          <FormItem><FormLabel>Razón Social</FormLabel><FormControl><Input placeholder="Nombre legal de la empresa" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="ruc" render={({ field }) => (
          <FormItem><FormLabel>RUC</FormLabel><FormControl><Input placeholder="12345678901" {...field} value={field.value || ""} maxLength={11} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="businessType" render={({ field }) => (
          <FormItem><FormLabel>Giro de Negocio <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un giro" /></SelectTrigger></FormControl><SelectContent>{BUSINESS_TYPES.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
        )}/>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem><FormLabel>Departamento <span className="text-destructive">*</span></FormLabel><Select onValueChange={(value) => { field.onChange(value); setSelectedDepartment(value); form.setValue("province", ""); form.setValue("district", ""); setSelectedProvince(""); setDistricts([]); }} value={field.value} disabled={isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger></FormControl><SelectContent>{departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="province" render={({ field }) => (
                <FormItem><FormLabel>Provincia <span className="text-destructive">*</span></FormLabel><Select onValueChange={(value) => { field.onChange(value); setSelectedProvince(value); form.setValue("district", ""); setDistricts([]);}} value={field.value} disabled={isSubmitting || !selectedDepartment || provinces.length === 0}><FormControl><SelectTrigger><SelectValue placeholder={!selectedDepartment ? "Selecciona Dept." : (provinces.length === 0 ? "No hay provincias" : "Selecciona")} /></SelectTrigger></FormControl><SelectContent>{provinces.map(prov => <SelectItem key={prov} value={prov}>{prov}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="district" render={({ field }) => (
                <FormItem><FormLabel>Distrito <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || !selectedProvince || districts.length === 0}><FormControl><SelectTrigger><SelectValue placeholder={!selectedProvince ? "Selecciona Prov." : (districts.length === 0 ? "No hay distritos" : "Selecciona")} /></SelectTrigger></FormControl><SelectContent>{districts.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )}/>
        </div>
        <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem><FormLabel>Dirección del Negocio</FormLabel><FormControl><Input placeholder="Ej: Av. Principal 123, Urb. Las Flores" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="contactEmail" render={({ field }) => (
          <FormItem><FormLabel>Email de Contacto del Negocio <span className="text-destructive">*</span></FormLabel><FormControl><Input type="email" placeholder="Ej: contacto@negocio.com" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="managerName" render={({ field }) => (
          <FormItem><FormLabel>Nombre del Gerente General</FormLabel><FormControl><Input placeholder="Nombre completo del gerente" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="managerDni" render={({ field }) => (
          <FormItem><FormLabel>DNI/CE del Gerente General</FormLabel><FormControl><Input placeholder="DNI o Carnet de Extranjería" {...field} value={field.value || ""} maxLength={15} disabled={isSubmitting} /></FormControl><FormDescription className="text-xs">Puede ser un usuario existente de la plataforma.</FormDescription><FormMessage /></FormItem>
        )}/>

        <h3 className="text-lg font-semibold pt-4 border-t mt-6">Información Pública y Branding</h3>
        <FormField control={form.control} name="customUrlPath" render={({ field }) => (
          <FormItem>
            <FormLabel>Ruta URL Personalizada (Slug)</FormLabel>
            <div className="flex items-center">
              <span className="px-3 py-2 bg-muted text-muted-foreground rounded-l-md border border-r-0 border-input text-sm">sociovip.app/b/</span>
              <FormControl>
                <Input 
                  placeholder="mi-negocio" 
                  {...field} 
                  value={field.value || ""} 
                  disabled={isSubmitting}
                  className="rounded-l-none"
                  onChange={(e) => {
                    const sanitizedValue = e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, '-') // Reemplaza espacios con guiones
                      .replace(/[^a-z0-9-]/g, ''); // Elimina caracteres no alfanuméricos excepto guiones
                    field.onChange(sanitizedValue);
                  }}
                />
              </FormControl>
            </div>
            <FormDescription>Solo letras minúsculas, números y guiones. Será único para tu negocio.</FormDescription>
            <FormMessage />
          </FormItem>
        )}/>
        <FormField control={form.control} name="slogan" render={({ field }) => (
          <FormItem><FormLabel>Slogan del Negocio</FormLabel><FormControl><Input placeholder="Tu frase pegajosa aquí" {...field} value={field.value || ""} maxLength={100} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="logoUrl" render={({ field }) => (
          <FormItem><FormLabel>URL del Logo</FormLabel><FormControl><Input type="url" placeholder="https://ejemplo.com/logo.png" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl><FormDescription>URL pública de tu logo (ej. subido a Firebase Storage).</FormDescription><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="publicCoverImageUrl" render={({ field }) => (
          <FormItem><FormLabel>URL Imagen de Portada Pública</FormLabel><FormControl><Input type="url" placeholder="https://ejemplo.com/portada.jpg" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl><FormDescription>Imagen para la página pública de tu negocio.</FormDescription><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="publicAddress" render={({ field }) => (
          <FormItem><FormLabel>Dirección Pública (si difiere de la principal)</FormLabel><FormControl><Input placeholder="Ej: Av. Comercial 456" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="publicContactEmail" render={({ field }) => (
          <FormItem><FormLabel>Email Público de Contacto</FormLabel><FormControl><Input type="email" placeholder="Ej: info@minegocio.com" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="publicPhone" render={({ field }) => (
          <FormItem><FormLabel>Teléfono Público de Contacto</FormLabel><FormControl><Input type="tel" placeholder="+51 1 2345678" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>

        <DialogFooter className="pt-6 sticky bottom-0 bg-background pb-4 -mb-2"> {/* Ensure footer is visible */}
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {business ? "Guardar Cambios" : "Crear Negocio"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
