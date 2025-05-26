
"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { QrCode, Ticket, CalendarDays, User, Info, Search, CheckCircle2, XCircle, AlertTriangle, Clock, Users } from "lucide-react";
import type { BusinessManagedEntity, GeneratedCode } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

// Mock data - In a real app, this would be fetched for the host's associated business
// For simplicity, we'll re-use and filter the mock data from business panel.
// This is NOT ideal as changes in one place won't reflect here without backend.
const allMockPromotions: BusinessManagedEntity[] = [
  { 
    id: "bp1", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Jueves de Alitas BBQ", 
    description: "Todas las alitas BBQ a S/1 cada una.", 
    startDate: "2024-08-01T12:00:00", 
    endDate: "2024-12-31T12:00:00", 
    usageLimit: 0, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "chicken wings",
    generatedCodes: [
        { id: "codePromo1-1", entityId: "bp1", value: "ALITAS001", status: "available", generatedByName: "Admin Negocio", generatedDate: "2024-07-20T10:00:00Z", observation: "Código de lanzamiento" },
        { id: "codePromo1-2", entityId: "bp1", value: "ALITAS002", status: "redeemed", generatedByName: "Admin Negocio", generatedDate: "2024-07-20T10:05:00Z", redemptionDate: "2024-07-21T12:00:00Z", redeemedByInfo: {dni: "12345678", name: "Ana Garcia"} },
        { id: "codePromo1-3", entityId: "bp1", value: "ALITAS003", status: "available", generatedByName: "Admin Negocio", generatedDate: "2024-07-20T10:06:00Z" },
        { id: "bp1code4", entityId: "bp1", value: "BBQDEALS4", status: "available", generatedByName: "Staff Negocio", generatedDate: "2024-08-01T11:00:00Z"},
    ]
  },
  { 
    id: "bp2", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Happy Hour Extendido", 
    description: "Tragos seleccionados 2x1 de 5 PM a 9 PM.", 
    startDate: "2024-07-15T12:00:00", 
    endDate: "2024-10-31T12:00:00", 
    usageLimit: 500, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "cocktails bar",
    generatedCodes: [
      { id: "bp2code1", entityId: "bp2", value: "HAPPYDRNK", status: "available", generatedByName: "Admin Negocio", generatedDate: "2024-07-15T10:00:00Z"},
    ]
  },
   { 
    id: "bp3", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Promo Cumpleañero Mes (INACTIVA)", 
    description: "Si cumples años este mes, tu postre es gratis.", 
    startDate: "2024-01-01T12:00:00", 
    endDate: "2024-12-31T12:00:00", 
    isActive: false, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "birthday cake",
    generatedCodes: []
  },
];

const allMockEvents: BusinessManagedEntity[] = [
  { 
    id: "evt1", 
    businessId: "biz1", 
    type: "event", 
    name: "Noche de Karaoke Estelar", 
    description: "Saca la estrella que llevas dentro. Premios para los mejores.", 
    startDate: "2024-08-15T12:00:00", 
    endDate: "2024-08-15T12:00:00", // Same day event
    maxAttendance: 5, // Small for testing
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "karaoke night",
    generatedCodes: [
        { id: "codeEvt1-1", entityId: "evt1", value: "KARAOKE01", status: "available", generatedByName: "Admin Negocio", generatedDate: "2024-08-01T10:00:00Z", observation: "Invitado especial" },
        { id: "codeEvt1-2", entityId: "evt1", value: "KARAOKE02", status: "redeemed", generatedByName: "Admin Negocio", generatedDate: "2024-08-01T10:05:00Z", redemptionDate: "2024-08-15T20:00:00Z", redeemedByInfo: {dni: "87654321", name: "Carlos Perez"} },
        { id: "codeEvt1-3", entityId: "evt1", value: "SINGER003", status: "available", generatedByName: "Admin Negocio", generatedDate: "2024-08-01T10:06:00Z"},
        { id: "codeEvt1-4", entityId: "evt1", value: "VOCALSTAR", status: "available", generatedByName: "Admin Negocio", generatedDate: "2024-08-01T10:07:00Z"},
        { id: "codeEvt1-5", entityId: "evt1", value: "MICNIGHT5", status: "available", generatedByName: "Admin Negocio", generatedDate: "2024-08-01T10:08:00Z"},
        { id: "codeEvt1-6", entityId: "evt1", value: "EVENTSIX6", status: "expired", generatedByName: "Admin Negocio", generatedDate: "2024-08-01T10:09:00Z"}, // Example of one more than maxAttendance
    ]
  },
];

const hostBusinessId = "biz1"; // Host is associated with this business

