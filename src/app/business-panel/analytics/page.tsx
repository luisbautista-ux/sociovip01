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
  const [allEntities, setAllEntities] = useState<BusinessManagedEntity[]>([]);
  const [generalStats, setGeneralStats] = useState<MonthlyStat[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState("");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
            <CardTitle className="text-xl text-destructive font-headline">Configuración Incompleta</CardTitle>
            <CardDescription className="mt-2 text-center text-muted-foreground">
                Tu perfil de usuario no está asociado a un negocio válido. Contacta al superadministrador.
            </CardDescription>
        </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 max-w-full overflow-x-hidden px-1 sm:px-0">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center px-2">
        <BarChart3 className="h-7 w-7 sm:h-8 sm:w-8 mr-2" /> Analíticas
      </h1>
      
      <Card className="shadow-lg overflow-hidden mx-2 sm:mx-0">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="font-headline text-lg sm:text-2xl uppercase tracking-wide break-words">Rendimiento General (Últimos 6 Meses)</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Tendencias en creación de campañas y códigos QR.</CardDescription>
        </CardHeader>
        <CardContent className="p-2">
           <div className="h-[280px] sm:h-[400px] w-full min-w-0 overflow-hidden">
            {generalStats.length > 0 && generalStats.some(s => s.entitiesCreated > 0 || s.qrCodesGenerated > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={generalStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} iconType="circle" />
                  <Line type="monotone" dataKey="entitiesCreated" stroke="hsl(var(--secondary-foreground))" name="Campañas" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="qrCodesGenerated" stroke="hsl(var(--primary))" name="QR Gen." strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="qrCodesUtilized" stroke="hsl(var(--accent))" name="QR Canje." strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm space-y-2">
                  <Info className="h-8 w-8 opacity-20" /> 
                  <p>No hay datos suficientes para mostrar el gráfico.</p>
              </div>
            )}
           </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg overflow-hidden mx-2 sm:mx-0">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="font-headline text-lg sm:text-2xl uppercase tracking-wide">Analíticas por Actividad</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Selecciona para ver el detalle de rendimiento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="w-full">
              <Select onValueChange={setSelectedEntityId} value={selectedEntityId} disabled={allEntities.length === 0}>
                  <SelectTrigger className="h-12 border-2 text-sm w-full">
                      <SelectValue placeholder={allEntities.length === 0 ? "Sin actividades" : "Selecciona una actividad"} />
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
                <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                    <div className="lg:col-span-2 h-[280px] sm:h-[350px] w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={[selectedEntityStats]} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                            <XAxis type="number" fontSize={10} hide />
                            <YAxis type="category" dataKey="name" hide />
                            <Tooltip
                               cursor={{ fill: 'transparent' }}
                               contentStyle={{ 
                                  backgroundColor: 'hsl(var(--background))', 
                                  borderColor: 'hsl(var(--border))',
                                  borderRadius: 'var(--radius)',
                                  fontSize: '11px'
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px' }} iconType="rect" />
                            <Bar dataKey="codesGenerated" fill="hsl(var(--secondary-foreground))" name="Creados" radius={[0, 4, 4, 0]} barSize={25} />
                            <Bar dataKey="qrGenerated" fill="hsl(var(--primary))" name="Generados" radius={[0, 4, 4, 0]} barSize={25} />
                            <Bar dataKey="codesUsed" fill="hsl(var(--accent))" name="Asistencias" radius={[0, 4, 4, 0]} barSize={25} />
                         </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-3">
                       <StatCard title="Creados" value={selectedEntityStats.codesGenerated} icon={Ticket} />
                       <StatCard title="Generados" value={selectedEntityStats.qrGenerated} icon={QrCode} />
                       <StatCard title="Asistencias" value={selectedEntityStats.codesUsed} icon={Users} />
                       <StatCard title="Tasa" value={`${selectedEntityStats.qrGenerated > 0 ? ((selectedEntityStats.codesUsed / selectedEntityStats.qrGenerated) * 100).toFixed(1) : 0}%`} icon={BarChart3} />
                    </div>
                </div>

                <div className="pt-8 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t pt-6">
                        <div className="w-full sm:w-auto">
                            <h3 className="text-lg sm:text-xl font-bold font-headline uppercase tracking-tight flex items-center gap-2 text-primary">
                                <Users className="h-5 w-5"/> Reporte de Asistencia
                            </h3>
                            <p className="text-xs text-muted-foreground">Detalle de ingresos por cliente.</p>
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

                    <div className="border rounded-lg overflow-hidden shadow-sm bg-background max-w-full">
                        <div className="overflow-x-auto w-full">
                          <Table>
                              <TableHeader className="bg-muted/50">
                                  <TableRow>
                                      <TableHead className="w-[40px] font-bold text-center px-2 text-[10px] sm:text-xs">#</TableHead>
                                      <TableHead className="font-bold text-[10px] sm:text-xs min-w-[140px]">Cliente</TableHead>
                                      <TableHead className="font-bold text-center text-[10px] sm:text-xs">DNI/CE</TableHead>
                                      <TableHead className="font-bold text-center text-[10px] sm:text-xs">Entrada</TableHead>
                                      {selectedEntity.schedules && selectedEntity.schedules.length > 0 ? (
                                          selectedEntity.schedules.map(session => (
                                              <TableHead key={session.id} className="font-bold text-center px-2 min-w-[80px]">
                                                  <div className="flex flex-col items-center">
                                                      <span className="text-[10px] sm:text-xs truncate max-w-[70px]">{session.label}</span>
                                                      <span className="text-[8px] font-normal opacity-70">
                                                          {format(new Date(session.startDate), "dd/MM")}
                                                      </span>
                                                  </div>
                                              </TableHead>
                                          ))
                                      ) : (
                                          <TableHead className="font-bold text-center text-[10px] sm:text-xs min-w-[80px]">Ingreso</TableHead>
                                      )}
                                      <TableHead className="font-bold text-right text-[10px] sm:text-xs pr-4">Asist.</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {paginatedAttendanceData.length > 0 ? (
                                      paginatedAttendanceData.map((item, idx) => (
                                          <TableRow key={idx} className="hover:bg-muted/30">
                                              <TableCell className="text-center text-[10px] text-muted-foreground px-2">
                                                  {((currentPage - 1) * rowsPerPage) + idx + 1}
                                              </TableCell>
                                              <TableCell className="font-medium px-2 py-3">
                                                  <div className="flex flex-col">
                                                      <span className="text-[10px] sm:text-xs font-bold leading-tight line-clamp-1">{item.name}</span>
                                                      <span className="text-[8px] text-muted-foreground font-mono">{item.codeValue}</span>
                                                  </div>
                                              </TableCell>
                                              <TableCell className="text-center text-[10px] sm:text-xs px-2">{item.dni}</TableCell>
                                              <TableCell className="text-center px-2">
                                                  {item.ticketType ? (
                                                      <Badge variant="outline" className="text-[8px] sm:text-[9px] px-1 py-0 uppercase font-bold leading-none">{item.ticketType}</Badge>
                                                  ) : <span className="text-muted-foreground text-[10px]">---</span>}
                                              </TableCell>
                                              {selectedEntity.schedules && selectedEntity.schedules.length > 0 ? (
                                                  selectedEntity.schedules.map(session => (
                                                      <TableCell key={session.id} className="text-center px-2">
                                                          {item.sessions[session.id] ? (
                                                              <div className="flex items-center justify-center text-green-600 font-bold gap-0.5">
                                                                  <CheckCircle2 size={10}/>
                                                                  <span className="text-[9px] sm:text-xs">{item.sessions[session.id]}</span>
                                                              </div>
                                                          ) : (
                                                              <div className="flex items-center justify-center text-destructive opacity-20">
                                                                  <XCircle size={10}/>
                                                              </div>
                                                          )}
                                                      </TableCell>
                                                  ))
                                              ) : (
                                                  <TableCell className="text-center px-2">
                                                      {item.sessions['general'] ? (
                                                          <div className="flex items-center justify-center text-green-600 font-bold gap-0.5">
                                                              <CheckCircle2 size={10}/>
                                                              <span className="text-[9px] sm:text-xs">{item.sessions['general']}</span>
                                                          </div>
                                                      ) : (
                                                          <XCircle className="mx-auto text-destructive opacity-20" size={10}/>
                                                      )}
                                                  </TableCell>
                                              )}
                                              <TableCell className="text-right pr-4">
                                                  <div className="flex flex-col items-end">
                                                      <span className="text-[10px] font-black">
                                                          {item.attendedCount}/{item.totalPossible}
                                                      </span>
                                                      <div className="w-8 sm:w-12 h-1 bg-muted rounded-full mt-0.5 overflow-hidden">
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
                                          <TableCell colSpan={10} className="h-24 text-center text-muted-foreground italic text-[10px] sm:text-xs">
                                              No se encontraron registros coincidentes.
                                          </TableCell>
                                      </TableRow>
                                  )}
                              </TableBody>
                          </Table>
                        </div>
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-3 bg-muted/20 rounded-lg">
                            <div className="flex items-center space-x-2 text-xs">
                                <Label htmlFor="rows-per-page-attendance" className="font-bold">Filas:</Label>
                                <Select
                                    value={`${rowsPerPage}`}
                                    onValueChange={(value) => setRowsPerPage(Number(value))}
                                >
                                    <SelectTrigger id="rows-per-page-attendance" className="h-8 w-[65px] bg-background">
                                        <SelectValue placeholder={rowsPerPage} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[10, 25, 50].map((pageSize) => (
                                            <SelectItem key={pageSize} value={`${pageSize}`}>
                                                {pageSize}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground font-black uppercase">
                                Pág. {currentPage} de {totalPages}
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[10px] px-2 bg-background font-bold"
                                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Ant.
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[10px] px-2 bg-background font-bold"
                                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Sig.
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
                </>
            ) : (
                 <div className="flex flex-col items-center justify-center h-60 text-muted-foreground border-2 border-dashed rounded-lg text-center p-6 bg-muted/10 mx-2">
                    <BarChart3 size={48} className="opacity-10 mb-3"/>
                    <p className="text-sm font-medium">Selecciona una campaña para visualizar estadísticas detalladas y reporte de asistencia.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}