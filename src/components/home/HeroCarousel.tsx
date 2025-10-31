
"use client";

import React, { useState, useEffect } from 'react';
import NextImage from 'next/image';
import { Search, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SocioVipLogo } from '@/components/icons';

const heroImages = [
  { src: "https://picsum.photos/seed/event1/1920/1080", alt: "Evento vibrante con luces de neón" },
  { src: "https://picsum.photos/seed/crowd2/1920/1080", alt: "Multitud disfrutando de un concierto" },
  { src: "https://picsum.photos/seed/dj3/1920/1080", alt: "DJ mezclando música en un club" },
  { src: "https://picsum.photos/seed/food4/1920/1080", alt: "Platos gourmet en un restaurante exclusivo" },
];

const SLIDE_DURATION = 5000;

interface HeroCarouselProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export function HeroCarousel({ searchTerm, setSearchTerm }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === heroImages.length - 1 ? 0 : prevIndex + 1
      );
    }, SLIDE_DURATION);
    return () => clearInterval(slideInterval);
  }, []);

  useEffect(() => {
    setAnimationKey((prev) => prev + 1);
  }, [currentIndex]);
  
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
                    <SocioVipLogo size={40} className="drop-shadow-lg" />
                    <span className="font-bold text-2xl text-white drop-shadow-lg">SocioVIP</span>
                </Link>
                <Link href="/login" passHref>
                    <Button variant="outline" size="lg" className="bg-white/10 text-white border-white/50 hover:bg-white/20 backdrop-blur-sm font-bold hidden sm:flex">
                        <UserCircle className="mr-2 h-5 w-5" />
                        Iniciar Sesión
                    </Button>
                </Link>
            </div>
        </div>

        {/* Contenido Central */}
        <div className="flex-grow flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold drop-shadow-2xl max-w-4xl">
            Descubre las promociones y eventos más exclusivos
          </h1>
          <div className="relative w-full max-w-xl mt-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
            <Input
              type="search"
              placeholder="Buscar por nombre, negocio o descripción..."
              className="pl-12 w-full rounded-full h-14 text-lg bg-white/90 text-black placeholder:text-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

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
                    className="h-full rounded-full bg-white/80 animate-progress-bar-fill"
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
