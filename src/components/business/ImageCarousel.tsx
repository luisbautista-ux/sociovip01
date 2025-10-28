
"use client";

import React, { useState } from 'react';
import NextImage from 'next/image';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCarouselProps {
  images: string[];
}

export function ImageCarousel({ images }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? images.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = () => {
    const isLastSlide = currentIndex === images.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
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
      {/* Botón Izquierda */}
      <button 
        onClick={goToPrevious}
        className="absolute top-1/2 left-3 z-10 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* Imagen Principal */}
      <div className="relative w-full h-full aspect-[16/9] md:rounded-lg overflow-hidden">
        {images.map((image, index) => (
            <NextImage
                key={index}
                src={image}
                alt={`Imagen de portada ${index + 1}`}
                fill
                className={cn(
                    "object-cover transition-opacity duration-500 ease-in-out",
                    index === currentIndex ? "opacity-100" : "opacity-0"
                )}
                priority={index === 0}
            />
        ))}
      </div>

      {/* Botón Derecha */}
      <button 
        onClick={goToNext}
        className="absolute top-1/2 right-3 z-10 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Puntos Indicadores */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 flex space-x-2">
        {images.map((_, slideIndex) => (
          <button
            key={slideIndex}
            onClick={() => goToSlide(slideIndex)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              currentIndex === slideIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/75'
            )}
          />
        ))}
      </div>
    </div>
  );
}
