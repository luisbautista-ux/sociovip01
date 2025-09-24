
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
import type { PromoterCommissionEntry, Business } from "@/lib/types";
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
        
        // This logic is now centralized. We just need to call the right endpoint.
        // For the promoter, we need to get data for ALL their businesses.
        // We will make one call for each businessId.
        
        const businessIds = userProfile.businessIds || [];
        if (businessIds.length === 0) {
            setCommissionData([]);
            setIsLoading(false);
            return;
        }

        const businessesQuery = query(collection(db, "businesses"), where("__name__", "in", businessIds));
        const businessesSnap = await getDocs(businessesQuery);
        const businessesData = businessesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
        setBusinesses(businessesData);
        
        const allCommissions: PromoterCommissionEntry[] = [];
        const entitiesQuery = query(collection(db, "businessEntities"), where("businessId", "in", businessIds));
        const entitiesSnap = await getDocs(entitiesQuery);
        
        entitiesSnap.forEach(doc => {
            const entity = { id: doc.id, ...doc.data() } as BusinessManagedEntity;
            const businessName = businessesData.find(b => b.id === entity.businessId)?.name || 'Negocio Desconocido';
            const promoterCodes = (entity.generatedCodes || []).filter(c => c.generatedByUid === userProfile.uid);
            
            promoterCodes.forEach(code => {
                if (code.status === 'redeemed' || code.status === 'used') {
                     allCommissions.push({
                        id: `${entity.id}-${code.id}`,
                        businessName: businessName,
                        businessId: entity.businessId,
                        entityName: entity.name,
                        entityType: entity.type,
                        promoterCodesRedeemed: 1, // Represents one code use
                        commissionRateApplied: `S/ ${code.commissionGenerated?.toFixed(2) || '0.00'}`,
                        commissionEarned: code.commissionGenerated || 0,
                        paymentStatus: code.commissionStatus === 'paid' ? 'Pagado' : 'Pendiente',
                        period: format(anyToDate(entity.endDate)!, "MMMM yyyy", { locale: es }),
                        entityId: entity.id,
                        promoterId: userProfile.uid,
                    });
                }
            });
        });
        
        setCommissionData(allCommissions);

    } catch (error: any) {
        console.error("Error fetching promoter commissions:", error);
        toast({ title: "Error", description: `No se pudieron cargar las comisiones: ${error.message}`, variant: "destructive" });
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

  const totalCommissions = useMemo(() => {
    return filteredCommissions.reduce((sum, comm) => sum + comm.commissionEarned, 0);
  }, [filteredCommissions]);

  const handleExport = () => {
    const dataToExport = filteredCommissions;
    if (dataToExport.length === 0) {
      toast({ title: "Sin Datos", description: "No hay comisiones para exportar con el filtro actual.", variant: "default" });
      return;
    }
    const headers = ["Periodo", "Negocio", "Promoción/Evento", "Comisión Ganada (S/)", "Estado"];
    const rows = dataToExport.map(c => [
      c.period,
      c.businessName,
      c.entityName,
      c.commissionEarned.toFixed(2),
      c.paymentStatus
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
          <CardTitle>Detalle de Comisiones Ganadas</CardTitle>
          <CardDescription>
             Aquí se listan las comisiones generadas por los códigos que creaste y que los clientes utilizaron.
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
            <>
              {/* Vista para pantallas grandes (tabla) */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Negocio</TableHead>
                      <TableHead>Promoción/Evento</TableHead>
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
              </div>
              {/* Vista para pantallas pequeñas (tarjetas) */}
              <div className="md:hidden space-y-4">
                {filteredCommissions.map((comm) => (
                  <Card key={comm.id} className="overflow-hidden">
                    <CardHeader className="p-4">
                      <CardTitle className="text-base">{comm.entityName}</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground flex items-center pt-1">
                        <Briefcase size={14} className="mr-1.5"/>{comm.businessName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center"><Calendar size={14} className="mr-1.5"/> Período</span>
                          <span className="font-medium">{comm.period}</span>
                       </div>
                       <Separator />
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center"><BadgeCent size={14} className="mr-1.5"/> Comisión Ganada</span>
                          <span className="font-semibold text-lg text-green-600">S/ {comm.commissionEarned.toFixed(2)}</span>
                       </div>
                    </CardContent>
                     <CardFooter className="p-4 bg-muted/50">
                        <div className="w-full flex justify-center">
                          <Badge variant={comm.paymentStatus === 'Pagado' ? 'default' : 'secondary'}>
                            Estado: {comm.paymentStatus}
                          </Badge>
                        </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="min-h-[200px] flex flex-col items-center justify-center text-center p-6">
              <Info className="h-16 w-16 text-primary/70 mb-4" />
              <p className="font-semibold">{selectedBusinessId === 'all' ? 'Aún no has generado comisiones.' : 'No hay comisiones para este negocio.'}</p>
              <p className="text-muted-foreground mt-2 max-w-md">
                Tus comisiones aparecerán aquí cuando los clientes usen los códigos QR generados por ti.
              </p>
            </div>
          )}
        </CardContent>
         <CardFooter className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t gap-4">
             <div className="text-lg font-bold">
                Total Ganado (filtrado): <span className="text-gradient">S/ {totalCommissions.toFixed(2)}</span>
             </div>
             <Button variant="outline" onClick={handleExport} disabled={filteredCommissions.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Exportar a CSV
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
