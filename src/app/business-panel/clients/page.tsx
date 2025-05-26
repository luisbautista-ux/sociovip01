
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Contact, Crown, Download, Search } from "lucide-react";
import type { QrClient, SocioVipMember, BusinessClientView, BusinessClientType } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

// Mock data - In a real app, this would be fetched for the current business
const mockBusinessId = "biz1"; // Assuming Pandora Lounge Bar

const mockBusinessQrClients: QrClient[] = [
  { id: "qrclient-biz1-1", name: "Pedro", surname: "Ramirez", phone: "+51912345670", dob: "1992-03-10T12:00:00", dni: "11122233", registrationDate: "2025-01-15T10:00:00Z" },
  { id: "qrclient-biz1-2", name: "Sofia", surname: "Vargas", phone: "+51909876543", dob: "1988-07-22T12:00:00", dni: "44455566", registrationDate: "2025-02-20T11:30:00Z" },
];

const mockBusinessSocioVipMembers: SocioVipMember[] = [ 
  { id: "vip1", name: "Elena", surname: "Rodriguez", email: "elena.vip@example.com", phone: "+51999888777", dob: "1988-03-12T12:00:00", dni: "26789012", loyaltyPoints: 1500, membershipStatus: "active", joinDate: "2023-01-20T12:00:00Z", address: "Av. El Sol 456, Cusco", profession: "Arquitecta", preferences: ["Viajes", "Fotografía", "Comida Gourmet"], staticQrCodeUrl: "https://placehold.co/100x100.png?text=ELENAQR" },
  { id: "vip3", name: "Isabel", surname: "Flores", email: "isabel.vip@example.com", phone: "+51955666777", dob: "1992-07-22T12:00:00", dni: "34567890", loyaltyPoints: 2200, membershipStatus: "pending_payment", joinDate: "2025-06-01T12:00:00Z", preferences: ["Yoga", "Lectura"] },
];

const membershipStatusTranslations: Record<SocioVipMember['membershipStatus'], string> = {
  active: "Activa",
  inactive: "Inactiva",
  pending_payment: "Pendiente Pago",
  cancelled: "Cancelada",
};

// Helper component to format date/time on client side
const ClientSideFormattedDateTime = ({ dateString }: { dateString: string }) => {
  const [formattedDate, setFormattedDate] = useState<string | null>(null);

  useEffect(() => {
    setFormattedDate(format(new Date(dateString), "P p", { locale: es }));
  }, [dateString]);

  return <>{formattedDate || "..."}</>; // Show '...' or null/empty string while loading
};


export default function BusinessClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<BusinessClientType | "all">("all");
  const { toast } = useToast();

  const combinedClients = useMemo((): BusinessClientView[] => {
    const qrClientViews: BusinessClientView[] = mockBusinessQrClients.map(qc => ({
      id: qc.id,
      clientType: 'qr',
      name: qc.name,
      surname: qc.surname,
      dni: qc.dni,
      phone: qc.phone,
      email: undefined, 
      relevantDate: qc.registrationDate,
      isVip: false,
    }));

    const socioVipViews: BusinessClientView[] = mockBusinessSocioVipMembers.map(svm => ({
      id: svm.id,
      clientType: 'vip',
      name: svm.name,
      surname: svm.surname,
      dni: svm.dni,
      phone: svm.phone,
      email: svm.email,
      relevantDate: svm.joinDate,
      isVip: true,
      loyaltyPoints: svm.loyaltyPoints,
      membershipStatus: svm.membershipStatus,
    }));
    return [...qrClientViews, ...socioVipViews].sort((a,b) => new Date(b.relevantDate).getTime() - new Date(a.relevantDate).getTime());
  }, []);

  const filteredClients = useMemo(() => {
    return combinedClients.filter(client => {
      const typeMatch = filterType === "all" || client.clientType === filterType;
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = `${client.name} ${client.surname}`.toLowerCase().includes(searchLower);
      const dniMatch = client.dni.toLowerCase().includes(searchLower);
      const emailMatch = client.email?.toLowerCase().includes(searchLower) || false;
      const phoneMatch = client.phone?.includes(searchTerm) || false;
      
      return typeMatch && (nameMatch || dniMatch || emailMatch || phoneMatch);
    });
  }, [searchTerm, filterType, combinedClients]);

  const handleExportCsv = () => {
    if (filteredClients.length === 0) {
      toast({ title: "Sin Datos", description: "No hay clientes para exportar con los filtros actuales.", variant: "destructive" });
      return;
    }
    const headers = ["ID", "Tipo Cliente", "Nombres", "Apellidos", "DNI/CE", "Teléfono", "Email", "Fecha Registro/Ingreso", "Puntos (VIP)", "Estado Membresía (VIP)"];
    const rows = filteredClients.map(client => [
      client.id,
      client.clientType === 'qr' ? "Cliente QR" : "Socio VIP",
      client.name,
      client.surname,
      client.dni,
      client.phone || "N/A",
      client.email || "N/A",
      format(new Date(client.relevantDate), "P p", { locale: es }), // CSV can use consistent formatting
      client.isVip ? client.loyaltyPoints?.toString() || "0" : "N/A",
      client.isVip ? (client.membershipStatus ? membershipStatusTranslations[client.membershipStatus] : "N/A") : "N/A",
    ]);

    let csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mis_clientes_${mockBusinessId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exportación Exitosa", description: `${filteredClients.length} clientes exportados.` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Contact className="h-8 w-8 mr-2" /> Mis Clientes
        </h1>
        <Button onClick={handleExportCsv} variant="outline">
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Listado de Clientes</CardTitle>
          <CardDescription>Clientes QR y Socios VIP asociados a tu negocio.</CardDescription>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre, DNI, email, teléfono..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={(value) => setFilterType(value as BusinessClientType | "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Clientes</SelectItem>
                <SelectItem value="qr">Clientes QR</SelectItem>
                <SelectItem value="vip">Socios VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre Completo</TableHead>
                <TableHead className="hidden md:table-cell">DNI/CE</TableHead>
                <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                <TableHead className="hidden xl:table-cell">Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fecha Reg./Ingreso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name} {client.surname}</TableCell>
                    <TableCell className="hidden md:table-cell">{client.dni}</TableCell>
                    <TableCell className="hidden lg:table-cell">{client.phone || "N/A"}</TableCell>
                    <TableCell className="hidden xl:table-cell">{client.email || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={client.isVip ? "default" : "secondary"} className={client.isVip ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}>
                        {client.isVip && <Crown className="mr-1 h-3.5 w-3.5" />}
                        {client.clientType === 'qr' ? "Cliente QR" : "Socio VIP"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ClientSideFormattedDateTime dateString={client.relevantDate} />
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
        </CardContent>
      </Card>
    </div>
  );
}
