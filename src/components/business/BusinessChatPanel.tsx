"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, Mic, Sparkles, Tag, Calendar, Phone, Mail, MapPin, ChevronRight, Copy, Check, ArrowLeft, MessageSquare, Video, Map } from "lucide-react";
import type { Business, BusinessManagedEntity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { chatWithBusiness } from "@/ai/flows/business-chat";
import { SocioVipLogo } from "@/components/icons";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  entityCards?: BusinessManagedEntity[];
  type?: "info" | "action" | "text";
}

interface BusinessChatPanelProps {
  business: Business;
  promotions: BusinessManagedEntity[];
  events: BusinessManagedEntity[];
  initialHistory?: { role: "user" | "assistant"; content: string }[];
  onBusinessDetected?: (businessId: string) => void;
  onBack?: () => void;
  activePanel?: "chat" | "media" | "map";
  onPanelChange?: (panel: "chat" | "media" | "map") => void;
}

function buildWelcomeMessage(business: Business, promotions: BusinessManagedEntity[], events: BusinessManagedEntity[]): ChatMessage {
  const promoCount = promotions.length;
  const eventCount = events.length;
  
  let content = `¡Hola! Soy el asistente virtual de **${business.name}**. 👋\n\n`;

  if (business.slogan) {
    content += `_"${business.slogan}"_\n\n`;
  }

  if (promoCount > 0 || eventCount > 0) {
    content += `Me alegra saludarte. Hoy tenemos contenido exclusivo para ti:\n\n`;
    if (promoCount > 0) content += `• 🏷️ **${promoCount}** promoción${promoCount > 1 ? "es" : ""} especial${promoCount > 1 ? "es" : ""}\n`;
    if (eventCount > 0) content += `• 🎉 **${eventCount}** próximo${eventCount > 1 ? "s" : ""} evento${eventCount > 1 ? "s" : ""}\n`;
    content += `\n¿Te gustaría ver los detalles o tienes alguna pregunta sobre nosotros?`;
  } else {
    content += `¿En qué te puedo ayudar hoy? Puedes preguntarme sobre lo que necesites: horarios, ubicación, contacto o simplemente saber más de nosotros.`;
  }

  const suggestions = [];
  if (promoCount > 0) suggestions.push("Ver promociones");
  if (eventCount > 0) suggestions.push("Ver eventos");
  suggestions.push("¿Dónde están?", "Contacto");

  return {
    id: "welcome",
    role: "assistant",
    content,
    timestamp: new Date(),
    suggestions,
    type: "info"
  };
}

