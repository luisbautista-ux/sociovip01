
"use client";

import React, { useState, useEffect } from 'react';
import NextImage from 'next/image';
import { Search, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SocioVipLogo } from '@/components/icons';

const heroImages = [
  { src: "https://i.ibb.co/4z4sKGC/pan2.jpg", alt: "Discoteca con luces" },
  { src: "https://i.ibb.co/QvL3Z7Vz/Dise-o-sin-t-tulo-1.jpg", alt: "Logo de SocioVip" },
  { src: "https://i.ibb.co/ZRnYm6h6/pan.jpg", alt: "Gente en un evento" },
  { src: "https://i.ibb.co/rRphWBmX/pan1.jpg", alt: "Gente en una fiesta" },
];

const SLIDE_DURATION = 5000;

interface HeroCarouselProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export function HeroCarousel({ searchTerm, setSearchTerm }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  
  const title = "Descubre las promociones y eventos más exclusivos";

  useEffect(() => {
    if (heroImages.length <= 1) return;
    const slideInterval = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === heroImages.length - 1 ? 0 : prevIndex + 1
      );
    }, SLIDE_DURATION);
    return () => clearInterval(slideInterval);
  }, [currentIndex]); // Reinicia el intervalo en cada cambio de slide

  useEffect(() => {
    setAnimationKey((prev) => prev + 1);
  }, [currentIndex]);
  
  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? heroImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === heroImages.length - 1 ? 0 : prev + 1));
  };
  
  const goToSlide = (slideIndex: number) => {
    setCurrentIndex(slideIndex);
  };

  return (
    <header className="relative w-full h-[60vh] md:h-[55vh] lg:h-[70vh] overflow-hidden text-white">
      {/* Carrusel de Imágenes de Fondo */}
      {heroImages.map((image, index) => (
        <NextImage
          key={index}
          src={image.src}
          alt={image.alt}
          fill
          className={cn(
            'object-cover transition-opacity duration-1000 ease-in-out',
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          )}
          priority={index === 0}
        />
      ))}
      
      {/* Overlay Oscuro */}
      <div className="absolute inset-0 bg-black/50 z-10" />

      {/* Contenido Superpuesto */}
      <div className="relative z-20 h-full flex flex-col">
        {/* Barra de Navegación Superior */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-4">
            <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="relative p-1 rounded-full animate-drop-in animate-float">
                        <SocioVipLogo size={40} className="drop-shadow-lg" />
                    </div>
                    <span className="font-bold text-2xl text-white drop-shadow-lg">SocioVIP</span>
                </Link>
                <Link href="/login" passHref>
                    <Button variant="ghost" className="bg-transparent border-none text-white hover:bg-white/20 p-0 md:w-auto md:px-4 md:py-2 md:border md:border-white/50 md:bg-white/10 md:rounded-md">
                        <UserCircle className="h-8 w-8 md:h-5 md:w-5 md:mr-2" />
                        <span className="hidden md:inline">Iniciar Sesión</span>
                    </Button>
                </Link>
            </div>
        </div>

        {/* Contenido Central */}
        <div className="flex-grow flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold drop-shadow-2xl max-w-4xl animate-fade-in-up">
            {title}
          </h1>
          <div className="relative w-full max-w-xl mt-8 group animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div
              className="relative animated-gradient-border-wrapper rounded-full transition-transform duration-300 group-focus-within:-translate-y-1 group-focus-within:scale-105"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400 z-10" />
              <Input
                type="search"
                placeholder="Buscar por nombre, negocio o descripción..."
                className="pl-12 w-full rounded-full h-14 text-lg bg-white/90 text-black placeholder:text-gray-500 transition-all duration-300 focus:bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Botones de navegación fijos */}
        {heroImages.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute top-1/2 left-3 z-30 -translate-y-1/2 p-2 bg-white/80 text-gray-800 rounded-full shadow-md transition-colors duration-300 hover:bg-white"
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute top-1/2 right-3 z-30 -translate-y-1/2 p-2 bg-white/80 text-gray-800 rounded-full shadow-md transition-colors duration-300 hover:bg-white"
              aria-label="Siguiente imagen"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Indicadores de Progreso */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-2">
            {heroImages.map((_, slideIndex) => (
              <button
                key={slideIndex}
                onClick={() => goToSlide(slideIndex)}
                className={cn(
                  'h-2 rounded-full cursor-pointer transition-all duration-500 ease-in-out bg-white/40 hover:bg-white/60',
                  slideIndex === currentIndex ? 'w-8' : 'w-2'
                )}
                aria-label={`Ir a la imagen ${slideIndex + 1}`}
              >
                {slideIndex === currentIndex && (
                  <div
                    key={animationKey}
                    className="h-full rounded-full bg-header-gradient-static animate-progress-bar-fill"
                    style={{ animationDuration: `${SLIDE_DURATION}ms` }}
                  />
                )}
              </button>
            ))}
        </div>
      </div>
    </header>
  );
}
