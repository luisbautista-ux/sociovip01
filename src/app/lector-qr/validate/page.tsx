
"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { QrCode as QrCodeIcon, Ticket, CalendarDays, User, Info, Search, CheckCircle2, XCircle, AlertTriangle, Clock, Users, Camera, UserCheck } from "lucide-react";
import type { BusinessManagedEntity, GeneratedCode, Business } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Html5Qrcode, type Html5QrcodeError, type Html5QrcodeResult } from "html5-qrcode";
import { isEntityCurrentlyActivatable, anyToDate } from "@/lib/utils";
import { GENERATED_CODE_STATUS_TRANSLATIONS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { collection, doc, getDoc, getDocs, query, runTransaction, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";


const QR_READER_ELEMENT_ID = "qr-reader-validator";

interface QrScannerProps {
  onScanSuccess: (decodedText: string, decodedResult: Html5QrcodeResult) => void;
  onScanFailure: (errorMessage: string, error: Html5QrcodeError) => void;
}

const QrScanner = React.memo(({ onScanSuccess, onScanFailure }: QrScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
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
          if (err && typeof err.message === 'string' && !err.message.includes("Cannot transition")) {
            console.error("Scanner start failed:", err);
          }
        }
      }
    };

    startScanner();

    return () => {
      isComponentMounted = false;
      if (html5Qrcode && html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(err => {
          if (err && typeof err.message === 'string' && !err.message.includes("Cannot transition")) {
             console.error("Failed to stop scanner cleanly on unmount:", err);
          }
        });
      }
    };
  }, [onScanSuccess, onScanFailure]);


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Escáner de QR Activo</CardTitle>
        <CardDescription>Apunta la cámara al código QR del cliente.</CardDescription>
      </CardHeader>
      <CardContent>
        <div id={QR_READER_ELEMENT_ID} className="w-full max-w-sm mx-auto aspect-square border-4 border-primary/50 rounded-lg overflow-hidden bg-muted shadow-inner"></div>
        <p className="text-center text-sm text-muted-foreground mt-2">El video de la cámara aparecerá aquí.</p>
      </CardContent>
    </Card>
  );
});
QrScanner.displayName = "QrScanner";


