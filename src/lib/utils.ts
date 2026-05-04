import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BusinessManagedEntity, GeneratedCode, TicketType, Business, EventSchedule } from "./types";
import { Timestamp, FieldValue } from "firebase/firestore";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { format, parse, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function anyToDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value.seconds === "number" || typeof value._seconds === "number") {
    const seconds = value.seconds ?? value._seconds;
    const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0;
    const ms = seconds * 1000 + Math.floor(nanoseconds / 1e6);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const m = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      const norm = value.replace(/-/g, "/");
      const hasTime = !!m[4];
      const pattern = hasTime ? "dd/MM/yyyy HH:mm:ss" : "dd/MM/yyyy";
      const candidate = hasTime && norm.length === 16 ? `${norm}:00` : norm;
      const d = parse(candidate, pattern, new Date());
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function renderDate(value: any, fmt = "P p") {
  const d = anyToDate(value);
  return d ? format(d, fmt, { locale: es }) : "N/A";
}

export function isEntityCurrentlyActivatable(
  entity: BusinessManagedEntity | null | undefined
): boolean {
  if (!entity || !entity.isActive) return false;
  try {
    const now = new Date();
    const end = anyToDate(entity.endDate);
    if (!end) return false;
    const endLimit = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
    if (entity.type === 'event') {
      return now <= endLimit;
    }
    const start = anyToDate(entity.startDate);
    if (!start) return false;
    const startLimit = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
    return now >= startLimit && now <= endLimit;
  } catch (error) {
    return false;
  }
}

/**
 * Retorna el horario (sesión) activa actualmente para un evento.
 */
export function getCurrentSchedule(entity: BusinessManagedEntity): EventSchedule | null {
  if (!entity.schedules || entity.schedules.length === 0) return null;
  const now = new Date();
  return entity.schedules.find(s => {
    const start = anyToDate(s.startDate);
    const end = anyToDate(s.endDate);
    if (!start || !end) return false;
    return isWithinInterval(now, { start, end });
  }) || null;
}

export function calculateMaxAttendance(ticketTypes: TicketType[] | undefined): number {
  if (!ticketTypes || ticketTypes.length === 0) return 0;
  const hasUnlimitedTickets = ticketTypes.some(t => t.quantity === undefined || t.quantity === 0);
  if (hasUnlimitedTickets) return 0;
  return ticketTypes.reduce((sum, ticket) => sum + (ticket.quantity || 0), 0);
}

export function sanitizeObjectForFirestore(obj: any): any {
  if (obj instanceof Timestamp || obj instanceof FieldValue) return obj;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObjectForFirestore(item));
  const sanitizedObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      sanitizedObj[key] = value === undefined ? null : sanitizeObjectForFirestore(value);
    }
  }
  return sanitizedObj;
}

export const generateCodesPDF = async (
  codes: GeneratedCode[],
  businessDetails: Business,
  entity: BusinessManagedEntity
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const codesPerPage = 20;
  const numPages = Math.ceil(codes.length / codesPerPage);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 5;
  const contentWidth = pageWidth - margin * 2;
  const numCols = 5;
  const numRows = 4;
  const cellWidth = contentWidth / numCols;
  const cellHeight = (doc.internal.pageSize.getHeight() - margin * 2) / numRows;

  for (let page = 0; page < numPages; page++) {
    if (page > 0) doc.addPage();
    const pageCodes = codes.slice(page * codesPerPage, (page + 1) * codesPerPage);
    for (let i = 0; i < pageCodes.length; i++) {
      const code = pageCodes[i];
      const col = i % numCols;
      const row = Math.floor(i / numCols);
      const x = margin + col * cellWidth;
      const y = margin + row * cellHeight;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(businessDetails.name, x + cellWidth / 2, y + 8, { align: "center" });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Entrada #${page * codesPerPage + i + 1}`, x + cellWidth / 2, y + 12, { align: "center" });

      const businessUrl = businessDetails.customUrlPath
        ? `https://sociovip.app/${businessDetails.customUrlPath}`
        : `https://sociovip.app/business/${entity.businessId}`;
        
      const qrSize = cellWidth * 0.7;
      const qrCodeDataUrl = await QRCode.toDataURL(businessUrl, { errorCorrectionLevel: "H", width: qrSize, margin: 1 });
      doc.addImage(qrCodeDataUrl, "PNG", x + (cellWidth - qrSize) / 2, y + 14, qrSize, qrSize);

      doc.setFontSize(7);
      doc.text("Genera tu entrada QR", x + cellWidth / 2, y + 14 + qrSize + 4, { align: "center" });
      doc.text("con este código:", x + cellWidth / 2, y + 14 + qrSize + 7, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(code.value, x + cellWidth / 2, y + 14 + qrSize + 12, { align: "center" });

      if (code.ticketTypeId && entity.ticketTypes) {
        const ticketType = entity.ticketTypes.find(t => t.id === code.ticketTypeId);
        if (ticketType) {
          const text = ticketType.name.toUpperCase();
          const pHeight = 6;
          doc.setFillColor(ticketType.color || "#888888");
          doc.roundedRect(x + (cellWidth - (doc.getTextWidth(text) + 4)) / 2, y + 14 + qrSize + 15, doc.getTextWidth(text) + 4, pHeight, pHeight / 2, pHeight / 2, "F");
          doc.setTextColor("#FFFFFF");
          doc.text(text, x + cellWidth / 2, y + 14 + qrSize + 15 + 4, { align: "center" });
          doc.setTextColor("#000000");
        }
      }
    }
  }
  doc.save(`${businessDetails.name}_${entity.name}_codes.pdf`);
};