const statusTranslations: Record<GeneratedCode['status'], string> = {
  available: "Disponible para Canje/Uso",
  redeemed: "YA CANJEADO/UTILIZADO",
  expired: "VENCIDO",
};

const statusBadgeColors: Record<GeneratedCode['status'], "default" | "secondary" | "destructive" | "outline"> = {
  available: "default", // green
  redeemed: "secondary",   // blue/gray
  expired: "destructive",  // red
};


export default function HostValidateQrPage() {
  const [scannedCode, setScannedCode] = useState("");
  const [foundEntity, setFoundEntity] = useState<BusinessManagedEntity | null>(null);
  const [foundCode, setFoundCode] = useState<GeneratedCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const { toast } = useToast();

  // Combine and filter active entities for this host's business
  const [activeBusinessEntities, setActiveBusinessEntities] = useState<BusinessManagedEntity[]>([]);

  useEffect(() => {
    const now = new Date();
    const allEntities = [...allMockPromotions, ...allMockEvents];
    const filtered = allEntities.filter(entity => 
      entity.businessId === hostBusinessId &&
      entity.isActive &&
      new Date(entity.startDate) <= now && // Starts now or in the past
      new Date(entity.endDate) >= now     // Ends now or in the future
    );
    setActiveBusinessEntities(filtered);
  }, []);

  const handleSearchCode = () => {
    if (scannedCode.length !== 9) {
      toast({ title: "Código Inválido", description: "El código debe tener 9 caracteres.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setSearchPerformed(false); // Reset before new search
    setFoundEntity(null);
    setFoundCode(null);

    // Simulate API call
    setTimeout(() => {
      let entityMatch: BusinessManagedEntity | null = null;
      let codeMatch: GeneratedCode | null = null;

      for (const entity of activeBusinessEntities) { // Search only in active entities
        const code = entity.generatedCodes?.find(c => c.value.toUpperCase() === scannedCode.toUpperCase());
        if (code) {
          entityMatch = entity;
          codeMatch = code;
          break;
        }
      }
      
      // If not found in active, check all entities for a more informative message (e.g. found but inactive/expired entity)
      if (!codeMatch) {
        const allEntitiesForBusiness = [...allMockPromotions, ...allMockEvents].filter(e => e.businessId === hostBusinessId);
         for (const entity of allEntitiesForBusiness) {
            const code = entity.generatedCodes?.find(c => c.value.toUpperCase() === scannedCode.toUpperCase());
            if (code) {
                entityMatch = entity; // We found the entity, but it might not be active/valid
                codeMatch = code; // We found the code
                break;
            }
        }
      }


      setFoundEntity(entityMatch);
      setFoundCode(codeMatch);
      setIsLoading(false);
      setSearchPerformed(true);
    }, 1000);
  };

  const handleValidateAndRedeem = () => {
    if (!foundEntity || !foundCode) return;

    // In a real app, this would be an API call. Here we simulate by updating mock data state.
    // This is tricky as this page's mock data is a copy. A real backend or global state manager is needed.
    // For now, just show a toast and visually update the local `foundCode`.
    
    const updatedCode = { ...foundCode, status: 'redeemed' as GeneratedCode['status'], redemptionDate: new Date().toISOString() };
    setFoundCode(updatedCode); // Visually update locally

    // Attempt to update the main list (won't persist if page re-renders fully from original mocks)
    setActiveBusinessEntities(prevEntities => prevEntities.map(entity => {
        if (entity.id === foundEntity.id) {
            return {
                ...entity,
                generatedCodes: entity.generatedCodes?.map(gc => gc.id === foundCode.id ? updatedCode : gc)
            };
        }
        return entity;
    }));

    toast({ title: "¡QR Validado y Canjeado!", description: `Código ${foundCode.value} para "${foundEntity.name}" marcado como utilizado.`, className: "bg-green-500 text-white" });
  };

  const isCodeRedeemable = () => {
    if (!foundEntity || !foundCode) return false;
    const now = new Date();
    const entityActiveAndCurrent = foundEntity.isActive && new Date(foundEntity.startDate) <= now && new Date(foundEntity.endDate) >= now;
    
    if (!entityActiveAndCurrent) return false; // Entity itself is not valid for redemption

    if (foundCode.status !== 'available') return false; // Code not available

    if (foundEntity.type === 'event' && foundEntity.maxAttendance && foundEntity.maxAttendance > 0) {
      const redeemedCount = foundEntity.generatedCodes?.filter(c => c.status === 'redeemed').length || 0;
      if (redeemedCount >= foundEntity.maxAttendance) return false; // Event full
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
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <QrCode className="h-8 w-8 mr-2" /> Validación de Códigos QR
      </h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Ingresar Código del Cliente</CardTitle>
          <CardDescription>Escribe el código de 9 dígitos que te muestra el cliente.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            type="text"
            value={scannedCode}
            onChange={(e) => setScannedCode(e.target.value.toUpperCase())}
            placeholder="ABC123XYZ"
            maxLength={9}
            className="text-lg flex-grow tracking-wider"
            disabled={isLoading}
          />
          <Button onClick={handleSearchCode} disabled={isLoading || scannedCode.length !== 9} className="bg-primary hover:bg-primary/90">
            <Search className="mr-2 h-4 w-4" /> {isLoading ? "Buscando..." : "Buscar Código"}
          </Button>
        </CardContent>
      </Card>

      {searchPerformed && (
        <Card className="shadow-xl animate-in fade-in-50">
          <CardHeader>
            <CardTitle>Resultado de la Búsqueda</CardTitle>
          </CardHeader>
          <CardContent>
            {!foundCode && !foundEntity && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Código No Encontrado</AlertTitle>
                <AlertDescription>El código "{scannedCode}" no se encontró en ninguna promoción o evento activo de este negocio.</AlertDescription>
              </Alert>
            )}
            {foundCode && foundEntity && (
              <div className="space-y-4">
                 <Alert variant={isCodeRedeemable() ? "default" : (foundCode.status === 'redeemed' ? "default" : "destructive")} 
                       className={isCodeRedeemable() ? "bg-green-50 border-green-300" : (foundCode.status === 'redeemed' ? "bg-blue-50 border-blue-300" : "")}>
                  {isCodeRedeemable() ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : (foundCode.status === 'redeemed' ? <Info className="h-5 w-5 text-blue-600" /> : <XCircle className="h-5 w-5 text-red-600" />) }
                  <AlertTitle className={isCodeRedeemable() ? "text-green-700" : (foundCode.status === 'redeemed' ? "text-blue-700" : "text-red-700")}>
                    {isCodeRedeemable() ? "Código Válido y Disponible" : `Estado: ${statusTranslations[foundCode.status]}`}
                  </AlertTitle>
                  <AlertDescription>
                    {!isCodeRedeemable() && foundEntity.isActive && new Date(foundEntity.startDate) <= new Date() && new Date(foundEntity.endDate) >= new Date() && foundCode.status === 'available' && foundEntity.type === 'event' && foundEntity.maxAttendance && (foundEntity.generatedCodes?.filter(c => c.status === 'redeemed').length || 0) >= foundEntity.maxAttendance && (
                        "El evento ha alcanzado su aforo máximo."
                    )}
                    {!isCodeRedeemable() && foundEntity.isActive && (new Date(foundEntity.startDate) > new Date() || new Date(foundEntity.endDate) < new Date()) && (
                        `La entidad "${foundEntity.name}" no está vigente (Vigencia: ${format(new Date(foundEntity.startDate), "P", {locale: es})} - ${format(new Date(foundEntity.endDate), "P", {locale: es})}).`
                    )}
                     {!isCodeRedeemable() && !foundEntity.isActive && (
                        `La entidad "${foundEntity.name}" está actualmente INACTIVA.`
                    )}
                  </AlertDescription>
                </Alert>

                <h3 className="text-xl font-semibold text-primary">{foundEntity.name}</h3>
                <p className="text-sm text-muted-foreground">{foundEntity.description}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><CalendarDays className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Vigencia:</strong> {format(new Date(foundEntity.startDate), "P", { locale: es })} - {format(new Date(foundEntity.endDate), "P", { locale: es })}</div>
                  <div><Ticket className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Tipo:</strong> {foundEntity.type === "promotion" ? "Promoción" : "Evento"}</div>
                  {foundEntity.type === 'event' && <div><Users className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Aforo:</strong> {getEventAttendance(foundEntity)}</div>}
                  <div><Clock className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Código Creado:</strong> {format(new Date(foundCode.generatedDate), "Pp", { locale: es })} por {foundCode.generatedByName}</div>
                  {foundCode.redeemedByInfo && (
                     <div><User className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Canjeado por:</strong> {foundCode.redeemedByInfo.name} (DNI: {foundCode.redeemedByInfo.dni})</div>
                  )}
                  {foundCode.redemptionDate && (
                     <div><CheckCircle2 className="inline mr-1 h-4 w-4 text-muted-foreground" /> <strong>Fecha Canje:</strong> {format(new Date(foundCode.redemptionDate), "Pp", { locale: es })}</div>
                  )}
                </div>
                {foundCode.observation && <p className="text-sm italic"><Info className="inline mr-1 h-4 w-4"/> Observación del código: {foundCode.observation}</p>}
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
          <CardTitle>Promociones y Eventos Activos Hoy</CardTitle>
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
                    {entity.type === 'event' && <p>{getEventAttendance(entity)}</p>}
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
