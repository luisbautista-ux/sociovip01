
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QrClient } from "@/lib/types"; // Changed from RegisteredClient
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ListChecks, Download, Search, Gift } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Mock Data for QrClient
const mockQrClients: QrClient[] = [
  { id: "user123", name: "Ana", surname: "García", phone: "+51987654321", dob: "1990-05-15", dni: "12345678", registrationDate: "2024-07-01T10:00:00Z" },
  { id: "user456", name: "Carlos", surname: "Pérez", phone: "+51912345678", dob: "1985-11-20", dni: "87654321", registrationDate: "2024-07-02T11:30:00Z" },
  { id: "user789", name: "Luisa", surname: "Martinez", phone: "+51998877665", dob: "1995-02-10", dni: "11223344", registrationDate: "2024-07-03T14:15:00Z" },
  { id: "user101", name: "Jorge", surname: "Rodriguez", phone: "+51965432109", dob: "1988-08-25", dni: "44332211", registrationDate: "2024-07-04T09:00:00Z" },
  { id: "user112", name: "Sofia", surname: "Lopez", phone: "+51955555555", dob: "2000-12-01", dni: "55667788", registrationDate: "2024-07-05T16:45:00Z" },
];

export default function AdminQrClientsPage() { // Renamed page function for clarity
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = mockQrClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.dni.includes(searchTerm)
  );

  const handleExport = () => {
    const headers = ["ID", "Nombres", "Apellidos", "DNI/CE", "Teléfono", "Fecha Nac.", "Fecha Registro"];
    const rows = filteredClients.map(client => [
      client.id,
      client.name,
      client.surname,
      client.dni,
      client.phone,
      format(new Date(client.dob), "dd/MM/yyyy", { locale: es }),
      format(new Date(client.registrationDate), "dd/MM/yyyy HH:mm", { locale: es }),
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
          <ListChecks className="h-8 w-8 mr-2" /> Clientes de Códigos Promocionales
        </h1>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Lista de Clientes QR</CardTitle>
          <CardDescription>Clientes que han generado al menos un código QR promocional.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre, apellido, DNI..."
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
                <TableHead>Nombres y Apellidos</TableHead>
                <TableHead className="hidden md:table-cell">DNI/CE</TableHead>
                <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                <TableHead><Gift className="inline-block h-4 w-4 mr-1 text-muted-foreground" />Fecha Nac.</TableHead>
                <TableHead>Fecha Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>{client.name} {client.surname}</TableCell>
                    <TableCell className="hidden md:table-cell">{client.dni}</TableCell>
                    <TableCell className="hidden lg:table-cell">{client.phone}</TableCell>
                    <TableCell>{format(new Date(client.dob), "P", { locale: es })}</TableCell>
                    <TableCell>{format(new Date(client.registrationDate), "P p", { locale: es })}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">No se encontraron clientes QR.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
