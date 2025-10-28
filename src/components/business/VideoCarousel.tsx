
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Video, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoCarouselProps {
  videos: string[];
}

export function VideoCarousel({ videos }: VideoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, videos.length);
  }, [videos]);

  const handleEnded = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % videos.length);
  };
  
  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + videos.length) % videos.length);
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % videos.length);
  };

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (video) {
        if (index === currentIndex) {
          video.play().catch(error => {
            // Autoplay was prevented.
            console.warn("Autoplay was prevented. User interaction might be required.", error);
          });
        } else {
          video.pause();
          video.currentTime = 0;
        }
      }
    });
  }, [currentIndex, videos]);

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
          autoPlay={index === currentIndex}
          playsInline
          loop={videos.length === 1} // Loop only if there's one video
          onEnded={handleEnded}
        />
      ))}
      
      {videos.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute top-1/2 left-3 z-30 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToNext}
            className="absolute top-1/2 right-3 z-30 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
           <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 flex space-x-2">
                {videos.map((_, slideIndex) => (
                <div
                    key={slideIndex}
                    onClick={() => setCurrentIndex(slideIndex)}
                    className="w-8 h-1.5 bg-white/40 rounded-full cursor-pointer overflow-hidden"
                >
                    <div
                    className="h-full bg-primary"
                    style={{ width: slideIndex === currentIndex ? '100%' : (slideIndex < currentIndex ? '100%' : '0%'), transition: slideIndex === currentIndex ? 'width 5s linear' : 'none' }}
                    />
                </div>
                ))}
            </div>
        </>
      )}

      <button
        onClick={() => setIsMuted(prev => !prev)}
        className="absolute top-3 right-3 z-30 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
    </div>
  );
}
