
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, DollarSign, Filter, Download } from "lucide-react";
import type { PromoterCommissionEntry } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Mock Data for Promoter Commissions
const mockCommissions: PromoterCommissionEntry[] = [
  { id: "comm1", businessName: "Pandora Lounge Bar", entityName: "Jueves de Alitas BBQ", entityType: "promotion", codesRedeemedByPromoter: 15, commissionRate: "S/ 0.50 por código", commissionEarned: 7.50, paymentStatus: "Pendiente", period: "Julio 2024" },
  { id: "comm2", businessName: "Pandora Lounge Bar", entityName: "Noche de Karaoke Estelar", entityType: "event", codesRedeemedByPromoter: 5, commissionRate: "S/ 1.00 por asistente", commissionEarned: 5.00, paymentStatus: "Pagado", period: "Julio 2024" },
  { id: "comm3", businessName: "El Rincón Bohemio", entityName: "2x1 en Pisco Sours", entityType: "promotion", codesRedeemedByPromoter: 20, commissionRate: "S/ 0.75 por código", commissionEarned: 15.00, paymentStatus: "Pendiente", period: "Agosto 2024" },
];

// Mock data for filters
const mockBusinessesFilter = [
    {id: "biz1", name: "Pandora Lounge Bar"},
    {id: "biz2", name: "El Rincón Bohemio"},
];
const mockEntitiesFilter = [ // Should be dynamically populated based on selected business
    {id: "promo1", name: "Jueves de Alitas BBQ"},
    {id: "event1", name: "Noche de Karaoke Estelar"},
    {id: "promo2", name: "2x1 en Pisco Sours"},
];


export default function PromoterCommissionsPage() {
  const [commissions, setCommissions] = useState<PromoterCommissionEntry[]>(mockCommissions);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [selectedBusiness, setSelectedBusiness] = useState<string | undefined>(undefined);
  const [selectedEntity, setSelectedEntity] = useState<string | undefined>(undefined);

  // In a real app, filtering would re-fetch data or apply client-side filters
  const filteredCommissions = commissions.filter(comm => {
    // Basic filtering example, needs more robust logic for dates and selections
    let matches = true;
    if (selectedBusiness && !comm.businessName.toLowerCase().includes(selectedBusiness.toLowerCase())) matches = false;
    if (selectedEntity && !comm.entityName.toLowerCase().includes(selectedEntity.toLowerCase())) matches = false;
    // Date range filtering would be more complex here
    return matches;
  });
  
  const handleExport = () => {
    // CSV Export logic here
    const headers = ["ID", "Negocio", "Promoción/Evento", "Tipo", "Códigos Canjeados", "Tasa Comisión", "Comisión Ganada", "Estado Pago", "Periodo"];
    const rows = filteredCommissions.map(c => [
      c.id, c.businessName, c.entityName, c.entityType, c.codesRedeemedByPromoter, c.commissionRate, c.commissionEarned.toFixed(2), c.paymentStatus, c.period
    ]);
    let csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "mis_comisiones_sociovip.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <DollarSign className="h-8 w-8 mr-2" /> Mis Comisiones
      </h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Filtros de Comisiones</CardTitle>
          <CardDescription>Filtra tus comisiones por fecha, negocio o promoción/evento.</CardDescription>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y", {locale: es})} - {format(dateRange.to, "LLL dd, y", {locale: es})}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y", {locale: es})
                    )
                  ) : (
                    <span>Selecciona rango de fechas</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
            <Select onValueChange={setSelectedBusiness} value={selectedBusiness}>
                <SelectTrigger>
                    <SelectValue placeholder="Todos los Negocios" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los Negocios</SelectItem>
                    {mockBusinessesFilter.map(biz => (
                        <SelectItem key={biz.id} value={biz.name}>{biz.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select onValueChange={setSelectedEntity} value={selectedEntity} disabled={!selectedBusiness || selectedBusiness === 'all'}>
                 <SelectTrigger>
                    <SelectValue placeholder="Todas las Promociones/Eventos" />
                </SelectTrigger>
                <SelectContent>
                     <SelectItem value="all">Todas las Promociones/Eventos</SelectItem>
                    {/* Populate dynamically based on selectedBusiness */}
                    {mockEntitiesFilter.map(ent => (
                         <SelectItem key={ent.id} value={ent.name}>{ent.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCommissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden lg:table-cell">Periodo</TableHead>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Promoción/Evento</TableHead>
                  <TableHead className="text-center">Códigos Canjeados</TableHead>
                  <TableHead className="hidden md:table-cell">Tasa</TableHead>
                  <TableHead className="text-right">Comisión Ganada</TableHead>
                  <TableHead className="text-center">Estado Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommissions.map((comm) => (
                  <TableRow key={comm.id}>
                    <TableCell className="hidden lg:table-cell">{comm.period}</TableCell>
                    <TableCell className="font-medium">{comm.businessName}</TableCell>
                    <TableCell>{comm.entityName}</TableCell>
                    <TableCell className="text-center">{comm.codesRedeemedByPromoter}</TableCell>
                    <TableCell className="hidden md:table-cell">{comm.commissionRate}</TableCell>
                    <TableCell className="text-right font-semibold">S/ {comm.commissionEarned.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                        <Badge variant={comm.paymentStatus === 'Pagado' ? 'default' : 'secondary'}
                               className={comm.paymentStatus === 'Pagado' ? 'bg-green-500 hover:bg-green-600' : ''}>
                            {comm.paymentStatus}
                        </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-10">No se encontraron comisiones con los filtros aplicados.</p>
          )}
        </CardContent>
         <CardFooter className="justify-end">
            <p className="text-lg font-bold">Total Comisiones (Filtradas): S/ {filteredCommissions.reduce((sum, comm) => sum + comm.commissionEarned, 0).toFixed(2)}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
