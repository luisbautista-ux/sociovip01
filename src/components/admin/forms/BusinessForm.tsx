
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
import { BUSINESS_TYPES } from "@/lib/types"; // Import business types
import { useState, useEffect } from "react";

// Mock data for Peruvian locations - In a real app, this would come from an API or a larger static file
const peruLocations = {
  "Amazonas": {
    "Bagua": ["Aramango", "Bagua", "Copallin", "El Parco", "Imaza", "La Peca"],
    "Bongará": ["Chisquilla", "Churuja", "Corosha", "Cuispes", "Florida", "Jazan", "Jumbilla", "Recta", "San Carlos", "Shipasbamba", "Valera", "Yambrasbamba"],
    "Chachapoyas": ["Asuncion", "Balsas", "Chachapoyas", "Cheto", "Chiliquin", "Chuquibamba", "Granada", "Huancas", "La Jalca", "Leimebamba", "Levanto", "Magdalena", "Mariscal Castilla", "Molinopampa", "Montevideo", "Olleros", "Quinjalca", "San Francisco de Daguas", "San Isidro de Maino", "Soloco", "Sonche"],
    "Condorcanqui": ["El Cenepa", "Nieva", "Rio Santiago"],
    "Luya": ["Camporredondo", "Cocabamba", "Colcamar", "Conila", "Inguilpata", "Lamud", "Longuita", "Lonya Chico", "Luya", "Luya Viejo", "Maria", "Ocalli", "Ocumal", "Pisuquia", "Providencia", "San Cristobal", "San Francisco del Yeso", "San Jeronimo", "San Juan de Lopecancha", "Santa Catalina", "Santo Tomas", "Tingo", "Trita"],
    "Rodríguez de Mendoza": ["Chirimoto", "Cochamal", "Huambo", "Limabamba", "Longar", "Mariscal Benavides", "Milpuc", "Omia", "San Nicolas", "Santa Rosa", "Totora", "Vista Alegre"],
    "Utcubamba": ["Bagua Grande", "Cajaruro", "Cumba", "El Milagro", "Jamalca", "Lonya Grande", "Yamon"]
  },
  "Áncash": { // Placeholder, add real provinces and districts
    "Huaraz": ["Huaraz", "Independencia", "Cochabamba"],
    "Santa": ["Chimbote", "Coishco", "Nuevo Chimbote"]
  },
  "Apurímac": {
    "Abancay": ["Abancay", "Chacoche", "Circa", "Curahuasi", "Huanipaca", "Lambrama", "Pichirhua", "San Pedro de Cachora", "Tamburco"],
  },
  "Arequipa": {
    "Arequipa": ["Alto Selva Alegre", "Arequipa", "Cayma", "Cerro Colorado", "Characato", "Chiguata", "Jacobo Hunter", "Jose Luis Bustamante Y Rivero", "La Joya", "Mariano Melgar", "Miraflores", "Mollebaya", "Paucarpata", "Pocsi", "Polobaya", "Quequeña", "Sabandia", "Sachaca", "San Juan de Siguas", "San Juan de Tarucani", "Santa Isabel de Siguas", "Santa Rita de Siguas", "Socabaya", "Tiabaya", "Uchumayo", "Vitor", "Yanahuara", "Yarabamba", "Yura"],
    "Camaná": ["Camana", "Jose Maria Quimper", "Mariano Nicolas Valcarcel", "Mariscal Caceres", "Nicolas de Pierola", "Ocoña", "Quilca", "Samuel Pastor"],
    "Caravelí": ["Acari", "Atico", "Atiquipa", "Bella Union", "Cahuacho", "Caraveli", "Chala", "Chaparra", "Huanuhuanu", "Jaqui", "Lomas", "Quicacha", "Yauca"],
    "Castilla": ["Andagua", "Aplao", "Ayo", "Chachas", "Chilcaymarca", "Choco", "Huancarqui", "Machaguay", "Orcopampa", "Pampacolca", "Tipan", "Uñon", "Uraca", "Viraco"],
    "Caylloma": ["Achoma", "Cabanaconde", "Callalli", "Caylloma", "Chivay", "Coporaque", "Huambo", "Huanca", "Ichupampa", "Lari", "Lluta", "Maca", "Madrigal", "Majes", "San Antonio de Chuca", "Sibayo", "Tapay", "Tisco", "Tuti", "Yanque"],
    "Condesuyos": ["Andaray", "Cayarani", "Chichas", "Chuquibamba", "Iray", "Rio Grande", "Salamanca", "Yanaquihua"],
    "Islay": ["Cocachacra", "Dean Valdivia", "Islay", "Mejia", "Mollendo", "Punta de Bombon"],
    "La Unión": ["Alca", "Charcana", "Cotahuasi", "Huaynacotas", "Pampamarca", "Puyca", "Quechualla", "Sayla", "Tauria", "Tomepampa", "Toro"]
  },
  "Lima": {
    "Lima": ["Ancon", "Ate", "Barranco", "Breña", "Carabayllo", "Chaclacayo", "Chorrillos", "Cieneguilla", "Comas", "El Agustino", "Independencia", "Jesus Maria", "La Molina", "La Victoria", "Lima", "Lince", "Los Olivos", "Lurigancho", "Lurin", "Magdalena del Mar", "Miraflores", "Pachacamac", "Pucusana", "Pueblo Libre", "Puente Piedra", "Punta Hermosa", "Punta Negra", "Rimac", "San Bartolo", "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis", "San Martin de Porres", "San Miguel", "Santa Anita", "Santa Maria del Mar", "Santa Rosa", "Santiago de Surco", "Surquillo", "Villa El Salvador", "Villa Maria del Triunfo"],
    "Barranca": ["Barranca", "Paramonga", "Pativilca", "Supe", "Supe Puerto"],
    "Cajatambo": ["Cajatambo", "Copa", "Gorgor", "Huancapon", "Manas"],
    "Canta": ["Arahuay", "Canta", "Huamantanga", "Huaros", "Lachaqui", "San Buenaventura", "Santa Rosa de Quives"],
    "Cañete": ["Asia", "Calango", "Cerro Azul", "Chilca", "Coayllo", "Imperial", "Lunahuana", "Mala", "Nuevo Imperial", "Pacaran", "Quilmana", "San Antonio", "San Luis", "San Vicente de Cañete", "Santa Cruz de Flores", "Zuñiga"],
    "Huaral": ["Atavillos Alto", "Atavillos Bajo", "Aucallama", "Chancay", "Huaral", "Ihuari", "Lampian", "Pacaraos", "San Miguel de Acos", "Santa Cruz de Andamarca", "Sumbilca", "Veintisiete de Noviembre"],
    "Huarochirí": ["Antioquia", "Callahuanca", "Carampoma", "Chicla", "Cuenca", "Huanza", "Huarochiri", "Lahuaytambo", "Langa", "Laraos", "Mariatana", "Matucana", "Ricardo Palma", "San Andres de Tupicocha", "San Antonio", "San Bartolome", "San Damian", "San Juan de Iris", "San Juan de Tantaranche", "San Lorenzo de Quinti", "San Mateo", "San Mateo de Otao", "San Pedro de Casta", "San Pedro de Huancayre", "Sangallaya", "Santa Cruz de Cocachacra", "Santa Eulalia", "Santiago de Anchucaya", "Santiago de Tuna", "Santo Domingo de Los Olleros", "San Jeronimo de Surco", "Huachupampa"],
    "Huaura": ["Ambar", "Caleta de Carquin", "Checras", "Huacho", "Hualmay", "Huaura", "Leoncio Prado", "Paccho", "Santa Leonor", "Santa Maria", "Sayan", "Vegueta"],
    "Oyón": ["Andajes", "Caujul", "Cochamarca", "Navan", "Oyon", "Pachangara"],
    "Yauyos": ["Alis", "Ayauca", "Ayaviri", "Azangaro", "Cacra", "Carania", "Catahuasi", "Chocos", "Cochas", "Colonia", "Hongos", "Huampara", "Huancaya", "Huangascar", "Huantan", "Huañec", "Laraos", "Lincha", "Madean", "Miraflores", "Omas", "Putinza", "Quinches", "Quinocay", "San Joaquin", "San Pedro de Pilas", "Tanta", "Tauripampa", "Tomas", "Tupe", "Viñac", "Vitis", "Yauyos"]
  }
  // Add more departments and their provinces/districts as needed
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
  managerDni: z.string().length(8, "El DNI del gerente debe tener 8 dígitos.").regex(/^\d+$/, "El DNI solo debe contener números.").optional().or(z.literal("")),
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
      setSelectedProvince(business.province || "");
    }
  }, [business, form]);

  useEffect(() => {
    if (selectedDepartment && peruLocations[selectedDepartment as keyof typeof peruLocations]) {
      setProvinces(Object.keys(peruLocations[selectedDepartment as keyof typeof peruLocations]));
      if (form.getValues("department") !== selectedDepartment) { // If department changed by user interaction
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
      setDistricts(peruLocations[selectedDepartment as keyof typeof peruLocations][selectedProvince as keyof typeof peruLocations[keyof typeof peruLocations]] || []);
       if (form.getValues("province") !== selectedProvince) { // If province changed by user interaction
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
              <FormLabel>DNI del Gerente General <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="12345678" {...field} maxLength={8} disabled={isSubmitting} />
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
