
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QrClient } from "@/lib/types"; 
import { format, getMonth, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { ListChecks, Download, Search, Gift, Loader2, Filter, Cake, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MESES_DEL_ANO_ES } from "@/lib/constants";
import * as ExcelJS from "exceljs";

export default function AdminQrClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [birthdayMonthFilter, setBirthdayMonthFilter] = useState<string>("all");
  const [registrationMonthFilter, setRegistrationMonthFilter] = useState<string>("all");
  const [qrClients, setQrClients] = useState<QrClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);


  const fetchQrClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "qrClients"));
      const fetchedClients: QrClient[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        
        const toSafeISOString = (dateValue: any): string | null => {
            if (!dateValue) return null;
            if (dateValue instanceof Timestamp) return dateValue.toDate().toISOString();
            if (dateValue instanceof Date) return dateValue.toISOString();
            if (typeof dateValue === 'string') {
              const parsedDate = new Date(dateValue);
              return isValid(parsedDate) ? parsedDate.toISOString() : null;
            }
            return null;
        };

        return {
          id: docSnap.id,
          name: data.name,
          surname: data.surname,
          dni: data.dni,
          phone: data.phone,
          dob: toSafeISOString(data.dob),
          registrationDate: toSafeISOString(data.registrationDate),
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

  const filteredClients = useMemo(() => qrClients.filter(client => {
    const searchMatch = (
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.dni.includes(searchTerm)
    );

    const birthdayMatch = birthdayMonthFilter === "all" ||
      (client.dob && typeof client.dob === 'string' && getMonth(parseISO(client.dob)) === parseInt(birthdayMonthFilter));

    const registrationMatch = registrationMonthFilter === "all" ||
      (client.registrationDate && typeof client.registrationDate === 'string' && getMonth(parseISO(client.registrationDate)) === parseInt(registrationMonthFilter));
      
    return searchMatch && birthdayMatch && registrationMatch;
  }), [qrClients, searchTerm, birthdayMonthFilter, registrationMonthFilter]);

  const totalPages = Math.ceil(filteredClients.length / rowsPerPage);
  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredClients.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredClients, currentPage, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, birthdayMonthFilter, registrationMonthFilter, rowsPerPage]);


  const handleExport = async () => {
    if (filteredClients.length === 0) {
      toast({ title: "Sin Datos", description: "No hay clientes QR para exportar.", variant: "destructive" });
      return;
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Clientes QR");

    const headers = ["Nombres", "Apellidos", "DNI/CE", "Teléfono", "Fecha Nac.", "Fecha Registro"];
    
    // Añadir encabezado y aplicar estilo
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell, colNumber) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF5D2A8E' } // Morado oscuro
        };
        cell.font = {
            bold: true,
            color: { argb: 'FFFFFFFF' } // Blanco
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Añadir datos y aplicar estilo a las celdas
    filteredClients.forEach(client => {
        const rowData = [
          client.name,
          client.surname,
          client.dni,
          client.phone || "N/A",
          client.dob && typeof client.dob === 'string' ? format(parseISO(client.dob), "dd/MM/yyyy") : "N/A",
          client.registrationDate && typeof client.registrationDate === 'string' ? format(parseISO(client.registrationDate), "dd/MM/yyyy HH:mm") : "N/A",
        ];
        const row = worksheet.addRow(rowData);
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });

    // Ajustar ancho de columnas
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

    // Generar y descargar el archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "SocioVip_Clientes_QR.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Exportación Exitosa", description: "Se ha descargado el archivo de Excel." });
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3 mb-6">
          <ListChecks className="h-8 w-8 text-primary" />
          Clientes QR
        </h1>
        <Button onClick={handleExport} variant="outline" disabled={isLoading || qrClients.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Exportar a Excel
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
          <div className="text-sm text-muted-foreground pt-4">
            Mostrando <span className="font-semibold text-foreground">{paginatedClients.length}</span> de <span className="font-semibold text-foreground">{filteredClients.length}</span> clientes totales.
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
                    <TableHead>#</TableHead>
                    <TableHead>Nombres y Apellidos</TableHead>
                    <TableHead className="hidden md:table-cell">DNI/CE</TableHead>
                    <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                    <TableHead><Gift className="inline-block h-4 w-4 mr-1 text-muted-foreground" />Fecha Nac.</TableHead>
                    <TableHead>Fecha Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedClients.length > 0 ? (
                    paginatedClients.map((client, index) => (
                      <TableRow key={client.id}>
                        <TableCell className="text-muted-foreground">{((currentPage - 1) * rowsPerPage) + index + 1}</TableCell>
                        <TableCell>{client.name} {client.surname}</TableCell>
                        <TableCell className="hidden md:table-cell">{client.dni}</TableCell>
                        <TableCell className="hidden lg:table-cell">{client.phone}</TableCell>
                        <TableCell>{client.dob && typeof client.dob === 'string' ? format(parseISO(client.dob), "P", { locale: es }) : "N/A"}</TableCell>
                        <TableCell>{client.registrationDate && typeof client.registrationDate === 'string' ? format(parseISO(client.registrationDate), "P p", { locale: es }) : "N/A"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">No se encontraron clientes QR con los filtros aplicados.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
         {totalPages > 1 && (
            <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t">
            <div className="flex items-center space-x-2 text-sm">
                <Label htmlFor="rows-per-page-clients">Filas por página:</Label>
                <Select
                value={`${rowsPerPage}`}
                onValueChange={(value) => setRowsPerPage(Number(value))}
                >
                <SelectTrigger id="rows-per-page-clients" className="h-8 w-[70px]">
                    <SelectValue placeholder={rowsPerPage} />
                </SelectTrigger>
                <SelectContent>
                    {[10, 25, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
            </div>
            <div className="flex items-center space-x-2">
                <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                >
                Anterior
                </Button>
                <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                >
                Siguiente
                </Button>
            </div>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
