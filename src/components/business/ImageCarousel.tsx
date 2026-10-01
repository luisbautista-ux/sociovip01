
"use client";

import React, { useState, useEffect } from 'react';
import NextImage from 'next/image';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCarouselProps {
  images: string[];
  primaryColor?: string;
  title?: string;
  slogan?: string;
  logoUrl?: string;
  showOverlay?: boolean;
  aspectClass?: string;
}

const SLIDE_DURATION = 5000;

export function ImageCarousel({
  images,
  primaryColor = '#B080D0',
  title = '',
  slogan = '',
  logoUrl,
  showOverlay = true,
  aspectClass = 'min-h-[75vh] md:min-h-0 md:aspect-[16/7]',
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const slideInterval = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === images.length - 1 ? 0 : prevIndex + 1
      );
    }, SLIDE_DURATION);
    return () => clearInterval(slideInterval);
  }, [images.length]);

  useEffect(() => {
    setAnimationKey((prev) => prev + 1);
  }, [currentIndex]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };
  
  const goToSlide = (slideIndex: number) => {
    setCurrentIndex(slideIndex);
  };

  if (!images || images.length === 0) {
    return (
      <div className="relative w-full aspect-[4/3] md:aspect-[16/9] overflow-hidden bg-muted flex items-center justify-center">
        <Video className="w-12 h-12 text-muted-foreground" />
        <p className="ml-4 text-muted-foreground">No hay imágenes de portada.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full px-0">
      <div className={cn("relative w-full overflow-hidden group shadow-2xl", aspectClass)}>
        {/* Imagen */}
        {images.map((image, index) => (
          <NextImage
            key={index}
            src={image}
            alt={`Imagen ${index + 1}`}
            fill
            className={cn(
              'object-cover transition-opacity duration-700 ease-in-out',
              index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            )}
            priority={index === 0}
          />
        ))}

        {/* Botones de navegación fijos */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-3 p-2 bg-black/30 text-white rounded-full transition-colors duration-300 hover:bg-black/50 z-30 top-auto bottom-4 md:top-1/2 md:bottom-auto md:-translate-y-1/2"
            >
              <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-3 p-2 bg-black/30 text-white rounded-full transition-colors duration-300 hover:bg-black/50 z-30 top-auto bottom-4 md:top-1/2 md:bottom-auto md:-translate-y-1/2"
            >
              <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
            </button>
          </>
        )}

        {/* Overlay alineado a la izquierda en desktop y mobile */}
        {showOverlay && (
          <div className="absolute inset-0 z-20 flex flex-col items-start justify-center text-left bg-gradient-to-t from-black/90 via-black/60 to-black/30 md:bg-none md:bg-gradient-to-r md:from-slate-950/95 md:via-slate-950/60 md:to-transparent px-6 sm:px-16 md:px-24 pt-16 sm:pt-0">
            {slogan && (
              <span className="font-black text-[10px] md:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-accent mb-3 animate-fade-in-down drop-shadow-md">
                {slogan}
              </span>
            )}
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] tracking-tight animate-fade-in leading-tight max-w-2xl">
              {title}
            </h2>
            <p className="mt-3 sm:mt-4 text-sm md:text-base text-white/90 md:text-white/70 max-w-lg font-medium leading-relaxed drop-shadow-sm line-clamp-3 sm:line-clamp-none">
              Explora las mejores promociones y eventos exclusivos de este prestigioso establecimiento de primer nivel, garantizado por SocioVIP.
            </p>
          </div>
        )}

        {/* Indicadores de progreso circulares */}
        {images.length > 1 && (
          <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center space-x-2">
            {images.map((_, slideIndex) => (
              <button
                key={slideIndex}
                onClick={() => goToSlide(slideIndex)}
                className={cn(
                  'h-2 rounded-full cursor-pointer transition-all duration-500 ease-in-out',
                  slideIndex === currentIndex ? 'w-8 bg-white/70' : 'w-2 bg-white/40 hover:bg-white/60'
                )}
                aria-label={`Ir a la imagen ${slideIndex + 1}`}
              >
                {slideIndex === currentIndex && (
                  <div
                    key={animationKey}
                    className="h-full rounded-full animate-progress-bar-fill"
                    style={{
                      backgroundColor: primaryColor,
                      animationDuration: `${SLIDE_DURATION}ms`,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
