"use client";
import React, { useEffect, useRef } from "react";
import { ArrowRight, Sparkles, QrCode } from "lucide-react";

export function LandingHero() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const children = el.querySelectorAll("[data-hero]");
    children.forEach((child, i) => {
      const c = child as HTMLElement;
      c.style.opacity = "0";
      c.style.transform = "translateY(30px)";
      c.style.transition = `opacity 0.8s ease ${i * 0.12}s, transform 0.8s ease ${i * 0.12}s`;
      requestAnimationFrame(() => {
        setTimeout(() => {
          c.style.opacity = "1";
          c.style.transform = "translateY(0)";
        }, 100);
      });
    });
  }, []);

  return (
    <section className="relative min-h-screen flex items-center bg-[#fcfbf9] overflow-hidden pt-20">
      {/* Animated background blobs */}
      <div className="absolute -top-20 -right-40 w-[600px] h-[600px] bg-[#ccffbc]/20 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute -bottom-20 -left-40 w-[400px] h-[400px] bg-[#053264]/5 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#053264]/3 rounded-full blur-[200px] pointer-events-none" />

      <div ref={heroRef} className="max-w-7xl mx-auto px-5 sm:px-8 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center py-20 relative z-10">
        {/* Left */}
        <div className="flex flex-col gap-8">
          {/* Badge */}
          <div data-hero className="inline-flex items-center gap-2 bg-[#053264]/5 border border-[#053264]/10 rounded-full px-4 py-2 w-fit hover:bg-[#053264]/10 transition-colors cursor-default">
            <Sparkles size={14} className="text-[#053264] animate-spin" style={{ animationDuration: '4s' }} />
            <span className="text-[11px] font-black uppercase tracking-widest text-[#053264]">Plataforma con IA · Perú</span>
          </div>

          <h1 data-hero className="text-5xl sm:text-6xl lg:text-7xl font-black text-[#053264] tracking-tighter leading-[0.92]">
            Tu negocio<br />
            turístico,<br />
            <span className="italic">digitalizado</span><br />
            <span className="italic">en 10 minutos.</span>
          </h1>

          <p data-hero className="text-slate-500 text-lg max-w-md leading-relaxed">
            SOCIO VIP conecta tu restaurante, hotel o evento con turistas listos para vivir experiencias exclusivas — usando <strong className="text-[#053264]">inteligencia artificial y códigos QR</strong>.
          </p>

          <div data-hero className="flex flex-col sm:flex-row gap-4">
            <a href="#demo" className="group flex items-center justify-center gap-2 bg-[#053264] text-white rounded-full px-8 py-4 font-black uppercase tracking-widest text-sm hover:bg-[#053264]/90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0">
              Solicitar Demo Gratuita
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="#como-funciona" className="flex items-center justify-center gap-2 border-2 border-[#053264]/20 text-[#053264] rounded-full px-8 py-4 font-black uppercase tracking-widest text-sm hover:border-[#053264]/50 hover:bg-[#053264]/5 transition-all">
              Ver cómo funciona
            </a>
          </div>

          {/* Mini stats */}
          <div data-hero className="flex items-center gap-8 pt-4">
            {[["50+", "Negocios"], ["10min", "Para empezar"], ["IA", "Incluida"]].map(([val, label], i) => (
              <div key={label} className="group cursor-default" style={{ transitionDelay: `${i * 80}ms` }}>
                <p className="text-2xl font-black text-[#053264] group-hover:scale-110 transition-transform inline-block">{val}</p>
                <p className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Dashboard mockup with entrance animation */}
        <div data-hero className="hidden lg:block relative">
          <div className="relative bg-white rounded-3xl shadow-[0_30px_80px_rgba(5,50,100,0.12)] border border-slate-100 overflow-hidden p-6 hover:shadow-[0_40px_100px_rgba(5,50,100,0.18)] hover:-translate-y-2 transition-all duration-500">
            {/* Browser bar */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="ml-4 flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3">
                <span className="text-[10px] text-slate-400 font-mono">app.sociovip.pe/panel</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[["124", "Clientes", "#ccffbc22"], ["8", "Eventos Activos", "#05326410"], ["S/ 4,820", "Este mes", "#f0f9ff"]].map(([v, l, bg]) => (
                <div key={l} className="rounded-2xl p-3 text-center hover:scale-105 transition-transform cursor-default" style={{ backgroundColor: bg }}>
                  <p className="text-xl font-black text-[#053264]">{v}</p>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-1">{l}</p>
                </div>
              ))}
            </div>

            {/* Recent accesses */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2 mb-4">
              <p className="text-[11px] font-black text-[#053264] uppercase tracking-widest mb-3">Accesos recientes</p>
              {["Carlos M.", "Ana P.", "Luis R."].map((n) => (
                <div key={n} className="flex items-center justify-between group/row hover:bg-white rounded-xl px-2 py-1 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#053264]/10 flex items-center justify-center text-[10px] font-black text-[#053264]">{n[0]}</div>
                    <span className="text-xs text-slate-600 font-medium">{n}</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <QrCode size={12} />
                    <span className="text-[10px] font-bold">Verificado</span>
                  </div>
                </div>
              ))}
            </div>

            {/* AI message */}
            <div className="bg-[#053264] rounded-2xl p-4 text-white">
              <p className="text-[11px] font-black uppercase tracking-widest opacity-60">Concierge IA</p>
              <p className="text-sm font-medium mt-1 opacity-90">"2 clientes consultan por tu promoción de fin de semana..."</p>
            </div>
          </div>

          {/* Floating QR badge with pulse */}
          <div className="absolute -bottom-4 -left-6 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3 flex items-center gap-3 hover:shadow-2xl hover:-translate-y-1 transition-all">
            <div className="w-10 h-10 bg-[#ccffbc] rounded-full flex items-center justify-center animate-pulse">
              <QrCode size={20} className="text-[#053264]" />
            </div>
            <div>
              <p className="text-xs font-black text-[#053264]">QR Verificado</p>
              <p className="text-[10px] text-slate-400">Acceso instantáneo</p>
            </div>
          </div>

          {/* Floating stat badge */}
          <div className="absolute -top-4 -right-4 bg-[#053264] text-white rounded-2xl shadow-xl px-4 py-3 hover:shadow-2xl hover:-translate-y-1 transition-all">
            <p className="text-xs font-black">+18 accesos hoy</p>
            <p className="text-[10px] text-white/60">↑ 24% vs ayer</p>
          </div>
        </div>
      </div>
    </section>
  );
}
