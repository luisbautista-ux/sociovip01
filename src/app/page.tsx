
"use client";

import { useState, useRef, useCallback, ChangeEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { generateTiling, type GenerateTilingInput } from "@/ai/flows/generate-tiling";
import QRCode from 'qrcode';
import { UploadCloud, Sparkles, Link as LinkIcon, Download, QrCode as QrCodeLucide, Image as ImageIconLucide, Loader2, FileImage, Palette } from 'lucide-react';
import { Separator } from "@/components/ui/separator";

export default function QRCodeCustomizerPage() {
  const [styleImageFile, setStyleImageFile] = useState<File | null>(null);
  const [styleImageDataUri, setStyleImageDataUri] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [seamlessPatternDataUri, setSeamlessPatternDataUri] = useState<string | null>(null);
  const [qrContent, setQrContent] = useState<string>("https://example.com");
  const [plainQrCodeDataUri, setPlainQrCodeDataUri] = useState<string | null>(null);
  const [finalStyledQrDataUri, setFinalStyledQrDataUri] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  const { toast } = useToast();
  const styleImageInputRef = useRef<HTMLInputElement>(null);

  const handleStyleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // Limit file size to 4MB
        toast({
          title: "Error",
          description: "El archivo es demasiado grande. El límite es 4MB.",
          variant: "destructive",
        });
        return;
      }
      setStyleImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setStyleImageDataUri(e.target?.result as string);
        setSeamlessPatternDataUri(null); // Reset pattern if new image is uploaded
        setFinalStyledQrDataUri(null); // Reset final QR
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerStyleImageUpload = () => {
    styleImageInputRef.current?.click();
  };

  const handleGenerateTiling = async () => {
    if (!styleImageDataUri) {
      toast({
        title: "Error",
        description: "Por favor, sube una imagen de estilo primero.",
        variant: "destructive",
      });
      return;
    }
    setIsAiProcessing(true);
    setSeamlessPatternDataUri(null);
    try {
      const input: GenerateTilingInput = { imageDataUri: styleImageDataUri };
      const result = await generateTiling(input);
      setSeamlessPatternDataUri(result.tiledImageDataUri);
      toast({
        title: "Éxito",
        description: "Patrón de mosaico generado por IA.",
      });
    } catch (error) {
      console.error("Error generating tiling:", error);
      toast({
        title: "Error de IA",
        description: "No se pudo generar el patrón de mosaico. Intenta con otra imagen o más tarde.",
        variant: "destructive",
      });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const generateAndStyleQrCode = useCallback(async () => {
    if (!qrContent) {
      toast({ title: "Error", description: "Por favor, ingresa contenido para el QR.", variant: "destructive" });
      return;
    }
    if (!seamlessPatternDataUri) {
      toast({ title: "Error", description: "Primero genera un patrón de mosaico.", variant: "destructive" });
      return;
    }

    setIsGeneratingQr(true);
    setFinalStyledQrDataUri(null);

    try {
      // Generate plain QR code data for structure
      const qrCodeCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCodeCanvas, qrContent, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 512, 
        color: { dark: '#000000FF', light: '#FFFFFFFF' } 
      });
      
      const plainQrImage = new Image();
      plainQrImage.src = qrCodeCanvas.toDataURL();

      await new Promise<void>(resolve => { plainQrImage.onload = () => resolve(); });

      const patternImage = new Image();
      patternImage.src = seamlessPatternDataUri;
      await new Promise<void>(resolve => { patternImage.onload = () => resolve(); });

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = plainQrImage.width;
      finalCanvas.height = plainQrImage.height;
      const ctx = finalCanvas.getContext('2d');

      if (ctx) {
        // Step 1: Draw the background (light modules)
        // For simplicity, we assume the QR background is white.
        // So, we'll make the canvas background white.
        ctx.fillStyle = '#FFFFFF'; // Or use theme background: 'hsl(var(--background))' if it's light
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        
        // Step 2: Create a temporary canvas for the pattern fill
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = finalCanvas.width;
        patternCanvas.height = finalCanvas.height;
        const patternCtx = patternCanvas.getContext('2d');
        if (patternCtx) {
          const fillPattern = patternCtx.createPattern(patternImage, 'repeat');
          if (fillPattern) {
            patternCtx.fillStyle = fillPattern;
            patternCtx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
          }
        }

        // Step 3: Use the plain QR code as a mask for the pattern
        // Draw the pattern canvas (which is filled with the pattern)
        ctx.drawImage(patternCanvas, 0, 0);

        // Then, use the 'destination-in' composite operation. This keeps parts of the
        // patternCanvas (target) where the plainQrImage (source) is opaque.
        // Since plain QR has black (opaque) and white (opaque), we need to modify plainQR.
        // Let's make white transparent on a temporary QR canvas.
        const tempQrMaskCanvas = document.createElement('canvas');
        tempQrMaskCanvas.width = plainQrImage.width;
        tempQrMaskCanvas.height = plainQrImage.height;
        const tempQrMaskCtx = tempQrMaskCanvas.getContext('2d');
        if (tempQrMaskCtx) {
          tempQrMaskCtx.drawImage(plainQrImage, 0, 0);
          const imageData = tempQrMaskCtx.getImageData(0, 0, tempQrMaskCanvas.width, tempQrMaskCanvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            // If pixel is white (or close to white), make it transparent
            if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) { // Threshold for white
              data[i+3] = 0; // Alpha to 0
            }
          }
          tempQrMaskCtx.putImageData(imageData, 0, 0);
          
          // Apply mask
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(tempQrMaskCanvas, 0, 0);
          ctx.globalCompositeOperation = 'source-over'; // Reset
        }
        
        setFinalStyledQrDataUri(finalCanvas.toDataURL('image/png'));
      } else {
        throw new Error("Could not get canvas context for final QR.");
      }
      
      const plainUri = await QRCode.toDataURL(qrContent, { errorCorrectionLevel: 'H', margin: 2, width: 256 });
      setPlainQrCodeDataUri(plainUri);

    } catch (error) {
      console.error("Error generating/styling QR Code:", error);
      toast({ title: "Error", description: "No se pudo generar o aplicar estilo al código QR.", variant: "destructive" });
      setPlainQrCodeDataUri(null);
    } finally {
      setIsGeneratingQr(false);
    }
  }, [qrContent, seamlessPatternDataUri, toast]);


  const handleDownloadFinalQr = () => {
    if (!finalStyledQrDataUri) {
      toast({ title: "Error", description: "No hay QR estilizado para descargar.", variant: "destructive" });
      return;
    }
    const link = document.createElement('a');
    link.href = finalStyledQrDataUri;
    link.download = `socioVip_styled_qr_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 bg-background">
      <header className="w-full max-w-4xl mb-8 text-center pt-8">
        <h1 className="text-4xl font-bold text-primary tracking-tight">QR Code Customizer</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Personaliza tus códigos QR con estilos únicos generados por IA.
        </p>
      </header>

      <main className="w-full max-w-4xl space-y-8">
        {/* Step 1: Upload Style Image */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center font-headline"><ImageIconLucide className="mr-2 h-6 w-6 text-primary" /> Paso 1: Sube tu Imagen de Estilo</CardTitle>
            <CardDescription className="font-body">
              Sube una imagen (textura, patrón, diseño) que servirá de base para el mosaico.
              Se recomienda una imagen cuadrada y relativamente simple para mejores resultados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center space-y-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleStyleImageUpload}
                ref={styleImageInputRef}
                className="hidden"
                id="style-image-upload"
              />
              <Button onClick={triggerStyleImageUpload} variant="outline" className="w-full sm:w-auto" disabled={isAiProcessing}>
                <UploadCloud className="mr-2 h-5 w-5" /> Seleccionar Imagen (máx 4MB)
              </Button>
              {styleImageFile && <p className="text-sm text-muted-foreground font-body">Archivo: {styleImageFile.name}</p>}
            </div>
            {styleImageDataUri && (
              <div className="mt-4 p-4 border border-dashed rounded-md flex flex-col items-center">
                <p className="text-sm font-medium mb-2 font-headline">Previsualización de Imagen de Estilo:</p>
                <Image src={styleImageDataUri} alt="Style preview" width={200} height={200} className="rounded-md object-contain border bg-muted" data-ai-hint="pattern texture"/>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Generate Tiling */}
        {styleImageDataUri && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center font-headline"><Palette className="mr-2 h-6 w-6 text-primary" /> Paso 2: Generar Patrón de Mosaico con IA</CardTitle>
              <CardDescription className="font-body">
                Nuestra IA creará un patrón de mosaico continuo a partir de tu imagen.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={handleGenerateTiling} disabled={isAiProcessing || !styleImageDataUri} className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90">
                {isAiProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                {isAiProcessing ? "Generando Patrón..." : "Generar Patrón de Mosaico"}
              </Button>
              {seamlessPatternDataUri && (
                <div className="mt-6 p-4 border border-dashed rounded-md flex flex-col items-center">
                  <p className="text-sm font-medium mb-2 font-headline">Patrón de Mosaico Generado:</p>
                  <Image src={seamlessPatternDataUri} alt="Seamless pattern" width={250} height={250} className="rounded-md object-contain border bg-muted shadow-md" data-ai-hint="tile pattern"/>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Step 3: Customize QR Content */}
        {seamlessPatternDataUri && (
            <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center font-headline"><LinkIcon className="mr-2 h-6 w-6 text-primary" /> Paso 3: Ingresa Contenido para el QR</CardTitle>
                <CardDescription className="font-body">
                Escribe la URL, texto, o cualquier información que quieras que el código QR contenga.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                <Label htmlFor="qrContent" className="text-base font-headline">Contenido del QR (URL o Texto):</Label>
                <Textarea
                    id="qrContent"
                    value={qrContent}
                    onChange={(e) => setQrContent(e.target.value)}
                    placeholder="Ej: https://www.sociosvip.app o '¡Promoción Especial!'"
                    rows={3}
                    className="mt-1 text-base font-body"
                    disabled={isGeneratingQr}
                />
                </div>
                 <Button onClick={generateAndStyleQrCode} disabled={isGeneratingQr || !qrContent || !seamlessPatternDataUri} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                    {isGeneratingQr ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <QrCodeLucide className="mr-2 h-5 w-5" />}
                    {isGeneratingQr ? "Generando QR Personalizado..." : "Generar QR Personalizado"}
                </Button>
            </CardContent>
            </Card>
        )}

        {/* Step 4: Display and Download */}
        {finalStyledQrDataUri && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center font-headline"><FileImage className="mr-2 h-6 w-6 text-primary" /> Paso 4: Tu Código QR Personalizado</CardTitle>
              <CardDescription className="font-body">
                ¡Tu código QR con el patrón de mosaico está listo! Este es un proceso experimental y puede no ser perfecto.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-6">
                <div className="p-4 bg-card border rounded-lg shadow-inner">
                    <Image src={finalStyledQrDataUri} alt="Final Styled QR Code" width={300} height={300} className="rounded-md" data-ai-hint="customized qrcode"/>
                </div>
                <Button onClick={handleDownloadFinalQr} className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90">
                    <Download className="mr-2 h-5 w-5" /> Descargar QR Personalizado (PNG)
                </Button>
            </CardContent>
          </Card>
        )}
        
        {plainQrCodeDataUri && !finalStyledQrDataUri && seamlessPatternDataUri && (
            <div className="mt-6 p-4 border rounded-md text-center bg-muted/50">
              <p className="text-sm text-muted-foreground font-body">
                <Loader2 className="inline animate-spin mr-2 h-4 w-4" />
                Intentando aplicar estilo al QR... Si no aparece el QR estilizado, la combinación de patrón y QR no pudo procesarse automáticamente.
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-body">
                (Mientras tanto, puedes ver el QR sin estilo y el patrón por separado).
              </p>
            </div>
        )}

        {/* Section to show plain QR if styling fails or for comparison */}
        {plainQrCodeDataUri && seamlessPatternDataUri && (
           <Card className="shadow-md mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center font-headline"><QrCodeLucide className="mr-2 h-5 w-5 text-muted-foreground" />QR Básico (Referencia)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <Image src={plainQrCodeDataUri} alt="Plain QR Code" width={150} height={150} className="border rounded" data-ai-hint="simple qrcode" />
              <p className="text-xs text-muted-foreground mt-2 font-body">Este es el QR estándar sin el patrón aplicado.</p>
            </CardContent>
           </Card>
        )}

      </main>

      <footer className="w-full max-w-4xl mt-12 pt-8 border-t border-border/50 text-center pb-8">
        <p className="text-sm text-muted-foreground font-body">&copy; {new Date().getFullYear()} QR Code Customizer - By SocioVIP</p>
      </footer>
    </div>
  );
}
