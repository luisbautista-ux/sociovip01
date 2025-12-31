

"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NextImage from "next/image";
import Link from 'next/link';
import QRCode from "qrcode";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import type { BusinessManagedEntity, Business, QrClient, QrCodeData, GeneratedCode, TicketType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Download, ArrowLeft, UserCircle, QrCode } from "lucide-react";
import { SocioVipLogo } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import * as htmlToImage from 'html-to-image';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
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
      
      for (const doc of querySnapshot.docs) {
          const entity = { id: doc.id, ...doc.data() } as BusinessManagedEntity;
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

      const ticketType = foundEntity.ticketTypes?.find(t => t.id === foundCode.ticketTypeId);
      const promotionDetails: QrCodeData["promotion"] = {
        id: foundEntity.id,
        title: foundEntity.name,
        description: foundEntity.description,
        validUntil: foundEntity.endDate,
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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
        const templateImg = new Image();
        templateImg.crossOrigin = "anonymous";
        templateImg.src = qrData.promotion.qrTemplateImageUrl;
        await new Promise<void>((resolve, reject) => {
            templateImg.onload = () => resolve();
            templateImg.onerror = (err) => reject(new Error("Image load error"));
        });

        canvas.width = templateImg.width;
        canvas.height = templateImg.height;
        ctx.drawImage(templateImg, 0, 0);

        const layout = qrData.promotion.qrTemplateLayout;
        if (!layout) throw new Error("Layout data is missing");

        const qrDataUrl = await QRCode.toDataURL(qrData.promotion.qrValue, { width: layout.qr.size, errorCorrectionLevel: 'H', margin: 1, color: { dark: layout.qr.color || '#000000', light: '#0000' } });
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
    }
  }, [qrData]);

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
    const elementToCapture = qrData?.promotion.qrTemplateImageUrl ? canvasRef.current : cardRef.current;
    if (!elementToCapture) {
        toast({ title: "Error", description: "No se encontró el elemento para descargar.", variant: "destructive" });
        return;
    }
    try {
        const dataUrl = await htmlToImage.toPng(elementToCapture, { quality: 1.0, pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `SocioVIP_QR_${qrData?.promotion.promoCode}.png`;
        link.href = dataUrl;
        link.click();
        toast({ title: "QR Guardado", description: "La imagen de la tarjeta se ha descargado." });
    } catch (error) {
        console.error('Error saving QR image:', error);
        toast({ title: "Error al Guardar", description: "No se pudo generar la imagen.", variant: "destructive" });
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
    <footer className="sticky bottom-0 z-20 w-full bg-background/95 backdrop-blur-sm py-3 px-4 border-t">
      <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 items-center gap-2">
        <Link href="/login" passHref><Button variant="outline" className="w-full font-bold"><UserCircle className="mr-2 h-4 w-4" /> Iniciar Sesión</Button></Link>
        <Button onClick={handleSaveQrWithDetails} variant="outline" className="w-full font-bold"><Download className="mr-2 h-4 w-4" /> Guardar QR</Button>
        <Button onClick={handleBackToBusinessPage} variant="outline" className="w-full font-bold">Ver Otras del Negocio</Button>
        <Link href="/" passHref><Button variant="outline" className="w-full font-bold sm:col-span-1"><ArrowLeft className="mr-2 h-4 w-4" /> Volver al Inicio</Button></Link>
      </div>
    </footer>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-loader">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative p-1 rounded-full shadow-lg bg-white/90 animate-drop-in animate-float">
            <QrCode size={70} className="text-primary"/>
          </div>
          <p className="mt-4 text-lg font-semibold text-white/90">Generando tu entrada QR, por favor espera...</p>
          <p className="mt-1 text-sm text-white/80">No cierres esta ventana.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <AlertTriangle className="h-20 w-20 text-destructive mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-destructive">Error al Cargar QR</h1>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link href="/" passHref><Button variant="outline" className="mt-6">Volver al Inicio</Button></Link>
      </div>
    );
  }

  if (!qrData || !businessDetails) return null;
  
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="py-4 px-4 sm:px-6 lg:px-8 shadow-sm sticky top-0 z-20 w-full bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-start">
          {businessDetails.logoUrl && <NextImage src={businessDetails.logoUrl} alt={`${businessDetails.name} logo`} width={40} height={40} className="h-10 w-10 object-contain rounded-md bg-white/20 p-1 mr-4" />}
          <h1 className="font-semibold text-xl" style={{ color: businessDetails.primaryColor }}>{businessDetails.name}</h1>
          {businessDetails.slogan && <p className="text-xs text-muted-foreground ml-3">{businessDetails.slogan}</p>}
        </div>
      </header>
      <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-8">
        {qrData.promotion.qrTemplateImageUrl ? (
          <div className="w-full max-w-sm shadow-xl rounded-xl">
            <canvas ref={canvasRef} className="w-full h-auto" />
          </div>
        ) : (
          <Card ref={cardRef} className="w-full max-w-sm shadow-xl rounded-xl overflow-hidden">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl font-bold">{qrData.promotion.type === "event" ? "Tu Entrada para el Evento" : "Tu Promoción"}</CardTitle>
              <CardDescription>Presenta este código en {businessDetails.name}.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              {qrCodeImage ? <NextImage src={qrCodeImage} alt="Tu código QR" width={250} height={250} className="rounded-lg border p-1" /> : <div className="h-[250px] w-[250px] flex items-center justify-center border rounded-lg bg-muted text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>}
              <div className="text-center">
                <p className="text-lg font-semibold">Hola, {qrData.user.name} {qrData.user.surname}</p>
                <p className="text-sm text-muted-foreground">DNI/CE: {qrData.user.dni}</p>
              </div>
              <Separator />
              <div className="text-center">
                 <p className="font-semibold">{qrData.promotion.title}</p>
                 {qrData.promotion.ticketType && <div className="flex justify-center mt-2"><div className="inline-block text-white rounded-full px-4 py-1 text-sm font-bold shadow-md" style={{ backgroundColor: qrData.promotion.ticketType.color || '#888' }}>{qrData.promotion.ticketType.name.toUpperCase()}</div></div>}
                 <p className="text-xs text-muted-foreground mt-1">Válido hasta: {format(parseISO(qrData.promotion.validUntil), "dd MMMM, yyyy", { locale: es })}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <QrPageFooter />
    </div>
  );
}
