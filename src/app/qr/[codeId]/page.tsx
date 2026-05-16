"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NextImage from "next/image";
import Link from 'next/link';
import QRCode from "qrcode";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import type { BusinessManagedEntity, Business, QrClient, QrCodeData, GeneratedCode } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Download, ArrowLeft, UserCircle, Building } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import * as htmlToImage from 'html-to-image';
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { anyToDate } from '@/lib/utils';

export default function QrDisplayPage() {
  const params = useParams();
  const router = useRouter();
  const { codeId } = params;
  const { toast } = useToast();

  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [isDrawingCanvas, setIsDrawingCanvas] = useState(false);
  const [isGeneratingDownload, setIsGeneratingDownload] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchQrData = useCallback(async () => {
    if (typeof codeId !== 'string' || !codeId) {
      setError("ID de código no válido.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // 1. Find the entity containing the code
      const q = query(collection(db, "businessEntities"));
      const querySnapshot = await getDocs(q);
      
      let foundEntity: BusinessManagedEntity | null = null;
      let foundCode: GeneratedCode | null = null;
      
      for (const docSnap of querySnapshot.docs) {
          const entity = { id: docSnap.id, ...docSnap.data() } as BusinessManagedEntity;
          const code = entity.generatedCodes?.find(c => c.id === codeId);
          if (code) {
              foundEntity = entity;
              foundCode = code;
              break;
          }
      }

      if (!foundEntity || !foundCode || !foundCode.redeemedByInfo?.dni) {
        throw new Error("No se encontró el código QR o no está asociado a un cliente.");
      }

      // 2. Fetch business details
      const businessDocRef = doc(db, "businesses", foundEntity.businessId);
      const businessSnap = await getDoc(businessDocRef);
      if (!businessSnap.exists()) throw new Error("No se pudo encontrar el negocio asociado.");
      setBusinessDetails({ id: businessSnap.id, ...businessSnap.data() } as Business);
      
      // 3. Fetch client data
      const clientQuery = query(collection(db, "qrClients"), where("dni", "==", foundCode.redeemedByInfo.dni), limit(1));
      const clientSnap = await getDocs(clientQuery);
      if (clientSnap.empty) throw new Error("No se encontró el perfil del cliente asociado.");
      
      const clientData = { id: clientSnap.docs[0].id, ...clientSnap.docs[0].data() } as QrClient;

      const ticketType = foundEntity.ticketTypes?.find(t => t.id === foundCode!.ticketTypeId);
      
      const promotionDetails: QrCodeData["promotion"] = {
        id: foundEntity.id,
        title: foundEntity.name,
        description: foundEntity.description,
        validUntil: anyToDate(foundEntity.endDate)?.toISOString() || new Date().toISOString(),
        imageUrl: foundEntity.imageUrl || "",
        promoCode: foundCode.value,
        qrValue: foundCode.id,
        aiHint: foundEntity.aiHint || "",
        type: foundEntity.type,
        termsAndConditions: foundEntity.termsAndConditions,
        qrTemplateImageUrl: foundEntity.qrTemplateImageUrl,
        qrTemplateLayout: foundEntity.qrTemplateLayout,
        ticketType: ticketType ? { name: ticketType.name, cost: ticketType.cost, color: ticketType.color } : undefined,
      };

      setQrData({
        user: clientData,
        promotion: promotionDetails,
        code: foundCode.id,
        status: foundCode.status,
      });

    } catch (err: any) {
      setError(err.message || "Ocurrió un error al cargar los datos del QR.");
    } finally {
      setIsLoading(false);
    }
  }, [codeId]);

  useEffect(() => {
    fetchQrData();
  }, [fetchQrData]);

  const drawPreviewOnCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !qrData || !qrData.promotion.qrTemplateImageUrl) return;

    setIsDrawingCanvas(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsDrawingCanvas(false);
      return;
    }
    
    try {
        const templateImg = new Image();
        templateImg.crossOrigin = "anonymous";
        templateImg.src = qrData.promotion.qrTemplateImageUrl;
        await new Promise<void>((resolve, reject) => {
            templateImg.onload = () => resolve();
            templateImg.onerror = () => reject(new Error("Image load error"));
        });

        canvas.width = templateImg.width;
        canvas.height = templateImg.height;
        ctx.drawImage(templateImg, 0, 0);

        const layout = qrData.promotion.qrTemplateLayout;
        if (!layout) throw new Error("Layout data is missing");

        const qrDataUrl = await QRCode.toDataURL(qrData.promotion.qrValue, { 
          width: layout.qr.size, 
          errorCorrectionLevel: 'H', 
          margin: 1, 
          color: { dark: layout.qr.color || '#000000', light: '#0000' } 
        });
        const qrImage = new Image();
        qrImage.src = qrDataUrl;
        await new Promise(resolve => qrImage.onload = resolve);
        ctx.drawImage(qrImage, layout.qr.x - layout.qr.size / 2, layout.qr.y - layout.qr.size / 2);

        ctx.textAlign = 'center';
        const maxWidth = canvas.width * 0.9;
        
        const fullName = `${qrData.user.name} ${qrData.user.surname}`;
        let nameFontSize = layout.name.size || 16;
        ctx.font = `bold ${nameFontSize}px ${layout.name.fontFamily || 'Arial, sans-serif'}`;
        ctx.fillStyle = layout.name.color || '#FFFFFF';
        while(ctx.measureText(fullName).width > maxWidth && nameFontSize > 8) { nameFontSize--; ctx.font = `bold ${nameFontSize}px ${layout.name.fontFamily || 'Arial, sans-serif'}`; }
        ctx.fillText(fullName, layout.name.x, layout.name.y);

        ctx.font = `bold ${layout.dni.size || 12}px ${layout.dni.fontFamily || 'Arial, sans-serif'}`;
        ctx.fillStyle = layout.dni.color || '#FFFFFF';
        ctx.fillText(`DNI/CE: ${qrData.user.dni}`, layout.dni.x, layout.dni.y);

        let promoFontSize = layout.promoTitle.size || 14;
        ctx.font = `bold ${promoFontSize}px ${layout.promoTitle.fontFamily || 'Arial, sans-serif'}`;
        ctx.fillStyle = layout.promoTitle.color || '#FFFFFF';
        while(ctx.measureText(qrData.promotion.title).width > maxWidth && promoFontSize > 8) { promoFontSize--; ctx.font = `bold ${promoFontSize}px ${layout.promoTitle.fontFamily || 'Arial, sans-serif'}`; }
        ctx.fillText(qrData.promotion.title, layout.promoTitle.x, layout.promoTitle.y);

        if (qrData.promotion.ticketType?.name && layout.ticketType) {
            const ticketType = qrData.promotion.ticketType;
            const ticketLayout = layout.ticketType;
            
            const rectX = ticketLayout.x - (ticketLayout.width / 2);
            const rectY = ticketLayout.y - (ticketLayout.height / 2);
            const borderRadius = ticketLayout.height / 2;
            
            ctx.fillStyle = ticketType.color || "#888888";
            ctx.beginPath();
            ctx.roundRect(rectX, rectY, ticketLayout.width, ticketLayout.height, borderRadius);
            ctx.fill();

            ctx.font = `bold ${ticketLayout.size || 16}px ${ticketLayout.fontFamily || 'Arial, sans-serif'}`;
            ctx.fillStyle = ticketLayout.textColor || "#FFFFFF";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(ticketType.name.toUpperCase(), ticketLayout.x, ticketLayout.y);
        }
    } catch (err) {
        console.error("Error drawing QR on canvas:", err);
        if (ctx) {
          ctx.fillStyle = 'red';
          ctx.fillText('Error al generar plantilla.', canvas.width / 2, canvas.height / 2);
        }
    } finally {
        setIsDrawingCanvas(false);
    }
  }, [qrData]);

  const generateDefaultCardAsCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !qrData || !businessDetails || !qrCodeImage) return null;

    const scale = 2;
    const width = 384;
    const height = 600;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    ctx.fillStyle = '#212121';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(qrData.promotion.type === "event" ? "Tu Entrada para el Evento" : "Tu Promoción", width / 2, 50);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(`Presenta este código en ${businessDetails.name}`, width / 2, 75);

    const qrImg = new Image();
    qrImg.src = qrCodeImage;
    await new Promise(resolve => { qrImg.onload = resolve; });
    
    const qrSize = 250;
    const qrX = (width - qrSize) / 2;
    const qrY = 110;
    
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.roundRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 8);
    ctx.fill();
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    const textYStart = qrY + qrSize + 40;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${qrData.user.name} ${qrData.user.surname}`, width / 2, textYStart);
    
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(`DNI/CE: ${qrData.user.dni}`, width / 2, textYStart + 25);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(width * 0.1, textYStart + 45, width * 0.8, 1);

    const promoYStart = textYStart + 65;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(qrData.promotion.title, width / 2, promoYStart);

    let lastElementY = promoYStart;

    if (qrData.promotion.ticketType?.name) {
        const ticketType = qrData.promotion.ticketType;
        const ticketY = promoYStart + 25;
        
        ctx.font = "bold 12px sans-serif";
        const textWidth = ctx.measureText(ticketType.name.toUpperCase()).width;
        const rectWidth = textWidth + 24;
        const rectHeight = 22;
        const rectX = (width - rectWidth) / 2;
        
        ctx.fillStyle = ticketType.color || "#888888";
        ctx.beginPath();
        ctx.roundRect(rectX, ticketY - rectHeight / 2, rectWidth, rectHeight, rectHeight / 2);
        ctx.fill();
        
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ticketType.name.toUpperCase(), width / 2, ticketY);
        ctx.textBaseline = "alphabetic";
        lastElementY = ticketY + (rectHeight / 2) + 20;
    } else {
        lastElementY = promoYStart + 25;
    }

    if (qrData.promotion.promoCode !== 'PUBLIC_ACCESS') {
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(`Código: ${qrData.promotion.promoCode}`, width / 2, lastElementY);
        lastElementY += 15;
    }
    
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(`Válido hasta: ${format(anyToDate(qrData.promotion.validUntil)!, "dd MMMM, yyyy", { locale: es })}`, width / 2, lastElementY);

    return canvas;
  }, [qrData, businessDetails, qrCodeImage]);

  useEffect(() => {
    if (qrData?.promotion.qrValue) {
      if (qrData.promotion.qrTemplateImageUrl) {
        drawPreviewOnCanvas();
      } else {
        QRCode.toDataURL(qrData.promotion.qrValue, { width: 400, errorCorrectionLevel: 'H' }, (err, url) => {
          if (err) setQrCodeImage(null);
          else setQrCodeImage(url);
        });
      }
    }
  }, [qrData, drawPreviewOnCanvas]);

  const handleSaveQrWithDetails = async () => {
    if (isGeneratingDownload) return;
    setIsGeneratingDownload(true);
    toast({ title: "Preparando descarga...", description: "Por favor, espera." });

    try {
        let dataUrl: string;

        if (qrData?.promotion.qrTemplateImageUrl && canvasRef.current) {
            dataUrl = await htmlToImage.toPng(canvasRef.current, { quality: 1.0, pixelRatio: 2 });
        } else if (!qrData?.promotion.qrTemplateImageUrl) {
            const canvas = await generateDefaultCardAsCanvas();
            if (!canvas) {
                throw new Error("No se pudo generar el lienzo para la descarga.");
            }
            dataUrl = canvas.toDataURL('image/png');
        } else {
            throw new Error("No se encontró un elemento válido para descargar.");
        }

        const link = document.createElement('a');
        link.download = `SocioVIP_QR_${qrData?.promotion.promoCode || 'socio'}.png`;
        link.href = dataUrl;
        link.click();
        toast({ title: "QR Guardado", description: "La imagen de la tarjeta se ha descargado." });

    } catch (error: any) {
        console.error('Error saving QR image:', error);
        toast({ title: "Error al Guardar", description: `No se pudo generar la imagen: ${error.message}`, variant: "destructive" });
    } finally {
        setIsGeneratingDownload(false);
    }
  };
  
  const handleBackToBusinessPage = () => {
    if (businessDetails?.customUrlPath) {
      router.push(`/${businessDetails.customUrlPath}`);
    } else {
      router.push('/');
    }
  };

  const QrPageFooter = () => (
    <footer className="sticky bottom-0 z-20 w-full bg-background/95 backdrop-blur-sm py-3 px-4 border-t border-white/10">
      <div className="max-w-4xl mx-auto grid grid-cols-4 items-center gap-2">
        <Link href="/login" passHref legacyBehavior>
          <Button variant="outline" className="w-full font-bold hover:bg-muted hover:text-muted-foreground border-white/20" title="Iniciar Sesión">
            <UserCircle className="h-5 w-5 sm:mr-2" />
            <span className="hidden sm:inline">Iniciar Sesión</span>
          </Button>
        </Link>
        <Button onClick={handleSaveQrWithDetails} variant="outline" className="w-full font-bold hover:bg-muted hover:text-muted-foreground border-white/20" title="Guardar QR" disabled={isGeneratingDownload}>
          {isGeneratingDownload ? <Loader2 className="h-5 w-5 sm:mr-2 animate-spin" /> : <Download className="h-5 w-5 sm:mr-2" />}
          <span className="hidden sm:inline">Guardar QR</span>
        </Button>
        <Button onClick={handleBackToBusinessPage} variant="outline" className="w-full font-bold hover:bg-muted hover:text-muted-foreground border-white/20" title="Ver Negocio">
          <Building className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Ver Negocio</span>
        </Button>
        <Link href="/" passHref legacyBehavior>
          <Button variant="outline" className="w-full font-bold hover:bg-muted hover:text-muted-foreground border-white/20" title="Volver al Inicio">
            <ArrowLeft className="h-5 w-5 sm:mr-2" />
            <span className="hidden sm:inline">Volver</span>
          </Button>
        </Link>
      </div>
    </footer>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-loader">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative p-[2px] rounded-full shadow-2xl bg-white/95 animate-drop-in animate-float mb-6 max-w-[85vw]">
            <SocioVipLogo size={240} variant="pill" />
          </div>
          <p className="mt-4 text-lg font-semibold text-white/90">Generando tu entrada QR, por favor espera...</p>
          <p className="mt-1 text-sm text-white/80">No cierres esta ventana.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4 bg-black">
        <AlertTriangle className="h-20 w-20 text-destructive mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-destructive">Error al Cargar QR</h1>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link href="/" passHref><Button variant="outline" className="mt-6">Volver al Inicio</Button></Link>
      </div>
    );
  }

  if (!qrData || !businessDetails) return null;
  
  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col">
      {/* Background Image */}
      {qrData.promotion.imageUrl && (
        <div className="fixed inset-0 z-0">
          <NextImage
            src={qrData.promotion.imageUrl}
            alt="Fondo de la promoción"
            fill
            className="object-cover blur-sm scale-105 brightness-[0.7]"
            data-ai-hint={qrData.promotion.aiHint || "promotion background"}
          />
        </div>
      )}
      
      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-screen">
        <header className="py-4 px-4 sm:px-6 lg:px-8 shadow-sm sticky top-0 z-20 w-full bg-black/40 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto flex items-center justify-start">
            {businessDetails.logoUrl && <NextImage src={businessDetails.logoUrl} alt={`${businessDetails.name} logo`} width={40} height={40} className="h-10 w-10 object-contain rounded-md bg-white/20 p-1 mr-4" />}
            <h1 className="font-semibold text-xl text-white">{businessDetails.name}</h1>
            {businessDetails.slogan && <p className="text-xs text-white/80 ml-3 hidden sm:block">{businessDetails.slogan}</p>}
          </div>
        </header>

        <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-8 [perspective:1000px]">
          {qrData.promotion.qrTemplateImageUrl ? (
            <div className="relative w-full max-w-sm shadow-2xl rounded-xl overflow-hidden ring-1 ring-white/20">
              {isDrawingCanvas && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl">
                  <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />
                  <p className="text-lg font-semibold text-white">Generando tu QR...</p>
                  <p className="text-sm text-white/70">Espera un momento, por favor.</p>
                </div>
              )}
              <canvas ref={canvasRef} className="w-full h-auto" />
            </div>
          ) : (
            <Card 
              ref={cardRef} 
              className="w-full max-w-sm shadow-2xl rounded-2xl overflow-hidden bg-white/10 backdrop-blur-lg border-white/20 text-white animate-flip-in"
              style={{ animation: 'flip-in 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards' }}
            >
              <CardHeader className="text-center pb-4 border-b border-white/10">
                <CardTitle className="text-xl font-bold tracking-tight">{qrData.promotion.type === "event" ? "Tu Entrada para el Evento" : "Tu Promoción"}</CardTitle>
                <CardDescription className="text-white/70">Presenta este código en {businessDetails.name}.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-6 pt-6">
                {qrCodeImage ? (
                  <div className="relative p-2 bg-white rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.3)] animate-pulse-glow">
                    <NextImage src={qrCodeImage} alt="Tu código QR" width={240} height={240} className="rounded-xl" />
                  </div>
                ) : (
                  <div className="h-[240px] w-[240px] flex items-center justify-center border border-white/10 rounded-2xl bg-white/5 text-white/80">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                )}
                
                <div className="text-center space-y-1">
                  <p className="text-xl font-bold">Hola, {qrData.user.name}</p>
                  <p className="text-sm text-white/60">DNI/CE: {qrData.user.dni}</p>
                </div>
                
                <Separator className="bg-white/10" />
                
                <div className="text-center space-y-3 w-full pb-2">
                  <p className="font-bold text-lg leading-tight">{qrData.promotion.title}</p>
                  
                  {qrData.promotion.ticketType?.name && (
                    <div className="flex justify-center">
                        <div
                          className="inline-block text-white rounded-full px-6 py-1.5 text-xs font-black shadow-lg uppercase tracking-wider"
                          style={{ backgroundColor: qrData.promotion.ticketType.color || '#888' }}
                        >
                          {qrData.promotion.ticketType.name}
                        </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col space-y-1 text-xs text-white/50 font-medium">
                    {qrData.promotion.promoCode !== 'PUBLIC_ACCESS' && (
                       <p>CÓDIGO: <span className="text-white font-mono">{qrData.promotion.promoCode}</span></p>
                    )}
                    <p>VÁLIDO HASTA: <span className="text-white">{format(anyToDate(qrData.promotion.validUntil)!, "dd MMMM, yyyy", { locale: es })}</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
        <QrPageFooter />
      </div>
    </div>
  );
}
