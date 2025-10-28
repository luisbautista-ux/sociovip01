
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
  title = 'Nombre del Negocio',
  slogan = 'Tu lema o frase inspiradora aquí',
  logoUrl,
}: ImageCarouselProps) {
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
    setAnimationKey((prevKey) => prevKey + 1);
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
      {images.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute top-1/2 left-3 z-30 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute top-1/2 right-3 z-30 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div className="relative w-full h-full aspect-[16/9] md:rounded-lg overflow-hidden">
        {images.map((image, index) => (
          <NextImage
            key={index}
            src={image}
            alt={`Imagen ${index + 1}`}
            fill
            className={cn(
              "object-cover transition-opacity duration-700 ease-in-out",
              index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
            )}
            priority={index === 0}
          />
        ))}

        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center bg-black/30 px-6 pointer-events-none">
          {logoUrl && (
            <NextImage
              src={logoUrl}
              alt={`${title} Logo`}
              width={80}
              height={80}
              className="h-20 w-20 object-contain drop-shadow-lg mb-4"
              data-ai-hint="logo business"
            />
          )}
          {title && (
            <h2
              className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg mb-2"
              style={{ textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}
            >
              {title}
            </h2>
          )}
          {slogan && (
             <p
              className="text-lg md:text-xl text-white/90 font-medium max-w-2xl"
              style={{ textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}
            >
              {slogan}
            </p>
          )}
        </div>
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 flex space-x-2">
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
                  slideIndex === currentIndex
                    ? 'animate-progress-bar-fill'
                    : slideIndex < currentIndex
                    ? 'w-full'
                    : 'w-0'
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
