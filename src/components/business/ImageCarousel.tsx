
"use client";

import React, { useState, useEffect } from 'react';
import NextImage from 'next/image';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCarouselProps {
  images: string[];
  primaryColor?: string; // Prop para el color primario
}

const SLIDE_DURATION = 5000; // 5 segundos por slide

export function ImageCarousel({ images, primaryColor = '#B080D0' }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;

    const slideInterval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
    }, SLIDE_DURATION);

    return () => clearInterval(slideInterval);
  }, [images.length]);
  
  useEffect(() => {
    // Cambia la key para forzar el reinicio de la animación CSS
    setAnimationKey(prevKey => prevKey + 1);
  }, [currentIndex]);


  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
  };

  const goToSlide = (slideIndex: number) => {
    setCurrentIndex(slideIndex);
  };
  
  if (!images || images.length === 0) {
      return (
        <div className="relative w-full aspect-[16/9] md:rounded-lg overflow-hidden bg-muted flex items-center justify-center">
            <Video className="w-12 h-12 text-muted-foreground" />
            <p className="ml-4 text-muted-foreground">No hay imágenes de portada.</p>
        </div>
      );
  }

  return (
    <div className="relative w-full h-full group">
      {/* Botones de navegación (solo si hay más de una imagen) */}
      {images.length > 1 && (
        <>
          <button 
            onClick={goToPrevious}
            className="absolute top-1/2 left-3 z-20 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button 
            onClick={goToNext}
            className="absolute top-1/2 right-3 z-20 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Contenedor de la Imagen */}
      <div className="relative w-full h-full aspect-[16/9] md:rounded-lg overflow-hidden">
        {images.map((image, index) => (
            <NextImage
                key={index}
                src={image}
                alt={`Imagen de portada ${index + 1}`}
                fill
                className={cn(
                    "object-cover transition-opacity duration-700 ease-in-out",
                    index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                )}
                priority={index === 0}
            />
        ))}
      </div>

      {/* Barras de Progreso */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex space-x-2">
          {images.map((_, slideIndex) => (
            <div
              key={slideIndex}
              onClick={() => goToSlide(slideIndex)}
              className="w-8 h-1 bg-white/30 rounded-full cursor-pointer overflow-hidden"
            >
              <div
                key={slideIndex === currentIndex ? animationKey : `static-${slideIndex}`}
                className={cn(
                  'h-full rounded-full',
                   slideIndex === currentIndex ? 'animate-progress-bar-fill' : (slideIndex < currentIndex ? 'w-full' : 'w-0')
                )}
                style={{
                  backgroundColor: primaryColor,
                  animationDuration: slideIndex === currentIndex ? `${SLIDE_DURATION}ms` : undefined,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