function generateResponse(
  userMessage: string,
  business: Business,
  promotions: BusinessManagedEntity[],
  events: BusinessManagedEntity[]
): ChatMessage {
  const lower = userMessage.toLowerCase();
  let content = "";
  let suggestions: string[] = [];
  let entityCards: BusinessManagedEntity[] | undefined;

  if (lower.includes("promoci") || lower.includes("descuento") || lower.includes("oferta")) {
    if (promotions.length > 0) {
      content = `¡Excelentes noticias! Tenemos **${promotions.length}** promoción${promotions.length > 1 ? "es" : ""} activa${promotions.length > 1 ? "s" : ""} para ti:`;
      entityCards = promotions.slice(0, 3);
      suggestions = ["Ver eventos", "¿Cómo llegar?", "Contactar"];
    } else {
      content = "En este momento no tenemos promociones activas, pero te invitamos a seguirnos para estar al tanto de futuras ofertas. 😊";
      suggestions = ["Ver eventos", "¿Cómo llegar?", "Más información"];
    }
  } else if (lower.includes("evento") || lower.includes("actividad")) {
    if (events.length > 0) {
      content = `¡Tenemos **${events.length}** evento${events.length > 1 ? "s" : ""} próximo${events.length > 1 ? "s" : ""} que te pueden interesar!`;
      entityCards = events.slice(0, 3);
      suggestions = ["Ver promociones", "¿Cómo llegar?", "Contactar"];
    } else {
      content = "Por el momento no tenemos eventos programados. Te avisaremos pronto sobre nuestras próximas actividades.";
      suggestions = ["Ver promociones", "¿Cómo llegar?", "Más información"];
    }
  } else if (lower.includes("ubicaci") || lower.includes("direccion") || lower.includes("dirección") || lower.includes("llegar") || lower.includes("donde")) {
    if (business.publicAddress) {
      content = `📍 Nos encontramos en:\n\n**${business.publicAddress}**`;
      if (business.district || business.province) {
        content += `\n${[business.district, business.province, business.department].filter(Boolean).join(", ")}`;
      }
      content += "\n\nPuedes ver nuestra ubicación en el mapa 3D a la derecha. 👉";
    } else {
      content = "Para conocer nuestra dirección exacta, te recomendamos contactarnos directamente a través de nuestros canales de comunicación.";
    }
    suggestions = ["Información de contacto", "Ver promociones", "Ver eventos"];
  } else if (lower.includes("contacto") || lower.includes("telefono") || lower.includes("teléfono") || lower.includes("email") || lower.includes("llamar")) {
    content = "📞 **Información de contacto:**\n\n";
    if (business.publicPhone) content += `• **Teléfono:** ${business.publicPhone}\n`;
    if (business.publicContactEmail) content += `• **Email:** ${business.publicContactEmail}\n`;
    if (!business.publicPhone && !business.publicContactEmail) {
      content += "Puedes comunicarte con nosotros a través de nuestras redes sociales.";
    }
    suggestions = ["¿Dónde están ubicados?", "Ver promociones", "Ver eventos"];
  } else if (lower.includes("horario") || lower.includes("hora") || lower.includes("abierto") || lower.includes("cerrado")) {
    content = "⏰ **Horarios de atención:**\n\nNuestros horarios varían según el día y el tipo de evento. Te recomiendo revisar nuestras promociones y eventos actuales para ver los horarios específicos de cada uno.";
    suggestions = ["Ver eventos", "Ver promociones", "Información de contacto"];
  } else if (lower.includes("hola") || lower.includes("buen") || lower.includes("saludo")) {
    content = `¡Hola! Soy el asistente virtual de **${business.name}**. Es un gusto saludarte. ¿Cómo puedo ayudarte hoy?`;
    suggestions = ["Ver promociones", "Ver eventos", "¿Dónde están?", "Contacto"];
  } else if (lower.includes("gracias") || lower.includes("agradezco")) {
    content = "¡De nada! Es un placer ayudarte. Si tienes alguna otra duda sobre **${business.name}**, aquí estaré. 😊";
    suggestions = ["Ver promociones", "Ver eventos", "Más información"];
  } else {
    content = `¡Entiendo! En **${business.name}** estamos para darte la mejor experiencia. ¿Te gustaría saber más sobre nuestras promociones vigentes o los eventos que tenemos preparados?`;
    suggestions = ["Ver promociones", "Ver eventos", "¿Dónde están?", "Contacto"];
  }

  return {
    id: `msg-${Date.now()}`,
    role: "assistant",
    content,
    timestamp: new Date(),
    suggestions,
    entityCards,
  };
}

function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/\n/g, "<br />");
}

