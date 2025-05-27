
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QrClient } from "@/lib/types"; 
import { format, getMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ListChecks, Download, Search, Gift, Loader2, Filter, Cake, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MESES_DEL_ANO_ES } from "@/lib/constants";

export default function AdminQrClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [birthdayMonthFilter, setBirthdayMonthFilter] = useState<string>("all");
  const [registrationMonthFilter, setRegistrationMonthFilter] = useState<string>("all");
  const [qrClients, setQrClients] = useState<QrClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchQrClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "qrClients"));
      const fetchedClients: QrClient[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name,
          surname: data.surname,
          dni: data.dni,
          phone: data.phone,
          dob: data.dob instanceof Timestamp ? data.dob.toDate().toISOString() : data.dob as string,
          registrationDate: data.registrationDate instanceof Timestamp ? data.registrationDate.toDate().toISOString() : data.registrationDate as string,
        };
      });
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
  }, [toast]);

  useEffect(() => {
    fetchQrClients();
  }, [fetchQrClients]);

  const filteredClients = qrClients.filter(client => {
    const searchMatch = (
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.dni.includes(searchTerm)
    );

    const birthdayMatch = birthdayMonthFilter === "all" ||
      (client.dob && getMonth(parseISO(client.dob)) === parseInt(birthdayMonthFilter));

    const registrationMatch = registrationMonthFilter === "all" ||
      (client.registrationDate && getMonth(parseISO(client.registrationDate)) === parseInt(registrationMonthFilter));
      
    return searchMatch && birthdayMatch && registrationMatch;
  });

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
      client.dob ? format(parseISO(client.dob), "dd/MM/yyyy", { locale: es }) : 'N/A',
      client.registrationDate ? format(parseISO(client.registrationDate), "dd/MM/yyyy HH:mm", { locale: es }) : 'N/A',
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 items-end">
            <div className="relative">
              <Label htmlFor="search-clients-qr">Buscar Cliente QR</Label>
              <Search className="absolute left-2.5 top-[calc(1.75rem+0.625rem)] h-4 w-4 text-muted-foreground" />
              <Input
                id="search-clients-qr"
                type="search"
                placeholder="Buscar por nombre, apellido, DNI..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="birthday-month-filter-qr">
                <Cake className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>
                Filtrar por Mes de Cumpleaños
              </Label>
              <Select value={birthdayMonthFilter} onValueChange={setBirthdayMonthFilter} disabled={isLoading}>
                <SelectTrigger id="birthday-month-filter-qr">
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {MESES_DEL_ANO_ES.map((mes, index) => (
                    <SelectItem key={index} value={index.toString()}>{mes}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="registration-month-filter-qr">
                <CalendarDays className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>
                Filtrar por Mes de Registro
              </Label>
              <Select value={registrationMonthFilter} onValueChange={setRegistrationMonthFilter} disabled={isLoading}>
                <SelectTrigger id="registration-month-filter-qr">
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {MESES_DEL_ANO_ES.map((mes, index) => (
                    <SelectItem key={index} value={index.toString()}>{mes}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-60">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-muted-foreground">Cargando clientes QR...</p>
            </div>
          ) : qrClients.length === 0 && !searchTerm && birthdayMonthFilter === 'all' && registrationMonthFilter === 'all' ? (
             <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
              No hay clientes QR registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
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
                        <TableCell>{client.dob ? format(parseISO(client.dob), "P", { locale: es }) : "N/A"}</TableCell>
                        <TableCell>{client.registrationDate ? format(parseISO(client.registrationDate), "P p", { locale: es }) : "N/A"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">No se encontraron clientes QR con los filtros aplicados.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    
