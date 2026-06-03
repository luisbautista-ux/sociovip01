"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { Business, BusinessManagedEntity } from "@/lib/types";
import { BusinessChatPanel } from "@/components/business/BusinessChatPanel";
import { BusinessMediaPanel } from "@/components/business/BusinessMediaPanel";
import { MessageSquare, Map, Video, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const BusinessMapGoogle = dynamic(
  () => import("@/components/business/BusinessMapGoogle").then((m) => m.BusinessMapGoogle),
  { ssr: false }
);

type ActivePanel = "chat" | "media" | "map";

interface BusinessConversationLayoutProps {
  business: Business; // El negocio inicial (o el Concierge)
  promotions: BusinessManagedEntity[];
  events: BusinessManagedEntity[];
  businesses?: Business[];
  initialMessages?: { role: "user" | "assistant"; content: string }[];
  onBack?: () => void;
}

export function BusinessConversationLayout({
  business: initialBusiness,
  promotions,
  events,
  businesses = [],
  initialMessages = [],
  onBack,
}: BusinessConversationLayoutProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>("chat");
  const [currentBusiness, setCurrentBusiness] = useState<Business>(initialBusiness);
  const [activeBusinesses, setActiveBusinesses] = useState<Business[]>([initialBusiness]);

  // Función para cambiar el negocio enfocado (llamada desde el chat)
  const handleBusinessChange = (businessIds: string | string[]) => {
    const ids = Array.isArray(businessIds) ? businessIds : [businessIds];
    const allEntities = [...promotions, ...events];
    
    const matchedBusinesses: Business[] = [];
    
    ids.forEach(id => {
      // Intentamos buscar primero en las entidades activas
      const entity = allEntities.find(e => e.businessId === id);
      if (entity) {
        matchedBusinesses.push({
          id: entity.businessId,
          name: (entity as any).businessName || "Negocio",
          logoUrl: (entity as any).businessLogoUrl,
          publicVideoUrls: (entity as any).businessVideoUrls || [],
          publicAddress: (entity as any).locationAddress || "Perú",
          province: (entity as any).businessProvince || "",
          district: (entity as any).businessDistrict || "",
          department: (entity as any).businessDepartment || "",
          businessType: (entity as any).businessType || "Local",
          publicImageUrls: (entity as any).businessImageUrls || [entity.imageUrl].filter(Boolean),
          customUrlPath: (entity as any).businessCustomUrlPath || null,
        } as any);
      } else {
        // Si no hay entidad activa, buscamos en los negocios registrados en general
        const biz = businesses.find(b => b.id === id);
        if (biz) {
          matchedBusinesses.push({
            id: biz.id,
            name: biz.name || "Negocio",
            logoUrl: biz.logoUrl,
            publicVideoUrls: biz.publicVideoUrls || [],
            publicAddress: biz.publicAddress || biz.address || "Perú",
            province: biz.province || "",
            district: biz.district || "",
            department: biz.department || "",
            businessType: biz.businessType || "Local",
            publicImageUrls: biz.publicCoverImageUrls || [],
            customUrlPath: biz.customUrlPath || null,
          } as any);
        }
      }
    });

    if (matchedBusinesses.length > 0) {
      setActiveBusinesses(matchedBusinesses);
      // El mapa y el encabezado del chat siguen usando el primero mencionado como principal
      setCurrentBusiness(matchedBusinesses[0]);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gradient-to-br from-slate-100 via-white to-slate-200 overflow-hidden text-slate-900">
      
      {/* ── MOBILE HEADER (Persistent Switcher for Chat, Video, Map) ── */}
      <div className="md:hidden flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-white/90 backdrop-blur-md flex items-center justify-between z-20">
        {onBack ? (
          <button 
            onClick={onBack}
            className="flex items-center gap-1 text-slate-500 hover:text-[#053264] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="text-xs font-bold uppercase tracking-wider">Volver</span>
          </button>
        ) : (
          <div className="w-10" />
        )}
        
        {/* Mobile Switcher */}
        <div className="flex bg-slate-100 rounded-full p-1 border border-slate-200">
          <button 
            onClick={() => setActivePanel("chat")} 
            className={cn("p-1.5 rounded-full transition-all", activePanel === "chat" ? "bg-[#053264] text-white shadow-sm" : "text-slate-400")}
            aria-label="Chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setActivePanel("media")} 
            className={cn("p-1.5 rounded-full transition-all", activePanel === "media" ? "bg-[#053264] text-white shadow-sm" : "text-slate-400")}
            aria-label="Exclusive Media"
          >
            <Video className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setActivePanel("map")} 
            className={cn("p-1.5 rounded-full transition-all", activePanel === "map" ? "bg-[#053264] text-white shadow-sm" : "text-slate-400")}
            aria-label="Location Map"
          >
            <Map className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── MAIN 3-COLUMN CONTENT ── */}
      <div className="flex flex-1 min-h-0 relative">
        
        {/* 1. LEFT COLUMN: Chat (30%) */}
        <div className={cn(
          "h-full border-r border-slate-200 flex flex-col transition-all shadow-lg z-10",
          "md:w-[30%]",
          activePanel === "chat" ? "flex flex-1" : "hidden md:flex"
        )}>
          <BusinessChatPanel 
            business={currentBusiness} 
            promotions={promotions} 
            events={events} 
            businesses={businesses}
            initialHistory={initialMessages}
            onBusinessDetected={handleBusinessChange}
            onBack={onBack}
            activePanel={activePanel}
            onPanelChange={setActivePanel}
          />
        </div>

        {/* 2. CENTER COLUMN: Media (25%) */}
        <div className={cn(
          "h-full border-r border-slate-200 transition-all z-0",
          "md:w-[25%]",
          activePanel === "media" ? "flex flex-1" : "hidden md:flex"
        )}>
          <BusinessMediaPanel businesses={activeBusinesses} />
        </div>

        {/* 3. RIGHT COLUMN: Map (45%) */}
        <div className={cn(
          "h-full transition-all",
          "md:w-[45%]",
          activePanel === "map" ? "flex flex-1" : "hidden md:flex"
        )}>
          <BusinessMapGoogle 
            businesses={activeBusinesses} 
            primaryAddress={currentBusiness.publicAddress} 
          />
        </div>

      </div>
    </div>
  );
}
