
"use client";

import * as React from "react"; // <--- CORRECCIÓN: Importación añadida
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { QrCode, Ticket, CalendarDays, User, Info, CheckCircle2, XCircle, AlertTriangle, Clock, Users, Camera, UserCheck } from "lucide-react";
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
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, runTransaction, where } from "firebase/firestore";

const QR_READER_ELEMENT_ID = "qr-reader-validator";


interface QrScannerProps {
  onScanSuccess: (decodedText: string, decodedResult: Html5QrcodeResult) => void;
  onScanFailure: (errorMessage: string, error: Html5QrcodeError) => void;
}

const QrScanner = React.memo(({ onScanSuccess, onScanFailure }: QrScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Cleanup function to stop scanner on component unmount
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Failed to stop scanner on cleanup.", err));
      }
    };
  }, []);

  const startScanner = useCallback(async () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        console.log("Scanner is already running.");
        return;
      }
      
      const newScannerInstance = new Html5Qrcode(QR_READER_ELEMENT_ID, { verbose: false });
      scannerRef.current = newScannerInstance;

      try {
        await newScannerInstance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          onScanSuccess,
          onScanFailure
        );
      } catch (err: any) {
        console.error("Primary scanner start failed:", err);
        let message = "No se pudo iniciar el escáner de QR.";
        if (err.name === "NotAllowedError") {
          message = "Permiso de cámara denegado. Por favor, habilita el acceso a la cámara en tu navegador.";
        }
        toast({ title: "Error de Escáner", description: message, variant: "destructive" });
      }
  }, [onScanSuccess, onScanFailure, toast]);

  useEffect(() => {
    startScanner();
  }, [startScanner]);

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


