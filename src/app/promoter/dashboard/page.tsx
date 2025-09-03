
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, CheckCircle, QrCode, ScanLine, DollarSign, BarChart2, Info, Gift, History, CheckCheck } from "lucide-react"; 
import { StatCard } from "@/components/admin/StatCard";
import type { BusinessManagedEntity, Business } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { isEntityCurrentlyActivatable, anyToDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PromoterDashboardStats {
  totalBusinessesAssigned: number;
  totalCodesGeneratedByPromoter: number;
  qrGeneratedWithPromoterCodes: number;
  totalCodesUsedByPromoter: number;
}

interface RecentActivity {
  id: string;
  type: 'redeemed' | 'used';
  date: Date;
  entityName: string;
  clientName: string;
  codeValue: string;
}

interface BusinessPerformance {
  businessId: string;
  businessName: string;
  codesCreated: number;
  qrGenerated: number;
  qrUsed: number;
}

export default function PromoterDashboardPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [businessPerformance, setBusinessPerformance] = useState<BusinessPerformance[]>([]);
  const [promoterStats, setPromoterStats] = useState<PromoterDashboardStats>({
    totalBusinessesAssigned: 0,
    totalCodesGeneratedByPromoter: 0,
    qrGeneratedWithPromoterCodes: 0,
    totalCodesUsedByPromoter: 0,
  });

  const fetchDataForDashboard = useCallback(async () => {
    if (!userProfile?.businessIds || userProfile.businessIds.length === 0) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const businessIds = userProfile.businessIds;
      const businessesQuery = query(collection(db, "businesses"), where("__name__", "in", businessIds));
      const businessesSnap = await getDocs(businessesQuery);
      const businessesMap = new Map(businessesSnap.docs.map(doc => [doc.id, doc.data() as Business]));

      const entitiesQuery = query(collection(db, "businessEntities"), where("businessId", "in", businessIds));
      const entitiesSnap = await getDocs(entitiesQuery);
      const allEntities = entitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as BusinessManagedEntity);

      const allActivities: RecentActivity[] = [];
      let totalCodesGenerated = 0;
      let totalQrGenerated = 0;
      let totalQrUsed = 0;
      const performanceMap = new Map<string, Omit<BusinessPerformance, 'businessName' | 'businessId'>>();

      allEntities.forEach(entity => {
        const promoterCodes = (entity.generatedCodes || []).filter(c => c.generatedByUid === userProfile.uid);
        if (promoterCodes.length === 0) return;

        totalCodesGenerated += promoterCodes.length;
        
        let businessPerf = performanceMap.get(entity.businessId);
        if (!businessPerf) {
          businessPerf = { codesCreated: 0, qrGenerated: 0, qrUsed: 0 };
        }
        businessPerf.codesCreated += promoterCodes.length;
        
        promoterCodes.forEach(code => {
          if (code.status === 'redeemed' || code.status === 'used') {
            totalQrGenerated++;
            businessPerf!.qrGenerated++;
            if (code.redemptionDate && code.redeemedByInfo) {
              const redemptionDate = anyToDate(code.redemptionDate);
              if (redemptionDate) {
                allActivities.push({
                  id: `${code.id}-redeemed`,
                  type: 'redeemed',
                  date: redemptionDate,
                  entityName: entity.name,
                  clientName: code.redeemedByInfo.name,
                  codeValue: code.value
                });
              }
            }
          }
          if (code.status === 'used') {
            totalQrUsed++;
            businessPerf!.qrUsed++;
            if (code.usedDate && code.redeemedByInfo) {
              const usedDate = anyToDate(code.usedDate);
              if(usedDate) {
                allActivities.push({
                  id: `${code.id}-used`,
                  type: 'used',
                  date: usedDate,
                  entityName: entity.name,
                  clientName: code.redeemedByInfo.name,
                  codeValue: code.value
                });
              }
            }
          }
        });

        performanceMap.set(entity.businessId, businessPerf);
      });
      
      const sortedActivities = allActivities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
      setRecentActivities(sortedActivities);

      const performanceData: BusinessPerformance[] = [];
      performanceMap.forEach((perf, bizId) => {
        performanceData.push({
          businessId: bizId,
          businessName: businessesMap.get(bizId)?.name || 'Negocio Desconocido',
          ...perf
        });
      });
      setBusinessPerformance(performanceData);

      setPromoterStats({
        totalBusinessesAssigned: businessIds.length,
        totalCodesGeneratedByPromoter: totalCodesGenerated,
        qrGeneratedWithPromoterCodes: totalQrGenerated,
        totalCodesUsedByPromoter: totalQrUsed,
      });

    } catch (error) {
      console.error("Promoter Dashboard: Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    if (!loadingAuth && !loadingProfile && userProfile) {
      fetchDataForDashboard();
    } else if (!loadingAuth && !loadingProfile) {
      setIsLoading(false);
    }
  }, [userProfile, loadingAuth, loadingProfile, fetchDataForDashboard]);

  if (loadingAuth || loadingProfile || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando dashboard del promotor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <BarChart2 className="h-8 w-8 mr-2" /> Dashboard del Promotor
      </h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Negocios Asignados" value={promoterStats.totalBusinessesAssigned} icon={Building} />
        <StatCard title="Códigos Creados por Ti" value={promoterStats.totalCodesGeneratedByPromoter} icon={QrCode} />
        <StatCard title="QRs generados con tus códigos" value={promoterStats.qrGeneratedWithPromoterCodes} icon={ScanLine} />
        <StatCard title="QRs usados por tus clientes" value={promoterStats.totalCodesUsedByPromoter} icon={CheckCircle} />
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Últimas 5 acciones relacionadas con tus códigos.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map(activity => (
                <div key={activity.id} className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${activity.type === 'redeemed' ? 'bg-blue-100' : 'bg-green-100'}`}>
                      {activity.type === 'redeemed' ? (
                        <ScanLine className="h-5 w-5 text-blue-600" />
                      ) : (
                        <CheckCheck className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm font-medium">
                      <span className="font-semibold">{activity.clientName}</span>{' '}
                      {activity.type === 'redeemed' ? 'generó un QR para' : 'utilizó su QR para'}
                      <span className="font-semibold text-primary"> "{activity.entityName}"</span>.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.date, { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-h-[150px] flex flex-col items-center justify-center text-center">
              <Info className="h-12 w-12 text-primary/60 mb-3" />
              <p className="text-muted-foreground">Aún no hay actividad reciente para mostrar.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Rendimiento por Negocio</CardTitle>
          <CardDescription>Resumen de tus códigos por cada negocio asignado.</CardDescription>
        </CardHeader>
        <CardContent>
          {businessPerformance.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negocio</TableHead>
                  <TableHead className="text-center">Códigos Creados</TableHead>
                  <TableHead className="text-center">QRs Generados</TableHead>
                  <TableHead className="text-center">QRs Usados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businessPerformance.map(biz => (
                  <TableRow key={biz.businessId}>
                    <TableCell className="font-medium">{biz.businessName}</TableCell>
                    <TableCell className="text-center">{biz.codesCreated}</TableCell>
                    <TableCell className="text-center">{biz.qrGenerated}</TableCell>
                    <TableCell className="text-center">{biz.qrUsed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <div className="min-h-[150px] flex flex-col items-center justify-center text-center">
              <Info className="h-12 w-12 text-primary/60 mb-3" />
              <p className="text-muted-foreground">No hay datos de rendimiento para mostrar.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
