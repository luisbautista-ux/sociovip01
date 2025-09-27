

'use client';

import { useEffect, useMemo, useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Contact, Crown, Download, Search, Calendar as CalendarIcon, Users, Cake, Phone, User as UserIcon } from "lucide-react";
import { format, parse, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import * as ExcelJS from "exceljs";

/* ===================== Helpers de fecha (aceptan Timestamp/Date/string/number) ===================== */
function anyToDate(value: any): Date | null {
  if (!value) return null;

  // Date nativa
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  // Firestore: objetos con toDate()
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  // Firestore: objetos { seconds, nanoseconds }
  if (typeof value?.seconds === "number") {
    const ms = value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1e6);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // Número: milisegundos epoch
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // String
  if (typeof value === "string") {
    // Soporte a dd/MM/yyyy o dd-MM-yyyy (con o sin hora)
    const m = value.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (m) {
      const norm = value.replace(/-/g, "/");
      const hasTime = !!m[4];
      const pattern = hasTime ? "dd/MM/yyyy HH:mm:ss" : "dd/MM/yyyy";
      const candidate = hasTime && norm.length === 16 ? `${norm}:00` : norm; // completa :ss si falta
      const d = parse(candidate, pattern, new Date());
      return isNaN(d.getTime()) ? null : d;
    }

    // ISO u otros formatos que Date pueda entender
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function renderDate(value: any, fmt = "P p") {
  const d = anyToDate(value);
  return d ? format(d, fmt, { locale: es }) : "N/A";
}

// Evita warnings de hidratación en Next (fecha se calcula 100% en el cliente)
const ClientSideFormattedDateTime = ({ value, fmt = "P p" }: { value: any; fmt?: string }) => {
  const [text, setText] = useState<string>("...");
  useEffect(() => { setText(renderDate(value, fmt)); }, [value, fmt]);
  return <>{text}</>;
};

/* ===================== Tipos mínimos locales ===================== */

type QrClient = {
  id: string;
  name: string;
  surname: string;
  phone?: string | number;
  dni: string;
  registrationDate: any; // Timestamp/Date/string/number
  dob: any; // Fecha de Nacimiento
  associatedBusinessIds?: string[]; // Nuevo campo
  generatedForBusinessId?: string; // Campo antiguo
};

export default function BusinessClientsPage() {
  const { userProfile } = useAuth(); // debe proveer roles[] y businessId
  const { toast } = useToast();

  const [qrClients, setQrClients] = useState<QrClient[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);

  const isSuperAdmin = !!userProfile?.roles?.includes?.("superadmin");

  useEffect(() => {
    const load = async () => {
      if (!userProfile) return;
      if (!isSuperAdmin && !userProfile.businessId) return;

      setLoading(true);
      try {
        const qrRef = collection(db, "qrClients");
        
        // Superadmin gets all clients without filtering
        if (isSuperAdmin) {
            const allClientsSnap = await getDocs(qrRef);
            const allClients = allClientsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as QrClient[];
            setQrClients(allClients);
            return; // Termina la función para superadmin
        }
        
        // Business admin logic with two queries
        const businessId = userProfile.businessId;
        if (!businessId) {
          setQrClients([]);
          return;
        }

        // Query 1: For new data model (array contains)
        const newModelQuery = query(qrRef, where("associatedBusinessIds", "array-contains", businessId));
        
        // Query 2: For old data model (single ID)
        const oldModelQuery = query(qrRef, where("generatedForBusinessId", "==", businessId));

        const [newClientsSnap, oldClientsSnap] = await Promise.all([
            getDocs(newModelQuery),
            getDocs(oldModelQuery),
        ]);
        
        const clientsMap = new Map<string, QrClient>();

        newClientsSnap.forEach(d => {
            if (!clientsMap.has(d.id)) {
                clientsMap.set(d.id, { id: d.id, ...(d.data() as any) });
            }
        });
        
        oldClientsSnap.forEach(d => {
            if (!clientsMap.has(d.id)) {
                clientsMap.set(d.id, { id: d.id, ...(d.data() as any) });
            }
        });

        const combinedClients = Array.from(clientsMap.values());
        setQrClients(combinedClients);

      } catch (e: any) {
        console.error("Error cargando clientes:", e?.code, e?.message);
        toast({
          title: "Error al cargar clientes",
          description: e?.message ?? "No se pudieron obtener los datos. Revisa las reglas de seguridad.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userProfile, isSuperAdmin, toast]);
  
  const filteredClients = useMemo(() => {
    return qrClients.filter((c) => {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = `${c.name} ${c.surname}`.toLowerCase().includes(searchLower);
      const dniMatch = (c.dni ?? "").toLowerCase().includes(searchLower);
      const phoneMatch = String(c.phone ?? "").includes(searchTerm);
      
      const searchFilter = nameMatch || dniMatch || phoneMatch;

      if (!filterDate) {
        return searchFilter;
      }
      
      const regDate = anyToDate(c.registrationDate);
      if (!regDate) return false;

      const interval = {
        start: startOfDay(filterDate),
        end: endOfDay(filterDate),
      };

      return searchFilter && isWithinInterval(regDate, interval);
    });
  }, [searchTerm, filterDate, qrClients]);

  const handleExport = async () => {
    if (filteredClients.length === 0) {
      toast({
        title: "Sin Datos",
        description: "No hay clientes para exportar con los filtros actuales.",
        variant: "destructive",
      });
      return;
    }
  
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Clientes QR");

    const headers = [
      "Nombres", "Apellidos", "DNI/CE", "Teléfono", "Fecha Nac.", "Fecha Registro",
    ];
    
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF5D2A8E' } 
        };
        cell.font = {
            bold: true,
            color: { argb: 'FFFFFFFF' }
        };
        cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
    });

    filteredClients.forEach(client => {
        const rowData = [
          client.name,
          client.surname,
          client.dni,
          client.phone || "N/A",
          renderDate(client.dob, "P"),
          renderDate(client.registrationDate, "P p"),
        ];
        const row = worksheet.addRow(rowData);
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        });
    });

    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SocioVip_Clientes_QR_${userProfile?.businessId ?? 'negocio'}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Exportación Exitosa", description: "Se ha descargado el archivo de Excel." });
  };

  if (loading) return <p>Cargando clientes…</p>;

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-primary flex items-center self-start">
          <Contact className="h-8 w-8 mr-2" /> Mis Clientes
        </h1>
        <div className="self-end sm:self-center">
            <Button onClick={handleExport} variant="gradient">
              <Download className="mr-2 h-4 w-4" /> Exportar Excel
            </Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Listado de Clientes QR</CardTitle>
          <CardDescription>
            {isSuperAdmin ? "Visualizando clientes de todos los negocios." : "Visualizando todos los clientes que han generado un QR para tu negocio."}
          </CardDescription>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre, DNI, teléfono..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
             <div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filterDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterDate ? format(filterDate, "PPP", { locale: es }) : <span>Filtrar por fecha de registro</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filterDate}
                    onSelect={setFilterDate}
                    initialFocus
                    locale={es}
                  />
                  {filterDate && <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => setFilterDate(undefined)}>Limpiar filtro</Button>}
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="text-sm text-muted-foreground pt-4">
              Mostrando <span className="font-semibold text-foreground">{filteredClients.length}</span> de <span className="font-semibold text-foreground">{qrClients.length}</span> clientes totales.
          </div>
        </CardHeader>

        <CardContent>
          {/* Mobile View */}
          <div className="md:hidden space-y-4">
            {filteredClients.length > 0 ? (
                filteredClients.map((c) => (
                  <Card key={c.id} className="overflow-hidden">
                     <CardHeader className="p-4">
                       <CardTitle className="text-lg">{c.name} {c.surname}</CardTitle>
                     </CardHeader>
                     <CardContent className="p-4 space-y-3 text-sm">
                       <div className="flex justify-between">
                         <span className="text-muted-foreground flex items-center"><Cake className="mr-1.5 h-4 w-4" /> Fecha Nac.</span>
                         <span className="font-medium"><ClientSideFormattedDateTime value={c.dob} fmt="P" /></span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-muted-foreground flex items-center"><UserIcon className="mr-1.5 h-4 w-4" /> DNI/CE</span>
                         <span className="font-semibold">{c.dni}</span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-muted-foreground flex items-center"><Phone className="mr-1.5 h-4 w-4" /> Celular</span>
                         <span className="font-medium">{c.phone || "N/A"}</span>
                       </div>
                     </CardContent>
                  </Card>
                ))
            ) : (
                <div className="text-center h-24 flex items-center justify-center">
                    <p>No se encontraron clientes.</p>
                </div>
            )}
          </div>
          
          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Completo</TableHead>
                  <TableHead className="hidden md:table-cell">DNI/CE</TableHead>
                  <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                  <TableHead><Cake className="inline-block h-4 w-4 mr-1 text-muted-foreground" />Fecha Nac.</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length > 0 ? (
                  filteredClients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.name} {c.surname}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{c.dni}</TableCell>
                      <TableCell className="hidden lg:table-cell">{c.phone || "N/A"}</TableCell>
                      <TableCell>
                        <ClientSideFormattedDateTime value={c.dob} fmt="P" />
                      </TableCell>
                      <TableCell>
                        <Badge variant={"secondary"}>
                          Cliente QR
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ClientSideFormattedDateTime value={c.registrationDate} fmt="P p" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      No se encontraron clientes con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