export default function BusinessValidateQrPage() {
  const [scannedCodeValue, setScannedCodeValue] = useState("");
  const [foundEntity, setFoundEntity] = useState<BusinessManagedEntity | null>(null);
  const [foundCode, setFoundCode] = useState<GeneratedCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [isVipCandidate, setIsVipCandidate] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const currentBusinessId = userProfile?.businessId;

  const [activeBusinessEntities, setActiveBusinessEntities] = useState<BusinessManagedEntity[]>([]);
  const [businessName, setBusinessName] = useState<string>("");
  const [isScannerActive, setIsScannerActive] = useState(false);


  const fetchBusinessData = useCallback(async () => {
    if (!currentBusinessId) return;
    setIsLoading(true);
    try {
        const businessDocRef = doc(db, "businesses", currentBusinessId);
        const businessSnap = await getDoc(businessDocRef);
        if (businessSnap.exists()) {
            const data = businessSnap.data() as Business;
            setBusinessName(data.name);
        }

        const entitiesQuery = query(collection(db, "businessEntities"), where("businessId", "==", currentBusinessId), where("isActive", "==", true));
        const entitiesSnap = await getDocs(entitiesQuery);
        const activeEntities = entitiesSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as BusinessManagedEntity))
            .filter(e => isEntityCurrentlyActivatable(e));
        
        setActiveBusinessEntities(activeEntities);
    } catch (e: any) {
        console.error("Error fetching business data for validator:", e);
        toast({ title: "Error al Cargar Datos", description: "No se pudieron obtener los datos de las promociones y eventos.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [currentBusinessId, toast]);

  useEffect(() => {
    fetchBusinessData();
  }, [fetchBusinessData]);

  const handleSearchCode = async (codeToSearch: string) => {
    if (!currentBusinessId) return;
    const normalizedCode = codeToSearch.trim().toUpperCase();

    setIsLoading(true);
    setSearchPerformed(false);
    setFoundEntity(null);
    setFoundCode(null);
    setIsVipCandidate(false);
    setScannedCodeValue(normalizedCode);

    try {
        const entitiesQuery = query(
            collection(db, "businessEntities"),
            where("businessId", "==", currentBusinessId),
            where("isActive", "==", true)
        );
        const querySnapshot = await getDocs(entitiesQuery);

        let entityMatch: BusinessManagedEntity | null = null;
        let codeMatch: GeneratedCode | null = null;

        for (const doc of querySnapshot.docs) {
            const entityData = { id: doc.id, ...doc.data() } as BusinessManagedEntity;
            const found = entityData.generatedCodes?.find(c => c.value.toUpperCase() === normalizedCode);
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
        console.error("Error searching code:", e);
        toast({ title: "Error de Búsqueda", description: `No se pudo buscar el código. ${e.message}`, variant: "destructive" });
    } finally {
        setIsLoading(false);
        setSearchPerformed(true);
    }
  };

  const handleScanSuccess = (decodedText: string, decodedResult: Html5QrcodeResult) => {
    setScannedCodeValue(decodedText.toUpperCase());
    handleSearchCode(decodedText.toUpperCase());
    setIsScannerActive(false); // Hide the scanner component after a successful scan
    toast({ title: "QR Escaneado", description: `Código: ${decodedText}` });
  };
  
  const handleScanFailure = (errorMessage: string, error: Html5QrcodeError) => {
    // This can be noisy, so we'll just log it to the console for debugging
    // console.warn(`QR Code no detectado, error: ${errorMessage}`);
  };

  const handleValidateAndRedeem = async () => {
    if (!foundEntity || !foundCode || !userProfile) return;

    try {
      const entityRef = doc(db, "businessEntities", foundEntity.id);
      await runTransaction(db, async (transaction) => {
          const entityDoc = await transaction.get(entityRef);
          if (!entityDoc.exists()) {
              throw new Error("La promoción o evento no existe.");
          }
          const entityData = entityDoc.data() as BusinessManagedEntity;
          const codes = entityData.generatedCodes || [];
          const codeIndex = codes.findIndex(c => c.id === foundCode.id);

          if (codeIndex === -1 || codes[codeIndex].status !== 'available') {
              throw new Error("El código ya no está disponible para canje.");
          }

          codes[codeIndex].status = 'redeemed';
          codes[codeIndex].redemptionDate = new Date().toISOString();
          codes[codeIndex].redeemedByInfo = { dni: userProfile.dni, name: userProfile.name };
          codes[codeIndex].isVipCandidate = isVipCandidate;

          transaction.update(entityRef, { generatedCodes: codes });
          setFoundCode(codes[codeIndex]);
      });
      
      toast({ title: "¡QR Validado y Canjeado!", description: `Código ${foundCode.value} marcado como utilizado.`, className: "bg-green-500 text-white" });
      await fetchBusinessData();
    } catch (e: any) {
        console.error("Error in redemption transaction:", e);
        toast({ title: "Error al Canjear", description: e.message, variant: "destructive" });
    }
  };

  const isCodeCurrentlyRedeemable = () => {
    if (!foundEntity || !foundCode) return false;
    if (!isEntityCurrentlyActivatable(foundEntity)) return false;
    return foundCode.status === 'available';
  };

  const getEventAttendance = (event: BusinessManagedEntity) => {
    if (event.type !== 'event') return "";
    const redeemedCount = event.generatedCodes?.filter(c => c.status === 'redeemed').length || 0;
    return `Asistencia: ${redeemedCount} / ${event.maxAttendance === 0 || !event.maxAttendance ? '∞' : event.maxAttendance}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <QrCode className="h-8 w-8 mr-2" /> Validación de Códigos QR
        </h1>
        <Button onClick={() => setIsScannerActive(!isScannerActive)} variant={isScannerActive ? "destructive" : "default"} className="w-full sm:w-auto">
          <Camera className="mr-2 h-5 w-5" /> {isScannerActive ? "Detener Escáner" : "Activar Escáner de Cámara"}
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
            <CardDescription>Código verificado: <span className="font-mono font-semibold">{scannedCodeValue}</span></CardDescription>
          </CardHeader>
          <CardContent>
            {!foundCode && !foundEntity ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Código No Encontrado</AlertTitle>
                <AlertDescription>El código "{scannedCodeValue}" no se encontró o no es válido para este negocio.</AlertDescription>
              </Alert>
            ) : foundCode && foundEntity && (
              <div className="space-y-4">
                 <Alert variant={isCodeCurrentlyRedeemable() ? "default" : (foundCode.status === 'redeemed' ? "default" : "destructive")}
                       className={isCodeCurrentlyRedeemable() ? "bg-green-50 border-green-300" : (foundCode.status === 'redeemed' ? "bg-blue-50 border-blue-300" : "")}>
                  {isCodeCurrentlyRedeemable() ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : (foundCode.status === 'redeemed' ? <Info className="h-5 w-5 text-blue-600" /> : <XCircle className="h-5 w-5 text-red-600" />) }
                  <AlertTitle className={isCodeCurrentlyRedeemable() ? "text-green-700" : (foundCode.status === 'redeemed' ? "text-blue-700" : "text-red-700")}>
                    {isCodeCurrentlyRedeemable() ? "Código Válido y Disponible para Canje" : `Estado: ${GENERATED_CODE_STATUS_TRANSLATIONS[foundCode.status] || foundCode.status}`}
                  </AlertTitle>
                  <AlertDescription>
                    {!isEntityCurrentlyActivatable(foundEntity) && `La promoción/evento no está vigente.`}
                  </AlertDescription>
                </Alert>

                <h3 className="text-xl font-semibold text-primary">{foundEntity.name}</h3>
                <p className="text-sm text-muted-foreground">{foundEntity.description}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><CalendarDays className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Vigencia:</strong> {anyToDate(foundEntity.startDate) ? format(anyToDate(foundEntity.startDate)!, "P", { locale: es }) : 'N/A'} - {anyToDate(foundEntity.endDate) ? format(anyToDate(foundEntity.endDate)!, "P", { locale: es }) : 'N/A'}</div>
                  <div><Ticket className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Tipo:</strong> {foundEntity.type === "promotion" ? "Promoción" : "Evento"}</div>
                  {foundEntity.type === 'event' && <div><Users className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>{getEventAttendance(foundEntity)}</strong></div>}
                  <div><Clock className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Código Creado:</strong> {foundCode.generatedDate ? format(new Date(foundCode.generatedDate), "Pp", { locale: es }) : "N/A"} por {foundCode.generatedByName}</div>
                  {foundCode.redeemedByInfo && <div><User className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Canjeado por:</strong> {foundCode.redeemedByInfo.name}</div>}
                  {foundCode.redemptionDate && <div><CheckCircle2 className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Fecha Canje:</strong> {format(new Date(foundCode.redemptionDate), "Pp", { locale: es })}</div>}
                </div>
                 {isCodeCurrentlyRedeemable() && (
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
          {foundCode && foundEntity && isCodeCurrentlyRedeemable() && (
            <CardFooter>
              <Button onClick={handleValidateAndRedeem} className="w-full bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="mr-2 h-5 w-5" /> Validar y Marcar como Canjeado
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {!isScannerActive && !searchPerformed && (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>{businessName}: Promociones y Eventos Activos Hoy</CardTitle>
                <CardDescription>Resumen de entidades vigentes para {format(new Date(), "eeee d 'de' MMMM", {locale: es})}</CardDescription>
            </CardHeader>
            <CardContent>
            {activeBusinessEntities.length === 0 ? (
                <p className="text-muted-foreground">No hay promociones o eventos activos para hoy.</p>
            ) : (
                <Accordion type="single" collapsible className="w-full">
                {activeBusinessEntities.map(entity => (
                    <AccordionItem value={entity.id} key={entity.id}>
                    <AccordionTrigger>
                        <div className="flex items-center gap-2">
                            {entity.type === 'promotion' ? <Ticket className="h-5 w-5 text-primary"/> : <CalendarDays className="h-5 w-5 text-primary"/>}
                            <span>{entity.name}</span>
                            <Badge variant={"default"} className={"bg-green-500 hover:bg-green-600"}>Vigente</Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-1 text-sm pl-8">
                        <p>{entity.description}</p>
                        {entity.type === 'event' && <p><strong>{getEventAttendance(entity)}</strong></p>}
                        {entity.type === 'promotion' && entity.usageLimit && entity.usageLimit > 0 && <p><strong>Límite de canjes:</strong> {entity.generatedCodes?.filter(c => c.status === 'redeemed').length || 0} / {entity.usageLimit}</p>}
                        <p><strong>Códigos disponibles:</strong> {entity.generatedCodes?.filter(c => c.status === 'available').length || 0}</p>
                    </AccordionContent>
                    </AccordionItem>
                ))}
                </Accordion>
            )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
