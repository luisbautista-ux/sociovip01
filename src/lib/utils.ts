

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BusinessManagedEntity, GeneratedCode, TicketType, Business } from "./types";
import { Timestamp, FieldValue } from "firebase/firestore";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Robustly converts various date formats (Timestamp, Date object, ISO string, etc.) to a JavaScript Date object.
 * Returns null if the conversion is not possible.
 */
export function anyToDate(value: any): Date | null {
  if (!value) return null;

  // Already a Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Firestore Timestamp object (has toDate method)
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  // Firestore-like object from server-side rendering { _seconds, _nanoseconds } or { seconds, nanoseconds }
  if (typeof value.seconds === "number" || typeof value._seconds === "number") {
    const seconds = value.seconds ?? value._seconds;
    const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0;
    const ms = seconds * 1000 + Math.floor(nanoseconds / 1e6);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO string or other string parsable by Date constructor
  if (typeof value === "string") {
    // Soporte a dd/MM/yyyy o dd-MM-yyyy (con o sin hora)
    const m = value.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (m) {
      const norm = value.replace(/-/g, "/");
      const hasTime = !!m[4];
      const pattern = hasTime ? "dd/MM/yyyy HH:mm:ss" : "dd/MM/yyyy";
      const candidate = hasTime && norm.length === 16 ? `${norm}:00` : norm; // completa :ss si falta
      const d = parse(candidate, pattern, new Date());
      return isNaN(d.getTime()) ? null : d;
    }

    // ISO u otros formatos que Date pueda entender
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // Number (milliseconds since epoch)
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  console.warn("anyToDate: Could not parse date value:", value);
  return null;
}

export function renderDate(value: any, fmt = "P p") {
  const d = anyToDate(value);
  return d ? format(d, fmt, { locale: es }) : "N/A";
}


export function isEntityCurrentlyActivatable(
  entity: BusinessManagedEntity | null | undefined
): boolean {
  if (!entity || !entity.isActive) {
    return false;
  }

  try {
    const now = new Date();

    const entityStartDateObj = anyToDate(entity.startDate);
    const entityEndDateObj = anyToDate(entity.endDate);

    if (!entityStartDateObj || !entityEndDateObj) {
      console.warn(
        "isEntityCurrentlyActivatable: Entity has missing or invalid dates:",
        entity?.name,
        { start: entity.startDate, end: entity.endDate }
      );
      return false;
    }

    // Set time to the beginning of the start day and end of the end day for accurate comparison
    const start = new Date(
      entityStartDateObj.getFullYear(),
      entityStartDateObj.getMonth(),
      entityStartDateObj.getDate(),
      0,
      0,
      0,
      0
    );
    const end = new Date(
      entityEndDateObj.getFullYear(),
      entityEndDateObj.getMonth(),
      entityEndDateObj.getDate(),
      23,
      59,
      59,
      999
    );

    return now >= start && now <= end;
  } catch (error) {
    console.error(
      "isEntityCurrentlyActivatable: Error parsing dates for entity:",
      entity?.name,
      error
    );
    return false;
  }
}

export function calculateMaxAttendance(
  ticketTypes: TicketType[] | undefined
): number {
  if (!ticketTypes || ticketTypes.length === 0) {
    return 0;
  }
  // Check if any ticket has an undefined or zero quantity
  const hasUnlimitedTickets = ticketTypes.some(
    (ticket) => ticket.quantity === undefined || ticket.quantity === 0
  );
  if (hasUnlimitedTickets) {
    return 0; // Represents unlimited attendance
  }
  // Sum quantities if all are defined
  return ticketTypes.reduce((sum, ticket) => sum + (ticket.quantity || 0), 0);
}

// Helper function to sanitize an object for Firestore by converting undefined to null
export function sanitizeObjectForFirestore(obj: any): any {
  if (obj instanceof Timestamp || obj instanceof FieldValue) {
    return obj;
  }

  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObjectForFirestore(item));
  }

  const sanitizedObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value === undefined) {
        sanitizedObj[key] = null; // Convert undefined to null
      } else {
        sanitizedObj[key] = sanitizeObjectForFirestore(value); // Recurse for nested objects
      }
    }
  }
  return sanitizedObj;
}

export const generateCodesPDF = async (
  codes: GeneratedCode[],
  businessDetails: Business,
  entity: BusinessManagedEntity
) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const codesPerPage = 20; // 5 columns x 4 rows
  const numPages = Math.ceil(codes.length / codesPerPage);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 5;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  const numCols = 5;
  const numRows = 4;

  const cellWidth = contentWidth / numCols;
  const cellHeight = contentHeight / numRows;

  for (let page = 0; page < numPages; page++) {
    if (page > 0) {
      doc.addPage();
    }
    const pageCodes = codes.slice(
      page * codesPerPage,
      (page + 1) * codesPerPage
    );

    for (let i = 0; i < pageCodes.length; i++) {
      const code = pageCodes[i];
      const col = i % numCols;
      const row = Math.floor(i / numCols);

      const x = margin + col * cellWidth;
      const y = margin + row * cellHeight;

      // Business Name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(businessDetails.name, x + cellWidth / 2, y + 8, { align: "center" });
      
      // Correlative Number
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const correlative = page * codesPerPage + i + 1;
      doc.text(`Entrada #${correlative}`, x + cellWidth / 2, y + 12, { align: "center" });

      // QR Code
      const businessUrl = businessDetails.customUrlPath
        ? `https://sociovip.app/${businessDetails.customUrlPath}`
        : `https://sociovip.app/business/${entity.businessId}`;
        
      const qrSize = cellWidth * 0.7;
      const qrCodeDataUrl = await QRCode.toDataURL(businessUrl, {
        errorCorrectionLevel: "H",
        width: qrSize,
        margin: 1,
      });
      const qrYPos = y + 14;
      doc.addImage(
        qrCodeDataUrl,
        "PNG",
        x + (cellWidth - qrSize) / 2,
        qrYPos,
        qrSize,
        qrSize
      );

      // Text below QR
      const textYPos = qrYPos + qrSize + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("Genera tu entrada QR", x + cellWidth / 2, textYPos, { align: "center" });
      doc.text("con este código:", x + cellWidth / 2, textYPos + 3, { align: "center" });

      // Dynamic Code
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(code.value, x + cellWidth / 2, textYPos + 8, {
        align: "center",
      });

      // Ticket Type "Pulsera"
      if (code.ticketTypeId && entity.ticketTypes) {
        const ticketType = entity.ticketTypes.find(t => t.id === code.ticketTypeId);
        if (ticketType) {
          const pulseraY = textYPos + 11;
          const pulseraHeight = 6;
          const borderRadius = pulseraHeight / 2; // Radio para puntas totalmente redondeadas
          const pulseraWidth = cellWidth * 0.8;
          const pulseraX = x + (cellWidth - pulseraWidth) / 2;

          doc.setDrawColor(0);
          doc.setFillColor(ticketType.color || "#888888");
          doc.roundedRect(pulseraX, pulseraY, pulseraWidth, pulseraHeight, borderRadius, borderRadius, "F");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor("#FFFFFF");
          doc.text(ticketType.name.toUpperCase(), x + cellWidth / 2, pulseraY + 4, { align: "center" });
          doc.setTextColor("#000000"); // Reset text color
        }
      }
    }
  }

  doc.save(`${businessDetails.name}_${entity.name}_codes.pdf`);
};
