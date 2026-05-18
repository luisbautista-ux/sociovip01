"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Business } from "@/lib/types";
import { Volume2, VolumeX, Sparkles, Image as ImageIcon } from "lucide-react";
import NextImage from "next/image";
import Link from "next/link";

interface BusinessMediaPanelProps {
  businesses: Business[];
}

function SmartVideo({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (videoRef.current) {
            if (entry.isIntersecting) {
              // Cuando entra en vista, intentamos reproducir Y activar sonido
              videoRef.current.play().catch(() => {});
              videoRef.current.muted = false;
              setIsMuted(false);
            } else {
              // Cuando sale de vista, pausamos y silenciamos
              videoRef.current.pause();
              videoRef.current.muted = true;
              setIsMuted(true);
            }
          }
        });
      },
      { threshold: 0.7 } // Elevamos al 70% de visibilidad para activar sonido
    );

    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  const toggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (videoRef.current) {
      const newState = !isMuted;
      videoRef.current.muted = newState;
      setIsMuted(newState);
    }
  };

  return (
    <div className="relative w-full h-full">
      <video 
        ref={videoRef}
        src={url} 
        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
        muted={isMuted}
        loop 
        playsInline 
      />
      <div className="absolute top-6 right-6 z-20">
        <button 
          onClick={toggleMute}
          className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-colors border border-white/10"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

function ConciergeIntroCard() {
  return (
    <div className="group relative bg-[#053264] rounded-[2.5rem] overflow-hidden border border-white/20 shadow-2xl transition-all duration-500 hover:scale-[1.02] aspect-[9/16] mb-8">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <NextImage 
          src="https://images.unsplash.com/photo-1566417713940-db764f4ec990?auto=format&fit=crop&q=80" 
          alt="Nightlife" 
          fill 
          className="object-cover opacity-40 group-hover:opacity-50 transition-opacity duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#053264]/80 via-transparent to-[#053264]" />
      </div>

      <div className="relative h-full flex flex-col p-8 items-center text-center justify-between z-10">
        <div className="space-y-6 pt-4">
          {/* Animated Avatar */}
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-secondary/20 rounded-full animate-ping" />
            <div className="relative w-24 h-24 rounded-full border-2 border-secondary/50 p-1.5 bg-[#053264] shadow-2xl">
              <img 
                src="https://www.image2url.com/r2/default/gifs/1778861156032-56811580-9ea6-4eab-9dd1-9cec2b902ccb.gif" 
                alt="SocioVIP Avatar" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-[#053264] shadow-lg animate-pulse" />
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-black text-2xl tracking-tight leading-tight uppercase font-headline italic">
              SocioVIP Concierge
            </h3>
            <p className="text-secondary font-bold text-[10px] uppercase tracking-[0.3em]">
              Tu Anfitrión Digital
            </p>
          </div>
        </div>

        <div className="space-y-8 pb-4">
          <p className="text-white/90 text-sm leading-relaxed font-medium">
            "Tu Concierge Personal: Experto en <span className="text-secondary font-bold">50+ locales exclusivos</span>. Conectado en tiempo real."
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center">
              <span className="text-secondary font-black text-xl leading-none mb-1">12</span>
              <span className="text-white/50 text-[8px] uppercase font-bold tracking-widest text-center leading-tight">
                Beneficios<br/>Activos Hoy
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center">
              <span className="text-secondary font-black text-xl leading-none mb-1">5</span>
              <span className="text-white/50 text-[8px] uppercase font-bold tracking-widest text-center leading-tight">
                Eventos<br/>Confirmados
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-white/40">
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Acceso Preferencial</span>
            <div className="w-1 h-1 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BusinessMediaPanel({ businesses }: BusinessMediaPanelProps) {
  const allMedia: any[] = [];

  businesses.forEach(business => {
    const videos = business.publicVideoUrls || [];
    const images = business.publicImageUrls || [];

    videos.forEach(url => {
      allMedia.push({ type: 'video', url, businessName: business.name, businessLogo: business.logoUrl, customUrl: business.customUrlPath });
    });

    images.forEach(url => {
      allMedia.push({ type: 'image', url, businessName: business.name, businessLogo: business.logoUrl, customUrl: business.customUrlPath });
    });
  });

  const isConciergeMode = businesses.length === 0 || (businesses.length === 1 && businesses[0].name.includes("Concierge"));

  if (allMedia.length === 0 && !isConciergeMode) {
    allMedia.push({ 
      type: 'image', 
      url: "https://images.unsplash.com/photo-1514525253361-bee8a48740ad?auto=format&fit=crop&q=80",
      businessName: "SocioVIP",
      businessLogo: null
    });
  }

  return (
    <div className="w-full h-full bg-white/40 backdrop-blur-sm flex flex-col p-6 overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-8 scrollbar-none pb-20">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Galería Exclusiva</h2>
        </div>

        {isConciergeMode && allMedia.length === 0 && (
          <ConciergeIntroCard />
        )}

        {allMedia.map((item, idx) => {
          const businessUrl = item.customUrl ? `/${item.customUrl}` : `/business/${item.businessName}/public`;
          
          return (
            <div key={idx} className="group relative bg-white rounded-[2rem] overflow-hidden border border-slate-200 shadow-xl transition-all hover:border-primary/30">
              <div className="aspect-[9/16] relative">
                {item.type === 'video' ? (
                  <SmartVideo url={item.url} />
                ) : (
                  <div className="absolute inset-0 w-full h-full">
                    <NextImage 
                      src={item.url} 
                      alt="Gallery item" 
                      fill 
                      unoptimized
                      className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
                    />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80 pointer-events-none" />
                
                <div className="absolute bottom-0 inset-x-0 p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    {item.businessLogo ? (
                      <div className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden bg-black">
                        <img src={item.businessLogo} alt="Logo" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs shadow-lg">
                        S
                      </div>
                    )}
                    <div>
                      <p className="text-white font-bold text-sm">@{item.businessName.toLowerCase().replace(/\s/g, '')}</p>
                      <p className="text-white/50 text-[10px] uppercase tracking-widest font-medium">
                        {item.type === 'video' ? 'Video de SocioVIP' : 'Imagen de SocioVIP'}
                      </p>
                    </div>
                  </div>
                  
                  <Link href={businessUrl} className="block w-full">
                    <button className="w-full py-4 bg-primary text-white font-extrabold rounded-2xl text-sm transition-all hover:bg-primary/90 active:scale-95 shadow-lg">
                      Ver más detalles
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="shrink-0 pt-4 border-t border-slate-200">
        <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
          Experiencia SocioVIP Premium
        </p>
      </div>
    </div>
  );
}
