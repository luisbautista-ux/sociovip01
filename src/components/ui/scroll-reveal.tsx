"use client";

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number;
}

/**
 * Componente que envuelve elementos para animarlos cuando entran en el viewport.
 * Utiliza IntersectionObserver para un rendimiento óptimo.
 */
export function ScrollReveal({ 
  children, 
  className, 
  delay = 0,
  direction = 'up',
  duration = 700
}: ScrollRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentRef = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Una vez visible, dejamos de observar para no repetir la animación al subir
          observer.unobserve(entry.target);
        }
      },
      { 
        threshold: 0.1, // Se activa cuando el 10% del elemento es visible
        rootMargin: '0px 0px -50px 0px' // Se activa un poco antes de llegar al borde inferior
      }
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  // Definición de las posiciones iniciales según la dirección
  const directions = {
    up: "translate-y-12",
    down: "-translate-y-12",
    left: "translate-x-12",
    right: "-translate-x-12",
    none: "scale-95",
  };

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all ease-out",
        isVisible 
          ? "opacity-100 translate-x-0 translate-y-0 scale-100" 
          : cn("opacity-0", directions[direction]),
        className
      )}
      style={{ 
        transitionDelay: `${delay}ms`,
        transitionDuration: `${duration}ms`
      }}
    >
      {children}
    </div>
  );
}
