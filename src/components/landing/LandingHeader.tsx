"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SocioVipLogo } from "@/components/icons";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { label: "Solución", href: "#solucion" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Precios", href: "#precios" },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header className={cn(
        "fixed top-0 left-0 right-0 z-[100] transition-all duration-700 ease-in-out",
        scrolled
          ? "bg-white/95 backdrop-blur-xl py-3 border-b border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
          : "bg-transparent py-4"
      )}>
        <div className="w-full flex justify-between items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center group z-10">
            <SocioVipLogo
              size={scrolled ? 110 : 130}
              variant="pill"
              pillPadding="py-0 px-[1.5%]"
              className="!aspect-[1.6/1] !h-auto object-fill transition-all duration-700 ease-in-out drop-shadow-sm"
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-[12px] font-bold uppercase tracking-widest text-[#053264]">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="hover:opacity-60 transition-opacity">{l.label}</a>
            ))}
            <a href="#demo" className="ml-4 bg-[#053264] text-white rounded-full px-6 py-2.5 text-[11px] hover:bg-[#053264]/90 transition-colors shadow-lg">
              Solicitar Demo
            </a>
          </nav>

          <button className="md:hidden p-2 text-[#053264] z-10" onClick={() => setOpen(true)}>
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-[200] md:hidden transition-all duration-500", open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <div className={cn("absolute right-0 top-0 h-full w-[80%] max-w-sm bg-white flex flex-col shadow-2xl transition-transform duration-500", open ? "translate-x-0" : "translate-x-full")}>
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <SocioVipLogo size={100} variant="pill" pillPadding="py-0 px-[1.5%]" className="!aspect-[1.6/1] !h-auto" />
            <button onClick={() => setOpen(false)} className="p-2 text-slate-400"><X size={22} /></button>
          </div>
          <nav className="flex flex-col px-6 pt-6 gap-1 flex-1">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-4 text-[#053264] font-black text-xl uppercase tracking-widest border-b border-slate-100">{l.label}</a>
            ))}
          </nav>
          <div className="p-6">
            <a href="#demo" onClick={() => setOpen(false)} className="block text-center bg-[#053264] text-white rounded-full py-4 font-black uppercase tracking-widest text-sm">
              Solicitar Demo
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
