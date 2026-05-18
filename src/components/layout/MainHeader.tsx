
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { SocioVipLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Facebook, Youtube, Instagram, UserCircle, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export function MainHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
        console.error("Error fetching header contact info:", err);
      }
    };
    fetchContactInfo();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { label: 'Inicio', href: '/' },
    { label: 'Promociones', href: '#promociones' },
    { label: 'Eventos', href: '#eventos' },
    { label: 'Experiencias', href: '#experiencias' },
  ];

  return (
    <>
      <header className={cn(
        "fixed top-0 left-0 right-0 z-[100] transition-all duration-700 ease-in-out",
        isScrolled ? "bg-white shadow-[0_10px_30px_rgba(0,0,0,0.08)]" : "bg-transparent"
      )}>
        {/* Top Contact Bar */}
        <div className={cn(
          "w-full bg-[#053264] text-white overflow-hidden transition-all duration-700 ease-in-out hidden sm:block",
          isScrolled ? "max-h-0 opacity-0" : "max-h-[50px] opacity-100 py-2.5 px-4 sm:px-6 lg:px-8"
        )}>
          <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2 text-[10px] font-medium tracking-widest uppercase">
            <div className="flex items-center gap-6">
              <a href={`tel:${contactPhone.replace(/\s+/g, '')}`} className="flex items-center gap-2 hover:text-white/70 transition-colors">
                <Phone size={10} />
                <span>{contactPhone}</span>
              </a>
              <span className="hidden sm:inline text-white/20">|</span>
              <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 hover:text-white/70 transition-colors">
                <Mail size={10} />
                <span>{contactEmail}</span>
              </a>
            </div>
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <Facebook size={12} className="cursor-pointer hover:scale-110 transition-all" />
              <Youtube size={12} className="cursor-pointer hover:scale-110 transition-all" />
              <Instagram size={12} className="cursor-pointer hover:scale-110 transition-all" />
            </div>
          </div>
        </div>

        {/* Main Navigation Bar */}
        <div className={cn(
          "w-full transition-all duration-700 ease-in-out px-4 sm:px-6 lg:px-8",
          isScrolled
            ? "bg-white/95 backdrop-blur-xl py-3 border-b border-slate-100"
            : "bg-transparent py-4"
        )}>
          <div className="w-full flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center group z-10">
              <SocioVipLogo
                size={isScrolled ? 110 : 130}
                variant="pill"
                pillPadding="py-0 px-[1.5%]"
                className="!aspect-[1.6/1] !h-auto object-fill transition-all duration-700 ease-in-out drop-shadow-sm"
              />
            </Link>

            {/* Desktop Menu */}
            <nav className="hidden lg:flex items-center gap-10 text-[11px] font-black uppercase tracking-[0.2em] text-[#053264]">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="relative group transition-opacity hover:opacity-60">
                  {link.label}
                </Link>
              ))}
              <Link href="/login" passHref>
                <Button
                  variant="default"
                  className="rounded-full text-[10px] h-10 px-8 font-black uppercase tracking-[0.2em] shadow-lg bg-[#053264] hover:bg-[#053264]/90 text-white"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  Iniciar Sesión
                </Button>
              </Link>
            </nav>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-[#053264] z-10"
              aria-label="Abrir menú"
            >
              <Menu size={26} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[200] lg:hidden transition-all duration-500",
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Slide-in Panel */}
        <div className={cn(
          "absolute top-0 right-0 h-full w-[80%] max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-500 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        )}>
          {/* Panel Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <SocioVipLogo size={100} variant="pill" pillPadding="py-0 px-[1.5%]" className="!aspect-[1.6/1] !h-auto" />
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-slate-400 hover:text-[#053264] transition-colors"
              aria-label="Cerrar menú"
            >
              <X size={24} />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex flex-col px-6 pt-8 space-y-1 flex-grow">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-4 text-[#053264] font-black text-xl uppercase tracking-widest border-b border-slate-100 hover:text-secondary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Login Button */}
          <div className="p-6">
            <Link href="/login" passHref onClick={() => setIsMobileMenuOpen(false)}>
              <Button className="w-full rounded-full h-14 font-black uppercase tracking-[0.2em] text-sm bg-[#053264] hover:bg-[#053264]/90 text-white shadow-xl">
                <UserCircle className="mr-2 h-5 w-5" />
                Iniciar Sesión
              </Button>
            </Link>

            {/* Social Links */}
            <div className="flex items-center justify-center gap-6 mt-6 text-slate-400">
              <Facebook size={18} className="hover:text-[#053264] cursor-pointer transition-colors" />
              <Youtube size={18} className="hover:text-[#053264] cursor-pointer transition-colors" />
              <Instagram size={18} className="hover:text-[#053264] cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
