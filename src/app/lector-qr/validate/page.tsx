// src/app/lector-qr/validate/page.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { QrCode as QrCodeIcon, Ticket, User, Info, CheckCircle2, XCircle, AlertTriangle, Clock, Users, Camera, History, Loader2 } from "lucide-react";
import type { BusinessManagedEntity, GeneratedCode, PlatformUser, CheckIn } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Html5Qrcode, type Html5QrcodeError, type Html5QrcodeResult } from "html5-qrcode";
import { isEntityCurrentlyActivatable, anyToDate, getCurrentSchedule } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { collection, doc, getDoc, getDocs, query, runTransaction, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

const QR_READER_ELEMENT_ID = "qr-reader-validator-lector";

type ValidationResult = {
  type: 'promo_code' | 'user_qr' | 'not_found';
  entity?: BusinessManagedEntity | null;
  code?: GeneratedCode | null;
  user?: PlatformUser | null;
};

interface QrScannerProps {
  onScanSuccess: (decodedText: string, decodedResult: Html5QrcodeResult) => void;
  onScanFailure: (errorMessage: string, error: Html5QrcodeError) => void;
}

const QrScanner = React.memo(({ onScanSuccess, onScanFailure }: QrScannerProps) => {
  const scannerRef = React.useRef<Html5Qrcode | null>(null);

  React.useEffect(() => {
    if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(QR_READER_ELEMENT_ID, { verbose: false });
    }
    const html5Qrcode = scannerRef.current;
    let isComponentMounted = true;

    const startScanner = async () => {
      try {
        if (isComponentMounted && html5Qrcode && !html5Qrcode.isScanning) {
          await html5Qrcode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            onScanSuccess,
            onScanFailure
          );
        }
      } catch (err: any) {
        if (isComponentMounted) {
          console.error("Scanner start failed:", err);
        }
      }
    };

    startScanner();

    return () => {
      isComponentMounted = false;
      if (html5Qrcode && html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(err => {
             console.error("Failed to stop scanner cleanly on unmount:", err);
        });
      }
    };
  }, [onScanSuccess, onScanFailure]);

  return (
    <Card className="shadow-lg border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /> Escáner Activo</CardTitle>
        <CardDescription>Apunta al código QR del cliente para validarlo.</CardDescription>
      </CardHeader>
      <CardContent>
        <div id={QR_READER_ELEMENT_ID} className="w-full max-w-sm mx-auto aspect-square bg-black rounded-lg overflow-hidden shadow-inner" />
        <p className="mt-4 text-center text-sm text-muted-foreground">Coloca el QR frente a la cámara</p>
      </CardContent>
    </Card>
  );
});
QrScanner.displayName = "QrScanner";

