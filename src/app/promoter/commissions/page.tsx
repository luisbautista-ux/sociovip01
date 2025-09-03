
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Download, Info, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PromoterCommissionEntry, BusinessManagedEntity, Business, GeneratedCode } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { anyToDate } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function PromoterCommissionsPage() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  
  const [commissionData, setCommissionData] = useState<PromoterCommissionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('all');

  const calculateCommissions = useCallback(async () => {
    if (!userProfile?.uid || !userProfile.businessIds || userProfile.businessIds.length === 0) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    try {
        const businessIds = userProfile.businessIds;
        
        const businessesQuery = query(collection(db, "businesses"), where("__name__", "in", businessIds));
        const businessesSnap = await getDocs(businessesQuery);
        const businessesMap = new Map(businessesSnap.docs.map(doc => [doc.id, doc.data() as Business]));
        const businessesData = Array.from(businessesMap.values()).map(b => ({...b, id: Array.from(businessesMap.keys())[Array.from(businessesMap.values()).indexOf(b)]}));
        setBusinesses(businessesData);

        const entitiesQuery = query(
            collection(db, "businessEntities"),
            where("businessId", "in", businessIds)
        );
        const entitiesSnap = await getDocs(entitiesQuery);

        const calculatedCommissions: PromoterCommissionEntry[] = [];
        
        entitiesSnap.docs.forEach(doc => {
            const entity = { id: doc.id, ...doc.data() } as BusinessManagedEntity;
            const businessName = businessesMap.get(entity.businessId)?.name || "Negocio Desconocido";
            
            const promoterAssignment = entity.assignedPromoters?.find(p => p.promoterProfileId === userProfile.uid);
            
            // Un promotor ahora puede generar códigos para CUALQUIER entidad del negocio al que está asignado,
            // no necesariamente tiene que estar en "assignedPromoters" de la entidad
            const promoterGeneratedCodes = (entity.generatedCodes || []).filter(c => c.generatedByUid === userProfile.uid);
            const promoterUsedCodes = promoterGeneratedCodes.filter(c => c.status === 'used');

            if (promoterUsedCodes.length === 0) return;

            let totalEarned = 0;
            let appliedRateDescription = "Regla general del negocio"; // Default

            if (promoterAssignment && promoterAssignment.commissionRules && promoterAssignment.commissionRules.length > 0) {
                const firstRule = promoterAssignment.commissionRules[0];
                appliedRateDescription = firstRule.commissionType === 'fixed'
                    ? `S/ ${firstRule.commissionValue.toFixed(2)} por uso`
                    : `${firstRule.commissionValue}% por uso`;
                
                promoterUsedCodes.forEach(code => {
                    if (firstRule.commissionType === 'fixed') {
                        totalEarned += firstRule.commissionValue;
                    }
                    // Percentage logic is complex without sale value, placeholder
                });
            }
            
            calculatedCommissions.push({
                id: `${entity.id}-${userProfile.uid}`,
                businessName: businessName,
                businessId: entity.businessId,
                entityName: entity.name,
                entityType: entity.type,
                promoterCodesRedeemed: promoterUsedCodes.length,
                commissionRateApplied: appliedRateDescription,
                commissionEarned: totalEarned,
                paymentStatus: "Pendiente",
                period: format(anyToDate(entity.endDate)!, "MMMM yyyy", { locale: es }),
                entityId: entity.id,
                promoterId: userProfile.uid,
            });
        });
        
        setCommissionData(calculatedCommissions);
    } catch (error: any) {
        console.error("Error calculating commissions:", error);
        toast({ title: "Error", description: `No se pudieron calcular las comisiones: ${error.message}`, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [userProfile, toast]);

  useEffect(() => {
    calculateCommissions();
  }, [calculateCommissions]);

  const filteredCommissions = useMemo(() => {
    if (selectedBusinessId === 'all') {
      return commissionData;
    }
    return commissionData.filter(comm => comm.businessId === selectedBusinessId);
  }, [commissionData, selectedBusinessId]);

  const totalCommissions = useMemo(() => {
    return filteredCommissions.reduce((sum, comm) => sum + comm.commissionEarned, 0);
  }, [filteredCommissions]);

  const handleExport = () => {
    const dataToExport = filteredCommissions;
    if (dataToExport.length === 0) {
      toast({ title: "Sin Datos", description: "No hay comisiones para exportar con el filtro actual.", variant: "default" });
      return;
    }
    const headers = ["Periodo", "Negocio", "Promoción/Evento", "Códigos Usados", "Tasa Aplicada", "Comisión Ganada (S/)", "Estado"];
    const rows = dataToExport.map(c => [
      c.period, c.businessName, c.entityName, c.promoterCodesRedeemed, c.commissionRateApplied, c.commissionEarned.toFixed(2), c.paymentStatus
    ].map(cell => `"${String(cell).replace(/"/g, '""')}"`));
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `mis_comisiones_${userProfile?.name?.replace(/\s+/g, '_') || 'promotor'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exportación Exitosa", description: "Comisiones exportadas a CSV." });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <DollarSign className="h-8 w-8 mr-2" /> Mis Comisiones
      </h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Detalle de Comisiones Ganadas</CardTitle>
          <CardDescription>
             Aquí se listan las comisiones generadas por los códigos que creaste y que los clientes utilizaron en la puerta.
          </CardDescription>
          <div className="pt-4">
              <Label htmlFor="business-filter">Filtrar por Negocio</Label>
              <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                  <SelectTrigger id="business-filter" className="w-full sm:w-[300px]">
                      <SelectValue placeholder="Selecciona un negocio" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">Todos los Negocios</SelectItem>
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
              <p className="text-muted-foreground mt-4">Calculando comisiones...</p>
            </div>
          ) : filteredCommissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Promoción/Evento</TableHead>
                  <TableHead className="text-center">Códigos Usados</TableHead>
                  <TableHead className="text-right">Comisión (S/)</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommissions.map((comm) => (
                  <TableRow key={comm.id}>
                    <TableCell>{comm.period}</TableCell>
                    <TableCell className="font-medium">{comm.businessName}</TableCell>
                    <TableCell>{comm.entityName}</TableCell>
                    <TableCell className="text-center font-semibold">{comm.promoterCodesRedeemed}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{comm.commissionEarned.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                        <Badge variant={comm.paymentStatus === 'Pagado' ? 'default' : 'secondary'}>
                            {comm.paymentStatus}
                        </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="min-h-[200px] flex flex-col items-center justify-center text-center p-6">
              <Info className="h-16 w-16 text-primary/70 mb-4" />
              <p className="font-semibold">{selectedBusinessId === 'all' ? 'Aún no has generado comisiones.' : 'No hay comisiones para este negocio.'}</p>
              <p className="text-muted-foreground mt-2 max-w-md">
                Tus comisiones aparecerán aquí cuando los clientes usen los códigos QR generados con tus códigos de promotor.
              </p>
            </div>
          )}
        </CardContent>
         <CardFooter className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t gap-4">
             <div className="text-lg font-bold">
                Total Ganado (filtrado): <span className="text-primary">S/ {totalCommissions.toFixed(2)}</span>
             </div>
             <Button variant="outline" onClick={handleExport} disabled={filteredCommissions.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Exportar a CSV
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
