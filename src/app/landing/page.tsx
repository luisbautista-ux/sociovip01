"use client";

import React, { useEffect } from "react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingProblem } from "@/components/landing/LandingProblem";
import { LandingSolution } from "@/components/landing/LandingSolution";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingBenefits } from "@/components/landing/LandingBenefits";
import { LandingStats } from "@/components/landing/LandingStats";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingLogos } from "@/components/landing/LandingLogos";
import { LandingCTA } from "@/components/landing/LandingCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function LandingPage() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            el.style.opacity = "1";
            el.style.transform = "translateY(0) scale(1)";
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );

    // Apply initial hidden state + observe
    const applyReveal = () => {
      document.querySelectorAll("[data-reveal]").forEach((el) => {
        const h = el as HTMLElement;
        h.style.opacity = "0";
        h.style.transform = "translateY(40px) scale(0.98)";
        h.style.transition = `opacity 0.75s cubic-bezier(0.16,1,0.3,1) ${h.dataset.delay || "0ms"}, transform 0.75s cubic-bezier(0.16,1,0.3,1) ${h.dataset.delay || "0ms"}`;
        observer.observe(h);
      });
    };

    // Slight delay to ensure DOM is ready
    const t = setTimeout(applyReveal, 100);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, []);

  return (
    <>
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .shimmer-text {
          background: linear-gradient(90deg, #053264 0%, #0a5cbf 40%, #053264 60%, #053264 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s linear infinite;
        }
      `}</style>
      <div className="min-h-screen bg-[#fcfbf9] overflow-x-hidden">
        <LandingHeader />
        <main>
          <LandingHero />
          <LandingProblem />
          <LandingSolution />
          <LandingHowItWorks />
          <LandingBenefits />
          <LandingStats />
          <LandingPricing />
          <LandingLogos />
          <LandingCTA />
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
