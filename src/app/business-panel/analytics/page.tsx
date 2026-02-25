"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, BarChart, Bar } from 'recharts';
import type { BusinessManagedEntity, GeneratedCode } from "@/lib/types";
import { BarChart3, Users, Loader2, Info, Ticket, Calendar, QrCode, Search, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { anyToDate, isEntityCurrentlyActivatable, getCurrentSchedule } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/admin/StatCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const [isMounted, setIsMounted] = useState(false);
  const [allEntities, setAllEntities] = useState<BusinessManagedEntity[]>([]);
  const [generalStats, setGeneralStats] = useState<MonthlyStat[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState("");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const businessId = userProfile?.businessId;

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

      const mostRecentActiveEntity = sortedEntities.find(isEntityCurrentlyActivatable);
      if (mostRecentActiveEntity) {
        setSelectedEntityId(mostRecentActiveEntity.id);
      } else if (sortedEntities.length > 0) {
        setSelectedEntityId(sortedEntities[0].id);
      }

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

  const allAttendanceData = useMemo(() => {
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

  const totalPages = Math.ceil(allAttendanceData.length / rowsPerPage);
  const paginatedAttendanceData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return allAttendanceData.slice(startIndex, startIndex + rowsPerPage);
  }, [allAttendanceData, currentPage, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [attendanceSearchTerm, selectedEntityId, rowsPerPage]);

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
            <CardTitle className="text-xl text-destructive font-headline text-center">Configuración Incompleta</CardTitle>
            <CardDescription className="mt-2 text-center text-muted-foreground">
                Tu perfil de usuario no está asociado a un negocio válido.
            </CardDescription>
        </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden pb-10 px-2 sm:px-0 space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center mb-2">
        <BarChart3 className="h-7 w-7 sm:h-8 sm:w-8 mr-2" /> Analíticas
      </h1>
      
      {/* Gráfico de Rendimiento General */}
      <Card className="shadow-md w-full overflow-hidden">
        <CardHeader className="p-4">
          <CardTitle className="font-headline text-lg sm:text-2xl uppercase tracking-wide break-words">Rendimiento General</CardTitle>
          <CardDescription className="text-xs">Últimos 6 meses.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-4">
           <div className="h-[280px] sm:h-[400px] w-full relative">
            {isMounted && generalStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={generalStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        fontSize: '11px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} iconType="circle" />
                  <Line type="monotone" dataKey="entitiesCreated" stroke="hsl(var(--secondary-foreground))" name="Campañas" strokeWidth={2} />
                  <Line type="monotone" dataKey="qrCodesGenerated" stroke="hsl(var(--primary))" name="QR Gen." strokeWidth={2} />
                  <Line type="monotone" dataKey="qrCodesUtilized" stroke="hsl(var(--accent))" name="QR Canje." strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary opacity-20" /></div>
            )}
           </div>
        </CardContent>
      </Card>

      {/* Sección Analíticas por Actividad */}
      <Card className="shadow-md w-full overflow-hidden">
        <CardHeader className="p-4">
          <CardTitle className="font-headline text-lg sm:text-2xl uppercase tracking-wide">Analíticas por Actividad</CardTitle>
          <CardDescription className="text-xs">Detalle de rendimiento por campaña.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
            <div className="w-full">
              <Select onValueChange={setSelectedEntityId} value={selectedEntityId} disabled={allEntities.length === 0}>
                  <SelectTrigger className="h-12 border-2 text-sm w-full">
                      <SelectValue placeholder="Selecciona una actividad" />
                  </SelectTrigger>
                  <SelectContent>
                      {allEntities.map(entity => (
                          <SelectItem key={entity.id} value={entity.id}>
                            <span className="flex items-center text-sm truncate max-w-[200px]">
                              {entity.type === 'event' ? <Calendar className="h-4 w-4 mr-2 flex-shrink-0"/> : <Ticket className="h-4 w-4 mr-2 flex-shrink-0"/>}
                              {entity.name}
                            </span>
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>

            {selectedEntityStats ? (
                <div className="space-y-6">
                    {/* Stat Cards en móvil ocupan 1 columna, en desktop 4 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                       <StatCard title="Creados" value={selectedEntityStats.codesGenerated} icon={Ticket} />
                       <StatCard title="Generados" value={selectedEntityStats.qrGenerated} icon={QrCode} />
                       <StatCard title="Asistencias" value={selectedEntityStats.codesUsed} icon={Users} />
                       <StatCard title="Tasa" value={`${selectedEntityStats.qrGenerated > 0 ? ((selectedEntityStats.codesUsed / selectedEntityStats.qrGenerated) * 100).toFixed(1) : 0}%`} icon={BarChart3} />
                    </div>

                    {/* Reporte de Asistencia con Contención Estricta */}
                    <div className="pt-6 space-y-4 border-t">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h3 className="text-lg font-bold font-headline uppercase text-primary">Reporte de Asistencia</h3>
                                <p className="text-[10px] text-muted-foreground">Listado de ingresos confirmados.</p>
                            </div>
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="DNI o Nombre..."
                                    className="pl-8 text-sm h-10 w-full"
                                    value={attendanceSearchTerm}
                                    onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Contenedor de Tabla con Ancho Controlado */}
                        <div className="w-full max-w-[calc(100vw-2.5rem)] sm:max-w-full border rounded-lg overflow-x-auto shadow-sm bg-background">
                          <Table className="min-w-full">
                              <TableHeader className="bg-muted/50">
                                  <TableRow>
                                      <TableHead className="w-[40px] text-center px-2 text-[10px]">#</TableHead>
                                      <TableHead className="min-w-[120px] text-[10px]">Cliente</TableHead>
                                      <TableHead className="text-center text-[10px]">DNI</TableHead>
                                      {selectedEntity.schedules && selectedEntity.schedules.length > 0 ? (
                                          selectedEntity.schedules.map(session => (
                                              <TableHead key={session.id} className="text-center px-2 min-w-[70px] text-[10px]">
                                                  {session.label}
                                              </TableHead>
                                          ))
                                      ) : (
                                          <TableHead className="text-center text-[10px] min-w-[70px]">Ingreso</TableHead>
                                      )}
                                      <TableHead className="text-right text-[10px] pr-4">Total</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {paginatedAttendanceData.length > 0 ? (
                                      paginatedAttendanceData.map((item, idx) => (
                                          <TableRow key={idx} className="hover:bg-muted/30">
                                              <TableCell className="text-center text-[10px] text-muted-foreground px-2">
                                                  {((currentPage - 1) * rowsPerPage) + idx + 1}
                                              </TableCell>
                                              <TableCell className="px-2 py-2">
                                                  <div className="flex flex-col">
                                                      <span className="text-[10px] font-bold line-clamp-1">{item.name}</span>
                                                      <span className="text-[8px] text-muted-foreground">{item.codeValue}</span>
                                                  </div>
                                              </TableCell>
                                              <TableCell className="text-center text-[10px] px-2">{item.dni}</TableCell>
                                              {selectedEntity.schedules && selectedEntity.schedules.length > 0 ? (
                                                  selectedEntity.schedules.map(session => (
                                                      <TableCell key={session.id} className="text-center px-2">
                                                          {item.sessions[session.id] ? (
                                                              <span className="text-[9px] font-bold text-green-600">{item.sessions[session.id]}</span>
                                                          ) : (
                                                              <XCircle size={10} className="mx-auto text-destructive opacity-20" />
                                                          )}
                                                      </TableCell>
                                                  ))
                                              ) : (
                                                  <TableCell className="text-center px-2">
                                                      {item.sessions['general'] ? (
                                                          <span className="text-[9px] font-bold text-green-600">{item.sessions['general']}</span>
                                                      ) : (
                                                          <XCircle size={10} className="mx-auto text-destructive opacity-20" />
                                                      )}
                                                  </TableCell>
                                              )}
                                              <TableCell className="text-right pr-4 text-[10px] font-black">
                                                  {item.attendedCount}/{item.totalPossible}
                                              </TableCell>
                                          </TableRow>
                                      ))
                                  ) : (
                                      <TableRow>
                                          <TableCell colSpan={10} className="h-20 text-center text-muted-foreground italic text-[10px]">
                                              Sin registros.
                                          </TableCell>
                                      </TableRow>
                                  )}
                              </TableBody>
                          </Table>
                        </div>
                        
                        {/* Paginación */}
                        {totalPages > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
                                <div className="flex items-center space-x-2 text-[10px]">
                                    <Label className="font-bold">Filas:</Label>
                                    <Select value={`${rowsPerPage}`} onValueChange={(v) => setRowsPerPage(Number(v))}>
                                        <SelectTrigger className="h-7 w-[60px] text-[10px]"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="25">25</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Ant.</Button>
                                    <span className="text-[10px] font-bold mx-2">{currentPage} / {totalPages}</span>
                                    <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Sig.</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                 <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border-2 border-dashed rounded-lg text-center p-6 bg-muted/10">
                    <BarChart3 size={32} className="opacity-10 mb-2"/>
                    <p className="text-xs">Selecciona una campaña para ver los reportes.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
