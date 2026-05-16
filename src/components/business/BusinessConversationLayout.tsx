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
  initialMessages?: { role: "user" | "assistant"; content: string }[];
  onBack?: () => void;
}

export function BusinessConversationLayout({
  business: initialBusiness,
  promotions,
  events,
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
      
      {/* ── MOBILE HEADER REMOVED (Consolidated into ChatPanel) ── */}

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
