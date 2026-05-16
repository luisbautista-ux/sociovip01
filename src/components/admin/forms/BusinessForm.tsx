

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
import { Loader2, Upload, ImageIcon as ImageIconLucide } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERU_LOCATIONS, BUSINESS_TYPES } from "@/lib/constants";
import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import NextImage from "next/image";
import { useToast } from "@/hooks/use-toast";


const businessFormSchemaBase = z.object({
  name: z.string().min(3, { message: "El nombre comercial debe tener al menos 3 caracteres." }),
  razonSocial: z.string().min(3, "La razón social debe tener al menos 3 caracteres.").optional().or(z.literal("")),
  ruc: z.string().length(11, "El RUC debe tener 11 dígitos.").regex(/^\d+$/, "El RUC solo debe contener números.").optional().or(z.literal("")),
  businessType: z.enum(BUSINESS_TYPES, { required_error: "Debes seleccionar un giro de negocio." }),
  department: z.string().min(1, "Departamento es requerido."),
  province: z.string().min(1, "Provincia es requerida."),
  district: z.string().min(1, "Distrito es requerida."),
  address: z.string().min(5, "La dirección debe tener al menos 5 caracteres.").optional().or(z.literal("")),
  contactEmail: z.string().email({ message: "Por favor, ingresa un email válido." }).refine(val => val.toLowerCase().endsWith("@gmail.com"), { message: "El email debe terminar en @gmail.com" }),
  managerName: z.string().min(3, "Nombre del gerente es requerido.").optional().or(z.literal("")),
  managerDni: z.string().max(20, "No debe exceder 20 caracteres.").regex(/^\d*$/, "Solo debe contener números.").optional().or(z.literal("")),
  
  logoFile: z.custom<File | null>().optional(),
  publicCoverImageUrls: z.array(z.string().url()).optional(),
  slogan: z.string().max(100, "El slogan no debe exceder 100 caracteres.").optional().or(z.literal("")),
  publicContactEmail: z.string().email("Email público de contacto inválido.").optional().or(z.literal("")).refine(val => !val || val.toLowerCase().endsWith("@gmail.com"), { message: "El email debe terminar en @gmail.com" }),
  publicPhone: z.string().regex(/^9\d{8}$/, "El teléfono debe empezar con 9 y tener 9 dígitos.").optional().or(z.literal("")),
  publicAddress: z.string().max(200, "La dirección pública no debe exceder 200 caracteres.").optional().or(z.literal("")),
  customUrlPath: z.string()
    .min(3, "La ruta URL debe tener al menos 3 caracteres.")
    .max(50, "La ruta URL no debe exceder 50 caracteres.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo letras minúsculas, números y guiones (ej: mi-negocio). No debe empezar ni terminar con guion, ni tener guiones consecutivos.")
    .optional().or(z.literal("")),
});

type BusinessFormValues = z.infer<typeof businessFormSchemaBase>;

interface BusinessFormProps {
  business?: Business;
  onSubmit: (data: BusinessFormData, currentBusinessId?: string) => Promise<{success: boolean; error?: string}>;
  onCancel: () => void;
  isSubmittingForm?: boolean;
  existingCustomUrlPaths: string[]; 
  onDirtyChange?: (isDirty: boolean) => void;
}

