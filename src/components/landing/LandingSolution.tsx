"use client";
import React from "react";
import { Bot, QrCode, BarChart3, Megaphone } from "lucide-react";

const features = [
  { icon: Bot, title: "Concierge con IA", desc: "Un asistente inteligente que recomienda tu negocio a turistas según su perfil, grupo y presupuesto.", badge: "IA Generativa" },
  { icon: QrCode, title: "Accesos QR", desc: "Elimina la cola y el papel. El turista presenta su QR, tú lo escaneas. Instantáneo y seguro.", badge: "Sin contacto" },
  { icon: Megaphone, title: "Gestión de promociones", desc: "Publica y gestiona tus promociones y eventos desde un solo panel. Llega a más personas sin esfuerzo.", badge: "Todo en uno" },
  { icon: BarChart3, title: "Analítica real", desc: "Conoce quiénes son tus clientes, cuánto gastan y qué experiencias prefieren. Decide con datos.", badge: "Dashboard" },
];

export function LandingSolution() {
  return (
    <section className="py-24 bg-[#fcfbf9]" id="solucion">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-16" data-reveal>
          <span className="text-[11px] font-black uppercase tracking-widest text-[#053264]/50">La solución</span>
          <h2 className="text-4xl sm:text-5xl font-black text-[#053264] tracking-tighter mt-3 max-w-3xl mx-auto leading-tight">
            Una sola plataforma.<br />
            <span className="italic">Dos mundos conectados.</span>
          </h2>
          <p className="text-slate-500 mt-4 max-w-lg mx-auto">
            SOCIO VIP une a turistas con negocios a través de tecnología que trabaja por ti las 24 horas.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {features.map((f, i) => (
            <div
              key={i}
              data-reveal
              style={{ transitionDelay: `${i * 100}ms` }}
              className="group bg-white border border-slate-100 rounded-3xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex gap-6"
            >
              <div className="flex-shrink-0 w-14 h-14 bg-[#053264] rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <f.icon size={26} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-black text-[#053264] text-lg">{f.title}</h3>
                  <span className="text-[9px] font-black uppercase tracking-widest bg-[#ccffbc] text-[#053264] px-2 py-1 rounded-full">{f.badge}</span>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Highlight banner */}
        <div data-reveal className="bg-[#053264] rounded-3xl p-10 text-center text-white">
          <p className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-3">Por qué elegirnos</p>
          <h3 className="text-3xl sm:text-4xl font-black tracking-tighter mb-4">
            No somos Google Maps.<br />No somos TripAdvisor.
          </h3>
          <p className="text-white/70 max-w-xl mx-auto text-base leading-relaxed">
            Somos una <strong className="text-white">membresía exclusiva con beneficios activos</strong>, no un directorio estático. Tu negocio no solo aparece — se <em>recomienda inteligentemente</em>.
          </p>
        </div>
      </div>
    </section>
  );
}
