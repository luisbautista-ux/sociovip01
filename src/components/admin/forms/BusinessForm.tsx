
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
import { BUSINESS_TYPES } from "@/lib/constants";
import { useState, useEffect } from "react";

// Mock data for Peruvian locations - In a real app, this would come from an API or a larger static file
// USUARIO: Por favor, completa esta lista con todos los departamentos, provincias y distritos de Perú.
const peruLocations = {
  "Amazonas": {
    "Bagua": ["Aramango", "Bagua", "Copallin", "El Parco", "Imaza", "La Peca"],
    "Bongará": ["Chisquilla", "Churuja", "Corosha", "Cuispes", "Florida", "Jazan", "Jumbilla", "Recta", "San Carlos", "Shipasbamba", "Valera", "Yambrasbamba"],
    "Chachapoyas": ["Asuncion", "Balsas", "Chachapoyas", "Cheto", "Chiliquin", "Chuquibamba", "Granada", "Huancas", "La Jalca", "Leimebamba", "Levanto", "Magdalena", "Mariscal Castilla", "Molinopampa", "Montevideo", "Olleros", "Quinjalca", "San Francisco de Daguas", "San Isidro de Maino", "Soloco", "Sonche"],
    // ... más provincias y distritos de Amazonas
  },
  "Áncash": { 
    "Huaraz": ["Huaraz", "Independencia", "Cochabamba"],
    "Santa": ["Chimbote", "Coishco", "Nuevo Chimbote"]
    // ... más provincias y distritos de Áncash
  },
  "Apurímac": {
    "Abancay": ["Abancay", "Chacoche", "Circa", "Curahuasi", "Huanipaca", "Lambrama", "Pichirhua", "San Pedro de Cachora", "Tamburco"],
    // ... más provincias y distritos de Apurímac
  },
  "Arequipa": {
    "Arequipa": ["Alto Selva Alegre", "Arequipa", "Cayma", "Cerro Colorado", "Characato", "Chiguata", "Jacobo Hunter", "Jose Luis Bustamante Y Rivero", "La Joya", "Mariano Melgar", "Miraflores", "Mollebaya", "Paucarpata", "Pocsi", "Polobaya", "Quequeña", "Sabandia", "Sachaca", "San Juan de Siguas", "San Juan de Tarucani", "Santa Isabel de Siguas", "Santa Rita de Siguas", "Socabaya", "Tiabaya", "Uchumayo", "Vitor", "Yanahuara", "Yarabamba", "Yura"],
    // ... más provincias y distritos de Arequipa
  },
  "Ayacucho": { /* ... */ },
  "Cajamarca": { /* ... */ },
  "Callao": { /* ... */ },
  "Cusco": { /* ... */ },
  "Huancavelica": { /* ... */ },
  "Huánuco": { /* ... */ },
  "Ica": { /* ... */ },
  "Junín": { /* ... */ },
  "La Libertad": { /* ... */ },
  "Lambayeque": { /* ... */ },
  "Lima": {
    "Lima": ["Ancon", "Ate", "Barranco", "Breña", "Carabayllo", "Chaclacayo", "Chorrillos", "Cieneguilla", "Comas", "El Agustino", "Independencia", "Jesus Maria", "La Molina", "La Victoria", "Lima", "Lince", "Los Olivos", "Lurigancho", "Lurin", "Magdalena del Mar", "Miraflores", "Pachacamac", "Pucusana", "Pueblo Libre", "Puente Piedra", "Punta Hermosa", "Punta Negra", "Rimac", "San Bartolo", "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis", "San Martin de Porres", "San Miguel", "Santa Anita", "Santa Maria del Mar", "Santa Rosa", "Santiago de Surco", "Surquillo", "Villa El Salvador", "Villa Maria del Triunfo"],
    "Barranca": ["Barranca", "Paramonga", "Pativilca", "Supe", "Supe Puerto"],
    // ... más provincias de Lima
  },
  "Loreto": { /* ... */ },
  "Madre de Dios": { /* ... */ },
  "Moquegua": { /* ... */ },
  "Pasco": { /* ... */ },
  "Piura": { /* ... */ },
  "Puno": { /* ... */ },
  "San Martín": { /* ... */ },
  "Tacna": { /* ... */ },
  "Tumbes": { /* ... */ },
  "Ucayali": { /* ... */ },
};


const businessFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre comercial debe tener al menos 3 caracteres." }),
  contactEmail: z.string().email({ message: "Por favor, ingresa un email válido." }),
  ruc: z.string().length(11, "El RUC debe tener 11 dígitos.").regex(/^\d+$/, "El RUC solo debe contener números.").optional().or(z.literal("")),
  razonSocial: z.string().min(3, "La razón social debe tener al menos 3 caracteres.").optional().or(z.literal("")),
  department: z.string().min(1, "Departamento es requerido."),
  province: z.string().min(1, "Provincia es requerida."),
  district: z.string().min(1, "Distrito es requerido."),
  address: z.string().min(5, "La dirección debe tener al menos 5 caracteres.").optional().or(z.literal("")),
  managerName: z.string().min(3, "Nombre del gerente es requerido.").optional().or(z.literal("")),
  managerDni: z.string().min(8, "DNI/CE del gerente debe tener al menos 8 caracteres.").max(15, "DNI/CE del gerente no debe exceder 15 caracteres.").regex(/^\d+$/, "DNI/CE del gerente solo debe contener números.").optional().or(z.literal("")),
  businessType: z.enum(BUSINESS_TYPES, { required_error: "Debes seleccionar un giro de negocio." }),
});

