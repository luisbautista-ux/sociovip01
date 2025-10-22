import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BusinessManagedEntity, GeneratedCode, TicketType } from "./types";
import { Timestamp, FieldValue } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

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
    const parsed = new Date(value);
    // Check if parsing resulted in a valid date and is not a nonsensical year like 0001
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
      return parsed;
    }
  }

  // Number (milliseconds since epoch)
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  console.warn("anyToDate: Could not parse date value:", value);
  return null;
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
  businessName: string,
  businessUrl: string
) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const codesPerPage = 10;
  const numPages = Math.ceil(codes.length / codesPerPage);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const cellWidth = contentWidth / 5;
  const cellHeight = (pageHeight - margin * 2) / 2;

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
      const col = i % 5;
      const row = Math.floor(i / 5);

      const x = margin + col * cellWidth;
      const y = margin + row * cellHeight;

      // Business Name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(businessName, x + cellWidth / 2, y + 15, { align: "center" });

      // QR Code
      const qrCodeDataUrl = await QRCode.toDataURL(businessUrl, {
        errorCorrectionLevel: "H",
        width: cellWidth * 0.8,
      });
      doc.addImage(
        qrCodeDataUrl,
        "PNG",
        x + cellWidth * 0.1,
        y + 20,
        cellWidth * 0.8,
        cellWidth * 0.8
      );

      // Text below QR
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Genera tu entrada QR", x + cellWidth / 2, y + 25 + cellWidth * 0.8, {
        align: "center",
      });
      doc.text("con este código:", x + cellWidth / 2, y + 29 + cellWidth * 0.8, {
        align: "center",
      });

      // Dynamic Code
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(code.value, x + cellWidth / 2, y + 35 + cellWidth * 0.8, {
        align: "center",
      });
    }
  }

  doc.save(`${businessName}_codes.pdf`);
};