export default function LectorValidateQrPage() {
  const [scannedCodeId, setScannedCodeId] = useState("");
  const [foundEntity, setFoundEntity] = useState<BusinessManagedEntity | null>(null);
  const [foundCode, setFoundCode] = useState<GeneratedCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [isVipCandidate, setIsVipCandidate] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const currentBusinessId = userProfile?.businessId;
  const [isScannerActive, setIsScannerActive] = useState(false);
  
  const [activeBusinessEntities, setActiveBusinessEntities] = useState<BusinessManagedEntity[]>([]);

  const fetchActiveEntities = useCallback(async () => {
    if (!currentBusinessId) return;
    try {
        const entitiesQuery = query(
            collection(db, "businessEntities"), 
            where("businessId", "==", currentBusinessId),
        );
        const snap = await getDocs(entitiesQuery);
        const allEntities = snap.docs.map(d => ({id: d.id, ...d.data()}) as BusinessManagedEntity);
        const currentlyActive = allEntities.filter(e => isEntityCurrentlyActivatable(e));
        setActiveBusinessEntities(currentlyActive);
    } catch (e) {
        console.error("Error fetching active entities for validator page", e);
    }
  }, [currentBusinessId]);

  useEffect(() => {
    fetchActiveEntities();
  }, [fetchActiveEntities]);


  const findCodeInEntities = useCallback(async (codeIdToFind: string) => {
    if (!currentBusinessId) return;

    setIsLoading(true);
    setSearchPerformed(false);
    setFoundEntity(null);
    setFoundCode(null);
    setIsVipCandidate(false);
    setScannedCodeId(codeIdToFind);

    try {
      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("businessId", "==", currentBusinessId),
        where("isActive", "==", true),
      );
      const querySnapshot = await getDocs(entitiesQuery);

      let entityMatch: BusinessManagedEntity | null = null;
      let codeMatch: GeneratedCode | null = null;

      for (const doc of querySnapshot.docs) {
        const entityData = { id: doc.id, ...doc.data() } as BusinessManagedEntity;
        const found = entityData.generatedCodes?.find(c => c.id === codeIdToFind);
        if (found) {
          entityMatch = entityData;
          codeMatch = found;
          setIsVipCandidate(found.isVipCandidate || false);
          break;
        }
      }
      
      setFoundEntity(entityMatch);
      setFoundCode(codeMatch);

    } catch (e: any) {
      console.error("Error searching code by ID:", e);
      toast({ title: "Error de Búsqueda", description: `No se pudo buscar el código. ${e.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setSearchPerformed(true);
    }
  }, [currentBusinessId, toast]);

  const handleScanSuccess = useCallback((decodedText: string, decodedResult: Html5QrcodeResult) => {
    setIsScannerActive(false); 
    toast({ title: "QR Escaneado", description: `Verificando código...` });
    findCodeInEntities(decodedText);
  }, [findCodeInEntities, toast]);
  
  const handleScanFailure = useCallback((errorMessage: string, error: Html5QrcodeError) => {
    // Silently ignore scan failures
  }, []);

  const getCommissionValueForCode = (entity: BusinessManagedEntity, code: GeneratedCode): number => {
    if (entity.type !== 'event' || !entity.assignedPromoters || !code.generatedByUid) {
      return 0; // No commission for promotions or if promoter is not assigned
    }
  
    const promoterAssignment = entity.assignedPromoters.find(p => p.promoterProfileId === code.generatedByUid);
    if (!promoterAssignment || !promoterAssignment.commissionRules || promoterAssignment.commissionRules.length === 0) {
      return 0; // No commission if no rules are found for this promoter
    }
  
    // For now, get the first 'event_general' rule. This can be expanded for more complex scenarios.
    const generalRule = promoterAssignment.commissionRules.find(
      r => r.appliesTo === 'event_general' && typeof r.commissionValue === 'number'
    );
  
    if (generalRule) {
      return generalRule.commissionValue;
    }
  
    return 0; // Default to 0 if no applicable rule is found
  };


  const handleValidateAndRedeem = async () => {
    if (!foundEntity || !foundCode || !userProfile?.uid) {
      toast({ title: "Error", description: "No se puede validar sin datos de entidad, código o perfil de usuario.", variant: "destructive" });
      return;
    }
    if (foundCode.status !== 'redeemed') {
        toast({ title: "Acción no Válida", description: "Este código no está en el estado correcto para ser validado.", variant: "destructive" });
        return;
    }

    try {
      const entityRef = doc(db, "businessEntities", foundEntity.id);
      await runTransaction(db, async (transaction) => {
          const entityDoc = await transaction.get(entityRef);
          if (!entityDoc.exists) {
              throw new Error("La promoción o evento ya no existe.");
          }
          const entityData = entityDoc.data() as BusinessManagedEntity;
          const codes = entityData.generatedCodes || [];
          const codeIndex = codes.findIndex(c => c.id === foundCode.id);

          if (codeIndex === -1) {
             throw new Error("El código ya no existe en esta entidad.");
          }
          if (codes[codeIndex].status !== 'redeemed') {
             throw new Error(`Este QR ya fue utilizado o su estado es inválido (estado actual: ${GENERATED_CODE_STATUS_TRANSLATIONS[codes[codeIndex].status] || codes[codeIndex].status}).`);
          }

          codes[codeIndex].status = 'used'; 
          codes[codeIndex].usedDate = new Date().toISOString();
          codes[codeIndex].usedByInfo = { uid: userProfile.uid, name: userProfile.name };
          codes[codeIndex].isVipCandidate = isVipCandidate;
          
          // --- Commission Logic ---
          // The commission is calculated and recorded ONLY at this moment.
          const commissionAmount = getCommissionValueForCode(entityData, codes[codeIndex]);
          codes[codeIndex].commissionGenerated = commissionAmount;

          // The status is marked as 'unpaid' only if a commission was generated.
          if (commissionAmount > 0) {
            codes[codeIndex].commissionStatus = 'unpaid';
          }
          
          transaction.update(entityRef, { generatedCodes: codes });
          setFoundCode(codes[codeIndex]);
      });
      
      toast({ title: "¡Código Utilizado Exitosamente!", description: `Código para "${foundEntity.name}" marcado como utilizado.`, className: "bg-green-500 text-white" });
      fetchActiveEntities();
    } catch (e: any) {
        console.error("Error in redemption transaction:", e);
        toast({ title: "Error al Validar", description: e.message, variant: "destructive" });
        if (scannedCodeId) findCodeInEntities(scannedCodeId);
    }
  };

  const isCodeCurrentlyRedeemableByHost = () => {
    if (!foundEntity || !foundCode) return false;
    if (!isEntityCurrentlyActivatable(foundEntity)) return false;
    return foundCode.status === 'redeemed';
  };
  
  const handleActivateScanner = () => {
    setSearchPerformed(false);
    setFoundEntity(null);
    setFoundCode(null);
    setIsScannerActive(true);
  }

  const activePromotions = activeBusinessEntities.filter(e => e.type === 'promotion');
  const activeEvents = activeBusinessEntities.filter(e => e.type === 'event');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <QrCodeIcon className="h-8 w-8 mr-2" /> Validación de Códigos QR
        </h1>
        <Button 
            onClick={isScannerActive ? () => setIsScannerActive(false) : handleActivateScanner} 
            variant={isScannerActive ? "destructive" : "gradient"} 
            className="w-full sm:w-auto"
        >
          <Camera className="mr-2 h-5 w-5" /> {isScannerActive ? "Detener Escáner" : "Activar Escáner"}
        </Button>
      </div>
      
      {isScannerActive && (
          <QrScanner 
              onScanSuccess={handleScanSuccess} 
              onScanFailure={handleScanFailure} 
          />
      )}

      {searchPerformed && (
        <Card className="shadow-xl animate-in fade-in-50">
          <CardHeader>
            <CardTitle>Resultado de la Verificación</CardTitle>
            <CardDescription>Código verificado: <span className="font-mono font-semibold">{foundCode?.id || scannedCodeId}</span></CardDescription>
          </CardHeader>
          <CardContent>
            {!foundCode || !foundEntity ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Código No Encontrado</AlertTitle>
                <AlertDescription>El código no se encontró o no es válido para este negocio.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                 <Alert variant={isCodeCurrentlyRedeemableByHost() ? "default" : "destructive"}
                       className={
                        cn({
                            "bg-green-50 border-green-300": isCodeCurrentlyRedeemableByHost(),
                            "bg-blue-50 border-blue-300": foundCode.status === 'used',
                            "bg-yellow-50 border-yellow-400": foundCode.status === 'available' || foundCode.status === 'expired',
                        })
                       }>
                  {foundCode.status === 'used' ? <Info className="h-5 w-5 text-blue-600" /> 
                    : (foundCode.status === 'redeemed' ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                    : <XCircle className="h-5 w-5 text-red-600" /> )
                  }
                  <AlertTitle className={cn("font-bold", {
                        "text-green-800": isCodeCurrentlyRedeemableByHost(),
                        "text-blue-800": foundCode.status === 'used',
                        "text-red-800": !isCodeCurrentlyRedeemableByHost() && foundCode.status !== 'used'
                      })}>
                    {foundCode.status === 'used' ? `Este QR ya fue utilizado`
                     : isCodeCurrentlyRedeemableByHost() ? "Disponible para Canje" 
                     : `Estado: ${GENERATED_CODE_STATUS_TRANSLATIONS[foundCode.status] || foundCode.status}`}
                  </AlertTitle>
                  <AlertDescription>
                    {!isEntityCurrentlyActivatable(foundEntity) && `La promoción/evento no está vigente.`}
                    {foundCode.status === 'used' && `El cliente ya ingresó el ${anyToDate(foundCode.usedDate) ? format(anyToDate(foundCode.usedDate)!, 'Pp', {locale: es}) : ''}`}
                    {foundCode.status === 'available' && `Este código aún no ha sido reclamado por un cliente (no se ha generado su QR).`}
                    {foundCode.status === 'expired' && `Este código ha expirado.`}
                  </AlertDescription>
                </Alert>

                <h3 className="text-xl font-semibold text-primary">{foundEntity.name}</h3>
                <p className="text-sm text-muted-foreground">{foundEntity.description}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><CalendarDays className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Vigencia:</strong> {anyToDate(foundEntity.startDate) ? format(anyToDate(foundEntity.startDate)!, "P", { locale: es }) : 'N/A'} - {anyToDate(foundEntity.endDate) ? format(anyToDate(foundEntity.endDate)!, "P", { locale: es }) : 'N/A'}</div>
                  <div><Ticket className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Tipo:</strong> {foundEntity.type === 'promotion' ? "Promoción" : "Evento"}</div>
                  {foundCode.redeemedByInfo && <div><User className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Cliente:</strong> {foundCode.redeemedByInfo.name} (DNI: {foundCode.redeemedByInfo.dni})</div>}
                  {foundCode.redemptionDate && <div><Clock className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Fecha de Canje (QR):</strong> {anyToDate(foundCode.redemptionDate) ? format(anyToDate(foundCode.redemptionDate)!, "Pp", { locale: es }) : 'N/A'}</div>}
                  {foundCode.usedByInfo && <div><UserCheck className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Validado por:</strong> {foundCode.usedByInfo.name}</div>}
                </div>
                
                 {isCodeCurrentlyRedeemableByHost() && (
                  <div className="flex items-center space-x-2 pt-4 border-t mt-4">
                    <Switch
                      id="vip-candidate-toggle"
                      checked={isVipCandidate}
                      onCheckedChange={(checked) => setIsVipCandidate(checked)}
                    />
                    <Label htmlFor="vip-candidate-toggle" className="text-sm flex items-center">
                      <UserCheck className="mr-2 h-4 w-4 text-primary" /> Marcar cliente como Potencial VIP
                    </Label>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          {foundCode && foundEntity && isCodeCurrentlyRedeemableByHost() && (
            <CardFooter>
              <Button onClick={handleValidateAndRedeem} className="w-full bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="mr-2 h-5 w-5" /> Validar Ingreso y Marcar como Utilizado
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}