function EntityCard({ entity, onClick }: { entity: BusinessManagedEntity; onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3 mt-2 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer group active:scale-[0.98] shadow-sm"
    >
      {entity.imageUrl ? (
        <img
          src={entity.imageUrl}
          alt={entity.name}
          className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-white/10"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg flex-shrink-0 bg-gradient-to-br from-purple-600/40 to-red-500/40 flex items-center justify-center border border-white/10">
          {entity.type === "promotion" ? (
            <Tag className="w-6 h-6 text-purple-300" />
          ) : (
            <Calendar className="w-6 h-6 text-blue-300" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
          entity.type === "promotion"
            ? "bg-purple-500/20 text-purple-300"
            : "bg-blue-500/20 text-blue-300"
        )}>
          {entity.type === "promotion" ? "🏷️ Promoción" : "🎉 Evento"}
        </span>
        <p className="text-slate-900 text-sm font-semibold mt-1 truncate">{entity.name}</p>
        <p className="text-slate-500 text-xs line-clamp-2 mt-0.5">{entity.description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 flex-shrink-0 self-center transition-colors" />
    </div>
  );
}

function ChatBubble({ message, onEntityClick }: { message: ChatMessage; onEntityClick?: (entity: BusinessManagedEntity) => void }) {
  const isAssistant = message.role === "assistant";
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300", isAssistant ? "flex-row" : "flex-row-reverse")}>
      {isAssistant && (
        <div className="flex-shrink-0 mt-1">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-[#053264] shadow-sm bg-[#053264] p-1.5">
            <img 
              src="https://www.image2url.com/r2/default/gifs/1778861156032-56811580-9ea6-4eab-9dd1-9cec2b902ccb.gif" 
              alt="SocioVIP Avatar" 
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}
      <div className={cn("max-w-[82%] space-y-1.5 group", isAssistant ? "items-start" : "items-end flex flex-col")}>
        <div className="relative">
          <div className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all",
            isAssistant
              ? "bg-white border border-slate-200 text-slate-800 rounded-tl-sm hover:bg-slate-50"
              : "bg-[#053264] text-white rounded-tr-sm hover:bg-[#053264]/90"
          )}>
            <div
              dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
              className="text-sm"
            />
          </div>
          
          {isAssistant && (
            <button 
              onClick={copyToClipboard}
              className="absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
              title="Copiar mensaje"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>

        {message.entityCards && message.entityCards.length > 0 && (
          <div className="w-full space-y-1">
            {message.entityCards.map((entity) => (
              <EntityCard 
                key={entity.id} 
                entity={entity} 
                onClick={() => onEntityClick?.(entity)}
              />
            ))}
          </div>
        )}
        <span className="text-slate-400 text-[10px] px-1">
          {message.timestamp.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

function SuggestionChips({ suggestions, onSelect }: { suggestions: string[]; onSelect: (s: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2 mb-4">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="text-xs px-3 py-1.5 bg-white hover:bg-secondary/20 border border-slate-200 hover:border-secondary/40 text-slate-600 hover:text-primary font-medium rounded-full transition-all duration-200 shadow-sm"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function BusinessChatPanel({ 
  business, 
  promotions, 
  events, 
  initialHistory = [], 
  onBusinessDetected,
  onBack,
  activePanel = "chat",
  onPanelChange
}: BusinessChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isIntroActive, setIsIntroActive] = useState(true);
  const [introStep, setIntroStep] = useState(0);
  const introTexts = [
    "Iniciando sistema concierge...",
    "Verificando accesos exclusivos...",
    "Preparando tus llaves para la ciudad...",
  ];
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const triggeredRef = useRef(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

    // Detectar si el último mensaje menciona negocios, eventos o promociones (soporta múltiples)
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "assistant" && onBusinessDetected) {
      const allEntities = [...promotions, ...events];
      const contentLower = lastMsg.content.toLowerCase();
      
      // Buscamos todos los negocios que coincidan de forma flexible respetando el orden de mención
      const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const contentNormalized = normalize(lastMsg.content);
      
      const foundBusinesses: { id: string, index: number }[] = [];
      
      allEntities.forEach(entity => {
        const bName = (entity as any).businessName;
        const eName = entity.name;
        
        const bIdx = bName ? contentNormalized.indexOf(normalize(bName)) : -1;
        const eIdx = eName ? contentNormalized.indexOf(normalize(eName)) : -1;
        
        const firstIdx = (bIdx !== -1 && eIdx !== -1) ? Math.min(bIdx, eIdx) : Math.max(bIdx, eIdx);
        
        if (firstIdx !== -1) {
          foundBusinesses.push({ id: entity.businessId, index: firstIdx });
        }
      });
      
      // Ordenamos por aparición en el texto y eliminamos duplicados
      const sortedIds = foundBusinesses
        .sort((a, b) => a.index - b.index)
        .map(f => f.id)
        .filter((id, idx, self) => self.indexOf(id) === idx);
      
      if (sortedIds.length > 0) {
        onBusinessDetected(sortedIds);
      }
    }
  }, [messages, isTyping]);

  // Intro Animation Logic
  useEffect(() => {
    if (!isIntroActive) return;

    const timer = setInterval(() => {
      setIntroStep((prev) => {
        if (prev >= introTexts.length - 1) {
          clearInterval(timer);
          // Pequena pausa final antes de entrar al chat
          setTimeout(() => {
            setIsIntroActive(false);
            setMessages(() => {
              if (initialHistory.length > 0) {
                return initialHistory.map((msg, idx) => ({
                  id: `init-${idx}`,
                  role: msg.role,
                  content: msg.content,
                  timestamp: new Date(),
                }));
              }
              return [buildWelcomeMessage(business, promotions, events)];
            });
          }, 1000);
          return prev;
        }
        return prev + 1;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [isIntroActive]);

  // AUTO-RESPONSE: Si entramos con un mensaje del usuario sin respuesta, responder automáticamente
  useEffect(() => {
    if (triggeredRef.current || isIntroActive) return;
    
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "user" && messages.length <= 2) {
      triggeredRef.current = true;
      const history = messages.slice(0, -1);
      processAiResponse(lastMsg.content, history);
    }
  }, []);

  const processAiResponse = async (text: string, currentHistory: ChatMessage[]) => {
    setIsTyping(true);
    try {
      // Limpiamos los datos para que sean objetos planos serializables (evita errores de Firebase Timestamp)
      const cleanPromotions = promotions.map(p => ({
        name: p.name,
        description: p.description,
        businessName: (p as any).businessName || 'Negocio SocioVIP',
        businessType: (p as any).businessType || 'Local',
        businessPhone: (p as any).businessPhone || '',
        locationAddress: p.locationAddress,
        province: (p as any).businessProvince || '',
        district: (p as any).businessDistrict || '',
        department: (p as any).businessDepartment || ''
      }));
      const cleanEvents = events.map(e => ({
        name: e.name,
        description: e.description,
        startDate: e.startDate,
        businessName: (e as any).businessName || 'Negocio SocioVIP',
        businessType: (e as any).businessType || 'Local',
        businessPhone: (e as any).businessPhone || '',
        locationAddress: e.locationAddress,
        province: (e as any).businessProvince || '',
        district: (e as any).businessDistrict || '',
        department: (e as any).businessDepartment || ''
      }));

      const response = await chatWithBusiness({
        message: text,
        history: currentHistory.map(m => ({ role: m.role as any, content: m.content })),
        business: { name: business.name, slogan: business.slogan, publicAddress: business.publicAddress },
        promotions: cleanPromotions as any,
        events: cleanEvents as any
      });

      const assistantMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: response.content,
        suggestions: (response as any).suggestions,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    await processAiResponse(text, messages);
  }, [business, promotions, events, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const showSuggestions = lastMessage?.role === "assistant" && lastMessage.suggestions && !isTyping;

  if (isIntroActive) {
    return (
      <div className="flex flex-col h-full bg-gradient-to-br from-[#053264] to-[#0a1e2b] items-center justify-center p-8 text-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-sm">
          <div className="mb-12 animate-blur-reveal">
            <SocioVipLogo size={280} variant="pill" pillPadding="py-2 px-[2%]" className="!aspect-[1.6/1] !h-auto object-fill shadow-2xl border border-white/20" />
          </div>
          
          <div className="h-20 flex flex-col items-center justify-center">
            <p 
              key={introStep}
              className="text-white text-xl font-headline italic tracking-widest animate-fade-in-up uppercase"
            >
              {introTexts[introStep]}
            </p>
            <div className="mt-6 flex gap-2">
              {introTexts.map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-700",
                    i === introStep ? "bg-secondary w-8" : "bg-white/20"
                  )} 
                />
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-12 left-0 w-full flex flex-col items-center">
          <p className="text-white/30 text-[10px] font-bold tracking-[0.3em] uppercase">
            Experiencia SocioVIP Concierge
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-100 via-white to-slate-200 relative overflow-hidden">
      {/* Header Premium Style */}
      <div className="flex-shrink-0 px-6 pt-4 pb-6 border-b border-slate-200 bg-white/60 backdrop-blur-md">
        <div className="hidden md:flex items-center justify-between mb-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="flex items-center gap-1 text-slate-400 hover:text-primary transition-colors group"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
              <span className="text-xs font-bold uppercase tracking-wider">Volver</span>
            </button>
          )}

          {/* Mobile Panel Switcher - Integrated in header */}
          {onPanelChange && (
            <div className="flex bg-slate-100 rounded-full p-1 border border-slate-200">
              <button 
                onClick={() => onPanelChange("chat")} 
                className={cn("p-1.5 rounded-full transition-all", activePanel === "chat" ? "bg-primary text-white shadow-sm" : "text-slate-400")}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onPanelChange("media")} 
                className={cn("p-1.5 rounded-full transition-all", activePanel === "media" ? "bg-primary text-white shadow-sm" : "text-slate-400")}
              >
                <Video className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onPanelChange("map")} 
                className={cn("p-1.5 rounded-full transition-all", activePanel === "map" ? "bg-primary text-white shadow-sm" : "text-slate-400")}
              >
                <Map className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <SocioVipLogo size={140} variant="pill" pillPadding="py-0 px-[1.5%]" className="!aspect-[1.6/1] !h-auto object-fill drop-shadow-lg" />
          <div className="flex flex-col border-l border-slate-200 pl-4 ml-1">
            <h3 className="text-slate-900 font-bold text-lg tracking-tight leading-none mb-1">
              Agente SocioVip
            </h3>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.15em]">
                SocioVIP Concierge
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
        {messages.map((msg) => (
          <ChatBubble 
            key={msg.id} 
            message={msg} 
            onEntityClick={(entity) => sendMessage(`Cuéntame más sobre: ${entity.name}`)}
          />
        ))}

        {isTyping && (
          <div className="flex gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex-shrink-0 mt-1">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-[#053264] shadow-sm bg-[#053264] p-1.5">
                <img 
                  src="https://www.image2url.com/r2/default/gifs/1778861156032-56811580-9ea6-4eab-9dd1-9cec2b902ccb.gif" 
                  alt="SocioVIP Avatar" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        
        {showSuggestions && lastMessage.suggestions && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SuggestionChips suggestions={lastMessage.suggestions} onSelect={sendMessage} />
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      {/* Quick info bar */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-slate-200 flex items-center gap-3 overflow-x-auto bg-white/40">
        {business.publicPhone && (
          <a
            href={`tel:${business.publicPhone}`}
            className="flex items-center gap-1.5 text-slate-500 hover:text-primary transition-colors text-xs whitespace-nowrap font-medium"
          >
            <Phone className="w-3 h-3" />
            {business.publicPhone}
          </a>
        )}
        {business.publicAddress && (
          <span className="flex items-center gap-1.5 text-slate-500 text-xs whitespace-nowrap font-medium">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate max-w-[120px]">{business.publicAddress}</span>
          </span>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-3 border-t border-slate-200 bg-white/60 backdrop-blur-md">
        <div className="relative p-[2px] rounded-[18px] overflow-hidden shadow-sm bg-slate-200/50">
          <style>{`
            @keyframes border-worm-spin {
              0% { transform: translate(-50%, -50%) rotate(0deg); }
              100% { transform: translate(-50%, -50%) rotate(360deg); }
            }
          `}</style>
          <div 
            className="absolute top-1/2 left-1/2 w-[200%] aspect-square pointer-events-none"
            style={{
              background: "conic-gradient(from 0deg, transparent 0deg, transparent 130deg, #10b981 160deg, #ccffbc 180deg, #10b981 200deg, transparent 230deg, transparent 360deg)",
              animation: "border-worm-spin 3.5s linear infinite"
            }}
          />
          <div className="relative z-10 flex items-end gap-2 bg-white rounded-[16px] px-3 py-2 w-full h-full">
          <button
            onClick={() => toast({
              title: "Próximamente",
              description: "La funcionalidad de adjuntar archivos estará disponible muy pronto.",
            })}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-primary transition-colors"
            title="Adjuntar"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta cualquier cosa..."
            rows={1}
            className="flex-1 bg-transparent text-slate-800 placeholder:text-slate-400 text-sm resize-none outline-none max-h-28 min-h-[20px] leading-5 py-0"
            style={{ height: "auto" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
            }}
          />
          <button
            onClick={() => toast({
              title: "Próximamente",
              description: "El asistente de voz estará disponible muy pronto.",
            })}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-primary transition-colors"
            title="Voz"
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim()}
            className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200",
              input.trim()
                ? "bg-[#053264] text-white shadow-lg shadow-blue-500/20 hover:scale-105"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            )}
            title="Enviar"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
          </div>
        </div>
        <p className="text-center text-slate-400 text-[10px] mt-2">
          Asistente de {business.name} · Powered by SocioVIP
        </p>
      </div>
    </div>
  );
}
