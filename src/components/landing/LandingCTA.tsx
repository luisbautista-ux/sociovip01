"use client";
import React, { useState } from "react";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";

export function LandingCTA() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", business: "", email: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSent(true); }, 1200);
  };

  return (
    <section className="py-28 bg-white relative overflow-hidden" id="demo">
      {/* Animated gradient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[#ccffbc]/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center relative z-10">
        <div data-reveal>
          <span className="text-[11px] font-black uppercase tracking-widest text-[#053264]/50">¿Listo?</span>
          <h2 className="text-4xl sm:text-6xl font-black text-[#053264] tracking-tighter mt-3 mb-6 leading-tight">
            Digitaliza tu negocio<br />
            <span className="italic">hoy mismo.</span>
          </h2>
          <p className="text-slate-500 text-lg mb-12 max-w-lg mx-auto">
            Agenda una demo gratuita de 20 minutos y te mostramos exactamente cómo SOCIO VIP puede multiplicar tu alcance.
          </p>
        </div>

        {!sent ? (
          <form
            onSubmit={handleSubmit}
            data-reveal
            className="bg-[#fcfbf9] border border-slate-100 rounded-3xl p-8 sm:p-10 max-w-xl mx-auto text-left shadow-sm hover:shadow-lg transition-shadow duration-500"
          >
            <div className="space-y-4">
              {[
                { id: "name", label: "Tu nombre", type: "text", placeholder: "Ej: María García", key: "name" },
                { id: "business", label: "Nombre del negocio", type: "text", placeholder: "Ej: Restaurante El Balcón", key: "business" },
                { id: "email", label: "Email de contacto", type: "email", placeholder: "tu@negocio.pe", key: "email" },
              ].map((field) => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="text-[11px] font-black uppercase tracking-widest text-[#053264] block mb-2">
                    {field.label}
                  </label>
                  <input
                    id={field.id}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={form[field.key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    required={field.key !== "business"}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-[#053264] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#053264]/20 focus:border-[#053264]/30 transition-all duration-200"
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-[#053264] text-white rounded-2xl py-4 font-black uppercase tracking-widest text-sm hover:bg-[#053264]/90 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Enviando...</>
              ) : (
                <><span>Agendar Demo Gratuita</span><ArrowRight size={16} /></>
              )}
            </button>

            <p className="text-center text-slate-400 text-xs mt-4">
              Sin compromiso · Respuesta en menos de 24h · 100% gratis
            </p>
          </form>
        ) : (
          <div data-reveal className="flex flex-col items-center gap-5 py-16">
            <div className="w-20 h-20 bg-[#ccffbc] rounded-full flex items-center justify-center animate-bounce" style={{ animationDuration: '2s' }}>
              <CheckCircle size={40} className="text-[#053264]" />
            </div>
            <h3 className="text-3xl font-black text-[#053264] tracking-tighter">¡Solicitud recibida!</h3>
            <p className="text-slate-500 max-w-sm text-center">Te contactaremos en menos de 24 horas para coordinar tu demo personalizada.</p>
            <a href="/" className="mt-4 bg-[#053264] text-white rounded-full px-8 py-4 font-black uppercase tracking-widest text-sm hover:bg-[#053264]/90 transition-colors">
              Explorar la plataforma
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
