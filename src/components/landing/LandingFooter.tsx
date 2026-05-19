"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SocioVipLogo } from "@/components/icons";

import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const footerLinks = [
  { label: "Inicio", href: "/" },
  { label: "Solución", href: "#solucion" },
  { label: "Precios", href: "#precios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Iniciar Sesión", href: "/login" },
];

export function LandingFooter() {
  const [contactPhone, setContactPhone] = useState("+51 942 401 695");
  const [contactEmail, setContactEmail] = useState("hola@sociovip.pe");

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const configDocRef = doc(db, "platformSettings", "membershipConfig");
        const configSnap = await getDoc(configDocRef);
        if (configSnap.exists()) {
          const configData = configSnap.data();
          if (configData.contactPhone) {
            setContactPhone(configData.contactPhone);
          }
          if (configData.contactEmail) {
            setContactEmail(configData.contactEmail);
          }
        }
      } catch (err) {
        console.error("Error fetching landing footer contact info:", err);
      }
    };
    fetchContactInfo();
  }, []);

  return (
    <footer className="bg-[#053264] text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          {/* Brand */}
          <div>
            <SocioVipLogo size={120} variant="pill" pillPadding="py-0 px-[1.5%]" className="!aspect-[1.6/1] !h-auto mb-4" />
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              La plataforma de concierge digital que conecta turistas con las mejores experiencias de Perú.
            </p>

          </div>

          {/* Links */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-5">Navegación</p>
            <ul className="space-y-3">
              {footerLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-white/70 hover:text-white transition-colors text-sm font-medium">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-5">Contacto</p>
            <ul className="space-y-3 text-sm text-white/70">
              <li><a href={`tel:${contactPhone.replace(/\s+/g, '')}`} className="hover:text-white transition-colors">{contactPhone}</a></li>
              <li><a href={`mailto:${contactEmail}`} className="hover:text-white transition-colors">{contactEmail}</a></li>
              <li className="text-white/40">Lima, Perú</li>
            </ul>

            <a href="#demo" className="inline-block mt-8 bg-[#ccffbc] text-[#053264] rounded-full px-6 py-3 text-sm font-black uppercase tracking-widest hover:bg-[#ccffbc]/90 transition-colors">
              Solicitar Demo
            </a>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-white/40 text-xs">
          <p>© {new Date().getFullYear()} SOCIO VIP. Todos los derechos reservados.</p>

        </div>
      </div>
    </footer>
  );
}