export default function LectorValidateQrPage() {
  const [scannedCodeId, setScannedCodeId] = React.useState("");
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isScannerActive, setIsScannerActive] = React.useState(false);
  const [activeEntities, setActiveEntities] = React.useState<BusinessManagedEntity[]>([]);
  
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const currentBusinessId = userProfile?.businessId;

  const fetchActiveEntities = React.useCallback(async () => {
    if (!currentBusinessId) return;
    try {
      const q = query(collection(db, "businessEntities"), where("businessId", "==", currentBusinessId), where("isActive", "==", true));
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessManagedEntity));
      setActiveEntities(all.filter(isEntityCurrentlyActivatable));
    } catch (e) {
      console.error("Error fetching entities", e);
    }
  }, [currentBusinessId]);

  React.useEffect(() => {
    fetchActiveEntities();
  }, [fetchActiveEntities]);

  const findCodeInEntities = React.useCallback(async (codeIdToFind: string) => {
    if (!currentBusinessId) return;
    setIsLoading(true);
    setValidationResult(null);
    setScannedCodeId(codeIdToFind);

    try {
      const entitiesQuery = query(collection(db, "businessEntities"), where("businessId", "==", currentBusinessId), where("isActive", "==", true));
      const querySnapshot = await getDocs(entitiesQuery);

      for (const docSnap of querySnapshot.docs) {
        const entityData = { id: docSnap.id, ...docSnap.data() } as BusinessManagedEntity;
        const foundCode = entityData.generatedCodes?.find(c => c.id === codeIdToFind);
        if (foundCode) {
            setValidationResult({ type: 'promo_code', entity: entityData, code: foundCode });
            setIsLoading(false);
            return;
        }
      }

      const userSnap = await getDoc(doc(db, "platformUsers", codeIdToFind));
      if (userSnap.exists()) {
        setValidationResult({ type: 'user_qr', user: { id: userSnap.id, ...userSnap.data() } as PlatformUser });
        setIsLoading(false);
        return;
      }

      setValidationResult({ type: 'not_found' });
    } catch (e: any) {
      toast({ title: "Error de Búsqueda", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentBusinessId, toast]);

  const handleScanSuccess = (decodedText: string) => {
    setIsScannerActive(false);
    findCodeInEntities(decodedText);
  };

  const handleValidateAndRedeem = async () => {
    if (validationResult?.type !== 'promo_code' || !validationResult.entity || !validationResult.code || !userProfile) return;

    const { entity, code } = validationResult;
    const schedule = getCurrentSchedule(entity);
    
    // Check if already checked in for this specific schedule
    const alreadyCheckedIn = code.checkIns?.some(ci => ci.scheduleId === (schedule?.id || 'general'));
    if (alreadyCheckedIn) {
        toast({ title: "Ya ingresó", description: `El cliente ya ingresó a esta sesión: ${schedule?.label || 'General'}.`, variant: "destructive" });
        return;
    }

    try {
      const entityRef = doc(db, "businessEntities", entity.id);
      await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(entityRef);
          if (!snap.exists()) throw new Error("Evento no encontrado.");
          
          const data = snap.data() as BusinessManagedEntity;
          const codes = [...(data.generatedCodes || [])];
          const idx = codes.findIndex(c => c.id === code.id);
          
          if (idx === -1) throw new Error("Código no encontrado.");

          const newCheckIn: CheckIn = {
              scheduleId: schedule?.id || 'general',
              scheduleLabel: schedule?.label || 'General',
              timestamp: new Date().toISOString(),
              validatedBy: { uid: userProfile.uid, name: userProfile.name }
          };

          codes[idx] = {
              ...codes[idx],
              status: 'used',
              checkIns: [...(codes[idx].checkIns || []), newCheckIn],
              usedDate: new Date().toISOString(), 
          };

          transaction.update(entityRef, { generatedCodes: codes });
          setValidationResult(prev => prev ? {...prev, code: codes[idx]} : prev);
      });
      toast({ title: "¡Acceso Validado!", description: `Se registró la entrada para ${schedule?.label || 'General'}.`, className: "bg-green-600 text-white" });
      fetchActiveEntities();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const currentSchedule = validationResult?.entity ? getCurrentSchedule(validationResult.entity) : null;
  const alreadyUsedToday = validationResult?.code?.checkIns?.some(ci => ci.scheduleId === (currentSchedule?.id || 'general'));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-primary flex items-center"><QrCodeIcon className="h-8 w-8 mr-2" /> Validador de Accesos</h1>
        <Button onClick={() => setIsScannerActive(!isScannerActive)} variant={isScannerActive ? "destructive" : "gradient"} className="w-full sm:w-auto">
          <Camera className="mr-2 h-5 w-5" /> {isScannerActive ? "Detener Escáner" : "Activar Escáner"}
        </Button>
      </div>

      {isScannerActive && (
        <QrScanner 
          onScanSuccess={handleScanSuccess}
          onScanFailure={() => {}}
        />
      )}

      {isLoading && (
        <div className="flex justify-center p-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )}

      {validationResult && !isLoading && (
        <Card className="shadow-xl border-2 animate-in fade-in zoom-in-95 duration-300">
          <CardHeader>
            <CardTitle>Resultado de Validación</CardTitle>
            <CardDescription>Código: <span className="font-mono">{scannedCodeId}</span></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validationResult.type === 'not_found' ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Código No Encontrado</AlertTitle>
                <AlertDescription>Este código no pertenece a ninguna promoción o usuario de este negocio.</AlertDescription>
              </Alert>
            ) : validationResult.type === 'promo_code' && validationResult.entity && validationResult.code ? (
              <div className="space-y-4">
                <Alert className={cn("border-2", alreadyUsedToday ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200")}>
                  {alreadyUsedToday ? <XCircle className="text-red-600 h-5 w-5"/> : <CheckCircle2 className="text-green-600 h-5 w-5"/>}
                  <div className="ml-2">
                    <AlertTitle className={cn("font-bold text-lg", alreadyUsedToday ? "text-red-800" : "text-green-800")}>
                        {alreadyUsedToday ? "ACCESO YA UTILIZADO" : "ACCESO PERMITIDO"}
                    </AlertTitle>
                    <AlertDescription className={alreadyUsedToday ? "text-red-700" : "text-green-700"}>
                        {alreadyUsedToday 
                            ? `El cliente ya ingresó a la sesión: ${currentSchedule?.label || 'General'}.` 
                            : `Sesión actual detectada: ${currentSchedule?.label || 'General'}`
                        }
                    </AlertDescription>
                  </div>
                </Alert>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-lg">
                    <User className="h-5 w-5 text-primary"/>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase font-bold">Cliente</p>
                        <p className="font-semibold">{validationResult.code.redeemedByInfo?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-lg">
                    <Info className="h-5 w-5 text-primary"/>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase font-bold">Actividad</p>
                        <p className="font-semibold">{validationResult.entity.name}</p>
                    </div>
                  </div>
                </div>

                {validationResult.code.checkIns && validationResult.code.checkIns.length > 0 && (
                    <div className="mt-4">
                        <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1 mb-2 uppercase tracking-wider"><History size={14}/> Historial de Entradas</h4>
                        <div className="space-y-1">
                            {validationResult.code.checkIns.map((ci, i) => (
                                <div key={i} className="text-sm flex justify-between bg-muted p-2 rounded-md border border-border/50">
                                    <span className="font-medium text-primary">{ci.scheduleLabel}</span>
                                    <span className="text-muted-foreground">{format(new Date(ci.timestamp), 'dd/MM HH:mm', {locale: es})}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
              </div>
            ) : null}
          </CardContent>
          <CardFooter>
            {validationResult.type === 'promo_code' && !alreadyUsedToday && (
                <Button onClick={handleValidateAndRedeem} className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200">
                    <CheckCircle2 className="mr-2 h-6 w-6" /> Validar Entrada
                </Button>
            )}
            <Button variant="outline" onClick={() => setValidationResult(null)} className="w-full mt-2">Cerrar</Button>
          </CardFooter>
        </Card>
      )}

      <Card className="mt-8 border-t-4 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5 text-primary"/> Promociones y Eventos de Hoy</CardTitle>
          <CardDescription>Lista de actividades vigentes que puedes validar ahora.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeEntities.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {activeEntities.map(entity => {
                const schedule = getCurrentSchedule(entity);
                return (
                  <AccordionItem value={entity.id} key={entity.id} className="border-b last:border-0">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-col items-start gap-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{entity.name}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">{entity.type === 'event' ? 'Evento' : 'Promo'}</Badge>
                          </div>
                          {schedule && (
                            <div className="flex items-center text-xs text-green-600 font-semibold gap-1">
                                <Clock size={12}/> Sesión Activa: {schedule.label}
                            </div>
                          )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm space-y-2 text-muted-foreground pb-4">
                      <p>{entity.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs">
                        <div className="flex items-center gap-1"><Users size={14}/> Canjeados: {entity.generatedCodes?.filter(c => c.status === 'redeemed' || c.status === 'used').length || 0}</div>
                        <div className="flex items-center gap-1 font-bold text-primary"><CheckCircle2 size={14}/> Validados: {entity.generatedCodes?.filter(c => c.status === 'used').length || 0}</div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          ) : (
            <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Info size={32} className="opacity-20"/>
                <p>No hay actividades programadas para el horario actual.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
