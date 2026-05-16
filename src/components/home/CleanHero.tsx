"use client";

import React, { useState, useEffect, useRef } from 'react';
import NextImage from 'next/image';
import { cn } from '@/lib/utils';
import { Paperclip, Mic, Send, ArrowRight } from 'lucide-react';

interface CleanHeroProps {
  onGenerateItinerary?: (prompt: string) => void;
  isGenerating?: boolean;
}

const orbitImages = [
  "https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1485872299829-c673f5194813?auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80",
];

const ORBIT_DURATION = 20; // seconds for a full revolution

const OrbitalGallery = ({ size = 420 }: { size?: number }) => {
  const radius = size * 0.36;
  const imgSize = size * 0.44; // Made images even larger

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Faint orbit track ring */}
      <div
        className="absolute rounded-full border border-[#053264]/10"
        style={{
          width: radius * 2,
          height: radius * 2,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Rotating container */}
      <div
        className="absolute inset-0"
        style={{ animation: `orbit-spin ${ORBIT_DURATION}s linear infinite` }}
      >
        {/* ── 4 Orbiting image circles ── */}
        {orbitImages.map((src, i) => {
          const angle = i * 90; // 0, 90, 180, 270
          return (
            <div
              key={i}
              className="absolute"
              style={{
                width: imgSize,
                height: imgSize,
                top: `calc(50% - ${imgSize / 2}px)`,
                left: `calc(50% - ${imgSize / 2}px)`,
                // Position on circle and counter-rotate the structural angle
                transform: `rotate(${angle}deg) translateX(${radius}px) rotate(-${angle}deg)`,
              }}
            >
              {/* Counter-rotate the dynamic spin so image stays upright in the world */}
              <div
                className="w-full h-full"
                style={{
                  animation: `orbit-counter ${ORBIT_DURATION}s linear infinite`,
                }}
              >
                <div
                  className="rounded-full overflow-hidden border-[3px] border-white shadow-xl"
                  style={{ width: imgSize, height: imgSize, position: 'relative' }}
                >
                  <NextImage src={src} fill className="object-cover" alt={`Experiencia ${i + 1}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes orbit-counter {
          from { transform: rotate(0deg);    }
          to   { transform: rotate(-360deg); }
        }
      `}</style>
    </div>
  );
};

export const CleanHero = ({ onGenerateItinerary, isGenerating }: CleanHeroProps) => {
  const [inputValue, setInputValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [galleryVisible, setGalleryVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setGalleryVisible(true); },
      { threshold: 0.15 }
    );
    if (galleryRef.current) observer.observe(galleryRef.current);
    return () => observer.disconnect();
  }, []);

  const toggleListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) { setIsListening(false); return; }
    const r = new SR();
    r.lang = 'es-ES';
    r.onstart = () => setIsListening(true);
    r.onresult = (e: any) => { setInputValue((p) => p + (p ? ' ' : '') + e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    r.start();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim() && onGenerateItinerary && !isGenerating) onGenerateItinerary(inputValue);
  };

  return (
    <>

      <section className="relative min-h-screen flex items-center bg-[#fcfbf9] overflow-hidden">
        <div className="absolute top-0 right-0 w-[60%] h-[70%] bg-[#ccffbc]/10 rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center relative z-10 pt-24 pb-16 lg:pt-0 lg:pb-0">

          {/* LEFT */}
          <div className="flex flex-col gap-8">
            <h1 className="text-[2.8rem] sm:text-6xl lg:text-7xl font-black text-[#053264] tracking-tighter leading-[0.95]">
              Tus experiencias. <br />
              Planeadas en <br />
              <span className="text-[#053264] italic">minutos.</span>
            </h1>

            <div className="w-full">
              <div className="bg-white rounded-3xl shadow-[0_15px_40px_rgba(5,50,100,0.08)] p-4 sm:p-6 flex flex-col border border-slate-100/80">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                    placeholder="Hola, soy tu concierge SocioVIP..."
                    rows={2}
                    className="w-full bg-transparent border-none focus:ring-0 text-[#053264] text-base sm:text-lg font-medium placeholder:text-slate-300 resize-none outline-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-300">
                      <button type="button" className="hover:text-[#053264] transition-all"><Paperclip size={18} /></button>
                      <button type="button" onClick={toggleListening} className={cn("p-1.5 rounded-full transition-all", isListening ? "text-red-500 bg-red-50" : "hover:text-[#053264]")}>
                        <Mic size={18} className={cn(isListening && "animate-pulse")} />
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || isGenerating}
                      className={cn("h-11 w-11 rounded-full flex items-center justify-center transition-all duration-300 shadow-md",
                        inputValue.trim() && !isGenerating ? "bg-[#053264] text-white hover:bg-[#053264]/90" : "bg-slate-100 text-slate-300 cursor-not-allowed"
                      )}
                    >
                      {isGenerating ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={18} className="ml-0.5" />}
                    </button>
                  </div>
                </form>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {["Plan fin de semana", "Cena romántica", "Mejores eventos"].map((tag, i) => (
                  <button key={i} onClick={() => setInputValue(tag)}
                    className="bg-[#053264]/5 hover:bg-[#053264]/10 border border-[#053264]/10 rounded-full px-5 py-2 text-[11px] text-[#053264] font-bold uppercase tracking-widest transition-all">
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button className="flex items-center gap-2 text-[#053264] font-bold text-xs uppercase tracking-widest hover:gap-3 transition-all group w-fit">
              <span>Mira cómo puedo ayudarte</span>
              <ArrowRight size={14} className="text-secondary group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {/* RIGHT — Desktop only */}
          <div className="hidden lg:flex items-center justify-center">
            {/* translateX for orbit uses CSS var */}
            <style>{`[style*="orbit-spin"] { --orbit-r: ${420 * 0.36}px; }`}</style>
            <OrbitalGallery size={420} />
          </div>

        </div>
      </section>

      {/* ── MOBILE GALLERY (on scroll) ── */}
      <section ref={galleryRef} className="lg:hidden bg-[#fcfbf9] pb-16 pt-2 flex flex-col items-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center mb-10">
          Experiencias que te esperan
        </p>
        <div className={cn(
          "transition-all duration-1000 ease-out",
          galleryVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        )}>
          <style>{`[style*="orbit-spin"] { --orbit-r: ${320 * 0.36}px; }`}</style>
          <OrbitalGallery size={320} />
        </div>
      </section>
    </>
  );
};
