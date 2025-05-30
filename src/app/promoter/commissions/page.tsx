
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Download, Info, Calendar as CalendarIcon, Filter as FilterIcon, Building as BuildingIcon } from "lucide-react"; // Added icons
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import type { PromoterCommissionEntry, BusinessManagedEntity, Business } from "@/lib/types"; // Assuming PromoterCommissionEntry and Business types
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";


// Mockup data - this would be replaced by actual data fetching and calculation
const MOCK_COMMISSION_ENTRIES: PromoterCommissionEntry[] = [
  // { id: "comm1", businessName: "Pandora Lounge", entityName: "Jueves de Alitas BBQ", entityType: "promotion", promoterCodesRedeemed: 10, commissionRateApplied: "S/ 0.50 por código", commissionEarned: 5.00, paymentStatus: "Pendiente", period: "Mayo 2025", entityId: "bp1", promoterId: "promoter1" },
  // { id: "comm2", businessName: "El Rincón Criollo", entityName: "Menú Ejecutivo Semanal", entityType: "promotion", promoterCodesRedeemed: 25, commissionRateApplied: "8% sobre venta", commissionEarned: 40.00, paymentStatus: "Pagado", period: "Mayo 2025", entityId: "promoXYZ", promoterId: "promoter1" },
  // { id: "comm3", businessName: "Pandora Lounge", entityName: "Noche de Karaoke Estelar", entityType: "event", promoterCodesRedeemed: 5, commissionRateApplied: "S/ 2.00 por entrada", commissionEarned: 10.00, paymentStatus: "Pendiente", period: "Abril 2025", entityId: "evt1", promoterId: "promoter1"},
];


export default function PromoterCommissionsPage() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(subMonths(new Date(), 1)), // Default to last month
    to: endOfMonth(subMonths(new Date(), 1)),
  });
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("all");

  const [availableBusinesses, setAvailableBusinesses] = useState<Business[]>([]);
  const [availableEntities, setAvailableEntities] = useState<BusinessManagedEntity[]>([]);
  const [commissionData, setCommissionData] = useState<PromoterCommissionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch businesses the promoter is linked to
    const fetchPromoterData = async () => {
      if (!userProfile?.uid) return;
      setIsLoading(true);

      try {
        // 1. Get BusinessPromoterLinks for this promoter
        const linksQuery = query(collection(db, "businessPromoterLinks"), where("platformUserUid", "==", userProfile.uid), where("isActive", "==", true));
        const linksSnap = await getDocs(linksQuery);
        const businessIds = linksSnap.docs.map(doc => doc.data().businessId);

        if (businessIds.length > 0) {
          // 2. Fetch details for these businesses
          const businessesQuery = query(collection(db, "businesses"), where("__name__", "in", businessIds));
          const businessesSnap = await getDocs(businessesQuery);
          const businesses = businessesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
          setAvailableBusinesses(businesses);

          // 3. Fetch entities for these businesses where promoter is assigned
          const entitiesQuery = query(collection(db, "businessEntities"), where("businessId", "in", businessIds), where("isActive", "==", true));
          const entitiesSnap = await getDocs(entitiesQuery);
          const entities = entitiesSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as BusinessManagedEntity))
            .filter(entity => entity.assignedPromoters?.some(ap => ap.promoterProfileId === userProfile.uid));
          setAvailableEntities(entities);
        } else {
          setAvailableBusinesses([]);
          setAvailableEntities([]);
        }
      } catch (error) {
        console.error("Error fetching promoter data for commission filters:", error);
        toast({ title: "Error", description: "No se pudieron cargar los filtros.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPromoterData();
  }, [userProfile, toast]);


  const filteredCommissions = useMemo(() => {
    // TODO: Implement actual data fetching and filtering from Firestore based on dateRange, selectedBusinessId, selectedEntityId
    // For now, it will use MOCK_COMMISSION_ENTRIES or be empty.
    // This calculation would be complex and backend-driven in a real app.
    return MOCK_COMMISSION_ENTRIES.filter(comm => {
        const date = startOfMonth(new Date(comm.period.split(" ")[1], MESES_DEL_ANO_ES.indexOf(comm.period.split(" ")[0])));
        const matchesDate = !dateRange || !dateRange.from || !dateRange.to || (date >= dateRange.from && date <= dateRange.to);
        const matchesBusiness = selectedBusinessId === "all" || comm.businessId === selectedBusinessId; // Assuming PromoterCommissionEntry has businessId
        const matchesEntity = selectedEntityId === "all" || comm.entityId === selectedEntityId;
        return matchesDate && matchesBusiness && matchesEntity;
    });
  }, [dateRange, selectedBusinessId, selectedEntityId]);

  const totalCommissions = useMemo(() => {
    return filteredCommissions.reduce((sum, comm) => sum + comm.commissionEarned, 0);
  }, [filteredCommissions]);

  const handleExport = () => {
    if (filteredCommissions.length === 0) {
      toast({ title: "Sin Datos", description: "No hay comisiones para exportar con los filtros actuales.", variant: "default" });
      return;
    }
    // CSV Export Logic
    const headers = ["ID", "Negocio", "Promoción/Evento", "Tipo", "Códigos Canjeados (Promotor)", "Tasa Aplicada", "Comisión Ganada (S/)", "Estado Pago", "Periodo"];
    const rows = filteredCommissions.map(c => [
      c.id, c.businessName, c.entityName, c.entityType, c.promoterCodesRedeemed, c.commissionRateApplied, c.commissionEarned.toFixed(2), c.paymentStatus, c.period
    ]);
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `mis_comisiones_${userProfile?.name?.replace(/\s+/g, '_') || 'promotor'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exportación Exitosa", description: "Comisiones exportadas a CSV." });
  };
  
  const MESES_DEL_ANO_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <DollarSign className="h-8 w-8 mr-2" /> Mis Comisiones
      </h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Detalle de Comisiones</CardTitle>
          <CardDescription>
             Funcionalidad Próximamente. Estamos trabajando para traerte un detalle completo de tus comisiones.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px] flex flex-col items-center justify-center text-center p-6">
            <Info className="h-16 w-16 text-primary/70 mb-4" />
            <p className="text-muted-foreground mt-2 max-w-md">
                Pronto podrás filtrar por fecha, negocio, promoción/evento y ver tus pagos.
            </p>
        </CardContent>
         <CardFooter className="flex justify-end pt-4 border-t">
             <Button variant="outline" onClick={handleExport} disabled>
                <Download className="mr-2 h-4 w-4" /> Exportar (Próximamente)
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

    