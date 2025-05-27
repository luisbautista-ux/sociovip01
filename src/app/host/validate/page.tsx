
"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { QrCode, Ticket, CalendarDays, User, Info, Search, CheckCircle2, XCircle, AlertTriangle, Clock, Users, Camera, UserCheck } from "lucide-react";
import type { BusinessManagedEntity, GeneratedCode } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Html5Qrcode, type Html5QrcodeError, type Html5QrcodeResult } from "html5-qrcode";

// Mock data - In a real app, this would be fetched for the host's associated business.
// This is a mutable copy for the Anfitrion page to simulate updates.
let mockHostPromotions: BusinessManagedEntity[] = [
  {
    id: "bp1",
    businessId: "biz1",
    type: "promotion",
    name: "Jueves de Alitas BBQ (Anfitrión)",
    description: "Todas las alitas BBQ a S/1 cada una.",
    startDate: "2025-01-01T12:00:00",
    endDate: "2025-12-31T12:00:00",
    usageLimit: 0,
    isActive: true,
    imageUrl: "https://placehold.co/300x200.png",
    aiHint: "chicken wings",
    termsAndConditions: "Válido solo para consumo en local. Máximo 20 alitas por persona con código.",
    generatedCodes: [
        { id: "codePromo1-1", entityId: "bp1", value: "ALITAS001", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-01-20T10:00:00Z", observation: "Código de lanzamiento" },
        { id: "codePromo1-2", entityId: "bp1", value: "ALITAS002", status: "redeemed", generatedByName: "Admin Negocio", generatedDate: "2025-01-20T10:05:00Z", redemptionDate: "2025-01-21T12:00:00Z", redeemedByInfo: {dni: "12345678", name: "Ana Garcia"}, isVipCandidate: true },
        { id: "codePromo1-3", entityId: "bp1", value: "ALITAS003", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-01-20T10:06:00Z" },
        { id: "bp1code4", entityId: "bp1", value: "BBQDEALS4", status: "available", generatedByName: "Staff Negocio", generatedDate: "2025-01-01T11:00:00Z"},
    ]
  },
  {
    id: "bp2",
    businessId: "biz1",
    type: "promotion",
    name: "Happy Hour Extendido (Anfitrión)",
    description: "Tragos seleccionados 2x1 de 5 PM a 9 PM.",
    startDate: "2025-01-15T12:00:00",
    endDate: "2025-10-31T12:00:00",
    usageLimit: 500,
    isActive: true,
    imageUrl: "https://placehold.co/300x200.png",
    aiHint: "cocktails bar",
    generatedCodes: [
      { id: "bp2code1", entityId: "bp2", value: "HAPPYDRNK", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-01-15T10:00:00Z"},
    ]
  },
   {
    id: "bp3",
    businessId: "biz1",
    type: "promotion",
    name: "Promo Cumpleañero Mes (INACTIVA ANFITRION)",
    description: "Si cumples años este mes, tu postre es gratis.",
    startDate: "2024-01-01T12:00:00",
    endDate: "2024-12-31T12:00:00",
    isActive: false,
    imageUrl: "https://placehold.co/300x200.png",
    aiHint: "birthday cake",
    generatedCodes: []
  },
];

let mockHostEvents: BusinessManagedEntity[] = [
  {
    id: "evt1",
    businessId: "biz1",
    type: "event",
    name: "Noche de Karaoke Estelar (Anfitrión)",
    description: "Saca la estrella que llevas dentro. Premios para los mejores.",
    startDate: "2025-08-15T12:00:00",
    endDate: "2025-08-15T12:00:00",
    maxAttendance: 5,
    isActive: true,
    imageUrl: "https://placehold.co/300x200.png",
    aiHint: "karaoke night",
    generatedCodes: [
        { id: "codeEvt1-1", entityId: "evt1", value: "KARAOKE01", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-08-01T10:00:00Z", observation: "Invitado especial" },
        { id: "codeEvt1-2", entityId: "evt1", value: "KARAOKE02", status: "redeemed", generatedByName: "Admin Negocio", generatedDate: "2025-08-01T10:05:00Z", redemptionDate: "2025-08-15T20:00:00Z", redeemedByInfo: {dni: "87654321", name: "Carlos Perez"} },
        { id: "codeEvt1-3", entityId: "evt1", value: "SINGER003", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-08-01T10:06:00Z"},
        { id: "codeEvt1-4", entityId: "evt1", value: "VOCALSTAR", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-08-01T10:07:00Z"},
        { id: "codeEvt1-5", entityId: "evt1", value: "MICNIGHT5", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-08-01T10:08:00Z"},
        { id: "codeEvt1-6", entityId: "evt1", value: "EVENTSIX6", status: "expired", generatedByName: "Admin Negocio", generatedDate: "2025-08-01T10:09:00Z"},
    ]
  },
];


const hostBusinessId = "biz1";
const businessName = "Pandora Lounge Bar"; // Mock

const statusTranslations: Record<GeneratedCode['status'], string> = {
  available: "Disponible para Canje/Uso",
  redeemed: "YA CANJEADO/UTILIZADO",
  expired: "VENCIDO",
};

const QR_READER_ELEMENT_ID = "qr-reader-host";

export default function HostValidateQrPage() {
  const [scannedCodeValue, setScannedCodeValue] = useState("");
  const [foundEntity, setFoundEntity] = useState<BusinessManagedEntity | null>(null);
  const [foundCode, setFoundCode] = useState<GeneratedCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [isVipCandidate, setIsVipCandidate] = useState(false);
  const { toast } = useToast();

  const [activeBusinessEntities, setActiveBusinessEntities] = useState<BusinessManagedEntity[]>([]);

  const [isScannerActive, setIsScannerActive] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Use the mutable mock data for this page
    const allEntities = [...mockHostPromotions, ...mockHostEvents];
    const filtered = allEntities.filter(entity => {
      const entityStartDateObj = new Date(entity.startDate);
      const entityEndDateObj = new Date(entity.endDate);
      const effectiveStartDate = new Date(entityStartDateObj.getFullYear(), entityStartDateObj.getMonth(), entityStartDateObj.getDate());
      const effectiveEndDate = new Date(entityEndDateObj.getFullYear(), entityEndDateObj.getMonth(), entityEndDateObj.getDate(), 23, 59, 59, 999);

      return entity.businessId === hostBusinessId &&
             entity.isActive &&
             today >= effectiveStartDate &&
             today <= effectiveEndDate;
    });
    setActiveBusinessEntities(filtered);
  }, [foundCode]); // Re-filter if foundCode changes (e.g., after redemption affects counts)

  const startScanner = async () => {
    const qrReaderElement = document.getElementById(QR_READER_ELEMENT_ID);
    if (!qrReaderElement) {
        toast({ title: "Error de Configuración", description: "Elemento para el escáner no encontrado.", variant: "destructive" });
        return;
    }
     qrReaderElement.innerHTML = ""; // Clear previous content

    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop().catch(console.error);
    }

    const newScannerInstance = new Html5Qrcode(QR_READER_ELEMENT_ID, {
        verbose: false // Reduce console logs from the library
    });
    html5QrCodeRef.current = newScannerInstance;

    const qrCodeSuccessCallback = (decodedText: string, decodedResult: Html5QrcodeResult) => {
      setScannedCodeValue(decodedText.toUpperCase());
      handleSearchCode(decodedText.toUpperCase());
      stopScanner();
      toast({ title: "QR Escaneado", description: `Código: ${decodedText}` });
    };

    const qrCodeErrorCallback = (errorMessage: string, error: Html5QrcodeError) => {
      // console.warn(`QR Code no detectado, error: ${errorMessage}`);
    };

    try {
      await newScannerInstance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );
      setIsScannerActive(true);
    } catch (err: any) {
      console.error("Error al iniciar scanner (environment):", err);
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length) {
            await newScannerInstance.start(
                cameras[0].id, // Fallback to the first available camera
                { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                qrCodeSuccessCallback,
                qrCodeErrorCallback
            );
            setIsScannerActive(true);
        } else {
             toast({ title: "Sin Cámara", description: "No se encontraron cámaras disponibles.", variant: "destructive" });
             setIsScannerActive(false);
        }
      } catch (fallbackErr: any) {
        console.error("Error al iniciar scanner (fallback):", fallbackErr);
        let message = "No se pudo iniciar el escáner de QR.";
        if (fallbackErr.name === "NotAllowedError") {
            message = "Permiso de cámara denegado. Por favor, habilita el acceso a la cámara en tu navegador.";
        }
        toast({ title: "Error de Escáner", description: message, variant: "destructive" });
        setIsScannerActive(false);
      }
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Error al detener scanner:", err);
      }
    }
    setIsScannerActive(false);
    const qrReaderElement = document.getElementById(QR_READER_ELEMENT_ID);
    if (qrReaderElement) {
      qrReaderElement.innerHTML = "";
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);


  const handleToggleScanner = () => {
    if (isScannerActive) {
      stopScanner();
    } else {
      setSearchPerformed(false);
      setFoundEntity(null);
      setFoundCode(null);
      setScannedCodeValue("");
      startScanner();
    }
  };

  const handleSearchCode = (codeToSearchParam?: string) => {
    const currentCodeValue = (codeToSearchParam || scannedCodeValue).trim().toUpperCase();
    if (currentCodeValue.length === 0 && !codeToSearchParam) {
        setSearchPerformed(false);
        setFoundEntity(null);
        setFoundCode(null);
        return;
    }
    if (currentCodeValue.length !== 9) {
      toast({ title: "Código Inválido", description: "El código debe tener 9 caracteres alfanuméricos.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setSearchPerformed(false);
    setFoundEntity(null);
    setFoundCode(null);
    setIsVipCandidate(false);

    setTimeout(() => {
      let entityMatch: BusinessManagedEntity | null = null;
      let codeMatch: GeneratedCode | null = null;
      const allEntities = [...mockHostPromotions, ...mockHostEvents]; // Search in all host's entities

      for (const entity of allEntities) {
        const code = entity.generatedCodes?.find(c => c.value.toUpperCase() === currentCodeValue);
        if (code) {
          entityMatch = entity;
          codeMatch = code;
          setIsVipCandidate(code.isVipCandidate || false);
          break;
        }
      }

      setFoundEntity(entityMatch);
      setFoundCode(codeMatch);
      setIsLoading(false);
      setSearchPerformed(true);
    }, 500);
  };

  const handleValidateAndRedeem = () => {
    if (!foundEntity || !foundCode) return;

    // Find the entity in the original mutable mock arrays
    let targetEntityInMock: BusinessManagedEntity | undefined;
    if (foundEntity.type === 'promotion') {
        targetEntityInMock = mockHostPromotions.find(p => p.id === foundEntity.id);
    } else {
        targetEntityInMock = mockHostEvents.find(e => e.id === foundEntity.id);
    }

    if (targetEntityInMock && targetEntityInMock.generatedCodes) {
        const codeIndex = targetEntityInMock.generatedCodes.findIndex(c => c.id === foundCode.id);
        if (codeIndex > -1) {
            // Update the code in the mutable mock array
            targetEntityInMock.generatedCodes[codeIndex] = {
                ...targetEntityInMock.generatedCodes[codeIndex],
                status: 'redeemed',
                redemptionDate: new Date().toISOString(),
                isVipCandidate: isVipCandidate,
                redeemedByInfo: targetEntityInMock.generatedCodes[codeIndex].redeemedByInfo || { dni: "VALIDADO_ANFITRION", name: "Anfitrión" }
            };

            // Update local state for immediate UI feedback
            setFoundCode(targetEntityInMock.generatedCodes[codeIndex]);

            // Trigger a re-evaluation of activeBusinessEntities to update counts
             const now = new Date();
             const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
             const allEntitiesUpdated = [...mockHostPromotions, ...mockHostEvents];
             const filteredUpdated = allEntitiesUpdated.filter(entity => {
                const entityStartDateObj = new Date(entity.startDate);
                const entityEndDateObj = new Date(entity.endDate);
                const effectiveStartDate = new Date(entityStartDateObj.getFullYear(), entityStartDateObj.getMonth(), entityStartDateObj.getDate());
                const effectiveEndDate = new Date(entityEndDateObj.getFullYear(), entityEndDateObj.getMonth(), entityEndDateObj.getDate(), 23, 59, 59, 999);
                return entity.businessId === hostBusinessId && entity.isActive && today >= effectiveStartDate && today <= effectiveEndDate;
            });
            setActiveBusinessEntities(filteredUpdated);


            toast({ title: "¡QR Validado y Canjeado!", description: `Código ${foundCode.value} para "${foundEntity.name}" marcado como utilizado. ${isVipCandidate ? 'Cliente marcado como Potencial VIP.' : ''}`, className: "bg-green-500 text-white" });
        } else {
             toast({ title: "Error Interno", description: "No se pudo actualizar el código.", variant: "destructive" });
        }
    } else {
        toast({ title: "Error Interno", description: "No se encontró la entidad para actualizar.", variant: "destructive" });
    }
  };

  const handleVipCandidateToggle = (checked: boolean) => {
    setIsVipCandidate(checked);
    if (foundCode && foundCode.status === 'available') {
        toast({
            title: "Perfil de Cliente",
            description: checked ? "Cliente marcado como Potencial VIP." : "Cliente desmarcado como Potencial VIP.",
        });
    }
  };


  const isCodeRedeemable = () => {
    if (!foundEntity || !foundCode) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const entityStartDateObj = new Date(foundEntity.startDate);
    const entityEndDateObj = new Date(foundEntity.endDate);
    const effectiveStartDate = new Date(entityStartDateObj.getFullYear(), entityStartDateObj.getMonth(), entityStartDateObj.getDate());
    const effectiveEndDate = new Date(entityEndDateObj.getFullYear(), entityEndDateObj.getMonth(), entityEndDateObj.getDate(), 23, 59, 59, 999);

    const entityActiveAndCurrent = foundEntity.isActive && today >= effectiveStartDate && today <= effectiveEndDate;

    if (!entityActiveAndCurrent) return false;
    if (foundCode.status !== 'available') return false;

    if (foundEntity.type === 'event' && foundEntity.maxAttendance && foundEntity.maxAttendance > 0) {
      const redeemedCount = foundEntity.generatedCodes?.filter(c => c.status === 'redeemed').length || 0;
      if (redeemedCount >= foundEntity.maxAttendance) return false;
    }
    return true;
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
          <QrCode className="h-8 w-8 mr-2" /> Validación de Códigos
        </h1>
        <Button onClick={handleToggleScanner} variant={isScannerActive ? "destructive" : "default"} className="w-full sm:w-auto">
          <Camera className="mr-2 h-5 w-5" /> {isScannerActive ? "Detener Escáner" : "Escanear QR con Cámara"}
        </Button>
      </div>

      {isScannerActive && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Escáner de QR Activo</CardTitle>
            <CardDescription>Apunta la cámara al código QR del cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div id={QR_READER_ELEMENT_ID} className="w-full max-w-md mx-auto aspect-square border rounded-md overflow-hidden bg-muted">
              {/* html5-qrcode will render video here */}
            </div>
             <p className="text-center text-sm text-muted-foreground mt-2">El video de la cámara aparecerá aquí si se conceden los permisos.</p>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Verificar Código Manualmente</CardTitle>
          <CardDescription>Si el escaneo falla o necesitas verificar un código, ingrésalo aquí para ver su estado.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Input
            type="text"
            value={scannedCodeValue}
            onChange={(e) => setScannedCodeValue(e.target.value.toUpperCase())}
            placeholder="ABC123XYZ"
            maxLength={9}
            className="text-lg flex-grow tracking-wider"
            disabled={isLoading || isScannerActive}
          />
          <Button onClick={() => handleSearchCode()} disabled={isLoading || isScannerActive || scannedCodeValue.trim().length !== 9} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
            <Search className="mr-2 h-4 w-4" /> {isLoading ? "Buscando..." : "Buscar Código"}
          </Button>
        </CardContent>
      </Card>

      {searchPerformed && (
        <Card className="shadow-xl animate-in fade-in-50">
          <CardHeader>
            <CardTitle>Resultado de la Verificación</CardTitle>
          </CardHeader>
          <CardContent>
            {!foundCode && !foundEntity && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Código No Encontrado</AlertTitle>
                <AlertDescription>El código "{scannedCodeValue}" no se encontró o no es válido para este negocio.</AlertDescription>
              </Alert>
            )}
            {foundCode && foundEntity && (
              <div className="space-y-4">
                 <Alert variant={isCodeRedeemable() ? "default" : (foundCode.status === 'redeemed' ? "default" : "destructive")}
                       className={isCodeRedeemable() ? "bg-green-50 border-green-300" : (foundCode.status === 'redeemed' ? "bg-blue-50 border-blue-300" : "")}>
                  {isCodeRedeemable() ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : (foundCode.status === 'redeemed' ? <Info className="h-5 w-5 text-blue-600" /> : <XCircle className="h-5 w-5 text-red-600" />) }
                  <AlertTitle className={isCodeRedeemable() ? "text-green-700" : (foundCode.status === 'redeemed' ? "text-blue-700" : "text-red-700")}>
                    {isCodeRedeemable() ? "Código Válido y Disponible para Canje" : `Estado: ${statusTranslations[foundCode.status]}`}
                  </AlertTitle>
                  <AlertDescription>
                    {!isCodeRedeemable() && foundEntity.isActive && new Date(foundEntity.startDate) <= new Date() && new Date(foundEntity.endDate) >= new Date() && foundCode.status === 'available' && foundEntity.type === 'event' && foundEntity.maxAttendance && (foundEntity.generatedCodes?.filter(c => c.status === 'redeemed').length || 0) >= foundEntity.maxAttendance && (
                        "El evento ha alcanzado su aforo máximo."
                    )}
                    {!isCodeRedeemable() && foundEntity.isActive && (new Date(foundEntity.startDate) > new Date() || new Date(foundEntity.endDate) < new Date()) && (
                        `La promoción/evento "${foundEntity.name}" no está vigente (Vigencia: ${format(new Date(foundEntity.startDate), "P", {locale: es})} - ${format(new Date(foundEntity.endDate), "P", {locale: es})}).`
                    )}
                     {!isCodeRedeemable() && !foundEntity.isActive && (
                        `La promoción/evento "${foundEntity.name}" está actualmente INACTIVA.`
                    )}
                  </AlertDescription>
                </Alert>

                <h3 className="text-xl font-semibold text-primary">{foundEntity.name}</h3>
                <p className="text-sm text-muted-foreground">{foundEntity.description}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><CalendarDays className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Vigencia:</strong> {format(new Date(foundEntity.startDate), "P", { locale: es })} - {format(new Date(foundEntity.endDate), "P", { locale: es })}</div>
                  <div><Ticket className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Tipo:</strong> {foundEntity.type === "promotion" ? "Promoción" : "Evento"}</div>
                  {foundEntity.type === 'event' && <div><Users className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>{getEventAttendance(foundEntity)}</strong></div>}
                  <div><Clock className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Código Creado:</strong> {format(new Date(foundCode.generatedDate), "Pp", { locale: es })} por {foundCode.generatedByName}</div>
                  {foundCode.redeemedByInfo && (
                     <div><User className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Canjeado por:</strong> {foundCode.redeemedByInfo.name} {foundCode.redeemedByInfo.dni !== "VALIDADO_ANFITRION" ? `(DNI: ${foundCode.redeemedByInfo.dni})` : ""}</div>
                  )}
                  {foundCode.redemptionDate && (
                     <div><CheckCircle2 className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Fecha Canje:</strong> {format(new Date(foundCode.redemptionDate), "Pp", { locale: es })}</div>
                  )}
                </div>
                {foundCode.observation && <p className="text-sm italic"><Info className="inline mr-1 h-4 w-4"/> Observación del código: {foundCode.observation}</p>}

                {isCodeRedeemable() && (
                  <div className="flex items-center space-x-2 pt-4 border-t mt-4">
                    <Switch
                      id="vip-candidate-toggle"
                      checked={isVipCandidate}
                      onCheckedChange={handleVipCandidateToggle}
                      disabled={foundCode.status !== 'available'}
                    />
                    <Label htmlFor="vip-candidate-toggle" className="text-sm flex items-center">
                      <UserCheck className="mr-2 h-4 w-4 text-primary" /> Marcar cliente como Potencial VIP
                    </Label>
                  </div>
                )}

              </div>
            )}
          </CardContent>
          {foundCode && foundEntity && isCodeRedeemable() && (
            <CardFooter>
              <Button onClick={handleValidateAndRedeem} className="w-full bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="mr-2 h-5 w-5" /> Validar y Marcar como Canjeado/Asistió
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{businessName}: Promociones y Eventos Activos Hoy</CardTitle>
          <CardDescription>Entidades vigentes para {format(new Date(), "eeee d 'de' MMMM", {locale: es})}</CardDescription>
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
                        <Badge variant={entity.isActive ? "default" : "outline"} className={entity.isActive ? "bg-green-500 hover:bg-green-600" : ""}>
                            {entity.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1 text-sm pl-8">
                    <p>{entity.description}</p>
                    <p><strong>Vigencia:</strong> {format(new Date(entity.startDate), "P", { locale: es })} - {format(new Date(entity.endDate), "P", { locale: es })}</p>
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
    </div>
  );
}
    

    