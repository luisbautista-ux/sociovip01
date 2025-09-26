
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Download, Info, Loader2, Calendar, Briefcase, Hash, BadgeCent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { BusinessPromoterLinkWithCommissions, Business } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { anyToDate } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function PromoterCommissionsPage() {
  const { toast } = useToast();
  const { userProfile, currentUser } = useAuth();
  
  const [commissionData, setCommissionData] = useState<BusinessPromoterLinkWithCommissions[]>([]);
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
      const data: BusinessPromoterLinkWithCommissions[] = await response.json();
      setCommissionData(data);

      if (data.length > 0) {
        const businessIds = [...new Set(data.map(link => link.businessId))];
        if (businessIds.length > 0) {
          const businessesQuery = query(collection(db, "businesses"), where("__name__", "in", businessIds));
          const businessesSnap = await getDocs(businessesQuery);
          const businessesData = businessesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
          setBusinesses(businessesData);
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
    if (selectedBusinessId === 'all') {
      return commissionData;
    }
    return commissionData.filter(comm => comm.businessId === selectedBusinessId);
  }, [commissionData, selectedBusinessId]);

  const totalPending = useMemo(() => {
    return filteredCommissions.reduce((sum, comm) => sum + comm.pendingAmount, 0);
  }, [filteredCommissions]);

  const totalPaid = useMemo(() => {
    return filteredCommissions.reduce((sum, comm) => sum + comm.paidAmount, 0);
  }, [filteredCommissions]);

  const handleExport = () => {
    const dataToExport = filteredCommissions;
    if (dataToExport.length === 0) {
      toast({ title: "Sin Datos", description: "No hay comisiones para exportar con el filtro actual.", variant: "default" });
      return;
    }
    const headers = ["Negocio", "Monto Pendiente (S/)", "Monto Pagado (S/)"];
    const rows = dataToExport.map(c => [
      c.promoterName, // Corregido para mostrar el nombre del promotor
      c.pendingAmount.toFixed(2),
      c.paidAmount.toFixed(2)
    ].map(cell => `"${String(cell || '').replace(/"/g, '""')}"`));

    const csvContent = [
      headers.map(h => `"${h}"`).join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `mis_comisiones_${userProfile?.name?.replace(/\s+/g, '_') || 'promotor'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exportación Exitosa", description: "Comisiones exportadas a CSV." });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gradient flex items-center gap-2 mb-6">
        <DollarSign className="h-8 w-8 text-primary !block" /> Mis Comisiones
      </h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Resumen de Comisiones por Negocio</CardTitle>
          <CardDescription>
             Aquí se listan tus comisiones pendientes y pagadas por cada negocio al que estás vinculado.
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
            <div className="min-h-[200px] flex flex-col items-center justify-center text-center p-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground mt-4">Calculando tus comisiones...</p>
            </div>
          ) : filteredCommissions.length > 0 ? (
            <>
              {/* Vista para pantallas grandes (tabla) */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Negocio</TableHead>
                      <TableHead className="text-right">Monto Pendiente</TableHead>
                      <TableHead className="text-right">Monto Pagado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommissions.map((comm) => (
                      <TableRow key={comm.id}>
                        <TableCell className="font-medium">{businesses.find(b => b.id === comm.businessId)?.name || 'Negocio Desconocido'}</TableCell>
                        <TableCell className="text-right font-semibold text-destructive">S/ {comm.pendingAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">S/ {comm.paidAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Vista para pantallas pequeñas (tarjetas) */}
              <div className="md:hidden space-y-4">
                {filteredCommissions.map((comm) => (
                  <Card key={comm.id} className="overflow-hidden">
                    <CardHeader className="p-4">
                      <CardTitle className="text-base flex items-center">
                        <Briefcase size={16} className="mr-2"/>
                        {businesses.find(b => b.id === comm.businessId)?.name || 'Negocio Desconocido'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Pendiente de Pago</span>
                          <span className="font-semibold text-lg text-destructive">S/ {comm.pendingAmount.toFixed(2)}</span>
                       </div>
                       <Separator />
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Total Pagado</span>
                          <span className="font-semibold text-lg text-green-600">S/ {comm.paidAmount.toFixed(2)}</span>
                       </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="min-h-[200px] flex flex-col items-center justify-center text-center p-6">
              <Info className="h-16 w-16 text-primary/70 mb-4" />
              <p className="font-semibold">No se encontraron comisiones.</p>
              <p className="text-muted-foreground mt-2 max-w-md">
                Puede que no estés asignado a ningún negocio o que aún no hayas generado comisiones.
              </p>
            </div>
          )}
        </CardContent>
         <CardFooter className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t gap-4">
             <div className="text-lg font-bold text-center sm:text-left">
                <p>Total Pendiente: <span className="text-destructive">S/ {totalPending.toFixed(2)}</span></p>
                <p>Total Pagado: <span className="text-green-600">S/ {totalPaid.toFixed(2)}</span></p>
             </div>
             <Button variant="outline" onClick={handleExport} disabled={filteredCommissions.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Exportar Resumen
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
