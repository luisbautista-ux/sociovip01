
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import NextImage from "next/image";
import Link from 'next/link';
import QRCode from "qrcode";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import type { Business } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, QrCode, Star, Building, ExternalLink, Download } from "lucide-react";
import * as htmlToImage from 'html-to-image';
import { useToast } from '@/hooks/use-toast';

export default function ClientDashboardPage() {
  const { currentUser, userProfile, loadingAuth, loadingProfile } = useAuth();
  const [assignedBusinesses, setAssignedBusinesses] = useState<Business[]>([]);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchAssignedBusinesses = useCallback(async () => {
    if (loadingProfile || !userProfile) return;

    setIsLoadingData(true);
    setError(null);
    try {
      const settingsDocRef = doc(db, "platformSettings", "membershipConfig");
      const settingsSnap = await getDoc(settingsDocRef);
      
      if (!settingsSnap.exists() || !settingsSnap.data().defaultBusinessesForFreeUsers) {
        setAssignedBusinesses([]);
        return;
      }
      
      const businessIds = settingsSnap.data().defaultBusinessesForFreeUsers;
      if (businessIds.length === 0) {
        setAssignedBusinesses([]);
        return;
      }

      const businessesQuery = query(collection(db, "businesses"), where("__name__", "in", businessIds));
      const businessesSnap = await getDocs(businessesQuery);
      const fetchedBusinesses = businessesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
      setAssignedBusinesses(fetchedBusinesses);

    } catch (err: any) {
      console.error("Failed to fetch assigned businesses:", err);
      setError("No se pudieron cargar los negocios asignados.");
    } finally {
      setIsLoadingData(false);
    }
  }, [loadingProfile, userProfile]);

  useEffect(() => {
    fetchAssignedBusinesses();
  }, [fetchAssignedBusinesses]);
  
  useEffect(() => {
    if (currentUser?.uid) {
      QRCode.toDataURL(currentUser.uid, { width: 400, errorCorrectionLevel: 'H' }, (err, url) => {
        if (err) {
          console.error("Failed to generate QR code:", err);
          setQrCodeImage(null);
        } else {
          setQrCodeImage(url);
        }
      });
    }
  }, [currentUser]);

  const handleDownloadQrCard = async () => {
    if (!cardRef.current) {
      toast({ title: "Error", description: "No se puede descargar la tarjeta QR en este momento.", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await htmlToImage.toPng(cardRef.current, { quality: 1.0, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `SocioVIP_QR_${userProfile?.name?.replace(/\s/g, '_') || currentUser?.uid}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "QR Guardado", description: "Tu tarjeta QR se ha descargado como imagen." });
    } catch (err) {
      console.error('Error al generar la imagen del QR:', err);
      toast({ title: "Error al Guardar", description: "No se pudo generar la imagen de tu tarjeta QR.", variant: "destructive" });
    }
  };

  if (loadingAuth || loadingProfile) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader><CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2"/>Error</CardTitle></CardHeader>
        <CardContent><p>{error}</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* QR Card */}
        <div className="md:col-span-1 md:sticky md:top-8">
          <Card ref={cardRef} className="shadow-lg text-center overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary to-accent text-primary-foreground p-4">
              <CardTitle className="text-xl">Tu QR Fijo SocioVIP</CardTitle>
              <CardDescription className="text-primary-foreground/90">
                Presenta este QR en los negocios de tu red.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 flex flex-col items-center">
              {qrCodeImage ? (
                <NextImage src={qrCodeImage} alt="Tu código QR personal" width={220} height={220} className="rounded-lg border-4 border-white shadow-md"/>
              ) : (
                <div className="h-[220px] w-[220px] flex items-center justify-center bg-muted rounded-lg"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground"/></div>
              )}
              <div className="pt-2">
                <p className="font-semibold text-lg">{userProfile?.name}</p>
                <p className="text-sm text-muted-foreground">{userProfile?.dni || 'DNI no registrado'}</p>
              </div>
            </CardContent>
             <CardContent className="p-4 pt-0">
                <Button onClick={handleDownloadQrCard} className="w-full" variant="outline">
                    <Download className="mr-2 h-4 w-4"/> Descargar Tarjeta QR
                </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Assigned Businesses Section */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-gradient">Mis Negocios Asignados</CardTitle>
              <CardDescription>Con tu membresía gratuita, puedes usar tu QR en los siguientes locales:</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
              ) : assignedBusinesses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {assignedBusinesses.map(biz => (
                    <Card key={biz.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="flex flex-row items-center gap-4 space-y-0 p-4">
                        {biz.logoUrl && (
                          <NextImage src={biz.logoUrl} alt={`logo de ${biz.name}`} width={40} height={40} className="rounded-md w-10 h-10 object-contain border"/>
                        )}
                        <div>
                          <CardTitle className="text-base">{biz.name}</CardTitle>
                          {biz.slogan && <CardDescription className="text-xs">{biz.slogan}</CardDescription>}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
                        <p>{biz.publicAddress || "Dirección no disponible"}</p>
                        {biz.customUrlPath && (
                            <Link href={`/${biz.customUrlPath}`} passHref>
                                <Button variant="link" className="p-0 h-auto text-primary mt-2">
                                    Ver Promociones <ExternalLink className="ml-1 h-3 w-3"/>
                                </Button>
                            </Link>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building className="mx-auto h-12 w-12 mb-2"/>
                  <p>Aún no tienes negocios asignados. El administrador de la plataforma pronto añadirá locales a la red gratuita.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-primary/10 border-primary/30">
            <CardHeader>
              <CardTitle className="text-primary flex items-center"><Star className="mr-2"/>¡Desbloquea el Acceso Total!</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-primary/90">Usa tu QR en <strong className="font-bold">TODOS</strong> los negocios de la red y accede a beneficios exclusivos con la membresía Premium.</p>
              <Button variant="gradient" disabled>Obtener Premium (Próximamente)</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
