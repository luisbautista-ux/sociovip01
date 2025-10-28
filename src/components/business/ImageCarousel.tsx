
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

  if (!images || images.length === 0) {
    return (
      <div className="relative w-full aspect-[4/3] md:aspect-[16/9] md:rounded-xl overflow-hidden bg-muted flex items-center justify-center">
        <Video className="w-12 h-12 text-muted-foreground" />
        <p className="ml-4 text-muted-foreground">No hay imágenes de portada.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div className="relative w-full aspect-[4/3] md:aspect-[16/9] md:rounded-xl overflow-hidden group shadow-md">
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

        {/* Botones de navegación */}
        {images.length > 1 && (
          <>
            <button
              onClick={() =>
                setCurrentIndex((prev) =>
                  prev === 0 ? images.length - 1 : prev - 1
                )
              }
              className="absolute top-1/2 left-3 z-30 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() =>
                setCurrentIndex((prev) =>
                  prev === images.length - 1 ? 0 : prev + 1
                )
              }
              className="absolute top-1/2 right-3 z-30 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/60"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Overlay centrado */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center bg-black/30 backdrop-blur-[1px] px-4 md:px-8">
          {logoUrl && (
            <div className="relative w-16 h-16 md:w-20 md:h-20 mb-2">
              <NextImage
                src={logoUrl}
                alt="Logo del negocio"
                fill
                quality={100}
                className="object-contain drop-shadow-md rounded-md"
                sizes="(max-width: 768px) 64px, 80px"
              />
            </div>
          )}
          <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
            {title}
          </h2>
          <p
            className="text-sm md:text-lg text-white/90 mt-1 max-w-2xl font-medium leading-snug"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,0.4)' }}
          >
            {slogan}
          </p>
        </div>

        {/* Barras de progreso */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 flex space-x-2">
            {images.map((_, slideIndex) => (
              <div
                key={slideIndex}
                onClick={() => setCurrentIndex(slideIndex)}
                className="w-8 h-1 bg-white/30 rounded-full cursor-pointer overflow-hidden"
              >
                <div
                  key={
                    slideIndex === currentIndex
                      ? animationKey
                      : `static-${slideIndex}`
                  }
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
                    animationDuration:
                      slideIndex === currentIndex
                        ? `${SLIDE_DURATION}ms`
                        : undefined,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
