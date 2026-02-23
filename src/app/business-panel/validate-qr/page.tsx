// src/app/business-panel/validate-qr/page.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { QrCode as QrCodeIcon, User, Info, CheckCircle2, XCircle, AlertTriangle, Clock, Camera, History, Calendar } from "lucide-react";
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

const QR_READER_ELEMENT_ID = "qr-reader-validator";

type ValidationResult = {
  type: 'promo_code' | 'user_qr' | 'not_found';
  entity?: BusinessManagedEntity | null;
  code?: GeneratedCode | null;
  user?: PlatformUser | null;
};

export default function BusinessPanelValidateQrPage() {
  const [scannedCodeId, setScannedCodeId] = React.useState("");
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const currentBusinessId = userProfile?.businessId;
  const [isScannerActive, setIsScannerActive] = React.useState(false);

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
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentBusinessId, toast]);

  const handleScanSuccess = (decodedText: string) => {
    setIsScannerActive(false);
    findCodeInEntities(decodedText);
  };

  const handleValidateEntry = async () => {
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
              usedDate: new Date().toISOString(), // Legacy support
          };

          transaction.update(entityRef, { generatedCodes: codes });
          setValidationResult(prev => prev ? {...prev, code: codes[idx]} : prev);
      });
      toast({ title: "¡Ingreso Validado!", className: "bg-green-600 text-white" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const currentSchedule = validationResult?.entity ? getCurrentSchedule(validationResult.entity) : null;
  const alreadyUsedToday = validationResult?.code?.checkIns?.some(ci => ci.scheduleId === (currentSchedule?.id || 'general'));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary flex items-center"><QrCodeIcon className="mr-2" /> Validador de Accesos</h1>
        <Button onClick={() => setIsScannerActive(!isScannerActive)} variant={isScannerActive ? "destructive" : "gradient"}>
          <Camera className="mr-2 h-5 w-5" /> {isScannerActive ? "Cerrar" : "Escanear"}
        </Button>
      </div>

      {isScannerActive && (
        <Card className="p-4 flex flex-col items-center">
          <div id={QR_READER_ELEMENT_ID} className="w-full max-w-sm aspect-square bg-black rounded-lg overflow-hidden" />
          <p className="mt-2 text-sm text-muted-foreground">Coloca el QR frente a la cámara</p>
        </Card>
      )}

      {validationResult && (
        <Card className="shadow-lg border-2">
          <CardHeader>
            <CardTitle>Datos del Cliente</CardTitle>
            <CardDescription>{scannedCodeId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validationResult.type === 'not_found' ? (
              <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>No encontrado</AlertTitle></Alert>
            ) : validationResult.type === 'promo_code' && validationResult.entity && validationResult.code ? (
              <div className="space-y-4">
                <Alert className={cn(alreadyUsedToday ? "bg-red-50" : "bg-green-50")}>
                  {alreadyUsedToday ? <XCircle className="text-red-600"/> : <CheckCircle2 className="text-green-600"/>}
                  <AlertTitle className={alreadyUsedToday ? "text-red-800" : "text-green-800"}>
                    {alreadyUsedToday ? "ACCESO DENEGADO" : "ACCESO PERMITIDO"}
                  </AlertTitle>
                  <AlertDescription>
                    {alreadyUsedToday ? `Ya ingresó hoy a: ${currentSchedule?.label || 'General'}` : `Sesión actual: ${currentSchedule?.label || 'General'}`}
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><User className="inline mr-2 h-4 w-4"/><strong>Cliente:</strong> {validationResult.code.redeemedByInfo?.name}</div>
                  <div><Calendar className="inline mr-2 h-4 w-4"/><strong>Evento:</strong> {validationResult.entity.name}</div>
                </div>

                {validationResult.code.checkIns && validationResult.code.checkIns.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                        <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1 mb-2"><History size={14}/> HISTORIAL DE ENTRADAS</h4>
                        <div className="space-y-1">
                            {validationResult.code.checkIns.map((ci, i) => (
                                <div key={i} className="text-xs flex justify-between bg-muted p-2 rounded">
                                    <span>{ci.scheduleLabel}</span>
                                    <span className="font-mono">{format(new Date(ci.timestamp), 'dd/MM HH:mm')}</span>
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
                <Button onClick={handleValidateAndRedeem} className="w-full bg-green-600 hover:bg-green-700 text-white">Validar Entrada</Button>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
