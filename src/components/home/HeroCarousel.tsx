"use client";

import React, { useState, useEffect } from 'react';
import NextImage from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  Utensils, 
  Music, 
  Ticket, 
  Bed, 
  Map, 
  Car, 
  Palmtree, 
  Wine,
  Paperclip,
  Mic,
  Send,
  Sparkles 
} from 'lucide-react';

const heroSlides = [
  { 
    src: "https://i.ibb.co/4z4sKGC/pan2.jpg", 
    title: "Descubre una nueva", 
    subtitle: "Experiencia Premium",
    desc: "Encuentra los mejores eventos y promociones en un solo lugar."
  },
  { 
    src: "https://i.ibb.co/ZRnYm6h6/pan.jpg", 
    title: "Vive la noche", 
    subtitle: "Al Máximo Nivel",
    desc: "Acceso exclusivo a las discotecas más top de la ciudad."
  },
  { 
    src: "https://i.ibb.co/rRphWBmX/pan1.jpg", 
    title: "Saborea la mejor", 
    subtitle: "Gastronomía Local",
    desc: "Reservas preferenciales en los restaurantes más premiados."
  }
];

const categories = [
  { icon: Utensils, label: "Restaurantes" },
  { icon: Music, label: "Discotecas" },
  { icon: Ticket, label: "Eventos" },
  { icon: Bed, label: "Hoteles" },
  { icon: Map, label: "Tours" },
  { icon: Car, label: "Transporte" },
  { icon: Palmtree, label: "Playa" },
  { icon: Wine, label: "Pisco & Vino" }
];

interface HeroCarouselProps {
  onGenerateItinerary?: (prompt: string) => void;
  isGenerating?: boolean;
}

