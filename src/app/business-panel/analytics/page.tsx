
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, BarChart, Bar } from 'recharts';
import type { BusinessManagedEntity, GeneratedCode } from "@/lib/types";
import { BarChart3, Users, Loader2, Info, Ticket, Calendar, QrCode, Search, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { anyToDate, isEntityCurrentlyActivatable } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/admin/StatCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MonthlyStat {
  month: string;
  entitiesCreated: number;
  qrCodesGenerated: number;
  qrCodesUtilized: number;
}

interface SelectedEntityStats {
    id: string;
    name: string;
    codesGenerated: number;
    qrGenerated: number; 
    codesUsed: number;
}

export default function BusinessAnalyticsPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [allEntities, setAllEntities] = useState<BusinessManagedEntity[]>([]);
  const [generalStats, setGeneralStats] = useState<MonthlyStat[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState("");

  const businessId = userProfile?.businessId;

  const fetchAnalyticsData = useCallback(async () => {
    if (!businessId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const entitiesQuery = query(collection(db, "businessEntities"), where("businessId", "==", businessId));
      const entitiesSnap = await getDocs(entitiesQuery);
      
      const fetchedEntities = entitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessManagedEntity));
      
      const sortedEntities = fetchedEntities.sort((a,b) => {
        const dateA = anyToDate(a.createdAt)?.getTime() || 0;
        const dateB = anyToDate(b.createdAt)?.getTime() || 0;
        return dateB - dateA;
      });
      setAllEntities(sortedEntities);

      // --- Set default selected entity ---
      const mostRecentActiveEntity = sortedEntities.find(isEntityCurrentlyActivatable);
      if (mostRecentActiveEntity) {
        setSelectedEntityId(mostRecentActiveEntity.id);
      } else if (sortedEntities.length > 0) {
        setSelectedEntityId(sortedEntities[0].id);
      }


      // --- Process General Stats (last 6 months) ---
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
      const monthlyStats: { [key: string]: Omit<MonthlyStat, 'month'> } = {};

      for (let i = 0; i < 6; i++) {
        const monthDate = startOfMonth(subMonths(new Date(), 5 - i));
        const monthKey = format(monthDate, "yyyy-MM");
        monthlyStats[monthKey] = { entitiesCreated: 0, qrCodesGenerated: 0, qrCodesUtilized: 0 };
      }

      fetchedEntities.forEach(entity => {
        const createdAt = anyToDate(entity.createdAt);
        if (!createdAt || createdAt < sixMonthsAgo) return;

        const monthKey = format(createdAt, "yyyy-MM");
        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].entitiesCreated += 1;
          if (entity.generatedCodes && Array.isArray(entity.generatedCodes)) {
            const redeemedOrUsed = entity.generatedCodes.filter(c => c.status === 'redeemed' || c.status === 'used').length;
            monthlyStats[monthKey].qrCodesGenerated += redeemedOrUsed;
            monthlyStats[monthKey].qrCodesUtilized += entity.generatedCodes.filter(c => c.status === 'used').length;
          }
        }
      });
      
      const finalGeneralData = Object.keys(monthlyStats).map(key => ({
        month: format(new Date(key + '-02'), "MMM yy", { locale: es }),
        ...monthlyStats[key]
      })).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

      setGeneralStats(finalGeneralData);

    } catch (error: any) {
      console.error("Error fetching business analytics:", error);
      toast({ title: "Error", description: `No se pudieron cargar las analíticas: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, toast]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const selectedEntity = useMemo(() => {
    return allEntities.find(e => e.id === selectedEntityId) || null;
  }, [selectedEntityId, allEntities]);

  const selectedEntityStats = useMemo((): SelectedEntityStats | null => {
    if (!selectedEntity) return null;

    const codesGenerated = selectedEntity.generatedCodes?.length || 0;
    const qrGenerated = selectedEntity.generatedCodes?.filter(c => c.status === 'redeemed' || c.status === 'used').length || 0;
    const codesUsed = selectedEntity.generatedCodes?.filter(c => c.status === 'used').length || 0;
    
    return { id: selectedEntity.id, name: selectedEntity.name, codesGenerated, qrGenerated, codesUsed };
  }, [selectedEntity]);

  const attendanceData = useMemo(() => {
    if (!selectedEntity || !selectedEntity.generatedCodes) return [];

    const redeemedCodes = selectedEntity.generatedCodes.filter(c => c.redeemedByInfo?.dni);
    
    const data = redeemedCodes.map(code => {
        const sessionsAttendance: Record<string, string | null> = {};
        let attendedCount = 0;

        if (selectedEntity.schedules && selectedEntity.schedules.length > 0) {
            selectedEntity.schedules.forEach(session => {
                const checkIn = code.checkIns?.find(ci => ci.scheduleId === session.id);
                if (checkIn) {
                    sessionsAttendance[session.id] = format(new Date(checkIn.timestamp), "HH:mm");
                    attendedCount++;
                } else {
                    sessionsAttendance[session.id] = null;
                }
            });
        } else {
            // Caso sin sesiones: usar usedDate o el primer check-in
            const firstCheckIn = code.checkIns?.[0]?.timestamp || code.usedDate;
            sessionsAttendance['general'] = firstCheckIn ? format(new Date(firstCheckIn), "HH:mm") : null;
            if (firstCheckIn) attendedCount = 1;
        }

        return {
            dni: code.redeemedByInfo!.dni,
            name: code.redeemedByInfo!.name,
            sessions: sessionsAttendance,
            attendedCount,
            totalPossible: selectedEntity.schedules?.length || 1,
            codeValue: code.value,
            ticketType: code.ticketTypeName
        };
    });

    if (!attendanceSearchTerm) return data;
    
    const search = attendanceSearchTerm.toLowerCase();
    return data.filter(item => 
        item.name.toLowerCase().includes(search) || 
        item.dni.includes(search) ||
        (item.codeValue && item.codeValue.toLowerCase().includes(search))
    );
  }, [selectedEntity, attendanceSearchTerm]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando analíticas...</p>
      </div>
    );
  }
  
  if (!businessId) {
      return (
        <div className="flex flex-col items-center justify-center h-64 p-4 border border-dashed rounded-md">
            <CardTitle className="text-xl text-destructive font-headline">Configuración Incompleta</CardTitle>
            <CardDescription className="mt-2 text-center text-muted-foreground">
                Tu perfil de usuario no está asociado a un negocio válido. Contacta al superadministrador.
            </CardDescription>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <BarChart3 className="h-8 w-8 mr-2" /> Analíticas
      </h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl uppercase tracking-wide">Rendimiento General (Últimos 6 Meses)</CardTitle>
          <CardDescription>Tendencias en creación de campañas, y generación/uso de códigos QR.</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] p-2">
           {generalStats.length > 0 && generalStats.some(s => s.entitiesCreated > 0 || s.qrCodesGenerated > 0) ? (
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={generalStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="entitiesCreated" stroke="hsl(var(--secondary-foreground))" name="Campañas Creadas" strokeWidth={2} />
                <Line type="monotone" dataKey="qrCodesGenerated" stroke="hsl(var(--primary))" name="QR Generados" strokeWidth={2} />
                <Line type="monotone" dataKey="qrCodesUtilized" stroke="hsl(var(--accent))" name="QR Canjeados" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
           ) : (
             <div className="flex items-center justify-center h-full text-muted-foreground">
                <Info className="h-5 w-5 mr-2" /> No hay suficientes datos en los últimos 6 meses para mostrar el gráfico.
            </div>
           )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl uppercase tracking-wide">Analíticas por Promoción/Evento</CardTitle>
          <CardDescription>Selecciona una actividad para ver su detalle de rendimiento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Select onValueChange={setSelectedEntityId} value={selectedEntityId} disabled={allEntities.length === 0}>
                <SelectTrigger className="h-12 border-2">
                    <SelectValue placeholder={allEntities.length === 0 ? "No hay promociones o eventos para analizar" : "Selecciona una promoción o evento"} />
                </SelectTrigger>
                <SelectContent>
                    {allEntities.map(entity => (
                        <SelectItem key={entity.id} value={entity.id}>
                          <span className="flex items-center">{entity.type === 'event' ? <Calendar className="h-4 w-4 mr-2"/> : <Ticket className="h-4 w-4 mr-2"/>}{entity.name}</span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {selectedEntityStats ? (
                <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    <div className="md:col-span-2 h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={[selectedEntityStats]} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="name" hide />
                            <Tooltip
                               contentStyle={{ 
                                  backgroundColor: 'hsl(var(--background))', 
                                  borderColor: 'hsl(var(--border))',
                                  borderRadius: 'var(--radius)'
                              }}
                            />
                            <Legend />
                            <Bar dataKey="codesGenerated" fill="hsl(var(--secondary-foreground))" name="Códigos Creados" radius={[0, 4, 4, 0]} barSize={35} />
                            <Bar dataKey="qrGenerated" fill="hsl(var(--primary))" name="QRs Generados" radius={[0, 4, 4, 0]} barSize={35} />
                            <Bar dataKey="codesUsed" fill="hsl(var(--accent))" name="QRs Usados (en puerta)" radius={[0, 4, 4, 0]} barSize={35} />
                         </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="md:col-span-1 space-y-4">
                       <StatCard 
                          title="Códigos Creados" 
                          value={selectedEntityStats.codesGenerated} 
                          icon={Ticket} 
                          description="Total de códigos únicos para esta campaña."
                       />
                       <StatCard 
                          title="QRs Generados" 
                          value={selectedEntityStats.qrGenerated} 
                          icon={QrCode}
                          description="QRs generados por clientes."
                        />
                       <StatCard 
                          title="Asistencias" 
                          value={selectedEntityStats.codesUsed} 
                          icon={Users}
                          description="QRs validados en la puerta."
                        />
                       <StatCard 
                          title="Tasa de Canje" 
                          value={`${selectedEntityStats.qrGenerated > 0 ? ((selectedEntityStats.codesUsed / selectedEntityStats.qrGenerated) * 100).toFixed(1) : 0}%`} 
                          icon={BarChart3} 
                          description="% de QRs generados que asistieron."
                        />
                    </div>
                </div>

                <div className="pt-8 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t pt-6">
                        <div>
                            <h3 className="text-xl font-bold font-headline uppercase tracking-tight flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary"/> Reporte Detallado de Asistencia
                            </h3>
                            <p className="text-sm text-muted-foreground">Listado de clientes con entrada generada y sus horas de ingreso.</p>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por DNI o Nombre..."
                                className="pl-8"
                                value={attendanceSearchTerm}
                                onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="font-bold">Cliente</TableHead>
                                    <TableHead className="font-bold text-center">DNI/CE</TableHead>
                                    <TableHead className="font-bold text-center">Entrada</TableHead>
                                    {selectedEntity.schedules && selectedEntity.schedules.length > 0 ? (
                                        selectedEntity.schedules.map(session => (
                                            <TableHead key={session.id} className="font-bold text-center">
                                                <div className="flex flex-col items-center">
                                                    <span>{session.label}</span>
                                                    <span className="text-[10px] font-normal opacity-70">
                                                        {format(new Date(session.startDate), "dd/MM")}
                                                    </span>
                                                </div>
                                            </TableHead>
                                        ))
                                    ) : (
                                        <TableHead className="font-bold text-center">Ingreso</TableHead>
                                    )}
                                    <TableHead className="font-bold text-right">Asistencia</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {attendanceData.length > 0 ? (
                                    attendanceData.map((item, idx) => (
                                        <TableRow key={idx} className="hover:bg-muted/30">
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{item.name}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{item.codeValue}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">{item.dni}</TableCell>
                                            <TableCell className="text-center">
                                                {item.ticketType ? (
                                                    <Badge variant="outline" className="text-[10px] uppercase font-bold">{item.ticketType}</Badge>
                                                ) : <span className="text-muted-foreground text-xs">---</span>}
                                            </TableCell>
                                            {selectedEntity.schedules && selectedEntity.schedules.length > 0 ? (
                                                selectedEntity.schedules.map(session => (
                                                    <TableCell key={session.id} className="text-center">
                                                        {item.sessions[session.id] ? (
                                                            <div className="flex items-center justify-center text-green-600 font-semibold gap-1">
                                                                <CheckCircle2 size={14}/>
                                                                <span className="text-xs">{item.sessions[session.id]}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center text-destructive opacity-40">
                                                                <XCircle size={14}/>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                ))
                                            ) : (
                                                <TableCell className="text-center">
                                                    {item.sessions['general'] ? (
                                                        <div className="flex items-center justify-center text-green-600 font-semibold gap-1">
                                                            <CheckCircle2 size={14}/>
                                                            <span className="text-xs">{item.sessions['general']}</span>
                                                        </div>
                                                    ) : (
                                                        <XCircle className="mx-auto text-destructive opacity-20" size={14}/>
                                                    )}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs font-bold">
                                                        {item.attendedCount}/{item.totalPossible}
                                                    </span>
                                                    <div className="w-16 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                                                        <div 
                                                            className="h-full bg-primary" 
                                                            style={{ width: `${(item.attendedCount / item.totalPossible) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center text-muted-foreground italic">
                                            No se encontraron registros de canje para esta campaña.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                </>
            ) : (
                 <div className="flex flex-col items-center justify-center h-60 text-muted-foreground border-2 border-dashed rounded-lg">
                    <BarChart3 size={48} className="opacity-20 mb-2"/>
                    <p>Selecciona una campaña para ver sus estadísticas detalladas y reporte de asistencia.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
