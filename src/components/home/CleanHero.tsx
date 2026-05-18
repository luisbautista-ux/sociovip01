"use client";

import React, { useState, useEffect, useRef } from 'react';
import NextImage from 'next/image';
import { cn } from '@/lib/utils';
import { Paperclip, Mic, Send, ArrowRight } from 'lucide-react';

interface CleanHeroProps {
  onGenerateItinerary?: (prompt: string) => void;
  isGenerating?: boolean;
  businesses?: any[];
}

const ORBIT_DURATION = 20; // seconds for a full revolution

const SmoothImage = ({ src, alt }: { src: string; alt: string }) => {
  const [fade, setFade] = useState(true);
  const [displaySrc, setDisplaySrc] = useState(src);

  useEffect(() => {
    if (src === displaySrc) return;
    setFade(false); // trigger fade-out
    const timer = setTimeout(() => {
      setDisplaySrc(src); // swap image
      setFade(true); // trigger fade-in
    }, 500); // halfway of duration
    return () => clearTimeout(timer);
  }, [src, displaySrc]);

  return (
    <div className="w-full h-full relative bg-slate-950">
      <NextImage 
        src={displaySrc} 
        fill 
        className={cn(
          "object-cover transition-all duration-1000 ease-in-out",
          fade ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )} 
        alt={alt} 
      />
    </div>
  );
};

const OrbitalGallery = ({ size = 420, images = [] }: { size?: number; images?: string[] }) => {
  const radius = size * 0.36;
  const imgSize = size * 0.48; // Made images slightly larger and highly visible
  const [displayImages, setDisplayImages] = useState<string[]>(images.slice(0, 4));

  useEffect(() => {
    setDisplayImages(images.slice(0, 4));
  }, [images]);

  useEffect(() => {
    if (images.length <= 4) return;

    let currentSlot = 0;
    let nextImageIndex = 4;

    const interval = setInterval(() => {
      setDisplayImages(prev => {
        const nextImages = [...prev];
        nextImages[currentSlot] = images[nextImageIndex];
        return nextImages;
      });

      currentSlot = (currentSlot + 1) % 4;
      nextImageIndex = (nextImageIndex + 1) % images.length;
    }, 3000); // Change one image slot every 3 seconds

    return () => clearInterval(interval);
  }, [images]);

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
        {displayImages.map((src, i) => {
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
                  <SmoothImage src={src} alt={`Experiencia ${i + 1}`} />
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

export const CleanHero = ({ onGenerateItinerary, isGenerating, businesses = [] }: CleanHeroProps) => {
  const [inputValue, setInputValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [galleryVisible, setGalleryVisible] = useState(false);

  const processedImages = React.useMemo(() => {
    const fallbackImages = [
      "https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1485872299829-c673f5194813?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80",
    ];

    const bizImages: string[] = [];
    (businesses || []).forEach(b => {
      if (b.logoUrl) {
        bizImages.push(b.logoUrl);
      }
      if (b.publicCoverImageUrls && Array.isArray(b.publicCoverImageUrls)) {
        b.publicCoverImageUrls.forEach((img: string) => {
          if (img) bizImages.push(img);
        });
      }
    });

    const merged = [...bizImages];
    while (merged.length < 4) {
      const fallback = fallbackImages[merged.length % fallbackImages.length];
      merged.push(fallback);
    }
    return merged;
  }, [businesses]);

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

      <section className="relative min-h-screen flex items-center bg-[#fcfbf9] overflow-hidden pt-20 lg:pt-28">
        <div className="absolute top-0 right-0 w-[60%] h-[70%] bg-[#ccffbc]/10 rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center relative z-10 pb-16 lg:pb-0">

          {/* LEFT */}
          <div className="flex flex-col gap-8">
            <h1 className="text-[2.8rem] sm:text-6xl lg:text-5xl xl:text-7xl font-black text-[#053264] tracking-tighter leading-[0.95] mt-8 lg:mt-12">
              Tus experiencias. <br />
              Planeadas en <br />
              <span className="text-[#053264] italic">minutos.</span>
            </h1>

            <div className="w-full">
              <div className="relative p-[3px] rounded-[24px] overflow-hidden shadow-[0_15px_40px_rgba(5,50,100,0.08)] bg-slate-200/50">
                <style>{`
                  @keyframes border-worm-spin {
                    0% { transform: translate(-50%, -50%) rotate(0deg); }
                    100% { transform: translate(-50%, -50%) rotate(360deg); }
                  }
                `}</style>
                
                {/* Traveling glowing worm border in SocioVIP secondary color */}
                <div 
                  className="absolute top-1/2 left-1/2 w-[300%] h-[300%] pointer-events-none"
                  style={{
                    background: "conic-gradient(from 0deg, transparent 0deg, transparent 130deg, #10b981 160deg, #ccffbc 180deg, #10b981 200deg, transparent 230deg, transparent 360deg)",
                    animation: "border-worm-spin 3.5s linear infinite"
                  }}
                />
                
                {/* Inner Content Card */}
                <div className="bg-white rounded-[21px] p-4 sm:p-6 flex flex-col relative z-10 w-full h-full">
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


          </div>

          {/* RIGHT — Desktop only */}
          <div className="hidden lg:flex items-center justify-center">
            {/* translateX for orbit uses CSS var */}
            <style>{`[style*="orbit-spin"] { --orbit-r: ${420 * 0.36}px; }`}</style>
            <OrbitalGallery size={420} images={processedImages} />
          </div>

        </div>
      </section>

      {/* ── MOBILE GALLERY (on scroll) ── */}
      <section ref={galleryRef} className="lg:hidden bg-[#fcfbf9] pb-16 pt-2 flex flex-col items-center overflow-hidden w-full relative">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center mb-10">
          Experiencias que te esperan
        </p>
        <div className={cn(
          "transition-all duration-1000 ease-out",
          galleryVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        )}>
          <style>{`[style*="orbit-spin"] { --orbit-r: ${320 * 0.36}px; }`}</style>
          <OrbitalGallery size={320} images={processedImages} />
        </div>
      </section>
    </>
  );
};
