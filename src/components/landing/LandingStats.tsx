"use client";
import React from "react";

const stats = [
  { value: "50+", label: "Negocios conectados", sub: "Restaurantes, hoteles, eventos y más" },
  { value: "10min", label: "Para digitalizarte", sub: "Registro rápido, sin complicaciones" },
  { value: "IA", label: "Recomendaciones", sub: "Motor de IA generativa incluido" },
  { value: "100%", label: "Digital y sin papel", sub: "Accesos QR verificados al instante" },
];

const types = [
  "Restaurantes", "Hoteles", "Discotecas", "Viñedos",
  "Organizadores de eventos", "Spas y wellness", "Tours y aventura", "Bares y rooftops",
];

export function LandingStats() {
  return (
    <section className="py-28 bg-white relative overflow-hidden">
      {/* Decorative circle */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#ccffbc]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 relative z-10">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {stats.map((s, i) => (
            <div
              key={i}
              data-reveal
              data-delay={`${i * 80}ms`}
              className="group text-center p-8 rounded-3xl bg-[#fcfbf9] border border-slate-100 hover:bg-[#053264] hover:border-[#053264] hover:shadow-[0_20px_60px_rgba(5,50,100,0.2)] hover:-translate-y-2 transition-all duration-500 cursor-default"
            >
              <p className="text-5xl font-black text-[#053264] tracking-tighter group-hover:text-white transition-colors duration-300">{s.value}</p>
              <p className="font-black text-[#053264] text-sm uppercase tracking-widest mt-2 group-hover:text-[#ccffbc] transition-colors duration-300">{s.label}</p>
              <p className="text-slate-400 text-xs mt-1 group-hover:text-white/60 transition-colors duration-300">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Business types */}
        <div className="text-center" data-reveal>
          <p className="text-[11px] font-black uppercase tracking-widest text-[#053264]/50 mb-8">
            Tipos de negocio que ya confían en SOCIO VIP
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {types.map((t, i) => (
              <span
                key={t}
                data-reveal
                data-delay={`${i * 50}ms`}
                className="bg-[#053264]/5 border border-[#053264]/10 text-[#053264] rounded-full px-5 py-2.5 text-sm font-bold hover:bg-[#053264] hover:text-white hover:border-[#053264] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-default"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