export function BusinessForm({ business, onSubmit, onCancel, isSubmittingForm = false, existingCustomUrlPaths, onDirtyChange }: BusinessFormProps) {
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const businessFormSchema = businessFormSchemaBase.refine(data => {
    if (data.customUrlPath && data.customUrlPath.trim() !== "") {
      const currentPath = data.customUrlPath.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const isEditingOwnPath = business && business.customUrlPath === currentPath;
      return isEditingOwnPath || !existingCustomUrlPaths.includes(currentPath);
    }
    return true;
  }, {
    message: "Esta ruta URL personalizada ya está en uso por otro negocio.",
    path: ["customUrlPath"],
  });

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
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
      businessType: business?.businessType,
      slogan: business?.slogan || "",
      publicContactEmail: business?.publicContactEmail || "",
      publicPhone: business?.publicPhone || "",
      publicAddress: business?.publicAddress || "",
      customUrlPath: business?.customUrlPath || "",
      logoFile: null,
      publicCoverImageUrls: business?.publicCoverImageUrls || [],
    },
  });
  
  useEffect(() => {
    if (business) {
      form.reset({
        name: business.name || "",
        contactEmail: business.contactEmail || "",
        ruc: business.ruc || "",
        razonSocial: business.razonSocial || "",
        department: business.department || "",
        province: business.province || "",
        district: business.district || "",
        address: business.address || "",
        managerName: business.managerName || "",
        managerDni: business.managerDni || "",
        businessType: business.businessType,
        slogan: business.slogan || "",
        publicContactEmail: business.publicContactEmail || "",
        publicPhone: business.publicPhone || "",
        publicAddress: business.publicAddress || "",
        customUrlPath: business.customUrlPath || "",
        logoFile: null,
        publicCoverImageUrls: business.publicCoverImageUrls || [],
      });
      setLogoPreview(business.logoUrl || null);
    }
  }, [business, form]);

  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  
  const selectedDepartment = form.watch("department");
  const selectedProvince = form.watch("province");
  
  const departments = Object.keys(PERU_LOCATIONS);
  const provinces = selectedDepartment ? Object.keys(PERU_LOCATIONS[selectedDepartment as keyof typeof PERU_LOCATIONS] || {}) : [];
  const districts = selectedDepartment && selectedProvince ? PERU_LOCATIONS[selectedDepartment as keyof typeof PERU_LOCATIONS]?.[selectedProvince as keyof typeof PERU_LOCATIONS[keyof typeof PERU_LOCATIONS]] || [] : [];
  
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ title: "Archivo de logo muy grande", description: "Por favor, selecciona una imagen de menos de 2MB.", variant: "destructive" });
        return;
      }
      form.setValue("logoFile", file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };
  
  const processSubmit = async (values: BusinessFormValues) => {
    const dataToSubmit: BusinessFormData = {
      ...values,
      logoFile: values.logoFile,
      ruc: values.ruc || undefined,
      razonSocial: values.razonSocial || undefined,
      address: values.address || undefined,
      managerName: values.managerName || undefined,
      managerDni: values.managerDni || undefined,
      publicCoverImageUrls: values.publicCoverImageUrls || [],
      slogan: values.slogan || undefined,
      publicContactEmail: values.publicContactEmail || undefined,
      publicPhone: values.publicPhone || undefined,
      publicAddress: values.publicAddress || undefined,
      customUrlPath: values.customUrlPath ? values.customUrlPath.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : undefined,
    };
    await onSubmit(dataToSubmit, business?.id);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(processSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-3 pl-1 py-1">
        <h3 className="text-lg font-semibold pt-2 border-b pb-2 mb-3">Información General</h3>
        
        <div className="space-y-2">
            <FormLabel>Logo del Negocio</FormLabel>
            <div className="flex items-center gap-4">
                <div className="w-20 h-20 flex-shrink-0 border p-1 rounded-md flex items-center justify-center bg-muted">
                  {logoPreview ? (
                    <NextImage src={logoPreview} alt="Vista previa del logo" width={80} height={80} className="object-contain" />
                  ) : (
                    <ImageIconLucide className="text-muted-foreground h-10 w-10"/>
                  )}
                </div>
                <div className="w-full flex flex-col gap-2">
                   <input type="file" ref={logoInputRef} onChange={handleLogoFileChange} className="hidden" accept="image/png, image/jpeg, image/gif, image/webp" />
                   <Button type="button" variant="outline" className="w-full" onClick={() => logoInputRef.current?.click()} disabled={isSubmittingForm}>
                     <Upload className="mr-2 h-4 w-4" /> Cambiar Logo
                   </Button>
                   <FormDescription className="text-xs">Recomendado: PNG cuadrado con fondo transparente.</FormDescription>
                </div>
            </div>
          </div>
        
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Nombre Comercial <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Ej: Pandora Lounge Bar" {...field} value={field.value || ''} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="razonSocial" render={({ field }) => (
          <FormItem><FormLabel>Razón Social</FormLabel><FormControl><Input placeholder="Nombre legal de la empresa" {...field} value={field.value || ""} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="ruc" render={({ field }) => (
          <FormItem>
            <FormLabel>RUC</FormLabel>
            <FormControl>
              <Input placeholder="10XXXXXXXXX" {...field} value={field.value || ""} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').substring(0, 11))} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        <FormField control={form.control} name="businessType" render={({ field }) => (
          <FormItem><FormLabel>Giro de Negocio <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmittingForm}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un giro" /></SelectTrigger></FormControl><SelectContent>{BUSINESS_TYPES.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
        )}/>
        
        <h3 className="text-lg font-semibold pt-4 border-t mt-6 pb-2 mb-3">Ubicación Principal</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem>
              <FormLabel>Departamento <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={(value) => { field.onChange(value); form.setValue("province", ""); form.setValue("district", ""); }} value={field.value || ''} disabled={isSubmittingForm}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona Dept." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}/>
          <FormField control={form.control} name="province" render={({ field }) => (
            <FormItem>
              <FormLabel>Provincia <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={(value) => { field.onChange(value); form.setValue("district", ""); }} value={field.value || ''} disabled={isSubmittingForm || !selectedDepartment || provinces.length === 0}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={!selectedDepartment ? "Primero elige Dept." : (provinces.length === 0 ? "No hay provincias" : "Selecciona Prov.")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {provinces.map(prov => <SelectItem key={prov} value={prov}>{prov}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}/>
          <FormField control={form.control} name="district" render={({ field }) => (
            <FormItem>
              <FormLabel>Distrito <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmittingForm || !selectedProvince || districts.length === 0}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={!selectedProvince ? "Primero elige Prov." : (districts.length === 0 ? "No hay distritos" : "Selecciona Dist.")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {districts.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}/>
        </div>
        <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem><FormLabel>Dirección del Negocio</FormLabel><FormControl><Input placeholder="Ej: Av. Principal 123, Urb. Las Flores" {...field} value={field.value || ""} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>
        )}/>

        <h3 className="text-lg font-semibold pt-4 border-t mt-6 pb-2 mb-3">Información de Contacto y Representante</h3>
        <FormField control={form.control} name="contactEmail" render={({ field }) => (
          <FormItem><FormLabel>Email de Contacto del Negocio <span className="text-destructive">*</span></FormLabel><FormControl><Input type="email" placeholder="Ej: contacto@negocio.com" {...field} value={field.value || ''} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="managerName" render={({ field }) => (
          <FormItem><FormLabel>Nombre del Gerente o Representante Legal</FormLabel><FormControl><Input placeholder="Nombre completo del gerente" {...field} value={field.value || ""} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="managerDni" render={({ field }) => (
          <FormItem>
            <FormLabel>DNI/CE del Representante</FormLabel>
            <FormControl>
              <Input placeholder="Número de documento" {...field} value={field.value || ""} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').substring(0, 20))} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}/>

        <h3 className="text-lg font-semibold pt-4 border-t mt-6 pb-2 mb-3">Branding y Página Pública</h3>
        <FormField control={form.control} name="customUrlPath" render={({ field }) => (
          <FormItem>
            <FormLabel>Ruta URL Personalizada (Slug)</FormLabel>
            <div className="flex items-center">
              <span className="px-3 py-2 bg-muted text-muted-foreground rounded-l-md border border-r-0 border-input text-sm">sociovip.app/b/</span>
              <FormControl>
                <Input 
                  placeholder="mi-negocio-genial" 
                  {...field} 
                  value={field.value || ""} 
                  disabled={isSubmittingForm}
                  className="rounded-l-none"
                  onChange={(e) => {
                    const sanitizedValue = e.target.value
                      .toLowerCase()
                      .trim()
                      .replace(/\s+/g, '-') 
                      .replace(/[^a-z0-9-]/g, ''); 
                    field.onChange(sanitizedValue);
                  }}
                />
              </FormControl>
            </div>
            <FormDescription className="text-xs">Debe ser único. Solo letras minúsculas, números y guiones. Se usará para la URL pública de tu negocio.</FormDescription>
            <FormMessage />
          </FormItem>
        )}/>
        <FormField control={form.control} name="slogan" render={({ field }) => (
          <FormItem><FormLabel>Slogan del Negocio (Público)</FormLabel><FormControl><Input placeholder="Tu frase pegajosa aquí" {...field} value={field.value || ""} maxLength={100} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>
        )}/>
        
        <FormField control={form.control} name="publicAddress" render={({ field }) => (
          <FormItem><FormLabel>Dirección Pública (si difiere de la principal)</FormLabel><FormControl><Textarea placeholder="Ej: Av. Comercial 456, Referencia..." {...field} value={field.value || ""} disabled={isSubmittingForm} rows={2}/></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="publicContactEmail" render={({ field }) => (
          <FormItem><FormLabel>Email Público de Contacto</FormLabel><FormControl><Input type="email" placeholder="Ej: info@minegocio.com" {...field} value={field.value || ""} disabled={isSubmittingForm} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="publicPhone" render={({ field }) => (
          <FormItem>
            <FormLabel>Teléfono Público de Contacto</FormLabel>
            <FormControl>
              <Input placeholder="9XXXXXXXX" {...field} value={field.value || ""} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').substring(0, 9))} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}/>

        <DialogFooter className="pt-6 sticky bottom-0 bg-background pb-4 -mb-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmittingForm}>Cancelar</Button>
          <Button type="submit" disabled={isSubmittingForm} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
            {isSubmittingForm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {business ? "Guardar Cambios" : "Crear Negocio"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
