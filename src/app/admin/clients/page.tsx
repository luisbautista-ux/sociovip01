
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RegisteredClient } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ListChecks, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Mock Data
const mockRegisteredClients: RegisteredClient[] = [
  { id: "user123", name: "Ana", surname: "García", phone: "+51987654321", dob: "1990-05-15", dni: "12345678", registrationDate: "2024-07-01T10:00:00Z", lastPromotionTitle: "Martes de 2x1 en Cocktails" },
  { id: "user456", name: "Carlos", surname: "Pérez", phone: "+51912345678", dob: "1985-11-20", dni: "87654321", registrationDate: "2024-07-02T11:30:00Z", lastPromotionTitle: "Sábado VIP: Entrada Gratuita" },
  { id: "user789", name: "Luisa", surname: "Martinez", phone: "+51998877665", dob: "1995-02-10", dni: "11223344", registrationDate: "2024-07-03T14:15:00Z", lastPromotionTitle: "Noche de Salsa: Mojito Gratis" },
  { id: "user101", name: "Jorge", surname: "Rodriguez", phone: "+51965432109", dob: "1988-08-25", dni: "44332211", registrationDate: "2024-07-04T09:00:00Z", lastPromotionTitle: "Martes de 2x1 en Cocktails" },
  { id: "user112", name: "Sofia", surname: "Lopez", phone: "+51955555555", dob: "2000-12-01", dni: "55667788", registrationDate: "2024-07-05T16:45:00Z", lastPromotionTitle: "Sábado VIP: Entrada Gratuita" },
];

export default function AdminClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = mockRegisteredClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.dni.includes(searchTerm)
  );

  const handleExport = () => {
    // Basic CSV export logic
    const headers = ["ID", "Nombres", "Apellidos", "DNI/CE", "Teléfono", "Fecha Nac.", "Fecha Registro", "Última Promo"];
    const rows = filteredClients.map(client => [
      client.id,
      client.name,
      client.surname,
      client.dni,
      client.phone,
      format(new Date(client.dob), "dd/MM/yyyy", { locale: es }),
      format(new Date(client.registrationDate), "dd/MM/yyyy HH:mm", { locale: es }),
      client.lastPromotionTitle || "N/A"
    ]);

    let csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sociovip_clientes_qr.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <ListChecks className="h-8 w-8 mr-2" /> Clientes Registrados para QR
        </h1>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>Clientes que han generado al menos un código QR.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre, apellido o DNI..."
              className="pl-8 w-full sm:w-[300px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombres</TableHead>
                <TableHead>Apellidos</TableHead>
                <TableHead className="hidden md:table-cell">DNI/CE</TableHead>
                <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                <TableHead>Fecha Registro</TableHead>
                <TableHead>Última Promo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>{client.name}</TableCell>
                    <TableCell>{client.surname}</TableCell>
                    <TableCell className="hidden md:table-cell">{client.dni}</TableCell>
                    <TableCell className="hidden lg:table-cell">{client.phone}</TableCell>
                    <TableCell>{format(new Date(client.registrationDate), "P p", { locale: es })}</TableCell>
                    <TableCell>{client.lastPromotionTitle || "N/A"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">No se encontraron clientes.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
