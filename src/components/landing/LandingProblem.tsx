"use client";
import React from "react";
import { Share2, Users, FileX, TrendingDown } from "lucide-react";

const pains = [
  { icon: Share2, title: "Redes sociales sin estrategia", desc: "Publicas en 5 plataformas distintas sin resultados medibles ni segmentación real." },
  { icon: Users, title: "No conoces a tus clientes", desc: "No sabes quiénes son, cuánto gastan ni qué experiencias prefieren." },
  { icon: FileX, title: "Accesos manuales y con papel", desc: "Listas en Excel, pulseras físicas y colas interminables en la entrada de tus eventos." },
  { icon: TrendingDown, title: "Sin fidelización post-visita", desc: "El cliente se va y nunca más sabes de él. Sin datos, sin retención, sin crecimiento." },
];

export function LandingProblem() {
  return (
    <section className="py-28 bg-white relative overflow-hidden" id="problema">
      {/* subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(#053264 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 relative z-10">
        <div className="text-center mb-16" data-reveal>
          <span className="text-[11px] font-black uppercase tracking-widest text-[#053264]/50">El problema</span>
          <h2 className="text-4xl sm:text-5xl font-black text-[#053264] tracking-tighter mt-3 max-w-2xl mx-auto leading-tight">
            Los negocios turísticos<br />operan como en el 2010.
          </h2>
          <p className="text-slate-500 mt-4 max-w-lg mx-auto text-base">
            La mayoría sigue gestionando clientes, eventos y promociones de forma desconectada y manual.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pains.map((p, i) => (
            <div
              key={i}
              data-reveal
              data-delay={`${i * 100}ms`}
              className="group bg-[#fcfbf9] border border-slate-100 rounded-3xl p-7 hover:shadow-xl hover:-translate-y-2 hover:border-red-100 transition-all duration-400 cursor-default"
            >
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-red-100 group-hover:scale-110 transition-all duration-300">
                <p.icon size={22} className="text-red-400" />
              </div>
              <h3 className="font-black text-[#053264] text-base mb-2">{p.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
