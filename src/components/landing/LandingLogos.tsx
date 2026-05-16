"use client";

import React, { useEffect, useState, useRef } from "react";
import NextImage from "next/image";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface BusinessLogo {
  id: string;
  name: string;
  logoUrl: string;
}

export function LandingLogos() {
  const [logos, setLogos] = useState<BusinessLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const snap = await getDocs(collection(db, "businesses"));
        const result: BusinessLogo[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          if (data.logoUrl) {
            result.push({ id: doc.id, name: data.name || "Negocio", logoUrl: data.logoUrl });
          }
        });
        setLogos(result);
      } catch (e) {
        console.error("Error loading business logos:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogos();
  }, []);

  // Need at least 2 items to show the carousel; duplicate for seamless loop
  const displayLogos = logos.length > 0 ? [...logos, ...logos, ...logos] : [];

  if (loading || logos.length === 0) return null;

  return (
    <section className="py-20 bg-[#fcfbf9] overflow-hidden border-y border-slate-100" data-reveal>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-10 text-center">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#053264]/40">
          Negocios que ya confían en SOCIO VIP
        </p>
      </div>

      {/* Carousel wrapper with fade edges */}
      <div className="relative">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#fcfbf9] to-transparent z-10 pointer-events-none" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#fcfbf9] to-transparent z-10 pointer-events-none" />

        {/* Scrolling track */}
        <div
          ref={trackRef}
          className="flex items-center gap-8"
          style={{
            animation: `logo-scroll ${logos.length * 3}s linear infinite`,
            width: "max-content",
          }}
        >
          {displayLogos.map((biz, i) => (
            <div
              key={`${biz.id}-${i}`}
              className="flex-shrink-0 flex items-center justify-center bg-white border border-slate-100 rounded-2xl p-4 h-28 w-56 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#053264]/20 transition-all duration-300 group"
              title={biz.name}
            >
              <div className="relative w-full h-full">
                <NextImage
                  src={biz.logoUrl}
                  alt={`Logo de ${biz.name}`}
                  fill
                  className="object-contain transition-transform duration-500 group-hover:scale-110"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Keyframe defined inline */}
        <style>{`
          @keyframes logo-scroll {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-${(100 / 3).toFixed(4)}%); }
          }
        `}</style>
      </div>

      {/* Business count badge */}
      <div className="text-center mt-10">
        <span className="inline-flex items-center gap-2 bg-[#053264]/5 border border-[#053264]/10 text-[#053264] rounded-full px-5 py-2.5 text-sm font-bold">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          {logos.length} negocios activos en la plataforma
        </span>
      </div>
    </section>
  );
}
