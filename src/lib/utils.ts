
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { BusinessManagedEntity, TicketType } from "./types";
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isEntityCurrentlyActivatable(entity: BusinessManagedEntity | null | undefined): boolean {
  if (!entity || !entity.isActive) {
    return false;
  }

  try {
    const now = new Date();

    const toDate = (dateValue: any): Date | null => {
      if (!dateValue) return null;
      if (dateValue instanceof Date) return dateValue;
      if (dateValue instanceof Timestamp) return dateValue.toDate();
      if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) return parsed;
      }
      return null;
    };
    
    const entityStartDateObj = toDate(entity.startDate);
    const entityEndDateObj = toDate(entity.endDate);

    if (!entityStartDateObj || !entityEndDateObj) {
      console.warn("isEntityCurrentlyActivatable: Entity has missing or invalid dates:", entity?.name);
      return false;
    }
    
    // Set time to the beginning of the start day and end of the end day for accurate comparison
    entityStartDateObj.setHours(0, 0, 0, 0);
    entityEndDateObj.setHours(23, 59, 59, 999);
    
    return now >= entityStartDateObj && now <= entityEndDateObj;
    
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
  if (obj === null || typeof obj !== 'object') {
    if (obj instanceof Date) { // Firestore Timestamps are fine, Dates from JS forms need conversion before this
        return Timestamp.fromDate(obj);
    }
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
      } else if (value instanceof Date) { // Handle Date objects explicitly if they appear
        sanitizedObj[key] = Timestamp.fromDate(value); // Convert to Firestore Timestamp
      } else {
        sanitizedObj[key] = sanitizeObjectForFirestore(value); // Recurse for nested objects
      }
    }
  }
  return sanitizedObj;
}
