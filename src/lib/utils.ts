import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { BusinessManagedEntity, TicketType } from "./types";
import { Timestamp,FieldValue } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  
  // Firestore-like object from server-side rendering { _seconds, _nanoseconds }
  if (typeof value._seconds === 'number' || typeof value.seconds === 'number') {
    const seconds = value._seconds ?? value.seconds;
    const nanoseconds = value._nanoseconds ?? value.nanoseconds ?? 0;
    const ms = seconds * 1000 + Math.floor(nanoseconds / 1e6);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO string or other string parsable by Date constructor
  if (typeof value === 'string') {
    const parsed = new Date(value);
    // Check if parsing resulted in a valid date
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  // Number (milliseconds since epoch)
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  console.warn("anyToDate: Could not parse date value:", value);
  return null;
}

export function isEntityCurrentlyActivatable(entity: BusinessManagedEntity | null | undefined): boolean {
  if (!entity || !entity.isActive) {
    return false;
  }

  try {
    const now = new Date();
    
    const entityStartDateObj = anyToDate(entity.startDate);
    const entityEndDateObj = anyToDate(entity.endDate);

    if (!entityStartDateObj || !entityEndDateObj) {
      console.warn("isEntityCurrentlyActivatable: Entity has missing or invalid dates:", entity?.name, {start: entity.startDate, end: entity.endDate});
      return false;
    }
    
    // Set time to the beginning of the start day and end of the end day for accurate comparison
    const start = new Date(entityStartDateObj.getFullYear(), entityStartDateObj.getMonth(), entityStartDateObj.getDate(), 0, 0, 0, 0);
    const end = new Date(entityEndDateObj.getFullYear(), entityEndDateObj.getMonth(), entityEndDateObj.getDate(), 23, 59, 59, 999);
    
    return now >= start && now <= end;
    
  } catch (error) {
    console.error("isEntityCurrentlyActivatable: Error parsing dates for entity:", entity?.name, error);
    return false;
  }
}

export function calculateMaxAttendance(ticketTypes: TicketType[] | undefined): number {
  if (!ticketTypes || ticketTypes.length === 0) {
    return 0; 
  }
  return ticketTypes.reduce((sum, ticket) => {
    if (ticket.quantity && typeof ticket.quantity === 'number' && ticket.quantity > 0) {
      return sum + ticket.quantity;
    }
    return sum;
  }, 0);
}

// Helper function to sanitize an object for Firestore by converting undefined to null
export function sanitizeObjectForFirestore(obj: any): any {
  // If the object is a Firestore special type (like a FieldValue for serverTimestamp), return it directly.
  if (obj && typeof obj.isEqual === 'function') {
    // This is a crude way to detect FieldValue types like serverTimestamp() or Timestamp.
    // A more robust check might be needed if other object types have `isEqual`.
    return obj;
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectForFirestore(item));
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
