"use client";
import React from "react";

const steps = [
  { num: "01", title: "Tu negocio se registra", desc: "Crea tu perfil en minutos: fotos, descripción, horarios, tipo de experiencia y capacidad." },
  { num: "02", title: "Publica promociones y eventos", desc: "Sube ofertas, crea eventos con cupos limitados y genera códigos QR de acceso automáticamente." },
  { num: "03", title: "El concierge IA te recomienda", desc: "Nuestra IA conecta a turistas con tu negocio según su perfil: ciudad, grupo, presupuesto y estilo." },
  { num: "04", title: "Gestiona y mide todo", desc: "Escanea QR en la puerta, ve quiénes asistieron, cuánto gastaron y cómo fidelizarlos." },
];

export function LandingHowItWorks() {
  return (
    <section className="py-28 bg-white relative overflow-hidden" id="como-funciona">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-16" data-reveal>
          <span className="text-[11px] font-black uppercase tracking-widest text-[#053264]/50">Proceso</span>
          <h2 className="text-4xl sm:text-5xl font-black text-[#053264] tracking-tighter mt-3">
            Cómo funciona
          </h2>
          <p className="text-slate-500 mt-4 max-w-md mx-auto">Simple, rápido y sin curva de aprendizaje.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connector line */}
          <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-[#053264]/20 to-transparent" />

          {steps.map((s, i) => (
            <div
              key={i}
              data-reveal
              data-delay={`${i * 120}ms`}
              className="group flex flex-col items-center text-center relative hover:-translate-y-1 transition-all duration-300 cursor-default"
            >
              <div className="w-20 h-20 rounded-full bg-[#fcfbf9] border-2 border-[#053264]/10 flex items-center justify-center mb-6 relative z-10 shadow-sm group-hover:bg-[#053264] group-hover:border-[#053264] group-hover:shadow-xl transition-all duration-400">
                <span className="text-3xl font-black text-[#053264]/25 group-hover:text-white/80 transition-colors duration-300">{s.num}</span>
              </div>
              <h3 className="font-black text-[#053264] text-lg mb-3 leading-tight">{s.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