type BusinessFormValues = z.infer<typeof businessFormSchema>;

interface BusinessFormProps {
  business?: Business;
  onSubmit: (data: BusinessFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BusinessForm({ business, onSubmit, onCancel, isSubmitting = false }: BusinessFormProps) {
  const [selectedDepartment, setSelectedDepartment] = useState(business?.department || "");
  const [provinces, setProvinces] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState(business?.province || "");
  const [districts, setDistricts] = useState<string[]>([]);
  
  const departments = Object.keys(peruLocations);

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
      businessType: business?.businessType || undefined,
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
        businessType: business.businessType || undefined,
      });
      setSelectedDepartment(business.department || "");
      // For edit, if province and district are already set, populate them
      if (business.department && peruLocations[business.department as keyof typeof peruLocations]) {
        setProvinces(Object.keys(peruLocations[business.department as keyof typeof peruLocations]));
      }
      setSelectedProvince(business.province || "");
       if (business.department && business.province && peruLocations[business.department as keyof typeof peruLocations]?.[business.province as keyof typeof peruLocations[keyof typeof peruLocations]]) {
        setDistricts(peruLocations[business.department as keyof typeof peruLocations][business.province as keyof typeof peruLocations[keyof typeof peruLocations]] || []);
      }
    }
  }, [business, form]);

  useEffect(() => {
    if (selectedDepartment && peruLocations[selectedDepartment as keyof typeof peruLocations]) {
      const currentProvinces = Object.keys(peruLocations[selectedDepartment as keyof typeof peruLocations]);
      setProvinces(currentProvinces);
      // If the current form province isn't in the new list of provinces, reset it
      if (!currentProvinces.includes(form.getValues("province"))) {
         form.setValue("province", "");
         form.setValue("district", "");
         setSelectedProvince("");
         setDistricts([]);
      }
    } else {
      setProvinces([]);
      form.setValue("province", "");
      form.setValue("district", "");
      setSelectedProvince("");
      setDistricts([]);
    }
  }, [selectedDepartment, form]);

  useEffect(() => {
    if (selectedDepartment && selectedProvince && peruLocations[selectedDepartment as keyof typeof peruLocations]?.[selectedProvince as keyof typeof peruLocations[keyof typeof peruLocations]]) {
       const currentDistricts = peruLocations[selectedDepartment as keyof typeof peruLocations][selectedProvince as keyof typeof peruLocations[keyof typeof peruLocations]] || [];
      setDistricts(currentDistricts);
       // If the current form district isn't in the new list of districts, reset it
      if (!currentDistricts.includes(form.getValues("district"))) {
         form.setValue("district", "");
      }
    } else {
      setDistricts([]);
      form.setValue("district", "");
    }
  }, [selectedDepartment, selectedProvince, form]);

  const handleSubmit = (values: BusinessFormValues) => {
    onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre Comercial <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Ej: Pandora Lounge Bar" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="razonSocial"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Razón Social <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Nombre legal de la empresa" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ruc"
          render={({ field }) => (
            <FormItem>
              <FormLabel>RUC <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="12345678901" {...field} maxLength={11} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="businessType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Giro de Negocio <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un giro" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BUSINESS_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Departamento <span className="text-destructive">*</span></FormLabel>
                <Select
                    onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedDepartment(value);
                    // Reset province and district when department changes
                    form.setValue("province", "");
                    form.setValue("district", "");
                    setSelectedProvince("");
                    setDistricts([]);
                    }}
                    value={field.value}
                    disabled={isSubmitting}
                >
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger></FormControl>
                    <SelectContent>
                    {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="province"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Provincia <span className="text-destructive">*</span></FormLabel>
                <Select
                    onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedProvince(value);
                    // Reset district when province changes
                    form.setValue("district", "");
                    }}
                    value={field.value}
                    disabled={isSubmitting || !selectedDepartment || provinces.length === 0}
                >
                    <FormControl><SelectTrigger><SelectValue placeholder={!selectedDepartment ? "Selecciona Dept." : "Selecciona"} /></SelectTrigger></FormControl>
                    <SelectContent>
                    {provinces.map(prov => <SelectItem key={prov} value={prov}>{prov}</SelectItem>)}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="district"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Distrito <span className="text-destructive">*</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || !selectedProvince || districts.length === 0}>
                    <FormControl><SelectTrigger><SelectValue placeholder={!selectedProvince ? "Selecciona Prov." : "Selecciona"} /></SelectTrigger></FormControl>
                    <SelectContent>
                    {districts.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección del Negocio <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Ej: Av. Principal 123, Urb. Las Flores" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contactEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email de Contacto del Negocio <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input type="email" placeholder="Ej: contacto@negocio.com" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="managerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Gerente General <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Nombre completo del gerente" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="managerDni"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DNI/CE del Gerente General <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="DNI o Carnet de Extranjería" {...field} maxLength={15} disabled={isSubmitting} />
              </FormControl>
              <FormDescription>Puede ser un usuario existente de la plataforma.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {business ? "Guardar Cambios" : "Crear Negocio"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
