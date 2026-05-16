"use client";
import React from "react";
import { BarChart2, Eye, Users, Star, MapPin, Calendar, Smile, Shield } from "lucide-react";

const bizBenefits = [
  { icon: Eye, text: "Visibilidad en 50+ puntos de contacto" },
  { icon: BarChart2, text: "Analítica de clientes en tiempo real" },
  { icon: Users, text: "Gestión de accesos QR sin papel" },
  { icon: Star, text: "Fidelización automática post-visita" },
];

const userBenefits = [
  { icon: MapPin, text: "Descubre experiencias únicas cerca de ti" },
  { icon: Smile, text: "Recomendaciones personalizadas por IA" },
  { icon: Calendar, text: "Reserva y accede con un solo QR" },
  { icon: Shield, text: "Negocios 100% verificados y seguros" },
];

export function LandingBenefits() {
  return (
    <section className="py-24 bg-[#fcfbf9]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-16" data-reveal>
          <span className="text-[11px] font-black uppercase tracking-widest text-[#053264]/50">Para quién es</span>
          <h2 className="text-4xl sm:text-5xl font-black text-[#053264] tracking-tighter mt-3">
            Beneficios para todos
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* For businesses */}
          <div data-reveal className="bg-[#053264] rounded-3xl p-10 text-white">
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 rounded-full px-3 py-1">Para Negocios</span>
            <h3 className="text-3xl font-black mt-5 mb-8 tracking-tighter">Control total.<br />Resultados visibles.</h3>
            <ul className="space-y-5">
              {bizBenefits.map((b, i) => (
                <li key={i} className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <b.icon size={18} className="text-[#ccffbc]" />
                  </div>
                  <span className="text-white/85 font-medium">{b.text}</span>
                </li>
              ))}
            </ul>
            <a href="#demo" className="inline-flex items-center gap-2 mt-10 bg-[#ccffbc] text-[#053264] rounded-full px-7 py-3.5 font-black uppercase tracking-widest text-sm hover:bg-[#ccffbc]/90 transition-colors shadow-lg">
              Registrar mi negocio
            </a>
          </div>

          {/* For tourists */}
          <div data-reveal className="bg-white border border-slate-100 rounded-3xl p-10">
            <span className="text-[10px] font-black uppercase tracking-widest bg-[#053264]/5 text-[#053264] rounded-full px-3 py-1">Para Turistas</span>
            <h3 className="text-3xl font-black text-[#053264] mt-5 mb-8 tracking-tighter">Experiencias únicas.<br />En minutos.</h3>
            <ul className="space-y-5">
              {userBenefits.map((b, i) => (
                <li key={i} className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#053264]/5 rounded-xl flex items-center justify-center flex-shrink-0">
                    <b.icon size={18} className="text-[#053264]" />
                  </div>
                  <span className="text-slate-600 font-medium">{b.text}</span>
                </li>
              ))}
            </ul>
            <a href="/" className="inline-flex items-center gap-2 mt-10 bg-[#053264] text-white rounded-full px-7 py-3.5 font-black uppercase tracking-widest text-sm hover:bg-[#053264]/90 transition-colors shadow-lg">
              Explorar experiencias
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
