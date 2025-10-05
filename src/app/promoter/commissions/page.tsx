

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Download, Info, Loader2, Calendar, Briefcase, Hash, BadgeCent, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PromoterCommissionEntry, Business } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import * as ExcelJS from "exceljs";

export default function PromoterCommissionsPage() {
  const { toast } = useToast();
  const { userProfile, currentUser } = useAuth();
  
  const [commissionData, setCommissionData] = useState<PromoterCommissionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('all');

  const fetchCommissions = useCallback(async () => {
    if (!userProfile?.uid || !currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/business-panel/get-commissions-summary', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudieron obtener las comisiones.');
      }
      const data: PromoterCommissionEntry[] = await response.json();
      setCommissionData(data);

      if (data.length > 0) {
        const businessIds = [...new Set(data.map(comm => comm.businessId))];
        if (businessIds.length > 0) {
          const businessesQuery = query(collection(db, "businesses"), where("__name__", "in", businessIds));
          const businessesSnap = await getDocs(businessesQuery);
          setBusinesses(businessesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business)));
        }
      }

    } catch (error: any) {
        console.error("Error fetching commissions for promoter:", error);
        toast({ title: "Error", description: `No se pudieron cargar tus comisiones: ${error.message}`, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [userProfile, currentUser, toast]);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  const filteredCommissions = useMemo(() => {
    if (selectedBusinessId === 'all') return commissionData;
    return commissionData.filter(comm => comm.businessId === selectedBusinessId);
  }, [commissionData, selectedBusinessId]);

  const totalPending = useMemo(() => {
    return filteredCommissions.reduce((sum, comm) => sum + comm.commissionPending, 0);
  }, [filteredCommissions]);

  const totalPaid = useMemo(() => {
    return filteredCommissions.reduce((sum, comm) => sum + comm.commissionPaid, 0);
  }, [filteredCommissions]);

  const handleExport = async () => {
    if (filteredCommissions.length === 0) {
      toast({ title: "Sin Datos", description: "No hay comisiones para exportar con el filtro actual." });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Mis Comisiones");

    const headers = ["Negocio", "Campaña", "QRs Validados", "Tarifa Comisión", "Monto Pendiente (S/)", "Monto Pagado (S/)"];
    
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF5D2A8E' } // Purple color
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });
    
    filteredCommissions.forEach(c => {
      const row = worksheet.addRow([
        c.businessName,
        c.entityName,
        c.promoterCodesRedeemed,
        c.commissionRateApplied,
        c.commissionPending,
        c.commissionPaid
      ]);
      row.getCell(5).numFmt = '"S/" #,##0.00';
      row.getCell(6).numFmt = '"S/" #,##0.00';
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });
    });

    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 10 ? 12 : maxLength + 4;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `mis_comisiones_${userProfile?.name?.replace(/\s+/g, '_') || 'promotor'}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exportación Exitosa", description: "Comisiones exportadas a Excel." });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gradient flex items-center gap-2 mb-6">
        <DollarSign className="h-8 w-8 text-primary !block" /> Mis Comisiones
      </h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Detalle de comisiones</CardTitle>
          <CardDescription>
             Aquí se listan tus comisiones pendientes y pagadas por cada campaña en la que participaste.
          </CardDescription>
          <div className="pt-4">
              <Label htmlFor="business-filter">Filtrar por Negocio</Label>
              <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId} disabled={isLoading}>
                  <SelectTrigger id="business-filter" className="w-full sm:w-[300px]">
                      <SelectValue placeholder="Selecciona un negocio" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">Todos mis Negocios</SelectItem>
                      {businesses.map(biz => (
                          <SelectItem key={biz.id} value={biz.id}>{biz.name}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="min-h-[200px] flex items-center justify-center p-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {filteredCommissions.length > 0 ? (
                  filteredCommissions.map((comm) => (
                    <Card key={comm.id} className="overflow-hidden">
                      <CardHeader className="p-4">
                        <CardTitle className="text-base flex items-center">
                            {comm.entityType === 'event' ? <Calendar size={14} className="mr-2"/> : <Ticket size={14} className="mr-2"/>}
                            {comm.entityName}
                        </CardTitle>
                        <CardDescription className="text-xs">{comm.businessName}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="font-semibold text-muted-foreground">QRs Validados</div>
                        <div className="text-right">{comm.promoterCodesRedeemed}</div>
                        <div className="font-semibold text-muted-foreground">Tarifa</div>
                        <div className="text-right">{comm.commissionRateApplied}</div>
                        <div className="font-semibold text-muted-foreground">Pendiente</div>
                        <div className="text-right font-bold text-destructive">S/ {comm.commissionPending.toFixed(2)}</div>
                        <div className="font-semibold text-muted-foreground">Pagado</div>
                        <div className="text-right font-semibold text-green-600">S/ {comm.commissionPaid.toFixed(2)}</div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="min-h-[200px] flex flex-col items-center justify-center text-center p-6">
                    <Info className="h-16 w-16 text-primary/70 mb-4" />
                    <p className="font-semibold">No se encontraron comisiones.</p>
                    <p className="text-muted-foreground mt-2 max-w-md">No hay comisiones para el negocio seleccionado o aún no has generado ninguna.</p>
                  </div>
                )}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaña</TableHead>
                      <TableHead>Negocio</TableHead>
                      <TableHead className="text-center">QRs Validados</TableHead>
                      <TableHead className="text-center">Tarifa Comisión</TableHead>
                      <TableHead className="text-right">Monto Pendiente</TableHead>
                      <TableHead className="text-right">Monto Pagado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommissions.length > 0 ? (
                      filteredCommissions.map((comm) => (
                        <TableRow key={comm.id}>
                          <TableCell className="font-medium flex items-center">
                            {comm.entityType === 'event' ? <Calendar size={14} className="mr-2"/> : <Ticket size={14} className="mr-2"/>}
                            {comm.entityName}
                          </TableCell>
                          <TableCell>{comm.businessName}</TableCell>
                          <TableCell className="text-center font-semibold">{comm.promoterCodesRedeemed}</TableCell>
                          <TableCell className="text-center">{comm.commissionRateApplied}</TableCell>
                          <TableCell className="text-right font-semibold text-destructive">
                              S/ {comm.commissionPending.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">S/ {comm.commissionPaid.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No se encontraron comisiones para los filtros aplicados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
         <CardFooter className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t gap-4">
             <div className="text-lg font-bold text-center sm:text-left">
                <p>Total Pendiente: <span className="text-destructive">S/ {totalPending.toFixed(2)}</span></p>
                <p>Total Pagado: <span className="text-green-600">S/ {totalPaid.toFixed(2)}</span></p>
             </div>
             <Button variant="outline" onClick={handleExport} disabled={filteredCommissions.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Exportar Detalle
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}



    
