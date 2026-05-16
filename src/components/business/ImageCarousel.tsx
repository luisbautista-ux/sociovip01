
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
}

const SLIDE_DURATION = 5000;

export function ImageCarousel({
  images,
  primaryColor = '#B080D0',
  title = '',
  slogan = '',
  logoUrl,
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
      <div className="relative w-full aspect-[4/3] md:aspect-[16/9] md:rounded-xl overflow-hidden bg-muted flex items-center justify-center">
        <Video className="w-12 h-12 text-muted-foreground" />
        <p className="ml-4 text-muted-foreground">No hay imágenes de portada.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full px-0">
      <div className="relative w-full aspect-[4/3] md:aspect-[16/7] md:rounded-2xl overflow-hidden group shadow-2xl">
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
              className="absolute top-1/2 left-3 z-30 -translate-y-1/2 p-2 bg-black/30 text-white rounded-full transition-colors duration-300 hover:bg-black/50"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute top-1/2 right-3 z-30 -translate-y-1/2 p-2 bg-black/30 text-white rounded-full transition-colors duration-300 hover:bg-black/50"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Overlay centrado */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center bg-black/40 backdrop-blur-[1px] px-4 md:px-8">
          {logoUrl && (
            <div className="relative w-20 h-20 md:w-24 md:h-24 mb-6 animate-fade-in-down">
              <NextImage
                src={logoUrl}
                alt="Logo del negocio"
                fill
                quality={100}
                className="object-contain drop-shadow-2xl rounded-lg"
                sizes="(max-width: 768px) 80px, 96px"
              />
            </div>
          )}
          <h2 className="text-4xl md:text-6xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] tracking-tight animate-fade-in">
            {title}
          </h2>
          {slogan && (
            <div className="mt-4 flex items-center justify-center">
                <div className="h-[2px] w-12 bg-white/50 mr-4 rounded-full" />
                <p className="text-base md:text-xl text-white/90 font-bold uppercase tracking-[0.2em] drop-shadow-md">
                    {slogan}
                </p>
                <div className="h-[2px] w-12 bg-white/50 ml-4 rounded-full" />
            </div>
          )}
        </div>

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
