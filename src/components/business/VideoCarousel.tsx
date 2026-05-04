
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Video, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoCarouselProps {
  videos: string[];
  primaryColor?: string;
}

export function VideoCarousel({ videos, primaryColor = '#B080D0' }: VideoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, videos.length);
  }, [videos]);

  const handleEnded = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % videos.length);
  };

  const goToSlide = (slideIndex: number) => {
    setCurrentIndex(slideIndex);
    setProgress(0); // Reset progress on manual slide change
  };

  const goToPrevious = () => {
    goToSlide((currentIndex - 1 + videos.length) % videos.length);
  };

  const goToNext = () => {
    goToSlide((currentIndex + 1) % videos.length);
  };

  useEffect(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (currentVideo) {
      // Pause all other videos and reset them
      videoRefs.current.forEach((video, index) => {
        if (video && index !== currentIndex) {
          video.pause();
          video.currentTime = 0;
        }
      });

      // Play the current video
      currentVideo.play().catch(error => {
        console.warn("Autoplay was prevented.", error);
      });
      setProgress(0); // Reset progress when index changes
    }
  }, [currentIndex, videos]);

  const handleTimeUpdate = () => {
    const currentVideo = videoRefs.current[currentIndex];
    if (currentVideo && currentVideo.duration) {
      setProgress((currentVideo.currentTime / currentVideo.duration) * 100);
    }
  };


  if (!videos || videos.length === 0) {
    return (
      <div className="relative w-full h-full rounded-xl overflow-hidden bg-muted flex items-center justify-center">
        <Video className="w-12 h-12 text-muted-foreground" />
        <p className="ml-4 text-muted-foreground">No hay videos disponibles.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden group shadow-md">
      {videos.map((videoUrl, index) => (
        <video
          key={videoUrl}
          ref={el => videoRefs.current[index] = el}
          className={cn(
            'absolute top-0 left-0 w-full h-full object-contain transition-opacity duration-500',
            index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
          )}
          src={videoUrl}
          muted={isMuted}
          playsInline
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
        />
      ))}
      
      {videos.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute top-1/2 left-3 z-30 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full transition-opacity duration-300 hover:bg-black/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToNext}
            className="absolute top-1/2 right-3 z-30 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full transition-opacity duration-300 hover:bg-black/60"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      <button
        onClick={() => setIsMuted(prev => !prev)}
        className="absolute top-3 right-3 z-30 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      >
        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* Indicadores de progreso circulares */}
      {videos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 flex space-x-2">
          {videos.map((_, slideIndex) => (
            <div
              key={slideIndex}
              onClick={() => goToSlide(slideIndex)}
              className={cn(
                'h-2 rounded-full cursor-pointer bg-white/40 overflow-hidden transition-[width] duration-300',
                slideIndex === currentIndex ? 'w-8' : 'w-2'
              )}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${slideIndex === currentIndex ? progress : (slideIndex < currentIndex ? 100 : 0)}%`,
                  backgroundColor: primaryColor,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
