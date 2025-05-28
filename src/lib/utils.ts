
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
    // Ensure startDate and endDate are valid date strings or already Date objects
    const entityStartDateStr = typeof entity.startDate === 'string' ? entity.startDate : (entity.startDate instanceof Date ? entity.startDate.toISOString() : (entity.startDate instanceof Timestamp ? entity.startDate.toDate().toISOString() : undefined));
    const entityEndDateStr = typeof entity.endDate === 'string' ? entity.endDate : (entity.endDate instanceof Date ? entity.endDate.toISOString() : (entity.endDate instanceof Timestamp ? entity.endDate.toDate().toISOString() : undefined));


    if (!entityStartDateStr || !entityEndDateStr) {
      console.warn("isEntityCurrentlyActivatable: Entity has missing or invalid startDate/endDate:", entity?.name, entityStartDateStr, entityEndDateStr);
      return false;
    }
    
    const entityStartDateObj = new Date(entityStartDateStr);
    const entityEndDateObj = new Date(entityEndDateStr);

    if (isNaN(entityStartDateObj.getTime()) || isNaN(entityEndDateObj.getTime())) {
      console.error("isEntityCurrentlyActivatable: Invalid date string for entity:", entity?.name, entity.startDate, entity.endDate);
      return false; 
    }

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const effectiveStartDate = new Date(entityStartDateObj.getFullYear(), entityStartDateObj.getMonth(), entityStartDateObj.getDate());
    // Set end date to the very end of the day for inclusive comparison
    const effectiveEndDate = new Date(entityEndDateObj.getFullYear(), entityEndDateObj.getMonth(), entityEndDateObj.getDate(), 23, 59, 59, 999);
    
    return today >= effectiveStartDate && today <= effectiveEndDate;
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
