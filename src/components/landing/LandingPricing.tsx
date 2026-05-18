"use client";
import React, { useState } from "react";
import { Check, Zap } from "lucide-react";

const plans = [
  {
    name: "Básico",
    price: 49,
    desc: "Perfil del negocio, promociones y presencia en la plataforma.",
    features: [
      "Perfil de negocio completo",
      "Promociones y ofertas en vivo",
      "Presencia destacada en la plataforma",
      "QR de perfil estático",
      "Soporte estándar por email",
    ],
    cta: "Empezar gratis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: 149,
    desc: "Incluye recomendaciones inteligentes, estadísticas, campañas promocionales y gestión QR para eventos.",
    features: [
      "Todo lo del plan Básico",
      "Recomendaciones inteligentes vía Concierge IA",
      "Estadísticas y analítica de clientes",
      "Campañas promocionales avanzadas",
      "Gestión QR y control de acceso para eventos",
      "Soporte prioritario",
    ],
    cta: "Solicitar Demo",
    highlighted: true,
  },
  {
    name: "Premium",
    price: 399,
    desc: "Incluye automatización avanzada, acceso multiusuario, analítica personalizada, mayor visibilidad y soporte prioritario.",
    features: [
      "Todo lo del plan Pro",
      "Automatización avanzada y marketing",
      "Acceso multiusuario para tu equipo",
      "Analítica personalizada e informes avanzados",
      "Mayor visibilidad y publicidad destacada",
      "Soporte premium prioritario 24/7",
    ],
    cta: "Contactar ventas",
    highlighted: false,
  },
];

export function LandingPricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="py-28 bg-[#fcfbf9] relative overflow-hidden" id="precios">
      {/* Background glow */}
      <div className="absolute left-0 bottom-0 w-[400px] h-[400px] bg-[#053264]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 relative z-10">
        <div className="text-center mb-16" data-reveal>
          <span className="text-[11px] font-black uppercase tracking-widest text-[#053264]/50">Precios</span>
          <h2 className="text-4xl sm:text-5xl font-black text-[#053264] tracking-tighter mt-3">
            Planes sin sorpresas
          </h2>
          <p className="text-slate-500 mt-3">Cancela cuando quieras. Sin contratos.</p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm font-bold transition-colors ${!annual ? "text-[#053264]" : "text-slate-400"}`}>Mensual</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`w-12 h-6 rounded-full transition-colors duration-300 relative ${annual ? "bg-[#053264]" : "bg-slate-200"}`}
              aria-label="Toggle annual pricing"
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${annual ? "left-7" : "left-1"}`} />
            </button>
            <span className={`text-sm font-bold transition-colors ${annual ? "text-[#053264]" : "text-slate-400"}`}>
              Anual{" "}
              <span className="inline-flex items-center gap-1 bg-[#053264] text-[#ccffbc] rounded-full px-2 py-0.5 text-[10px] font-black ml-1">
                <Zap size={9} />-20%
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((p, i) => {
            const displayPrice = annual ? Math.round(p.price * 0.8) : p.price;
            return (
              <div
                key={i}
                data-reveal
                data-delay={`${i * 100}ms`}
                className={`rounded-3xl p-8 flex flex-col relative transition-all duration-500 hover:-translate-y-2 ${
                  p.highlighted
                    ? "bg-[#053264] text-white shadow-[0_30px_80px_rgba(5,50,100,0.3)] scale-[1.03]"
                    : "bg-white border border-slate-100 shadow-sm hover:shadow-xl"
                }`}
              >
                {p.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#ccffbc] text-[#053264] rounded-full px-5 py-1.5 text-[11px] font-black uppercase tracking-widest shadow-lg">
                    <Zap size={11} className="fill-[#053264]" />
                    Más popular
                  </div>
                )}

                <div className="mb-6">
                  <p className={`text-[11px] font-black uppercase tracking-widest mb-3 ${p.highlighted ? "text-white/60" : "text-slate-400"}`}>{p.name}</p>
                  <div className="flex items-end gap-1 mb-2">
                    <span className={`text-[3rem] font-black tracking-tighter leading-none transition-all duration-300 ${p.highlighted ? "text-white" : "text-[#053264]"}`}>
                      S/ {displayPrice}
                    </span>
                    <span className={`text-sm mb-1.5 font-medium ${p.highlighted ? "text-white/60" : "text-slate-400"}`}>/mes</span>
                  </div>
                  {annual && (
                    <p className={`text-xs font-bold ${p.highlighted ? "text-[#ccffbc]" : "text-green-600"}`}>
                      Ahorras S/ {Math.round(p.price * 0.2 * 12)}/año
                    </p>
                  )}
                  <p className={`text-sm mt-2 ${p.highlighted ? "text-white/70" : "text-slate-500"}`}>{p.desc}</p>
                </div>

                <ul className="space-y-3.5 flex-1 mb-8">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 group/item">
                      <Check size={16} className={`flex-shrink-0 mt-0.5 transition-transform group-hover/item:scale-110 ${p.highlighted ? "text-[#ccffbc]" : "text-[#053264]"}`} />
                      <span className={`text-sm ${p.highlighted ? "text-white/80" : "text-slate-600"}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#demo"
                  className={`text-center rounded-2xl py-4 font-black uppercase tracking-widest text-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                    p.highlighted
                      ? "bg-[#ccffbc] text-[#053264] hover:bg-white"
                      : "bg-[#053264] text-white hover:bg-[#053264]/90"
                  }`}
                >
                  {p.cta}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
