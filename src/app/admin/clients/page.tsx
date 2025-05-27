
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QrClient } from "@/lib/types"; 
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ListChecks, Download, Search, Gift, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const apiClient = {
  getQrClients: async (): Promise<QrClient[]> => {
    console.log("API CALL: apiClient.getQrClients");
    await new Promise(resolve => setTimeout(resolve, 1000));
    // return [
    //   { id: "user123", name: "Ana (API)", surname: "García", phone: "+51987654321", dob: "1990-05-15T12:00:00", dni: "12345678", registrationDate: "2024-07-01T10:00:00Z" },
    // ];
    return [];
  },
};

export default function AdminQrClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [qrClients, setQrClients] = useState<QrClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchQrClients = async () => {
    setIsLoading(true);
    try {
      const fetchedClients = await apiClient.getQrClients();
      setQrClients(fetchedClients);
    } catch (error) {
      console.error("Failed to fetch QR clients:", error);
      toast({
        title: "Error al Cargar Clientes QR",
        description: "No se pudieron obtener los datos. Intenta de nuevo.",
        variant: "destructive",
      });
      setQrClients([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQrClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredClients = qrClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.dni.includes(searchTerm)
  );

  const handleExport = () => {
     if (filteredClients.length === 0) {
      toast({ title: "Sin Datos", description: "No hay clientes QR para exportar.", variant: "destructive" });
      return;
    }
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
        <Button onClick={handleExport} variant="outline" disabled={isLoading || qrClients.length === 0}>
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
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-60">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-muted-foreground">Cargando clientes QR...</p>
            </div>
          ) : filteredClients.length === 0 && !searchTerm ? (
             <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
              No hay clientes QR registrados.
            </p>
          ) : (
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
                    <TableCell colSpan={5} className="text-center h-24">No se encontraron clientes QR con los filtros aplicados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    