export const HeroCarousel = ({ onGenerateItinerary, isGenerating }: HeroCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex === heroSlides.length - 1 ? 0 : prevIndex + 1));
    }, 6000);
    return () => clearInterval(slideInterval);
  }, []);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Lo sentimos, tu navegador no soporta el reconocimiento de voz.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputValue((prev) => prev + (prev ? ' ' : '') + transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? heroSlides.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === heroSlides.length - 1 ? 0 : prev + 1));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim() && onGenerateItinerary && !isGenerating) {
      onGenerateItinerary(inputValue);
    }
  };

  return (
    <div className="relative h-screen min-h-[700px] w-full overflow-hidden bg-black">
      {/* Background Slides */}
      {heroSlides.map((slide, index) => (
        <div
          key={index}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-in-out",
            index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
          )}
        >
          <NextImage
            src={slide.src}
            alt={slide.title}
            fill
            className="object-cover scale-105"
            priority={index === 0}
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
      ))}

      {/* Main Content Area: Text Left, Chat Right */}
      <div className="relative z-20 h-full max-w-7xl mx-auto px-6 sm:px-12 lg:px-8 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-4 lg:gap-12 pt-16 lg:pt-0">
        
        {/* Branding Column (Left) */}
        <div key={currentIndex} className="w-full lg:w-1/2 flex flex-col items-center text-center lg:items-start lg:text-left lg:py-10">
          <p className="text-white text-base sm:text-2xl font-bold uppercase tracking-[0.4em] mb-3 lg:mb-4 drop-shadow-md animate-blur-reveal [animation-delay:200ms] opacity-0">
            {heroSlides[currentIndex].title}
          </p>
          <h1 className="text-3xl sm:text-6xl lg:text-7xl font-black text-white mb-4 lg:mb-6 tracking-tighter drop-shadow-2xl leading-[1.1] animate-blur-reveal [animation-delay:400ms] opacity-0">
            {heroSlides[currentIndex].subtitle}
          </h1>
          <p className="text-white/80 text-xs sm:text-xl max-w-xl mb-8 lg:mb-10 font-medium tracking-wide leading-relaxed animate-blur-reveal [animation-delay:600ms] opacity-0">
            {heroSlides[currentIndex].desc}
          </p>
          <Button 
            variant="outline"
            className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white hover:text-black text-white rounded-md px-10 py-7 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 animate-blur-reveal [animation-delay:800ms] opacity-0"
          >
            Explorar SocioVIP
          </Button>
        </div>

        {/* AI Chat Input Box (Right) */}
        <div className="w-full lg:w-[600px] animate-fade-in-right self-center lg:mt-0">
          <div className="bg-white/95 backdrop-blur-2xl rounded-2xl lg:rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.3)] p-2 lg:p-8 flex flex-col border border-white/40 transform transition-all hover:scale-[1.01] duration-500">
            <form onSubmit={handleSubmit} className="flex flex-col gap-1 lg:gap-4">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Hola, soy tu conserje SocioVIP..."
                className="w-full bg-transparent border-none focus:ring-0 text-slate-700 text-xs lg:text-xl font-medium placeholder:text-slate-400 resize-none outline-none leading-relaxed h-6 lg:h-16 overflow-hidden"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 lg:gap-4 text-slate-400">
                  <button type="button" className="hover:text-[#053264] transition-all p-1 hover:scale-110">
                    <Paperclip size={16} className="lg:hidden" />
                    <Paperclip size={20} className="hidden lg:block" />
                  </button>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    type="button" 
                    onClick={toggleListening}
                    className={cn(
                      "transition-all p-1.5 lg:p-2 rounded-full relative",
                      isListening 
                        ? "text-red-500 bg-red-50" 
                        : "text-slate-400 hover:text-[#053264] hover:bg-slate-50"
                    )}
                  >
                    <Mic size={18} className={cn("lg:hidden", isListening && "animate-pulse")} />
                    <Mic size={22} className={cn("hidden lg:block", isListening && "animate-pulse")} />
                    {isListening && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    )}
                  </button>
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isGenerating}
                    className={cn(
                      "h-10 w-10 lg:h-12 lg:w-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
                      inputValue.trim() && !isGenerating
                        ? "bg-[#053264] text-white scale-105"
                        : "bg-slate-100 text-slate-300 cursor-not-allowed"
                    )}
                  >
                    {isGenerating ? (
                      <div className="h-4 w-4 lg:h-5 lg:w-5 border-2 lg:border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={18} className="ml-0.5 lg:hidden" />
                        <Send size={22} className="ml-1 hidden lg:block" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
          
          <div className="mt-8 flex flex-wrap gap-2 justify-center lg:justify-start px-2">
             <span className="text-[10px] font-black uppercase tracking-widest text-white/50 w-full mb-2 text-center lg:text-left">Prueba con:</span>
             {["Plan fin de semana", "Cena romántica", "Eventos hoy"].map((tag, i) => (
                <button 
                  key={i} 
                  onClick={() => setInputValue(tag)}
                  className="bg-white/10 hover:bg-white/30 backdrop-blur-md border border-white/10 rounded-full px-5 py-2 text-[10px] text-white font-black uppercase tracking-widest transition-all"
                >
                  {tag}
                </button>
             ))}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <button 
        onClick={goToPrevious}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-4 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all border border-white/10 hidden xl:flex"
      >
        <ChevronLeft size={28} />
      </button>
      <button 
        onClick={goToNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-4 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all border border-white/10 hidden xl:flex"
      >
        <ChevronRight size={28} />
      </button>

      {/* Pagination Dots */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 flex gap-3">
        {heroSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-300",
              i === currentIndex ? "bg-white scale-125 shadow-[0_0_15px_rgba(255,255,255,0.8)]" : "bg-white/40 hover:bg-white/60"
            )}
          />
        ))}
      </div>

      {/* Category Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#053264]/95 backdrop-blur-md border-t border-white/5">
        <div className="max-w-7xl mx-auto flex overflow-x-auto no-scrollbar">
          {categories.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <button
                key={i}
                className="flex-1 min-w-[120px] flex flex-col items-center justify-center py-7 gap-3 transition-all hover:bg-white/5 group border-r border-white/5 last:border-r-0"
              >
                <Icon size={26} className="text-white/60 group-hover:text-white transition-colors" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 group-hover:text-white transition-colors">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
